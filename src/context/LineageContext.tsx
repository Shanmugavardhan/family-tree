import React, { createContext, useContext, useState, useEffect } from 'react';
import { KNOWN_LINEAGES, LineageInfo } from '../types/lineage';
import { personApi } from '../services/personApi';
import { relationshipApi } from '../services/relationshipApi';
import {
  ViewerRole,
  getLineageMemberIdSet,
  getEffectiveViewerRole,
  resolveUnlockedLineagesOnSwitch,
} from '../utils/viewerRole';

const UNLOCKED_LINEAGES_STORAGE_KEY = 'family_tree_unlocked_lineages';
const ACTIVE_LINEAGE_STORAGE_KEY = 'family_tree_active_lineage';
const VIEWER_IDENTITY_STORAGE_KEY = 'family_tree_viewer_id';

interface LineageContextType {
  activeLineage: LineageInfo;
  activeLineageId: string;
  unlockedLineages: string[];
  isFirstTimeLocked: boolean;
  currentViewerId: string | null;
  needsViewerIdentity: boolean;
  effectiveRole: ViewerRole;
  isGuestRole: boolean;
  lineageMemberMap: Record<string, Set<string>>;
  setCurrentViewerId: (personId: string | null) => void;
  expandedLineagePersonId: string | null;
  isParadaramiUnlocked: boolean;
  unlockWithCode: (inputCode: string) => { success: boolean; lineageId?: string; error?: string };
  switchLineage: (lineageId: string) => boolean;
  toggleLineageOnMap: (personId: string) => void;
  setExpandedLineagePersonId: (personId: string | null) => void;
  // Kept for backward compatibility
  isParadaramiParallelOpen: boolean;
  openParadaramiParallel: () => void;
  closeParadaramiParallel: () => void;
}

const LineageContext = createContext<LineageContextType | undefined>(undefined);

export const LineageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Load unlocked lineages from storage
  const [unlockedLineages, setUnlockedLineages] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(UNLOCKED_LINEAGES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });

  // 2. Active lineage ID
  const [activeLineageId, setActiveLineageId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_LINEAGE_STORAGE_KEY);
      if (saved && KNOWN_LINEAGES[saved]) return saved;
    } catch {
      // fallback
    }
    return 'konukuru';
  });

  // 3. Current viewer identity ("Who are you in this family?")
  const [currentViewerId, setCurrentViewerIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VIEWER_IDENTITY_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const setCurrentViewerId = (personId: string | null) => {
    setCurrentViewerIdState(personId);
    try {
      if (personId) {
        localStorage.setItem(VIEWER_IDENTITY_STORAGE_KEY, personId);
      } else {
        localStorage.removeItem(VIEWER_IDENTITY_STORAGE_KEY);
      }
    } catch {}
  };

  // 4. Lineage member sets (to scope "Who are you?", resolve Guest role across families, and handle code expiry)
  const [lineageMemberMap, setLineageMemberMap] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    let active = true;
    Promise.all([
      personApi.getAll({ includeArchived: false }),
      relationshipApi.getAll(),
    ])
      .then(([pRes, rRes]) => {
        if (!active || !pRes.success || !pRes.data) return;
        const persons = pRes.data;
        const rels = rRes.data || [];
        const map: Record<string, Set<string>> = {};
        for (const lid of Object.keys(KNOWN_LINEAGES)) {
          map[lid] = getLineageMemberIdSet(persons, rels, lid);
        }
        setLineageMemberMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [unlockedLineages.length]);

  // Rule 2: Remember person & code on device until hard refresh (Ctrl + Shift + R)
  useEffect(() => {
    const handleHardRefreshShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        try {
          localStorage.removeItem(VIEWER_IDENTITY_STORAGE_KEY);
          localStorage.removeItem(UNLOCKED_LINEAGES_STORAGE_KEY);
        } catch {}
      }
    };
    window.addEventListener('keydown', handleHardRefreshShortcut);
    return () => window.removeEventListener('keydown', handleHardRefreshShortcut);
  }, []);

  // Requirement 1: View lineage directly on the map (no separate window)
  const [expandedLineagePersonId, setExpandedLineagePersonId] = useState<string | null>(null);

  // First-timer is locked if they haven't unlocked ANY lineage or if active lineage is not in unlockedLineages
  const isFirstTimeLocked = !unlockedLineages.includes(activeLineageId);
  const needsViewerIdentity = !isFirstTimeLocked && !currentViewerId;
  const effectiveRole = getEffectiveViewerRole(currentViewerId, activeLineageId, lineageMemberMap);
  const isGuestRole = effectiveRole === 'guest';
  const isParadaramiUnlocked = unlockedLineages.includes('paradarami');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(UNLOCKED_LINEAGES_STORAGE_KEY, JSON.stringify(unlockedLineages));
  }, [unlockedLineages]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_LINEAGE_STORAGE_KEY, activeLineageId);
  }, [activeLineageId]);

  // Unlock by Family Code
  const unlockWithCode = (inputCode: string) => {
    const trimmed = inputCode.trim().toUpperCase();
    if (!trimmed) {
      return { success: false, error: 'Please enter a family access code.' };
    }

    // Match code against known lineages
    let matchedId: string | null = null;
    for (const [id, info] of Object.entries(KNOWN_LINEAGES)) {
      if (info.code.toUpperCase() === trimmed) {
        matchedId = id;
        break;
      }
    }

    if (!matchedId) {
      return {
        success: false,
        error: 'Invalid family code. Please enter the secret code for your family.',
      };
    }

    setUnlockedLineages((prev) =>
      resolveUnlockedLineagesOnSwitch({
        viewerId: currentViewerId,
        fromLineageId: activeLineageId,
        toLineageId: matchedId!,
        currentUnlocked: prev,
        lineageMemberMap,
      })
    );
    setActiveLineageId(matchedId);
    setExpandedLineagePersonId(null);

    return { success: true, lineageId: matchedId };
  };

  const switchLineage = (lineageId: string): boolean => {
    if (!KNOWN_LINEAGES[lineageId]) return false;
    if (lineageId !== activeLineageId) {
      setUnlockedLineages((prev) => {
        const wasUnlocked = prev.includes(lineageId);
        if (!wasUnlocked) return prev;
        return resolveUnlockedLineagesOnSwitch({
          viewerId: currentViewerId,
          fromLineageId: activeLineageId,
          toLineageId: lineageId,
          currentUnlocked: prev,
          lineageMemberMap,
        });
      });
    }
    setActiveLineageId(lineageId);
    setExpandedLineagePersonId(null);
    return true;
  };

  const toggleLineageOnMap = (personId: string) => {
    setExpandedLineagePersonId((prev) => (prev === personId ? null : personId));
  };

  const openParadaramiParallel = () => {
    setExpandedLineagePersonId('5c561a7d-3fee-4112-af6e-286f7a8ad61b');
  };

  const closeParadaramiParallel = () => {
    setExpandedLineagePersonId(null);
  };

  const activeLineage = KNOWN_LINEAGES[activeLineageId] || KNOWN_LINEAGES.konukuru;

  return (
    <LineageContext.Provider
      value={{
        activeLineage,
        activeLineageId,
        unlockedLineages,
        isFirstTimeLocked,
        currentViewerId,
        needsViewerIdentity,
        effectiveRole,
        isGuestRole,
        lineageMemberMap,
        setCurrentViewerId,
        expandedLineagePersonId,
        isParadaramiUnlocked,
        unlockWithCode,
        switchLineage,
        toggleLineageOnMap,
        setExpandedLineagePersonId,
        isParadaramiParallelOpen: !!expandedLineagePersonId,
        openParadaramiParallel,
        closeParadaramiParallel,
      }}
    >
      {children}
    </LineageContext.Provider>
  );
};

export const useLineage = (): LineageContextType => {
  const context = useContext(LineageContext);
  if (!context) {
    throw new Error('useLineage must be used within a LineageProvider');
  }
  return context;
};
