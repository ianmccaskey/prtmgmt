-- Optional batch pinning at order entry: when a product has stock in more
-- than one passed-QC batch, the rep can pin a specific batch on the line.
-- NULL means "Auto (FIFO)" — the existing oldest-first behavior.
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS preferred_batch_id BIGINT;

-- Composite FK: the pinned batch must belong to the line's own product
-- (a bare FK to product_batches(id) would allow cross-product pins).
-- ADD CONSTRAINT has no IF NOT EXISTS, so guard for idempotent retries.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_batches_id_product_uniq') THEN
    ALTER TABLE product_batches
      ADD CONSTRAINT product_batches_id_product_uniq UNIQUE (id, product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_order_items_preferred_batch_fk') THEN
    ALTER TABLE sales_order_items
      ADD CONSTRAINT sales_order_items_preferred_batch_fk
      FOREIGN KEY (preferred_batch_id, product_id)
      REFERENCES product_batches (id, product_id);
  END IF;
END $$;
