-- Warehouse notifications pivot from SMS to ntfy push (US carriers
-- require registered-business sender identities for app SMS on every
-- provider — Twilio suspended the account, AWS wants a business
-- registration). ntfy: staff install the ntfy app and subscribe to a
-- secret per-warehouse topic; the sync tool POSTs to that topic.
--
-- The sms_outbox table keeps its name (it is the same ledger with the
-- same delivery discipline) but the destination columns are renamed so
-- they don't claim to be phone numbers:
--   warehouses.notify_phone  -> notify_topic   (ntfy topic name)
--   sms_outbox.to_phone      -> destination    (topic the row was sent to)
-- The 'no_phone' status value is kept as-is (it now means "no
-- destination configured") to avoid churning the CHECK constraint and
-- existing rows.
ALTER TABLE warehouses RENAME COLUMN notify_phone TO notify_topic;
ALTER TABLE sms_outbox RENAME COLUMN to_phone TO destination;
