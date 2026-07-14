# Requirements

## Summary
An internal operations app for a small B2C peptide business that imports kits from Chinese manufacturers and fulfills orders via domestic warehouse or China direct-ship. Sales reps manually enter orders, the team tracks inventory across multiple warehouses, manages inbound/outbound shipments, records crypto payments, and monitors key business metrics — all through a dense, professional admin interface (Linear/Stripe aesthetic). The whole team shares one app with role-based UI visibility (admin / sales_rep / warehouse) enforced at query level. Data is stored in a UI Bakery hosted PostgreSQL database seeded with realistic peptide business data.

## Use cases

- App Shell & Database Setup
  1) [x] Create the full PostgreSQL schema (all tables with is_seed column and constraints)
  2) [x] Seed all tables with 8–15 realistic rows using real peptide names and business data
  3) [x] Build the sidebar navigation with role-aware nav items and page routing
  4) [x] Implement the Home / Overview Dashboard with stat cards, charts, and activity feed

- Sales Orders Dashboard
  1) Build the tabbed Sales Orders page (All Orders / China-Direct Queue / Refunds Queue)
  2) Implement the New Order fast-entry form with customer autocomplete, line items, fulfillment source defaulting, pricing tiers, and ship-to snapshot
  3) Build the order detail side drawer with payments panel, audit log timeline, shipment tracking, and all order actions
  4) Implement order status transitions, cancellation flow, and per-line source switching with audit logging

- Customers Dashboard
  1) Build the searchable/filterable customers table with VIP/BLOCKED badges and CSV export
  2) Implement the customer detail page with contact info, VIP/block controls, interaction log (customer_notes), and order history
  3) Add the inline "Create New Customer" mini-form with duplicate detection logic

- Products & Batches
  1) Build the products grid/table with filters, "New Product" form, and active toggle
  2) Implement the product detail page with 5 tabs: Details, Pricing (tiers + price history chart), Batches, Test Results, Inventory
  3) Build the Batches dashboard table with QC status color-coding and click-through to batch detail page
  4) Implement batch detail: test results cards, "Add Test Result" form, QC quarantine/release actions, write-off form, and Batch Traceability Report PDF

- Warehouse — Inventory & Fulfillment
  1) Build the Warehouse page with warehouse switcher, inventory table (on-hand/reserved/available/in-transit), stat cards, and per-warehouse breakdown
  2) Implement Reorder Suggestions section with velocity math and "Create Inbound Shipment" quick-action
  3) Build the Fulfillment Queue with "Mark Shipped" workflow: per-line warehouse+batch allocation (FIFO default), multi-warehouse outbound shipment creation, internal shipping cost calculation
  4) Implement Inter-Warehouse Transfers panel, Warehouse Payables panel, Warehouse Activity Log, inventory count correction form, and write-off form

- Logistics — Inbound Shipments
  1) Build the inbound shipments filterable table with visual status pipeline and stat cards
  2) Implement "New Inbound Shipment" form supporting multiple line items with per-item destination warehouse
  3) Build the shipment detail view with document list, "Add Document" form, and "Receive Shipment" workflow (partial receipts, discrepancy flagging, auto-write-off toggle)

- Reports & Analytics
  1) Build the Reports page with global date-range picker and quick presets
  2) Implement Revenue Trends section: line charts (warehouse vs china-direct), quarterly chart, KPI cards
  3) Implement Top Customers, Top Products, and Warehouse Throughput sections with sortable tables and CSV export
  4) Implement COGS/Margin analysis section (admin only) and Payment Method Breakdown donut chart

- Settings Page
  1) Build the Settings page with Warehouses section (table + add form + active toggle) and Warehouse Shipping Rate Plans section (versioned table, add form, calculator widget)
  2) Implement Receive Wallets section, Free Order Reasons section, and Reorder Planning setting
  3) Build User Management section: user profiles table, add/edit user flow with role and warehouse assignment, avatar upload

## Plan

### App Shell & Database Setup
1. [] Create PostgreSQL schema migration: tables `factories`, `warehouses`, `warehouse_shipping_rate_plans`, `receive_wallets`, `free_order_reasons`, `products`, `product_price_tiers`, `product_price_history`, `product_batches`, `batch_tests`, `customers`, `user_profiles`, `customer_notes`, `customer_note_audit_log`, `sales_orders`, `sales_order_items`, `sales_order_item_allocations`, `order_audit_log`, `order_payments`, `refund_tasks`, `inventory`, `inventory_writeoffs`, `inventory_count_corrections`, `inter_warehouse_transfers`, `warehouse_activity_log`, `shipments_inbound`, `shipment_documents`, `shipments_inbound_items`, `shipments_outbound`, `shipments_outbound_items` — each with `is_seed BOOLEAN DEFAULT false`. Include all FK constraints, enums as CHECK constraints, auto-generated `order_number` sequence, and unique keys as described.
2. [] Seed `factories` with 3 rows (realistic China peptide manufacturers), `warehouses` with 2 rows (US warehouse locations), `warehouse_shipping_rate_plans` with 1 active plan (base 6 kits/$18, tier 6/$8), `receive_wallets` with realistic crypto addresses covering all valid asset/network combinations, `free_order_reasons` with the 5 starter rows.
3. [] Seed `products` with 10 rows (BPC-157, TB-500, GHK-Cu, Semaglutide, Tesamorelin, Ipamorelin, CJC-1295, Melanotan II, Epithalon, DSIP) with realistic SKUs, prices, costs, category, vial/kit specs, factory_id, fulfillment channel flags, and low_stock_threshold.
4. [] Seed `product_batches` with 10 rows across products, including batch numbers, QC status, purity %, cost overrides where applicable. Seed `batch_tests` with 10 rows. Seed `customers` with 10 rows with realistic names, preferred channels, handles, ship addresses, and some marked VIP.
5. [] Seed `inventory` with 10 rows (product+batch+warehouse combinations with on_hand and reserved qtys). Seed `sales_orders` with 8 rows (mix of statuses, channels, free and paid), `sales_order_items` with 10 rows, `order_payments` with 8 rows. Seed `shipments_inbound` with 3 rows and `shipments_inbound_items` with 5 rows. Seed `shipments_outbound` with 4 rows and `shipments_outbound_items` with 4 rows.
6. [] Build the main app shell: sidebar navigation with icons for Home, Sales Orders, Customers, Products, Batches, Warehouse, Logistics, Reports, Settings. Apply role-aware visibility logic using `useAppContext` to read the logged-in user's role from `user_profiles`. Highlight the active page. Apply the professional neutral theme (dark sidebar, white content area, dense typography matching Linear/Stripe aesthetic).
7. [] Build the Home / Overview Dashboard: stat cards row (open orders, shipped this month, revenue this month, inbound in transit, low-stock alerts, unpaid balance, unverified payments, payments with issues, refunds owed count+USD, overdue refund tasks, outbound issues, warehouse payables outstanding, china-direct awaiting shipment). All stats query the hosted Postgres DB.
8. [] Add to the Home Dashboard: bar chart of revenue by month (last 6 months), donut chart of order status breakdown, donut chart of orders by channel (this month), activity feed of newest 10 orders + shipments combined, and quick-link cards to each main section.

### Sales Orders Dashboard
1. [x] Build the Sales Orders page with a tabbed layout (All Orders / China-Direct Queue / Refunds Queue) and a stat strip across all tabs (confirmed count, in_production count, shipped this month, this-month revenue USD, unpaid balance, china-direct awaiting shipment).
2. [x] Build the All Orders tab: filterable/sortable table with columns (order #, customer, date, status badge, payment status badge, fulfillment source badges WH/CN, FREE badge, channel, created_by). Filters: status, fulfillment source type, order channel, is_free_order, date range, created_by user, payment status. Search by order number, customer name, email, phone, channel handle.
3. [x] Implement the "New Order" form as a slide-over panel: customer autocomplete (search by name/email/phone/handle) with VIP/BLOCKED display; inline "Create New Customer" mini-form; order channel dropdown defaulting to customer's preferred_channel; free order toggle revealing reason dropdown + required note; partial fulfillment toggle; ship-to section auto-filled from customer address with editable override and "save to customer" option; auto-generated order number display.
4. [x] Implement the line items section of the New Order form: product autocomplete (SKU or name), per-line fulfillment source picker (warehouse/china_direct) auto-defaulted from stock, stock indicator inline, quantity input, unit price auto-fill from pricing tiers with "tier applied" / "manual override" badge, running line total. Discount, customer shipping charge, and total USD fields. Validate ship-country for warehouse lines on confirm.
5. [x] Implement the crypto payment section of the New Order form: asset+network picker, spot rate entry, computed amount_asset display, receive wallet address display with copy-to-clipboard, tx_hash field, creates pending `order_payments` row. Save as draft / Confirm order actions. Blocked-customer enforcement (disable confirm for sales_rep, allow admin with override note logged to audit log).
6. [x] Build the order detail side drawer: line items table with per-line "Switch source" toggle, batch allocations, shipped indicator. Customer info and ship-to snapshot. Tracking info block (prominent, near top when shipped). Payments panel (all order_payments rows, Mark Verified action, Flag Issue action, Add Payment action). "Create Refund Task" action with mini form. Linked outbound shipments with "Flag Shipment Issue" action. Full audit log timeline (admin only). Internal notes.
7. [x] Build the China-Direct Queue tab: table of orders with at least one china_direct line in status confirmed/in_production. Columns: order #, customer, factory, order date, days waiting, status, payment status, mix indicator. "Update to In Production" inline action. "Mark Shipped from China" action (carrier + tracking → creates shipments_outbound with origin=china, updates order status). Mini stat strip above table.
8. [x] Build the Refunds Queue tab: table of refund_tasks sortable/filterable by status (default: owed), assignee, due date with color-coded overdue (red/amber/green). "Mark Sent" drawer (records refund payment, creates order_payments row, links to task). "Mark Verified" action. Mini stat strip (owed count/USD, overdue, this-week sent/verified).

### Customers Dashboard
1. [x] Build the Customers page: searchable table with columns (name + VIP/BLOCKED badges, preferred_channel + handle, email, phone, total orders, lifetime value, last order date). Filters: preferred_channel, is_vip, is_blocked. CSV export button.
2. [x] Implement the "New Customer" form with all fields including preferred_channel, channel_handle, ship address, is_vip, notes, internal_notes. Implement duplicate detection on submit: check for matching full_name + ship_address_line1 (case-insensitive, trimmed); if match found, show warning modal with "Use existing" / "Create anyway" options.
3. [x] Build the customer detail page: contact info section (all fields editable including preferred_channel + handle), VIP toggle, block/unblock controls (block requires reason → writes blocked_reason, blocked_at, blocked_by_user_id), saved default ship-to address section, "New Order for this Customer" shortcut.
4. [x] Add to customer detail page: full order history table (each order with actual ship-to shown), lifetime spend, interaction log (customer_notes — newest first, Add Note quick-input, per-note edit/delete writing to customer_note_audit_log), internal notes panel (visible admin + sales_rep only, hidden for warehouse role).

### Products & Batches
1. [x] Build the Products page: grid/table toggle view with columns (thumbnail, SKU, name, category, vial size, vials/kit, list price, total stock, WH/CN badges, active toggle). Filters: category, factory, fulfillment channel, active status. Search by SKU or name. "New Product" button opens form with all spec fields, factory selector (dropdown from factories table), fulfillment channel checkboxes, low_stock_threshold.
2. [x] Build the product detail page shell with 5-tab navigation (Details / Pricing / Batches / Test Results / Inventory). Details tab: editable spec fields (vial size, vials/kit, category, image upload, fulfillment channels, low_stock_threshold). Pricing section shows list_price and standard_cost as editable fields; on save, auto-insert into product_price_history if values changed. Enforce factory_id immutability once batches exist.
3. [x] Implement the Pricing tab: tiers table (min_quantity, unit_price) with add/edit/delete sorted by min_quantity. Price History section: line chart of list_price and standard_cost over time using product_price_history data, plus chronological change table (date, changed_by, field, old→new).
4. [x] Implement the Batches tab on product detail: table of batches (batch #, factory, mfg date, qty kits, cost_override or "(standard)", QC status badge, purity %, CoA link/file). "Add Batch" form. Implement Inventory tab: current stock by batch (on-hand, reserved, available) for this product across all warehouses.
5. [x] Implement the Test Results tab on product detail: aggregated view of all batch_tests — filter by test_type, line chart of HPLC purity by batch over time.
6. [x] Build the Batches dashboard (top-level page): table with columns (batch #, product, factory, mfg date, qty produced, qty remaining, QC status, purity %). Filters: product, factory, QC status, manufacture date range. Color-code QC status (green/amber/orange/red).
7. [x] Build the batch detail page: metadata + CoA link/file display (URL preferred over file). Test results panel: cards per test type (type, lab, result vs spec, pass/fail badge, newest drives QC roll-up). "Add Test Result" form. QC manual controls: "Send to Quarantine" (requires note), "Release from Quarantine".
8. [x] Implement on the batch detail page: "Write-off / Destroy" action with partial/full options, reason required, notes if reason=other, evidence upload, confirmation modal showing which inventory rows will be decremented.
9. [x] Implement linked data sections on batch detail: linked inbound shipment(s) list, current inventory by warehouse, sales order items consuming this batch (order #, customer, qty, date), prior write-offs list, inter-warehouse transfers list.

### Warehouse — Inventory & Fulfillment
1. [] Build the Warehouse page shell: warehouse switcher dropdown at top ("All Warehouses" default + individual warehouses). All panels filter by selection. Stat cards: total SKUs in stock, total kits, total retail value, low-stock SKU count, kits reserved, kits in-transit inbound, kits in-transit inter-warehouse. Per-warehouse breakdown mini-table.
2. [] Build the inventory table: product, SKU, batch, warehouse, on-hand, reserved, available (on-hand−reserved), in-transit inbound kits, expected next arrival date. Color-code low-stock rows per product's low_stock_threshold (applied to sum across all warehouses). Filters: warehouse, product, category, batch, QC status.
3. [] Implement the Reorder Suggestions section: table of products where total available ≤ low_stock_threshold. Columns: product, current available, in-transit inbound, sales last 30d, daily velocity, recommended reorder qty (with reasoning tooltip using reorder_cover_days from Settings). "Create Inbound Shipment for these SKUs" quick-action pre-populating the Logistics New Inbound Shipment form.
4. [] Build the In-Transit Inbound panel: table of every in-transit line across non-delivered inbound shipments (product, batch, qty, destination warehouse, shipment reference, expected arrival). Build the Fulfillment Queue: orders with warehouse-sourced unshipped lines. Columns showing which warehouse(s) will fulfill and highlighting allocation gaps.
5. [] Implement the "Mark Shipped" workflow: show warehouse-sourced lines only; per-line FIFO batch+warehouse allocation (oldest passed-QC batch first, rep-overridable); one outbound shipment per unique warehouse; carrier + tracking entry per shipment; auto-calculate internal_shipping_cost_usd using active rate plan; create shipments_outbound + shipments_outbound_items + sales_order_item_allocations; decrement quantity_on_hand and quantity_reserved on inventory rows; write warehouse_activity_log rows (outbound_pick per allocation); update order status.
6. [] Build the Inter-Warehouse Transfers panel: table with status filter (default: initiated). Columns: product, batch, qty, source, destination, initiated_at, days in transit, status. "New Transfer" form (source warehouse, destination, product+batch, qty, note) — deducts from source on submit. "Mark Received" action (prompts received qty, flags discrepancy if short, adds to destination inventory, creates destination inventory row if needed). Write warehouse_activity_log rows for transfer_out_initiated, transfer_in_received, transfer_cancelled.
7. [] Build the Warehouse Payables panel: table of warehouses with outstanding balance (sum of owed shipments' internal_shipping_cost_usd). Columns: warehouse, owed shipments count, owed USD total. Click → drilldown table of individual owed shipments (order #, shipped date, kits, cost). "Mark Paid" bulk action flipping payable_status=paid, recording paid_at and paid_by_user_id.
8. [] Build the Warehouse Activity Log panel: filterable timeline of warehouse_activity_log rows (event_type, product, date range filters). Columns: timestamp, event_type badge, product, batch, qty delta, actor, source link. Build the Inventory Count Correction form (warehouse + product + batch + actual count + reason → creates inventory_count_corrections row, sets quantity_on_hand). Build the Write-off form (warehouse + product + batch + qty + reason + optional evidence → creates inventory_writeoffs row, decrements on-hand, checks reservation conflicts before proceeding).

### Logistics — Inbound Shipments
1. [x] Build the Logistics page: filterable table of inbound shipments (reference, factory, mode, freight forwarder, tracking, departure, arrival, status). Visual status pipeline per row (freight_forwarder → in_transit → delivered). Stat cards: with freight forwarder count, in transit count, delivered this month, shipments with discrepancies this month.
2. [x] Implement "New Inbound Shipment" form: reference number, factory dropdown, freight forwarder, mode (air/ocean/express courier), tracking number, departure date, arrival date. Multi-row line items section — each line: product, batch (or "new batch" option), destination warehouse dropdown, quantity_shipped, expected_arrival_date override. Add/remove line rows dynamically.
3. [x] Build the shipment detail view: metadata panel (reference, factory, mode, tracking, dates, status, customs fields, declared value, HTS code). Line items table (product, batch, destination warehouse, shipped qty, received qty, condition, discrepancy notes). Document list from shipment_documents with "Add Document" form (doc_type, URL or file upload, label; URL preferred over file for display).
4. [x] Implement the "Receive Shipment" workflow: show all not-yet-received lines; per-line: received qty input (defaults to shipped qty), condition flag picker (ok/damaged/short/mixed); if received < shipped OR condition ≠ ok, require discrepancy notes; auto-write-off toggle per discrepancy line (default ON); on confirm: add received qty to inventory at destination warehouse (create inventory row if none exists), create auto write-off rows where toggled, write warehouse_activity_log rows (receipt_delivered + receipt_discrepancy as needed); flip shipment status to delivered when all lines received, else keep in_transit for subsequent "Receive Remaining" runs.

### Reports & Analytics
1. [x] Build the Reports page shell with global date-range picker at top (quick presets: this month, last month, this quarter, last quarter, this year, last year, custom). All sections respect the date range. Revenue Trends section: line chart (monthly revenue, two series: warehouse-fulfilled vs china-direct), quarterly line chart, KPI cards (total revenue, avg monthly revenue, growth vs prior period).
2. [x] Implement Top Customers section: sortable table (rank, name, order count, total spend, avg order value, last order date; default sort: total spend desc; configurable top N, default 25). Implement Top Products section: sortable table (rank, SKU + name, units sold, revenue; sortable by units or revenue; configurable top N). Both with CSV export.
3. [x] Implement Warehouse Throughput section: grouped bar chart (kits shipped per warehouse per month). Table: warehouse, total kits shipped, avg kits/month, avg internal shipping cost per kit. CSV export. Data source: shipments_outbound_items joined to shipments_outbound grouped by origin_warehouse_id.
4. [x] Implement COGS/Margin Analysis section (admin-only — hidden for non-admin roles): table (product SKU+name, units sold, revenue, COGS using effective batch cost, gross margin USD + %). Monthly total gross margin trend chart. Implement Payment Method Breakdown section: donut chart of verified incoming order_payments grouped by asset+network. Table: asset+network, tx count, total USD received, avg USD per tx.

### Settings Page
1. [x] Build the Settings page (admin-only nav item). Warehouses section: table (name, city, is_active toggle). "Add Warehouse" form (name required+unique, full address, notes). Deactivating hides from pickers but keeps history.
2. [x] Warehouse Shipping Rate Plans section: table sorted by effective_date desc (effective_date, base_kits, base_price_usd, tier_kits, tier_price_usd, created_by, notes) with current active plan highlighted. "Add New Plan" form (effective_date must be today or future, all rate fields, notes). Plans are immutable once created. Calculator widget: enter kit count → show cost using current active plan formula.
3. [x] Receive Wallets section: table (asset, network, address, label, is_active toggle). "Add Wallet" form with asset+network dropdown (only valid combinations: USDC/ethereum, USDC/solana, USDT/ethereum, USDT/solana, ETH/ethereum, SOL/solana, BTC/bitcoin). Validate no duplicate active (asset, network) pairs. Free Order Reasons section: table (label, description, is_active toggle). "Add Reason" form (label unique+required, description optional). Labels immutable once used on any order.
4. [x] Reorder Planning section: single numeric input for `reorder_cover_days` (default 60) stored as an app setting (a small config table or hardcoded row). User Management section: table of user_profiles joined to UI Bakery users (display name, email, role, assigned warehouse if applicable, avatar preview). "Add User" form: pick existing UI Bakery user, set role, optionally assign warehouse if role=warehouse. "Edit User": change role, reassign warehouse, update display name, upload avatar. Display avatar as circular image; fall back to initials of display_name when no avatar.
