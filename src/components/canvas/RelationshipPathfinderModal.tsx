import React from 'react';
import { X, Navigation, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { PositionedNode } from '../../types/layout';
import { personApi } from '../../services/personApi';
import { PerspectiveRelationshipResult } from '../../types/relative';
import { useTheme } from '../../context/ThemeContext';

interface RelationshipPathfinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  allNodes: PositionedNode[];
  initialSourceId?: string | null;
  onApplyPath: (result: PerspectiveRelationshipResult, sourceId: string, targetId: string) => void;
  onClearPath: () => void;
  activeResult: PerspectiveRelationshipResult | null;
}

export const RelationshipPathfinderModal: React.FC<RelationshipPathfinderModalProps> = ({
  isOpen,
  onClose,
  allNodes,
  initialSourceId,
  onApplyPath,
  onClearPath,
  activeResult,
}) => {
  const { isDark } = useTheme();
  const [sourceId, setSourceId] = React.useState<string>(initialSourceId || '');
  const [targetId, setTargetId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PerspectiveRelationshipResult | null>(activeResult);

  React.useEffect(() => {
    if (initialSourceId) {
      setSourceId(initialSourceId);
    }
  }, [initialSourceId]);

  React.useEffect(() => {
    setResult(activeResult);
  }, [activeResult]);

  if (!isOpen) return null;

  const handleCalculate = async () => {
    if (!sourceId || !targetId) {
      setError('Please select both family members.');
      return;
    }
    if (sourceId === targetId) {
      setError('Please select two different family members.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await personApi.getRelationshipTo(sourceId, targetId);
    if (res.success && res.data) {
      setResult(res.data);
      onApplyPath(res.data, sourceId, targetId);
    } else {
      setError(res.error?.message || 'Could not calculate relationship');
    }
    setLoading(false);
  };

  const handleClear = () => {
    setResult(null);
    onClearPath();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          borderRadius: 16,
          boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.6)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: isDark ? '#f8fafc' : '#0f172a',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${isDark ? '#78350f' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#451a03' : '#fffbeb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isDark ? '#fbbf24' : '#b45309' }}>
            <Navigation size={18} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Relationship Pathfinder
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 4,
              cursor: 'pointer',
              color: isDark ? '#fbbf24' : '#94a3b8',
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 16, lineHeight: 1.4 }}>
            Select any two family members to discover their genealogical relationship and trace their connection path on the canvas.
          </p>

          {/* Form Selectors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                From Person
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="" disabled>Select source person...</option>
                {allNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.firstName} {n.lastName || ''} ({n.generationName || 'Unknown Cohort'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                To Person
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="" disabled>Select target person...</option>
                {allNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.firstName} {n.lastName || ''} ({n.generationName || 'Unknown Cohort'})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div style={{ padding: '8px 12px', backgroundColor: '#fff1f2', borderRadius: 8, color: '#e11d48', fontSize: '0.8125rem' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCalculate}
              disabled={loading || !sourceId || !targetId}
              style={{
                marginTop: 6,
                padding: '10px 16px',
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                borderRadius: 8,
                border: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: loading || !sourceId || !targetId ? 'not-allowed' : 'pointer',
                opacity: loading || !sourceId || !targetId ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Traversing Relationship Graph...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Trace Relationship Path</span>
                </>
              )}
            </button>
          </div>

          {/* Results Display */}
          {result && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 12,
                backgroundColor: '#fffbeb',
                border: '1.5px solid #fde68a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.04em' }}>
                  Genealogical Derivation
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                  }}
                >
                  {result.category}
                </span>
              </div>

              {/* Perspective Headline */}
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#78350f', lineHeight: 1.3 }}>
                {result.to_person.full_name} is {result.from_person.full_name}'s{' '}
                <span style={{ color: '#b45309', textDecoration: 'underline' }}>{result.relationship}</span>
              </div>

              <div style={{ fontSize: '0.8125rem', color: '#92400e', marginTop: 4 }}>
                Reverse: {result.from_person.full_name} is {result.to_person.full_name}'s {result.reverse_relationship}
              </div>

              {/* Step-by-Step Path */}
              {result.path && result.path.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #fde68a' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#b45309', marginBottom: 6 }}>
                    Connection Path:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    {result.path.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            backgroundColor: '#ffffff',
                            borderRadius: 6,
                            border: '1px solid #fde68a',
                            color: '#78350f',
                          }}
                        >
                          {step}
                        </span>
                        {idx < result.path.length - 1 && <ArrowRight size={12} color="#b45309" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {result ? (
            <button
              onClick={handleClear}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Clear Active Path
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

