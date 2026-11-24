import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle } from 'lucide-react';
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
      setError(res.error || 'Invalid family code. Please enter the secret code for your family.');
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
        className="first-time-modal-dialog"
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#121824',
          borderRadius: 20,
          border: '1.5px solid rgba(214, 177, 92, 0.45)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(214, 177, 92, 0.25)',
          padding: '36px 32px',
          boxSizing: 'border-box',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Royal Crest Medallion */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4af37 0%, #856a18 100%)',
            border: '2px solid rgba(255, 255, 255, 0.35)',
            boxShadow: '0 0 25px rgba(214, 177, 92, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10141d',
            marginBottom: 20,
          }}
        >
          <Shield size={34} strokeWidth={2.2} />
        </div>

        {/* Royal Title */}
        <h2
          style={{
            margin: 0,
            fontFamily: "'Marcellus', Georgia, serif",
            fontSize: '1.85rem',
            fontWeight: 700,
            color: '#D6B15C',
            letterSpacing: '0.04em',
            lineHeight: 1.2,
          }}
        >
          Welcome to Family Tree
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
          This space is a display of family trees which ofcourse private to family members. Enter your family code below to view your family tree
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
              <Lock size={18} />
            </div>

            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="••••••••"
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
                fontSize: '1.15rem',
                fontWeight: 650,
                letterSpacing: '0.12em',
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
            <span>View Family Tree</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
