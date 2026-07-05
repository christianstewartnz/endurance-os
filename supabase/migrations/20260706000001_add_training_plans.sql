-- training_plans table
CREATE TABLE training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  linked_race_id uuid REFERENCES race_goals(id) ON DELETE SET NULL,
  goal text NOT NULL,
  phases jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own training plans"
  ON training_plans FOR ALL USING (auth.uid() = user_id);

-- Add plan tracking and session detail columns to session_notes
ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS training_plan_id uuid REFERENCES training_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_phase text,
  ADD COLUMN IF NOT EXISTS detail_level text CHECK (detail_level IN ('full', 'outline')),
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS intervals_format text,
  ADD COLUMN IF NOT EXISTS description text;
