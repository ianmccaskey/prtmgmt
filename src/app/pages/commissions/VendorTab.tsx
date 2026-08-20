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
import listWalletCyclePayments from '@/actions/commissions/listWalletCyclePayments';
import getAppSetting from '@/actions/settings/getAppSetting';
import updatePaymentWallet from '@/actions/orders/updatePaymentWallet';
import insertAuditLog from '@/actions/orders/insertAuditLog';
import { getOnChainBalance, getTokenDeposits, OnChainDeposit } from '@/lib/moralis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Factory, RefreshCw, Stamp, Wallet as WalletIcon } from 'lucide-react';

type VendorBalance = {
  last_settlement_id: number | null; last_settled_at: string | null;
  collected_usd: number; rep_commissions_usd: number; warehouse_earned_usd: number;
  vendor_share_usd: number; vendor_paid_usd: number; balance_owed_usd: number;
  carried_adjustment_usd: number;
};
type VendorPayment = { id: number; amount_usd: number; paid_at: string; note: string | null; paid_by: string | null };
type Settlement = {
  id: number; settled_at: string; collected_usd: number; rep_commissions_usd: number;
  warehouse_earned_usd: number; vendor_share_usd: number; note: string | null; created_by: string | null;
};
type SettlementPayment = {
  id: number; payee_type: 'sales_rep' | 'warehouse' | 'vendor'; amount_usd: number;
  paid_at: string; note: string | null; at_settlement: boolean;
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

  // Cross-asset auto-repair: a rep who records USDC when the money actually
  // arrived as USDT (or vice versa) leaves a "not found on-chain" record here
  // and an unmatched deposit on the sibling stablecoin's wallet. When the
  // recorded TX hash is confirmed in the sibling wallet's deposit history on
  // the same network, the chain itself proves the mistake — repoint the
  // payment automatically and audit-log it on the order. Settled-cycle rows
  // are refused by updatePaymentWallet and surfaced, never silently skipped.
  const { profileId } = useAppUser();
  const [repointPayment] = useMutateAction(updatePaymentWallet);
  const [writeAudit] = useMutateAction(insertAuditLog);
  const repairAttempted = useRef<Set<number>>(new Set());
  const [autoRepaired, setAutoRepaired] = useState<{ order_number: string; to: string }[]>([]);
  const [repairBlocked, setRepairBlocked] = useState<string[]>([]);
  useEffect(() => { setAutoRepaired([]); setRepairBlocked([]); }, [openWalletId]);

  useEffect(() => {
    if (openWallet == null || !Array.isArray(deposits)) return;
    if (!STABLECOINS.includes(openWallet.asset)) return;
    const siblingAsset = openWallet.asset === 'USDC' ? 'USDT' : 'USDC';
    const sibling = wallets.find(s => s.asset === siblingAsset && s.network === openWallet.network && s.id != null);
    if (!sibling) return;
    const recNow = reconcile(cyclePayments, deposits);
    const candidates = cyclePayments.filter(p =>
      p.direction !== 'refund'
      && (p.tx_hash || '').trim() !== ''
      && !recNow.matches.get(p.id)
      && !repairAttempted.current.has(p.id));
    if (candidates.length === 0) return;
    candidates.forEach(p => repairAttempted.current.add(p.id));
    let alive = true;
    (async () => {
      let sibDeps: OnChainDeposit[] | null = null;
      try {
        sibDeps = await getTokenDeposits(moralisKey, siblingAsset, sibling.network, sibling.address, cycleStart, heliusKey || null);
      } catch { return; /* sibling history unavailable — records stay not-found */ }
      if (!alive || !sibDeps) return;
      const byHash = new Map(sibDeps.map(d => [d.txHash.toLowerCase(), d]));
      let changed = false;
      for (const p of candidates) {
        const hit = byHash.get(String(p.tx_hash).trim().toLowerCase());
        if (!hit) continue;
        const res = await repointPayment({
          paymentId: p.id, asset: siblingAsset, network: openWallet.network,
          walletId: sibling.id, txHash: null,
        }) as unknown[];
        if (!alive) return;
        if (!res || res.length === 0) {
          setRepairBlocked(prev => [...prev,
            `${p.order_number}: TX ${String(p.tx_hash).slice(0, 14)}… is actually a ${siblingAsset} deposit, but the payment sits in a stamped settlement cycle — it has to stay as recorded.`]);
          continue;
        }
        await writeAudit({
          orderId: p.sales_order_id, userId: profileId, changeType: 'other', fieldName: 'payment_wallet',
          oldValue: `${openWallet.asset}/${openWallet.network}`,
          newValue: `${siblingAsset}/${openWallet.network}`,
          note: `Auto-repair (wallet check): recorded TX ${p.tx_hash} was confirmed on-chain as a ${siblingAsset} deposit of ${hit.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} to ${sibling.label} — asset corrected from ${openWallet.asset}`,
        });
        changed = true;
        if (alive) setAutoRepaired(prev => [...prev, { order_number: p.order_number, to: `${siblingAsset} · ${openWallet.network}` }]);
      }
      if (changed && alive) { reloadCycle(); reloadInflows(); }
    })();
    return () => { alive = false; };
    // cycleRaw (not the derived array) keeps the dep identity stable per fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWalletId, deposits, cycleRaw]);

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
                                        ) : (
                                          <Badge variant="outline" className="text-xs text-red-600 border-red-300">not found on-chain</Badge>
                                        )
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
                                    {big.map(d => (
                                      <p key={d.txHash} className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="tabular-nums font-semibold shrink-0">{money(d.amount)}</span>
                                        {d.at && <span className="shrink-0">{new Date(d.at).toLocaleDateString()}</span>}
                                        <span className="font-mono break-all text-amber-700/70">{d.txHash.slice(0, 18)}…</span>
                                      </p>
                                    ))}
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
                            the other stablecoin&apos;s wallet. <span className="font-medium">Over</span> usually means an
                            unrecorded deposit or pre-cycle leftovers.
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
  const [repBalRaw] = useLoadAction(listRepBalances, [settleOpen ? 1 : 0, division], { division }, { enabled: settleOpen });
  // Warehouses live only in the US pipeline — a China settlement never pays them.
  const [whBalRaw] = useLoadAction(listWarehouseBalances, [settleOpen ? 1 : 0, division], { warehouse_id: '' }, { enabled: settleOpen && division === 'us' });
  const repOwedTotal = asRows<{ balance_owed_usd: number }>(repBalRaw).reduce((s, r) => s + Math.max(0, Number(r.balance_owed_usd)), 0);
  const whOwedTotal = asRows<{ balance_owed_usd: number }>(whBalRaw).reduce((s, r) => s + Math.max(0, Number(r.balance_owed_usd)), 0);

  const handleSettle = async () => {
    setSettling(true); setSettleErr('');
    try {
      const res = await doSettle({ note: settleNote || null, user_id: profileId, division }) as
        { settlement_id: number | null; rep_outstanding: number; warehouse_outstanding: number; vendor_outstanding: number }[];
      const row = res?.[0];
      if (!row || row.settlement_id == null) {
        // Server-side re-check refused: balances moved between preview and
        // confirm (or the preview was stale).
        setSettleErr(row
          ? `Cycle can't close — still outstanding: reps ${money(Math.max(0, Number(row.rep_outstanding)))}, warehouses ${money(Math.max(0, Number(row.warehouse_outstanding)))}, vendor ${money(Math.max(0, Number(row.vendor_outstanding)))}. Record the actual payments first.`
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
        division,
      });
      setPayOpen(false); setAmount(''); setNote('');
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
              <Button size="sm" variant="outline" onClick={() => { setPayOpen(true); setAmount(bal ? Math.max(0, Number(bal.balance_owed_usd)).toFixed(2) : ''); setNote(''); setError(''); }}>
                Record Vendor Payment
              </Button>
              <Button size="sm" onClick={() => { setSettleOpen(true); setSettleNote(''); setSettleErr(''); }}>
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
                    <TableCell className="text-right tabular-nums font-medium">{money(s.vendor_share_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{money(s.collected_usd)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.created_by || '—'}{s.note ? ` · ${s.note}` : ''}</TableCell>
                  </TableRow>
                  {expandedId === s.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20 p-0">
                        {detailLoading ? <div className="p-4"><Skeleton className="h-12 w-full" /></div> : (() => {
                          const atStamp = detailRows.filter(p => p.at_settlement);
                          const midCycle = detailRows.filter(p => !p.at_settlement);
                          const payLine = (p: SettlementPayment, showDate: boolean) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-1 last:border-0">
                              <span className="flex items-center gap-2 min-w-0">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {p.payee_type === 'sales_rep' ? 'Rep' : p.payee_type === 'warehouse' ? 'Warehouse' : 'Vendor'}
                                </Badge>
                                <span className="truncate">
                                  {p.payee_type === 'sales_rep' ? p.sales_rep_name : p.payee_type === 'warehouse' ? p.warehouse_name : 'Vendor'}
                                  {showDate && <span className="text-xs text-muted-foreground ml-1.5">{new Date(p.paid_at).toLocaleDateString()}{p.note ? ` · ${p.note}` : ''}</span>}
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
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-6">No settlements yet — pay every balance to zero, then Settle All closes the cycle.</TableCell></TableRow>
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
                    <TableCell className="text-muted-foreground">{p.note || '—'}</TableCell>
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
            <div className="rounded border bg-slate-50 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Rep commissions outstanding</span><span className={`tabular-nums ${repOwedTotal > 0.004 ? 'text-red-600 font-medium' : ''}`}>{money(repOwedTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Warehouse balances outstanding</span><span className={`tabular-nums ${whOwedTotal > 0.004 ? 'text-red-600 font-medium' : ''}`}>{money(whOwedTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendor share outstanding</span><span className={`tabular-nums ${bal && Number(bal.balance_owed_usd) > 0.004 ? 'text-red-600 font-medium' : ''}`}>{bal ? money(Math.max(0, Number(bal.balance_owed_usd))) : '—'}</span></div>
            </div>
            {(repOwedTotal > 0.004 || whOwedTotal > 0.004 || (bal != null && Number(bal.balance_owed_usd) > 0.004)) ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Balances are still outstanding — send the crypto, record each payment, and come back. The
                cycle can only close at zero.
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
              disabled={settling || repOwedTotal > 0.004 || whOwedTotal > 0.004 || bal == null || Number(bal.balance_owed_usd) > 0.004}>
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
            <div>
              <Label>Payment Amount (USD)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. USDT sent to vendor wallet, tx …" rows={2} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePay} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
