-- Race-day fueling numbers move from fueling_strategy to race_goals
ALTER TABLE race_goals
  ADD COLUMN IF NOT EXISTS race_carb_per_hour_g numeric,
  ADD COLUMN IF NOT EXISTS race_fluid_per_hour_ml numeric,
  ADD COLUMN IF NOT EXISTS race_sodium_per_hour_mg numeric,
  ADD COLUMN IF NOT EXISTS race_sodium_hot_mg numeric,
  ADD COLUMN IF NOT EXISTS location_lat numeric,
  ADD COLUMN IF NOT EXISTS location_lon numeric;

-- Geocode cache on athlete_profile (re-geocoded only when location text changes)
ALTER TABLE athlete_profile
  ADD COLUMN IF NOT EXISTS location_lat numeric,
  ADD COLUMN IF NOT EXISTS location_lon numeric;

-- Per-session fueling suggestion fields
ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS fueling_carb_g_per_hour numeric,
  ADD COLUMN IF NOT EXISTS fueling_fluid_ml_per_hour numeric,
  ADD COLUMN IF NOT EXISTS fueling_sodium_mg_per_hour numeric,
  ADD COLUMN IF NOT EXISTS fueling_note text;
