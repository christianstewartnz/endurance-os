-- Add activity match tracking to session_notes.
-- completed sessions (from Intervals.icu) store a reference to the planned session
-- they were matched against. match_status tracks the review state.
ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS matched_session_id text,
  ADD COLUMN IF NOT EXISTS match_status text CHECK (match_status IN ('auto', 'confirmed', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_session_notes_matched_session_id
  ON session_notes (user_id, matched_session_id)
  WHERE matched_session_id IS NOT NULL;
