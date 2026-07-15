type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;

/**
 * True when an "outside" pointerdown on a modal is not a real dismiss
 * intent:
 * - the second click of a double-click — the first click closed a portaled
 *   Select/Popover, so the second lands on the overlay where the popper was
 *   (Radix dialogs otherwise dismiss on it);
 * - a click inside any portaled popper (Select dropdown, combobox), which
 *   lives outside the dialog's DOM node.
 */
export function isGhostOutsideClick(event: PointerDownOutsideEvent): boolean {
  const original = event.detail.originalEvent;
  if (original.detail > 1) return true;
  const target = original.target as Element | null;
  return !!target?.closest?.('[data-radix-popper-content-wrapper]');
}
