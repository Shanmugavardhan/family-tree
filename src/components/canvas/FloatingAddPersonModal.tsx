import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, UserPlus, AlertCircle, AlertTriangle, Upload, Crop, Trash2 } from 'lucide-react';
import { Person, Gender, CreatePersonInput } from '../../types/person';
import { PositionedNode, PositionedEdge } from '../../types/layout';
import { personApi } from '../../services/personApi';
import { useTheme } from '../../context/ThemeContext';
import { normalizeDateInput } from '../../utils/dateUtils';
import { ImageCropperModal } from '../photos/ImageCropperModal';
import {
  findDuplicateLineageMembers,
  inferKinshipRelations,
  KinshipNode,
  KinshipEdge,
} from '../../utils/kinshipInference';

import avatarMale from '../../assets/avatar_male.png';
import avatarFemale from '../../assets/avatar_female.png';

interface FloatingAddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (createdPerson: Person) => void;
  layoutNodes?: PositionedNode[];
  layoutEdges?: PositionedEdge[];
}

export const FloatingAddPersonModal: React.FC<FloatingAddPersonModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
  layoutNodes = [],
  layoutEdges = [],
}) => {
  const { isDark } = useTheme();

  // Form Field States
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [alias, setAlias] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [isLiving, setIsLiving] = useState<boolean>(true);
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [deathPlace, setDeathPlace] = useState('');
  const [biography, setBiography] = useState('');

  // Photo Attachment & Cropping States (Requirements 6 & 8)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [croppedPhotoFile, setCroppedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parent / Spouse / Child Linking States
  const [existingPersons, setExistingPersons] = useState<Person[]>([]);
  const [fatherId, setFatherId] = useState<string>('');
  const [motherId, setMotherId] = useState<string>('');
  const [spouseId, setSpouseId] = useState<string>('');
  const [childId, setChildId] = useState<string>('');

  // Kinship Auto-Inference Feedback (Requirement 11)
  const [inferenceNotice, setInferenceNotice] = useState<string | null>(null);

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Unsaved Changes Confirmation Dialog State
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Load existing persons fallback if layoutNodes not provided
  useEffect(() => {
    if (!isOpen) {
      setShowUnsavedPrompt(false);
      return;
    }

    setFirstName('');
    setMiddleName('');
    setLastName('');
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
    setChildId('');
    setSelectedPhotoFile(null);
    setCroppedPhotoFile(null);
    setPhotoPreviewUrl(null);
    setIsCropperOpen(false);
    setInferenceNotice(null);
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

  // Derive kinship nodes & edges from layoutNodes (Requirement 5: restricted to this house lineage)
  const effectiveKinshipNodes: KinshipNode[] = useMemo(() => {
    if (layoutNodes && layoutNodes.length > 0) {
      return layoutNodes.map((n) => ({
        id: (n as any).personId || n.id,
        firstName: n.firstName || '',
        middleName: n.middleName || null,
        lastName: n.lastName || null,
        gender: n.gender || 'male',
        birthDate: n.birthDate || null,
        birthYear: n.birthYear || null,
      }));
    }
    return existingPersons.map((p) => ({
      id: p.id,
      firstName: p.first_name,
      middleName: p.middle_name,
      lastName: p.last_name,
      gender: p.gender,
      birthDate: p.birth_date,
      birthYear: p.birth_date ? parseInt(p.birth_date.slice(0, 4), 10) : null,
    }));
  }, [layoutNodes, existingPersons]);

  const effectiveKinshipEdges: KinshipEdge[] = useMemo(() => {
    if (layoutEdges && layoutEdges.length > 0) {
      return layoutEdges.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
      }));
    }
    return [];
  }, [layoutEdges]);

  // Requirement 1: Duplicate lineage member suggestions / warning
  const duplicateMatches = useMemo(() => {
    return findDuplicateLineageMembers(firstName, lastName, effectiveKinshipNodes);
  }, [firstName, lastName, effectiveKinshipNodes]);

  // Dirty detection: check if any field has user input
  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    return (
      firstName.trim() !== '' ||
      middleName.trim() !== '' ||
      lastName.trim() !== '' ||
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
      spouseId !== '' ||
      childId !== '' ||
      croppedPhotoFile !== null
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
    childId,
    croppedPhotoFile,
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

  // Requirement 10: Mandatory relation validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) {
      errors.first_name = 'First name is required.';
    }
    if (isLiving && deathDate) {
      errors.death_date = 'Living persons cannot have a date of death.';
    }
    // Requirement 10: At least one relation must be specified
    if (!fatherId && !motherId && !spouseId && !childId) {
      errors.relations =
        'Please select at least one family relationship (Father, Mother, Spouse, or Child) to connect this person to the family lineage.';
    }
    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Requirement 11: Auto-infer relations when one relation is selected
  const handleFatherSelect = (newFatherId: string) => {
    setFatherId(newFatherId);
    if (newFatherId) {
      const res = inferKinshipRelations({
        triggerField: 'father',
        triggerValue: newFatherId,
        currentFatherId: newFatherId,
        currentMotherId: motherId,
        currentSpouseId: spouseId,
        currentChildId: childId,
        subjectGender: gender,
        nodes: effectiveKinshipNodes,
        edges: effectiveKinshipEdges,
      });
      if (res.inferredMotherId && !motherId) {
        setMotherId(res.inferredMotherId);
        setInferenceNotice(res.reason || null);
      }
    }
  };

  const handleMotherSelect = (newMotherId: string) => {
    setMotherId(newMotherId);
    if (newMotherId) {
      const res = inferKinshipRelations({
        triggerField: 'mother',
        triggerValue: newMotherId,
        currentFatherId: fatherId,
        currentMotherId: newMotherId,
        currentSpouseId: spouseId,
        currentChildId: childId,
        subjectGender: gender,
        nodes: effectiveKinshipNodes,
        edges: effectiveKinshipEdges,
      });
      if (res.inferredFatherId && !fatherId) {
        setFatherId(res.inferredFatherId);
        setInferenceNotice(res.reason || null);
      }
    }
  };

  const handleChildSelect = (newChildId: string) => {
    setChildId(newChildId);
    if (newChildId) {
      const res = inferKinshipRelations({
        triggerField: 'child',
        triggerValue: newChildId,
        currentFatherId: fatherId,
        currentMotherId: motherId,
        currentSpouseId: spouseId,
        currentChildId: newChildId,
        subjectGender: gender,
        nodes: effectiveKinshipNodes,
        edges: effectiveKinshipEdges,
      });
      if (res.inferredSpouseId && !spouseId) {
        setSpouseId(res.inferredSpouseId);
        setInferenceNotice(res.reason || null);
      }
    }
  };

  const handleSpouseSelect = (newSpouseId: string) => {
    setSpouseId(newSpouseId);
    if (newSpouseId) {
      const res = inferKinshipRelations({
        triggerField: 'spouse',
        triggerValue: newSpouseId,
        currentFatherId: fatherId,
        currentMotherId: motherId,
        currentSpouseId: newSpouseId,
        currentChildId: childId,
        subjectGender: gender,
        nodes: effectiveKinshipNodes,
        edges: effectiveKinshipEdges,
      });
      if (res.inferredChildId && !childId) {
        setChildId(res.inferredChildId);
        setInferenceNotice(res.reason || null);
      }
    }
  };

  // Photo handlers (Requirements 6 & 8)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhotoFile(file);
      setIsCropperOpen(true);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File, previewUrl: string) => {
    setCroppedPhotoFile(croppedFile);
    setPhotoPreviewUrl(previewUrl);
    setIsCropperOpen(false);
  };

  const handleRemovePhoto = () => {
    setSelectedPhotoFile(null);
    setCroppedPhotoFile(null);
    setPhotoPreviewUrl(null);
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
      birth_date: normalizeDateInput(birthDate),
      death_date: !isLiving ? normalizeDateInput(deathDate) : null,
      birth_place: birthPlace.trim() || null,
      death_place: !isLiving && deathPlace.trim() ? deathPlace.trim() : null,
      biography: biography.trim(),
      father_id: fatherId || null,
      mother_id: motherId || null,
      spouse_id: spouseId || null,
      child_id: childId || null,
    };

    try {
      const res = await personApi.create(input);
      if (res.success && res.data) {
        const createdPerson = res.data;

        // If a photo was cropped, upload it now
        if (croppedPhotoFile) {
          try {
            await personApi.uploadPhoto(createdPerson.id, croppedPhotoFile);
          } catch (photoErr) {
            console.error('Failed to upload photo for created member:', photoErr);
          }
        }

        onSaveSuccess(createdPerson);
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
      {/* Floating Window Dialog */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="floating-add-dialog"
        style={{
          width: 'min(740px, calc(100vw - 16px))',
          maxWidth: 740,
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
        {/* Header */}
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
                width: 34,
                height: 34,
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
                  fontFamily: "'Marcellus', Georgia, serif",
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
            {/* Profile Photo Attachment & Cropping (Requirements 6 & 8) */}
            <div
              style={{
                backgroundColor: isDark ? '#1D2633' : '#f8fafc',
                border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: '16px 18px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              {/* Circular Gold Medallion Avatar Preview */}
              <div
                style={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  padding: 3,
                  background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 50%, #854d0e 100%)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5), 0 0 10px rgba(214, 177, 92, 0.35)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#101318',
                  }}
                >
                  <img
                    src={photoPreviewUrl || (gender === 'female' ? avatarFemale : avatarMale)}
                    alt="Member Preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              </div>

              {/* Photo Controls */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 650, color: isDark ? '#F1E9D7' : '#1e293b' }}>
                  Member Photograph
                </div>
                <div style={{ fontSize: '12px', color: isDark ? '#9BA3AF' : '#64748b', marginTop: 2, marginBottom: 10 }}>
                  Upload a royal portrait or profile photo with interactive crop & zoom.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  {!photoPreviewUrl ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 7,
                        fontSize: '12.5px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(214, 177, 92, 0.15)',
                        color: '#D6B15C',
                        border: '1px solid rgba(214, 177, 92, 0.4)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Upload size={14} />
                      <span>Upload Photo</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsCropperOpen(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 7,
                          fontSize: '12.5px',
                          fontWeight: 600,
                          backgroundColor: 'rgba(214, 177, 92, 0.15)',
                          color: '#D6B15C',
                          border: '1px solid rgba(214, 177, 92, 0.4)',
                          cursor: 'pointer',
                        }}
                      >
                        <Crop size={14} />
                        <span>Edit / Crop</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 7,
                          fontSize: '12.5px',
                          fontWeight: 500,
                          backgroundColor: isDark ? '#252E3A' : '#ffffff',
                          color: isDark ? '#F1E9D7' : '#334155',
                          border: `1px solid ${isDark ? '#343D49' : '#cbd5e1'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <Upload size={14} />
                        <span>Change</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 7,
                          fontSize: '12.5px',
                          fontWeight: 500,
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

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
                    placeholder="e.g. Vikram"
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
                    placeholder="e.g. Prasad"
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
                    placeholder="e.g. Sharma"
                  />
                </div>
              </div>

              {/* Requirement 1: Duplicate Lineage Member Warning / Suggestion */}
              {duplicateMatches.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Notice:</strong> A member named <strong>"{duplicateMatches[0].fullName}"</strong> already exists in this lineage{' '}
                    {duplicateMatches[0].birthYear ? `(Born: ${duplicateMatches[0].birthYear})` : ''}. Did you mean to edit them instead?
                  </div>
                </div>
              )}

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
                    placeholder="e.g. Raju"
                  />
                </div>

                {/* Requirement 2: Gender Dot Check Radio Options */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Gender *
                  </label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                    {(['male', 'female', 'other'] as Gender[]).map((g) => (
                      <label
                        key={g}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          padding: '5px 10px',
                          borderRadius: 7,
                          backgroundColor: gender === g ? (isDark ? 'rgba(214, 177, 92, 0.15)' : '#fef3c7') : 'transparent',
                          border: `1px solid ${gender === g ? '#D6B15C' : (isDark ? '#343D49' : '#cbd5e1')}`,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="gender-add"
                          value={g}
                          checked={gender === g}
                          onChange={() => setGender(g)}
                          style={{ width: 15, height: 15, accentColor: '#D6B15C', cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: gender === g ? 600 : 450,
                            textTransform: 'capitalize',
                            color: gender === g ? '#D6B15C' : (isDark ? '#e2e8f0' : '#334155'),
                          }}
                        >
                          {g}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Requirement 3: Deceased Checkbox WITHOUT "Status" header */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
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
                      style={{ width: 17, height: 17, accentColor: '#D6B15C', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13.5px', fontWeight: 550, color: !isLiving ? '#f87171' : (isDark ? '#F1E9D7' : '#1e293b') }}>
                      Deceased
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
                    type="text"
                    className="form-input"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="YYYY or YYYY-MM-DD (e.g. 1965)"
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
                    placeholder="e.g. Bengaluru"
                  />
                </div>
              </div>

              {!isLiving && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                      Date of Death
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={deathDate}
                      onChange={(e) => setDeathDate(e.target.value)}
                      placeholder="YYYY or YYYY-MM-DD (e.g. 2018)"
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
                      placeholder="e.g. Hyderabad"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Requirement 4: Lineage Relationships (Without "(Optional)") */}
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
                  marginBottom: 6,
                }}
              >
                Lineage Relationships
              </h3>
              <p style={{ fontSize: '12px', color: isDark ? '#9BA3AF' : '#64748b', margin: '0 0 14px' }}>
                Connect this member to people shown in this house lineage. At least one relationship is required.
              </p>

              {/* Requirement 10: Relationship Validation Error Message */}
              {clientErrors.relations && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{clientErrors.relations}</span>
                </div>
              )}

              {/* Requirement 11: Auto-Inference Notice */}
              {inferenceNotice && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(214, 177, 92, 0.15)',
                    border: '1px solid rgba(214, 177, 92, 0.4)',
                    color: '#D6B15C',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{inferenceNotice}</span>
                  <button
                    type="button"
                    onClick={() => setInferenceNotice(null)}
                    style={{ background: 'none', border: 'none', color: '#D6B15C', cursor: 'pointer', padding: 2 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Requirement 5: Dropdowns only show members from this house lineage */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Father
                  </label>
                  <select
                    className="form-select"
                    value={fatherId}
                    onChange={(e) => handleFatherSelect(e.target.value)}
                  >
                    <option value="">-- None / Unknown --</option>
                    {effectiveKinshipNodes
                      .filter((p) => p.gender === 'male')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}
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
                    onChange={(e) => handleMotherSelect(e.target.value)}
                  >
                    <option value="">-- None / Unknown --</option>
                    {effectiveKinshipNodes
                      .filter((p) => p.gender === 'female')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}
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
                    onChange={(e) => handleSpouseSelect(e.target.value)}
                  >
                    <option value="">-- None --</option>
                    {effectiveKinshipNodes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                    Son / Daughter
                  </label>
                  <select
                    className="form-select"
                    value={childId}
                    onChange={(e) => handleChildSelect(e.target.value)}
                  >
                    <option value="">-- None --</option>
                    {effectiveKinshipNodes
                      .filter((p) => p.id !== fatherId && p.id !== motherId && p.id !== spouseId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}
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

        {/* Modal Footer */}
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

      {/* Image Cropper Modal (Requirements 6 & 8) */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        imageFile={selectedPhotoFile}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};
