import React from 'react';
import { Link } from 'react-router-dom';
import { Person } from '../../types/person';
import { personApi } from '../../services/personApi';
import { Calendar, MapPin, Edit3, Eye, Archive, RotateCcw } from 'lucide-react';
import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

interface PersonCardProps {
  person: Person;
  onArchive?: (id: string) => Promise<boolean>;
  onRestore?: (id: string) => Promise<boolean>;
}

export const PersonCard: React.FC<PersonCardProps> = ({ person, onArchive, onRestore }) => {
  const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');

  const photoUrl = person.profile_photo ? personApi.getPhotoUrl(person.id, person.is_archived) : null;

  const handleArchiveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (person.is_archived) {
      if (window.confirm(`Restore ${fullName} to active family members?`)) {
        await onRestore?.(person.id);
      }
    } else {
      if (window.confirm(`Are you sure you want to archive ${fullName}? They will be hidden from default views.`)) {
        await onArchive?.(person.id);
      }
    }
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        opacity: person.is_archived ? 0.75 : 1,
        borderColor: person.is_archived ? 'var(--color-amber-200)' : 'var(--color-slate-200)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={fullName}
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--color-slate-200)',
                boxShadow: 'var(--shadow-sm)',
              }}
              onError={(e) => {
                // fallback to initials on broken image
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <img
              src={person.gender === 'female' ? avatarFemale : avatarMale}
              alt={fullName}
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--color-slate-200)',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0,
              }}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <span className={`badge badge-${person.is_living ? 'living' : 'deceased'}`}>
                {person.is_living ? 'Living' : 'Deceased'}
              </span>
              <span className={`badge badge-${person.gender}`}>
                {person.gender}
              </span>
              {person.is_archived && (
                <span className="badge badge-archived">Archived</span>
              )}
            </div>
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--color-slate-900)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={fullName}
            >
              {fullName}
            </h3>
            {person.alias && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', fontStyle: 'italic' }}>
                aka &ldquo;{person.alias}&rdquo;
              </p>
            )}
          </div>
        </div>

        <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: 16 }}>
          {person.birth_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Calendar size={14} color="var(--color-slate-400)" />
              <span>Born: {person.birth_date}</span>
            </div>
          )}
          {person.death_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Calendar size={14} color="var(--color-rose-600)" />
              <span>Passed: {person.death_date}</span>
            </div>
          )}
          {(person.birth_place || person.death_place) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color="var(--color-slate-400)" />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {person.birth_place || person.death_place}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 14,
          borderTop: '1px solid var(--color-slate-100)',
        }}
      >
        <Link to={`/people/${person.id}`} className="btn btn-secondary btn-sm">
          <Eye size={15} />
          <span>Profile</span>
        </Link>

        <div style={{ display: 'flex', gap: 6 }}>
          {!person.is_archived && (
            <Link to={`/people/${person.id}/edit`} className="btn btn-secondary btn-sm" title="Edit Profile">
              <Edit3 size={15} />
            </Link>
          )}

          <button
            type="button"
            onClick={handleArchiveToggle}
            className={`btn btn-sm ${person.is_archived ? 'btn-secondary' : 'btn-danger'}`}
            title={person.is_archived ? 'Restore' : 'Archive'}
          >
            {person.is_archived ? <RotateCcw size={15} /> : <Archive size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
};

