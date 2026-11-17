import React from 'react';
import { Search, X } from 'lucide-react';

interface PersonSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const PersonSearch: React.FC<PersonSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search by name, alias, or place...',
}) => {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      <Search
        size={18}
        style={{
          position: 'absolute',
          left: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-slate-400)',
        }}
      />
      <input
        type="text"
        className="form-input"
        style={{ paddingLeft: 42, paddingRight: value ? 40 : 14 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--color-slate-400)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

