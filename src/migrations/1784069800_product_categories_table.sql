-- Product categories become managed data instead of a hard-coded CHECK
-- constraint, so new categories can be created from Settings. Existing
-- values are seeded in; the FK (ON UPDATE CASCADE) keeps products valid
-- and lets a category rename flow through automatically.
CREATE TABLE IF NOT EXISTS product_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO product_categories (name)
VALUES ('research peptide'), ('cosmetic peptide'), ('blend'), ('accessory')
ON CONFLICT (name) DO NOTHING;

-- Defensive: any category value already on a product must exist before the FK.
INSERT INTO product_categories (name)
SELECT DISTINCT category FROM products WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_fk') THEN
    ALTER TABLE products
      ADD CONSTRAINT products_category_fk
      FOREIGN KEY (category) REFERENCES product_categories (name)
      ON UPDATE CASCADE;
  END IF;
END $$;
