import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, X, Save, AlertCircle, AlertTriangle, UserCheck, Plus, Trash2, Users, Upload, Crop } from 'lucide-react';
import { Person, Gender, UpdatePersonInput } from '../../types/person';
import { PositionedNode, PositionedEdge } from '../../types/layout';
import { personApi } from '../../services/personApi';
import { relationshipApi } from '../../services/relationshipApi';
import { Relationship } from '../../types/relationship';
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

interface FloatingPersonEditModalProps {
  personId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedPerson: Person) => void;
  layoutNodes?: PositionedNode[];
  layoutEdges?: PositionedEdge[];
}

export const FloatingPersonEditModal: React.FC<FloatingPersonEditModalProps> = ({
  personId,
  isOpen,
  onClose,
  onSaveSuccess,
  layoutNodes = [],
  layoutEdges = [],
}) => {
  const { isDark } = useTheme();

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  // Photo Attachment & Cropping States (Vertical Rectangle Box)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [croppedPhotoFile, setCroppedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState<boolean>(false);
  const [isCropperOpen, setIsCropperOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Family Relationships State
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [loadingRels, setLoadingRels] = useState(false);
  const [relActionError, setRelActionError] = useState<string | null>(null);
  const [isAddingRelation, setIsAddingRelation] = useState(false);

  // "Which Relation" dot options ('father' | 'mother' | 'spouse' | 'child') & "Who" state
  const [newRelType, setNewRelType] = useState<'father' | 'mother' | 'spouse' | 'child'>('father');
  const [newRelTargetId, setNewRelTargetId] = useState<string>('');
  const [savingRelation, setSavingRelation] = useState(false);

  // Kinship Auto-Inference Notice
  const [relInferenceNotice, setRelInferenceNotice] = useState<string | null>(null);

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Unsaved Changes Confirmation Dialog State
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Derive lineage members & edges (restricted to this house lineage)
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
    return allPersons.map((p) => ({
      id: p.id,
      firstName: p.first_name,
      middleName: p.middle_name,
      lastName: p.last_name,
      gender: p.gender,
      birthDate: p.birth_date,
      birthYear: p.birth_date ? parseInt(p.birth_date.slice(0, 4), 10) : null,
    }));
  }, [layoutNodes, allPersons]);

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

  // Duplicate member warning
  const duplicateMatches = useMemo(() => {
    if (!personId) return [];
    return findDuplicateLineageMembers(firstName, lastName, effectiveKinshipNodes, personId);
  }, [firstName, lastName, effectiveKinshipNodes, personId]);

  // Available members for "Who" dropdown in Add Relation
  const availableMembersForNewRelation = useMemo(() => {
    if (newRelType === 'father') {
      return effectiveKinshipNodes.filter((m) => m.id !== personId && m.gender === 'male');
    }
    if (newRelType === 'mother') {
      return effectiveKinshipNodes.filter((m) => m.id !== personId && m.gender === 'female');
    }
    return effectiveKinshipNodes.filter((m) => m.id !== personId);
  }, [newRelType, effectiveKinshipNodes, personId]);

  const loadRelationships = async (id: string) => {
    setLoadingRels(true);
    setRelActionError(null);
    try {
      const [relRes, personRes] = await Promise.all([
        relationshipApi.getAll({ personId: id }),
        personApi.getAll({ includeArchived: false }),
      ]);
      if (relRes.success && relRes.data) {
        setRelationships(relRes.data);
      }
      if (personRes.success && personRes.data) {
        setAllPersons(personRes.data);
      }
    } catch (err: any) {
      setRelActionError(err.message || 'Failed to load relationships');
    } finally {
      setLoadingRels(false);
    }
  };

  const handleAddRelation = async () => {
    if (!personId || !newRelTargetId) {
      setRelActionError('Please select a family member to connect.');
      return;
    }
    setSavingRelation(true);
    setRelActionError(null);
    try {
      let payload: any;
      if (newRelType === 'father' || newRelType === 'mother') {
        payload = {
          person_id: personId,
          related_person_id: newRelTargetId,
          relationship_type: 'parent',
        };
      } else if (newRelType === 'child') {
        payload = {
          person_id: newRelTargetId,
          related_person_id: personId,
          relationship_type: 'parent',
        };
      } else {
        payload = {
          person_id: personId,
          related_person_id: newRelTargetId,
          relationship_type: 'spouse',
        };
      }

      const res = await relationshipApi.create(payload);
      if (res.success) {
        setIsAddingRelation(false);
        setNewRelTargetId('');
        setRelInferenceNotice(null);
        await loadRelationships(personId);
        if (person) onSaveSuccess(person);
      } else {
        setRelActionError(res.error?.message || 'Failed to add relationship.');
      }
    } catch (err: any) {
      setRelActionError(err.message || 'Error adding relationship.');
    } finally {
      setSavingRelation(false);
    }
  };

  const handleDeleteRelation = async (relId: string) => {
    if (relationships.length <= 1) {
      setRelActionError(
        'Every member must have at least one family relationship in the tree. You cannot remove the only remaining relationship.'
      );
      return;
    }

    if (!confirm('Are you sure you want to remove this family relationship?')) return;
    setRelActionError(null);
    try {
      const res = await relationshipApi.delete(relId);
      if (res.success) {
        if (personId) await loadRelationships(personId);
        if (person) onSaveSuccess(person);
      } else {
        setRelActionError(res.error?.message || 'Failed to delete relationship.');
      }
    } catch (err: any) {
      setRelActionError(err.message || 'Error deleting relationship.');
    }
  };

  const handleTargetRelationChange = (targetId: string) => {
    setNewRelTargetId(targetId);
    if (!targetId) {
      setRelInferenceNotice(null);
      return;
    }

    const res = inferKinshipRelations({
      triggerField: newRelType,
      triggerValue: targetId,
      subjectGender: gender,
      nodes: effectiveKinshipNodes,
      edges: effectiveKinshipEdges,
    });
    if (res.reason) {
      setRelInferenceNotice(res.reason);
    } else {
      setRelInferenceNotice(null);
    }
  };

  // Fetch person details when opened
  useEffect(() => {
    if (!isOpen || !personId) {
      setPerson(null);
      setFetchError(null);
      setShowUnsavedPrompt(false);
      setSelectedPhotoFile(null);
      setCroppedPhotoFile(null);
      setPhotoPreviewUrl(null);
      setPhotoRemoved(false);
      setIsCropperOpen(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setFetchError(null);
    setSaveError(null);
    setClientErrors({});
    setShowUnsavedPrompt(false);
    setIsAddingRelation(false);
    setNewRelType('father');
    setNewRelTargetId('');
    setRelInferenceNotice(null);
    setSelectedPhotoFile(null);
    setCroppedPhotoFile(null);
    setPhotoRemoved(false);
    setIsCropperOpen(false);

    loadRelationships(personId);

    personApi
      .getById(personId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          const p = res.data;
          setPerson(p);
          setFirstName(p.first_name || '');
          setMiddleName(p.middle_name || '');
          setLastName(p.last_name || '');
          setAlias(p.alias || '');
          setGender(p.gender || 'male');
          setIsLiving(p.is_living ?? true);
          setBirthDate(p.birth_date || '');
          setDeathDate(p.death_date || '');
          setBirthPlace(p.birth_place || '');
          setDeathPlace(p.death_place || '');
          setBiography(p.biography || '');

          if (p.profile_photo) {
            const photoUrl = p.profile_photo.startsWith('http') || p.profile_photo.startsWith('data:')
              ? p.profile_photo
              : `/api/persons/${p.id}/photo`;
            setPhotoPreviewUrl(photoUrl);
          } else {
            setPhotoPreviewUrl(null);
          }
        } else {
          setFetchError(res.error?.message || 'Could not load person profile');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setFetchError(err.message || 'Network error loading profile');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, personId]);

  // Dirty detection
  const isDirty = useMemo(() => {
    if (!person) return false;
    return (
      firstName.trim() !== (person.first_name || '').trim() ||
      middleName.trim() !== (person.middle_name || '').trim() ||
      lastName.trim() !== (person.last_name || '').trim() ||
      alias.trim() !== (person.alias || '').trim() ||
      gender !== person.gender ||
      isLiving !== person.is_living ||
      birthDate !== (person.birth_date || '') ||
      deathDate !== (person.death_date || '') ||
      birthPlace.trim() !== (person.birth_place || '').trim() ||
      deathPlace.trim() !== (person.death_place || '').trim() ||
      biography.trim() !== (person.biography || '').trim() ||
      croppedPhotoFile !== null ||
      photoRemoved
    );
  }, [
    person,
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
    croppedPhotoFile,
    photoRemoved,
  ]);

  const handleRequestClose = () => {
    if (!isDirty) {
      onClose();
    } else {
      setShowUnsavedPrompt(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (showUnsavedPrompt) {
          setShowUnsavedPrompt(false);
        } else {
          handleRequestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, showUnsavedPrompt]);

  // Photo handlers
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
    setPhotoRemoved(false);
    setIsCropperOpen(false);
  };

  const handleRemovePhoto = () => {
    setSelectedPhotoFile(null);
    setCroppedPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoRemoved(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) {
      errs.first_name = 'First name is required.';
    }
    if (isLiving && deathDate.trim()) {
      errs.death_date = 'Living person cannot have a death date.';
    }
    if (relationships.length === 0) {
      errs.relations =
        'Every member must have at least one family relationship in the tree. Please connect a parent, spouse, or child.';
    }
    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (): Promise<boolean> => {
    if (!personId) return false;
    if (!validate()) return false;

    setSaving(true);
    setSaveError(null);

    const updatePayload: UpdatePersonInput = {
      first_name: firstName.trim(),
      middle_name: middleName.trim() || null,
      last_name: lastName.trim() || null,
      alias: alias.trim() || null,
      gender,
      is_living: isLiving,
      birth_date: normalizeDateInput(birthDate),
      death_date: isLiving ? null : normalizeDateInput(deathDate),
      birth_place: birthPlace.trim() || null,
      death_place: isLiving ? null : deathPlace.trim() || null,
      biography: biography.trim(),
    };

    try {
      const res = await personApi.update(personId, updatePayload);
      if (res.success && res.data) {
        if (croppedPhotoFile) {
          try {
            await personApi.uploadPhoto(personId, croppedPhotoFile);
          } catch (photoErr) {
            console.error('Failed to update photo:', photoErr);
          }
        } else if (photoRemoved) {
          try {
            await personApi.deletePhoto(personId);
          } catch (photoErr) {
            console.error('Failed to remove photo:', photoErr);
          }
        }

        onSaveSuccess(res.data);
        onClose();
        return true;
      } else {
        setSaveError(res.error?.message || 'Failed to save changes.');
        return false;
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network error updating person.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const fullName = person
    ? [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
    : 'Member';

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
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="floating-edit-dialog"
        style={{
          width: 'min(760px, calc(100vw - 16px))',
          maxWidth: 760,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={handleRequestClose}
              title="Back to Family Tree"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: `1px solid ${isDark ? '#343D49' : '#cbd5e1'}`,
                backgroundColor: isDark ? '#252E3A' : '#ffffff',
                color: isDark ? '#F1E9D7' : '#334155',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <div>
              <h2
                style={{
                  fontFamily: "'Marcellus', serif",
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  margin: 0,
                  color: isDark ? '#D6B15C' : '#92400e',
                  lineHeight: 1.2,
                }}
              >
                Edit Profile: {fullName}
              </h2>
              {person && (
                <div style={{ fontSize: '11.5px', color: isDark ? '#9BA3AF' : '#64748b', marginTop: 2 }}>
                  Permanent Record ID: <code>{person.id}</code>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            title="Close"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 6,
              cursor: 'pointer',
              color: isDark ? '#9BA3AF' : '#64748b',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '22px 24px',
            boxSizing: 'border-box',
          }}
        >
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: isDark ? '#9BA3AF' : '#64748b' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: `3px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                  borderTopColor: '#D6B15C',
                  borderRadius: '50%',
                  margin: '0 auto 12px',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ fontSize: '14px', margin: 0 }}>Loading profile details...</p>
            </div>
          ) : fetchError ? (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 10,
                padding: '16px 20px',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <AlertCircle size={20} />
              <span>{fetchError}</span>
            </div>
          ) : (
            <form
              id="floating-person-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              {saveError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 18,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#f87171',
                    fontSize: '13.5px',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Basic Identification with Vertical Rectangle Photo Box on Left */}
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
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <UserCheck size={16} />
                  <span>Basic Identification</span>
                </h3>

                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Vertical Rectangle Photo Box */}
                  <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      onClick={() => !photoPreviewUrl && fileInputRef.current?.click()}
                      title={photoPreviewUrl ? 'Member portrait' : 'Click to upload portrait photo'}
                      style={{
                        width: 140,
                        height: 180,
                        borderRadius: 12,
                        border: `1.5px ${photoPreviewUrl ? 'solid' : 'dashed'} ${isDark ? '#D6B15C' : '#b8972e'}`,
                        backgroundColor: isDark ? '#10141d' : '#f1f5f9',
                        boxShadow: isDark
                          ? '0 6px 18px rgba(0, 0, 0, 0.6), 0 0 10px rgba(214, 177, 92, 0.25)'
                          : '0 4px 12px rgba(0, 0, 0, 0.1)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: photoPreviewUrl ? 'default' : 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {photoPreviewUrl ? (
                        <img
                          src={photoPreviewUrl}
                          alt="Portrait"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12, textAlign: 'center' }}>
                          <div
                            style={{
                              width: 72,
                              height: 90,
                              borderRadius: 8,
                              overflow: 'hidden',
                              marginBottom: 8,
                              border: '1px solid rgba(214, 177, 92, 0.3)',
                            }}
                          >
                            <img
                              src={gender === 'female' ? avatarFemale : avatarMale}
                              alt="Default Avatar"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#D6B15C', fontSize: '11px', fontWeight: 650 }}>
                            <Upload size={12} />
                            <span>Upload Photo</span>
                          </div>
                          <span style={{ fontSize: '10px', color: isDark ? '#9BA3AF' : '#64748b', marginTop: 2 }}>
                            Click to browse
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Photo Action Buttons */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
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
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: 6,
                            fontSize: '11.5px',
                            fontWeight: 600,
                            backgroundColor: 'rgba(214, 177, 92, 0.15)',
                            color: '#D6B15C',
                            border: '1px solid rgba(214, 177, 92, 0.35)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <Upload size={13} />
                          <span>Upload Photo</span>
                        </button>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedPhotoFile) {
                                setIsCropperOpen(true);
                              } else {
                                fileInputRef.current?.click();
                              }
                            }}
                            title="Edit / Crop Photo"
                            style={{
                              padding: '5px 6px',
                              borderRadius: 6,
                              fontSize: '11px',
                              fontWeight: 650,
                              backgroundColor: 'rgba(214, 177, 92, 0.15)',
                              color: '#D6B15C',
                              border: '1px solid rgba(214, 177, 92, 0.35)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 3,
                            }}
                          >
                            <Crop size={12} />
                            <span>Crop</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            title="Change Photo"
                            style={{
                              padding: '5px 6px',
                              borderRadius: 6,
                              fontSize: '11px',
                              fontWeight: 500,
                              backgroundColor: isDark ? '#252E3A' : '#ffffff',
                              color: isDark ? '#F1E9D7' : '#334155',
                              border: `1px solid ${isDark ? '#343D49' : '#cbd5e1'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 3,
                            }}
                          >
                            <Upload size={12} />
                            <span>Change</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            title="Remove Photo"
                            style={{
                              gridColumn: 'span 2',
                              padding: '4px 6px',
                              borderRadius: 6,
                              fontSize: '11px',
                              fontWeight: 500,
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 3,
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Remove Photo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Form Fields */}
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
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
                    </div>

                    {/* Duplicate Member Warning */}
                    {duplicateMatches.length > 0 && (
                      <div
                        style={{
                          marginTop: 12,
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
                          <strong>Notice:</strong> Another member named <strong>"{duplicateMatches[0].fullName}"</strong> already exists in this lineage{' '}
                          {duplicateMatches[0].birthYear ? `(Born: ${duplicateMatches[0].birthYear})` : ''}.
                        </div>
                      </div>
                    )}

                    {/* Gender and Deceased in dedicated non-overlapping row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 16,
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop: `1px solid ${isDark ? '#2a3441' : '#e2e8f0'}`,
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 6 }}>
                          Gender *
                        </label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          {(['male', 'female', 'other'] as Gender[]).map((g) => (
                            <label
                              key={g}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                padding: '5px 12px',
                                borderRadius: 7,
                                backgroundColor: gender === g ? (isDark ? 'rgba(214, 177, 92, 0.18)' : '#fef3c7') : 'transparent',
                                border: `1.5px solid ${gender === g ? '#D6B15C' : (isDark ? '#343D49' : '#cbd5e1')}`,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <input
                                type="radio"
                                name="gender-edit"
                                value={g}
                                checked={gender === g}
                                onChange={() => setGender(g)}
                                style={{ width: 15, height: 15, accentColor: '#D6B15C', cursor: 'pointer' }}
                              />
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: gender === g ? 650 : 450,
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

                      {/* Dedicated Deceased Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
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
                          <span style={{ fontSize: '13.5px', fontWeight: 600, color: !isLiving ? '#f87171' : (isDark ? '#F1E9D7' : '#1e293b') }}>
                            Deceased
                          </span>
                        </label>
                      </div>
                    </div>
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

              {/* Biography & Notes */}
              <div
                style={{
                  backgroundColor: isDark ? '#1D2633' : '#f8fafc',
                  border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                  borderRadius: 12,
                  padding: 18,
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

                <div>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={biography}
                    onChange={(e) => setBiography(e.target.value)}
                    placeholder="Education, profession, personal history, or notable family memories..."
                  />
                </div>
              </div>

              {/* Lineage Relationships with Dot Options of "Which Relation" and Dropdown of "Who" */}
              <div
                style={{
                  backgroundColor: isDark ? '#1D2633' : '#f8fafc',
                  border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
                  borderRadius: 12,
                  padding: 18,
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 650,
                        letterSpacing: '0.01em',
                        textTransform: 'uppercase',
                        color: isDark ? '#D6B15C' : '#92400e',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Users size={16} />
                      <span>Lineage Relationships</span>
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: isDark ? '#9BA3AF' : '#64748b' }}>
                      Members connected to this person in the family tree. At least one relationship must be preserved.
                    </p>
                  </div>

                  {!isAddingRelation && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingRelation(true);
                        setRelActionError(null);
                        setNewRelTargetId('');
                        setRelInferenceNotice(null);
                      }}
                      className="btn btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(214, 177, 92, 0.12)',
                        color: '#D6B15C',
                        border: '1px solid rgba(214, 177, 92, 0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        borderRadius: 6,
                      }}
                    >
                      <Plus size={14} />
                      <span>Add Relation</span>
                    </button>
                  )}
                </div>

                {relActionError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      borderRadius: 6,
                      color: '#f87171',
                      fontSize: '12px',
                      marginBottom: 12,
                    }}
                  >
                    {relActionError}
                  </div>
                )}

                {/* Sub-form: Add Relation with Dot Options of "Which Relation" and Dropdown of "Who" */}
                {isAddingRelation && (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: isDark ? '#151922' : '#ffffff',
                      border: '1.5px solid #D6B15C',
                      borderRadius: 10,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 650, marginBottom: 12, color: '#D6B15C' }}>
                      Connect New Relationship
                    </div>

                    {relInferenceNotice && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: '7px 10px',
                          borderRadius: 6,
                          backgroundColor: 'rgba(214, 177, 92, 0.15)',
                          border: '1px solid rgba(214, 177, 92, 0.35)',
                          color: '#D6B15C',
                          fontSize: '12px',
                        }}
                      >
                        {relInferenceNotice}
                      </div>
                    )}

                    {/* Dot Options: Which Relation */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: 6 }}>
                        Which Relation *
                      </label>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                          { type: 'father', label: 'Father' },
                          { type: 'mother', label: 'Mother' },
                          { type: 'spouse', label: 'Spouse' },
                          { type: 'child', label: 'Son / Daughter' },
                        ].map((rel) => {
                          const isSelected = newRelType === rel.type;
                          return (
                            <label
                              key={rel.type}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                padding: '5px 12px',
                                borderRadius: 7,
                                backgroundColor: isSelected
                                  ? (isDark ? 'rgba(214, 177, 92, 0.18)' : '#fef3c7')
                                  : (isDark ? '#1D2633' : '#f8fafc'),
                                border: `1.5px solid ${isSelected ? '#D6B15C' : (isDark ? '#343D49' : '#cbd5e1')}`,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <input
                                type="radio"
                                name="which-relation-edit"
                                value={rel.type}
                                checked={isSelected}
                                onChange={() => {
                                  setNewRelType(rel.type as any);
                                  setNewRelTargetId('');
                                  setRelInferenceNotice(null);
                                }}
                                style={{ width: 15, height: 15, accentColor: '#D6B15C', cursor: 'pointer' }}
                              />
                              <span
                                style={{
                                  fontSize: '12.5px',
                                  fontWeight: isSelected ? 650 : 500,
                                  color: isSelected ? '#D6B15C' : (isDark ? '#e2e8f0' : '#334155'),
                                }}
                              >
                                {rel.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dropdown: Who */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: 5 }}>
                        Who ({newRelType === 'father' ? 'Father' : newRelType === 'mother' ? 'Mother' : newRelType === 'spouse' ? 'Spouse' : 'Son / Daughter'}) *
                      </label>
                      <select
                        className="form-select"
                        value={newRelTargetId}
                        onChange={(e) => handleTargetRelationChange(e.target.value)}
                        style={{ fontSize: '13px', padding: '8px 12px', width: '100%' }}
                      >
                        <option value="">-- Choose Member from this Lineage --</option>
                        {availableMembersForNewRelation.map((p) => (
                          <option key={p.id} value={p.id}>
                            {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')} {p.birthYear ? `(Born: ${p.birthYear})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingRelation(false);
                          setRelActionError(null);
                          setRelInferenceNotice(null);
                        }}
                        className="btn btn-secondary"
                        disabled={savingRelation}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddRelation}
                        disabled={savingRelation || !newRelTargetId}
                        className="btn btn-primary"
                        style={{
                          padding: '6px 14px',
                          fontSize: '12px',
                          backgroundColor: '#D6B15C',
                          color: '#101318',
                          borderColor: '#D6B15C',
                          fontWeight: 650,
                        }}
                      >
                        {savingRelation ? 'Connecting...' : 'Save Relation'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing Relationships List */}
                {loadingRels ? (
                  <div style={{ fontSize: '12px', color: isDark ? '#9BA3AF' : '#64748b', fontStyle: 'italic', padding: 8 }}>
                    Loading family connections...
                  </div>
                ) : relationships.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#f87171', fontStyle: 'italic', padding: '6px 0' }}>
                    No family relationships linked yet. Every member must have at least one relationship. Click "+ Add Relation" above.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {relationships.map((rel) => {
                      let roleLabel = 'Relative';
                      let targetPersonId = '';
                      if (rel.relationship_type === 'parent') {
                        if (rel.person_id === personId) {
                          targetPersonId = rel.related_person_id;
                          const target = allPersons.find((p) => p.id === targetPersonId);
                          roleLabel = target?.gender === 'female' ? 'Mother' : target?.gender === 'male' ? 'Father' : 'Parent';
                        } else {
                          targetPersonId = rel.person_id;
                          const target = allPersons.find((p) => p.id === targetPersonId);
                          roleLabel = target?.gender === 'female' ? 'Daughter' : target?.gender === 'male' ? 'Son' : 'Child';
                        }
                      } else {
                        targetPersonId = rel.person_id === personId ? rel.related_person_id : rel.person_id;
                        roleLabel = 'Spouse';
                      }

                      const targetPerson = allPersons.find((p) => p.id === targetPersonId);
                      const targetName = targetPerson
                        ? [targetPerson.first_name, targetPerson.middle_name, targetPerson.last_name].filter(Boolean).join(' ')
                        : 'Unknown Member';

                      return (
                        <div
                          key={rel.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: isDark ? '#151922' : '#ffffff',
                            border: `1px solid ${isDark ? '#2D3748' : '#e2e8f0'}`,
                            borderRadius: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '3px 8px',
                                borderRadius: 4,
                                backgroundColor:
                                  roleLabel === 'Father' || roleLabel === 'Mother' || roleLabel === 'Parent'
                                    ? 'rgba(59, 130, 246, 0.15)'
                                    : roleLabel === 'Spouse'
                                    ? 'rgba(236, 72, 153, 0.15)'
                                    : 'rgba(34, 197, 94, 0.15)',
                                color:
                                  roleLabel === 'Father' || roleLabel === 'Mother' || roleLabel === 'Parent'
                                    ? '#60a5fa'
                                    : roleLabel === 'Spouse'
                                    ? '#f472b6'
                                    : '#4ade80',
                              }}
                            >
                              {roleLabel}
                            </span>
                            <span style={{ fontSize: '13.5px', fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                              {targetName}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteRelation(rel.id)}
                            title="Remove relation"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: 4,
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: 4,
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#1D2633' : '#fafaf9',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '12px', color: isDark ? '#9BA3AF' : '#64748b' }}>
            {isDirty && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#D6B15C' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D6B15C' }} />
                Unsaved changes
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRequestClose}
              disabled={saving}
              style={{ minWidth: 100 }}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="floating-person-form"
              className="btn btn-primary"
              disabled={saving || loading || !person}
              style={{
                minWidth: 140,
                backgroundColor: '#D6B15C',
                color: '#101318',
                borderColor: '#D6B15C',
                fontWeight: 650,
              }}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Unsaved Changes Confirmation Prompt */}
        {showUnsavedPrompt && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(16, 19, 24, 0.88)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 440,
                backgroundColor: isDark ? '#151922' : '#ffffff',
                border: '1.5px solid #D6B15C',
                borderRadius: 14,
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)',
                padding: '24px 22px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(214, 177, 92, 0.18)',
                  color: '#D6B15C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <AlertTriangle size={24} />
              </div>

              <h3
                style={{
                  fontFamily: "'Marcellus', serif",
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  margin: '0 0 8px',
                  color: isDark ? '#F1E9D7' : '#0f172a',
                }}
              >
                Unsaved Changes
              </h3>

              <p
                style={{
                  fontSize: '13.5px',
                  lineHeight: 1.5,
                  color: isDark ? '#9BA3AF' : '#64748b',
                  margin: '0 0 22px',
                }}
              >
                You have unsaved edits for <strong>{fullName}</strong>. What would you like to do before closing?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const success = await handleSave();
                    if (success) {
                      setShowUnsavedPrompt(false);
                    }
                  }}
                  disabled={saving}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    backgroundColor: '#D6B15C',
                    color: '#101318',
                    borderColor: '#D6B15C',
                    fontWeight: 650,
                  }}
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowUnsavedPrompt(false)}
                    style={{ justifyContent: 'center' }}
                  >
                    Continue Edit
                  </button>

                  <button
                    type="button"
                    style={{
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.45)',
                      color: '#f87171',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setShowUnsavedPrompt(false);
                      onClose();
                    }}
                  >
                    Discard & Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Cropper Modal with vertical rectangular portrait guide */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        imageFile={selectedPhotoFile}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};
