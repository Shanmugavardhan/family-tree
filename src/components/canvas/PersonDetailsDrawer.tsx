import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactFlow } from '@xyflow/react';
import {
  X,
  Calendar,
  MapPin,
  ExternalLink,
  Edit,
  Users,
  Heart,
  ArrowUpRight,
  ArrowDownRight,
  Navigation,
} from 'lucide-react';
import { PositionedNode } from '../../types/layout';
import { personApi } from '../../services/personApi';
import { verificationApi, buildFactId, getVerificationBadgeInfo } from '../../services/verificationApi';
import { VerificationRecord } from '../../types/verification';
import { Person } from '../../types/person';
import { DerivedRelativesResponse, RelativeItem } from '../../types/relative';
import { useTheme } from '../../context/ThemeContext';
import { useLineage } from '../../context/LineageContext';
import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

interface PersonDetailsDrawerProps {
  personId: string | null;
  onClose: () => void;
  allNodes: PositionedNode[];
  onSelectPerson: (id: string) => void;
  onTraceAncestors?: (id: string) => void;
  onTraceDescendants?: (id: string) => void;
  onOpenPathfinder?: (sourceId: string) => void;
  onEditPerson?: (id: string) => void;
}

export const PersonDetailsDrawer: React.FC<PersonDetailsDrawerProps> = ({
  personId,
  onClose,
  allNodes,
  onSelectPerson,
  onTraceAncestors,
  onTraceDescendants,
  onOpenPathfinder,
  onEditPerson,
}) => {
  const { isDark } = useTheme();
  const { isGuestRole } = useLineage();
  const navigate = useNavigate();
  const { setCenter } = useReactFlow();

  const [person, setPerson] = React.useState<Person | null>(null);
  const [relatives, setRelatives] = React.useState<DerivedRelativesResponse | null>(null);
  const [verificationMap, setVerificationMap] = React.useState<Record<string, VerificationRecord>>({});
  const [loading, setLoading] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);

  const activeNode = allNodes.find((n) => n.id === personId);

  React.useEffect(() => {
    setImageFailed(false);
  }, [activeNode?.photoPath, personId]);

  React.useEffect(() => {
    if (!personId) {
      setPerson(null);
      setRelatives(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    Promise.all([
      personApi.getById(personId),
      personApi.getRelatives(personId),
      verificationApi.getAllMap(),
    ])
      .then(([personRes, relRes, verRes]) => {
        if (isMounted) {
          if (personRes.success && personRes.data) {
            setPerson(personRes.data);
          }
          if (relRes.success && relRes.data) {
            setRelatives(relRes.data);
          }
          if (verRes.success && verRes.data) {
            setVerificationMap(verRes.data);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [personId]);

  if (!personId || !activeNode) return null;

  const fullName = [activeNode.firstName, activeNode.middleName, activeNode.lastName]
    .filter(Boolean)
    .join(' ');

  const handleFocusRelative = (relPersonId: string) => {
    const targetNode = allNodes.find((n) => n.id === relPersonId);
    if (targetNode) {
      onSelectPerson(relPersonId);
      setCenter(targetNode.x + targetNode.width / 2, targetNode.y + targetNode.height / 2, {
        duration: 800,
        zoom: 1.35,
      });
    }
  };

  return (
    <div
      className="person-details-drawer"
      style={{
        position: 'absolute',
        top: 64,
        right: 0,
        bottom: 0,
        width: 'min(380px, 100vw)',
        maxWidth: '100vw',
        backgroundColor: isDark ? '#151922' : '#fcf8ee',
        boxShadow: isDark ? '-4px 0 24px rgba(0, 0, 0, 0.7)' : '-4px 0 20px rgba(120, 53, 15, 0.1)',
        borderLeft: `1.5px solid ${isDark ? '#343D49' : 'rgba(197, 155, 39, 0.4)'}`,
        color: isDark ? '#F1E9D7' : '#1c1917',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Mobile Bottom Sheet Pull Pill */}
      <div
        className="drawer-drag-handle-container"
        style={{
          display: 'none',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 4,
          backgroundColor: isDark ? '#1D2633' : '#f6efe2',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
      >
        <div
          style={{
            width: 44,
            height: 4.5,
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(214, 177, 92, 0.45)' : 'rgba(180, 130, 40, 0.45)',
          }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${isDark ? '#343D49' : '#e2d7c3'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isDark ? '#1D2633' : '#f6efe2',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: isDark ? '#D6B15C' : '#78350f', fontSize: '0.95rem', fontFamily: "'Marcellus', Georgia, serif", fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <span>Family Member Details</span>
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 4,
            cursor: 'pointer',
            color: isDark ? '#94a3b8' : '#78716c',
            borderRadius: 6,
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Body Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Profile Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: isDark ? '#1a2230' : '#f0e6d2',
              color: isDark ? '#e5c158' : '#78350f',
              border: `2px solid ${isDark ? '#d4af37' : '#c59b27'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 800,
              fontFamily: "'Marcellus', serif",
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {activeNode.photoPath && !imageFailed ? (
              <img
                src={
                  activeNode.photoPath.startsWith('http') ||
                  activeNode.photoPath.startsWith('data:') ||
                  activeNode.photoPath.startsWith('/')
                    ? activeNode.photoPath
                    : `/api/persons/${activeNode.personId}/photo`
                }
                alt={fullName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <img
                src={activeNode.gender?.toLowerCase() === 'female' ? avatarFemale : avatarMale}
                alt={fullName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              style={{
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: '1.2rem',
                fontWeight: 650,
                color: isDark ? '#F1E9D7' : '#1c1917',
                lineHeight: 1.25,
                wordBreak: 'break-word',
                letterSpacing: '-0.01em',
              }}
            >
              {fullName}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: isDark ? '#D6B15C' : '#78350f',
                  backgroundColor: isDark ? 'rgba(214, 177, 92, 0.16)' : '#fffbeb',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: isDark ? '1px solid rgba(214, 177, 92, 0.35)' : '1px solid #fde68a',
                  letterSpacing: '0.02em',
                }}
              >
                {activeNode.generationName || 'Family Cohort'}
              </span>
              {!activeNode.isLiving && (
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.75rem',
                    color: isDark ? '#9BA3AF' : '#78716c',
                    fontStyle: 'italic',
                    fontWeight: 500,
                  }}
                >
                  † Deceased
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Vital Info */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(() => {
            const dobBadge = getVerificationBadgeInfo(
              verificationMap[buildFactId('person', personId, 'birth_date')]
            );
            const placeBadge = getVerificationBadgeInfo(
              verificationMap[buildFactId('person', personId, 'birth_place')]
            );
            const renderBadge = (badge: ReturnType<typeof getVerificationBadgeInfo>) => (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 999,
                  backgroundColor: badge.isVerified
                    ? 'rgba(16, 185, 129, 0.14)'
                    : 'rgba(245, 158, 11, 0.14)',
                  color: badge.isVerified ? '#059669' : '#d97706',
                  border: badge.isVerified
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : '1px solid rgba(245, 158, 11, 0.35)',
                  whiteSpace: 'nowrap',
                }}
              >
                {badge.isVerified ? '2/2 ✓ Verified' : badge.label}
              </span>
            );

            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475569' }}>
                  <Calendar size={15} color="#64748b" />
                  <span>
                    DOB: {activeNode.birthDate || (activeNode.birthYear ? String(activeNode.birthYear) : 'Unknown')}
                  </span>
                  {(activeNode.birthDate || activeNode.birthYear) && renderBadge(dobBadge)}
                </div>
                {person?.birth_place && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#475569' }}>
                    <MapPin size={15} color="#64748b" />
                    <span>Place: {person.birth_place}</span>
                    {renderBadge(placeBadge)}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Tree Exploration Quick Actions */}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tree Exploration
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={() => onTraceAncestors?.(personId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 8,
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowUpRight size={14} />
              <span>Trace Ancestors</span>
            </button>

            <button
              onClick={() => onTraceDescendants?.(personId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 8,
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowDownRight size={14} />
              <span>Trace Descendants</span>
            </button>
          </div>

          {!isGuestRole && (
            <button
              onClick={() => onOpenPathfinder?.(personId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: 2,
              }}
            >
              <Navigation size={14} />
              <span>Find Relationship To...</span>
            </button>
          )}
        </div>

        {/* Biography */}
        {person?.biography && (
          <div style={{ marginTop: 20, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
              Biography
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.4 }}>
              {person.biography}
            </p>
          </div>
        )}

        {/* Immediate Family Links */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} />
            <span>Immediate Family</span>
          </div>

          {loading ? (
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>Loading family links...</div>
          ) : relatives?.relatives ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Parents */}
              {relatives.relatives.parents?.map((p: RelativeItem) => (
                <div
                  key={p.person_id}
                  onClick={() => handleFocusRelative(p.person_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    border: '1px solid #f1f5f9',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
                    {p.full_name}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'capitalize' }}>
                    {p.relationship}
                  </span>
                </div>
              ))}

              {/* Spouses */}
              {relatives.relatives.spouses?.map((s: RelativeItem) => (
                <div
                  key={s.person_id}
                  onClick={() => handleFocusRelative(s.person_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    backgroundColor: '#fff1f2',
                    cursor: 'pointer',
                    border: '1px solid #ffe4e6',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ffe4e6')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff1f2')}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#9f1239', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Heart size={12} fill="#e11d48" color="#e11d48" />
                    {s.full_name}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: '#e11d48', fontWeight: 600 }}>{s.relationship}</span>
                </div>
              ))}

              {/* Children */}
              {relatives.relatives.children?.map((c: RelativeItem) => (
                <div
                  key={c.person_id}
                  onClick={() => handleFocusRelative(c.person_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    border: '1px solid #f1f5f9',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
                    {c.full_name}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>{c.relationship}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>No relatives found.</div>
          )}
        </div>
      </div>

      {/* Footer Navigation Actions */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: 10,
          backgroundColor: '#f8fafc',
        }}
      >
        <button
          onClick={() => navigate(`/people/${personId}`)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 14px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: 8,
            border: 'none',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ExternalLink size={15} />
          <span>Full Profile</span>
        </button>

        {!isGuestRole && (
          <button
            onClick={() => {
              if (onEditPerson && personId) {
                onEditPerson(personId);
              } else {
                navigate(`/people/${personId}/edit`);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 14px',
              backgroundColor: '#ffffff',
              color: '#334155',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Edit size={15} />
            <span>Edit</span>
          </button>
        )}
      </div>
    </div>
  );
};
