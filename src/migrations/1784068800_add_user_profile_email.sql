-- Add email to user_profiles so the app can match the logged-in UI Bakery user
-- (useUser() exposes email/name/roles only — no numeric platform id) to an app
-- profile row that carries role + assigned warehouse.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- One profile per email (case-insensitive), ignoring rows that predate this column.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_lower_idx
  ON user_profiles (LOWER(email))
  WHERE email IS NOT NULL;
