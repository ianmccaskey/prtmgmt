# Commission Tracking Feature

## Sub-tasks

- [x] Migration: add sales_orders.sales_rep_user_profile_id + commission_payments ledger table (rep/warehouse), backfill seed orders round-robin
- [x] SQL actions: listRepBalances, listRepCommissionOrders, listWarehouseBalances, listWarehouseCommissionShipments, recordCommissionPayment, listCommissionPayments, getCommissionSummary, listSalesReps
- [x] CommissionsPage with 3 tabs: Sales Rep Commissions (balances + drilldown + Record Payment), Warehouse Commissions (balances + drilldown + Record Payment), Payment Ledger & Reports (KPIs + date-filterable ledger + CSV export)
- [x] Wire /commissions route + sidebar nav item (admin only) + Home dashboard quick-link
- [x] New Order form: Sales Rep selector; Order Detail drawer: view/edit assigned sales rep
- [x] Lint clean
