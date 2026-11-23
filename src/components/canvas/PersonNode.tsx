import React from 'react';
import { Handle, Position, useViewport, useUpdateNodeInternals } from '@xyflow/react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Shield, Lock } from 'lucide-react';
import { PersonNodeData } from '../../adapters/reactFlowAdapter';
import { useTheme } from '../../context/ThemeContext';
import { useLineage } from '../../context/LineageContext';
import { LINEAGE_PARENTS_BY_PERSON } from '../../types/lineage';

import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

/**
 * Royal Heritage Avatar for Female members without a profile photo
 */
const FemaleNobleAvatar: React.FC = () => (
  <img
    src={avatarFemale}
    alt="Female Avatar"
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      pointerEvents: 'none',
      userSelect: 'none',
    }}
  />
);

/**
 * Royal Heritage Avatar for Male members without a profile photo
 */
const MaleNobleAvatar: React.FC = () => (
  <img
    src={avatarMale}
    alt="Male Avatar"
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      pointerEvents: 'none',
      userSelect: 'none',
    }}
  />
);

/**
 * Default fallback avatar
 */
const DefaultUserAvatar: React.FC = () => (
  <img
    src={avatarMale}
    alt="Default Avatar"
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      pointerEvents: 'none',
      userSelect: 'none',
    }}
  />
);

export const PersonNode: React.FC<any> = ({ id, data, selected }) => {
  const { isDark } = useTheme();
  const { activeLineageId, isFirstTimeLocked, expandedLineagePersonId, toggleLineageOnMap } = useLineage();
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

  // Lineage expansion is only available if the person's parents belong to an external house
  // DIFFERENT from the currently active tree (e.g. Suguna in Konukuru, or Jagannadham in Paradarami).
  const staticLineage =
    LINEAGE_PARENTS_BY_PERSON[nodeId] ||
    (nodeData.personId ? LINEAGE_PARENTS_BY_PERSON[nodeData.personId] : undefined);
  const targetLineageId = nodeData.externalLineage?.lineageId || staticLineage?.lineageId;

  const hasLineageAvailable =
    (Boolean(nodeData.hasExternalLineage) || Boolean(nodeData.externalLineage) || Boolean(staticLineage)) &&
    Boolean(targetLineageId ? targetLineageId !== activeLineageId : nodeData.hasExternalLineage);

  const isLineageExpanded =
    expandedLineagePersonId === nodeId ||
    expandedLineagePersonId === nodeData.personId;

  // Requirement 2: Proportional zoom sizing (1:1.5 size:zoom ratio)
  // At zoom=1.0 -> 1.0; at zoom=0.5 -> (1/0.5)^(1/1.5) = 2^(2/3) ≈ 1.587; at zoom=2.0 -> (1/2)^(2/3) ≈ 0.63
  const baseScale = Math.min(2.5, Math.max(0.6, Math.pow(1 / Math.max(0.1, zoom), 1 / 1.5)));
  // Requirement 1: Enlarge smoothly on hover
  const scaleFactor = baseScale * (isHovered ? 1.08 : 1.0);

  // Sync handle internals on mount and whenever zoom, scaleFactor, or nodeId changes
  React.useLayoutEffect(() => {
    if (nodeId) {
      updateNodeInternals(nodeId);
    }
  }, [nodeId, isHovered, scaleFactor, zoom, updateNodeInternals]);

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
          {/* Target handle for incoming parent-child connection (at top center of circle boundary) */}
          <Handle
            type="target"
            position={Position.Top}
            id="child-top"
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2,
              height: 2,
              opacity: 0,
              pointerEvents: 'none',
              border: 'none',
              background: 'transparent',
              zIndex: 5,
            }}
          />

          {/* Exact left boundary handle for horizontal spouse connection */}
          <Handle
            type="target"
            position={Position.Left}
            id="spouse-left"
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 2,
              height: 2,
              opacity: 0,
              pointerEvents: 'none',
              border: 'none',
              background: 'transparent',
              zIndex: 5,
            }}
          />

          {/* Exact right boundary handle for horizontal spouse connection */}
          <Handle
            type="source"
            position={Position.Right}
            id="spouse-right"
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 2,
              height: 2,
              opacity: 0,
              pointerEvents: 'none',
              border: 'none',
              background: 'transparent',
              zIndex: 5,
            }}
          />

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

          {/* Requirement 1: View Lineage button on top-right position of tile (in-map expansion, no separate window) */}
          {hasLineageAvailable && !isFirstTimeLocked && (
            <button
              type="button"
              title={isLineageExpanded ? 'Hide Lineage from Map' : 'View Lineage on Map'}
              onClick={(e) => {
                e.stopPropagation();
                toggleLineageOnMap(nodeData.personId || nodeId);
              }}
              style={{
                position: 'absolute',
                top: -8,
                right: -24,
                background: isLineageExpanded
                  ? 'linear-gradient(135deg, #475569 0%, #1e293b 100%)'
                  : 'linear-gradient(135deg, #d4af37 0%, #997a15 100%)',
                color: isLineageExpanded ? '#F1E9D7' : '#10141d',
                border: isLineageExpanded ? '1.5px solid #94a3b8' : '1.5px solid #fef08a',
                borderRadius: 14,
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 750,
                fontFamily: "'Inter', sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                boxShadow: isLineageExpanded
                  ? '0 2px 8px rgba(0, 0, 0, 0.5)'
                  : '0 3px 12px rgba(214, 177, 92, 0.65)',
                zIndex: 25,
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease-in-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = isLineageExpanded
                  ? '0 4px 12px rgba(0, 0, 0, 0.7)'
                  : '0 6px 18px rgba(214, 177, 92, 0.85)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = isLineageExpanded
                  ? '0 2px 8px rgba(0, 0, 0, 0.5)'
                  : '0 3px 12px rgba(214, 177, 92, 0.65)';
              }}
            >
              <Shield size={12} strokeWidth={2.4} />
              <span>{isLineageExpanded ? 'Hide Lineage' : 'View Lineage'}</span>
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
                right: hasLineageAvailable ? undefined : 0,
                left: hasLineageAvailable ? 0 : undefined,
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
            width: 2,
            height: 2,
            marginTop: 6,
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
              width: 2,
              height: 2,
              opacity: 0,
              pointerEvents: 'none',
              border: 'none',
              background: 'transparent',
              zIndex: 5,
            }}
          />
        </div>
      </div>
    </div>
  );
};
