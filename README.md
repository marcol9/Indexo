# Payment Intake API

A small HTTP API that accepts payment submissions, validates them, stores
accepted payments in memory (deduplicated by `paymentId`), and lists them
back in acceptance order. See [`docs/solution_design.md`](docs/solution_design.md)
for the full design rationale and [`docs/assignment/TASK 1.md`](docs/assignment/TASK%201.md)
for the original brief.

## Running it

```bash
npm install
npm start        # server on http://localhost:3000
```

## Tests

```bash
npm test
```

Jest + Supertest, hitting the exported Express app directly (no network port
needed). Covers acceptance (`201`), idempotent retries (`200`), validation
failures (`400`), malformed JSON, and the `GET /payments` response shape.

## Other scripts

```bash
npm run build   # tsc -> dist/
npm run lint    # eslint .
```

## Key decisions

- **Express**, not a full framework — the whole task is a couple of routes
  and one in-memory store. NestJS would be the better choice for a real 
  production version of this service.
- **Layered, feature-based structure** (`routes → controller → schema →
  service → repository`) so the storage layer can be swapped for a real
  database later without touching the service or controller.
- **Idempotency**: a repeated `paymentId` returns `200 OK` with the
  already-stored payment rather than `409 Conflict` — a retry of a
  succeeded request should look like success to the client.
- **Status codes**: new payment → `201`, retried payment → `200`, invalid
  input (including malformed JSON) → `400`, unexpected failures → `500`.

## What I'd improve with more time

- Implement Verification of Payee API to cross-verify payment data (IBAN,
  Name, etc.) and make sure it is valid.
- IBAN check per mod-97 validation.
- Pagination on `GET /payments`.
- Authentication and rate limiting.
- Structured logging with correlationID.
- `/health` (liveness/readiness) endpoint, useful once this runs behind
  an orchestrator or load balancer.
- OpenAPI/Swagger spec — to have this API's contract.

See [`docs/solution_design.md`](docs/solution_design.md) for the complete
reasoning behind these choices.
