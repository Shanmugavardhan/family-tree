import { useState, useEffect, useCallback } from 'react';
import { Person } from '../types/person';
import { personApi } from '../services/personApi';

export function usePersons(initialParams?: { search?: string; includeArchived?: boolean }) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>(initialParams?.search || '');
  const [includeArchived, setIncludeArchived] = useState<boolean>(initialParams?.includeArchived ?? false);

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personApi.getAll({ search, includeArchived });
      if (res.success && res.data) {
        setPersons(res.data);
      } else {
        setError(res.error?.message || 'Failed to fetch family members');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching family members');
    } finally {
      setLoading(false);
    }
  }, [search, includeArchived]);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  const archive = async (id: string): Promise<boolean> => {
    try {
      const res = await personApi.archive(id);
      if (res.success) {
        await fetchPersons();
        return true;
      } else {
        setError(res.error?.message || 'Failed to archive family member');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Network error archiving family member');
      return false;
    }
  };

  const restore = async (id: string): Promise<boolean> => {
    try {
      const res = await personApi.restore(id);
      if (res.success) {
        await fetchPersons();
        return true;
      } else {
        setError(res.error?.message || 'Failed to restore family member');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Network error restoring family member');
      return false;
    }
  };

  return {
    persons,
    loading,
    error,
    search,
    setSearch,
    includeArchived,
    setIncludeArchived,
    refetch: fetchPersons,
    archive,
    restore,
  };
}

