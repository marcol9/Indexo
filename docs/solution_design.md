# Solution Design — Payment Intake API

Task version 1.3, 2026-07-14. This document captures the technical decisions
for implementing the service described in [`TASK 1.md`](./assignment/TASK%201.md).

## 1. Overview

A small HTTP API that accepts payment submissions, validates them, stores
accepted payments in memory (deduplicated by `paymentId`), and lists them
back in acceptance order. No persistence, no auth, no external services —
scoped intentionally to the size of the task.

## 2. Tech stack

| Concern              | Choice                          |
|-----------------------|----------------------------------|
| Language              | TypeScript                      |
| Runtime                | Node.js 20+                     |
| Web framework          | Express.js 4                    |
| Validation             | zod                             |
| HTTP request logging   | morgan                          |
| Security headers       | helmet                          |
| Dev server / reload    | tsx                             |
| Build                   | tsc                              |
| Testing                | Jest + Supertest                |
| Linting / formatting   | ESLint + Prettier                |

### Why Express (and why NestJS would be the better production choice)

Express is used here because it's the pragmatic choice for a service of
this size: minimal ceremony, fast to set up, and the whole task is a couple
of routes plus one in-memory store. Pulling in a full framework would be
over-engineering for what's asked.

For a real production payment-intake service, **NestJS** would be the
better long-term choice:

- **Built-in DI container** — repositories/services are provided and
  injected instead of manually wired, which matters once there are more
  modules (ledger client, notifications, auditing, etc.) and you want to
  swap implementations (e.g. in-memory → Postgres repository) without
  touching consumers.
- **Structural conventions enforced by the framework** (modules,
  controllers, providers) — reduces bikeshedding and keeps large codebases
  consistent across teams, instead of relying on discipline alone as in
  Express.
- **First-class validation via pipes** (`class-validator` /
  `nestjs-zod`) integrated into the request lifecycle, rather than being
  called manually in each handler.
- **Testing ergonomics** — the DI container makes it trivial to swap real
  providers for mocks/fakes in unit tests without monkeypatching modules.
- **Built-in support for cross-cutting concerns** — guards, interceptors,
  exception filters — which map well to things this kind of service will
  eventually need (auth, idempotency-key handling, structured audit
  logging, rate limiting).
- **OpenAPI generation** out of the box via decorators, useful once other
  services (like the ledger) need to integrate against this API's contract.

In short: Express keeps this exercise lean; NestJS is what I'd reach for
once this service has multiple developers, multiple modules, and needs to
be integrated with other systems (e.g. the ledger service mentioned in the
task) rather than living on its own.

## 3. Architecture

Layered, feature-based design so each concern is testable and swappable in
isolation:

```
HTTP request
  → routes            (wiring: method + path → controller)
  → controller         (parses req/res, no business logic)
  → schema (zod)        (validates & coerces raw input)
  → service             (business rules: validation orchestration, idempotency)
  → repository interface (port)
      → in-memory repository (adapter, swappable for a real DB later)
  → error middleware    (catches everything, maps to 4xx/5xx-safe response)
```

The repository is defined as an interface (`PaymentRepository`) with a
single `InMemoryPaymentRepository` implementation. The service depends only
on the interface, so a future `PostgresPaymentRepository` (or similar) can
be substituted without touching the service or controller layer.

## 4. Folder structure

Feature-based modules instead of a flat `routes/ services/ models/` split.
This scales better as more resources are added (this task only has
"payments", but a real system would grow), and each module maps cleanly to
what would become a NestJS module if the service is migrated later.

```
indexo/
├── docs/
│   ├── assignment/
│   │   ├── TASK 1.md
│   │   └── requests 1.http
│   └── solution_design.md
├── src/
│   ├── server.ts                 # entry point: starts the HTTP listener
│   ├── app.ts                    # builds & exports the Express app (no listen()) — enables supertest without a real socket
│   ├── config/
│   │   └── index.ts              # env parsing (PORT, etc.)
│   ├── modules/
│   │   └── payments/
│   │       ├── payments.routes.ts       # Router: wires HTTP verbs+paths to controller
│   │       ├── payments.controller.ts   # req/res glue, calls service, sends response
│   │       ├── payments.service.ts      # business rules (dedupe, orchestration)
│   │       ├── payments.repository.ts   # PaymentRepository interface + InMemory impl
│   │       ├── payments.schema.ts       # zod schemas + inferred types
│   │       ├── payments.types.ts        # domain types (Payment, dto's)
│   │       └── payments.test.ts         # unit + supertest integration tests
│   └── common/
│       ├── middleware/
│       │   ├── errorHandler.ts   # central error → HTTP response mapping
│       │   ├── notFound.ts       # 404 fallback for unknown routes
│       │   └── requestLogger.ts  # morgan setup
│       ├── errors/
│       │   └── AppError.ts       # base class: message + statusCode (+ subclasses)
│       └── utils/
│           └── asyncHandler.ts   # wraps async route handlers so rejections reach errorHandler
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
└── README.md
```

Rationale:

- **`app.ts` vs `server.ts` split** — `app.ts` builds and exports the
  configured Express app without calling `listen()`; `server.ts` is the
  only place that starts the network listener. This lets Supertest hit the
  app in-process (no real port binding) in tests.
- **`modules/payments/*`** groups everything about the "payments" feature
  together, so adding a second resource later doesn't mean touching a
  shared `routes.ts`/`services.ts` grab-bag.
  `payments.repository.ts` holds the **interface** and the in-memory
  implementation. Swapping storage later means adding a new file and
  changing one line of composition — not touching the service.
- **`common/`** holds cross-cutting pieces (error handling, logging,
  shared error types) used by every module, keeping modules themselves free
  of infrastructure concerns.

## 5. Validation rules (via zod)

- `paymentId`: required, non-empty string (`z.string().min(1)`). Not
  required to be a UUID — the task only guarantees the client generates it.
- `amount`: required, positive number, at most 2 decimal places. Checked
  with a custom refinement (`Number.isInteger(amount * 100)` after
  rounding-safe handling) since `amount` arrives as JSON `number`.
- `currency`: `z.enum(["EUR", "USD", "GBP"])`.
- `debtorIban` / `creditorIban`: `z.string().regex(...)` — 2 letters + 15–34
  total alphanumeric chars, per the task's "basic sanity check", not full
  mod-97 validation.
- `reference`: `z.string().optional()`.

Anything failing schema validation → `400 Bad Request` with a small JSON
error body (field + reason), never a throw that reaches an unhandled path.

## 6. Idempotency (duplicate `paymentId`)

Decision: a repeated `paymentId` with the **same or different** body
returns **`200 OK`** with the already-stored payment (no new entry created,
`GET /payments` still lists it exactly once).

Reasoning: this matches how idempotent retry semantics are usually modeled
in payment APIs (e.g., Stripe's idempotency keys) — from the client's point
of view, a retry of a request that already succeeded should look like
success, not like an error to handle. `409 Conflict` was considered but
rejected because it would force well-behaved retrying clients to treat a
successful outcome as a failure case.

## 7. Error handling & status codes

- All route handlers are wrapped (`asyncHandler`) so thrown/rejected errors
  always reach the central `errorHandler` middleware — nothing can crash
  the process from a request handler.
- `AppError` (with subclasses like `ValidationError`) carries an explicit
  `statusCode`; unexpected/unknown errors fall back to `500` **only** for
  truly unexpected internal failures, never for bad client input (those are
  always mapped to `400`).
- Malformed JSON bodies (`express.json()` parse failure, e.g. Case 9 in the
  sample requests) are caught in `errorHandler` and mapped to `400`, not
  left to Express's default handler.
- Summary: accepted → `2xx`, rejected input → `4xx`, retry of an already
  accepted payment → `200` (see §6), unexpected errors → `500` handled by
  middleware rather than an uncaught crash.

## 8. Security & robustness notes

- `helmet` for baseline secure headers.
- `express.json({ limit: "..." })` with a small body size limit to avoid
  trivially large payload abuse.
- Strict schema validation on all inbound fields (no implicit coercion of
  unexpected types) — the schema is the trust boundary.
- No sensitive data logged (morgan configured to avoid logging bodies).

## 9. Testing strategy

- Jest + Supertest, hitting the exported `app` (§4) directly — no network
  port needed.
- Unit tests: `payments.service.ts` idempotency logic and validation edge
  cases in isolation, `InMemoryPaymentRepository` behavior.
- Integration tests: cover the sample cases in
  [`requests 1.http`](./assignment/requests%201.http) — valid payment, retry,
  each invalid case (negative amount, bad currency, too many decimals,
  missing fields, wrong types, broken JSON), and the `GET /payments` shape.

## 10. Known shortcuts / what I'd improve with more time

- No pagination on `GET /payments` — fine for an in-memory demo store, would
  need it once the store isn't trivially small.
- No structured/correlation-id logging — `morgan` is enough for this scope;
  would move to `pino` + request IDs for real observability.
- No rate limiting / auth — explicitly out of scope per the task.
- IBAN check is intentionally shallow (per task instructions), not mod-97.
