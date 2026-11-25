import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { TfaQuestion, TfaQuestionOption } from '../../types/verification';
import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

interface TfaVerificationModalProps {
  isOpen: boolean;
  questions: TfaQuestion[];
  onAnswer: (
    question: TfaQuestion,
    option: TfaQuestionOption,
    suggestedValue?: string
  ) => Promise<void>;
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
  const [pendingRejectOption, setPendingRejectOption] = useState<TfaQuestionOption | null>(null);
  const [inputValue, setInputValue] = useState('');

  if (!isOpen || questions.length === 0 || currentIndex >= questions.length) {
    return null;
  }

  const current = questions[currentIndex];
  const fallbackAvatar =
    current.subject_gender?.toLowerCase() === 'female' ? avatarFemale : avatarMale;
  const photoSrc = current.subject_photo || fallbackAvatar;

  const advance = () => {
    setPendingRejectOption(null);
    setInputValue('');
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handleOptionClick = async (option: TfaQuestionOption) => {
    if (submitting) return;

    if (option.action === 'reject' && current.allowCorrection && !pendingRejectOption) {
      setPendingRejectOption(option);
      return;
    }

    if (option.action === 'fill') {
      if (!inputValue.trim()) return;
      setSubmitting(true);
      try {
        await onAnswer(current, option, inputValue.trim());
        advance();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await onAnswer(current, option);
      advance();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRejectWithSuggestion = async () => {
    if (!pendingRejectOption || submitting) return;
    setSubmitting(true);
    try {
      await onAnswer(current, pendingRejectOption, inputValue.trim() || undefined);
      advance();
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
              backgroundColor: current.isDisputed || current.isAnomaly
                ? 'rgba(245, 158, 11, 0.18)'
                : 'rgba(214, 177, 92, 0.16)',
              border: '1px solid rgba(214, 177, 92, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: current.isDisputed || current.isAnomaly ? '#fbbf24' : '#D6B15C',
            }}
          >
            {current.isDisputed || current.isAnomaly ? (
              <AlertTriangle size={20} />
            ) : (
              <ShieldCheck size={20} />
            )}
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
            margin: '0 0 16px',
            fontSize: '1.02rem',
            fontWeight: 600,
            lineHeight: 1.45,
            color: '#F8FAFC',
          }}
        >
          {current.question_text}
        </p>

        {/* Fill-in-the-blank input for missing DOB / Birth Place (Upgrade 3) */}
        {current.allowFillInput && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={current.fillPlaceholder || 'Enter value...'}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #3b4a62',
              backgroundColor: '#1a2230',
              color: '#F1E9D7',
              fontSize: '0.9rem',
              marginBottom: 12,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        )}

        {/* Suggest Correction Inline Prompt (Upgrade 2) */}
        {pendingRejectOption ? (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: '#fca5a5' }}>
              <Edit3 size={15} />
              <span>Suggest Correction (Optional)</span>
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={current.correctionPlaceholder || 'Enter the correct detail...'}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #3b4a62',
                backgroundColor: '#1a2230',
                color: '#F1E9D7',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmRejectWithSuggestion}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {inputValue.trim() ? 'Submit Correction' : 'Flag as Incorrect'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setPendingRejectOption(null);
                  setInputValue('');
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #3b4a62',
                  backgroundColor: '#19212e',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          /* Options */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {current.options.map((opt) => {
              const isConfirm = opt.action === 'confirm' || opt.action === 'fill';
              const isReject = opt.action === 'reject';

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitting || (opt.action === 'fill' && !inputValue.trim())}
                  onClick={() => handleOptionClick(opt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 11,
                    border: isConfirm
                      ? '1px solid rgba(214, 177, 92, 0.45)'
                      : isReject
                      ? '1px solid rgba(248, 113, 113, 0.4)'
                      : '1px solid #2b3648',
                    backgroundColor: isConfirm
                      ? 'rgba(214, 177, 92, 0.12)'
                      : isReject
                      ? 'rgba(239, 68, 68, 0.1)'
                      : '#19212e',
                    color: isConfirm ? '#F5D77F' : isReject ? '#fca5a5' : '#cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    textAlign: 'left',
                    opacity: opt.action === 'fill' && !inputValue.trim() ? 0.5 : 1,
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
        )}
      </div>
    </div>
  );
};
