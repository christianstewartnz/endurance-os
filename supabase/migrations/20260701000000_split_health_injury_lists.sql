-- Step 1: Create illnesses table (replaces health_injury.illnesses JSONB array)
CREATE TABLE IF NOT EXISTS illnesses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  date_start    date,
  restrictions  text[],
  can_cycle     boolean     DEFAULT true,
  can_run       boolean     DEFAULT false,
  can_swim      boolean     DEFAULT true,
  notes         text,
  date_cleared  date,
  cleared_note  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE illnesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own illnesses"
  ON illnesses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 2: Create injuries table (replaces health_injury.active_injuries JSONB array)
CREATE TABLE IF NOT EXISTS injuries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_part     text        NOT NULL,
  description   text,
  date_start    date,
  restrictions  text[],
  can_cycle     boolean     DEFAULT true,
  can_run       boolean     DEFAULT false,
  can_swim      boolean     DEFAULT true,
  physio_notes  text,
  date_cleared  date,
  cleared_note  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own injuries"
  ON injuries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 3: Add unconfirmed flag to training_patterns for auto-applied observations
ALTER TABLE training_patterns
  ADD COLUMN IF NOT EXISTS unconfirmed boolean DEFAULT false;

-- Step 4: Drop the old JSONB columns from health_injury
-- (No backfill — no production data to preserve)
ALTER TABLE health_injury
  DROP COLUMN IF EXISTS illnesses,
  DROP COLUMN IF EXISTS active_injuries;
