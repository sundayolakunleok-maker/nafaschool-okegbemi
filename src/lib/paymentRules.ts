import { HttpError } from "./httpError.js";

export const PAYMENT_METHODS = ["cash", "mobile_money"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const MAX_INT4 = 2_147_483_647;
const MAX_REQUEST_ID_LENGTH = 200;

export interface PaymentInput {
  pupilId: number;
  feeScheduleId: number;
  amount: number;
  method: PaymentMethod;
  requestId: string;
}

export interface FeeScheduleInfo {
  id: number;
  amount: number;
  installmentsAllowed: number;
}

export interface PaymentState {
  totalPaid: number;
  installmentsUsed: number;
}

export type PaymentDecision =
  | {
      ok: true;
      remainingAfter: number;
      installmentsUsedAfter: number;
    }
  | {
      ok: false;
      status: 400 | 409 | 422;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_INT4
  );
}

function readPositiveInt(
  body: Record<string, unknown>,
  field: string
): number {
  const value = body[field];

  if (!isPositiveInt(value)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${field} must be a positive integer`
    );
  }

  return value;
}

/**
 * Validates and normalises the untrusted request body.
 * All financial figures are integers because XOF has no minor units.
 */
export function validatePaymentInput(body: unknown): PaymentInput {
  if (!isRecord(body)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Request body must be a JSON object"
    );
  }

  const pupilId = readPositiveInt(body, "pupilId");
  const feeScheduleId = readPositiveInt(body, "feeScheduleId");
  const amount = readPositiveInt(body, "amount");

  const method = body.method;
  if (
    typeof method !== "string" ||
    !PAYMENT_METHODS.includes(method as PaymentMethod)
  ) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `method must be one of: ${PAYMENT_METHODS.join(", ")}`
    );
  }

  const requestId = body.requestId;
  if (typeof requestId !== "string") {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "requestId must be a string"
    );
  }

  const trimmedRequestId = requestId.trim();
  if (trimmedRequestId.length === 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "requestId must not be empty"
    );
  }

  if (trimmedRequestId.length > MAX_REQUEST_ID_LENGTH) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `requestId must be at most ${MAX_REQUEST_ID_LENGTH} characters`
    );
  }

  return {
    pupilId,
    feeScheduleId,
    amount,
    method: method as PaymentMethod,
    requestId: trimmedRequestId,
  };
}

/**
 * Option C installment policy:
 * - First and second payments may be any positive amount up to the balance.
 * - The final allowed payment must exactly settle the remaining balance.
 * - Overpayments are always rejected.
 */
export function evaluatePayment(
  fee: FeeScheduleInfo,
  state: PaymentState,
  amount: number
): PaymentDecision {
  const remaining = fee.amount - state.totalPaid;

  if (state.totalPaid >= fee.amount) {
    return {
      ok: false,
      status: 409,
      code: "FEE_ALREADY_SETTLED",
      message: "This fee is already fully paid",
      details: {
        totalFee: fee.amount,
        totalPaid: state.totalPaid,
        remaining: 0,
      },
    };
  }

  if (state.installmentsUsed >= fee.installmentsAllowed) {
    return {
      ok: false,
      status: 409,
      code: "INSTALLMENT_LIMIT_REACHED",
      message: `The maximum of ${fee.installmentsAllowed} installments has been reached`,
      details: {
        totalFee: fee.amount,
        totalPaid: state.totalPaid,
        remaining,
        installmentsUsed: state.installmentsUsed,
        installmentsAllowed: fee.installmentsAllowed,
      },
    };
  }

  if (amount > remaining) {
    return {
      ok: false,
      status: 422,
      code: "OVERPAYMENT",
      message: "Payment exceeds the outstanding balance",
      details: {
        remaining,
        requestedAmount: amount,
      },
    };
  }

  const isFinalAllowedInstallment =
    state.installmentsUsed === fee.installmentsAllowed - 1;

  if (isFinalAllowedInstallment && amount !== remaining) {
    return {
      ok: false,
      status: 400,
      code: "FINAL_INSTALLMENT_MUST_SETTLE",
      message: "The final installment must exactly settle the remaining balance",
      details: {
        remaining,
        requestedAmount: amount,
        installmentsUsed: state.installmentsUsed,
        installmentsAllowed: fee.installmentsAllowed,
      },
    };
  }

  return {
    ok: true,
    remainingAfter: remaining - amount,
    installmentsUsedAfter: state.installmentsUsed + 1,
  };
}
