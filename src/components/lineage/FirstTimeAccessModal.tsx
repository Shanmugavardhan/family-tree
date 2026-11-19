import React, { useState } from 'react';
import { Shield, KeyRound, ArrowRight, AlertCircle, Lock } from 'lucide-react';
import { useLineage } from '../../context/LineageContext';

export const FirstTimeAccessModal: React.FC = () => {
  const { isFirstTimeLocked, unlockWithCode } = useLineage();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isFirstTimeLocked) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = unlockWithCode(code);
    if (!res.success) {
      setError(res.error || 'Invalid family code.');
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(8, 11, 18, 0.88)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'firstTimeFadeIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          width: 'min(460px, 100%)',
          backgroundColor: '#141A24',
          borderRadius: 20,
          border: '1.5px solid rgba(214, 177, 92, 0.45)',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9), 0 0 40px rgba(214, 177, 92, 0.2)',
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif",
          color: '#F1E9D7',
        }}
      >
        {/* Subtle background glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(214, 177, 92, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Heraldic Shield Icon */}
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #d4af37 0%, #997a15 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10141d',
            boxShadow: '0 6px 20px rgba(212, 175, 55, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            marginBottom: 20,
          }}
        >
          <Shield size={34} strokeWidth={2.2} />
        </div>

        {/* Royal Title */}
        <h2
          style={{
            margin: 0,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '1.85rem',
            fontWeight: 700,
            color: '#D6B15C',
            letterSpacing: '0.04em',
            lineHeight: 1.2,
          }}
        >
          Lineage Access Portal
        </h2>

        <p
          style={{
            marginTop: 10,
            marginBottom: 24,
            fontSize: '0.9rem',
            color: '#9BA3AF',
            lineHeight: 1.5,
            maxWidth: 360,
          }}
        >
          Chronicles of the Lineage are private to verified family members. Enter your secret Family Code to unlock the archives.
        </p>

        {error && (
          <div
            style={{
              width: '100%',
              marginBottom: 18,
              padding: '10px 14px',
              borderRadius: 10,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Code Input Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#D6B15C',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <KeyRound size={18} />
            </div>

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. KONU1290"
              autoFocus
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px 14px 44px',
                borderRadius: 12,
                backgroundColor: '#1A2230',
                border: '1.5px solid rgba(214, 177, 92, 0.35)',
                color: '#F1E9D7',
                fontSize: '1.05rem',
                fontWeight: 650,
                letterSpacing: '0.08em',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#D6B15C';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(214, 177, 92, 0.35)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(214, 177, 92, 0.35)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 12,
              border: '1px solid #D6B15C',
              background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 100%)',
              color: '#0f172a',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(214, 177, 92, 0.35)',
              transition: 'all 0.18s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(214, 177, 92, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(214, 177, 92, 0.35)';
            }}
          >
            <span>Unlock Lineage</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Informative lineage code guide */}
        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <Lock size={13} color="#D6B15C" />
          <span>House of Konukuru code: <strong style={{ color: '#D6B15C' }}>KONU1290</strong></span>
        </div>
      </div>
    </div>
  );
};
