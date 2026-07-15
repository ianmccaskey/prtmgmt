-- ============================================================================
-- MAINTENANCE SCRIPT (run manually — NOT an auto-applied migration)
-- Deletes all seeded demo data (is_seed = true) in FK-safe order.
-- Run in the UI Bakery SQL console as a single transaction.
--
-- WHAT IT KEEPS by default (see the opt-in section at the bottom):
--   warehouses, factories, receive_wallets, rate plans, free_order_reasons,
--   user_profiles — these seed rows are often used as the REAL operating
--   config. Only delete them if you've created replacements.
--
-- Real data (is_seed = false) is never touched.
-- ============================================================================

BEGIN;

-- ---- Tables without is_seed that reference seed orders -------------------
DELETE FROM notifications_sent
WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE is_seed = true);

DELETE FROM inventory_reservations
WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE is_seed = true);

-- ---- Order graph (children first) -----------------------------------------
DELETE FROM shipments_outbound_items
WHERE is_seed = true
   OR shipment_id IN (SELECT id FROM shipments_outbound WHERE is_seed = true)
   OR allocation_id IN (SELECT id FROM sales_order_item_allocations WHERE is_seed = true);

DELETE FROM sales_order_item_allocations WHERE is_seed = true;

DELETE FROM refund_tasks
WHERE is_seed = true
   OR sales_order_id IN (SELECT id FROM sales_orders WHERE is_seed = true);

DELETE FROM order_payments
WHERE is_seed = true
   OR sales_order_id IN (SELECT id FROM sales_orders WHERE is_seed = true);

DELETE FROM commission_payments
WHERE sales_rep_user_profile_id IN (SELECT id FROM user_profiles WHERE is_seed = true);

DELETE FROM shipments_outbound
WHERE is_seed = true
   OR sales_order_id IN (SELECT id FROM sales_orders WHERE is_seed = true);

DELETE FROM order_audit_log
WHERE is_seed = true
   OR sales_order_id IN (SELECT id FROM sales_orders WHERE is_seed = true);

DELETE FROM sales_order_items
WHERE is_seed = true
   OR sales_order_id IN (SELECT id FROM sales_orders WHERE is_seed = true);

DELETE FROM sales_orders WHERE is_seed = true;

-- ---- Customers -------------------------------------------------------------
DELETE FROM customer_note_audit_log WHERE is_seed = true
   OR customer_note_id IN (SELECT id FROM customer_notes WHERE is_seed = true);
DELETE FROM customer_notes WHERE is_seed = true;
DELETE FROM customers WHERE is_seed = true;

-- ---- Inbound logistics -------------------------------------------------------
DELETE FROM shipment_documents WHERE is_seed = true
   OR shipment_id IN (SELECT id FROM shipments_inbound WHERE is_seed = true);
DELETE FROM shipments_inbound_items WHERE is_seed = true
   OR shipment_id IN (SELECT id FROM shipments_inbound WHERE is_seed = true);
DELETE FROM shipments_inbound WHERE is_seed = true;

-- ---- Warehouse activity & adjustments ---------------------------------------
DELETE FROM warehouse_activity_log WHERE is_seed = true;
DELETE FROM inventory_writeoffs WHERE is_seed = true;
DELETE FROM inventory_count_corrections WHERE is_seed = true;
DELETE FROM inter_warehouse_transfers WHERE is_seed = true;

-- ---- Inventory / batches / products -----------------------------------------
DELETE FROM inventory WHERE is_seed = true;
DELETE FROM batch_tests WHERE is_seed = true;
DELETE FROM product_batches WHERE is_seed = true;
DELETE FROM product_price_history WHERE is_seed = true;
DELETE FROM product_price_tiers WHERE is_seed = true;
DELETE FROM products WHERE is_seed = true;

-- ---- OPT-IN: operating config (uncomment ONLY if you've created real
-- ---- replacements — active orders/inventory referencing these will block
-- ---- deletion, which is the FK system protecting you) ------------------------
-- DELETE FROM user_profiles WHERE is_seed = true;
-- DELETE FROM free_order_reasons WHERE is_seed = true;
-- DELETE FROM receive_wallets WHERE is_seed = true;
-- DELETE FROM warehouse_shipping_rate_plans WHERE is_seed = true;  -- create a real plan FIRST or Mark Shipped breaks
-- DELETE FROM factories WHERE is_seed = true;
-- DELETE FROM warehouses WHERE is_seed = true;                     -- almost certainly keep these

COMMIT;

-- Sanity check afterwards:
-- SELECT 'sales_orders' t, COUNT(*) FROM sales_orders WHERE is_seed UNION ALL
-- SELECT 'customers', COUNT(*) FROM customers WHERE is_seed UNION ALL
-- SELECT 'products', COUNT(*) FROM products WHERE is_seed UNION ALL
-- SELECT 'inventory', COUNT(*) FROM inventory WHERE is_seed;
-- (all should be 0)
