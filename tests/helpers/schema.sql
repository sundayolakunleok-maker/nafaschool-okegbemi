CREATE TABLE IF NOT EXISTS guardians (
  id serial PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL
);

CREATE TABLE IF NOT EXISTS pupils (
  id serial PRIMARY KEY,
  name text NOT NULL,
  class text NOT NULL,
  guardian_id integer NOT NULL REFERENCES guardians (id)
);

CREATE TABLE IF NOT EXISTS fee_schedules (
  id serial PRIMARY KEY,
  term text NOT NULL UNIQUE,
  amount integer NOT NULL CHECK (amount > 0),
  installments_allowed integer NOT NULL CHECK (installments_allowed > 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY,
  pupil_id integer NOT NULL REFERENCES pupils (id),
  amount integer NOT NULL CHECK (amount > 0),
  method text NOT NULL,
  request_id text NOT NULL UNIQUE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  fee_schedule_id integer
);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS fee_schedule_id integer;

-- Test databases are disposable; clear rows before enforcing NOT NULL.
TRUNCATE TABLE payments, pupils, guardians, fee_schedules
  RESTART IDENTITY CASCADE;

ALTER TABLE payments
  ALTER COLUMN fee_schedule_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_fee_schedule_id_fkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_fee_schedule_id_fkey
      FOREIGN KEY (fee_schedule_id)
      REFERENCES fee_schedules (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_method_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_method_check
      CHECK (method IN ('cash', 'mobile_money'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payments_pupil_fee_idx
  ON payments (pupil_id, fee_schedule_id);
