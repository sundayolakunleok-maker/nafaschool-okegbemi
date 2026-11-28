# NafaSchool Payments API

## Status and security warning

`POST /payments` is currently **unauthenticated** and has **no authorisation
checks**. It must not be exposed to the public internet or treated as
production-ready until authentication, authorisation, rate limiting and audit
logging are added.

This endpoint records financial data. The server calculates all fees, balances
and installment counts from PostgreSQL; it never trusts totals supplied by the
browser.

## Database migration

Before using the endpoint, apply the migration manually:

```text
migrations/001_payments_fee_schedule_id.sql
```

The migration adds `payments.fee_schedule_id`, a foreign key to
`fee_schedules`, an index for per-pupil/per-term aggregates, and a method check
that allows only `cash` and `mobile_money`.

The migration is **not** run by the application. Run it once in the Neon SQL
Editor after confirming that `payments` is empty. If the table has rows, the
`SET NOT NULL` step fails and the transaction rolls back; backfill existing
rows first.

## Request

```http
POST /payments
Content-Type: application/json
```

```json
{
  "pupilId": 1,
  "feeScheduleId": 1,
  "amount": 30000,
  "method": "cash",
  "requestId": "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
}
```

### Validation

| Field | Rule |
|---|---|
| `pupilId` | Positive integer within PostgreSQL `integer` range. |
| `feeScheduleId` | Required positive integer. The current term is never guessed. |
| `amount` | Positive integer XOF. Decimals and strings are rejected. |
| `method` | Exactly `cash` or `mobile_money`. |
| `requestId` | Non-empty trimmed string, maximum 200 characters. A UUID is recommended. |

`requestId` must be generated once by the client and reused for every retry of
the same payment.

## Installment policy (Option C)

- The first and second payments may be any positive amount up to the
  outstanding balance.
- The third (final allowed) payment must exactly settle the remaining balance.
- Overpayments are always rejected.
- The rule generalises to `installments_allowed - 1`, so a schedule that allows
  one installment requires the first payment to settle the fee in full.

With the current 90,000 XOF / 3-installment schedule:

| Payments already recorded | Requested amount | Result |
|---|---|---|
| 0 | 1–90,000 | `201` (90,000 settles early) |
| 1 | 1–remaining | `201` |
| 2 | less than remaining | `400` `FINAL_INSTALLMENT_MUST_SETTLE` |
| 2 | exactly remaining | `201`, balance becomes 0 |
| 2 | more than remaining | `422` `OVERPAYMENT` |
| 3 with a balance remaining (legacy data) | any | `409` `INSTALLMENT_LIMIT_REACHED` |
| any, already fully paid | any | `409` `FEE_ALREADY_SETTLED` |

## Idempotency

- Same `requestId` and identical `pupilId`, `feeScheduleId`, `amount`, and
  `method` → `200`, original payment returned, no new row inserted.
- Same `requestId` with different payment details → `409`
  `REQUEST_ID_CONFLICT`.
- New payment → `201`.
- Identical retries include the `Idempotent-Replay: true` response header.
- The idempotency lookup runs before the settled/limit checks, so retrying a
  payment after the fee is settled still returns the original payment.

## Response

```json
{
  "payment": {
    "id": 1,
    "pupilId": 1,
    "feeScheduleId": 1,
    "amount": 30000,
    "method": "cash",
    "requestId": "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "recordedAt": "2026-11-27T10:00:00.000Z"
  },
  "balance": {
    "totalFee": 90000,
    "totalPaid": 30000,
    "remaining": 60000,
    "installmentsUsed": 1,
    "installmentsAllowed": 3,
    "installmentsRemaining": 2
  }
}
```

## Status codes

| Condition | Status | Code |
|---|---|---|
| Validation failure | 400 | `VALIDATION_ERROR` |
| Final installment too small | 400 | `FINAL_INSTALLMENT_MUST_SETTLE` |
| Unknown pupil | 404 | `PUPIL_NOT_FOUND` |
| Unknown fee schedule | 404 | `FEE_SCHEDULE_NOT_FOUND` |
| Request ID reused with different details | 409 | `REQUEST_ID_CONFLICT` |
| Fee already fully paid | 409 | `FEE_ALREADY_SETTLED` |
| Installment limit exhausted | 409 | `INSTALLMENT_LIMIT_REACHED` |
| Overpayment | 422 | `OVERPAYMENT` |
| Database connection failure or lock timeout | 503 | `SERVICE_UNAVAILABLE` |
| Unexpected server error | 500 | `INTERNAL_ERROR` |

503 responses contain only a generic message. Internal database details are
logged server-side and are never returned to the client.

## Transaction safety

The endpoint uses the PostgreSQL WebSocket `Pool` with an interactive
transaction:

1. `BEGIN`
2. `SET LOCAL lock_timeout = '5s'`
3. `SELECT id FROM pupils WHERE id = $1 FOR UPDATE`
4. Idempotency lookup by `request_id`
5. Fee schedule lookup
6. `SUM(amount)` and `COUNT(*)` for the pupil and term
7. Option C validation
8. `INSERT ... ON CONFLICT (request_id) DO NOTHING RETURNING ...`
9. `COMMIT`

The pupil row lock serialises concurrent payment attempts for the same pupil.
The aggregate is read after the lock is acquired, so it sees the latest
committed payment. The unique `request_id` constraint closes the remaining race
where the same request ID is used for two different pupils.

`SUM(integer)` and `COUNT(*)` are cast to `::int` because node-postgres
otherwise returns `bigint` as a string.

## Tests

Unit tests (no database):

```powershell
npm test
```

Unit and integration tests:

```powershell
$env:TEST_DATABASE_URL="postgresql://...dedicated test branch..."; npm test
```

Integration tests are skipped when `TEST_DATABASE_URL` is not set. They never
use the production `DATABASE_URL`, and the helper refuses to run if
`TEST_DATABASE_URL` is identical to `DATABASE_URL`. The helper applies
`tests/helpers/schema.sql` only to the test database and truncates its tables
between tests.

Use a dedicated Neon branch or separate test database. Never point
`TEST_DATABASE_URL` at production.
