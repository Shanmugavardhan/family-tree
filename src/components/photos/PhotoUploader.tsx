import React, { useState, useRef } from 'react';
import { Camera, Trash2, Upload, AlertCircle, CheckCircle } from 'lucide-react';

interface PhotoUploaderProps {
  personId: string;
  currentPhoto: string | null;
  onPhotoUploaded: (file: File) => Promise<boolean>;
  onPhotoDeleted: () => Promise<boolean>;
  isArchived?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  currentPhoto,
  onPhotoUploaded,
  onPhotoDeleted,
  isArchived = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5 MB limit. Please select a smaller photo.');
      return;
    }

    // Check type: JPEG, PNG, WebP
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setError('Invalid file format. Only JPEG, PNG, and WebP photographs are supported.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const ok = await onPhotoUploaded(selectedFile);
    setLoading(false);
    if (ok) {
      setSuccessMsg('Profile photograph uploaded successfully!');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setError('Failed to upload photograph. Please check file format.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to remove this profile photograph?')) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const ok = await onPhotoDeleted();
    setLoading(false);
    if (ok) {
      setSuccessMsg('Photograph removed. Reset to default avatar.');
      setSelectedFile(null);
      setPreviewUrl(null);
    } else {
      setError('Failed to delete photograph.');
    }
  };

  const handleCancelPreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-slate-900)', marginBottom: 12 }}>
        Profile Photograph
      </h3>

      {isArchived && (
        <div style={{ color: 'var(--color-amber-700)', fontSize: '0.8125rem', marginBottom: 12 }}>
          Note: This person is archived. Photos cannot be uploaded or deleted while archived.
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'var(--color-rose-50)',
            border: '1px solid var(--color-rose-100)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: '0.8125rem',
            color: 'var(--color-rose-700)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            background: 'var(--color-emerald-50)',
            border: '1px solid var(--color-emerald-100)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: '0.8125rem',
            color: 'var(--color-emerald-700)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Preview selected file */}
      {previewUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <img
            src={previewUrl}
            alt="Preview"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--color-primary)',
            }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Selected: {selectedFile?.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginBottom: 8 }}>
              Size: {selectedFile ? (selectedFile.size / 1024).toFixed(1) : 0} KB
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleUpload}
                disabled={loading || isArchived}
                className="btn btn-primary btn-sm"
              >
                <Upload size={14} />
                <span>{loading ? 'Uploading...' : 'Confirm Upload'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancelPreview}
                disabled={loading}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            disabled={loading || isArchived}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isArchived}
            className="btn btn-secondary btn-sm"
          >
            <Camera size={15} />
            <span>{currentPhoto ? 'Change Photo' : 'Upload Photo'}</span>
          </button>

          {currentPhoto && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || isArchived}
              className="btn btn-danger btn-sm"
              title="Remove photograph"
            >
              <Trash2 size={15} />
              <span>Remove Photo</span>
            </button>
          )}

          <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>
            JPEG, PNG, or WebP &le; 5MB
          </span>
        </div>
      )}
    </div>
  );
};
