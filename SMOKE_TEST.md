# Smoke Test Script

Run after each UI Bakery sync. Prereqs: apply pending migrations in
`src/migrations/` (everything after the entries in `applied.txt`), then add
your own login email under **Settings → Users & Planning → User Management**
(role: admin) — until you do, the app runs in bootstrap-admin mode with a
warning banner.

## 1. Roles & access
- [ ] Log in with a profile-linked email → banner gone, name + role chip in header.
- [ ] Set your profile role to `sales_rep` (SQL or a second admin): Settings/Commissions nav hidden; direct `/settings` shows "no access"; product cost fields hidden; Reports has no Margin tab.
- [ ] Set role to `warehouse` + assign warehouse: locked warehouse switcher, no Customers/New Order, Reports shows throughput only (own warehouse, no cost columns).
- [ ] Log in with an email that has NO profile (after step 1) → hard "account isn't set up" stop, no admin fallback.

## 2. Order lifecycle + reservations
- [ ] New Order (warehouse-sourced line, qty within stock) → Confirm. Check Warehouse → Inventory: reserved went up.
- [ ] `inventory_reservations` has ledger rows for the order.
- [ ] Edit the line qty in the drawer → reservation follows. Switch line to China-Direct → reservation released; switch back → re-reserved.
- [ ] Cancel the order → reservations released, audit row written.
- [ ] Save-as-draft works (no reservation); drawer "Confirm Order" reserves.
- [ ] Free order ($0 total) derives payment_status = paid.

## 3. Fulfillment (Mark Shipped)
- [ ] Warehouse → Fulfillment: confirmed order appears; gap highlighting on a product with insufficient stock.
- [ ] Mark Shipped: FIFO defaults to oldest passed-QC batch; override the split; carrier + tracking required per warehouse.
- [ ] After confirm: inventory on-hand AND reserved decreased; `outbound_pick` rows in Activity; shipment in Payables as owed; internal cost matches rate-plan math; order status shipped; pending notification row; tracking hero in the order drawer.
- [ ] Partial ship (partial_fulfillment_allowed=true): order → partially_shipped, remaining lines stay in queue.

## 4. Payments
- [ ] Add payment (pending) → payment_status unchanged. Mark Verified → recomputes (partial_paid or paid).
- [ ] Refund task → Mark Sent → Mark Verified → task verified; over-refund flips order to refunded when net ≤ 0.

## 5. QC roll-up
- [ ] Add passing HPLC + mass-spec tests → batch flips to passed, purity denormalized.
- [ ] Add a failing newest HPLC → failed. Quarantine overrides; Release re-runs the roll-up.
- [ ] Quarantined/failed batches excluded from Mark Shipped candidates and reservations.

## 6. Transfers & write-offs
- [ ] New transfer → source on-hand down, `transfer_out_initiated` logged. Guard: try transferring more than available → inline error.
- [ ] Receive short (e.g. 8 of 10) with note → destination +8, discrepancy note on transfer, `transfer_in_received` logged, optional lost write-off recorded.
- [ ] Cancel an initiated transfer → source restored, `transfer_cancelled` logged.
- [ ] Write-off more than unreserved stock → blocked with impacted-orders list.
- [ ] Count correction → row + log, on-hand set.

## 7. Products & reports
- [ ] Change list price → price history row + chart updates. Bulk select + flat-$ change → history rows for each.
- [ ] Factory locked once batches exist; editable on a batchless product.
- [ ] Reorder tab math matches tooltip; "Create Inbound Shipment" pre-fills Logistics dialog.
- [ ] Batch Traceability Report renders all sections; browser print produces a clean PDF.
- [ ] Receive inbound shipment partially → inventory up, discrepancy write-off when toggled, delivered only when all lines received.

## 8. Uploads (after configuring S3 per docs/S3_SETUP.md)
- [ ] Settings → Integrations: save the presign endpoint.
- [ ] Product image, user avatar, write-off evidence upload → S3 URL stored, renders back.
- [ ] Without endpoint: small image uploads store inline (data URL) and render.
