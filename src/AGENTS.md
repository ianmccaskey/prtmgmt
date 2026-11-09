# Rules for editing this app

## Loading data (`@uibakery/data`)
- `useLoadAction(action, defaultValue, params, options)`: the SECOND argument is the value the hook returns WHILE the action loads (`@uibakery/data` d.ts), not a dependency list — a re-read follows `params` (and `enabled`). Always pass `[]`. Every call here once passed ids there (`[order.order_id]`, `[range.from, range.to, division]`), which came back as fake "rows" during loading — the Mark Shipped dialog once rehydrated one as "warehouse #NaN" (swept 2026-11-09).
- Read results through `rows()` / `firstRow()` (`lib/rows.ts`, objects only) and treat an empty list as "none" only once the loading flag is false.
- A dialog or panel that must read fresh each time it opens on the same params calls `useReloadOnOpen(<its enabled condition, or the id it shows>, reload…)` (`hooks/use-reload-on-open.ts`); a per-opening read can also remount with a `key`.

## Verify
`cd src && bunx tsc --noEmit && bun run lint`.
