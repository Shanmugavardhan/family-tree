import React, { useState, useEffect, useRef } from 'react';
import { Person } from '../../types/person';
import { personApi } from '../../services/personApi';
import { Search, X, User } from 'lucide-react';

interface RelationshipSelectorProps {
  label: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  genderHint?: 'male' | 'female';
  excludePersonId?: string;
  disabled?: boolean;
}

export const RelationshipSelector: React.FC<RelationshipSelectorProps> = ({
  label,
  selectedId,
  onSelect,
  genderHint,
  excludePersonId,
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch candidate info if selectedId is set
  useEffect(() => {
    if (selectedId) {
      personApi.getById(selectedId).then((res) => {
        if (res.success && res.data) {
          setSelectedPerson(res.data);
        }
      });
    } else {
      setSelectedPerson(null);
    }
  }, [selectedId]);

  // Search candidates when query changes or on focus
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    setLoading(true);

    personApi.getAll({ search: query.trim() }).then((res) => {
      if (isCancelled) return;
      setLoading(false);
      if (res.success && res.data) {
        let filtered = res.data;
        if (excludePersonId) {
          filtered = filtered.filter((p) => p.id !== excludePersonId);
        }
        if (genderHint) {
          filtered = filtered.filter((p) => p.gender === genderHint);
        }
        setCandidates(filtered);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [query, isOpen, genderHint, excludePersonId]);

  const handleSelect = (person: Person) => {
    setSelectedPerson(person);
    onSelect(person.id);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    setSelectedPerson(null);
    onSelect(null);
    setQuery('');
  };

  return (
    <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
      <label className="form-label">{label}</label>

      {selectedPerson ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            border: '1px solid var(--color-slate-200)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-slate-50)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: selectedPerson.gender === 'female' ? '#fce7f3' : '#e0f2fe',
                color: selectedPerson.gender === 'female' ? '#be185d' : '#0369a1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.8125rem',
              }}
            >
              {selectedPerson.first_name[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-slate-800)' }}>
                {[selectedPerson.first_name, selectedPerson.middle_name, selectedPerson.last_name].filter(Boolean).join(' ')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                {selectedPerson.birth_date ? `Born: ${selectedPerson.birth_date}` : 'No birth date'}
                {selectedPerson.alias ? ` (${selectedPerson.alias})` : ''}
              </div>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-secondary btn-sm"
              style={{ padding: 4 }}
              title="Remove selection"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-slate-400)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder={`Search ${label.toLowerCase()} by name...`}
            value={query}
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
          />
        </div>
      )}

      {/* Candidates Dropdown */}
      {isOpen && !selectedPerson && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 220,
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid var(--color-slate-200)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
          }}
        >
          {loading ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.8125rem' }}>
              Searching...
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-slate-500)', fontSize: '0.8125rem' }}>
              No matching people found.
            </div>
          ) : (
            candidates.map((p) => {
              const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-slate-100)',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-slate-50)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: p.gender === 'female' ? '#fce7f3' : '#e0f2fe',
                        color: p.gender === 'female' ? '#be185d' : '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {p.first_name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                        {name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                        {p.gender} {p.birth_date ? `· Born: ${p.birth_date}` : ''}
                      </div>
                    </div>
                  </div>
                  <User size={14} color="var(--color-slate-400)" />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
