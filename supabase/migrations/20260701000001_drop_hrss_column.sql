-- Drop hrss column from session_notes — field was always null (not available from Intervals.icu API)
ALTER TABLE session_notes DROP COLUMN IF EXISTS hrss;
