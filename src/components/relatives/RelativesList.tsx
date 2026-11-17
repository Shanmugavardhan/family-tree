import React, { useState, useMemo } from 'react';
import { DerivedRelativesResponse, RelativeCategory, RelativeItem } from '../../types/relative';
import { RelativeCard } from './RelativeCard';
import { Users } from 'lucide-react';

interface RelativesListProps {
  relativesData: DerivedRelativesResponse;
}

export const RelativesList: React.FC<RelativesListProps> = ({ relativesData }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { relatives, target_person, total_count } = relativesData;

  const categoryConfigs: { key: RelativeCategory; label: string; count: number }[] = useMemo(() => {
    return [
      { key: 'parents', label: 'Parents', count: relatives.parents.length },
      { key: 'children', label: 'Children', count: relatives.children.length },
      { key: 'spouses', label: 'Spouses', count: relatives.spouses.length },
      { key: 'siblings', label: 'Siblings', count: relatives.siblings.length },
      { key: 'grandparents', label: 'Grandparents', count: relatives.grandparents.length },
      { key: 'grandchildren', label: 'Grandchildren', count: relatives.grandchildren?.length || 0 },
      { key: 'great_grandparents', label: 'Great-Grandparents', count: relatives.great_grandparents?.length || 0 },
      { key: 'uncles_aunts', label: 'Uncles & Aunts', count: relatives.uncles_aunts.length },
      { key: 'nephews_nieces', label: 'Nephews & Nieces', count: relatives.nephews_nieces.length },
      { key: 'cousins', label: 'First Cousins', count: relatives.cousins.length },
      { key: 'first_cousins_once_removed', label: 'First Cousins 1x Removed', count: relatives.first_cousins_once_removed?.length || 0 },
      { key: 'in_laws', label: 'In-Laws & Relatives by Marriage', count: relatives.in_laws?.length || 0 },
    ];
  }, [relatives]);

  const activeCategories = useMemo(() => {
    return categoryConfigs.filter((c) => c.count > 0);
  }, [categoryConfigs]);

  const displayedRelatives: RelativeItem[] = useMemo(() => {
    if (selectedCategory === 'all') {
      const all: RelativeItem[] = [
        ...relatives.parents,
        ...relatives.children,
        ...relatives.spouses,
        ...relatives.siblings,
        ...relatives.grandparents,
        ...(relatives.grandchildren || []),
        ...(relatives.great_grandparents || []),
        ...relatives.uncles_aunts,
        ...relatives.nephews_nieces,
        ...relatives.cousins,
        ...(relatives.first_cousins_once_removed || []),
        ...(relatives.in_laws || []),
      ];
      return all;
    }

    const catKey = selectedCategory as keyof typeof relatives;
    return relatives[catKey] || [];
  }, [relatives, selectedCategory]);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
          borderBottom: '1px solid var(--color-slate-100)',
          paddingBottom: 16,
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
            Relatives from {target_person.full_name}&apos;s Vantage Point
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: 2 }}>
            Perspective-dependent kinship dynamically derived across generations
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)' }}>
          <Users size={18} />
          <span>{total_count} Connected {total_count === 1 ? 'Relative' : 'Relatives'}</span>
        </div>
      </div>

      {/* Category Pills Filter */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: selectedCategory === 'all' ? 'var(--color-primary)' : 'var(--color-slate-200)',
            backgroundColor: selectedCategory === 'all' ? 'var(--color-primary-light)' : '#ffffff',
            color: selectedCategory === 'all' ? 'var(--color-primary)' : 'var(--color-slate-700)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          All ({total_count})
        </button>

        {activeCategories.map((c) => {
          const isSelected = selectedCategory === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelectedCategory(c.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-slate-200)',
                backgroundColor: isSelected ? 'var(--color-primary-light)' : '#ffffff',
                color: isSelected ? 'var(--color-primary)' : 'var(--color-slate-700)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {c.label} ({c.count})
            </button>
          );
        })}
      </div>

      {/* Relatives List */}
      {displayedRelatives.length === 0 ? (
        <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--color-slate-400)' }}>
          No relatives registered in this category yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {displayedRelatives.map((relative) => (
            <RelativeCard key={`${relative.person_id}-${relative.relationship}`} relative={relative} />
          ))}
        </div>
      )}
    </div>
  );
};
