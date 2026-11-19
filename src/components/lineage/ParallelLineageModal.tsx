import React, { useState } from 'react';
import { X, Lock, Unlock, KeyRound, Shield, CheckCircle, ArrowRight, User } from 'lucide-react';
import { useLineage } from '../../context/LineageContext';
import { PARADARAMI_DEPTH1_PARENTS } from '../../types/lineage';

export const ParallelLineageModal: React.FC = () => {
  const {
    isParadaramiParallelOpen,
    closeParadaramiParallel,
    isParadaramiUnlocked,
    unlockWithCode,
    switchLineage,
  } = useLineage();

  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);

  if (!isParadaramiParallelOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = unlockWithCode(inputCode);
    if (!res.success) {
      setError(res.error || 'Invalid Paradarami family code.');
    } else {
      setShowCodeInput(false);
      setInputCode('');
    }
  };

  const handleSwitchToParadarami = () => {
    switchLineage('paradarami');
    closeParadaramiParallel();
  };

  return (
    <div
      onClick={closeParadaramiParallel}
      style={{
        position: 'fixed',
        top: '64px',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 13, 20, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(760px, calc(100vw - 16px))',
          maxHeight: 'calc(100vh - 64px - 32px)',
          backgroundColor: '#151922',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(214, 177, 92, 0.35)',
          border: '1px solid #343D49',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif",
          color: '#F1E9D7',
          animation: 'floatingModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #343D49',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1D2633',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: 'rgba(214, 177, 92, 0.15)',
                border: '1px solid rgba(214, 177, 92, 0.3)',
                color: '#D6B15C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  color: '#D6B15C',
                  letterSpacing: '0.02em',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                House of Paradarami — Maternal Ancestry
              </h2>
              <span style={{ fontSize: '11.5px', color: '#9BA3AF' }}>
                Parallel maternal lineage of Suguna Konukuru (born Paradarami)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeParadaramiParallel}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#9BA3AF',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#F1E9D7';
              e.currentTarget.style.backgroundColor = '#252E3A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9BA3AF';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* Depth-1 Lineage Tree Visualization */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              padding: '20px 0',
            }}
          >
            {/* 1. Locked Ancestry Circle (Requirement 2: one circle showing lock symbol) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <div
                onClick={() => {
                  if (!isParadaramiUnlocked) {
                    setShowCodeInput(true);
                  }
                }}
                title={isParadaramiUnlocked ? 'Paradarami Ancestry Unlocked' : 'Click to enter Family Code'}
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: isParadaramiUnlocked
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: isParadaramiUnlocked
                    ? '2.5px solid #10b981'
                    : '2.5px solid #ef4444',
                  boxShadow: isParadaramiUnlocked
                    ? '0 0 25px rgba(16, 185, 129, 0.4)'
                    : '0 0 25px rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isParadaramiUnlocked ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {isParadaramiUnlocked ? (
                  <Unlock size={38} color="#ffffff" />
                ) : (
                  <Lock size={38} color="#f87171" />
                )}
              </div>

              {/* Title under locked circle */}
              <div style={{ marginTop: 8 }}>
                <span
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: isParadaramiUnlocked ? '#10b981' : '#f87171',
                  }}
                >
                  {isParadaramiUnlocked
                    ? 'Paradarami Ancestry (Unlocked)'
                    : 'Paradarami Ancestry (Locked)'}
                </span>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#9BA3AF' }}>
                  {isParadaramiUnlocked
                    ? 'Generations 1 to 4 fully verified'
                    : 'Click lock circle to enter Paradarami family code'}
                </p>
              </div>

              {/* Connecting Line Downward to Parents */}
              <div
                style={{
                  width: 2,
                  height: 28,
                  backgroundColor: isParadaramiUnlocked ? '#10b981' : '#ef4444',
                  marginTop: 6,
                }}
              />
            </div>

            {/* Code Input Form (Toggled when clicking lock circle or if not unlocked) */}
            {showCodeInput && !isParadaramiUnlocked && (
              <div
                style={{
                  width: 'min(420px, 100%)',
                  padding: '16px 20px',
                  backgroundColor: '#1A2230',
                  borderRadius: 12,
                  border: '1.5px solid rgba(214, 177, 92, 0.5)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <KeyRound size={16} color="#D6B15C" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#D6B15C' }}>
                    Enter Paradarami Family Code
                  </span>
                </div>

                {error && (
                  <p style={{ color: '#f87171', fontSize: '12px', margin: '0 0 10px' }}>
                    {error}
                  </p>
                )}

                <form onSubmit={handleUnlock} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PARA1290"
                    autoFocus
                    required
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      backgroundColor: '#111622',
                      border: '1px solid #343D49',
                      color: '#F1E9D7',
                      fontSize: '13px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #D6B15C',
                      background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 100%)',
                      color: '#0f172a',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Unlock
                  </button>
                </form>
              </div>
            )}

            {/* 2. Depth-1 Ancestors: Mom's Father and Mother (Requirement 2) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 20,
                width: '100%',
              }}
            >
              {PARADARAMI_DEPTH1_PARENTS.map((member) => (
                <div
                  key={member.id}
                  style={{
                    backgroundColor: '#1D2633',
                    border: '1.5px solid rgba(214, 177, 92, 0.35)',
                    borderRadius: 14,
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#D6B15C',
                      marginBottom: 10,
                      backgroundColor: 'rgba(214, 177, 92, 0.12)',
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    {member.relation}
                  </span>

                  {/* Circle Portrait Medallion */}
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: '50%',
                      backgroundColor: '#141822',
                      border: '2.5px solid #D6B15C',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(214, 177, 92, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <User size={38} color="#D6B15C" />
                  </div>

                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: '#F1E9D7',
                    }}
                  >
                    {member.firstName} {member.middleName ? `${member.middleName} ` : ''}
                  </h3>
                  <h4
                    style={{
                      margin: '1px 0 0',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#D6B15C',
                    }}
                  >
                    {member.lastName}
                  </h4>

                  <span style={{ fontSize: '12px', fontStyle: 'italic', color: '#9BA3AF', marginTop: 4 }}>
                    {member.isLiving ? 'Living' : '† Deceased'}
                    {member.birthYear ? ` (${member.birthYear}${member.deathYear ? ` – ${member.deathYear}` : ''})` : ''}
                  </span>

                  {member.birthPlace && (
                    <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: 2 }}>
                      Place: {member.birthPlace}
                    </span>
                  )}

                  {member.biography && (
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {member.biography}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Connecting Line Downward to Mom (Suguna) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
              <div style={{ width: 2, height: 20, backgroundColor: '#D6B15C' }} />
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  backgroundColor: 'rgba(214, 177, 92, 0.15)',
                  border: '1px solid #D6B15C',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#D6B15C',
                }}
              >
                Daughter: Suguna Konukuru (born Paradarami)
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #343D49',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#1D2633',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px', color: '#9BA3AF' }}>
            {isParadaramiUnlocked ? (
              <>
                <CheckCircle size={15} color="#10b981" />
                <span style={{ color: '#10b981', fontWeight: 600 }}>Paradarami Code Verified</span>
              </>
            ) : (
              <>
                <Lock size={14} color="#f87171" />
                <span>Ancestral depth locked to non-Paradarami members</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isParadaramiUnlocked ? (
              <button
                type="button"
                onClick={handleSwitchToParadarami}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #10b981',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                }}
              >
                <span>Switch to House of Paradarami</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCodeInput(!showCodeInput)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid #D6B15C',
                  backgroundColor: 'rgba(214, 177, 92, 0.12)',
                  color: '#D6B15C',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {showCodeInput ? 'Hide Code Box' : 'Enter Family Code'}
              </button>
            )}

            <button
              type="button"
              onClick={closeParadaramiParallel}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: '1px solid #343D49',
                backgroundColor: '#252E3A',
                color: '#F1E9D7',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
