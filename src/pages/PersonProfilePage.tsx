import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePerson } from '../hooks/usePerson';
import { PhotoUploader } from '../components/photos/PhotoUploader';
import { RelativesList } from '../components/relatives/RelativesList';
import { personApi } from '../services/personApi';
import { PerspectiveRelationshipResult } from '../types/relative';
import {
  ArrowLeft,
  Edit3,
  Archive,
  RotateCcw,
  GitCompare,
  AlertCircle,
} from 'lucide-react';

export const PersonProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { person, relatives, loading, error, refetch, uploadPhoto, deletePhoto } = usePerson(id);

  // Perspective Relationship Explorer state
  const [compareTargetId, setCompareTargetId] = useState<string>('');
  const [comparing, setComparing] = useState<boolean>(false);
  const [compareResult, setCompareResult] = useState<PerspectiveRelationshipResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Available people for comparison
  const [allFamilyList, setAllFamilyList] = useState<{ id: string; name: string }[]>([]);

  // Load family list once
  React.useEffect(() => {
    personApi.getAll({ includeArchived: true }).then((res) => {
      if (res.success && res.data) {
        setAllFamilyList(
          res.data
            .filter((p) => p.id !== id)
            .map((p) => ({
              id: p.id,
              name: [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '),
            }))
        );
      }
    });
  }, [id]);

  const handleCompare = async (targetId: string) => {
    setCompareTargetId(targetId);
    if (!id || !targetId) {
      setCompareResult(null);
      return;
    }
    setComparing(true);
    setCompareError(null);
    try {
      const res = await personApi.getRelationshipTo(id, targetId);
      if (res.success && res.data) {
        setCompareResult(res.data);
      } else {
        setCompareError(res.error?.message || 'Could not calculate relationship.');
      }
    } catch (err: any) {
      setCompareError(err.message || 'Error calculating relationship.');
    } finally {
      setComparing(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!person) return;
    if (person.is_archived) {
      if (window.confirm(`Restore ${person.first_name} to active members?`)) {
        await personApi.restore(person.id);
        await refetch();
      }
    } else {
      if (window.confirm(`Are you sure you want to archive ${person.first_name}?`)) {
        await personApi.archive(person.id);
        await refetch();
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--color-slate-500)' }}>
        <p>Loading profile and calculating relatives...</p>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <AlertCircle size={36} color="var(--color-rose-600)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Profile Not Available</h3>
        <p style={{ color: 'var(--color-slate-500)', marginBottom: 20 }}>
          {error || 'The requested person record was not found.'}
        </p>
        <Link to="/" className="btn btn-secondary">
          Return to Family Tree
        </Link>
      </div>
    );
  }

  const fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
  const initials = `${person.first_name[0]}${person.last_name ? person.last_name[0] : ''}`.toUpperCase();
  const photoUrl = person.profile_photo ? personApi.getPhotoUrl(person.id, person.is_archived) : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Back button */}
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--color-slate-500)',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Family Tree</span>
        </Link>
      </div>

      {/* Main Profile Header Card */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          padding: 28,
          position: 'relative',
          borderColor: person.is_archived ? 'var(--color-amber-300)' : 'var(--color-slate-200)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={fullName}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #ffffff',
                  boxShadow: 'var(--shadow-md)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  backgroundColor: person.gender === 'female' ? '#fce7f3' : '#e0f2fe',
                  color: person.gender === 'female' ? '#be185d' : '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '2rem',
                  boxShadow: 'var(--shadow-md)',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <span className={`badge badge-${person.is_living ? 'living' : 'deceased'}`}>
                  {person.is_living ? 'Living' : 'Deceased'}
                </span>
                <span className={`badge badge-${person.gender}`}>{person.gender}</span>
                {person.is_archived && <span className="badge badge-archived">Archived Profile</span>}
              </div>

              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                {fullName}
              </h2>
              {person.alias && (
                <p style={{ color: 'var(--color-slate-500)', fontSize: '0.9375rem', fontStyle: 'italic', marginTop: 2 }}>
                  Also known as &ldquo;{person.alias}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            {!person.is_archived && (
              <Link to={`/people/${person.id}/edit`} className="btn btn-secondary btn-sm">
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </Link>
            )}

            <button
              onClick={handleArchiveToggle}
              className={`btn btn-sm ${person.is_archived ? 'btn-secondary' : 'btn-danger'}`}
            >
              {person.is_archived ? <RotateCcw size={15} /> : <Archive size={15} />}
              <span>{person.is_archived ? 'Restore Profile' : 'Archive'}</span>
            </button>
          </div>
        </div>

        {/* Vital Info Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid var(--color-slate-100)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-400)', textTransform: 'uppercase' }}>
              Birth Date & Place
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-slate-800)', marginTop: 4 }}>
              {person.birth_date || 'Unknown date'}
            </div>
            {person.birth_place && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: 2 }}>
                {person.birth_place}
              </div>
            )}
          </div>

          {!person.is_living && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-rose-600)', textTransform: 'uppercase' }}>
                Passing Date & Place
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-slate-800)', marginTop: 4 }}>
                {person.death_date || 'Date unrecorded'}
              </div>
              {person.death_place && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginTop: 2 }}>
                  {person.death_place}
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-400)', textTransform: 'uppercase' }}>
              Record ID
            </div>
            <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--color-slate-600)', marginTop: 4 }}>
              {person.id}
            </div>
          </div>
        </div>

        {/* Biography */}
        {person.biography && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-slate-100)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-slate-400)', textTransform: 'uppercase', marginBottom: 6 }}>
              Biography & Family Notes
            </div>
            <p style={{ color: 'var(--color-slate-700)', fontSize: '0.9375rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {person.biography}
            </p>
          </div>
        )}
      </div>

      {/* Photo Uploader */}
      <div style={{ marginBottom: 24 }}>
        <PhotoUploader
          personId={person.id}
          currentPhoto={person.profile_photo}
          onPhotoUploaded={uploadPhoto}
          onPhotoDeleted={deletePhoto}
          isArchived={person.is_archived}
        />
      </div>

      {/* Perspective Relationship Explorer */}
      <div className="card" style={{ marginBottom: 24, backgroundColor: 'var(--color-indigo-50)', borderColor: 'var(--color-indigo-100)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <GitCompare size={20} color="var(--color-indigo-600)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-indigo-700)' }}>
            Dynamic Kinship Explorer: Perspective-Dependent Derivation
          </h3>
        </div>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.875rem', marginBottom: 16 }}>
          Select any family member to see how they are dynamically related to <strong>{fullName}</strong>:
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <select
            className="form-select"
            style={{ maxWidth: 360, backgroundColor: '#ffffff' }}
            value={compareTargetId}
            onChange={(e) => handleCompare(e.target.value)}
          >
            <option value="">-- Choose a relative to examine kinship --</option>
            {allFamilyList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {comparing && <span style={{ fontSize: '0.8125rem', color: 'var(--color-indigo-600)' }}>Calculating graph...</span>}
        </div>

        {compareResult && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              border: '1px solid var(--color-indigo-100)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', fontWeight: 600, textTransform: 'uppercase' }}>
                  From {compareResult.from_person.full_name}&apos;s Viewpoint:
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-indigo-600)', marginTop: 4 }}>
                  {compareResult.to_person.full_name} is your{' '}
                  <span style={{ textDecoration: 'underline' }}>{compareResult.relationship}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Reciprocal Viewpoint ({compareResult.to_person.full_name}):
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: 4 }}>
                  You are their{' '}
                  <span style={{ textDecoration: 'underline' }}>{compareResult.reverse_relationship}</span>
                </div>
              </div>
            </div>

            {compareResult.path?.[0] && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-slate-100)', fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
                Genealogical Path: <code>{compareResult.path.join(' -> ')}</code>
              </div>
            )}
          </div>
        )}

        {compareError && (
          <div style={{ color: 'var(--color-rose-600)', fontSize: '0.875rem', marginTop: 8 }}>
            {compareError}
          </div>
        )}
      </div>

      {/* Relatives List */}
      {relatives && <RelativesList relativesData={relatives} />}
    </div>
  );
};
