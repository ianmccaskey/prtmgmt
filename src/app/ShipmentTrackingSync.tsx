import { useEffect, useRef } from 'react';
import { rows as asRows } from '@/lib/rows';
import { dbText } from '@/lib/dbText';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';
import getTrackingShippoKeyAction from '@/actions/orders/getTrackingShippoKey';
import listTrackableShipmentsAction from '@/actions/orders/listTrackableShipments';
import updateShipmentTrackingAction from '@/actions/orders/updateShipmentTracking';
import markShipmentDeliveredByTrackingAction from '@/actions/orders/markShipmentDeliveredByTracking';
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
          if (!t) continue;
          if (t.status === 'DELIVERED') {
            await markDelivered({
              shipment_id: s.id,
              // status_date is ISO datetime; the column is a date
              delivered_date: t.statusDate ? t.statusDate.slice(0, 10) : null,
            });
          } else {
            await updateTracking({ shipment_id: s.id, tracking_status: t.status });
          }
        } catch {
          // One shipment failing (bad number, Shippo hiccup) must not stop the rest.
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keyRaw, shipsRaw]);

  return null;
}
