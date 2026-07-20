# Peptide Operations Manager — User Manual

*Covers all roles: Admin, Sales Rep, Warehouse, Logistics Coordinator.*

---

## 1. Getting Started

**Open the app** at the link your admin gave you and sign in with your UI Bakery account. What you see depends on the **role** assigned to your profile (Settings → Users, admin-managed). If your email hasn't been added as a user yet, the app blocks you with a message — ask your admin to add you.

**On your phone:** the app is fully mobile-friendly. Open the menu with the ☰ button at the top left; tap anywhere outside the menu (or pick a page) to close it. For one-tap access, use your browser's **"Add to Home Screen"** — the app then opens like a normal mobile app.

### The four roles at a glance

| | Admin | Sales Rep | Warehouse | Logistics |
|---|---|---|---|---|
| Create/edit orders & customers | ✔ | ✔ | — | view only |
| Ship orders (Mark Shipped) | ✔ | — | ✔ (own warehouse) | — |
| Receive inbound shipments | ✔ | — | ✔ (own warehouse) | — |
| Create/manage inbound shipments* | ✔ | — | — | ✔ |
| Transfers, counts, write-offs | ✔ | — | ✔ (own warehouse) | — |
| Reports | ✔ | all except Margin & Payments | throughput | ✔ (financial) |
| Commissions page | ✔ | — | — | view (no payments) |
| Settings | ✔ | — | — | — |
| Cost fields (unit costs, rate plans) | ✔ | hidden | hidden | visible |

\* The Logistics page is technically visible to every role — treat inbound shipment creation as logistics/admin territory.

Warehouse users are locked to their assigned warehouse everywhere — inventory, fulfillment, transfers, corrections, write-offs, and payables all scope automatically.

---

## 2. Core Concepts (read this once)

- **Products** are sold as **kits** (a kit = N vials of a given size). Each product belongs to a **category** and a **factory**.
- **Batches** are production lots of a product, with a batch number, manufacture date, net content (mg), and **QC status** (pending / passed / failed / quarantine). QC status is driven by test results: the newest HPLC + mass-spec results roll up automatically. **Only passed-QC stock can ship.**
- **Inventory** is tracked per product + batch + warehouse: *on hand*, *reserved* (claimed by confirmed orders), and *available* (on hand − reserved).
- **Order lifecycle:** `Quote → Confirmed → Shipped / Partially Shipped → Delivered` (or `Cancelled` before shipping). **An order can only be confirmed once a payment is verified** (paid or partially paid). Confirming an order reserves its stock.
- **Payment status** (`unpaid / partial paid / paid / refunded`) is calculated automatically from verified payments and refunds — you never set it by hand.
- **Fulfillment source** is per line item: **Warehouse** (ships from your stock) or **China Direct** (ships from the factory).

---

## 3. Sales Reps — Orders & Customers

### Creating an order (Sales Orders → New Order)

1. **Customer:** start typing a name. If they don't exist, the dropdown offers **"Create new customer"** right there.
2. **Line items:** pick products from the dropdown (it lists all active products). If a product has multiple batches in stock you can **pin a specific batch**. Set quantity; price fills from the product's list price and can be overridden manually.
3. **Fulfillment warehouse:** the app suggests the warehouse that can fill the whole order (most stock wins ties). You can override it, or choose **Split** to assign a warehouse per line.
4. **Payment:** add the crypto payment — the correct **wallet address displays with a Copy button** for the coin you pick. Leave "verified" on if the payment has landed; the order then **confirms in one step** when you save. If payment isn't verified yet, it saves as a **Quote**.
5. **Free orders:** tick Free Order (below the payment section) and pick a reason. Free/$0 orders skip the payment gate.

**Why did my order save as a quote?** The payment wasn't verified. Verify it later on the order's Payments panel — the Confirm button unlocks once payment status shows paid/partial paid.

### Managing orders

- Click any order row to open the **order drawer**: edit line items, ship-to address, discount, and shipping charge until lines ship (every change is audit-logged). Shipped lines are locked.
- **Tracking block:** once shipped, carrier + tracking (with copy button), live tracking status, and the **shipping label PDF** if one was bought through the app.
- **Refunds:** record refund tasks on the order; verified refunds flow into payment status automatically.
- **Cancel** is available from quote, confirmed, or partially shipped (not after everything has shipped); it releases the remaining reserved stock.

### Customers

Customers page: search, VIP and blocked flags, lifetime value, order history, and interaction notes. Opening an order from a customer's history opens the full order drawer.

### Your commissions

Rep commission balances are tracked on the Commissions page, which is admin/logistics territory — ask your admin for your earned/paid balance. Your crypto payout addresses (set by the admin under Settings → Users) are displayed to whoever records your payment.

---

## 4. Warehouse Staff — Shipping & Stock

Everything on the Warehouse page is scoped to **your** warehouse automatically.

### Fulfillment queue (Warehouse → Fulfillment)

The tab shows a **red badge with the number of orders waiting** to ship. Each order card shows the lines to ship, shortage warnings (⚠ with how many are actually shippable), and which warehouses hold stock. Tap the order number to view full order details (read-only ship-to, items, etc.).

A **mixed order** (lines assigned to different warehouses) appears for each involved warehouse — ship your line(s); the other warehouse ships theirs.

### Mark Shipped

1. Tap **Mark Shipped** on an order. The dialog shows the **full ship-to address with a Copy button** for label-making.
2. **Allocations:** the app pre-fills which batch/warehouse each line ships from (reserved stock first, then pinned batches, then oldest batch first). Adjust or split lines across batches if needed. Lines pinned to another warehouse are *not* auto-filled for you — allocate them manually only if you mean to.
3. **Label:** either type carrier + tracking number manually, or — if your warehouse has a Shippo key — use the **Shippo panel**: enter parcel size/weight → **Get rates** → pick one → **Buy label**. Carrier and tracking fill in automatically and the label PDF opens from a link. The label is billed to your warehouse's own Shippo account.
4. **Confirm.** Inventory decrements, reservations release, the shipment appears on the order, and your shipping payable accrues.

If you bought a label and then close without confirming, the app warns you — the label is real money; either confirm the shipment or void the label in Shippo.

### Receiving inbound shipments (Warehouse → In-Transit)

When a shipment to your warehouse arrives, open it and **Receive** each line with the quantity actually received. Shortages are flagged as discrepancies and — with the auto write-off toggle on (the default) — recorded as receipt-shortage write-offs. Receiving credits your inventory immediately.

### Transfers (Warehouse → Transfers)

- **Send:** create a transfer from your warehouse to another (stock moves to in-transit).
- **Receive:** only the destination warehouse can receive; enter received quantity — shortfalls flag a discrepancy and can be written off as lost in transit.
- **Cancel:** only the source warehouse can cancel an unsent/unreceived transfer (stock returns).

### Counts & write-offs (Warehouse → Activity / batch pages)

- **Count corrections:** record physical count differences; the log shows every adjustment.
- **Write-offs:** damaged/lost/expired stock, with reason and optional photo evidence. A write-off that would cut into stock reserved for confirmed orders is blocked (the Activity-tab write-off dialog lists the affected orders).

### Getting paid (Warehouse → Payables)

Payables is a **ledger**: what your warehouse has earned in shipping costs (per the rate plan), what's been paid, and the open balance, with per-shipment detail. There is no per-shipment "mark paid" — the admin records lump-sum payments on the Commissions page and your balance nets down.

---

## 5. Logistics Coordinator — Inbound Pipeline

You can see nearly everything an admin sees (Settings excluded), but your editing powers are inbound logistics and reports — order, customer, batch, and warehouse controls are read-only for you.

- **Logistics page:** create inbound shipments from factories — reference, factory, tracking, and per-line product/batch/quantity with a **destination warehouse and receive address** per line (a shipment can be split across addresses). Update status as it moves: freight forwarder → in transit → delivered.
- **Receiving is done by the destination warehouse**, not by you — you manage the pipeline up to arrival.
- **Reorder tab (Warehouse → Reorder):** suggested reorder quantities from 30-day sales velocity and the cover-days setting; "Create Inbound Shipment" pre-fills a new shipment from the suggestions.
- **Reports:** full financial reports access.

Everywhere else (orders, customers, batches) you have read-only visibility.

---

## 6. Admins — Configuration & Money

### Settings

- **Users:** add users by email, assign role and (for warehouse staff) their warehouse. Add **crypto payout addresses** per user — these display with Copy buttons wherever commissions are paid, so you can delegate payments.
- **Warehouses:** create warehouses with their ship-from address; expand a row to manage **receive addresses** (inbound lines can target any of them) and **Shippo** (see §7).
- **Receive wallets:** the payment addresses shown to reps in New Order, per coin/network. Only one active wallet per combination.
- **Free order reasons, product categories, factories, rate plans:** all managed here. The **rate plan** defines what you owe warehouses per shipment — a base price covering the first N kits plus a tier price per additional block of kits (all four numbers configurable; the newest plan in effect on the ship date applies).

### Money

- **Commissions page:** rep commissions and **warehouse shipping balances** side by side. Record lump-sum payments; payee payout addresses show with Copy buttons. All balances net earned − paid.
- **Dashboard:** open orders, unpaid balance, unverified payments, refunds owed, warehouse payables, low stock, and shipment issues at a glance.
- **Reports:** revenue, margin/COGS (admin-only), throughput, and CSV exports.

### Quality & traceability

- **Batches:** add test results per batch (HPLC, mass spec, sterility, endotoxin…); QC status rolls up automatically. Quarantine/release manually when needed.
- **Batch Traceability Report:** print-ready report of a batch's full history — tests, inbound shipments, inventory, consuming orders, write-offs, transfers.

### Order oversight

Admins can do everything reps can, plus: order for blocked customers (with an override note), edit after confirmation, view the full **audit log** on every order, and manage refund verification. Note the payment gate has no override — even admins confirm orders only once a payment is verified (free/$0 orders excepted).

---

## 7. Shippo Shipping Labels & Tracking

- **Per-warehouse label buying:** each warehouse can store its own Shippo API key (Settings → Warehouses → expand → Shippo → Configure). With a key set, that warehouse's Mark Shipped dialog can quote live rates and buy labels billed to that warehouse's Shippo account. Keys are write-only (the app never redisplays them) and each warehouse's staff only ever receives their own key.
- **Your return address:** tap your name (top right) → **My Settings** to set a personal return address. When set (address line 1 + city + postal at minimum), labels *you* buy print it as the from/return address; left blank, labels use the warehouse's ship-from address. The Shippo panel shows which one will be used before you buy.
- **One tracking key for everything:** one warehouse's key (toggle "Use this key to track all shipped orders") is used read-only to track **every** shipped order regardless of origin.
- **Automatic delivery:** while an admin or logistics user has the app open, it checks tracking for all in-transit shipments (at most every 30 minutes each). When a carrier reports **delivered**, the shipment — and the order, once *all* its shipments are delivered — flips to **Delivered** automatically, with an audit-log entry. A **returned-to-sender** result auto-flags the shipment as an issue on the dashboard.
- Tracking supports USPS, UPS, FedEx, and DHL tracking numbers; "other" carriers must be updated manually.

---

## 8. Troubleshooting & FAQ

**I can't confirm an order.** The payment gate: a payment must be verified first (or the order must be free/$0). Verify the payment in the order drawer's Payments panel.

**An order isn't in my fulfillment queue.** The queue follows the warehouse switcher. Orders appear under the warehouse their lines are assigned to — or, with no assignment, wherever stock exists. Check "All Warehouses" (admins) or confirm the order's warehouse assignment.

**Stock shows available but won't ship.** Only **passed-QC** batches ship. Check the batch's QC status.

**A delivered order still says shipped.** Auto-delivery runs when an admin/logistics user loads the app — it catches up on next open. You can also set it manually from the order drawer.

**Numbers look wrong after someone else made changes.** Data loads when a page opens; reload the page to refresh.

**I bought a Shippo label but cancelled the dialog.** The label exists on Shippo but isn't recorded in the app. Re-do Mark Shipped and enter the tracking manually, or void the label in Shippo for a refund.

**Something's blocked and the message mentions reservations.** Confirmed orders hold their stock. Release it by shipping, cancelling, or editing the order that holds the reservation.
