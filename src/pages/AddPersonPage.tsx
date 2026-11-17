import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PersonForm } from '../components/persons/PersonForm';
import { CreatePersonInput } from '../types/person';
import { personApi } from '../services/personApi';
import { ArrowLeft, UserPlus } from 'lucide-react';

export const AddPersonPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await personApi.create(data as CreatePersonInput);
      if (res.success && res.data) {
        navigate(`/people/${res.data.id}`);
      } else {
        setError(res.error?.message || 'Failed to create person record.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error creating person record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          to="/people"
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
          <span>Back to Family Directory</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserPlus size={20} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-slate-900)' }}>
            Add Family Member
          </h2>
        </div>
      </div>

      <PersonForm
        onSubmit={handleCreate}
        loading={loading}
        serverError={error}
      />
    </div>
  );
};

