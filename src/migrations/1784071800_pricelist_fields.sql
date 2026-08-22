-- Public pricesheet fields on products: opt-in visibility, promo badge,
-- a manual status override (the app can't know "in production"), and
-- display overrides for how the item reads on the sheet. Consumed by
-- tools/sync-pricesheet.ts which regenerates PRTLabs/pricesheet.
-- Re-runnable.

ALTER TABLE products ADD COLUMN IF NOT EXISTS show_on_pricelist BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_badge BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricelist_status_override TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricelist_group TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricelist_spec TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricelist_note TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricelist_sort INTEGER NOT NULL DEFAULT 999;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pricelist_status_override_check;
ALTER TABLE products ADD CONSTRAINT products_pricelist_status_override_check
  CHECK (pricelist_status_override IN ('auto', 'available', 'in_production', 'in_transit', 'out_of_stock'));
