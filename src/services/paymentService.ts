import type { Pool, PoolClient } from "@neondatabase/serverless";
import { HttpError } from "../lib/httpError.js";
import {
  evaluatePayment,
  type PaymentInput,
} from "../lib/paymentRules.js";

interface PaymentRow {
  id: number;
  pupil_id: number;
  fee_schedule_id: number;
  amount: number;
  method: string;
  request_id: string;
  recorded_at: Date | string;
}

interface FeeRow {
  id: number;
  amount: number;
  installments_allowed: number;
}

interface AggregateRow {
  total_paid: number;
  installments_used: number;
}

interface BalanceRow {
  total_fee: number;
  installments_allowed: number;
  total_paid: number;
  installments_used: number;
}

export interface PaymentDto {
  id: number;
  pupilId: number;
  feeScheduleId: number;
  amount: number;
  method: string;
  requestId: string;
  recordedAt: string;
}

export interface BalanceDto {
  totalFee: number;
  totalPaid: number;
  remaining: number;
  installmentsUsed: number;
  installmentsAllowed: number;
  installmentsRemaining: number;
}

export interface PaymentResult {
  created: boolean;
  payment: PaymentDto;
  balance: BalanceDto;
}

function toPaymentDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    pupilId: row.pupil_id,
    feeScheduleId: row.fee_schedule_id,
    amount: row.amount,
    method: row.method,
    requestId: row.request_id,
    recordedAt:
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : new Date(row.recorded_at).toISOString(),
  };
}

function toBalanceDto(row: BalanceRow): BalanceDto {
  return {
    totalFee: row.total_fee,
    totalPaid: row.total_paid,
    remaining: Math.max(0, row.total_fee - row.total_paid),
    installmentsUsed: row.installments_used,
    installmentsAllowed: row.installments_allowed,
    installmentsRemaining: Math.max(
      0,
      row.installments_allowed - row.installments_used
    ),
  };
}

function payloadMatches(row: PaymentRow, input: PaymentInput): boolean {
  return (
    row.pupil_id === input.pupilId &&
    row.fee_schedule_id === input.feeScheduleId &&
    row.amount === input.amount &&
    row.method === input.method
  );
}

async function loadBalance(
  client: PoolClient,
  pupilId: number,
  feeScheduleId: number
): Promise<BalanceRow> {
  const result = await client.query<BalanceRow>(
    `SELECT
       f.amount AS total_fee,
       f.installments_allowed,
       COALESCE(SUM(p.amount), 0)::int AS total_paid,
       COUNT(p.id)::int AS installments_used
     FROM fee_schedules f
     LEFT JOIN payments p
       ON p.pupil_id = $1
      AND p.fee_schedule_id = f.id
     WHERE f.id = $2
     GROUP BY f.id, f.amount, f.installments_allowed`,
    [pupilId, feeScheduleId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new HttpError(
      404,
      "FEE_SCHEDULE_NOT_FOUND",
      "Fee schedule not found"
    );
  }

  return row;
}

/**
 * Records a payment inside one PostgreSQL transaction.
 *
 * The pupil row is locked with SELECT ... FOR UPDATE so that concurrent
 * payments for the same pupil are serialised. The aggregate is read after
 * the lock is acquired, so it always sees the latest committed payments.
 */
export async function recordPayment(
  pool: Pool,
  input: PaymentInput
): Promise<PaymentResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");

    // 1. Serialise all payment attempts for this pupil.
    const pupil = await client.query<{ id: number }>(
      "SELECT id FROM pupils WHERE id = $1 FOR UPDATE",
      [input.pupilId]
    );

    if (pupil.rowCount === 0) {
      throw new HttpError(404, "PUPIL_NOT_FOUND", "Pupil not found");
    }

    // 2. Idempotency check happens before business rules, so retrying a
    //    payment after the fee is settled still returns the original row.
    const existing = await client.query<PaymentRow>(
      `SELECT id, pupil_id, fee_schedule_id, amount, method, request_id, recorded_at
       FROM payments
       WHERE request_id = $1`,
      [input.requestId]
    );

    if (existing.rowCount && existing.rows[0]) {
      const row = existing.rows[0];

      if (!payloadMatches(row, input)) {
        throw new HttpError(
          409,
          "REQUEST_ID_CONFLICT",
          "This requestId has already been used for a different payment"
        );
      }

      const balance = await loadBalance(
        client,
        row.pupil_id,
        row.fee_schedule_id
      );
      await client.query("COMMIT");

      return {
        created: false,
        payment: toPaymentDto(row),
        balance: toBalanceDto(balance),
      };
    }

    // 3. Resolve the fee schedule for this term.
    const feeResult = await client.query<FeeRow>(
      `SELECT id, amount, installments_allowed
       FROM fee_schedules
       WHERE id = $1`,
      [input.feeScheduleId]
    );

    const fee = feeResult.rows[0];
    if (!fee) {
      throw new HttpError(
        404,
        "FEE_SCHEDULE_NOT_FOUND",
        "Fee schedule not found"
      );
    }

    // 4. Aggregate the pupil's payments for this term.
    const aggregate = await client.query<AggregateRow>(
      `SELECT
         COALESCE(SUM(amount), 0)::int AS total_paid,
         COUNT(*)::int AS installments_used
       FROM payments
       WHERE pupil_id = $1
         AND fee_schedule_id = $2`,
      [input.pupilId, input.feeScheduleId]
    );

    const state = aggregate.rows[0] ?? {
      total_paid: 0,
      installments_used: 0,
    };

    // 5. Apply the Option C business rules.
    const decision = evaluatePayment(
      {
        id: fee.id,
        amount: fee.amount,
        installmentsAllowed: fee.installments_allowed,
      },
      {
        totalPaid: state.total_paid,
        installmentsUsed: state.installments_used,
      },
      input.amount
    );

    if (!decision.ok) {
      throw new HttpError(
        decision.status,
        decision.code,
        decision.message,
        decision.details
      );
    }

    // 6. Insert, letting the unique constraint close any remaining race.
    const inserted = await client.query<PaymentRow>(
      `INSERT INTO payments
         (pupil_id, fee_schedule_id, amount, method, request_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (request_id) DO NOTHING
       RETURNING id, pupil_id, fee_schedule_id, amount, method, request_id, recorded_at`,
      [
        input.pupilId,
        input.feeScheduleId,
        input.amount,
        input.method,
        input.requestId,
      ]
    );

    if (inserted.rowCount === 0) {
      // Another transaction used this requestId for a different pupil.
      const raced = await client.query<PaymentRow>(
        `SELECT id, pupil_id, fee_schedule_id, amount, method, request_id, recorded_at
         FROM payments
         WHERE request_id = $1`,
        [input.requestId]
      );

      const row = raced.rows[0];
      if (!row) {
        throw new HttpError(
          409,
          "REQUEST_ID_CONFLICT",
          "A conflicting payment request was recorded"
        );
      }

      if (!payloadMatches(row, input)) {
        throw new HttpError(
          409,
          "REQUEST_ID_CONFLICT",
          "This requestId has already been used for a different payment"
        );
      }

      const balance = await loadBalance(
        client,
        row.pupil_id,
        row.fee_schedule_id
      );
      await client.query("COMMIT");

      return {
        created: false,
        payment: toPaymentDto(row),
        balance: toBalanceDto(balance),
      };
    }

    const row = inserted.rows[0];
    if (!row) {
      throw new Error("Payment insert did not return a row");
    }

    const balance = await loadBalance(
      client,
      input.pupilId,
      input.feeScheduleId
    );
    await client.query("COMMIT");

    return {
      created: true,
      payment: toPaymentDto(row),
      balance: toBalanceDto(balance),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
      // The connection may already be gone; nothing else to do.
    });
    throw error;
  } finally {
    client.release();
  }
}
