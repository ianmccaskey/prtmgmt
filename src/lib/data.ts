import { useLoadAction, useMutateAction as useMutateActionReal } from '@uibakery/data';
import { useAppUser } from '@/app/AppContext';

export { useLoadAction };

/**
 * Drop-in replacement for @uibakery/data's useMutateAction that refuses
 * every write for 'viewer' (read-only preview) accounts. App components
 * import their data hooks from HERE, never from @uibakery/data directly,
 * so read-only enforcement has ONE choke point: a write affordance that
 * slips past a role gate is still harmless — the mutation itself throws
 * before any SQL runs. (AppContext stays on @uibakery/data: it only
 * reads, and importing this module there would be circular.)
 */
export function useMutateAction(
  ...args: Parameters<typeof useMutateActionReal>
): ReturnType<typeof useMutateActionReal> {
  const result = useMutateActionReal(...args);
  const { role } = useAppUser();
  if (role !== 'viewer') return result;
  const refuse = async () => {
    throw new Error('This preview account is read-only — changes are disabled.');
  };
  const [, ...rest] = result as unknown as [unknown, ...unknown[]];
  return [refuse, ...rest] as unknown as ReturnType<typeof useMutateActionReal>;
}
