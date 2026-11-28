-- ============================================================
-- NafaSchool migration 001
-- Link every payment to the term/fee schedule it belongs to.
--
-- Target: Neon PostgreSQL, public schema
-- Precondition: payments is empty (verified: 0 rows on 2026-11-27)
--
-- This migration is intended to be run ONCE, manually, in the
-- Neon SQL Editor. It is NOT executed by the application.
--
-- If payments is not empty, "SET NOT NULL" will fail and the
-- whole transaction will roll back. Do not force it; backfill
-- existing rows first.
-- ============================================================

BEGIN;

ALTER TABLE payments
  ADD COLUMN fee_schedule_id integer;

ALTER TABLE payments
  ALTER COLUMN fee_schedule_id SET NOT NULL;

ALTER TABLE payments
  ADD CONSTRAINT payments_fee_schedule_id_fkey
  FOREIGN KEY (fee_schedule_id)
  REFERENCES fee_schedules (id)
  ON DELETE RESTRICT;

CREATE INDEX payments_pupil_fee_idx
  ON payments (pupil_id, fee_schedule_id);

-- Defence-in-depth: the API accepts exactly these two methods.
ALTER TABLE payments
  ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cash', 'mobile_money'));

COMMIT;
