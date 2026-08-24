import React, { useEffect, useRef, useState } from 'react';
import { rows as asRows } from '@/lib/rows';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getVendorBalance from '@/actions/commissions/getVendorBalance';
import listVendorPayments from '@/actions/commissions/listVendorPayments';
import recordCommissionPayment from '@/actions/commissions/recordCommissionPayment';
import listRepBalances from '@/actions/commissions/listRepBalances';
import listWarehouseBalances from '@/actions/commissions/listWarehouseBalances';
import executeSettlementAtomic from '@/actions/commissions/executeSettlementAtomic';
import listSettlements from '@/actions/commissions/listSettlements';
import listSettlementPayments from '@/actions/commissions/listSettlementPayments';
import getWalletExpectedInflows from '@/actions/commissions/getWalletExpectedInflows';
import listOperatingExpenses from '@/actions/commissions/listOperatingExpenses';
import createOperatingExpense from '@/actions/commissions/createOperatingExpense';
import deleteOperatingExpense from '@/actions/commissions/deleteOperatingExpense';
import listExpenseReimbursements from '@/actions/commissions/listExpenseReimbursements';
import listExpenseBalances from '@/actions/commissions/listExpenseBalances';
import listPayoutAddressesForPayee from '@/actions/commissions/listPayoutAddressesForPayee';
import listUserProfiles from '@/actions/settings/listUserProfiles';
import listWalletCyclePayments from '@/actions/commissions/listWalletCyclePayments';
import getAppSetting from '@/actions/settings/getAppSetting';
import upsertAppSetting from '@/actions/settings/upsertAppSetting';
import autoRepairPaymentAsset from '@/actions/orders/autoRepairPaymentAsset';
import { getOnChainBalance, getTokenDeposits, getTxDeposit, OnChainDeposit } from '@/lib/moralis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink, Factory, Receipt, RefreshCw, Stamp, Trash2, Wallet as WalletIcon } from 'lucide-react';

type VendorBalance = {
  last_settlement_id: number | null; last_settled_at: string | null;
  collected_usd: number; rep_commissions_usd: number; warehouse_earned_usd: number;
  expenses_usd: number; vendor_share_usd: number; vendor_paid_usd: number;
  balance_owed_usd: number; carried_adjustment_usd: number;
};
type VendorPayment = { id: number; amount_usd: number; paid_at: string; note: string | null; tx_hash: string | null; paid_by: string | null };
type Settlement = {
  id: number; settled_at: string; collected_usd: number; rep_commissions_usd: number;
  warehouse_earned_usd: number; expenses_usd: number; vendor_share_usd: number;
  note: string | null; created_by: string | null;
};
type OperatingExpense = {
  id: number; expense_date: string; category: string; description: string;
  amount_usd: number; payee_user_profile_id: number; payee_name: string | null;
  created_by: string | null; created_at: string; settled: boolean;
};
type ExpenseReimbursement = { id: number; amount_usd: number; paid_at: string; note: string | null; tx_hash: string | null; paid_by: string | null; payee_name: string | null; settled: boolean };
type ExpenseBalance = {
  user_profile_id: number; display_name: string;
  expenses_total_usd: number; reimbursed_total_usd: number; balance_owed_usd: number;
};

const EXPENSE_CATEGORIES = [
  { value: 'product_testing', label: 'Product Testing' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'other', label: 'Other' },
] as const;
const expenseCategoryLabel = (v: string) => EXPENSE_CATEGORIES.find(c => c.value === v)?.label ?? v;
type SettlementPayment = {
  id: number; payee_type: 'sales_rep' | 'warehouse' | 'vendor' | 'expense'; amount_usd: number;
  paid_at: string; note: string | null; tx_hash: string | null; at_settlement: boolean;
  sales_rep_name: string | null; warehouse_name: string | null;
};

const money = (v: number | string) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type WalletInflow = {
  id: number | null; asset: string; network: string; address: string; label: string;
  expected_usd: number; payments_count: number;
};
type ChainCheck = { amount?: number; supported?: boolean; error?: string };
type CyclePayment = {
  id: number; sales_order_id: number; amount_usd: number; tx_hash: string | null; direction: string;
  recorded_at: string; order_number: string; customer: string;
};

/** Unmatched on-chain deposits below this are listed as dust, not alarms. */
const UNMATCHED_DEPOSIT_FLOOR_USD = 20;

const STABLECOINS = ['USDC', 'USDT'];

/** Block-explorer TX link for the chains the wallet check supports. */
const txExplorerUrl = (network: string, hash: string) =>
  network === 'ethereum' ? `https://etherscan.io/tx/${hash}`
  : network === 'solana' ? `https://solscan.io/tx/${hash}`
  : null;

/**
 * Match recorded payments against on-chain deposits: by tx hash first, then
 * greedily by exact amount (2dp). Returns which records found a deposit and
 * which deposits nothing accounts for.
 */
function reconcile(paymentsIn: CyclePayment[], deposits: OnChainDeposit[]) {
  // Refunds are OUTGOING — matching them against incoming deposits would
  // both mislabel the refund and hide a real unrecorded deposit.
  const incoming = paymentsIn.filter(p => p.direction !== 'refund');
  const unusedDeposits = [...deposits];
  const take = (pred: (d: OnChainDeposit) => boolean) => {
    const i = unusedDeposits.findIndex(pred);
    return i >= 0 ? unusedDeposits.splice(i, 1)[0] : null;
  };
  const matches = new Map<number, OnChainDeposit | null>();
  for (const p of incoming) {
    const hash = (p.tx_hash || '').trim().toLowerCase();
    matches.set(p.id, hash ? take(d => d.txHash.toLowerCase() === hash) : null);
  }
  for (const p of incoming) {
    if (matches.get(p.id)) continue;
    matches.set(p.id, take(d => Math.abs(d.amount - Number(p.amount_usd)) < 0.005));
  }
  return { matches, extraDeposits: unusedDeposits };
}

/**
 * Live on-chain balances (Moralis) vs what this cycle's verified payments
 * say each receive wallet should hold. On-demand — checks run only when
 * the button is clicked, keeping Moralis quota usage tiny.
 */
function OnChainWalletCheck({ division }: { division: string }) {
  const [keyRaw] = useLoadAction(getAppSetting, [], { key: 'moralis_api_key' });
  const moralisKey = String(asRows<{ value: string }>(keyRaw)[0]?.value ?? '');
  // Optional Helius key: Solana deposit history works without it via the
  // public RPC, but Helius is far less rate-limited.
  const [heliusRaw] = useLoadAction(getAppSetting, [], { key: 'helius_api_key' });
  const heliusKey = String(asRows<{ value: string }>(heliusRaw)[0]?.value ?? '');
  const [inflowsRaw, inflowsLoading, , reloadInflows] = useLoadAction(getWalletExpectedInflows, [division], { division });
  const allInflows = asRows<WalletInflow>(inflowsRaw);
  const wallets = allInflows.filter(w => w.id != null);
  const unassigned = allInflows.find(w => w.id == null) || null;
  const [checks, setChecks] = useState<Record<number, ChainCheck>>({});
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  // Reconciliation drill-down: the payment records behind one wallet's
  // expected figure, auto-matched against on-chain deposits (EVM only).
  const [openWalletId, setOpenWalletId] = useState<number | null>(null);
  const openWallet = wallets.find(w => Number(w.id) === openWalletId) || null;
  const [cycleRaw, cycleLoading, , reloadCycle] = useLoadAction(listWalletCyclePayments, [openWalletId], { wallet_id: openWalletId ?? 0 }, { enabled: openWalletId != null });
  const cyclePayments = asRows<CyclePayment>(cycleRaw);
  // Keyed by wallet id so every expand refetches the cycle start (a
  // settlement while a row sat open would otherwise leave it stale).
  const [balForCycle] = useLoadAction(getVendorBalance, [openWalletId ?? 0, division], { division }, { enabled: openWalletId != null });
  // Wallet ids belong to one division — an expanded row must not survive a
  // division switch.
  useEffect(() => { setOpenWalletId(null); }, [division]);
  const cycleStart = asRows<{ last_settled_at: string | null }>(balForCycle)[0]?.last_settled_at ?? null;
  const [deposits, setDeposits] = useState<OnChainDeposit[] | null | 'loading' | 'error'>(null);

  useEffect(() => {
    setDeposits(null);
    if (openWallet == null) return;
    // EVM history needs the Moralis key; Solana works keyless via the
    // public RPC (Helius when configured).
    if (openWallet.network === 'ethereum' && !moralisKey) return;
    if (openWallet.network !== 'ethereum' && openWallet.network !== 'solana') return;
    let alive = true;
    setDeposits('loading');
    getTokenDeposits(moralisKey, openWallet.asset, openWallet.network, openWallet.address, cycleStart, heliusKey || null)
      .then(d => { if (alive) setDeposits(d); })
      .catch(() => { if (alive) setDeposits('error'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWalletId, moralisKey, heliusKey, cycleStart]);

  // Resolving unmatched records: a payment whose hash isn't in the cycle-
  // windowed deposit list gets a direct by-hash lookup before it's called a
  // problem. Step 1 (all users, read-only): verify the TX on THIS wallet
  // regardless of date — a payment recorded weeks late points at a deposit
  // from before the cycle started, which is real money in the wrong window,
  // not a phantom. Step 2 (admins only): if the TX isn't on this wallet at
  // all, check the sibling stablecoin's wallet (USDC↔USDT, same network);
  // when the chain confirms BOTH the hash and the recorded amount there,
  // auto-repair via the atomic repoint+audit action. Hashes shared by more
  // than one record stay manual (ambiguous); settled-cycle and double-claim
  // refusals are surfaced, never silently skipped.
  const { profileId, isAdmin } = useAppUser();
  const [doAutoRepair] = useMutateAction(autoRepairPaymentAsset);
  // Keyed by wallet+payment so a payment repaired onto the sibling wallet
  // gets a fresh lookup when THAT wallet's drill-down opens.
  const resolveTried = useRef<Set<string>>(new Set());
  const [autoRepaired, setAutoRepaired] = useState<{ order_number: string; to: string }[]>([]);
  const [repairBlocked, setRepairBlocked] = useState<string[]>([]);
  type TxLookup = { status: 'found' | 'notfound'; amount?: number; at?: string | null };
  const [txLookups, setTxLookups] = useState<Record<number, TxLookup>>({});
  // resolveTried clears with the notices/lookups: it only needs to hold off
  // duplicate work while a drill-down sits open (repair idempotence is
  // enforced by the SQL action itself), and keeping it across a close/reopen
  // would strand reopened rows on "verifying TX…" forever.
  useEffect(() => { setAutoRepaired([]); setRepairBlocked([]); setTxLookups({}); resolveTried.current.clear(); }, [openWalletId]);

  useEffect(() => {
    if (openWallet == null || !Array.isArray(deposits) || cyclePayments.length === 0) return;
    const tryKey = (pid: number) => `${openWallet.id}:${pid}`;
    const recNow = reconcile(cyclePayments, deposits);
    const hashCounts = new Map<string, number>();
    for (const p of cyclePayments) {
      const h = (p.tx_hash || '').trim().toLowerCase();
      if (h) hashCounts.set(h, (hashCounts.get(h) || 0) + 1);
    }
    const candidates = cyclePayments.filter(p =>
      p.direction !== 'refund'
      && (p.tx_hash || '').trim() !== ''
      && !recNow.matches.get(p.id)
      && !resolveTried.current.has(tryKey(p.id)));
    if (candidates.length === 0) return;
    // Mark up front so overlapping effect runs can't double-fire; unmark on
    // transient failures so the next expand can retry that payment.
    candidates.forEach(p => resolveTried.current.add(tryKey(p.id)));
    const siblingAsset = openWallet.asset === 'USDC' ? 'USDT' : 'USDC';
    const sibling = STABLECOINS.includes(openWallet.asset)
      ? wallets.find(s => s.asset === siblingAsset && s.network === openWallet.network && s.id != null) || null
      : null;
    let alive = true;
    (async () => {
      let changed = false;
      for (const p of candidates) {
        const hash = String(p.tx_hash).trim();
        // Step 1: the recorded TX, on the recorded wallet, any date.
        let ownHit: OnChainDeposit | null;
        try {
          ownHit = await getTxDeposit(moralisKey, openWallet.asset, openWallet.network, openWallet.address, hash, heliusKey || null);
        } catch {
          resolveTried.current.delete(tryKey(p.id));
          continue;
        }
        if (ownHit) {
          const hit = ownHit;
          if (alive) setTxLookups(prev => ({ ...prev, [p.id]: { status: 'found', amount: hit.amount, at: hit.at } }));
          continue;
        }
        // Step 2: wrong-stablecoin check against the sibling wallet.
        if (isAdmin && sibling && (hashCounts.get(hash.toLowerCase()) || 0) === 1) {
          let sibHit: OnChainDeposit | null;
          try {
            sibHit = await getTxDeposit(moralisKey, siblingAsset, openWallet.network, String(sibling.address), hash, heliusKey || null);
          } catch {
            resolveTried.current.delete(tryKey(p.id));
            continue;
          }
          if (sibHit) {
            if (Math.abs(sibHit.amount - Number(p.amount_usd)) >= 0.005) {
              // Right hash, wrong amount: probably the same mix-up plus an
              // amount error, but that's two corrections — too much to
              // apply unasked.
              if (alive) {
                setRepairBlocked(prev => [...prev,
                  `${p.order_number}: recorded TX was found on the ${siblingAsset} wallet but carried ${money(sibHit.amount)}, not the recorded ${money(p.amount_usd)} — review it manually with Fix Wallet / Correct Amount.`]);
                setTxLookups(prev => ({ ...prev, [p.id]: { status: 'notfound' } }));
              }
              continue;
            }
            let res: unknown[];
            try {
              // Deliberately NOT gated on `alive`: once the mistake is
              // confirmed the atomic repair (repoint + audit together)
              // should land even if the user navigates away mid-flight;
              // only UI updates are gated.
              res = await doAutoRepair({
                paymentId: p.id, asset: siblingAsset, network: openWallet.network,
                walletId: sibling.id, userId: profileId,
                // Proof re-asserted server-side: the row must still carry
                // this hash and amount at update time, not just when the
                // UI checked.
                txHash: hash, amountUsd: Number(p.amount_usd),
                note: `Auto-repair (wallet check): recorded TX ${hash} was confirmed on-chain as a ${siblingAsset} deposit of ${sibHit.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} to ${sibling.label} — asset corrected from ${openWallet.asset}`,
              }) as unknown[];
            } catch {
              resolveTried.current.delete(tryKey(p.id));
              continue;
            }
            if (!res || res.length === 0) {
              if (alive) {
                setRepairBlocked(prev => [...prev,
                  `${p.order_number}: TX ${hash.slice(0, 14)}… is confirmed as a ${siblingAsset} deposit, but the record can't be moved automatically (stamped settlement cycle, or a payment on that wallet already claims this TX) — review it manually.`]);
                setTxLookups(prev => ({ ...prev, [p.id]: { status: 'notfound' } }));
              }
              continue;
            }
            changed = true;
            if (alive) setAutoRepaired(prev => [...prev, { order_number: p.order_number, to: `${siblingAsset} · ${openWallet.network}` }]);
            continue;
          }
        }
        if (alive) setTxLookups(prev => ({ ...prev, [p.id]: { status: 'notfound' } }));
      }
      if (changed && alive) { reloadCycle(); reloadInflows(); }
    })();
    return () => { alive = false; };
    // cycleRaw (not the derived array) keeps the dep identity stable per fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWalletId, deposits, cycleRaw, isAdmin]);

  const runCheck = async () => {
    if (!moralisKey) return;
    setChecking(true);
    const next: Record<number, ChainCheck> = {};
    for (const w of wallets) {
      try {
        const b = await getOnChainBalance(moralisKey, w.asset, w.network, w.address);
        next[Number(w.id)] = { amount: b.amount, supported: b.supported };
      } catch (e: unknown) {
        next[Number(w.id)] = { error: e instanceof Error ? e.message : 'check failed' };
      }
      setChecks({ ...next });
    }
    setCheckedAt(new Date());
    setChecking(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-emerald-600" /> On-Chain Wallet Check
        </CardTitle>
        <div className="flex items-center gap-2">
          {checkedAt && <span className="text-xs text-muted-foreground">checked {checkedAt.toLocaleTimeString()}</span>}
          <Button size="sm" variant="outline" onClick={runCheck} disabled={checking || !moralisKey}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? 'animate-spin' : ''}`} /> {checking ? 'Checking…' : 'Check Balances'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!moralisKey ? (
          <p className="text-sm text-muted-foreground p-4">
            Add your Moralis API key under Settings → Wallets to compare live on-chain balances against
            what this cycle expects.
          </p>
        ) : inflowsLoading ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wallet</TableHead>
                <TableHead className="text-right">Expected this cycle</TableHead>
                <TableHead className="text-right">On-chain</TableHead>
                <TableHead className="text-right">Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map(w => {
                const c = checks[Number(w.id)];
                const isStable = STABLECOINS.includes(w.asset);
                const diff = c?.amount != null && isStable ? c.amount - Number(w.expected_usd) : null;
                const isOpen = openWalletId === Number(w.id);
                const rec = isOpen && Array.isArray(deposits) ? reconcile(cyclePayments, deposits) : null;
                return (
                  <React.Fragment key={w.id}>
                  <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setOpenWalletId(isOpen ? null : Number(w.id))}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-1">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        {w.asset} · {w.network}
                      </div>
                      <div className="text-xs text-muted-foreground">{w.label} — <span className="font-mono">{w.address.slice(0, 6)}…{w.address.slice(-4)}</span></div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(w.expected_usd)}
                      <div className="text-xs text-muted-foreground">{w.payments_count} payment{w.payments_count === 1 ? '' : 's'}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {!c ? <span className="text-muted-foreground">—</span>
                        : c.error ? <span className="text-red-600 text-xs">{c.error}</span>
                        : c.supported === false ? <span className="text-muted-foreground text-xs">not supported (BTC)</span>
                        : <>{Number(c.amount).toLocaleString('en-US', { maximumFractionDigits: 6 })} {w.asset}</>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {diff == null ? (
                        c && c.supported !== false && !c.error && !isStable
                          ? <span className="text-xs text-muted-foreground">compare manually (non-stablecoin)</span>
                          : <span className="text-muted-foreground">—</span>
                      ) : Math.abs(diff) <= 1 ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">matches</Badge>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${diff > 0 ? 'text-blue-600 border-blue-300' : 'text-red-600 border-red-300'}`}>
                          {diff > 0 ? '+' : '−'}{money(Math.abs(diff))}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/20 p-0">
                        <div className="px-4 py-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Payment records behind this wallet's expected figure ({cyclePayments.length} this cycle)
                          </p>
                          {cycleLoading ? <Skeleton className="h-10 w-full" /> : (
                            <div className="space-y-1">
                              {cyclePayments.map(p => {
                                const dep = rec?.matches.get(p.id) || null;
                                return (
                                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-1 last:border-0">
                                    <span className="min-w-0">
                                      <span className="font-mono text-blue-600">{p.order_number}</span>
                                      <span className="ml-1.5">{p.customer}</span>
                                      <span className="block text-xs text-muted-foreground">
                                        {new Date(p.recorded_at).toLocaleString()}
                                        {p.tx_hash ? <> · TX <span className="font-mono break-all">{String(p.tx_hash).slice(0, 14)}…</span></> : ' · no TX recorded'}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      {rec && (
                                        p.direction === 'refund' ? (
                                          <Badge variant="outline" className="text-xs text-muted-foreground">refund — outgoing, not matched</Badge>
                                        ) : dep ? (
                                          // The TX exists on-chain but may have carried a different
                                          // amount than what was recorded — that mismatch IS the
                                          // discrepancy, so surface it, don't hide it behind a ✓.
                                          Math.abs(dep.amount - Number(p.amount_usd)) >= 0.01 ? (
                                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300" title={`TX ${dep.txHash}`}>
                                              on-chain {dep.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ≠ recorded {money(p.amount_usd)}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs text-green-600 border-green-300" title={`on-chain ${dep.amount} @ ${dep.at || ''}`}>on-chain ✓</Badge>
                                          )
                                        ) : (() => {
                                          // Unmatched in the cycle window — the by-hash lookup decides
                                          // whether it's a pre-cycle deposit or genuinely missing.
                                          const hasHash = (p.tx_hash || '').trim() !== '';
                                          const lk = txLookups[p.id];
                                          if (!hasHash || lk?.status === 'notfound') {
                                            return <Badge variant="outline" className="text-xs text-red-600 border-red-300">not found on-chain</Badge>;
                                          }
                                          if (!lk) {
                                            return <Badge variant="outline" className="text-xs text-muted-foreground">verifying TX…</Badge>;
                                          }
                                          const preCycle = lk.at != null && cycleStart != null && Date.parse(lk.at) < Date.parse(cycleStart);
                                          const when = lk.at ? new Date(lk.at).toLocaleDateString() : 'unknown date';
                                          if (lk.amount != null && Math.abs(lk.amount - Number(p.amount_usd)) >= 0.01) {
                                            return (
                                              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300" title={`TX ${p.tx_hash}`}>
                                                on-chain {lk.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ≠ recorded {money(p.amount_usd)}{preCycle ? ` — arrived ${when}, before this cycle` : ''}
                                              </Badge>
                                            );
                                          }
                                          return preCycle ? (
                                            <Badge variant="outline" className="text-xs text-sky-700 border-sky-300" title={`TX ${p.tx_hash}`}>
                                              on-chain ✓ — arrived {when}, before this cycle
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs text-green-600 border-green-300" title={`TX ${p.tx_hash}`}>on-chain ✓ (direct lookup)</Badge>
                                          );
                                        })()
                                      )}
                                      <span className="tabular-nums font-medium">{p.direction === 'refund' ? '−' : ''}{money(p.amount_usd)}</span>
                                    </span>
                                  </div>
                                );
                              })}
                              {cyclePayments.length === 0 && <p className="text-sm text-muted-foreground">No payment records this cycle.</p>}
                            </div>
                          )}
                          {autoRepaired.length > 0 && (
                            <div className="text-xs text-green-700 bg-green-50 rounded p-2 space-y-0.5">
                              <p className="font-medium">
                                Auto-repaired {autoRepaired.length} record{autoRepaired.length === 1 ? '' : 's'} — the recorded TX was
                                confirmed on the other stablecoin&apos;s wallet (audit-logged on the order):
                              </p>
                              {autoRepaired.map((r, i) => (
                                <p key={i}><span className="font-mono">{r.order_number}</span> → moved to {r.to}</p>
                              ))}
                            </div>
                          )}
                          {repairBlocked.map((msg, i) => (
                            <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded p-2">{msg}</p>
                          ))}
                          {rec && rec.extraDeposits.length > 0 && (() => {
                            // A wallet collects real dust — swap change, fee refunds,
                            // test sends. Alarming on those buries the deposits that
                            // actually explain an imbalance, so anything under the
                            // floor rolls up into one summary line instead.
                            const big = rec.extraDeposits.filter(d => d.amount >= UNMATCHED_DEPOSIT_FLOOR_USD);
                            const dust = rec.extraDeposits.filter(d => d.amount < UNMATCHED_DEPOSIT_FLOOR_USD);
                            const bigTotal = big.reduce((s, d) => s + d.amount, 0);
                            const dustTotal = dust.reduce((s, d) => s + d.amount, 0);
                            return (
                              <div className="space-y-1">
                                {big.length > 0 && (
                                  <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 space-y-1">
                                    <p className="font-medium">
                                      On-chain deposits with no matching record — {big.length} totaling {money(bigTotal)}:
                                    </p>
                                    {big.map(d => {
                                      const url = txExplorerUrl(w.network, d.txHash);
                                      return (
                                        <p key={d.txHash} className="flex flex-wrap items-baseline gap-x-2">
                                          <span className="tabular-nums font-semibold shrink-0">{money(d.amount)}</span>
                                          {d.at && <span className="shrink-0">{new Date(d.at).toLocaleDateString()}</span>}
                                          {url ? (
                                            <a
                                              href={url} target="_blank" rel="noreferrer"
                                              onClick={e => e.stopPropagation()}
                                              className="font-mono break-all text-blue-600 hover:underline inline-flex items-center gap-1"
                                              title={`View on ${w.network === 'ethereum' ? 'Etherscan' : 'Solscan'}`}
                                            >
                                              {d.txHash.slice(0, 18)}…<ExternalLink className="h-3 w-3 shrink-0" />
                                            </a>
                                          ) : (
                                            <span className="font-mono break-all text-amber-700/70">{d.txHash.slice(0, 18)}…</span>
                                          )}
                                        </p>
                                      );
                                    })}
                                  </div>
                                )}
                                {dust.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {dust.length} unmatched deposit{dust.length === 1 ? '' : 's'} under {money(UNMATCHED_DEPOSIT_FLOOR_USD)} (total {money(dustTotal)}) treated
                                    as dust and not listed.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          {deposits === 'loading' && <p className="text-xs text-muted-foreground">Fetching on-chain deposits…</p>}
                          {deposits === 'error' && (
                            <p className="text-xs text-red-600">
                              Could not fetch on-chain deposits{w.network === 'solana'
                                ? heliusKey ? ' from Helius.' : ' — the public Solana RPC is rate-limited; add a Helius API key under Settings → Wallets and retry.'
                                : ' from Moralis.'}
                            </p>
                          )}
                          {deposits === null && w.network !== 'ethereum' && w.network !== 'solana' && (
                            <p className="text-xs text-muted-foreground">
                              Auto-matching isn&apos;t available for this chain — compare these records against the wallet&apos;s
                              history in a block explorer.
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            A wallet reads <span className="font-medium">under</span> when a recorded payment never arrived
                            (not found on-chain), arrived short, went to a different wallet, or was recorded with the wrong
                            asset/network. USDC↔USDT mix-ups are repaired automatically when the recorded TX is confirmed on
                            the other stablecoin&apos;s wallet. A record marked <span className="font-medium">before this
                            cycle</span> is real money verified by direct lookup — it just landed before the last Settle All,
                            so this cycle&apos;s balance still reads under by that amount (last cycle read over by the same).
                            <span className="font-medium"> Over</span> usually means an unrecorded deposit or pre-cycle
                            leftovers.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}
              {wallets.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-6">No active receive wallets.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {moralisKey && unassigned && (
          <p className="text-xs text-amber-700 bg-amber-50 border-t px-4 py-2">
            {money(unassigned.expected_usd)} across {unassigned.payments_count} verified row{unassigned.payments_count === 1 ? '' : 's'} this
            cycle {Number(unassigned.expected_usd) < 0 ? '(refunds included) ' : ''}isn&apos;t tied to any wallet — it affects the
            cycle total but no single wallet above.
          </p>
        )}
        {moralisKey && (
          <p className="text-xs text-muted-foreground px-4 pb-3 pt-2">
            Expected = verified payments assigned to each wallet this cycle (stablecoins compared 1 token ≈ $1;
            a positive difference usually means funds left from before, unrecorded income, or pending payments
            not yet verified). Refunds aren&apos;t tied to a wallet, so they appear in the unassigned line rather
            than reducing a specific wallet. Settlements empty the wallets, so both sides reset each cycle.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Operator-fronted costs (product testing, supplies…) reimbursed at
 * settlement as a fourth payee class. Entering an expense reduces the
 * vendor share; the cycle can't close until outstanding expenses are
 * reimbursed and recorded, exactly like rep and warehouse balances.
 */
function OperatingExpensesCard({ division, onChanged }: { division: string; onChanged: () => void }) {
  const { profileId, isAdmin } = useAppUser();
  const [expRaw, expLoading, , reloadExp] = useLoadAction(listOperatingExpenses, [division], { division });
  const [reimbRaw, , , reloadReimb] = useLoadAction(listExpenseReimbursements, [division], { division });
  const [expBalRaw, , , reloadExpBal] = useLoadAction(listExpenseBalances, [division], { division });
  const [profilesRaw] = useLoadAction(listUserProfiles, [], {});
  const allExpenses = asRows<OperatingExpense>(expRaw);
  const allReimbs = asRows<ExpenseReimbursement>(reimbRaw);
  // Current cycle only — anything before the last Settle All is settled
  // history (the cycle can't close otherwise) and collapses below.
  const expenses = allExpenses.filter(e => !e.settled);
  const reimbs = allReimbs.filter(r => !r.settled);
  const settledExpenses = allExpenses.filter(e => e.settled);
  const settledReimbs = allReimbs.filter(r => r.settled);
  const settledTotal = settledExpenses.reduce((s, e) => s + Number(e.amount_usd), 0);
  const [showSettled, setShowSettled] = useState(false);
  const expBalances = asRows<ExpenseBalance>(expBalRaw);
  const profiles = asRows<{ id: number; display_name: string }>(profilesRaw);
  const incurred = expenses.reduce((s, e) => s + Number(e.amount_usd), 0);
  const reimbursed = reimbs.reduce((s, r) => s + Number(r.amount_usd), 0);
  const outstanding = allExpenses.reduce((s, e) => s + Number(e.amount_usd), 0)
    - allReimbs.reduce((s, r) => s + Number(r.amount_usd), 0);

  const [doCreate] = useMutateAction(createOperatingExpense);
  const [doDelete] = useMutateAction(deleteOperatingExpense);
  const [doReimb] = useMutateAction(recordCommissionPayment);

  const [addOpen, setAddOpen] = useState(false);
  const [expDate, setExpDate] = useState('');
  const [expCat, setExpCat] = useState('product_testing');
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expPayee, setExpPayee] = useState('');
  const [addErr, setAddErr] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const [reimbOpen, setReimbOpen] = useState(false);
  const [reimbUser, setReimbUser] = useState('');
  const [reimbAmt, setReimbAmt] = useState('');
  const [reimbNote, setReimbNote] = useState('');
  const [reimbErr, setReimbErr] = useState('');
  const [reimbSaving, setReimbSaving] = useState(false);
  const [rowErr, setRowErr] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const balanceFor = (uid: string) => Number(expBalances.find(b => String(b.user_profile_id) === uid)?.balance_owed_usd ?? 0);
  const reloadAll = () => { reloadExp(); reloadReimb(); reloadExpBal(); onChanged(); };

  const handleAdd = async () => {
    const amt = Number(expAmt);
    if (!amt || amt <= 0) { setAddErr('Enter a valid amount.'); return; }
    if (!expDesc.trim()) { setAddErr('Describe the expense.'); return; }
    if (!expPayee) { setAddErr('Pick who gets reimbursed.'); return; }
    setAddSaving(true); setAddErr('');
    try {
      await doCreate({
        expense_date: expDate || null, category: expCat, description: expDesc.trim(),
        amount_usd: amt, division, created_by_user_id: profileId,
        payee_user_profile_id: Number(expPayee),
      });
      setAddOpen(false); setExpDate(''); setExpDesc(''); setExpAmt('');
      reloadAll();
    } catch (e: unknown) {
      setAddErr(e instanceof Error ? e.message : 'Failed to record expense');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id); setRowErr('');
    try {
      const res = await doDelete({ id }) as unknown[];
      if (!res || res.length === 0) {
        setRowErr('This expense can’t be removed — the payee’s recorded reimbursements would exceed their remaining expense total. Adjust with a new entry instead.');
        return;
      }
      reloadAll();
    } catch (e: unknown) {
      setRowErr(e instanceof Error ? e.message : 'Failed to remove expense');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReimburse = async () => {
    const amt = Number(reimbAmt);
    if (!amt || amt <= 0) { setReimbErr('Enter a valid amount.'); return; }
    if (!reimbUser) { setReimbErr('Pick who was reimbursed.'); return; }
    setReimbSaving(true); setReimbErr('');
    try {
      await doReimb({
        payee_type: 'expense', sales_rep_user_profile_id: Number(reimbUser), warehouse_id: null,
        amount_usd: amt, paid_by_user_id: profileId, note: reimbNote || null, division,
      });
      setReimbOpen(false); setReimbAmt(''); setReimbNote('');
      reloadAll();
    } catch (e: unknown) {
      setReimbErr(e instanceof Error ? e.message : 'Failed to record reimbursement');
    } finally {
      setReimbSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-violet-600" /> Operating Expenses
        </CardTitle>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setAddOpen(true); setAddErr(''); setExpPayee(profileId != null ? String(profileId) : ''); }}>
              Add Expense
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => {
                const firstOwed = expBalances.find(b => Number(b.balance_owed_usd) > 0.004);
                const uid = firstOwed ? String(firstOwed.user_profile_id) : (profileId != null ? String(profileId) : '');
                setReimbOpen(true); setReimbUser(uid);
                setReimbAmt(firstOwed ? Number(firstOwed.balance_owed_usd).toFixed(2) : '');
                setReimbNote(''); setReimbErr('');
              }}
              disabled={!expBalances.some(b => Number(b.balance_owed_usd) > 0.004)}>
              Record Reimbursement
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">Incurred (this cycle): <span className="text-foreground tabular-nums">{money(incurred)}</span></span>
          <span className="text-muted-foreground">Reimbursed (this cycle): <span className="text-foreground tabular-nums">{money(reimbursed)}</span></span>
          <span className="font-medium">Outstanding (incl. carried credits): <span className={`tabular-nums ${outstanding > 0.004 ? 'text-red-600' : 'text-green-700'}`}>{money(outstanding)}</span></span>
        </div>
        {expBalances.filter(b => Math.abs(Number(b.balance_owed_usd)) > 0.004).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {expBalances.filter(b => Math.abs(Number(b.balance_owed_usd)) > 0.004).map(b => (
              <Badge key={b.user_profile_id} variant="outline"
                className={`text-xs ${Number(b.balance_owed_usd) > 0 ? 'text-red-600 border-red-300' : 'text-green-700 border-green-300'}`}>
                {b.display_name}: {Number(b.balance_owed_usd) > 0 ? money(b.balance_owed_usd) + ' owed' : money(Math.abs(Number(b.balance_owed_usd))) + ' credit'}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Costs a user fronts (product testing, supplies…) come out of the vendor share and must be
          reimbursed to that user and recorded before the cycle can close — same rules as rep and
          warehouse balances.
        </p>
        {rowErr && <p className="text-sm text-red-600">{rowErr}</p>}
        {expLoading ? <Skeleton className="h-16 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>For</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{new Date(e.expense_date).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{expenseCategoryLabel(e.category)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{e.description}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.payee_name || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(e.amount_usd)}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        title="Remove (only while not covered by reimbursements)"
                        onClick={() => handleDelete(e.id)} disabled={deletingId === e.id}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-gray-400 py-6">No expenses this cycle.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {reimbs.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Reimbursements (this cycle)</p>
            <div className="space-y-1">
              {reimbs.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-1 last:border-0">
                  <span className="text-muted-foreground min-w-0 truncate">
                    {new Date(r.paid_at).toLocaleDateString()}
                    {r.payee_name ? ` · to ${r.payee_name}` : ''}
                    {r.paid_by ? ` · by ${r.paid_by}` : ''}{r.note ? ` · ${r.note}` : ''}
                    {r.tx_hash ? <span className="font-mono" title={r.tx_hash}> · TX {r.tx_hash.slice(0, 10)}…</span> : ''}
                  </span>
                  <span className="tabular-nums font-medium shrink-0">{money(r.amount_usd)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {settledExpenses.length > 0 && (
          <div className="pt-1 border-t">
            <button type="button"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowSettled(v => !v)}>
              {showSettled ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Settled in prior cycles — {settledExpenses.length} expense{settledExpenses.length === 1 ? '' : 's'} totaling {money(settledTotal)}, fully reimbursed
            </button>
            {showSettled && (
              <div className="mt-2 space-y-1">
                {settledExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-1 last:border-0">
                    <span className="text-muted-foreground min-w-0 truncate">
                      {new Date(e.expense_date).toLocaleDateString()} · {expenseCategoryLabel(e.category)} · {e.description}
                      {e.payee_name ? ` · for ${e.payee_name}` : ''}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                        <Check className="h-3 w-3 mr-0.5" /> Paid
                      </Badge>
                      <span className="tabular-nums font-medium">{money(e.amount_usd)}</span>
                    </span>
                  </div>
                ))}
                {settledReimbs.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Covered by {settledReimbs.length} reimbursement{settledReimbs.length === 1 ? '' : 's'} totaling {money(settledReimbs.reduce((s, r) => s + Number(r.amount_usd), 0))} — full detail in Settlement History.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={v => !v && !addSaving && setAddOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Operating Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-0.5">Blank = today.</p>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={expCat} onValueChange={setExpCat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. Janoshik test — T60 batch 0726" />
            </div>
            <div>
              <Label>Reimburse to</Label>
              <Select value={expPayee} onValueChange={setExpPayee}>
                <SelectTrigger><SelectValue placeholder="Who fronted this cost?" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={expAmt} onChange={e => setExpAmt(e.target.value)} />
            </div>
            {addErr && <p className="text-sm text-red-600">{addErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Saving…' : 'Add Expense'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reimbOpen} onOpenChange={v => !v && !reimbSaving && setReimbOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Expense Reimbursement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Record the reimbursement AFTER the money has actually been paid out — this is the ledger
              entry, not the transfer.
            </p>
            <div>
              <Label>Reimbursed user</Label>
              <Select value={reimbUser} onValueChange={v => { setReimbUser(v); const owed = balanceFor(v); setReimbAmt(owed > 0 ? owed.toFixed(2) : ''); }}>
                <SelectTrigger><SelectValue placeholder="Who was paid back?" /></SelectTrigger>
                <SelectContent>
                  {expBalances.map(b => (
                    <SelectItem key={b.user_profile_id} value={String(b.user_profile_id)}>
                      {b.display_name} — {money(Math.max(0, Number(b.balance_owed_usd)))} outstanding
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={reimbAmt} onChange={e => setReimbAmt(e.target.value)} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={reimbNote} onChange={e => setReimbNote(e.target.value)} placeholder="e.g. reimbursed from USDT wallet, tx …" rows={2} />
            </div>
            {reimbErr && <p className="text-sm text-red-600">{reimbErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReimbOpen(false)} disabled={reimbSaving}>Cancel</Button>
            <Button onClick={handleReimburse} disabled={reimbSaving}>{reimbSaving ? 'Saving…' : 'Record Reimbursement'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * What's owed to the product vendor: everything verified-collected, minus
 * what reps and warehouses earn, minus vendor remittances already recorded.
 */
export function VendorTab({ division }: { division: string }) {
  const { profileId, isAdmin } = useAppUser();
  const [balRaw, balLoading, , reloadBal] = useLoadAction(getVendorBalance, [division], { division });
  const [payRaw, payLoading, , reloadPay] = useLoadAction(listVendorPayments, [division], { division });
  const [doPay] = useMutateAction(recordCommissionPayment);
  const bal = asRows<VendorBalance>(balRaw)[0];
  const payments = asRows<VendorPayment>(payRaw);

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [payTx, setPayTx] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Settle All: stamp + zero every ledger in one atomic statement.
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);
  const [settleErr, setSettleErr] = useState('');
  const [doSettle] = useMutateAction(executeSettlementAtomic);
  const [settlementsRaw, , , reloadSettlements] = useLoadAction(listSettlements, [division], { division });
  const settlements = asRows<Settlement>(settlementsRaw);
  // Drill-down: payouts recorded by the expanded settlement.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailRaw, detailLoading] = useLoadAction(listSettlementPayments, [expandedId], { settlement_id: expandedId ?? 0 }, { enabled: expandedId != null });
  const detailRows = asRows<SettlementPayment>(detailRaw);
  // Preview: what the stamp will contain (same source actions as the tabs).
  const [repBalRaw, , , reloadRepBal] = useLoadAction(listRepBalances, [settleOpen ? 1 : 0, division], { division }, { enabled: settleOpen });
  // Warehouses live only in the US pipeline — a China settlement never pays them.
  const [whBalRaw, , , reloadWhBal] = useLoadAction(listWarehouseBalances, [settleOpen ? 1 : 0, division], { warehouse_id: '' }, { enabled: settleOpen && division === 'us' });
  const repRows = asRows<{ sales_rep_user_profile_id: number; display_name: string; balance_owed_usd: number }>(repBalRaw)
    .filter(r => Math.abs(Number(r.balance_owed_usd)) > 0.004);
  const whRows = asRows<{ warehouse_id: number; warehouse_name: string; balance_owed_usd: number }>(whBalRaw)
    .filter(r => Math.abs(Number(r.balance_owed_usd)) > 0.004);
  const repOwedTotal = repRows.reduce((s, r) => s + Math.max(0, Number(r.balance_owed_usd)), 0);
  const whOwedTotal = whRows.reduce((s, r) => s + Math.max(0, Number(r.balance_owed_usd)), 0);
  // Per-user expense balances — the gate sums POSITIVE balances only,
  // mirroring exp_out in executeSettlementAtomic (one user's overpayment
  // must not offset another's unpaid).
  const [expBalSettleRaw, , , reloadExpBalSettle] = useLoadAction(listExpenseBalances, [settleOpen ? 1 : 0, division], { division }, { enabled: settleOpen });
  const expBalRows = asRows<ExpenseBalance>(expBalSettleRaw).filter(b => Math.abs(Number(b.balance_owed_usd)) > 0.004);
  const expOwedTotal = expBalRows.reduce((s, b) => s + Math.max(0, Number(b.balance_owed_usd)), 0);
  // Vendor pays LAST — everything above it must read zero first.
  const preVendorClear = repOwedTotal <= 0.004 && whOwedTotal <= 0.004 && expOwedTotal <= 0.004;

  // Vendor payout wallets (app settings) — shown wherever a vendor payment
  // is about to be recorded, editable from the card header.
  const [vethRaw, , , reloadVeth] = useLoadAction(getAppSetting, [], { key: 'vendor_wallet_ethereum' });
  const [vsolRaw, , , reloadVsol] = useLoadAction(getAppSetting, [], { key: 'vendor_wallet_solana' });
  const vendorEth = String(asRows<{ value: string }>(vethRaw)[0]?.value ?? '');
  const vendorSol = String(asRows<{ value: string }>(vsolRaw)[0]?.value ?? '');
  const [doUpsertSetting] = useMutateAction(upsertAppSetting);
  const [walletsOpen, setWalletsOpen] = useState(false);
  const [ethIn, setEthIn] = useState('');
  const [solIn, setSolIn] = useState('');
  const [walletsSaving, setWalletsSaving] = useState(false);
  const [walletsErr, setWalletsErr] = useState('');
  const [copied, setCopied] = useState('');
  const copyAddr = (label: string, addr: string) => {
    navigator.clipboard?.writeText(addr).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(c => (c === label ? '' : c)), 1500);
    });
  };
  const saveWallets = async () => {
    setWalletsSaving(true); setWalletsErr('');
    try {
      await doUpsertSetting({ key: 'vendor_wallet_ethereum', value: ethIn.trim() });
      await doUpsertSetting({ key: 'vendor_wallet_solana', value: solIn.trim() });
      setWalletsOpen(false);
      reloadVeth(); reloadVsol();
    } catch (e: unknown) {
      setWalletsErr(e instanceof Error ? e.message : 'Failed to save wallets');
    } finally {
      setWalletsSaving(false);
    }
  };

  // Rundown recording: "Record paid" opens a payout dialog showing the
  // payee's saved wallet addresses (where to send), an editable amount,
  // and a TX ID field. Recording is the ledger entry, not the transfer —
  // send the crypto first, same doctrine as everywhere else.
  type PayoutPayee = { payee_type: string; sales_rep_user_profile_id?: number | null; warehouse_id?: number | null };
  const [payoutTarget, setPayoutTarget] = useState<{ name: string; owed: number; payee: PayoutPayee } | null>(null);
  // One line per on-chain transaction — a payee paid in several sends
  // records one payment row per line, each with its own TX ID.
  const [payoutLines, setPayoutLines] = useState<{ amount: string; tx: string }[]>([]);
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutErr, setPayoutErr] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);
  // Synchronous in-flight guard: React state renders too late to stop a
  // rapid double-click on Record from inserting the payment twice.
  const recordingRef = useRef(false);
  // A pending payout dialog must not survive a division switch.
  useEffect(() => { setPayoutTarget(null); }, [division]);
  const [payeeAddrRaw, payeeAddrLoading] = useLoadAction(listPayoutAddressesForPayee,
    [payoutTarget?.payee.sales_rep_user_profile_id ?? 0, payoutTarget?.payee.warehouse_id ?? 0],
    {
      user_profile_id: payoutTarget?.payee.sales_rep_user_profile_id ?? null,
      warehouse_id: payoutTarget?.payee.warehouse_id ?? null,
    },
    { enabled: payoutTarget != null });
  const payeeAddrs = asRows<{ asset: string; network: string; address: string; label: string | null; display_name: string }>(payeeAddrRaw);
  const openPayout = (name: string, owed: number, payee: PayoutPayee) => {
    setPayoutTarget({ name, owed, payee });
    setPayoutLines([{ amount: owed.toFixed(2), tx: '' }]);
    setPayoutNote(''); setPayoutErr('');
  };
  const setLine = (i: number, patch: Partial<{ amount: string; tx: string }>) =>
    setPayoutLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const payoutTotal = payoutLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const recordPayout = async () => {
    if (!payoutTarget) return;
    const lines = payoutLines.filter(l => l.amount.trim() !== '' || l.tx.trim() !== '');
    if (lines.length === 0) { setPayoutErr('Enter at least one payout line.'); return; }
    if (lines.some(l => !(Number(l.amount) > 0))) { setPayoutErr('Every line needs a valid amount.'); return; }
    if (recordingRef.current) return;
    recordingRef.current = true;
    setPayoutSaving(true); setPayoutErr('');
    let recorded = 0;
    try {
      // One payment row per line, sequential — each transaction gets its
      // own ledger entry with its own TX ID.
      for (const l of lines) {
        await doPay({
          payee_type: payoutTarget.payee.payee_type,
          sales_rep_user_profile_id: payoutTarget.payee.sales_rep_user_profile_id ?? null,
          warehouse_id: payoutTarget.payee.warehouse_id ?? null,
          amount_usd: Number(Number(l.amount).toFixed(2)),
          paid_by_user_id: profileId,
          note: payoutNote.trim() || 'Recorded from Close Cycle rundown',
          tx_hash: l.tx.trim() || null,
          division,
        });
        recorded++;
      }
      setPayoutTarget(null);
    } catch (e: unknown) {
      setPayoutErr(`${e instanceof Error ? e.message : 'Failed to record payment'}${recorded > 0 ? ` — ${recorded} of ${lines.length} line(s) WERE recorded; remove the recorded ones before retrying (lines record top to bottom - the FIRST N recorded).` : ''}`);
    } finally {
      recordingRef.current = false;
      setPayoutSaving(false);
      if (recorded > 0) { reloadBal(); reloadRepBal(); reloadExpBalSettle(); if (division === 'us') reloadWhBal(); }
    }
  };

  const handleSettle = async () => {
    setSettling(true); setSettleErr('');
    try {
      const res = await doSettle({ note: settleNote || null, user_id: profileId, division }) as
        { settlement_id: number | null; rep_outstanding: number; warehouse_outstanding: number; expense_outstanding: number; vendor_outstanding: number }[];
      const row = res?.[0];
      if (!row || row.settlement_id == null) {
        // Server-side re-check refused: balances moved between preview and
        // confirm (or the preview was stale).
        setSettleErr(row
          ? `Cycle can't close — still outstanding: reps ${money(Math.max(0, Number(row.rep_outstanding)))}, warehouses ${money(Math.max(0, Number(row.warehouse_outstanding)))}, expenses ${money(Math.max(0, Number(row.expense_outstanding)))}, vendor ${money(Math.max(0, Number(row.vendor_outstanding)))}. Record the actual payments first.`
          : 'Cycle could not be closed — refresh and retry.');
        return;
      }
      setSettleOpen(false); setSettleNote('');
      reloadBal(); reloadPay(); reloadSettlements();
    } catch (e: unknown) {
      setSettleErr(e instanceof Error ? e.message : 'Settlement failed');
    } finally {
      setSettling(false);
    }
  };

  const handlePay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter a valid payment amount.'); return; }
    setSaving(true); setError('');
    try {
      await doPay({
        payee_type: 'vendor',
        sales_rep_user_profile_id: null,
        warehouse_id: null,
        amount_usd: amt,
        paid_by_user_id: profileId,
        note: note || null,
        tx_hash: payTx.trim() || null,
        division,
      });
      setPayOpen(false); setAmount(''); setNote(''); setPayTx('');
      reloadBal(); reloadPay();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="h-4 w-4 text-slate-600" /> Owed to Vendor
          </CardTitle>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { setWalletsOpen(true); setEthIn(vendorEth); setSolIn(vendorSol); setWalletsErr(''); }}>
                <WalletIcon className="h-3.5 w-3.5 mr-1" /> Vendor Wallets
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPayOpen(true); setAmount(bal ? Math.max(0, Number(bal.balance_owed_usd)).toFixed(2) : ''); setNote(''); setPayTx(''); setError(''); }}>
                Record Vendor Payment
              </Button>
              <Button size="sm" onClick={() => { setSettleOpen(true); setSettleNote(''); setSettleErr(''); setPayoutTarget(null); }}>
                <Stamp className="h-3.5 w-3.5 mr-1" /> Settle All Now
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {balLoading || !bal ? <Skeleton className="h-32 w-full" /> : (
            <div className="max-w-md space-y-1.5 text-sm">
              <p className="text-xs text-muted-foreground">
                {bal.last_settled_at
                  ? <>Current cycle — since settlement #{bal.last_settlement_id} on {new Date(bal.last_settled_at).toLocaleString()}. These numbers reset to zero at every settlement.</>
                  : 'Current cycle — all activity (no settlements yet). These numbers reset to zero at every settlement.'}
              </p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payments collected this cycle (verified, net of refunds)</span>
                <span className="tabular-nums">{money(bal.collected_usd)}</span>
              </div>
              {/* Negative outstanding = payee overpaid earlier; it adds back
                  to the vendor share, so render as a credit. */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Sales rep commissions outstanding</span>
                <span className={`tabular-nums ${Number(bal.rep_commissions_usd) >= 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {Number(bal.rep_commissions_usd) >= 0 ? '−' : '+'}{money(Math.abs(Number(bal.rep_commissions_usd)))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Warehouse shipping outstanding</span>
                <span className={`tabular-nums ${Number(bal.warehouse_earned_usd) >= 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {Number(bal.warehouse_earned_usd) >= 0 ? '−' : '+'}{money(Math.abs(Number(bal.warehouse_earned_usd)))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Operating expenses outstanding</span>
                <span className={`tabular-nums ${Number(bal.expenses_usd) >= 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {Number(bal.expenses_usd) >= 0 ? '−' : '+'}{money(Math.abs(Number(bal.expenses_usd)))}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <span>Vendor share (this cycle)</span>
                <span className="tabular-nums">{money(bal.vendor_share_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Vendor payments this cycle</span>
                <span className="tabular-nums text-red-600">−{money(bal.vendor_paid_usd)}</span>
              </div>
              {Math.abs(Number(bal.carried_adjustment_usd)) >= 0.01 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">± Carried from before last settlement</span>
                  <span className="tabular-nums">{Number(bal.carried_adjustment_usd) >= 0 ? '+' : '−'}{money(Math.abs(Number(bal.carried_adjustment_usd)))}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 text-base font-bold">
                <span>Balance owed to vendor</span>
                <span className={`tabular-nums ${Number(bal.balance_owed_usd) > 0 ? 'text-green-700' : ''}`}>{money(bal.balance_owed_usd)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Rep commissions accrue on confirmed+ orders (each rep&apos;s own rate); warehouse earnings accrue per shipped
                shipment at the rate plan. Both are counted when earned, not when paid out. Lifetime stamped
                totals live in Settlement History below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <OperatingExpensesCard division={division} onChanged={() => { reloadBal(); }} />

      <OnChainWalletCheck division={division} />

      <Card>
        <CardHeader><CardTitle className="text-base">Settlement History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Stamped At</TableHead>
                <TableHead className="text-right">Reps Paid</TableHead>
                <TableHead className="text-right">Warehouses Paid</TableHead>
                <TableHead className="text-right">Expenses Paid</TableHead>
                <TableHead className="text-right">Vendor Paid</TableHead>
                <TableHead className="text-right">Collected (lifetime)</TableHead>
                <TableHead>By / Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map(s => (
                <React.Fragment key={s.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        {expandedId === s.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        #{s.id}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(s.settled_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(s.rep_commissions_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(s.warehouse_earned_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(s.expenses_usd ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{money(s.vendor_share_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{money(s.collected_usd)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.created_by || '—'}{s.note ? ` · ${s.note}` : ''}</TableCell>
                  </TableRow>
                  {expandedId === s.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/20 p-0">
                        {detailLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (() => {
                          const atStamp = detailRows.filter(p => p.at_settlement);
                          const midCycle = detailRows.filter(p => !p.at_settlement);
                          const payLine = (p: SettlementPayment, showDate: boolean) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-1 last:border-0">
                              <span className="flex items-center gap-2 min-w-0">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {p.payee_type === 'sales_rep' ? 'Rep' : p.payee_type === 'warehouse' ? 'Warehouse' : p.payee_type === 'expense' ? 'Expense' : 'Vendor'}
                                </Badge>
                                <span className="truncate">
                                  {p.payee_type === 'sales_rep' ? p.sales_rep_name : p.payee_type === 'warehouse' ? p.warehouse_name : p.payee_type === 'expense' ? (p.sales_rep_name ? `Expenses — ${p.sales_rep_name}` : 'Expense reimbursement') : 'Vendor'}
                                  {showDate && <span className="text-xs text-muted-foreground ml-1.5">{new Date(p.paid_at).toLocaleDateString()}{p.note ? ` · ${p.note}` : ''}</span>}
                                  {p.tx_hash && <span className="text-xs text-muted-foreground font-mono ml-1.5" title={p.tx_hash}>TX {p.tx_hash.slice(0, 10)}…</span>}
                                </span>
                              </span>
                              <span className="tabular-nums font-medium shrink-0">{money(p.amount_usd)}</span>
                            </div>
                          );
                          const sum = (rowsArr: SettlementPayment[]) => rowsArr.reduce((acc, p) => acc + Number(p.amount_usd), 0);
                          return (
                            <div className="px-4 py-3 space-y-3">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Paid at settlement #{s.id} ({atStamp.length})
                                </p>
                                <div className="space-y-1">
                                  {atStamp.map(p => payLine(p, false))}
                                  {atStamp.length === 0 && <p className="text-sm text-muted-foreground">No payout rows (nothing was owed at this stamp).</p>}
                                </div>
                              </div>
                              {midCycle.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Paid earlier in this cycle ({midCycle.length}) — these reduced what the settlement had to pay
                                  </p>
                                  <div className="space-y-1">{midCycle.map(p => payLine(p, true))}</div>
                                </div>
                              )}
                              <div className="space-y-0.5 pt-1 border-t">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Settled at stamp</span>
                                  <span className="tabular-nums">{money(sum(atStamp))}</span>
                                </div>
                                {midCycle.length > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Paid mid-cycle</span>
                                    <span className="tabular-nums">{money(sum(midCycle))}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm font-semibold">
                                  <span>Total paid out this cycle</span>
                                  <span className="tabular-nums">{money(sum(detailRows))}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {settlements.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-6">No settlements yet — pay every balance to zero, then Settle All closes the cycle.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vendor Payment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {payLoading ? <div className="p-4"><Skeleton className="h-16 w-full" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(p.amount_usd)}</TableCell>
                    <TableCell>{p.paid_by || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.note || '—'}
                      {p.tx_hash && <span className="block font-mono text-xs" title={p.tx_hash}>TX {p.tx_hash.slice(0, 14)}…</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-6">No vendor payments recorded yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={settleOpen} onOpenChange={v => !v && !settling && setSettleOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Settle All — close the cycle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Closing the cycle is the <span className="font-medium">last</span> step: it stamps this cycle&apos;s
              collections and payouts and starts the next cycle. It records <span className="font-medium">no
              payments itself</span> — every balance must already be paid down to zero via recorded payments
              (Rep and Warehouse tabs, and Record Vendor Payment here). (Overpaid — negative — balances
              don&apos;t block closing; they carry forward.)
            </p>
            {(() => {
              const rowCls = 'flex items-center justify-between gap-2';
              const paidBadge = <span className="inline-flex items-center gap-1 text-xs text-green-700"><Check className="h-3 w-3" /> Paid</span>;
              const payeeRow = (key: string, name: string, owed: number, payee: PayoutPayee) => (
                <div key={key} className={rowCls}>
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className={`tabular-nums ${owed > 0.004 ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
                      {owed < -0.004 ? `credit ${money(Math.abs(owed))}` : money(Math.max(0, owed))}
                    </span>
                    {owed > 0.004 ? (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                        disabled={payoutSaving}
                        onClick={() => openPayout(name, owed, payee)}>
                        Record paid
                      </Button>
                    ) : owed < -0.004
                      ? <span className="text-xs text-muted-foreground">carries forward</span> : paidBadge}
                  </span>
                </div>
              );
              return (
                <div className="rounded border bg-slate-50 p-3 space-y-3 text-sm max-h-80 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">
                    Payout rundown — send the crypto first, then record each. The vendor is paid{' '}
                    <span className="font-medium">last</span>, from what remains.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">1 · Sales Reps</p>
                    {repRows.length === 0
                      ? <p className="text-xs text-green-700">Nothing outstanding.</p>
                      : repRows.map(r => payeeRow(`rep-${r.sales_rep_user_profile_id}`, r.display_name, Number(r.balance_owed_usd),
                          { payee_type: 'sales_rep', sales_rep_user_profile_id: Number(r.sales_rep_user_profile_id) }))}
                  </div>
                  {division === 'us' && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">2 · Warehouses</p>
                      {whRows.length === 0
                        ? <p className="text-xs text-green-700">Nothing outstanding.</p>
                        : whRows.map(w => payeeRow(`wh-${w.warehouse_id}`, w.warehouse_name, Number(w.balance_owed_usd),
                            { payee_type: 'warehouse', warehouse_id: Number(w.warehouse_id) }))}
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">3 · Operating Expenses</p>
                    {expBalRows.length === 0
                      ? <p className="text-xs text-green-700">Nothing outstanding.</p>
                      : expBalRows.map(b => payeeRow(`exp-${b.user_profile_id}`, b.display_name, Number(b.balance_owed_usd),
                          { payee_type: 'expense', sales_rep_user_profile_id: Number(b.user_profile_id) }))}
                  </div>
                  <div className="space-y-1 border-t pt-2">
                    <p className="text-xs font-semibold text-muted-foreground">4 · Vendor — paid last</p>
                    <div className={rowCls}>
                      <span>Vendor share</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className={`tabular-nums ${bal && Number(bal.balance_owed_usd) > 0.004 ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
                          {bal ? money(Math.max(0, Number(bal.balance_owed_usd))) : '—'}
                        </span>
                        {bal && Number(bal.balance_owed_usd) > 0.004 ? (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                            disabled={!preVendorClear}
                            title={preVendorClear ? undefined : 'Pay reps, warehouses, and expenses first'}
                            onClick={() => { setPayOpen(true); setAmount(Math.max(0, Number(bal.balance_owed_usd)).toFixed(2)); setNote(''); setPayTx(''); setError(''); }}>
                            Record vendor payment
                          </Button>
                        ) : paidBadge}
                      </span>
                    </div>
                    {(vendorEth || vendorSol) ? (
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {vendorEth && (
                          <p className="flex items-center gap-1.5">
                            <span className="shrink-0">ETH</span>
                            <span className="font-mono break-all">{vendorEth}</span>
                            <button type="button" className="shrink-0 text-blue-600 hover:text-blue-800" title="Copy" onClick={() => copyAddr('eth', vendorEth)}>
                              {copied === 'eth' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </p>
                        )}
                        {vendorSol && (
                          <p className="flex items-center gap-1.5">
                            <span className="shrink-0">SOL</span>
                            <span className="font-mono break-all">{vendorSol}</span>
                            <button type="button" className="shrink-0 text-blue-600 hover:text-blue-800" title="Copy" onClick={() => copyAddr('sol', vendorSol)}>
                              {copied === 'sol' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No vendor wallet addresses saved — add them via the Vendor Wallets button.</p>
                    )}
                  </div>
                </div>
              );
            })()}
            {(repOwedTotal > 0.004 || whOwedTotal > 0.004 || expOwedTotal > 0.004 || (bal != null && Number(bal.balance_owed_usd) > 0.004)) ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Balances are still outstanding — work the rundown top to bottom. The cycle can only close
                at zero.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                All balances read zero — closing will stamp the cycle. The server re-checks at the moment you
                confirm.
              </p>
            )}
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={settleNote} onChange={e => setSettleNote(e.target.value)} placeholder="e.g. July cycle closed — wallet emptied to vendor" rows={2} />
            </div>
            {settleErr && <p className="text-sm text-red-600">{settleErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)} disabled={settling}>Cancel</Button>
            <Button onClick={handleSettle}
              disabled={settling || repOwedTotal > 0.004 || whOwedTotal > 0.004 || expOwedTotal > 0.004 || bal == null || Number(bal.balance_owed_usd) > 0.004}>
              {settling ? 'Closing…' : 'Close Cycle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={v => !v && setPayOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Vendor Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Current balance owed: <span className="font-medium text-gray-900">{bal ? money(bal.balance_owed_usd) : '—'}</span>
            </p>
            {(vendorEth || vendorSol) && (
              <div className="rounded border bg-slate-50 p-2 space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Vendor payout wallets</p>
                {vendorEth && (
                  <p className="flex items-center gap-1.5">
                    <span className="shrink-0">ETH</span>
                    <span className="font-mono break-all">{vendorEth}</span>
                    <button type="button" className="shrink-0 text-blue-600 hover:text-blue-800" title="Copy" onClick={() => copyAddr('pay-eth', vendorEth)}>
                      {copied === 'pay-eth' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </p>
                )}
                {vendorSol && (
                  <p className="flex items-center gap-1.5">
                    <span className="shrink-0">SOL</span>
                    <span className="font-mono break-all">{vendorSol}</span>
                    <button type="button" className="shrink-0 text-blue-600 hover:text-blue-800" title="Copy" onClick={() => copyAddr('pay-sol', vendorSol)}>
                      {copied === 'pay-sol' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </p>
                )}
              </div>
            )}
            <div>
              <Label>Payment Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Transaction ID (optional)</Label>
              <Input value={payTx} onChange={e => setPayTx(e.target.value)} className="font-mono" placeholder="0x… / signature" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. USDT sent to vendor wallet" rows={2} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePay} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payoutTarget != null} onOpenChange={v => !v && !payoutSaving && setPayoutTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payout — {payoutTarget?.name}</DialogTitle></DialogHeader>
          {payoutTarget && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Outstanding: <span className="font-medium text-gray-900">{money(payoutTarget.owed)}</span>. Send
                the crypto first — this records the ledger entry, not the transfer.
              </p>
              <div className="rounded border bg-slate-50 p-2 space-y-1 text-xs">
                <p className="font-medium">Pay to</p>
                {payeeAddrLoading ? <p className="text-muted-foreground">Loading addresses…</p>
                  : payeeAddrs.length === 0 ? (
                    <p className="text-muted-foreground">
                      No payout addresses saved for this payee — add them under their user settings.
                    </p>
                  ) : payeeAddrs.map((a, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="shrink-0 font-medium text-foreground">{a.asset} · {a.network}</span>
                      <span className="font-mono break-all">{a.address}</span>
                      <button type="button" className="shrink-0 text-blue-600 hover:text-blue-800" title="Copy"
                        onClick={() => copyAddr(`payee-${i}`, a.address)}>
                        {copied === `payee-${i}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </p>
                  ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Payout lines</Label>
                  <Button type="button" size="sm" variant="ghost" className="h-6 text-xs"
                    onClick={() => setPayoutLines(ls => [...ls, { amount: '', tx: '' }])}>
                    + Add line
                  </Button>
                </div>
                {payoutLines.map((l, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <div className="w-28 shrink-0">
                      <Input type="number" min="0" step="0.01" placeholder="Amount" value={l.amount}
                        onChange={e => setLine(i, { amount: e.target.value })} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input placeholder="Transaction ID (optional)" className="font-mono" value={l.tx}
                        onChange={e => setLine(i, { tx: e.target.value })} />
                    </div>
                    {payoutLines.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-7 shrink-0 text-muted-foreground hover:text-red-600"
                        onClick={() => setPayoutLines(ls => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  One line per transaction — each records its own payment entry.
                  Total: <span className={`tabular-nums font-medium ${Math.abs(payoutTotal - payoutTarget.owed) < 0.005 ? 'text-green-700' : 'text-amber-700'}`}>{money(payoutTotal)}</span>
                  {Math.abs(payoutTotal - payoutTarget.owed) >= 0.005 && <> of {money(payoutTarget.owed)} outstanding</>}
                </p>
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={payoutNote} onChange={e => setPayoutNote(e.target.value)} placeholder="applies to every line" />
              </div>
              {payoutErr && <p className="text-sm text-red-600">{payoutErr}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutTarget(null)} disabled={payoutSaving}>Cancel</Button>
            <Button onClick={recordPayout} disabled={payoutSaving}>
              {payoutSaving ? 'Recording…' : `Record ${payoutLines.filter(l => Number(l.amount) > 0).length > 1 ? `${payoutLines.filter(l => Number(l.amount) > 0).length} payments` : 'payment'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={walletsOpen} onOpenChange={v => !v && !walletsSaving && setWalletsOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vendor Payout Wallets</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              The vendor&apos;s receiving addresses — shown with a copy button wherever a vendor payment is
              recorded. Reference only: the app never sends funds.
            </p>
            <div>
              <Label>Ethereum address</Label>
              <Input value={ethIn} onChange={e => setEthIn(e.target.value)} placeholder="0x…" className="font-mono" />
            </div>
            <div>
              <Label>Solana address</Label>
              <Input value={solIn} onChange={e => setSolIn(e.target.value)} placeholder="e.g. ER9T…" className="font-mono" />
            </div>
            {walletsErr && <p className="text-sm text-red-600">{walletsErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletsOpen(false)} disabled={walletsSaving}>Cancel</Button>
            <Button onClick={saveWallets} disabled={walletsSaving}>{walletsSaving ? 'Saving…' : 'Save Wallets'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
