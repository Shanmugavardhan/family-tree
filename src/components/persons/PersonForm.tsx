import React, { useState } from 'react';
import { CreatePersonInput, UpdatePersonInput, Gender, Person } from '../../types/person';
import { RelationshipSelector } from './RelationshipSelector';
import { AlertCircle, Save } from 'lucide-react';
import { normalizeDateInput } from '../../utils/dateUtils';

interface PersonFormProps {
  initialValues?: Partial<Person>;
  isEdit?: boolean;
  onSubmit: (data: CreatePersonInput | UpdatePersonInput) => Promise<void>;
  loading?: boolean;
  serverError?: string | null;
}

export const PersonForm: React.FC<PersonFormProps> = ({
  initialValues,
  isEdit = false,
  onSubmit,
  loading = false,
  serverError = null,
}) => {
  const [firstName, setFirstName] = useState(initialValues?.first_name || '');
  const [middleName, setMiddleName] = useState(initialValues?.middle_name || '');
  const [lastName, setLastName] = useState(initialValues?.last_name || '');
  const [alias, setAlias] = useState(initialValues?.alias || '');
  const [gender, setGender] = useState<Gender>(initialValues?.gender || 'male');
  const [isLiving, setIsLiving] = useState<boolean>(initialValues?.is_living ?? true);
  const [birthDate, setBirthDate] = useState(initialValues?.birth_date || '');
  const [deathDate, setDeathDate] = useState(initialValues?.death_date || '');
  const [birthPlace, setBirthPlace] = useState(initialValues?.birth_place || '');
  const [deathPlace, setDeathPlace] = useState(initialValues?.death_place || '');
  const [biography, setBiography] = useState(initialValues?.biography || '');

  // Parent / Spouse IDs (only for creation)
  const [fatherId, setFatherId] = useState<string | null>(null);
  const [motherId, setMotherId] = useState<string | null>(null);
  const [spouseId, setSpouseId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!firstName.trim()) {
      errs.first_name = 'First name is required.';
    }

    if (isLiving && deathDate.trim()) {
      errs.death_date = 'Living person cannot have a death date.';
    }

    if (!isLiving && !deathDate.trim() && !isEdit) {
      // warning or optional? Death date is optional in schema, but good practice
    }

    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEdit) {
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
      await onSubmit(updatePayload);
    } else {
      const createPayload: CreatePersonInput = {
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
        father_id: fatherId,
        mother_id: motherId,
        spouse_id: spouseId,
        child_id: childId,
      };
      await onSubmit(createPayload);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {serverError && (
        <div
          style={{
            background: 'var(--color-rose-50)',
            border: '1px solid var(--color-rose-100)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--color-rose-700)',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{serverError}</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 18, color: 'var(--color-slate-900)' }}>
          Basic Identification
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">First Name *</label>
            <input
              type="text"
              className="form-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Vikram"
              required
            />
            {clientErrors.first_name && <p className="form-error">{clientErrors.first_name}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Middle Name</label>
            <input
              type="text"
              className="form-input"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="e.g. Prasad"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Last Name / Family Name</label>
            <input
              type="text"
              className="form-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Sharma"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Alias / Known As</label>
            <input
              type="text"
              className="form-input"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Raju"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Gender *</label>
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

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <label className="form-label">Status</label>
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
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-slate-700)' }}>
                Deceased
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 18, color: 'var(--color-slate-900)' }}>
          Dates & Locations
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input
              type="text"
              className="form-input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              placeholder="YYYY or YYYY-MM-DD (e.g. 1965)"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Birth Place</label>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Date of Death</label>
              <input
                type="text"
                className="form-input"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
                placeholder="YYYY or YYYY-MM-DD (e.g. 2018)"
              />
              {clientErrors.death_date && <p className="form-error">{clientErrors.death_date}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Place of Passing</label>
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

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Biography & Notes</label>
          <textarea
            className="form-textarea"
            rows={4}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            placeholder="Education, profession, personal history, or notable family memories..."
          />
        </div>
      </div>

      {!isEdit && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-slate-900)' }}>
            Initial Relationships (Optional)
          </h3>
          <p style={{ color: 'var(--color-slate-500)', fontSize: '0.875rem', marginBottom: 20 }}>
            Attach parents and spouse directly during creation. These links will be created atomically with the person.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <RelationshipSelector
              label="Father"
              selectedId={fatherId}
              onSelect={setFatherId}
              genderHint="male"
            />
            <RelationshipSelector
              label="Mother"
              selectedId={motherId}
              onSelect={setMotherId}
              genderHint="female"
            />
            <RelationshipSelector
              label="Spouse"
              selectedId={spouseId}
              onSelect={setSpouseId}
            />
            <RelationshipSelector
              label="Son / Daughter"
              selectedId={childId}
              onSelect={setChildId}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ minWidth: 140 }}
        >
          <Save size={16} />
          <span>{loading ? 'Saving...' : isEdit ? 'Update Member' : 'Create Member'}</span>
        </button>
      </div>
    </form>
  );
};

