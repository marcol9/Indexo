// Integration tests hitting the exported Express app (see docs/solution_design.md §9).
// These are expected to fail (routes/service/repository are not implemented yet).
import request from "supertest";
import { app } from "../../app";

const validPayment = {
  paymentId: "11111111-1111-1111-1111-111111111111",
  amount: 100.5,
  currency: "EUR",
  debtorIban: "LV97HABA0012345678910",
  creditorIban: "LV12PARX0000000000001",
  reference: "Invoice 42",
};

describe("GET /payments (empty store)", () => {
  it("returns { payments: [] } before anything has been accepted", async () => {
    const res = await request(app).get("/payments");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ payments: [] });
  });
});

describe("POST /payments", () => {
  it("accepts a valid payment with 201 Created and lists it via GET /payments", async () => {
    const postRes = await request(app).post("/payments").send(validPayment);
    expect(postRes.status).toBe(201);

    const listRes = await request(app).get("/payments");
    expect(listRes.body).toEqual({ payments: [validPayment] });
  });

  it("is idempotent for a repeated paymentId, returning 200 OK (see §6)", async () => {
    await request(app).post("/payments").send(validPayment);
    const retryRes = await request(app).post("/payments").send(validPayment);
    expect(retryRes.status).toBe(200);

    const listRes = await request(app).get("/payments");
    const matches = (listRes.body.payments as Array<{ paymentId: string }>).filter(
      (p) => p.paymentId === validPayment.paymentId,
    );
    expect(matches).toHaveLength(1);
  });

  it.each([
    ["negative amount", { ...validPayment, paymentId: "neg-amount", amount: -50 }],
    ["unsupported currency", { ...validPayment, paymentId: "bad-currency", currency: "JPY" }],
    ["too many decimal places", { ...validPayment, paymentId: "bad-decimals", amount: 10.999 }],
    ["missing required fields", { paymentId: "missing-fields", amount: 25 }],
    [
      "wrong field types",
      {
        paymentId: "",
        amount: "ten",
        currency: "EUR",
        debtorIban: "12345",
        creditorIban: "LV12PARX0000000000001",
      },
    ],
  ])("rejects %s with 400 Bad Request (see §5)", async (_label, body) => {
    const res = await request(app).post("/payments").send(body);
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400 instead of crashing", async () => {
    const res = await request(app)
      .post("/payments")
      .set("Content-Type", "application/json")
      .send('{ "paymentId": "broken"');
    expect(res.status).toBe(400);
  });

  it("omits or nulls reference when not provided", async () => {
    const payment = { ...validPayment, paymentId: "no-reference" };
    delete (payment as { reference?: string }).reference;

    await request(app).post("/payments").send(payment);
    const listRes = await request(app).get("/payments");
    const stored = (listRes.body.payments as Array<{ paymentId: string; reference?: unknown }>).find(
      (p) => p.paymentId === payment.paymentId,
    );

    expect(stored?.reference === undefined || stored?.reference === null).toBe(true);
  });

  it("preserves acceptance order across multiple payments", async () => {
    const first = { ...validPayment, paymentId: "order-first" };
    const second = { ...validPayment, paymentId: "order-second" };

    await request(app).post("/payments").send(first);
    await request(app).post("/payments").send(second);

    const listRes = await request(app).get("/payments");
    const ids = (listRes.body.payments as Array<{ paymentId: string }>).map((p) => p.paymentId);
    expect(ids.indexOf(first.paymentId)).toBeLessThan(ids.indexOf(second.paymentId));
  });
});
