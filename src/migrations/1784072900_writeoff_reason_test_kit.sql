-- 'test_kit' write-off reason: kits pulled from sellable stock and sent
-- out for lab testing / used as test samples.
ALTER TABLE inventory_writeoffs DROP CONSTRAINT IF EXISTS inventory_writeoffs_reason_check;
ALTER TABLE inventory_writeoffs ADD CONSTRAINT inventory_writeoffs_reason_check
  CHECK (reason IN ('damaged','expired','lost','qc_hold','customer_replacement','receipt_shortage','receipt_damage','test_kit','other'));
