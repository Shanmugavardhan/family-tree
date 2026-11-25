import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck } from 'lucide-react';
import { useLineage } from '../../context/LineageContext';
import { personApi } from '../../services/personApi';
import { Person } from '../../types/person';
import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

export const WhoAreYouModal: React.FC = () => {
  const { needsViewerIdentity, setCurrentViewerId } = useLineage();
  const [members, setMembers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!needsViewerIdentity) return;
    let active = true;
    setLoading(true);
    personApi.getAll({ includeArchived: false }).then((res) => {
      if (!active) return;
      if (res.success && res.data) {
        // Rule (a): Show all living member tiles (exclude deceased)
        const living = res.data
          .filter((p) => p.is_living !== false && !p.death_date)
          .sort((a, b) => a.first_name.localeCompare(b.first_name));
        setMembers(living);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [needsViewerIdentity]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.first_name, m.middle_name, m.last_name, m.alias]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [members, search]);

  if (!needsViewerIdentity) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(8, 11, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '86vh',
          backgroundColor: '#121824',
          borderRadius: 20,
          border: '1.5px solid rgba(214, 177, 92, 0.45)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(214, 177, 92, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 16px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(214, 177, 92, 0.16)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4af37 0%, #856a18 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10141d',
              boxShadow: '0 0 20px rgba(214, 177, 92, 0.4)',
            }}
          >
            <UserCheck size={26} />
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Marcellus', Georgia, serif",
              fontSize: '1.55rem',
              fontWeight: 700,
              color: '#D6B15C',
              letterSpacing: '0.03em',
            }}
          >
            Who are you in this family?
          </h2>
          <p
            style={{
              margin: '6px 0 14px',
              fontSize: '0.86rem',
              color: '#9BA3AF',
              lineHeight: 1.45,
            }}
          >
            Select your profile below so we can personalize your family view and help verify recorded family details.
          </p>

          {/* Search filter */}
          <div
            style={{
              position: 'relative',
              maxWidth: 360,
              margin: '0 auto',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9BA3AF',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your name..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 10,
                border: '1px solid #2b3648',
                backgroundColor: '#1a2230',
                color: '#F1E9D7',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Scrollable Member Tiles Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9BA3AF', padding: 32 }}>
              Loading family members...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9BA3AF', padding: 32 }}>
              No matching living family members found.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
                gap: 14,
              }}
            >
              {filteredMembers.map((member) => {
                const fullName = [member.first_name, member.middle_name, member.last_name]
                  .filter(Boolean)
                  .join(' ');
                const fallbackAvatar =
                  member.gender?.toLowerCase() === 'female' ? avatarFemale : avatarMale;
                const photoSrc = member.profile_photo || fallbackAvatar;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setCurrentViewerId(member.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      padding: '14px 10px',
                      borderRadius: 14,
                      border: '1px solid rgba(214, 177, 92, 0.28)',
                      backgroundColor: '#19212e',
                      color: '#F1E9D7',
                      cursor: 'pointer',
                      transition: 'transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#D6B15C';
                      e.currentTarget.style.backgroundColor = '#212b3c';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(214, 177, 92, 0.28)';
                      e.currentTarget.style.backgroundColor = '#19212e';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: '50%',
                        border: '2px solid #D6B15C',
                        overflow: 'hidden',
                        backgroundColor: '#252E3A',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={photoSrc}
                        alt={fullName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        lineHeight: 1.25,
                        wordBreak: 'break-word',
                      }}
                    >
                      {fullName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
