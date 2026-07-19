import { useEffect, useRef } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getTrackingShippoKeyAction from '@/actions/orders/getTrackingShippoKey';
import listTrackableShipmentsAction from '@/actions/orders/listTrackableShipments';
import updateShipmentTrackingAction from '@/actions/orders/updateShipmentTracking';
import markShipmentDeliveredByTrackingAction from '@/actions/orders/markShipmentDeliveredByTracking';
import promoteDeliveredOrdersAction from '@/actions/orders/promoteDeliveredOrders';
import { getShippoTracking } from '@/lib/shippo';

type TrackableRow = {
  id: number; sales_order_id: number; carrier: string;
  tracking_number: string | null; tracking_status: string | null;
};

/**
 * Background tracking sync: on app load (admin/logistics sessions only, so
 * the tracking key never reaches other roles' browsers), polls Shippo for
 * every in-transit shipment and records the status; DELIVERED flips the
 * shipment — and the order, once fully delivered — automatically. The
 * 30-minute throttle lives in the listTrackableShipments query. Renders
 * nothing; page data loaded before a flip shows it on the next reload.
 */
export function ShipmentTrackingSync() {
  const { isAdmin, isLogistics } = useAppUser();
  const enabled = isAdmin || isLogistics;
  const [keyRaw] = useLoadAction(getTrackingShippoKeyAction, [enabled ? 1 : 0], {}, { enabled });
  const [shipsRaw] = useLoadAction(listTrackableShipmentsAction, [enabled ? 1 : 0], {}, { enabled });
  const [updateTracking] = useMutateAction(updateShipmentTrackingAction);
  const [markDelivered] = useMutateAction(markShipmentDeliveredByTrackingAction);
  const [promoteOrders] = useMutateAction(promoteDeliveredOrdersAction);
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    const key = asRows<{ shippo_api_key: string }>(keyRaw)[0]?.shippo_api_key;
    const ships = asRows<TrackableRow>(shipsRaw);
    if (!key || ships.length === 0) return;
    ran.current = true;
    (async () => {
      for (const s of ships) {
        try {
          const t = await getShippoTracking(key, s.carrier, dbText(s.tracking_number));
          if (t && t.status === 'DELIVERED') {
            await markDelivered({
              shipment_id: s.id,
              // status_date is ISO datetime; the column is a date
              delivered_date: t.statusDate ? t.statusDate.slice(0, 10) : null,
            });
          } else {
            // Stamp the poll time even when Shippo had nothing usable —
            // otherwise the row stays permanently due and re-polls on
            // every single app load.
            await updateTracking({ shipment_id: s.id, tracking_status: t ? t.status : (s.tracking_status ?? null) });
          }
        } catch {
          // One shipment failing (bad number, Shippo hiccup) must not stop
          // the rest; still try to stamp the throttle timestamp.
          try { await updateTracking({ shipment_id: s.id, tracking_status: s.tracking_status ?? null }); } catch { /* ignore */ }
        }
      }
      // Self-healing: promote any order whose shipments are now all
      // delivered (covers concurrent-sync races on multi-shipment orders).
      try { await promoteOrders({}); } catch { /* next sync retries */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keyRaw, shipsRaw]);

  return null;
}
