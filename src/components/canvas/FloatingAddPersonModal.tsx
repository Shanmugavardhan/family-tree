import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, UserPlus, AlertCircle, AlertTriangle } from 'lucide-react';
import { Person, Gender, CreatePersonInput } from '../../types/person';
import { personApi } from '../../services/personApi';
import { useTheme } from '../../context/ThemeContext';

interface FloatingAddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (createdPerson: Person) => void;
}

export const FloatingAddPersonModal: React.FC<FloatingAddPersonModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  const { isDark } = useTheme();

  // Form Field States
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('Konukuru');
  const [alias, setAlias] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [isLiving, setIsLiving] = useState<boolean>(true);
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [deathPlace, setDeathPlace] = useState('');
  const [biography, setBiography] = useState('');

  // Parent / Spouse Linking States
  const [existingPersons, setExistingPersons] = useState<Person[]>([]);
  const [fatherId, setFatherId] = useState<string>('');
  const [motherId, setMotherId] = useState<string>('');
  const [spouseId, setSpouseId] = useState<string>('');

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Unsaved Changes Confirmation Dialog State
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Load existing persons for kinship dropdowns
  useEffect(() => {
    if (!isOpen) {
      setShowUnsavedPrompt(false);
      return;
    }

    setFirstName('');
    setMiddleName('');
    setLastName('Konukuru');
    setAlias('');
    setGender('male');
    setIsLiving(true);
    setBirthDate('');
    setDeathDate('');
    setBirthPlace('');
    setDeathPlace('');
    setBiography('');
    setFatherId('');
    setMotherId('');
    setSpouseId('');
    setClientErrors({});
    setSaveError(null);
    setShowUnsavedPrompt(false);

    personApi
      .getAll()
      .then((res) => {
        if (res.success && res.data) {
          setExistingPersons(res.data);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Dirty detection: check if any field has user input
  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    return (
      firstName.trim() !== '' ||
      middleName.trim() !== '' ||
      lastName.trim() !== 'Konukuru' ||
      alias.trim() !== '' ||
      gender !== 'male' ||
      !isLiving ||
      birthDate !== '' ||
      deathDate !== '' ||
      birthPlace.trim() !== '' ||
      deathPlace.trim() !== '' ||
      biography.trim() !== '' ||
      fatherId !== '' ||
      motherId !== '' ||
      spouseId !== ''
    );
  }, [
    isOpen,
    firstName,
    middleName,
    lastName,
    alias,
    gender,
    isLiving,
    birthDate,
    deathDate,
    birthPlace,
    deathPlace,
    biography,
    fatherId,
    motherId,
    spouseId,
  ]);

  // Request close: prompt if dirty, else close immediately
  const handleRequestClose = () => {
    if (isDirty) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowUnsavedPrompt(false);
    onClose();
  };

  const handleContinueEditing = () => {
    setShowUnsavedPrompt(false);
  };

  const handleSaveFromPrompt = async () => {
    setShowUnsavedPrompt(false);
    await handleSubmit();
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) {
      errors.first_name = 'First name is required.';
    }
    if (isLiving && deathDate) {
      errors.death_date = 'Living persons cannot have a date of death.';
    }
    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return false;

    setSaving(true);
    setSaveError(null);

    const input: CreatePersonInput = {
      first_name: firstName.trim(),
      middle_name: middleName.trim() || null,
      last_name: lastName.trim() || null,
      alias: alias.trim() || null,
      gender,
      is_living: isLiving,
      birth_date: birthDate || null,
      death_date: !isLiving && deathDate ? deathDate : null,
      birth_place: birthPlace.trim() || null,
      death_place: !isLiving && deathPlace.trim() ? deathPlace.trim() : null,
      biography: biography.trim(),
      father_id: fatherId || null,
      mother_id: motherId || null,
      spouse_id: spouseId || null,
    };

    try {
      const res = await personApi.create(input);
      if (res.success && res.data) {
        onSaveSuccess(res.data);
        onClose();
        return true;
      } else {
        setSaveError(res.error?.message || 'Failed to add family member.');
        return false;
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network error creating person.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleRequestClose}
      style={{
        position: 'fixed',
        top: '64px', // Requirement 6: Strictly positioned below the header
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
      {/* Floating Window Dialog (stops click propagation so clicking inside doesn't close) */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="floating-add-dialog"
        style={{
          width: 'min(720px, calc(100vw - 16px))',
          maxWidth: 720,
          maxHeight: 'calc(100vh - 64px - 32px)',
          backgroundColor: isDark ? '#151922' : '#ffffff',
          borderRadius: 16,
          boxShadow: isDark
            ? '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(214, 177, 92, 0.35)'
            : '0 25px 50px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(168, 138, 75, 0.3)',
          border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif",
          color: isDark ? '#F1E9D7' : '#101318',
          animation: 'floatingModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header - ONLY Close Button, NO Back Button (Requirement 5) */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#1D2633' : '#fafaf9',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(214, 177, 92, 0.15)' : '#fef3c7',
                border: '1px solid rgba(214, 177, 92, 0.3)',
                color: isDark ? '#D6B15C' : '#92400e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={18} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  color: isDark ? '#D6B15C' : '#854d0e',
                  letterSpacing: '0.02em',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                Add Family Member
              </h2>
              <span style={{ fontSize: '11.5px', color: isDark ? '#9BA3AF' : '#64748b' }}>
                Record a new member in the House lineage
              </span>
            </div>
          </div>

          {/* Top-Right ONLY Close Button (Requirement 5) */}
          <button
            type="button"
            onClick={handleRequestClose}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#9BA3AF' : '#64748b',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = isDark ? '#F1E9D7' : '#101318';
              e.currentTarget.style.backgroundColor = isDark ? '#252E3A' : '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isDark ? '#9BA3AF' : '#64748b';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {saveError && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} id="floating-add-person-form">
            {/* Basic Identification */}
            <div
              style={{
                backgroundColor: isDark ? '#1D2633' : '#f8fafc',
                border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  letterSpacing: '0.01em',
                  textTransform: 'uppercase',
                  color: isDark ? '#D6B15C' : '#92400e',
                  marginBottom: 14,
                }}
              >
                Basic Identification
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Ramesh"
                    required
                  />
                  {clientErrors.first_name && (
                    <p style={{ color: '#f87171', fontSize: '12px', margin: '4px 0 0' }}>{clientErrors.first_name}</p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Middle Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="e.g. Kumar"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Last Name / Family Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Konukuru"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Alias / Known As
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="e.g. Chitti"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Gender *
                  </label>
                  <select
                    className="form-select"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                {/* Requirement 7: Deceased Checkbox */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Status
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={!isLiving}
                      onChange={(e) => {
                        const deceased = e.target.checked;
                        setIsLiving(!deceased);
                        if (!deceased) {
                          setDeathDate('');
                          setDeathPlace('');
                        }
                      }}
                      style={{ width: 17, height: 17, accentColor: '#D6B15C' }}
                    />
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: !isLiving ? '#f87171' : (isDark ? '#F1E9D7' : '#1e293b') }}>
                      {!isLiving ? '† Deceased' : 'Living'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Dates & Locations */}
            <div
              style={{
                backgroundColor: isDark ? '#1D2633' : '#f8fafc',
                border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  letterSpacing: '0.01em',
                  textTransform: 'uppercase',
                  color: isDark ? '#D6B15C' : '#92400e',
                  marginBottom: 14,
                }}
              >
                Dates & Locations
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Birth Place
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder="e.g. Gangupalli, Tirupati"
                  />
                </div>
              </div>

              {/* Requirement 7: Show Date of Death and Place of Passing ONLY if Deceased */}
              {!isLiving && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                      Date of Death
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={deathDate}
                      onChange={(e) => setDeathDate(e.target.value)}
                    />
                    {clientErrors.death_date && (
                      <p style={{ color: '#f87171', fontSize: '12px', margin: '4px 0 0' }}>{clientErrors.death_date}</p>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                      Place of Passing
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={deathPlace}
                      onChange={(e) => setDeathPlace(e.target.value)}
                      placeholder="e.g. Tirupati"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Lineage Kinship Links (Optional Father, Mother, Spouse) */}
            <div
              style={{
                backgroundColor: isDark ? '#1D2633' : '#f8fafc',
                border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  letterSpacing: '0.01em',
                  textTransform: 'uppercase',
                  color: isDark ? '#D6B15C' : '#92400e',
                  marginBottom: 14,
                }}
              >
                Lineage Relationships (Optional)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Father
                  </label>
                  <select
                    className="form-select"
                    value={fatherId}
                    onChange={(e) => setFatherId(e.target.value)}
                  >
                    <option value="">-- None / Unknown --</option>
                    {existingPersons
                      .filter((p) => p.gender === 'male')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Mother
                  </label>
                  <select
                    className="form-select"
                    value={motherId}
                    onChange={(e) => setMotherId(e.target.value)}
                  >
                    <option value="">-- None / Unknown --</option>
                    {existingPersons
                      .filter((p) => p.gender === 'female')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Spouse
                  </label>
                  <select
                    className="form-select"
                    value={spouseId}
                    onChange={(e) => setSpouseId(e.target.value)}
                  >
                    <option value="">-- None --</option>
                    {existingPersons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Biography & Notes */}
            <div
              style={{
                backgroundColor: isDark ? '#1D2633' : '#f8fafc',
                border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: 18,
                marginBottom: 8,
              }}
            >
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 650,
                  letterSpacing: '0.01em',
                  textTransform: 'uppercase',
                  color: isDark ? '#D6B15C' : '#92400e',
                  marginBottom: 14,
                }}
              >
                Biography & Notes
              </h3>

              <textarea
                className="form-textarea"
                rows={3}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                placeholder="Enter personal background, life history, or notable family heritage..."
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </form>
        </div>

        {/* Modal Footer (Cancel & Add Member buttons) */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            backgroundColor: isDark ? '#1D2633' : '#fafaf9',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleRequestClose}
            disabled={saving}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: `1px solid ${isDark ? '#343D49' : '#cbd5e1'}`,
              backgroundColor: isDark ? '#252E3A' : '#ffffff',
              color: isDark ? '#F1E9D7' : '#334155',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="floating-add-person-form"
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid #D6B15C',
              background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 100%)',
              color: '#0f172a',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(214, 177, 92, 0.35)',
              transition: 'all 0.15s ease',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <UserPlus size={16} />
            <span>{saving ? 'Adding...' : 'Add Member'}</span>
          </button>
        </div>

        {/* Unsaved Changes Confirmation Overlay Modal */}
        {showUnsavedPrompt && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(10, 13, 20, 0.85)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              animation: 'floatingModalFadeIn 0.15s ease-out',
            }}
          >
            <div
              style={{
                width: 'min(420px, calc(100% - 20px))',
                backgroundColor: isDark ? '#1a2230' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(214, 177, 92, 0.4)' : '#e2e8f0'}`,
                borderRadius: 14,
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: isDark ? '#F1E9D7' : '#0f172a' }}>
                    Discard Unsaved Member?
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: isDark ? '#9BA3AF' : '#64748b' }}>
                    You have entered information for a new family member that has not been saved yet.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  onClick={handleContinueEditing}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: `1px solid ${isDark ? '#343D49' : '#cbd5e1'}`,
                    backgroundColor: 'transparent',
                    color: isDark ? '#F1E9D7' : '#334155',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Continue Editing
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={handleSaveFromPrompt}
                  disabled={saving}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 7,
                    border: '1px solid #D6B15C',
                    background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 100%)',
                    color: '#0f172a',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save Member
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
