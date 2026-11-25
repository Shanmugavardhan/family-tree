import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, HelpCircle, X } from 'lucide-react';
import { TfaQuestion, TfaQuestionOption } from '../../types/verification';
import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

interface TfaVerificationModalProps {
  isOpen: boolean;
  questions: TfaQuestion[];
  onAnswer: (question: TfaQuestion, option: TfaQuestionOption) => Promise<void>;
  onClose: () => void;
}

export const TfaVerificationModal: React.FC<TfaVerificationModalProps> = ({
  isOpen,
  questions,
  onAnswer,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || questions.length === 0 || currentIndex >= questions.length) {
    return null;
  }

  const current = questions[currentIndex];
  const fallbackAvatar =
    current.subject_gender?.toLowerCase() === 'female' ? avatarFemale : avatarMale;
  const photoSrc = current.subject_photo || fallbackAvatar;

  const handleOptionClick = async (option: TfaQuestionOption) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAnswer(current, option);
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1040,
        backgroundColor: 'rgba(8, 11, 18, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          backgroundColor: '#121824',
          borderRadius: 20,
          border: '1.5px solid rgba(214, 177, 92, 0.45)',
          boxShadow: '0 24px 55px rgba(0, 0, 0, 0.8), 0 0 30px rgba(214, 177, 92, 0.2)',
          padding: '24px 24px 22px',
          position: 'relative',
          color: '#F1E9D7',
        }}
      >
        {/* Close / Dismiss */}
        <button
          type="button"
          onClick={onClose}
          title="Dismiss verification"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: '#9BA3AF',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 6,
          }}
        >
          <X size={18} />
        </button>

        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(214, 177, 92, 0.16)',
              border: '1px solid rgba(214, 177, 92, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D6B15C',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Marcellus', Georgia, serif",
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#D6B15C',
                letterSpacing: '0.02em',
              }}
            >
              Family Fact Verification (2-Step)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9BA3AF' }}>
              Question {currentIndex + 1} of {questions.length} · {current.category_label}
            </div>
          </div>
        </div>

        {/* Subject Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 14px',
            borderRadius: 12,
            backgroundColor: '#19212e',
            border: '1px solid #2b3648',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: '2px solid #D6B15C',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              src={photoSrc}
              alt={current.subject_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: '0.95rem', color: '#F1E9D7' }}>
              {current.subject_name}
            </div>
            {current.detail_hint && (
              <div style={{ fontSize: '0.76rem', color: '#9BA3AF', marginTop: 2 }}>
                {current.detail_hint}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Framed Question */}
        <p
          style={{
            margin: '0 0 18px',
            fontSize: '1.05rem',
            fontWeight: 600,
            lineHeight: 1.45,
            color: '#F8FAFC',
          }}
        >
          {current.question_text}
        </p>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {current.options.map((opt) => {
            const isConfirm = opt.action === 'confirm';
            const isReject = opt.action === 'reject';

            return (
              <button
                key={opt.id}
                type="button"
                disabled={submitting}
                onClick={() => handleOptionClick(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 11,
                  border: isConfirm
                    ? '1px solid rgba(52, 211, 153, 0.45)'
                    : isReject
                    ? '1px solid rgba(248, 113, 113, 0.4)'
                    : '1px solid #2b3648',
                  backgroundColor: isConfirm
                    ? 'rgba(16, 185, 129, 0.14)'
                    : isReject
                    ? 'rgba(239, 68, 68, 0.12)'
                    : '#19212e',
                  color: isConfirm ? '#6ee7b7' : isReject ? '#fca5a5' : '#cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer',
                  textAlign: 'left',
                  transition: 'transform 0.12s ease, opacity 0.12s ease',
                }}
              >
                {isConfirm ? (
                  <CheckCircle2 size={18} />
                ) : isReject ? (
                  <XCircle size={18} />
                ) : (
                  <HelpCircle size={18} />
                )}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
