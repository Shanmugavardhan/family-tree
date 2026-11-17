import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePerson } from '../hooks/usePerson';
import { PersonForm } from '../components/persons/PersonForm';
import { UpdatePersonInput } from '../types/person';
import { personApi } from '../services/personApi';
import { ArrowLeft, Edit3, AlertCircle } from 'lucide-react';

export const EditPersonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { person, loading: initialLoading, error: loadError } = usePerson(id);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleUpdate = async (data: any) => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await personApi.update(id, data as UpdatePersonInput);
      if (res.success && res.data) {
        navigate(`/people/${id}`);
      } else {
        setSaveError(res.error?.message || 'Failed to update person information.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network error updating person.');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-slate-500)' }}>
        <p>Loading person information...</p>
      </div>
    );
  }

  if (loadError || !person) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <AlertCircle size={36} color="var(--color-rose-600)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Person Not Found</h3>
        <p style={{ color: 'var(--color-slate-500)', marginBottom: 20 }}>
          {loadError || 'The requested person could not be found.'}
        </p>
        <Link to="/people" className="btn btn-secondary">
          Return to Directory
        </Link>
      </div>
    );
  }

  const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          to={`/people/${id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--color-slate-500)',
            fontSize: '0.875rem',
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to {fullName}&apos;s Profile</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-slate-100)',
              color: 'var(--color-slate-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Edit3 size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
              Edit Profile: {fullName}
            </h2>
            <p style={{ color: 'var(--color-slate-500)', fontSize: '0.8125rem' }}>
              Permanent Record ID: <code>{person.id}</code>
            </p>
          </div>
        </div>
      </div>

      <PersonForm
        initialValues={person}
        isEdit={true}
        onSubmit={handleUpdate}
        loading={saving}
        serverError={saveError}
      />
    </div>
  );
};

