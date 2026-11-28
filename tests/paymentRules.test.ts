import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/httpError";
import {
  evaluatePayment,
  validatePaymentInput,
} from "../src/lib/paymentRules";

const fee = { id: 1, amount: 90_000, installmentsAllowed: 3 };

function state(totalPaid: number, installmentsUsed: number) {
  return { totalPaid, installmentsUsed };
}

function validBody() {
  return {
    pupilId: 1,
    feeScheduleId: 1,
    amount: 30_000,
    method: "cash",
    requestId: "  req-12345678  ",
  };
}

function expectHttpError(
  fn: () => unknown,
  status: number,
  code?: string
): void {
  try {
    fn();
    throw new Error("Expected function to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    const httpError = error as HttpError;
    expect(httpError.status).toBe(status);
    if (code) {
      expect(httpError.code).toBe(code);
    }
  }
}

describe("validatePaymentInput", () => {
  it("accepts a valid body and trims the requestId", () => {
    expect(validatePaymentInput(validBody())).toEqual({
      pupilId: 1,
      feeScheduleId: 1,
      amount: 30_000,
      method: "cash",
      requestId: "req-12345678",
    });
  });

  it("accepts mobile_money", () => {
    expect(
      validatePaymentInput({ ...validBody(), method: "mobile_money" }).method
    ).toBe("mobile_money");
  });

  it.each([null, undefined, "body", 42, [], true])(
    "rejects a non-object body: %s",
    (body) => {
      expectHttpError(
        () => validatePaymentInput(body),
        400,
        "VALIDATION_ERROR"
      );
    }
  );

  it.each([
    ["pupilId", 0],
    ["pupilId", -1],
    ["pupilId", 1.5],
    ["pupilId", "1"],
    ["pupilId", Number.NaN],
    ["pupilId", Number.POSITIVE_INFINITY],
    ["pupilId", 2_147_483_648],
  ])("rejects invalid %s: %s", (field, value) => {
    expectHttpError(
      () => validatePaymentInput({ ...validBody(), [field]: value }),
      400,
      "VALIDATION_ERROR"
    );
  });

  it.each([
    ["feeScheduleId", 0],
    ["feeScheduleId", -5],
    ["feeScheduleId", 1.25],
    ["feeScheduleId", "1"],
    ["feeScheduleId", null],
  ])("rejects invalid %s: %s", (field, value) => {
    expectHttpError(
      () => validatePaymentInput({ ...validBody(), [field]: value }),
      400,
      "VALIDATION_ERROR"
    );
  });

  it.each([
    ["amount", 0],
    ["amount", -1],
    ["amount", 1.5],
    ["amount", "30000"],
    ["amount", Number.NaN],
    ["amount", Number.POSITIVE_INFINITY],
  ])("rejects invalid %s: %s", (field, value) => {
    expectHttpError(
      () => validatePaymentInput({ ...validBody(), [field]: value }),
      400,
      "VALIDATION_ERROR"
    );
  });

  it.each(["Cash", "card", "bank_transfer", "", 1, null, undefined])(
    "rejects invalid method: %s",
    (method) => {
      expectHttpError(
        () => validatePaymentInput({ ...validBody(), method }),
        400,
        "VALIDATION_ERROR"
      );
    }
  );

  it.each([
    ["requestId", undefined],
    ["requestId", 123],
    ["requestId", ""],
    ["requestId", "   "],
    ["requestId", "x".repeat(201)],
  ])("rejects invalid %s: %s", (field, value) => {
    expectHttpError(
      () => validatePaymentInput({ ...validBody(), [field]: value }),
      400,
      "VALIDATION_ERROR"
    );
  });

  it("ignores unknown extra fields", () => {
    expect(
      validatePaymentInput({ ...validBody(), totalFee: 1, balance: 0 })
    ).toMatchObject({ pupilId: 1, amount: 30_000 });
  });
});

describe("evaluatePayment — Option C", () => {
  it("allows a flexible first installment", () => {
    expect(evaluatePayment(fee, state(0, 0), 20_000)).toEqual({
      ok: true,
      remainingAfter: 70_000,
      installmentsUsedAfter: 1,
    });
  });

  it("allows a flexible second installment", () => {
    expect(evaluatePayment(fee, state(20_000, 1), 15_000)).toEqual({
      ok: true,
      remainingAfter: 55_000,
      installmentsUsedAfter: 2,
    });
  });

  it("allows early settlement on the first payment", () => {
    expect(evaluatePayment(fee, state(0, 0), 90_000)).toEqual({
      ok: true,
      remainingAfter: 0,
      installmentsUsedAfter: 1,
    });
  });

  it("allows early settlement on the second payment", () => {
    expect(evaluatePayment(fee, state(30_000, 1), 60_000)).toEqual({
      ok: true,
      remainingAfter: 0,
      installmentsUsedAfter: 2,
    });
  });

  it("rejects overpayment on the first payment", () => {
    expect(evaluatePayment(fee, state(0, 0), 90_001)).toMatchObject({
      ok: false,
      status: 422,
      code: "OVERPAYMENT",
    });
  });

  it("rejects overpayment on the second payment", () => {
    expect(evaluatePayment(fee, state(30_000, 1), 60_001)).toMatchObject({
      ok: false,
      status: 422,
      code: "OVERPAYMENT",
    });
  });

  it("allows the third payment when it exactly settles the balance", () => {
    expect(evaluatePayment(fee, state(50_000, 2), 40_000)).toEqual({
      ok: true,
      remainingAfter: 0,
      installmentsUsedAfter: 3,
    });
  });

  it("rejects a third payment that is smaller than the balance with 400", () => {
    expect(evaluatePayment(fee, state(50_000, 2), 39_999)).toMatchObject({
      ok: false,
      status: 400,
      code: "FINAL_INSTALLMENT_MUST_SETTLE",
    });
  });

  it("rejects a third payment that is larger than the balance with 422", () => {
    expect(evaluatePayment(fee, state(50_000, 2), 40_001)).toMatchObject({
      ok: false,
      status: 422,
      code: "OVERPAYMENT",
    });
  });

  it("rejects a fourth payment with 409 when the limit is exhausted", () => {
    expect(evaluatePayment(fee, state(60_000, 3), 10_000)).toMatchObject({
      ok: false,
      status: 409,
      code: "INSTALLMENT_LIMIT_REACHED",
    });
  });

  it("rejects payment when the fee is already settled", () => {
    expect(evaluatePayment(fee, state(90_000, 3), 1_000)).toMatchObject({
      ok: false,
      status: 409,
      code: "FEE_ALREADY_SETTLED",
    });
  });

  it("generalises to a single-installment schedule", () => {
    const single = { id: 2, amount: 90_000, installmentsAllowed: 1 };

    expect(evaluatePayment(single, state(0, 0), 89_999)).toMatchObject({
      ok: false,
      status: 400,
      code: "FINAL_INSTALLMENT_MUST_SETTLE",
    });

    expect(evaluatePayment(single, state(0, 0), 90_000)).toEqual({
      ok: true,
      remainingAfter: 0,
      installmentsUsedAfter: 1,
    });
  });
});
