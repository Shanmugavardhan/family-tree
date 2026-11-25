import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { partitionLineageMembers } from '../services/layoutApi';

export const GUEST_VIEWER_ID = 'GUEST';
export type ViewerRole = 'member' | 'guest';

/**
 * Computes the set of person IDs that belong to a given lineage (bloodline + direct spouses).
 */
export function getLineageMemberIdSet(
  persons: Person[],
  relationships: Relationship[],
  lineageId: string
): Set<string> {
  const { mainTreePersonIds } = partitionLineageMembers(persons, relationships, lineageId);
  return mainTreePersonIds;
}

/**
 * Determines whether the current viewer is acting as a full Member or as a Guest
 * in the currently active lineage.
 * - If viewerId is GUEST -> 'guest'
 * - If viewerId is not a member of activeLineageId (e.g. Navaneeth Galeti viewing Konukuru) -> 'guest'
 * - Otherwise -> 'member'
 */
export function getEffectiveViewerRole(
  viewerId: string | null,
  activeLineageId: string,
  lineageMemberMap: Record<string, Set<string>>
): ViewerRole {
  if (!viewerId || viewerId === GUEST_VIEWER_ID) {
    return 'guest';
  }
  const activeSet = lineageMemberMap[activeLineageId.toLowerCase()];
  if (!activeSet) {
    return 'member';
  }
  return activeSet.has(viewerId) ? 'member' : 'guest';
}

/**
 * Computes the updated unlockedLineages list when switching from `fromLineageId` to `toLineageId`.
 * Rule 3:
 * - If the viewer is a member of BOTH families (e.g. Meghana Konukuru is in both Konukuru and Paradarami),
 *   their access to the previous family is NOT retained (expires on switch).
 * - If the viewer is NOT a member of one of the families (e.g. Navaneeth Galeti is only in Paradarami,
 *   not Konukuru), their access to the non-member family IS retained when switching back.
 */
export function resolveUnlockedLineagesOnSwitch(params: {
  viewerId: string | null;
  fromLineageId: string;
  toLineageId: string;
  currentUnlocked: string[];
  lineageMemberMap: Record<string, Set<string>>;
}): string[] {
  const { viewerId, fromLineageId, toLineageId, currentUnlocked, lineageMemberMap } = params;
  const fromNorm = fromLineageId.toLowerCase();
  const toNorm = toLineageId.toLowerCase();

  const updated = new Set(currentUnlocked.map((id) => id.toLowerCase()));
  updated.add(toNorm);

  if (viewerId && viewerId !== GUEST_VIEWER_ID && fromNorm !== toNorm) {
    const inFrom = lineageMemberMap[fromNorm]?.has(viewerId) ?? false;
    const inTo = lineageMemberMap[toNorm]?.has(viewerId) ?? false;

    if (inFrom && inTo) {
      // Member of both families: do NOT retain access to both simultaneously
      updated.delete(fromNorm);
    }
  }

  return Array.from(updated);
}

