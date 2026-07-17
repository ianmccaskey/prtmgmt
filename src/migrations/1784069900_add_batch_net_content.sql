-- Net content of a batch's vials, in milligrams (e.g. 5.00 for a 5mg vial).
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS net_content_mg NUMERIC(10,2);
