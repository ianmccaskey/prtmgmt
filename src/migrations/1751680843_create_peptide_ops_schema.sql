-- Full schema migration for Peptide Ops app
-- Tables: factories, warehouses, warehouse_shipping_rate_plans, receive_wallets,
--   free_order_reasons, products, product_price_tiers, product_price_history,
--   product_batches, batch_tests, customers, user_profiles, customer_notes,
--   customer_note_audit_log, sales_orders, sales_order_items,
--   sales_order_item_allocations, order_audit_log, order_payments, refund_tasks,
--   inventory, inventory_writeoffs, inventory_count_corrections,
--   inter_warehouse_transfers, warehouse_activity_log,
--   shipments_inbound, shipment_documents, shipments_inbound_items,
--   shipments_outbound, shipments_outbound_items, app_settings

CREATE TABLE factories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE warehouses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE warehouse_shipping_rate_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_date DATE NOT NULL,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  base_kits INTEGER NOT NULL DEFAULT 6,
  base_price_usd NUMERIC(10,2) NOT NULL DEFAULT 18.00,
  tier_kits INTEGER NOT NULL DEFAULT 6,
  tier_price_usd NUMERIC(10,2) NOT NULL DEFAULT 8.00,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE receive_wallets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset TEXT NOT NULL CHECK (asset IN ('USDC','USDT','ETH','SOL','BTC')),
  network TEXT NOT NULL CHECK (network IN ('ethereum','solana','bitcoin')),
  address TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE free_order_reasons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('research peptide','cosmetic peptide','blend','accessory')),
  vial_size_ml NUMERIC(6,2),
  vials_per_unit INTEGER,
  list_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  standard_cost NUMERIC(10,2),
  available_warehouse BOOLEAN NOT NULL DEFAULT true,
  available_china_direct BOOLEAN NOT NULL DEFAULT false,
  factory_id BIGINT REFERENCES factories(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  low_stock_threshold INTEGER,
  image_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE product_price_tiers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE product_price_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  changed_by_user_id BIGINT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field TEXT NOT NULL CHECK (field IN ('list_price','standard_cost')),
  old_value NUMERIC(10,2),
  new_value NUMERIC(10,2),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE product_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  factory_id BIGINT REFERENCES factories(id),
  manufacture_date DATE,
  quantity_produced INTEGER,
  cost_override NUMERIC(10,2),
  qc_status TEXT NOT NULL DEFAULT 'pending' CHECK (qc_status IN ('passed','failed','pending','quarantine')),
  coa_url TEXT,
  coa_file TEXT,
  overall_purity_pct NUMERIC(5,2),
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE batch_tests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL CHECK (test_type IN ('hplc_purity','mass_spec','endotoxin','sterility','appearance','moisture','other')),
  test_date DATE,
  lab_name TEXT,
  result_value NUMERIC(12,4),
  result_units TEXT,
  spec_min NUMERIC(12,4),
  spec_max NUMERIC(12,4),
  pass_fail TEXT CHECK (pass_fail IN ('pass','fail','marginal')),
  test_report_url TEXT,
  test_report_file TEXT,
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  preferred_channel TEXT CHECK (preferred_channel IN ('telegram','signal','discord','whatsapp','other')),
  channel_handle TEXT,
  ship_address_line1 TEXT,
  ship_address_line2 TEXT,
  ship_city TEXT,
  ship_state TEXT,
  ship_postal_code TEXT,
  ship_country TEXT DEFAULT 'US',
  is_vip BOOLEAN NOT NULL DEFAULT false,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_by_user_id BIGINT,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE user_profiles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin','sales_rep','warehouse')),
  assigned_warehouse_id BIGINT REFERENCES warehouses(id),
  display_name TEXT,
  avatar_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE customer_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author_user_id BIGINT,
  note_text TEXT NOT NULL,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE customer_note_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_note_id BIGINT NOT NULL REFERENCES customer_notes(id) ON DELETE CASCADE,
  changed_by_user_id BIGINT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL CHECK (action IN ('edited','deleted')),
  old_text TEXT,
  new_text TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

-- Order number sequence per year
CREATE SEQUENCE sales_order_seq START 1;

CREATE TABLE sales_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by_user_id BIGINT,
  ship_to_name TEXT,
  ship_address_line1 TEXT,
  ship_address_line2 TEXT,
  ship_city TEXT,
  ship_state TEXT,
  ship_postal_code TEXT,
  ship_country TEXT DEFAULT 'US',
  order_channel TEXT CHECK (order_channel IN ('telegram','signal','discord','whatsapp','other')),
  is_free_order BOOLEAN NOT NULL DEFAULT false,
  free_order_reason_id BIGINT REFERENCES free_order_reasons(id),
  free_order_note TEXT,
  partial_fulfillment_allowed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','in_production','partially_shipped','shipped','delivered','cancelled')),
  cancellation_reason TEXT,
  subtotal_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_shipping_charge_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial_paid','paid','refunded')),
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE sales_order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  fulfillment_source TEXT NOT NULL DEFAULT 'warehouse' CHECK (fulfillment_source IN ('warehouse','china_direct')),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE sales_order_item_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_item_id BIGINT NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES product_batches(id),
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  quantity INTEGER NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_by_user_id BIGINT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE order_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  changed_by_user_id BIGINT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL CHECK (change_type IN ('status','line_item_added','line_item_removed','line_item_qty','line_item_price','ship_to','discount','shipping_cost','payment_status','notes','other')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE order_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('incoming','refund')),
  asset TEXT NOT NULL CHECK (asset IN ('USDC','USDT','ETH','SOL','BTC')),
  network TEXT NOT NULL CHECK (network IN ('ethereum','solana','bitcoin')),
  receive_wallet_id BIGINT REFERENCES receive_wallets(id),
  quoted_at TIMESTAMPTZ,
  spot_rate_usd NUMERIC(16,6),
  amount_asset NUMERIC(20,8),
  amount_usd NUMERIC(10,2),
  tx_hash TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','failed')),
  verified_by_user_id BIGINT,
  verified_at TIMESTAMPTZ,
  issue_type TEXT CHECK (issue_type IN ('underpaid','overpaid','wrong_asset','wrong_network','wallet_mismatch','unconfirmed_onchain','other')),
  issue_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE refund_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_usd_owed NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  assignee_user_id BIGINT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'owed' CHECK (status IN ('owed','sent','verified','cancelled')),
  linked_payment_id BIGINT REFERENCES order_payments(id),
  sent_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE inventory (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  batch_id BIGINT NOT NULL REFERENCES product_batches(id),
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  is_seed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (product_id, batch_id, warehouse_id)
);

CREATE TABLE inventory_writeoffs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  batch_id BIGINT NOT NULL REFERENCES product_batches(id),
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('damaged','expired','lost','qc_hold','customer_replacement','receipt_shortage','receipt_damage','other')),
  notes TEXT,
  evidence_url TEXT,
  evidence_file TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto_from_receipt')),
  source_receipt_item_id BIGINT,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE inventory_count_corrections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  batch_id BIGINT NOT NULL REFERENCES product_batches(id),
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  old_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  delta INTEGER GENERATED ALWAYS AS (new_quantity - old_quantity) STORED,
  reason TEXT NOT NULL,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE inter_warehouse_transfers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  batch_id BIGINT NOT NULL REFERENCES product_batches(id),
  quantity INTEGER NOT NULL,
  source_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  destination_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','received','cancelled')),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  initiated_by_user_id BIGINT,
  received_at TIMESTAMPTZ,
  received_by_user_id BIGINT,
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE warehouse_activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id BIGINT,
  event_type TEXT NOT NULL CHECK (event_type IN ('receipt_delivered','receipt_discrepancy','outbound_pick','transfer_out_initiated','transfer_in_received','transfer_cancelled','writeoff','count_correction')),
  product_id BIGINT REFERENCES products(id),
  batch_id BIGINT REFERENCES product_batches(id),
  quantity_delta INTEGER,
  source_record_type TEXT CHECK (source_record_type IN ('shipments_inbound_items','shipments_outbound','inter_warehouse_transfers','inventory_writeoffs','inventory_count_corrections')),
  source_record_id BIGINT,
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE shipments_inbound (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference_number TEXT,
  factory_id BIGINT REFERENCES factories(id),
  freight_forwarder TEXT,
  mode TEXT CHECK (mode IN ('air','ocean','express_courier')),
  tracking_number TEXT,
  departure_date DATE,
  arrival_date DATE,
  status TEXT NOT NULL DEFAULT 'freight_forwarder' CHECK (status IN ('freight_forwarder','in_transit','delivered')),
  customs_status TEXT,
  hts_code TEXT,
  declared_value NUMERIC(10,2),
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE shipment_documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shipment_id BIGINT NOT NULL REFERENCES shipments_inbound(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('bol','commercial_invoice','packing_list','coa','other')),
  label TEXT,
  doc_url TEXT,
  doc_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id BIGINT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE shipments_inbound_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shipment_id BIGINT NOT NULL REFERENCES shipments_inbound(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  batch_id BIGINT NOT NULL REFERENCES product_batches(id),
  destination_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  quantity_shipped INTEGER NOT NULL,
  quantity_received INTEGER,
  condition_flag TEXT CHECK (condition_flag IN ('ok','damaged','short','mixed')),
  discrepancy_notes TEXT,
  evidence_url TEXT,
  evidence_file TEXT,
  expected_arrival_date DATE,
  received_at TIMESTAMPTZ,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE shipments_outbound (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id),
  origin TEXT NOT NULL CHECK (origin IN ('warehouse','china')),
  origin_warehouse_id BIGINT REFERENCES warehouses(id),
  factory_id BIGINT REFERENCES factories(id),
  carrier TEXT CHECK (carrier IN ('USPS','UPS','FedEx','DHL','other')),
  tracking_number TEXT,
  shipped_date DATE,
  delivered_date DATE,
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit','delivered')),
  internal_shipping_cost_usd NUMERIC(10,2),
  rate_plan_id BIGINT REFERENCES warehouse_shipping_rate_plans(id),
  payable_status TEXT NOT NULL DEFAULT 'owed' CHECK (payable_status IN ('owed','paid')),
  paid_at TIMESTAMPTZ,
  paid_by_user_id BIGINT,
  issue_flag TEXT CHECK (issue_flag IN ('lost_in_transit','damaged_in_transit','returned_to_sender','stuck_in_transit','other')),
  issue_notes TEXT,
  issue_flagged_at TIMESTAMPTZ,
  issue_flagged_by_user_id BIGINT,
  notes TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE shipments_outbound_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shipment_id BIGINT NOT NULL REFERENCES shipments_outbound(id) ON DELETE CASCADE,
  allocation_id BIGINT REFERENCES sales_order_item_allocations(id),
  quantity_shipped INTEGER NOT NULL,
  is_seed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE app_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX idx_products_factory ON products(factory_id);
CREATE INDEX idx_product_batches_product ON product_batches(product_id);
CREATE INDEX idx_batch_tests_batch ON batch_tests(batch_id);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);
CREATE INDEX idx_warehouse_activity_log_warehouse ON warehouse_activity_log(warehouse_id);
CREATE INDEX idx_shipments_inbound_status ON shipments_inbound(status);
CREATE INDEX idx_shipments_outbound_order ON shipments_outbound(sales_order_id);
CREATE INDEX idx_order_payments_order ON order_payments(sales_order_id);
CREATE INDEX idx_refund_tasks_order ON refund_tasks(sales_order_id);
CREATE INDEX idx_customer_notes_customer ON customer_notes(customer_id);

-- Default app settings
INSERT INTO app_settings (key, value) VALUES ('reorder_cover_days', '60');
