-- Per-user return address for Shippo labels: when the purchasing user has
-- one set, it becomes the label's from/return address; otherwise the
-- warehouse's ship-from address is used. Self-service via My Settings.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_name text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_line1 text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_line2 text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_city text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_state text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_postal text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_country text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS label_return_phone text;
