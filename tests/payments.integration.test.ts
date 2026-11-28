import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "@neondatabase/serverless";
import {
  createTestPool,
  getTestDatabaseUrl,
  seedFeeSchedule,
  seedPupil,
  truncateAll,
} from "./helpers/testDb";
import { startTestServer, type TestServer } from "./helpers/testApp";

const testDatabaseUrl = getTestDatabaseUrl();
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("POST /payments (integration)", () => {
  let pool: Pool;
  let server: TestServer;
  let pupilId: number;
  let feeScheduleId: number;

  beforeAll(async () => {
    pool = await createTestPool(testDatabaseUrl!);
    server = await startTestServer(pool, testDatabaseUrl!);
  });

  afterAll(async () => {
    try {
      if (server) {
        await server.close();
      }
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  });

  beforeEach(async () => {
    await truncateAll(pool);

    const pupil = await seedPupil(pool);
    pupilId = pupil.pupilId;

    const fee = await seedFeeSchedule(pool);
    feeScheduleId = fee.id;
  });

  function paymentBody(
    overrides: Partial<{
      pupilId: number;
      feeScheduleId: number;
      amount: number;
      method: string;
      requestId: string;
    }> = {}
  ) {
    return {
      pupilId,
      feeScheduleId,
      amount: 30_000,
      method: "cash",
      requestId: randomUUID(),
      ...overrides,
    };
  }

  async function postPayment(body: unknown) {
    const response = await fetch(`${server.url}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return {
      response,
      body: (await response.json()) as Record<string, any>,
    };
  }

  it("creates a payment and returns the recalculated balance", async () => {
    const { response, body } = await postPayment(
      paymentBody({ amount: 30_000 })
    );

    expect(response.status).toBe(201);
    expect(body.payment).toMatchObject({
      pupilId,
      feeScheduleId,
      amount: 30_000,
      method: "cash",
    });
    expect(body.payment.recordedAt).toEqual(expect.any(String));
    expect(body.balance).toEqual({
      totalFee: 90_000,
      totalPaid: 30_000,
      remaining: 60_000,
      installmentsUsed: 1,
      installmentsAllowed: 3,
      installmentsRemaining: 2,
    });

    const rows = await pool.query("SELECT id, amount FROM payments");
    expect(rows.rowCount).toBe(1);
  });

  it("returns the original payment for an identical retry without inserting another row", async () => {
    const body = paymentBody({ amount: 30_000 });

    const first = await postPayment(body);
    const second = await postPayment(body);

    expect(first.response.status).toBe(201);
    expect(second.response.status).toBe(200);
    expect(second.response.headers.get("idempotent-replay")).toBe("true");
    expect(second.body.payment.id).toBe(first.body.payment.id);

    const count = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM payments"
    );
    expect(count.rows[0].count).toBe(1);
  });

  it("returns 409 when a requestId is reused with different payment details", async () => {
    const body = paymentBody({ amount: 30_000 });
    await postPayment(body);

    const { response, body: conflict } = await postPayment({
      ...body,
      amount: 20_000,
    });

    expect(response.status).toBe(409);
    expect(conflict.code).toBe("REQUEST_ID_CONFLICT");
  });

  it("returns 404 for an unknown pupil", async () => {
    const { response, body } = await postPayment(
      paymentBody({ pupilId: 999_999 })
    );

    expect(response.status).toBe(404);
    expect(body.code).toBe("PUPIL_NOT_FOUND");
  });

  it("returns 404 for an unknown fee schedule", async () => {
    const { response, body } = await postPayment(
      paymentBody({ feeScheduleId: 999_999 })
    );

    expect(response.status).toBe(404);
    expect(body.code).toBe("FEE_SCHEDULE_NOT_FOUND");
  });

  it("returns 422 for an overpayment on the first installment", async () => {
    const { response, body } = await postPayment(
      paymentBody({ amount: 90_001 })
    );

    expect(response.status).toBe(422);
    expect(body.code).toBe("OVERPAYMENT");
    expect(body.details.remaining).toBe(90_000);
  });

  it("returns 400 when the third installment is smaller than the balance", async () => {
    await postPayment(paymentBody({ amount: 30_000 }));
    await postPayment(paymentBody({ amount: 20_000 }));

    const { response, body } = await postPayment(
      paymentBody({ amount: 30_000 })
    );

    expect(response.status).toBe(400);
    expect(body.code).toBe("FINAL_INSTALLMENT_MUST_SETTLE");
    expect(body.details.remaining).toBe(40_000);
  });

  it("accepts the third installment when it exactly settles the balance", async () => {
    await postPayment(paymentBody({ amount: 30_000 }));
    await postPayment(paymentBody({ amount: 20_000 }));

    const { response, body } = await postPayment(
      paymentBody({ amount: 40_000 })
    );

    expect(response.status).toBe(201);
    expect(body.balance).toMatchObject({
      totalPaid: 90_000,
      remaining: 0,
      installmentsUsed: 3,
      installmentsRemaining: 0,
    });
  });

  it("returns 422 when the third installment exceeds the balance", async () => {
    await postPayment(paymentBody({ amount: 30_000 }));
    await postPayment(paymentBody({ amount: 20_000 }));

    const { response, body } = await postPayment(
      paymentBody({ amount: 40_001 })
    );

    expect(response.status).toBe(422);
    expect(body.code).toBe("OVERPAYMENT");
  });

  it("returns 409 when the installment limit is exhausted with a balance remaining", async () => {
    for (let index = 0; index < 3; index += 1) {
      await pool.query(
        `INSERT INTO payments
           (pupil_id, fee_schedule_id, amount, method, request_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [pupilId, feeScheduleId, 10_000, "cash", randomUUID()]
      );
    }

    const { response, body } = await postPayment(
      paymentBody({ amount: 10_000 })
    );

    expect(response.status).toBe(409);
    expect(body.code).toBe("INSTALLMENT_LIMIT_REACHED");
  });

  it("returns 409 when the fee is already fully paid", async () => {
    await postPayment(paymentBody({ amount: 90_000 }));

    const { response, body } = await postPayment(
      paymentBody({ amount: 1_000 })
    );

    expect(response.status).toBe(409);
    expect(body.code).toBe("FEE_ALREADY_SETTLED");
  });

  it("returns 200 for an identical retry even after the fee is settled", async () => {
    const body = paymentBody({ amount: 90_000 });

    const first = await postPayment(body);
    const replay = await postPayment(body);

    expect(first.response.status).toBe(201);
    expect(replay.response.status).toBe(200);
    expect(replay.body.payment.id).toBe(first.body.payment.id);
  });

  it("prevents concurrent overpayment for the same pupil", async () => {
    const [first, second] = await Promise.all([
      postPayment(paymentBody({ amount: 60_000 })),
      postPayment(paymentBody({ amount: 60_000 })),
    ]);

    const statuses = [
      first.response.status,
      second.response.status,
    ].sort((a, b) => a - b);

    expect(statuses).toEqual([201, 422]);

    const total = await pool.query<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0)::int AS total FROM payments"
    );
    expect(total.rows[0].total).toBe(60_000);
  });

  it("returns 400 for invalid input over HTTP", async () => {
    const { response, body } = await postPayment(
      paymentBody({ amount: 1.5 })
    );

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for an unsupported payment method", async () => {
    const { response, body } = await postPayment(
      paymentBody({ method: "card" })
    );

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("keeps GET /health working", async () => {
    const response = await fetch(`${server.url}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "NafaSchool API",
    });
  });

  it("keeps POST /pupils working", async () => {
    const response = await fetch(`${server.url}/pupils`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Pupil",
        class: "CM1",
        guardianName: "New Guardian",
        guardianPhone: "+221700000001",
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, any>;
    expect(body.pupil.name).toBe("New Pupil");
    expect(body.guardian.name).toBe("New Guardian");
  });
});
