import React, { createContext, useContext, useState, useEffect } from 'react';
import { KNOWN_LINEAGES, LineageInfo } from '../types/lineage';

const UNLOCKED_LINEAGES_STORAGE_KEY = 'family_tree_unlocked_lineages';
const ACTIVE_LINEAGE_STORAGE_KEY = 'family_tree_active_lineage';

interface LineageContextType {
  activeLineage: LineageInfo;
  activeLineageId: string;
  unlockedLineages: string[];
  isFirstTimeLocked: boolean;
  isParadaramiParallelOpen: boolean;
  isParadaramiUnlocked: boolean;
  unlockWithCode: (inputCode: string) => { success: boolean; lineageId?: string; error?: string };
  switchLineage: (lineageId: string) => boolean;
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

  // Parallel viewer for mom's maternal lineage
  const [isParadaramiParallelOpen, setIsParadaramiParallelOpen] = useState(false);

  // First-timer is locked if they haven't unlocked ANY lineage or if active lineage is not in unlockedLineages
  const isFirstTimeLocked = !unlockedLineages.includes(activeLineageId);
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
        error: 'Invalid family code. Please enter a valid lineage code (e.g. KONU1290).',
      };
    }

    // Add to unlocked list if not present
    setUnlockedLineages((prev) => (prev.includes(matchedId!) ? prev : [...prev, matchedId!]));
    setActiveLineageId(matchedId);

    return { success: true, lineageId: matchedId };
  };

  const switchLineage = (lineageId: string): boolean => {
    if (!KNOWN_LINEAGES[lineageId]) return false;
    setActiveLineageId(lineageId);
    return true;
  };

  const openParadaramiParallel = () => {
    setIsParadaramiParallelOpen(true);
  };

  const closeParadaramiParallel = () => {
    setIsParadaramiParallelOpen(false);
  };

  const activeLineage = KNOWN_LINEAGES[activeLineageId] || KNOWN_LINEAGES.konukuru;

  return (
    <LineageContext.Provider
      value={{
        activeLineage,
        activeLineageId,
        unlockedLineages,
        isFirstTimeLocked,
        isParadaramiParallelOpen,
        isParadaramiUnlocked,
        unlockWithCode,
        switchLineage,
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
