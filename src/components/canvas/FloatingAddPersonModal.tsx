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
  discoverSiblings,
  estimateBirthYearAndGeneration,
  validateKinshipChronology,
  inferInheritedSurname,
  calculateKinshipNomenclature,
  findNuclearFamilyBatchCandidates,
  parseFullName,
  KinshipNode,
  KinshipEdge,
  SiblingDiscoveryResult,
  GenerationEstimateResult,
  ChronologyIssue,
  NuclearFamilyBatchCandidate,
} from '../../utils/kinshipInference';
import { relationshipApi } from '../../services/relationshipApi';

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
  const [fullName, setFullName] = useState('');
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

  // Info tooltip state for Father relation
  const [showFatherInfo, setShowFatherInfo] = useState(false);

  // Photo Attachment & Cropping States (Vertical Rectangle Box)
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

  // Which Relation dot options state ('father' | 'mother' | 'spouse' | 'child')
  const [selectedRelationType, setSelectedRelationType] = useState<'father' | 'mother' | 'spouse' | 'child'>('father');

  // Kinship Auto-Inference Feedback & Batch Linking
  const [inferenceNotice, setInferenceNotice] = useState<string | null>(null);
  const [selectedBatchChildIds, setSelectedBatchChildIds] = useState<string[]>([]);

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Unsaved Changes Confirmation Dialog State
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-segregate full name into first, middle, last name
  const handleFullNameChange = (val: string) => {
    setFullName(val);
    const parsed = parseFullName(val);
    setFirstName(parsed.firstName);
    setMiddleName(parsed.middleName);
    setLastName(parsed.lastName);
    if (clientErrors.first_name) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next.first_name;
        return next;
      });
    }
  };

  const handleInheritSurname = (suggested: string) => {
    const parsed = parseFullName(fullName);
    const newFull = [parsed.firstName, parsed.middleName, suggested].filter(Boolean).join(' ');
    setFullName(newFull);
    setFirstName(parsed.firstName);
    setMiddleName(parsed.middleName);
    setLastName(suggested);
  };

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) {
      setShowUnsavedPrompt(false);
      return;
    }

    setFullName('');
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
    setSelectedRelationType('father');
    setSelectedBatchChildIds([]);
    setSelectedPhotoFile(null);
    setCroppedPhotoFile(null);
    setPhotoPreviewUrl(null);
    setIsCropperOpen(false);
    setInferenceNotice(null);
    setShowFatherInfo(false);
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

  // Derive kinship nodes & edges from layoutNodes (restricted to this house lineage)
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

  // Duplicate member suggestion in real time
  const duplicateMatches = useMemo(() => {
    return findDuplicateLineageMembers(firstName, lastName, effectiveKinshipNodes);
  }, [firstName, lastName, effectiveKinshipNodes]);

  // Filter available members for the "Who" dropdown based on "Which Relation"
  const availableMembersForSelectedRelation = useMemo(() => {
    if (selectedRelationType === 'father') {
      return effectiveKinshipNodes.filter((m) => m.gender === 'male');
    }
    if (selectedRelationType === 'mother') {
      return effectiveKinshipNodes.filter((m) => m.gender === 'female');
    }
    if (selectedRelationType === 'child') {
      return effectiveKinshipNodes.filter(
        (m) => m.id !== fatherId && m.id !== motherId && m.id !== spouseId
      );
    }
    // Spouse: if person is male, spouse dropdown only shows females, and vice versa
    if (selectedRelationType === 'spouse') {
      return effectiveKinshipNodes.filter(
        (m) =>
          m.id !== fatherId &&
          m.id !== motherId &&
          m.id !== childId &&
          (gender === 'male'
            ? m.gender === 'female'
            : gender === 'female'
            ? m.gender === 'male'
            : true)
      );
    }
    return effectiveKinshipNodes.filter(
      (m) => m.id !== fatherId && m.id !== motherId && m.id !== childId
    );
  }, [selectedRelationType, effectiveKinshipNodes, fatherId, motherId, spouseId, childId, gender]);

  // Clear spouse if user changes gender to one incompatible with currently selected spouse
  useEffect(() => {
    if (spouseId) {
      const sp = effectiveKinshipNodes.find((m) => m.id === spouseId);
      if (sp) {
        if (gender === 'male' && sp.gender !== 'female') {
          setSpouseId('');
        } else if (gender === 'female' && sp.gender !== 'male') {
          setSpouseId('');
        }
      }
    }
  }, [gender, spouseId, effectiveKinshipNodes]);

  // Helper to get formatted name of an ID
  const getMemberName = (id: string): string => {
    const found = effectiveKinshipNodes.find((m) => m.id === id);
    if (!found) return id;
    return [found.firstName, found.middleName, found.lastName].filter(Boolean).join(' ');
  };

  // Upgrade 1: Sibling Auto-Discovery (Reactive)
  const discoveredSiblings: SiblingDiscoveryResult = useMemo(() => {
    return discoverSiblings(
      fatherId || null,
      motherId || null,
      null,
      effectiveKinshipNodes,
      effectiveKinshipEdges
    );
  }, [fatherId, motherId, effectiveKinshipNodes, effectiveKinshipEdges]);

  // Upgrade 2: Generational Epoch & Birth Year Estimation (Reactive)
  const estimatedGeneration: GenerationEstimateResult | null = useMemo(() => {
    return estimateBirthYearAndGeneration({
      fatherId: fatherId || null,
      motherId: motherId || null,
      spouseId: spouseId || null,
      childId: childId || null,
      nodes: effectiveKinshipNodes,
    });
  }, [fatherId, motherId, spouseId, childId, effectiveKinshipNodes]);

  // Upgrade 3: Biological & Chronological Sanity Checks (Reactive)
  const chronologyIssues: ChronologyIssue[] = useMemo(() => {
    return validateKinshipChronology({
      subjectBirthDate: birthDate,
      subjectDeathDate: deathDate,
      isLiving,
      fatherId: fatherId || null,
      motherId: motherId || null,
      childId: childId || null,
      currentPersonId: null,
      nodes: effectiveKinshipNodes,
      edges: effectiveKinshipEdges,
    });
  }, [birthDate, deathDate, isLiving, fatherId, motherId, childId, effectiveKinshipNodes, effectiveKinshipEdges]);

  // Upgrade 4: Surname Inheritance
  const surnameInference = useMemo(() => {
    return inferInheritedSurname(fatherId, lastName, effectiveKinshipNodes);
  }, [fatherId, lastName, effectiveKinshipNodes]);

  // Upgrade 5: Multi-Spouse Disambiguation Candidates
  const fatherSpouses = useMemo(() => {
    if (!fatherId) return [];
    const spEdges = effectiveKinshipEdges.filter(
      (e) => e.type === 'spouse' && (e.source === fatherId || e.target === fatherId)
    );
    return spEdges.map((e) => {
      const sId = e.source === fatherId ? e.target : e.source;
      const sNode = effectiveKinshipNodes.find((n) => n.id === sId);
      return {
        id: sId,
        fullName: sNode ? [sNode.firstName, sNode.middleName, sNode.lastName].filter(Boolean).join(' ') : sId,
        birthYear: sNode?.birthYear,
        gender: sNode?.gender,
      };
    });
  }, [fatherId, effectiveKinshipEdges, effectiveKinshipNodes]);

  const motherSpouses = useMemo(() => {
    if (!motherId) return [];
    const spEdges = effectiveKinshipEdges.filter(
      (e) => e.type === 'spouse' && (e.source === motherId || e.target === motherId)
    );
    return spEdges.map((e) => {
      const sId = e.source === motherId ? e.target : e.source;
      const sNode = effectiveKinshipNodes.find((n) => n.id === sId);
      return {
        id: sId,
        fullName: sNode ? [sNode.firstName, sNode.middleName, sNode.lastName].filter(Boolean).join(' ') : sId,
        birthYear: sNode?.birthYear,
        gender: sNode?.gender,
      };
    });
  }, [motherId, effectiveKinshipEdges, effectiveKinshipNodes]);

  // Upgrade 7: Cascading Nuclear Family Batch Linking Candidates
  const nuclearFamilyCandidates: NuclearFamilyBatchCandidate[] = useMemo(() => {
    if (!spouseId) return [];
    return findNuclearFamilyBatchCandidates(
      spouseId,
      null,
      effectiveKinshipNodes,
      effectiveKinshipEdges
    );
  }, [spouseId, effectiveKinshipNodes, effectiveKinshipEdges]);

  useEffect(() => {
    if (nuclearFamilyCandidates.length > 0) {
      setSelectedBatchChildIds(
        nuclearFamilyCandidates.filter((c) => !c.hasOtherParent).map((c) => c.childId)
      );
    } else {
      setSelectedBatchChildIds([]);
    }
  }, [nuclearFamilyCandidates]);

  // Dirty detection
  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    return (
      fullName.trim() !== '' ||
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
    fullName,
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

  // Mandatory relationship validation & Biological/Chronological Sanity Checks
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const parsed = parseFullName(fullName);
    const effectiveFirst = parsed.firstName || firstName;
    if (!effectiveFirst.trim()) {
      errors.first_name = 'Full name is required (e.g. Subramanyam Chetty Paradarami).';
    }
    if (isLiving && deathDate) {
      errors.death_date = 'Living persons cannot have a date of death.';
    }
    if (!fatherId && !motherId && !spouseId && !childId) {
      errors.relations =
        'Please select at least one family relationship (Father, Mother, Spouse, or Child) to connect this person to the family lineage.';
    }
    // Critical Chronology / Cycle Errors check
    const criticalError = chronologyIssues.find((c) => c.severity === 'error');
    if (criticalError) {
      errors.chronology = criticalError.message;
    }
    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Auto-inference when relations are selected
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
        subjectBirthDate: birthDate,
        nodes: effectiveKinshipNodes,
        edges: effectiveKinshipEdges,
      });
      if (res.inferredMotherId && !motherId) {
        setMotherId(res.inferredMotherId);
        setInferenceNotice(res.reason || null);
      } else if (res.requiresDisambiguation) {
        setInferenceNotice(res.reason || null);
      }
      if (res.suggestedSurname && !lastName.trim()) {
        setLastName(res.suggestedSurname);
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
        subjectBirthDate: birthDate,
        nodes: effectiveKinshipNodes,
        edges: effectiveKinshipEdges,
      });
      if (res.inferredFatherId && !fatherId) {
        setFatherId(res.inferredFatherId);
        setInferenceNotice(res.reason || null);
        if (res.suggestedSurname && !lastName.trim()) {
          setLastName(res.suggestedSurname);
        }
      } else if (res.requiresDisambiguation) {
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
        subjectBirthDate: birthDate,
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
        subjectBirthDate: birthDate,
        nodes: effectiveKinshipNodes,
        edges: effectiveKinshipEdges,
      });
      if (res.inferredChildId && !childId) {
        setChildId(res.inferredChildId);
        setInferenceNotice(res.reason || null);
      }
    }
  };

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

    const parsed = parseFullName(fullName);
    const finalFirst = (parsed.firstName || firstName).trim();
    const finalMiddle = (parsed.middleName || middleName).trim() || null;
    const finalLast = (parsed.lastName || lastName || surnameInference.suggestedSurname || '').trim() || null;

    const input: CreatePersonInput = {
      first_name: finalFirst,
      middle_name: finalMiddle,
      last_name: finalLast,
      alias: alias.trim() || null,
      gender,
      is_living: isLiving,
      birth_date: normalizeDateInput(birthDate),
      death_date: !isLiving ? normalizeDateInput(deathDate) : null,
      birth_place: birthPlace.trim() || null,
      death_place: !isLiving && deathPlace.trim() ? deathPlace.trim() : null,
      biography: biography.trim(),
      profile_photo: photoPreviewUrl || null,
      father_id: fatherId || null,
      mother_id: motherId || null,
      spouse_id: spouseId || null,
      child_id: childId || null,
    };

    try {
      const res = await personApi.create(input);
      if (res.success && res.data) {
        const createdPerson = res.data;
        if (photoPreviewUrl && !createdPerson.profile_photo) {
          createdPerson.profile_photo = photoPreviewUrl;
        }

        // Upgrade 7: Cascading Nuclear Family Batch Linking
        if (selectedBatchChildIds.length > 0) {
          try {
            await Promise.all(
              selectedBatchChildIds.map((cId) =>
                relationshipApi.create({
                  person_id: cId,
                  related_person_id: createdPerson.id,
                  relationship_type: 'parent',
                })
              )
            );
          } catch (batchErr) {
            console.error('Failed to batch link nuclear family children:', batchErr);
          }
        }

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
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="floating-add-dialog"
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
                Record a new member in the Family Tree
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
                }}
              >
                Basic Identification
              </h3>

              <div className="add-person-id-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Vertical Rectangle Photo Upload Box */}
                <div className="add-person-photo-col" style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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

                  {/* Photo action buttons */}
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
                          onClick={() => setIsCropperOpen(true)}
                          title="Edit / Crop Photo"
                          style={{
                            padding: '5px 6px',
                            borderRadius: 6,
                            fontSize: '11px',
                            fontWeight: 600,
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
                <div className="add-person-fields-col" style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={fullName}
                        onChange={(e) => handleFullNameChange(e.target.value)}
                        placeholder="e.g. Subramanyam Chetty Paradarami"
                        required
                        autoFocus
                      />
                      <span style={{ display: 'block', fontSize: '11px', color: isDark ? '#9BA3AF' : '#64748b', marginTop: 4 }}>
                        Hint: Enter full name together. First, middle, and family surname are automatically segregated.
                      </span>

                      {/* Real-time name segregation visual tags */}
                      {fullName.trim() && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: '6px 10px',
                            borderRadius: 6,
                            backgroundColor: isDark ? 'rgba(214, 177, 92, 0.08)' : '#fef9c3',
                            border: '1px solid rgba(214, 177, 92, 0.25)',
                            fontSize: '11.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ color: isDark ? '#9BA3AF' : '#78716c', fontWeight: 600 }}>Segregated:</span>
                          <span style={{ color: isDark ? '#F1E9D7' : '#1e293b' }}>
                            First: <strong style={{ color: '#D6B15C' }}>"{firstName || '(None)'}"</strong>
                          </span>
                          {middleName && (
                            <span style={{ color: isDark ? '#F1E9D7' : '#1e293b' }}>
                              Middle: <strong style={{ color: '#60a5fa' }}>"{middleName}"</strong>
                            </span>
                          )}
                          <span style={{ color: isDark ? '#F1E9D7' : '#1e293b' }}>
                            Family Name: <strong style={{ color: '#a78bfa' }}>"{lastName || surnameInference.suggestedSurname || '(None)'}"</strong>
                          </span>
                        </div>
                      )}

                      {/* Suggested surname helper button if not included in input */}
                      {surnameInference.suggestedSurname && !lastName && (
                        <button
                          type="button"
                          onClick={() => handleInheritSurname(surnameInference.suggestedSurname!)}
                          style={{
                            marginTop: 6,
                            background: 'none',
                            border: 'none',
                            color: '#D6B15C',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          💡 Inherit family surname "{surnameInference.suggestedSurname}"
                        </button>
                      )}

                      {clientErrors.first_name && (
                        <p style={{ color: '#f87171', fontSize: '12px', margin: '4px 0 0' }}>{clientErrors.first_name}</p>
                      )}
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
                        <strong>Notice:</strong> A member named <strong>"{duplicateMatches[0].fullName}"</strong> already exists in this lineage{' '}
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
                              name="gender-add"
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
                  {estimatedGeneration && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: 'rgba(214, 177, 92, 0.12)',
                          border: '1px solid rgba(214, 177, 92, 0.35)',
                          color: '#D6B15C',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                        title={estimatedGeneration.explanation}
                      >
                        ✨ Est. ~{estimatedGeneration.estimatedBirthYear} · {estimatedGeneration.generationName}
                      </span>
                      {estimatedGeneration.estimatedBirthYear && !birthDate && (
                        <button
                          type="button"
                          onClick={() => setBirthDate(String(estimatedGeneration.estimatedBirthYear))}
                          style={{
                            padding: '2px 7px',
                            borderRadius: 4,
                            backgroundColor: '#D6B15C',
                            color: '#10141d',
                            border: 'none',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Apply Year
                        </button>
                      )}
                    </div>
                  )}
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

              {/* Biological & Chronological Sanity Checks */}
              {chronologyIssues.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {chronologyIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor:
                          issue.severity === 'error'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                        border: `1px solid ${
                          issue.severity === 'error'
                            ? 'rgba(239, 68, 68, 0.35)'
                            : 'rgba(245, 158, 11, 0.35)'
                        }`,
                        color: issue.severity === 'error' ? '#f87171' : '#f59e0b',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {issue.severity === 'error' ? (
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      ) : (
                        <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                      )}
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lineage Relationships with Dot Options of "Which Relation" and Dropdown of "Who" */}
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
              <p style={{ fontSize: '12px', color: isDark ? '#9BA3AF' : '#64748b', margin: '0 0 16px' }}>
                Select which relation to connect, then choose who from this family tree. At least one relation is required.
              </p>

              {/* Relationship Validation Error Message */}
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

              {/* Auto-Inference Notice */}
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

              {/* Dot Options: "Which Relation" */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: 8, color: isDark ? '#D6B15C' : '#92400e' }}>
                  Which Relation *
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { type: 'father', label: 'Father' },
                    { type: 'mother', label: 'Mother' },
                    { type: 'spouse', label: 'Spouse' },
                    { type: 'child', label: 'Son / Daughter' },
                  ].map((rel) => {
                    const isSelected = selectedRelationType === rel.type;
                    const isAlreadyLinked =
                      rel.type === 'father' ? Boolean(fatherId) :
                      rel.type === 'mother' ? Boolean(motherId) :
                      rel.type === 'spouse' ? Boolean(spouseId) :
                      Boolean(childId);

                    return (
                      <label
                        key={rel.type}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          cursor: 'pointer',
                          padding: '6px 14px',
                          borderRadius: 8,
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(214, 177, 92, 0.18)' : '#fef3c7')
                            : (isDark ? '#151922' : '#ffffff'),
                          border: `1.5px solid ${isSelected ? '#D6B15C' : (isDark ? '#343D49' : '#cbd5e1')}`,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="which-relation-add"
                          value={rel.type}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedRelationType(rel.type as any);
                            setInferenceNotice(null);
                          }}
                          style={{ width: 15, height: 15, accentColor: '#D6B15C', cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: isSelected ? 650 : 500,
                            color: isSelected ? '#D6B15C' : (isDark ? '#e2e8f0' : '#334155'),
                          }}
                        >
                          {rel.label} {isAlreadyLinked && '✓'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Dropdown: "Who" */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, margin: 0, color: isDark ? '#F1E9D7' : '#1e293b' }}>
                    Who ({selectedRelationType === 'father' ? 'Father' : selectedRelationType === 'mother' ? 'Mother' : selectedRelationType === 'spouse' ? 'Spouse' : 'Son / Daughter'}) *
                  </label>

                  {/* "i" Info Icon beside Who (Father) with hover and hold tooltip */}
                  {selectedRelationType === 'father' && (
                    <div
                      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                      onMouseEnter={() => setShowFatherInfo(true)}
                      onMouseLeave={() => setShowFatherInfo(false)}
                    >
                      <button
                        type="button"
                        aria-label="Why linking Father is optimal for the system"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowFatherInfo((prev) => !prev);
                        }}
                        onTouchStart={() => setShowFatherInfo(true)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          backgroundColor: showFatherInfo ? '#D6B15C' : (isDark ? 'rgba(214, 177, 92, 0.2)' : '#fef3c7'),
                          border: '1.5px solid #D6B15C',
                          color: showFatherInfo ? '#10141d' : '#D6B15C',
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: "'Inter', sans-serif",
                          fontStyle: 'italic',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'all 0.15s ease',
                          boxShadow: showFatherInfo ? '0 0 10px rgba(214, 177, 92, 0.5)' : 'none',
                        }}
                      >
                        i
                      </button>

                      {/* Tooltip shown on hover & hold */}
                      {showFatherInfo && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            left: 0,
                            width: 320,
                            maxWidth: 'calc(100vw - 60px)',
                            backgroundColor: isDark ? '#151922' : '#ffffff',
                            border: '1.5px solid #D6B15C',
                            boxShadow: isDark
                              ? '0 12px 30px rgba(0, 0, 0, 0.85), 0 0 15px rgba(214, 177, 92, 0.3)'
                              : '0 12px 28px rgba(0, 0, 0, 0.2)',
                            borderRadius: 10,
                            padding: '12px 14px',
                            zIndex: 9999,
                            fontSize: '12px',
                            lineHeight: 1.5,
                            color: isDark ? '#F1E9D7' : '#1e293b',
                            pointerEvents: 'auto',
                            animation: 'floatingModalFadeIn 0.15s ease-out',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#D6B15C', fontWeight: 700, fontSize: '12.5px' }}>
                            <span>👑 Why Father Relation is Recommended</span>
                          </div>
                          <p style={{ margin: '0 0 6px', color: isDark ? '#e2e8f0' : '#334155', fontSize: '11.5px' }}>
                            Connecting through the <strong>Father</strong> provides superior genealogical intelligence for this family tree:
                          </p>
                          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '11px', color: isDark ? '#cbd5e1' : '#475569' }}>
                            <li><strong>Patrilineal Surname Inheritance:</strong> Automatically establishes and inherits the lineage family surname.</li>
                            <li><strong>Generational Epoch Alignment:</strong> Accurately positions the member into the correct historical generational strip.</li>
                            <li><strong>Kinship Auto-Inference:</strong> Automatically discovers paternal siblings and links the biological mother.</li>
                            <li><strong>Direct Bloodline Tree Lines:</strong> Renders unbroken generational branch lines from the ancestral root.</li>
                          </ul>
                          <div style={{ marginTop: 8, fontSize: '10px', color: isDark ? '#9BA3AF' : '#64748b', fontStyle: 'italic', borderTop: `1px solid ${isDark ? '#2a3441' : '#e2e8f0'}`, paddingTop: 6 }}>
                            Hover or hold on "i" to keep open.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <select
                  className="form-select"
                  value={
                    selectedRelationType === 'father' ? fatherId :
                    selectedRelationType === 'mother' ? motherId :
                    selectedRelationType === 'spouse' ? spouseId :
                    childId
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (selectedRelationType === 'father') handleFatherSelect(val);
                    else if (selectedRelationType === 'mother') handleMotherSelect(val);
                    else if (selectedRelationType === 'spouse') handleSpouseSelect(val);
                    else handleChildSelect(val);
                  }}
                  style={{ width: '100%', fontSize: '13.5px', padding: '9px 12px' }}
                >
                  <option value="">-- Choose Member from this Family Tree --</option>
                  {availableMembersForSelectedRelation.map((m) => (
                    <option key={m.id} value={m.id}>
                      {[m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ')} {m.birthYear ? `(Born: ${m.birthYear})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upgrade 5: Multi-Spouse Disambiguation Cards */}
              {fatherSpouses.length > 1 && !motherId && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(214, 177, 92, 0.12)',
                    border: '1px solid rgba(214, 177, 92, 0.4)',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 650, color: '#D6B15C', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} />
                    <span>Father has {fatherSpouses.length} recorded spouses in this lineage. Select biological Mother:</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {fatherSpouses.map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setMotherId(cand.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          backgroundColor: isDark ? '#252E3A' : '#ffffff',
                          border: '1px solid #D6B15C',
                          color: '#D6B15C',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{cand.fullName}</span>
                        {cand.birthYear && <span style={{ opacity: 0.75, fontSize: '11px' }}>({cand.birthYear})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {motherSpouses.length > 1 && !fatherId && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(214, 177, 92, 0.12)',
                    border: '1px solid rgba(214, 177, 92, 0.4)',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 650, color: '#D6B15C', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} />
                    <span>Mother has {motherSpouses.length} recorded spouses in this lineage. Select biological Father:</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {motherSpouses.map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setFatherId(cand.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          backgroundColor: isDark ? '#252E3A' : '#ffffff',
                          border: '1px solid #D6B15C',
                          color: '#D6B15C',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{cand.fullName}</span>
                        {cand.birthYear && <span style={{ opacity: 0.75, fontSize: '11px' }}>({cand.birthYear})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Relationships Badges with Upgrade 6: Deep Kinship Nomenclature */}
              {(fatherId || motherId || spouseId || childId) && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${isDark ? '#2a3441' : '#e2e8f0'}` }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: isDark ? '#9BA3AF' : '#64748b', marginBottom: 8 }}>
                    Currently Connected Relations for this Person:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {fatherId && (() => {
                      const nom = calculateKinshipNomenclature('father', 'male', true, true);
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#60a5fa',
                            fontSize: '12px',
                          }}
                        >
                          <strong>{nom.formalEnglish} ({nom.traditionalTelugu}):</strong> {getMemberName(fatherId)}
                          <button
                            type="button"
                            onClick={() => setFatherId('')}
                            title="Remove Father"
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })()}
                    {motherId && (() => {
                      const nom = calculateKinshipNomenclature('mother', 'female', true, true);
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(236, 72, 153, 0.15)',
                            border: '1px solid rgba(236, 72, 153, 0.4)',
                            color: '#f472b6',
                            fontSize: '12px',
                          }}
                        >
                          <strong>{nom.formalEnglish} ({nom.traditionalTelugu}):</strong> {getMemberName(motherId)}
                          <button
                            type="button"
                            onClick={() => setMotherId('')}
                            title="Remove Mother"
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })()}
                    {spouseId && (() => {
                      const spNode = effectiveKinshipNodes.find((n) => n.id === spouseId);
                      const nom = calculateKinshipNomenclature('spouse', spNode?.gender || 'female', true, true);
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(214, 177, 92, 0.15)',
                            border: '1px solid rgba(214, 177, 92, 0.4)',
                            color: '#D6B15C',
                            fontSize: '12px',
                          }}
                        >
                          <strong>{nom.formalEnglish} ({nom.traditionalTelugu}):</strong> {getMemberName(spouseId)}
                          <button
                            type="button"
                            onClick={() => setSpouseId('')}
                            title="Remove Spouse"
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })()}
                    {childId && (() => {
                      const chNode = effectiveKinshipNodes.find((n) => n.id === childId);
                      const nom = calculateKinshipNomenclature(
                        chNode?.gender === 'female' ? 'daughter' : 'son',
                        chNode?.gender || 'male',
                        true,
                        true
                      );
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            border: '1px solid rgba(34, 197, 94, 0.4)',
                            color: '#4ade80',
                            fontSize: '12px',
                          }}
                        >
                          <strong>{nom.formalEnglish} ({nom.traditionalTelugu}):</strong> {getMemberName(childId)}
                          <button
                            type="button"
                            onClick={() => setChildId('')}
                            title="Remove Child"
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Upgrade 1: Sibling Auto-Discovery Display */}
              {(discoveredSiblings.fullSiblings.length > 0 || discoveredSiblings.halfSiblings.length > 0) && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 650, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 6 }}>
                    👨‍👩‍👧‍👦 Auto-Discovered Siblings in Lineage ({discoveredSiblings.fullSiblings.length + discoveredSiblings.halfSiblings.length}):
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {discoveredSiblings.fullSiblings.map((sib) => {
                      const nom = calculateKinshipNomenclature(
                        'sibling',
                        sib.gender || 'male',
                        true,
                        (sib.birthYear || 0) < (parseInt(birthDate.slice(0, 4), 10) || 9999)
                      );
                      return (
                        <span
                          key={sib.id}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor: isDark ? '#1a2230' : '#e2e8f0',
                            border: `1px solid ${isDark ? '#3b495e' : '#cbd5e1'}`,
                            fontSize: '11.5px',
                            color: isDark ? '#cbd5e1' : '#334155',
                          }}
                        >
                          {sib.fullName} · <strong style={{ color: '#D6B15C' }}>{nom.formalEnglish} ({nom.traditionalTelugu})</strong>
                        </span>
                      );
                    })}
                    {discoveredSiblings.halfSiblings.map((sib) => (
                      <span
                        key={sib.id}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: isDark ? '#1a2230' : '#e2e8f0',
                          border: `1px solid ${isDark ? '#3b495e' : '#cbd5e1'}`,
                          fontSize: '11.5px',
                          color: isDark ? '#94a3b8' : '#64748b',
                        }}
                      >
                        {sib.fullName} (Half-sibling via {sib.sharedParent})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Upgrade 7: Cascading Nuclear Family Batch Linking Card */}
              {nuclearFamilyCandidates.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 650, color: '#60a5fa', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>👨‍👩‍👧‍👦 Connect Entire Nuclear Family</span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: isDark ? '#9BA3AF' : '#64748b', margin: '0 0 10px' }}>
                    Found {nuclearFamilyCandidates.length} existing children of {getMemberName(spouseId)}. Select children to automatically link as offspring of this new member:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {nuclearFamilyCandidates.map((child) => (
                      <label
                        key={child.childId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: isDark ? '#e2e8f0' : '#1e293b',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBatchChildIds.includes(child.childId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBatchChildIds((prev) => [...prev, child.childId]);
                            } else {
                              setSelectedBatchChildIds((prev) => prev.filter((id) => id !== child.childId));
                            }
                          }}
                          style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }}
                        />
                        <span>
                          {child.fullName} {child.birthYear ? `(Born: ${child.birthYear})` : ''}
                          {child.hasOtherParent && (
                            <span style={{ marginLeft: 6, fontSize: '11px', color: '#f59e0b' }}>
                              (Already has another parent recorded)
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
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
