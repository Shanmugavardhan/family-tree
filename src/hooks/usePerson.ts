import { useState, useEffect, useCallback } from 'react';
import { Person } from '../types/person';
import { DerivedRelativesResponse } from '../types/relative';
import { personApi } from '../services/personApi';

export function usePerson(personId: string | undefined) {
  const [person, setPerson] = useState<Person | null>(null);
  const [relatives, setRelatives] = useState<DerivedRelativesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPersonData = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    try {
      const [personRes, relativesRes] = await Promise.all([
        personApi.getById(personId, { includeArchived: true }),
        personApi.getRelatives(personId, { includeArchived: true }),
      ]);

      if (personRes.success && personRes.data) {
        setPerson(personRes.data);
      } else {
        setError(personRes.error?.message || 'Failed to load person profile');
        setLoading(false);
        return;
      }

      if (relativesRes.success && relativesRes.data) {
        setRelatives(relativesRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to family tree service');
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchPersonData();
  }, [fetchPersonData]);

  const uploadPhoto = async (file: File): Promise<boolean> => {
    if (!personId) return false;
    try {
      const res = await personApi.uploadPhoto(personId, file);
      if (res.success && res.data) {
        setPerson(res.data.person);
        return true;
      } else {
        setError(res.error?.message || 'Failed to upload photograph');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Error uploading photograph');
      return false;
    }
  };

  const deletePhoto = async (): Promise<boolean> => {
    if (!personId) return false;
    try {
      const res = await personApi.deletePhoto(personId);
      if (res.success && res.data) {
        setPerson(res.data.person);
        return true;
      } else {
        setError(res.error?.message || 'Failed to remove photograph');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Error removing photograph');
      return false;
    }
  };

  return {
    person,
    relatives,
    loading,
    error,
    refetch: fetchPersonData,
    uploadPhoto,
    deletePhoto,
  };
}

