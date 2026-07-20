-- Shipping box templates per warehouse: named parcel presets (dims + an
-- optional default weight) selectable in Mark Shipped when quoting/buying
-- Shippo labels.
CREATE TABLE IF NOT EXISTS warehouse_parcel_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id bigint NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name text NOT NULL,
  length_in numeric(6,2) NOT NULL,
  width_in numeric(6,2) NOT NULL,
  height_in numeric(6,2) NOT NULL,
  default_weight_lb numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
