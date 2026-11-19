import React from 'react';
import { Handle, Position, useViewport, useUpdateNodeInternals } from '@xyflow/react';
import { useNavigate } from 'react-router-dom';
import { Pencil, User, Shield, Lock } from 'lucide-react';
import { PersonNodeData } from '../../adapters/reactFlowAdapter';
import { useTheme } from '../../context/ThemeContext';
import { useLineage } from '../../context/LineageContext';

/**
 * Noble Lady / Princess Avatar (Game of Thrones Targaryen / Westeros Aesthetic)
 */
const FemaleNobleAvatar: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }}>
    <defs>
      <radialGradient id="fem-bg" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stopColor="#4a0e14" />
        <stop offset="65%" stopColor="#24070a" />
        <stop offset="100%" stopColor="#0f0204" />
      </radialGradient>
      <linearGradient id="fem-hair" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="40%" stopColor="#e2d4a8" />
        <stop offset="100%" stopColor="#a38243" />
      </linearGradient>
      <linearGradient id="fem-tiara" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#d4af37" />
        <stop offset="50%" stopColor="#fef08a" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="fem-robe" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#881337" />
        <stop offset="100%" stopColor="#4c0519" />
      </linearGradient>
    </defs>
    {/* Background Disc */}
    <circle cx="50" cy="50" r="49" fill="url(#fem-bg)" />

    {/* Back Hair Cascades */}
    <path
      d="M24 50 C20 68 28 88 34 98 C36 84 32 68 34 52 Z M76 50 C80 68 72 88 66 98 C64 84 68 68 66 52 Z"
      fill="url(#fem-hair)"
      opacity="0.9"
    />

    {/* Robe / Gown Shoulders */}
    <path
      d="M18 100 C20 84 35 76 50 78 C65 76 80 84 82 100 Z"
      fill="url(#fem-robe)"
    />
    <path
      d="M38 80 L50 88 L62 80 L50 78 Z"
      fill="#d4af37"
      opacity="0.8"
    />

    {/* Elegant Neck & Delicate Face Profile */}
    <path d="M43 62 L43 78 C46 80 54 80 57 78 L57 62 Z" fill="#fde2d0" />
    <path
      d="M36 40 C36 28 42 22 50 22 C58 22 64 28 64 40 C64 54 58 64 50 64 C42 64 36 54 36 40 Z"
      fill="#fed7aa"
    />

    {/* Facial Features (Serene Noble Eyes, Lips, Brows) */}
    <path d="M42 38 Q45 36 48 38" stroke="#78350f" strokeWidth="1" fill="none" />
    <path d="M52 38 Q55 36 58 38" stroke="#78350f" strokeWidth="1" fill="none" />
    <path d="M43 42 Q45.5 44 47 42" stroke="#451a03" strokeWidth="1.2" fill="none" />
    <path d="M53 42 Q54.5 44 57 42" stroke="#451a03" strokeWidth="1.2" fill="none" />
    <path d="M50 43 L49 49 L51 49" stroke="#ea580c" strokeWidth="0.8" fill="none" opacity="0.6" />
    <path d="M46 54 Q50 57 54 54" stroke="#be123c" strokeWidth="1.4" fill="none" />

    {/* Royal Braided Hair Framing Face */}
    <path
      d="M34 38 C32 24 40 16 50 16 C60 16 68 24 66 38 C64 34 60 27 50 27 C40 27 36 34 34 38 Z"
      fill="url(#fem-hair)"
    />
    <path
      d="M34 38 C35 50 38 60 41 68 C39 62 36 52 35 44 Z M66 38 C65 50 62 60 59 68 C61 62 64 52 65 44 Z"
      fill="url(#fem-hair)"
    />

    {/* Golden Royal Tiara / Circlet */}
    <path
      d="M38 27 Q50 23 62 27 L64 25 Q50 21 36 25 Z"
      fill="url(#fem-tiara)"
    />
    <polygon points="50,19 53,24 47,24" fill="url(#fem-tiara)" />
    <circle cx="50" cy="22" r="1.5" fill="#e11d48" />
  </svg>
);

/**
 * Noble Lord / Knight Avatar (Game of Thrones Stark / Baratheon Aesthetic)
 */
const MaleNobleAvatar: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }}>
    <defs>
      <radialGradient id="male-bg" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="65%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#040711" />
      </radialGradient>
      <linearGradient id="male-hair" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <linearGradient id="male-armor" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="50%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
    </defs>
    {/* Background Disc */}
    <circle cx="50" cy="50" r="49" fill="url(#male-bg)" />

    {/* Valyrian Steel / Dark Leather Mantle */}
    <path
      d="M14 100 C16 80 32 72 50 74 C68 72 84 80 86 100 Z"
      fill="url(#male-armor)"
    />
    {/* Fur Collar Trim */}
    <path
      d="M26 84 C32 74 44 76 50 78 C56 76 68 74 74 84 C66 90 56 88 50 88 C44 88 34 90 26 84 Z"
      fill="#1e293b"
      stroke="#64748b"
      strokeWidth="1.2"
    />
    {/* Gorget Clasp */}
    <circle cx="50" cy="84" r="3.5" fill="#d4af37" stroke="#92400e" strokeWidth="1" />

    {/* Strong Neck & Jaw */}
    <path d="M41 58 L41 76 C45 78 55 78 59 76 L59 58 Z" fill="#e2c5ad" />
    <path
      d="M34 38 C34 26 40 22 50 22 C60 22 66 26 66 38 C66 52 60 62 50 62 C40 62 34 52 34 38 Z"
      fill="#fed7aa"
    />

    {/* Noble Hair (Swept Back) */}
    <path
      d="M32 36 C30 22 38 15 50 15 C62 15 70 22 68 36 C64 26 58 22 50 22 C42 22 36 26 32 36 Z"
      fill="url(#male-hair)"
    />

    {/* Distinguished Medieval Beard & Mustache */}
    <path
      d="M38 46 C38 58 44 67 50 67 C56 67 62 58 62 46 C60 52 56 56 50 56 C44 56 40 52 38 46 Z"
      fill="#334155"
    />
    <path
      d="M42 50 Q50 53 58 50 Q50 48 42 50 Z"
      fill="#1e293b"
    />

    {/* Commanding Facial Features */}
    <path d="M40 37 Q44 35 48 37" stroke="#1e293b" strokeWidth="1.4" fill="none" />
    <path d="M52 37 Q56 35 60 37" stroke="#1e293b" strokeWidth="1.4" fill="none" />
    <circle cx="45" cy="40" r="1.5" fill="#0f172a" />
    <circle cx="55" cy="40" r="1.5" fill="#0f172a" />
    <path d="M50 39 L49 47 L52 47" stroke="#9a3412" strokeWidth="1" fill="none" opacity="0.7" />
  </svg>
);

/**
 * Minimalist Clean User Avatar (matching uploaded design reference)
 */
const DefaultUserAvatar: React.FC = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#252E3A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <User size={46} strokeWidth={1.8} color="#E8D6B2" />
  </div>
);

export const PersonNode: React.FC<any> = ({ id, data, selected }) => {
  const { isDark } = useTheme();
  const { isFirstTimeLocked, openParadaramiParallel } = useLineage();
  const { zoom } = useViewport();
  const updateNodeInternals = useUpdateNodeInternals();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPencilHovered, setIsPencilHovered] = React.useState(false);

  const nodeData = data as PersonNodeData;
  const nodeId = (id || nodeData.id) as string;
  const isSelected = selected || nodeData.isSelected;
  const isPathNode = nodeData.isPathNode;
  const isHighlighted = nodeData.isHighlighted;
  const [imageFailed, setImageFailed] = React.useState(false);

  // Mom's identifier (Suguna Konukuru / Paradarami)
  const isMom =
    nodeData.personId === '5c561a7d-3fee-4112-af6e-286f7a8ad61b' ||
    nodeId === '5c561a7d-3fee-4112-af6e-286f7a8ad61b' ||
    (nodeData.firstName === 'Suguna' && (nodeData.lastName === 'Konukuru' || nodeData.lastName === 'Paradarami'));

  // Requirement 2: Proportional zoom sizing (1:1.5 size:zoom ratio)
  // At zoom=1.0 -> 1.0; at zoom=0.5 -> (1/0.5)^(1/1.5) = 2^(2/3) ≈ 1.587; at zoom=2.0 -> (1/2)^(2/3) ≈ 0.63
  const baseScale = Math.min(2.5, Math.max(0.6, Math.pow(1 / Math.max(0.1, zoom), 1 / 1.5)));
  // Requirement 1: Enlarge smoothly on hover
  const scaleFactor = baseScale * (isHovered ? 1.08 : 1.0);

  // Sync handle internals on mount and on hover state change
  React.useLayoutEffect(() => {
    if (nodeId) {
      updateNodeInternals(nodeId);
    }
  }, [nodeId, isHovered, updateNodeInternals]);

  const fullName = [nodeData.firstName, nodeData.middleName, nodeData.lastName]
    .filter(Boolean)
    .join(' ');

  // Requirement 1: Make sure the surname comes always in second line with alignment centre for the person tiles
  let givenName = [nodeData.firstName, nodeData.middleName].filter(Boolean).join(' ').trim();
  let surname = (nodeData.lastName || '').trim();

  // If surname wasn't separately stored in lastName but givenName has multiple words, split the surname to line 2
  if (!surname && givenName.includes(' ')) {
    const parts = givenName.split(/\s+/);
    surname = parts.pop() || '';
    givenName = parts.join(' ');
  }

  // Requirement 3: Circle rim & margin exactly matching reference image (Antique Gold #D6B15C ring)
  let borderColor = '#D6B15C';
  let borderWidth = '2.5px';
  let boxShadow = isDark
    ? '0 6px 16px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(214, 177, 92, 0.25)'
    : '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(168, 138, 75, 0.2)';

  if (isPathNode) {
    borderColor = '#D6B15C';
    borderWidth = '3.5px';
    boxShadow = '0 0 0 3px rgba(214, 177, 92, 0.4), 0 0 25px rgba(214, 177, 92, 0.85)';
  } else if (isSelected) {
    borderColor = '#fef08a';
    borderWidth = '3.5px';
    boxShadow = '0 0 0 3px rgba(214, 177, 92, 0.5), 0 0 24px rgba(214, 177, 92, 0.85)';
  } else if (isHighlighted) {
    borderColor = '#D6B15C';
    borderWidth = '3px';
    boxShadow = '0 0 0 2px rgba(214, 177, 92, 0.35), 0 0 18px rgba(214, 177, 92, 0.7)';
  } else if (isHovered) {
    borderColor = '#fef08a';
    borderWidth = '2.5px';
    boxShadow = '0 0 0 3px rgba(214, 177, 92, 0.45), 0 10px 24px rgba(0, 0, 0, 0.8), 0 0 18px rgba(214, 177, 92, 0.6)';
  }

  const gender = (nodeData as any).gender?.toLowerCase();

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPencilHovered(false);
      }}
      style={{
        width: 190,
        minHeight: Math.max(160, Math.round(180 * scaleFactor)),
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
        cursor: 'pointer',
        boxSizing: 'border-box',
        userSelect: 'none',
        zIndex: isHovered ? 30 : isSelected ? 15 : 1,
      }}
    >
      {/* Target handle for incoming parent-child connection (at top of circle) */}
      <Handle
        type="target"
        position={Position.Top}
        id="child-top"
        style={{
          width: 8,
          height: 8,
          background: isPathNode ? '#D6B15C' : '#A94747',
          border: '1.5px solid #101318',
          top: 3,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}
      />

      {/* Handles for horizontal spouse connection (aligned to middle of circle) */}
      <Handle
        type="target"
        position={Position.Left}
        id="spouse-left"
        style={{
          width: 8,
          height: 8,
          background: isPathNode ? '#D6B15C' : '#D18B91',
          border: '1.5px solid #101318',
          left: 43,
          top: 50,
          zIndex: 5,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-right"
        style={{
          width: 8,
          height: 8,
          background: isPathNode ? '#D6B15C' : '#D18B91',
          border: '1.5px solid #101318',
          right: 43,
          top: 50,
          zIndex: 5,
        }}
      />

      {/* Proportional Scaled Container (Enlarges on hover + 1:1 ratio with zoom out) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'top center',
          transition: isHovered ? 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          position: 'relative',
        }}
        onTransitionEnd={() => {
          if (nodeId) updateNodeInternals(nodeId);
        }}
      >
        {/* Relative wrapper holding the Circular Portrait Medallion and the Top-Right Pencil Button */}
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            margin: '6px 0 8px 0',
          }}
        >
          {/* Circular Portrait Medallion (Requirement 3: circle margin & gold rim) */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              border: `${borderWidth} solid ${borderColor}`,
              boxShadow,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              backgroundColor: '#252E3A',
              flexShrink: 0,
            }}
          >
            {isFirstTimeLocked ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#161d28',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Lineage locked"
              >
                <Lock size={36} color="#D6B15C" />
              </div>
            ) : nodeData.photoPath && !imageFailed ? (
              <img
                src={nodeData.photoPath}
                alt={fullName}
                onError={() => setImageFailed(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : gender === 'female' ? (
              <FemaleNobleAvatar />
            ) : gender === 'male' ? (
              <MaleNobleAvatar />
            ) : (
              <DefaultUserAvatar />
            )}
          </div>

          {/* Requirement 2: View Lineage button on top-right position of Mom's tile */}
          {isMom && !isFirstTimeLocked && (
            <button
              type="button"
              title="View Paradarami Lineage (Parallel Branch)"
              onClick={(e) => {
                e.stopPropagation();
                openParadaramiParallel();
              }}
              style={{
                position: 'absolute',
                top: -8,
                right: -24,
                background: 'linear-gradient(135deg, #d4af37 0%, #997a15 100%)',
                color: '#10141d',
                border: '1.5px solid #fef08a',
                borderRadius: 14,
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 750,
                fontFamily: "'Inter', sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                boxShadow: '0 3px 12px rgba(214, 177, 92, 0.65)',
                zIndex: 25,
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease-in-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(214, 177, 92, 0.85)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 3px 12px rgba(214, 177, 92, 0.65)';
              }}
            >
              <Shield size={12} strokeWidth={2.4} />
              <span>View Lineage</span>
            </button>
          )}

          {/* Requirement 2: Pencil button, visible ONLY on hover (hidden if first-time locked) */}
          {!isFirstTimeLocked && (
            <button
              type="button"
              title={`Edit details of ${fullName}`}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof nodeData.onEdit === 'function') {
                  nodeData.onEdit(nodeData.personId);
                } else {
                  navigate(`/people/${nodeData.personId}/edit`);
                }
              }}
              onMouseEnter={() => setIsPencilHovered(true)}
              onMouseLeave={() => setIsPencilHovered(false)}
              style={{
                position: 'absolute',
                top: 0,
                right: isMom ? undefined : 0,
                left: isMom ? 0 : undefined,
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: isPencilHovered ? '#fef08a' : '#D6B15C',
                color: '#101318',
                border: '2px solid #101318',
                boxShadow: isPencilHovered
                  ? '0 0 12px rgba(214, 177, 92, 0.95), 0 3px 8px rgba(0, 0, 0, 0.7)'
                  : '0 2px 8px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                zIndex: 10,
                opacity: isHovered ? 1 : 0,
                transform: isHovered
                  ? isPencilHovered
                    ? 'scale(1.15)'
                    : 'scale(1)'
                  : 'scale(0.6)',
                pointerEvents: isHovered ? 'auto' : 'none',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <Pencil size={13} strokeWidth={2.4} />
            </button>
          )}
        </div>

        {/* Person Name centered below the circle: Given name on Line 1, Surname ALWAYS on Line 2 with center alignment (Requirement 1) */}
        {isFirstTimeLocked ? (
          <div
            style={{
              marginTop: 6,
              textAlign: 'center',
              width: '100%',
              color: '#D6B15C',
              letterSpacing: '0.15em',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            ••••••••••
          </div>
        ) : (
          <div
            style={{
              marginTop: 2,
              textAlign: 'center',
              width: '100%',
              maxWidth: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: '15.5px',
              fontWeight: 650,
              lineHeight: 1.25,
              letterSpacing: '-0.01em',
              color: isSelected
                ? '#D6B15C'
                : isPathNode
                ? '#D6B15C'
                : isHovered
                ? '#fef08a'
                : isDark
                ? '#F1E9D7'
                : '#1D2633',
              textShadow: isDark
                ? '0 2px 8px rgba(0, 0, 0, 0.95), 0 0 10px rgba(0, 0, 0, 0.8)'
                : '0 1px 3px rgba(255, 255, 255, 0.9)',
              transition: 'color 0.15s ease-in-out',
              wordBreak: 'break-word',
            }}
          >
            {givenName && (
              <span
                style={{
                  display: 'block',
                  textAlign: 'center',
                  width: '100%',
                  lineHeight: 1.2,
                }}
              >
                {givenName}
              </span>
            )}
            {surname && (
              <span
                style={{
                  display: 'block',
                  textAlign: 'center',
                  width: '100%',
                  marginTop: givenName ? 1 : 0,
                  lineHeight: 1.2,
                }}
              >
                {surname}
              </span>
            )}
            {!givenName && !surname && (
              <span style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                Unknown
              </span>
            )}
          </div>
        )}

        {/* Deceased status ONLY (Inter 400 italic, Silver Grey) */}
        {!isFirstTimeLocked && !nodeData.isLiving && (
          <div
            style={{
              marginTop: 3,
              textAlign: 'center',
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontSize: '13px',
              fontStyle: 'italic',
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: isDark ? '#9BA3AF' : '#78716c',
              textShadow: isDark ? '0 1px 4px rgba(0, 0, 0, 0.9)' : 'none',
            }}
          >
            † Deceased
          </div>
        )}

        {/* Source handle for outgoing parent-child connection: strictly anchored to the bottom border of the name/status */}
        <div
          style={{
            position: 'relative',
            width: 8,
            height: 8,
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Handle
            type="source"
            position={Position.Bottom}
            id="parent-bottom"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'none',
              width: 8,
              height: 8,
              background: isPathNode ? '#D6B15C' : '#A94747',
              border: '1.5px solid #101318',
              zIndex: 5,
            }}
          />
        </div>
      </div>
    </div>
  );
};
