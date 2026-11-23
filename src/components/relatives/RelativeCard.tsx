import React from 'react';
import { Link } from 'react-router-dom';
import { RelativeItem } from '../../types/relative';
import { personApi } from '../../services/personApi';
import { RelationshipBadge } from './RelationshipBadge';
import { ChevronRight } from 'lucide-react';
import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

interface RelativeCardProps {
  relative: RelativeItem;
}

export const RelativeCard: React.FC<RelativeCardProps> = ({ relative }) => {
  const photoUrl = relative.profile_photo ? personApi.getPhotoUrl(relative.person_id, relative.is_archived) : null;

  return (
    <Link
      to={`/people/${relative.person_id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--color-slate-200)',
        borderRadius: 'var(--radius-md)',
        transition: 'all 0.15s ease',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-slate-200)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={relative.full_name}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid var(--color-slate-200)',
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <img
            src={relative.gender === 'female' ? avatarFemale : avatarMale}
            alt={relative.full_name}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid var(--color-slate-200)',
              flexShrink: 0,
            }}
          />
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-slate-900)' }}>
              {relative.full_name}
            </span>
            <span className={`badge badge-${relative.is_living ? 'living' : 'deceased'}`} style={{ fontSize: '0.7rem' }}>
              {relative.is_living ? 'Living' : 'Deceased'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <RelationshipBadge relationship={relative.relationship} category={relative.category} />
            {relative.relationship_paths?.[0] && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>
                via {relative.relationship_paths[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      <ChevronRight size={18} color="var(--color-slate-400)" />
    </Link>
  );
};

