-- Seed data for Peptide Ops app
-- All rows have is_seed = true so they can be deleted with:
-- DELETE FROM <table> WHERE is_seed = true

-- Factories
INSERT INTO factories (name, notes, is_seed) VALUES
  ('Shenzhen PeptideLab Biotech Co., Ltd.', 'Primary supplier for research peptides. ISO 9001 certified. Contact: Chen Wei.', true),
  ('Wuhan BioSynth Sciences Ltd.', 'Secondary supplier specializing in cosmetic peptides and GHK-Cu. Good QC record.', true),
  ('Hangzhou Genova Peptides Co., Ltd.', 'Newer supplier for blends and semaglutide analogs. Still building trust.', true);

-- Warehouses
INSERT INTO warehouses (name, address_line1, city, state, postal_code, country, notes, is_active, is_seed) VALUES
  ('Phoenix Fulfillment Center', '4400 E Washington St', 'Phoenix', 'AZ', '85034', 'US', 'Primary US warehouse. Climate controlled.', true, true),
  ('Dallas Distribution Hub', '2701 W Mockingbird Ln', 'Dallas', 'TX', '75235', 'US', 'Secondary warehouse. Opened Q1 2025.', true, true);

-- Warehouse Shipping Rate Plans
INSERT INTO warehouse_shipping_rate_plans (effective_date, notes, base_kits, base_price_usd, tier_kits, tier_price_usd, is_seed) VALUES
  ('2024-01-01', 'Initial rate plan. Base 6 kits for $18, then $8 per additional 6 kits.', 6, 18.00, 6, 8.00, true);

-- Receive Wallets
INSERT INTO receive_wallets (asset, network, address, label, is_active, is_seed) VALUES
  ('USDC', 'ethereum', '0xA1B2C3D4E5F6789012345678901234567890ABCD', 'Primary USDC/ETH', true, true),
  ('USDC', 'solana', 'So1anaUsdc7MXVBxn8QMEFdj5KXyHkPz9Rn5GHj2qEF', 'Primary USDC/SOL', true, true),
  ('USDT', 'ethereum', '0xB2C3D4E5F6789012345678901234567890ABCDE1', 'Primary USDT/ETH', true, true),
  ('USDT', 'solana', 'So1anaUsdt8NXVBxn8QMEFdj5KXyHkPz9Rn5GHj3rFG', 'Primary USDT/SOL', true, true),
  ('ETH', 'ethereum', '0xC3D4E5F6789012345678901234567890ABCDE1F2', 'Primary ETH', true, true),
  ('SOL', 'solana', 'So1anaMain9QXVBxn8QMEFdj5KXyHkPz9Rn5GHj4sGH', 'Primary SOL', true, true),
  ('BTC', 'bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'Primary BTC', true, true);

-- Free Order Reasons
INSERT INTO free_order_reasons (label, description, is_active, is_seed) VALUES
  ('marketing sample', 'Product sent to potential customers or influencers for promotion.', true, true),
  ('damaged replacement', 'Replacement for a product confirmed damaged during transit.', true, true),
  ('wrong item replacement', 'Replacement for an item incorrectly shipped by our warehouse.', true, true),
  ('influencer comp', 'Complimentary order for a content creator or brand partner.', true, true),
  ('goodwill gesture', 'Goodwill order to retain or reward a loyal customer.', true, true);

-- Products
INSERT INTO products (sku, name, description, category, vial_size_ml, vials_per_unit, list_price, standard_cost, available_warehouse, available_china_direct, factory_id, is_active, low_stock_threshold, is_seed) VALUES
  ('BPC157-5MG', 'BPC-157 5mg', 'Body Protection Compound 157. Promotes healing and tissue repair.', 'research peptide', 2.0, 1, 65.00, 22.00, true, true, 1, true, 20, true),
  ('TB500-5MG', 'TB-500 5mg', 'Thymosin Beta-4 analog. Supports muscle recovery and flexibility.', 'research peptide', 2.0, 1, 72.00, 25.00, true, true, 1, true, 15, true),
  ('GHKCU-50MG', 'GHK-Cu 50mg', 'Copper peptide for skin regeneration and anti-aging.', 'cosmetic peptide', 5.0, 1, 85.00, 28.00, true, false, 2, true, 10, true),
  ('SEMA-2MG', 'Semaglutide 2mg', 'GLP-1 receptor agonist. Weight management research compound.', 'research peptide', 1.0, 1, 120.00, 42.00, true, true, 3, true, 10, true),
  ('TESA-2MG', 'Tesamorelin 2mg', 'Growth hormone releasing factor analog. Reduces visceral fat.', 'research peptide', 2.0, 1, 95.00, 33.00, true, true, 1, true, 8, true),
  ('IPA-5MG', 'Ipamorelin 5mg', 'Growth hormone secretagogue. Clean GH pulse stimulation.', 'research peptide', 2.0, 1, 58.00, 19.00, true, true, 1, true, 20, true),
  ('CJC1295-5MG', 'CJC-1295 5mg', 'GHRH analog with DAC. Long-acting GH release stimulation.', 'research peptide', 2.0, 1, 78.00, 27.00, true, true, 1, true, 15, true),
  ('MT2-10MG', 'Melanotan II 10mg', 'Melanocortin receptor agonist. Tanning and libido research.', 'research peptide', 2.0, 1, 68.00, 22.00, false, true, 2, true, NULL, true),
  ('EPITH-10MG', 'Epithalon 10mg', 'Tetrapeptide for longevity and telomere research.', 'research peptide', 2.0, 1, 88.00, 30.00, true, true, 2, true, 10, true),
  ('DSIP-5MG', 'DSIP 5mg', 'Delta sleep-inducing peptide. Sleep and stress regulation research.', 'research peptide', 2.0, 1, 55.00, 18.00, true, false, 1, true, 12, true);

-- Product Price Tiers
INSERT INTO product_price_tiers (product_id, min_quantity, unit_price, is_seed) VALUES
  (1, 5, 58.00, true), (1, 10, 52.00, true),
  (2, 5, 65.00, true), (2, 10, 58.00, true),
  (4, 5, 108.00, true), (4, 10, 96.00, true),
  (6, 5, 52.00, true), (6, 10, 46.00, true);

-- Product Batches
INSERT INTO product_batches (product_id, batch_number, factory_id, manufacture_date, quantity_produced, cost_override, qc_status, overall_purity_pct, notes, is_seed) VALUES
  (1, 'BPC-2024-001', 1, '2024-03-15', 200, NULL, 'passed', 98.7, 'First batch of 2024. Excellent purity.', true),
  (1, 'BPC-2024-002', 1, '2024-09-10', 150, 23.50, 'passed', 99.1, 'Slight cost increase due to raw material shortage.', true),
  (2, 'TB5-2024-001', 1, '2024-04-20', 180, NULL, 'passed', 98.2, NULL, true),
  (3, 'GHKCU-2024-001', 2, '2024-05-05', 100, NULL, 'passed', 97.8, NULL, true),
  (4, 'SEMA-2024-001', 3, '2024-06-12', 80, 44.00, 'passed', 99.4, 'Highest purity batch to date.', true),
  (5, 'TESA-2024-001', 1, '2024-07-01', 60, NULL, 'pending', NULL, 'QC tests in progress.', true),
  (6, 'IPA-2024-001', 1, '2024-02-28', 300, NULL, 'passed', 98.5, NULL, true),
  (7, 'CJC-2024-001', 1, '2024-08-14', 120, NULL, 'passed', 98.9, NULL, true),
  (9, 'EPITH-2024-001', 2, '2024-06-30', 90, 31.00, 'passed', 99.0, NULL, true),
  (10, 'DSIP-2024-001', 1, '2024-03-10', 160, NULL, 'passed', 98.3, NULL, true);

-- Batch Tests
INSERT INTO batch_tests (batch_id, test_type, test_date, lab_name, result_value, result_units, spec_min, spec_max, pass_fail, notes, is_seed) VALUES
  (1, 'hplc_purity', '2024-03-20', 'In-House QC', 98.7, '%', 97.0, 100.0, 'pass', NULL, true),
  (1, 'mass_spec', '2024-03-21', 'In-House QC', 1419.6, 'Da', 1415.0, 1425.0, 'pass', NULL, true),
  (2, 'hplc_purity', '2024-09-15', 'Third Party Analytics', 99.1, '%', 97.0, 100.0, 'pass', NULL, true),
  (3, 'hplc_purity', '2024-04-25', 'In-House QC', 98.2, '%', 97.0, 100.0, 'pass', NULL, true),
  (3, 'mass_spec', '2024-04-26', 'In-House QC', 3963.6, 'Da', 3958.0, 3970.0, 'pass', NULL, true),
  (5, 'hplc_purity', '2024-06-18', 'Third Party Analytics', 99.4, '%', 97.0, 100.0, 'pass', 'Best result this year.', true),
  (7, 'hplc_purity', '2024-03-05', 'In-House QC', 98.5, '%', 97.0, 100.0, 'pass', NULL, true),
  (8, 'hplc_purity', '2024-08-20', 'In-House QC', 98.9, '%', 97.0, 100.0, 'pass', NULL, true),
  (9, 'hplc_purity', '2024-07-05', 'Third Party Analytics', 99.0, '%', 97.0, 100.0, 'pass', NULL, true),
  (10, 'hplc_purity', '2024-03-15', 'In-House QC', 98.3, '%', 97.0, 100.0, 'pass', NULL, true);

-- Customers
INSERT INTO customers (full_name, email, phone, preferred_channel, channel_handle, ship_address_line1, ship_city, ship_state, ship_postal_code, ship_country, is_vip, is_blocked, notes, internal_notes, is_seed) VALUES
  ('Marcus Holloway', 'marcus.holloway@protonmail.com', '602-555-0142', 'telegram', '@marcus_bio', '8821 E Thomas Rd', 'Scottsdale', 'AZ', '85251', 'US', true, false, 'Long-term customer. Prefers BPC-157 and TB-500 combo kits.', 'Pays consistently. Good for upsell on Semaglutide.', true),
  ('Serena Voss', 'serena.voss@gmail.com', '310-555-0278', 'signal', '+13105550278', '1450 Montana Ave', 'Santa Monica', 'CA', '90403', 'US', true, false, 'Referred 3 new customers. Cosmetics focused.', NULL, true),
  ('Derek Fontaine', 'dfontaine@hey.com', '214-555-0391', 'discord', 'dfontaine#4521', '3302 Oak Lawn Ave', 'Dallas', 'TX', '75219', 'US', false, false, NULL, NULL, true),
  ('Priya Nair', 'priya.nair@outlook.com', '480-555-0507', 'whatsapp', '+14805550507', '7120 E McDowell Rd Apt 3', 'Scottsdale', 'AZ', '85257', 'US', false, false, 'Interested in longevity stack. Epithalon repeat buyer.', NULL, true),
  ('Jason Keller', 'jkeller@fastmail.com', '713-555-0614', 'telegram', '@jkeller_tx', '5500 Westheimer Rd', 'Houston', 'TX', '77056', 'US', false, true, NULL, 'Blocked: charged back without contacting us first. Do not fulfill.', true),
  ('Alicia Drummond', 'alicia.drummond@protonmail.com', '503-555-0725', 'telegram', '@alicia_pdx', '2244 NW Lovejoy St', 'Portland', 'OR', '97210', 'US', true, false, 'Very organized. Always provides tx hash same day.', NULL, true),
  ('Brandon Lim', 'brandon.lim@gmail.com', '626-555-0832', 'discord', 'blim_bio#1337', '411 S Garfield Ave', 'Monterey Park', 'CA', '91754', 'US', false, false, NULL, NULL, true),
  ('Naomi Okafor', 'naomi.okafor@icloud.com', '404-555-0943', 'whatsapp', '+14045550943', '890 Peachtree St NE Apt 15', 'Atlanta', 'GA', '30309', 'US', false, false, 'First order Q3 2024. Promising repeat customer.', NULL, true),
  ('Trevor Nash', 'tnash@protonmail.com', '702-555-1050', 'signal', '+17025551050', '3755 Las Vegas Blvd S', 'Las Vegas', 'NV', '89109', 'US', true, false, 'High-volume buyer. Runs a small wellness clinic.', 'Clinic account - treat as wholesale but price individually.', true),
  ('Camille Reyes', 'camille.reyes@hey.com', '312-555-1167', 'telegram', '@camille_chicago', '1247 N Wells St', 'Chicago', 'IL', '60610', 'US', false, false, NULL, NULL, true);

-- Update blocked customer details
UPDATE customers SET blocked_reason = 'Chargeback without contacting support first. Awaiting resolution.', blocked_at = '2024-08-15 10:00:00+00' WHERE id = 5 AND is_seed = true;

-- User Profiles (seed team members; user_id = NULL since we can't reference real UIB users)
INSERT INTO user_profiles (user_id, role, display_name, is_seed) VALUES
  (NULL, 'admin', 'Admin User', true),
  (NULL, 'sales_rep', 'Alex Rivera', true),
  (NULL, 'sales_rep', 'Jordan Kim', true),
  (NULL, 'warehouse', 'Sam Torres', true);

-- Update warehouse user assignment
UPDATE user_profiles SET assigned_warehouse_id = 1 WHERE display_name = 'Sam Torres' AND is_seed = true;

-- Sales Orders
INSERT INTO sales_orders (order_number, customer_id, order_date, created_by_user_id, ship_to_name, ship_address_line1, ship_city, ship_state, ship_postal_code, ship_country, order_channel, status, subtotal_usd, customer_shipping_charge_usd, discount_usd, total_usd, payment_status, notes, is_seed) VALUES
  ('ORD-2024-0001', 1, '2024-04-10', NULL, 'Marcus Holloway', '8821 E Thomas Rd', 'Scottsdale', 'AZ', '85251', 'US', 'telegram', 'delivered', 325.00, 0.00, 0.00, 325.00, 'paid', NULL, true),
  ('ORD-2024-0002', 6, '2024-05-22', NULL, 'Alicia Drummond', '2244 NW Lovejoy St', 'Portland', 'OR', '97210', 'US', 'telegram', 'delivered', 95.00, 0.00, 0.00, 95.00, 'paid', NULL, true),
  ('ORD-2024-0003', 9, '2024-07-03', NULL, 'Trevor Nash', '3755 Las Vegas Blvd S', 'Las Vegas', 'NV', '89109', 'US', 'signal', 'shipped', 580.00, 0.00, 30.00, 550.00, 'paid', 'Bulk order for clinic. Applied loyalty discount.', true),
  ('ORD-2024-0004', 4, '2024-08-14', NULL, 'Priya Nair', '7120 E McDowell Rd Apt 3', 'Scottsdale', 'AZ', '85257', 'US', 'whatsapp', 'delivered', 176.00, 0.00, 0.00, 176.00, 'paid', NULL, true),
  ('ORD-2024-0005', 2, '2024-09-01', NULL, 'Serena Voss', '1450 Montana Ave', 'Santa Monica', 'CA', '90403', 'US', 'signal', 'confirmed', 170.00, 0.00, 0.00, 170.00, 'unpaid', NULL, true),
  ('ORD-2024-0006', 7, '2024-09-15', NULL, 'Brandon Lim', '411 S Garfield Ave', 'Monterey Park', 'CA', '91754', 'US', 'discord', 'confirmed', 136.00, 0.00, 0.00, 136.00, 'partial_paid', NULL, true),
  ('ORD-2024-0007', 10, '2024-09-20', NULL, 'Camille Reyes', '1247 N Wells St', 'Chicago', 'IL', '60610', 'US', 'telegram', 'in_production', 120.00, 0.00, 0.00, 120.00, 'unpaid', 'China direct order. Awaiting factory confirmation.', true),
  ('ORD-2024-0008', 8, '2024-09-25', NULL, 'Naomi Okafor', '890 Peachtree St NE Apt 15', 'Atlanta', 'GA', '30309', 'US', 'whatsapp', 'confirmed', 65.00, 0.00, 0.00, 65.00, 'unpaid', NULL, true);

-- Sales Order Items
INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price_usd, line_total_usd, fulfillment_source, is_seed) VALUES
  (1, 1, 3, 65.00, 195.00, 'warehouse', true),
  (1, 2, 2, 65.00, 130.00, 'warehouse', true),
  (2, 5, 1, 95.00, 95.00, 'warehouse', true),
  (3, 4, 2, 120.00, 240.00, 'warehouse', true),
  (3, 6, 3, 58.00, 174.00, 'warehouse', true),
  (3, 7, 2, 78.00, 156.00, 'warehouse', true),
  (4, 9, 2, 88.00, 176.00, 'warehouse', true),
  (5, 3, 2, 85.00, 170.00, 'china_direct', true),
  (6, 1, 1, 65.00, 65.00, 'warehouse', true),
  (6, 6, 1, 58.00, 58.00, 'warehouse', true),
  (6, 7, 1, 78.00, 78.00, 'warehouse', true),
  (7, 4, 1, 120.00, 120.00, 'china_direct', true),
  (8, 1, 1, 65.00, 65.00, 'warehouse', true);

-- Order Payments
INSERT INTO order_payments (sales_order_id, direction, asset, network, quoted_at, spot_rate_usd, amount_asset, amount_usd, tx_hash, verification_status, is_seed) VALUES
  (1, 'incoming', 'USDC', 'ethereum', '2024-04-10 14:00:00+00', 1.00, 325.00, 325.00, '0xabc123def456...', 'verified', true),
  (2, 'incoming', 'USDC', 'solana', '2024-05-22 16:30:00+00', 1.00, 95.00, 95.00, '5SolTxHash789abc...', 'verified', true),
  (3, 'incoming', 'ETH', 'ethereum', '2024-07-03 11:00:00+00', 3180.00, 0.17296, 550.00, '0xdef789ghi012...', 'verified', true),
  (4, 'incoming', 'SOL', 'solana', '2024-08-14 09:45:00+00', 155.00, 1.13548, 176.00, '4SolTxHashDef456...', 'verified', true),
  (6, 'incoming', 'USDC', 'ethereum', '2024-09-15 13:00:00+00', 1.00, 68.00, 68.00, '0xghi123jkl456...', 'verified', true),
  (5, 'incoming', 'BTC', 'bitcoin', '2024-09-01 10:00:00+00', 58000.00, 0.00293, 170.00, NULL, 'pending', true),
  (7, 'incoming', 'USDC', 'solana', '2024-09-20 15:00:00+00', 1.00, 120.00, 120.00, NULL, 'pending', true),
  (8, 'incoming', 'USDC', 'ethereum', '2024-09-25 12:00:00+00', 1.00, 65.00, 65.00, NULL, 'pending', true);

-- Inventory (product+batch+warehouse)
INSERT INTO inventory (product_id, batch_id, warehouse_id, quantity_on_hand, quantity_reserved, is_seed) VALUES
  (1, 1, 1, 45, 2, true),   -- BPC-157 batch1 at Phoenix
  (1, 2, 1, 30, 1, true),   -- BPC-157 batch2 at Phoenix
  (2, 3, 1, 52, 2, true),   -- TB-500 batch1 at Phoenix
  (3, 4, 2, 18, 0, true),   -- GHK-Cu batch1 at Dallas
  (4, 5, 1, 8, 2, true),    -- Semaglutide at Phoenix
  (6, 7, 1, 120, 4, true),  -- Ipamorelin at Phoenix
  (7, 8, 2, 35, 3, true),   -- CJC-1295 at Dallas
  (9, 9, 1, 22, 2, true),   -- Epithalon at Phoenix
  (10, 10, 1, 48, 0, true), -- DSIP at Phoenix
  (1, 1, 2, 20, 0, true);   -- BPC-157 batch1 also at Dallas

-- Inbound Shipments
INSERT INTO shipments_inbound (reference_number, factory_id, freight_forwarder, mode, tracking_number, departure_date, arrival_date, status, declared_value, is_seed) VALUES
  ('SHI-2024-001', 1, 'Flexport', 'air', 'IB12345678CN', '2024-07-15', '2024-07-28', 'delivered', 4500.00, true),
  ('SHI-2024-002', 2, 'Flexport', 'ocean', 'OOCL87654321', '2024-08-01', '2024-09-10', 'in_transit', 7200.00, true),
  ('SHI-2024-003', 1, 'Freight Tiger', 'air', 'FT99887766CN', '2024-09-18', '2024-10-01', 'freight_forwarder', 3100.00, true);

-- Inbound Shipment Items
INSERT INTO shipments_inbound_items (shipment_id, product_id, batch_id, destination_warehouse_id, quantity_shipped, quantity_received, condition_flag, received_at, expected_arrival_date, is_seed) VALUES
  (1, 1, 1, 1, 100, 100, 'ok', '2024-07-29 10:00:00+00', '2024-07-28', true),
  (1, 6, 7, 1, 150, 148, 'short', '2024-07-29 10:00:00+00', '2024-07-28', true),
  (2, 3, 4, 2, 80, NULL, NULL, NULL, '2024-09-10', true),
  (2, 7, 8, 2, 60, NULL, NULL, NULL, '2024-09-10', true),
  (3, 2, 2, 1, 100, NULL, NULL, NULL, '2024-10-01', true);

-- Outbound Shipments
INSERT INTO shipments_outbound (sales_order_id, origin, origin_warehouse_id, carrier, tracking_number, shipped_date, status, internal_shipping_cost_usd, payable_status, is_seed) VALUES
  (1, 'warehouse', 1, 'UPS', '1Z999AA10123456784', '2024-04-12', 'delivered', 18.00, 'paid', true),
  (2, 'warehouse', 1, 'USPS', '9400111899223456789012', '2024-05-24', 'delivered', 18.00, 'paid', true),
  (3, 'warehouse', 1, 'FedEx', '774899172137', '2024-07-06', 'in_transit', 26.00, 'owed', true),
  (4, 'warehouse', 1, 'UPS', '1Z999AA10987654321', '2024-08-16', 'delivered', 18.00, 'paid', true);

-- Warehouse Activity Log (sample entries)
INSERT INTO warehouse_activity_log (warehouse_id, event_at, event_type, product_id, batch_id, quantity_delta, source_record_type, source_record_id, notes, is_seed) VALUES
  (1, '2024-07-29 10:00:00+00', 'receipt_delivered', 1, 1, 100, 'shipments_inbound_items', 1, 'Received BPC-157 Batch BPC-2024-001: 100 kits.', true),
  (1, '2024-07-29 10:05:00+00', 'receipt_delivered', 6, 7, 148, 'shipments_inbound_items', 2, 'Received Ipamorelin Batch IPA-2024-001: 148 kits (2 short).', true),
  (1, '2024-07-29 10:05:00+00', 'receipt_discrepancy', 6, 7, -2, 'shipments_inbound_items', 2, 'Short 2 kits on Ipamorelin. Discrepancy noted.', true),
  (1, '2024-04-12 09:00:00+00', 'outbound_pick', 1, 1, -3, 'shipments_outbound', 1, 'Picked 3x BPC-157 for ORD-2024-0001.', true),
  (1, '2024-05-24 09:00:00+00', 'outbound_pick', 5, 6, -1, 'shipments_outbound', 2, 'Picked 1x Tesamorelin for ORD-2024-0002.', true);

-- Refund Task (sample)
INSERT INTO refund_tasks (sales_order_id, amount_usd_owed, reason, status, due_date, notes, is_seed) VALUES
  (6, 20.00, 'Customer overpaid by $20 on partial payment. Refund agreed verbally.', 'owed', '2024-10-15', NULL, true);
