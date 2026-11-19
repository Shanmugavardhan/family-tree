export type Gender = 'male' | 'female' | 'other' | 'unknown';

export interface Person {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  alias: string | null;
  gender: Gender;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  death_place: string | null;
  profile_photo: string | null;
  biography: string;
  is_living: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CreatePersonInput {
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  alias?: string | null;
  gender: Gender;
  birth_date?: string | null;
  death_date?: string | null;
  birth_place?: string | null;
  death_place?: string | null;
  profile_photo?: string | null;
  biography?: string;
  is_living?: boolean;
  father_id?: string | null;
  mother_id?: string | null;
  spouse_id?: string | null;
  child_id?: string | null;
}

export type UpdatePersonInput = Partial<Omit<Person, 'id' | 'created_at' | 'updated_at' | 'is_archived' | 'archived_at'>>;

