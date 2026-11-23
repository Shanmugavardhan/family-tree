import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lock, Unlock, KeyRound, ArrowRight, X } from 'lucide-react';
import { useLineage } from '../../context/LineageContext';

export interface LineageLockNodeData {
  lineageId: string;
  lineageName: string;
  isUnlocked: boolean;
}

export const LineageLockNode: React.FC<any> = ({ data }) => {
  const nodeData = data as LineageLockNodeData;
  const { unlockedLineages, unlockWithCode, switchLineage } = useLineage();
  const [showPrompt, setShowPrompt] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unlocked =
    nodeData.isUnlocked ||
    (nodeData.lineageId ? unlockedLineages.includes(nodeData.lineageId.toLowerCase()) : false);

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = unlockWithCode(code);
    if (res.success) {
      setShowPrompt(false);
      setCode('');
    } else {
      setError(res.error || 'Invalid code.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        userSelect: 'none',
        zIndex: 20,
      }}
    >
      {/* Target handle from above */}
      <Handle
        type="target"
        position={Position.Top}
        id="lock-top"
        style={{
          width: 8,
          height: 8,
          background: unlocked ? '#10b981' : '#94a3b8',
          border: '1.5px solid #101318',
          top: 0,
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="child-top"
        style={{
          width: 8,
          height: 8,
          background: unlocked ? '#10b981' : '#94a3b8',
          border: '1.5px solid #101318',
          top: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Circular Lock Medallion (Requirement 2.c: refined grey aesthetic instead of red) */}
      <div
        onClick={() => setShowPrompt((prev) => !prev)}
        title={unlocked ? 'Ancestry Unlocked' : 'Click to enter Family Code'}
        style={{
          width: 86,
          height: 86,
          borderRadius: '50%',
          backgroundColor: '#151922',
          border: unlocked ? '2.5px solid #10b981' : '2.5px solid #94a3b8',
          boxShadow: unlocked
            ? '0 0 25px rgba(16, 185, 129, 0.45), 0 4px 14px rgba(0,0,0,0.7)'
            : '0 0 20px rgba(148, 163, 184, 0.35), 0 4px 14px rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {unlocked ? (
          <Unlock size={36} color="#10b981" />
        ) : (
          <Lock size={36} color="#94a3b8" />
        )}
      </div>

      {/* Label under Lock Node */}
      <div
        style={{
          marginTop: 8,
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif",
          maxWidth: 200,
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: unlocked ? '#10b981' : '#cbd5e1',
            textTransform: 'uppercase',
          }}
        >
          {nodeData.lineageName || 'Paradarami Ancestry'}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '11px',
            color: '#9BA3AF',
            marginTop: 2,
          }}
        >
          {unlocked ? '✓ Verified & Unlocked' : '🔒 Locked (Click to enter code)'}
        </span>
      </div>

      {/* Inline Floating Code Popover on the Canvas */}
      {showPrompt && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 130,
            width: 280,
            padding: '14px 16px',
            backgroundColor: '#1A2230',
            border: '1.5px solid rgba(214, 177, 92, 0.5)',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0,0,0,0.85)',
            zIndex: 60,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#D6B15C', display: 'flex', alignItems: 'center', gap: 6 }}>
              <KeyRound size={14} />
              {unlocked ? 'Lineage Verified' : 'Enter Family Code'}
            </span>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              style={{ background: 'transparent', border: 'none', color: '#9BA3AF', cursor: 'pointer', padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>

          {unlocked ? (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#cbd5e1' }}>
                {nodeData.lineageName || 'Lineage'} ancestry is verified. You can switch the canvas to explore the full tree.
              </p>
              <button
                type="button"
                onClick={() => {
                  switchLineage(nodeData.lineageId || 'paradarami');
                  setShowPrompt(false);
                }}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #10b981',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>Switch to {nodeData.lineageName || 'Lineage'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleUnlockSubmit}>
              {error && (
                <p style={{ color: '#f87171', fontSize: '11px', margin: '0 0 8px' }}>{error}</p>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="••••••••"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: '#111622',
                    border: '1px solid #343D49',
                    color: '#F1E9D7',
                    fontSize: '12px',
                    fontWeight: 650,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 100%)',
                    color: '#10141d',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Unlock
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Outgoing handle downward */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="parent-bottom"
        style={{
          width: 8,
          height: 8,
          background: unlocked ? '#10b981' : '#94a3b8',
          border: '1.5px solid #101318',
          bottom: -2,
        }}
      />
    </div>
  );
};
