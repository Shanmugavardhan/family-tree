import React from 'react';
import { Filter, Archive } from 'lucide-react';

interface PersonFiltersProps {
  genderFilter: string;
  onGenderChange: (gender: string) => void;
  livingFilter: string;
  onLivingChange: (status: string) => void;
  includeArchived: boolean;
  onToggleArchived: (include: boolean) => void;
}

export const PersonFilters: React.FC<PersonFiltersProps> = ({
  genderFilter,
  onGenderChange,
  livingFilter,
  onLivingChange,
  includeArchived,
  onToggleArchived,
}) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-slate-500)', fontSize: '0.875rem' }}>
        <Filter size={16} />
        <span>Filters:</span>
      </div>

      <select
        className="form-select"
        style={{ width: 'auto', padding: '7px 12px', fontSize: '0.875rem' }}
        value={genderFilter}
        onChange={(e) => onGenderChange(e.target.value)}
      >
        <option value="all">All Genders</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other / Unknown</option>
      </select>

      <select
        className="form-select"
        style={{ width: 'auto', padding: '7px 12px', fontSize: '0.875rem' }}
        value={livingFilter}
        onChange={(e) => onLivingChange(e.target.value)}
      >
        <option value="all">Living & Deceased</option>
        <option value="living">Living Only</option>
        <option value="deceased">Deceased Only</option>
      </select>

      <button
        type="button"
        onClick={() => onToggleArchived(!includeArchived)}
        className={`btn btn-sm ${includeArchived ? 'btn-primary' : 'btn-secondary'}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Archive size={15} />
        <span>{includeArchived ? 'Showing Archived' : 'Show Archived'}</span>
      </button>
    </div>
  );
};

