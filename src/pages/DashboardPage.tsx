import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePersons } from '../hooks/usePersons';
import { Users, UserPlus, Heart, Sparkles, Clock, ArrowRight, ShieldCheck, GitFork } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { persons, loading } = usePersons({ includeArchived: true });

  const stats = useMemo(() => {
    const total = persons.length;
    const living = persons.filter((p) => p.is_living && !p.is_archived).length;
    const deceased = persons.filter((p) => !p.is_living && !p.is_archived).length;
    const archived = persons.filter((p) => p.is_archived).length;
    const recent = [...persons]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    return { total, living, deceased, archived, recent };
  }, [persons]);

  return (
    <div>
      {/* Welcome Hero Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          color: '#ffffff',
          padding: '32px',
          marginBottom: 28,
          border: 'none',
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.15)', padding: '4px 12px', borderRadius: 20, fontSize: '0.8125rem', marginBottom: 16 }}>
            <Sparkles size={14} />
            <span>Konukuru Family History Project — Phase 2</span>
          </div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 800, lineHeight: 1.25, marginBottom: 12 }}>
            Welcome to the Family Management System
          </h2>
          <p style={{ opacity: 0.9, fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: 24 }}>
            Explore family lineages, manage profiles and photographs, and view kinship derivations across generations.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link to="/tree" className="btn" style={{ backgroundColor: '#ffffff', color: 'var(--color-primary-hover)', fontWeight: 700 }}>
              <GitFork size={16} />
              <span>Explore Interactive Tree</span>
            </Link>
            <Link to="/people" className="btn" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}>
              <Users size={16} />
              <span>Browse Directory</span>
            </Link>
            <Link to="/people/new" className="btn" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}>
              <UserPlus size={16} />
              <span>Add Member</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 32 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Total Registered</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
            {loading ? '...' : stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', marginTop: 4 }}>
            Generations & branch members
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Living Members</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-emerald-50)', color: 'var(--color-emerald-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
            {loading ? '...' : stats.living}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-emerald-600)', marginTop: 4 }}>
            Active lineage
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Deceased Ancestors</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-slate-100)', color: 'var(--color-slate-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
            {loading ? '...' : stats.deceased}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', marginTop: 4 }}>
            Preserved historical records
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Archived</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-amber-50)', color: 'var(--color-amber-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
            {loading ? '...' : stats.archived}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-amber-700)', marginTop: 4 }}>
            Hidden from primary directory
          </div>
        </div>
      </div>

      {/* Recently Added / Canonical Highlight */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
            Family Members Highlight
          </h3>
          <Link to="/people" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>View All</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-slate-500)' }}>Loading family records...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.recent.map((person) => {
              const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
              return (
                <Link
                  key={person.id}
                  to={`/people/${person.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-slate-100)',
                    textDecoration: 'none',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-slate-50)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        backgroundColor: person.gender === 'female' ? '#fce7f3' : '#e0f2fe',
                        color: person.gender === 'female' ? '#be185d' : '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                      }}
                    >
                      {person.first_name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-slate-800)' }}>
                        {fullName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                        {person.birth_place ? `Place: ${person.birth_place}` : 'No birthplace listed'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge badge-${person.is_living ? 'living' : 'deceased'}`}>
                      {person.is_living ? 'Living' : 'Deceased'}
                    </span>
                    <ArrowRight size={14} color="var(--color-slate-400)" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
