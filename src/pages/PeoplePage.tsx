import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePersons } from '../hooks/usePersons';
import { PersonCard } from '../components/persons/PersonCard';
import { PersonSearch } from '../components/persons/PersonSearch';
import { PersonFilters } from '../components/persons/PersonFilters';
import { UserPlus, Users, AlertCircle, RefreshCw } from 'lucide-react';

export const PeoplePage: React.FC = () => {
  const {
    persons,
    loading,
    error,
    search,
    setSearch,
    includeArchived,
    setIncludeArchived,
    refetch,
    archive,
    restore,
  } = usePersons();

  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [livingFilter, setLivingFilter] = useState<string>('all');

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      // Gender filter
      if (genderFilter !== 'all') {
        if (genderFilter === 'other') {
          if (p.gender === 'male' || p.gender === 'female') return false;
        } else if (p.gender !== genderFilter) {
          return false;
        }
      }

      // Living filter
      if (livingFilter === 'living' && !p.is_living) return false;
      if (livingFilter === 'deceased' && p.is_living) return false;

      return true;
    });
  }, [persons, genderFilter, livingFilter]);

  return (
    <div>
      {/* Top action bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
            Family Members Directory
          </h2>
          <p style={{ color: 'var(--color-slate-500)', fontSize: '0.875rem' }}>
            Browse and manage all registered members of the family tree
          </p>
        </div>

        <Link to="/people/new" className="btn btn-primary">
          <UserPlus size={18} />
          <span>Add New Member</span>
        </Link>
      </div>

      {/* Search and Filters card */}
      <div
        className="card"
        style={{
          marginBottom: 28,
          padding: '18px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <PersonSearch value={search} onChange={setSearch} />
        <PersonFilters
          genderFilter={genderFilter}
          onGenderChange={setGenderFilter}
          livingFilter={livingFilter}
          onLivingChange={setLivingFilter}
          includeArchived={includeArchived}
          onToggleArchived={setIncludeArchived}
        />
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            background: 'var(--color-rose-50)',
            border: '1px solid var(--color-rose-100)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--color-rose-700)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} />
            <div>
              <strong>Error Loading People:</strong> {error}
            </div>
          </div>
          <button onClick={refetch} className="btn btn-sm btn-secondary" style={{ color: 'var(--color-slate-800)' }}>
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-slate-500)' }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid var(--color-slate-200)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p>Loading family members...</p>
        </div>
      ) : filteredPersons.length === 0 ? (
        /* Empty state */
        <div
          className="card"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: 'var(--color-slate-500)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--color-slate-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--color-slate-400)',
            }}
          >
            <Users size={32} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-slate-800)', marginBottom: 6 }}>
            No Family Members Found
          </h3>
          <p style={{ maxWidth: 400, margin: '0 auto 20px', fontSize: '0.875rem' }}>
            {search || genderFilter !== 'all' || livingFilter !== 'all'
              ? 'No members match your current search and filter criteria. Try clearing some filters.'
              : 'There are currently no members in the family tree. Start by adding the first member!'}
          </p>
          {search || genderFilter !== 'all' || livingFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearch('');
                setGenderFilter('all');
                setLivingFilter('all');
              }}
              className="btn btn-secondary btn-sm"
            >
              Reset Filters
            </button>
          ) : (
            <Link to="/people/new" className="btn btn-primary btn-sm">
              <UserPlus size={16} />
              <span>Add First Person</span>
            </Link>
          )}
        </div>
      ) : (
        /* Cards Grid */
        <>
          <div style={{ marginBottom: 16, fontSize: '0.875rem', color: 'var(--color-slate-500)', fontWeight: 500 }}>
            Showing {filteredPersons.length} {filteredPersons.length === 1 ? 'member' : 'members'}
            {includeArchived && ' (including archived)'}
          </div>
          <div className="grid-cards">
            {filteredPersons.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onArchive={archive}
                onRestore={restore}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

