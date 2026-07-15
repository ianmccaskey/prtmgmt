-- Optional batch pinning at order entry: when a product has stock in more
-- than one passed-QC batch, the rep can pin a specific batch on the line.
-- NULL means "Auto (FIFO)" — the existing oldest-first behavior.
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS preferred_batch_id BIGINT REFERENCES product_batches(id);
