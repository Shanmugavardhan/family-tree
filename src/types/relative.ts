import { Gender } from './person';
import { ParentType } from './relationship';

export type RelativeCategory =
  | 'parents'
  | 'children'
  | 'spouses'
  | 'siblings'
  | 'grandparents'
  | 'grandchildren'
  | 'great_grandparents'
  | 'uncles_aunts'
  | 'nephews_nieces'
  | 'cousins'
  | 'first_cousins_once_removed'
  | 'in_laws';

export interface RelativeItem {
  person_id: string;
  full_name: string;
  relationship: string;
  category: RelativeCategory;
  gender: Gender;
  is_living: boolean;
  is_archived: boolean;
  profile_photo: string | null;
  lineage_type: ParentType | 'spouse' | 'mixed';
  shared_parent_ids?: string[];
  relationship_paths: string[];
}

export interface PerspectiveRelationship {
  person_id: string;
  full_name: string;
  gender: Gender;
  relationship: string;
  category: RelativeCategory | 'self' | 'unrelated';
  path: string[];
}

export interface DerivedRelativesResponse {
  person_id: string;
  target_person: {
    id: string;
    full_name: string;
    gender: Gender;
  };
  relatives: {
    parents: RelativeItem[];
    children: RelativeItem[];
    spouses: RelativeItem[];
    siblings: RelativeItem[];
    grandparents: RelativeItem[];
    grandchildren: RelativeItem[];
    great_grandparents: RelativeItem[];
    uncles_aunts: RelativeItem[];
    nephews_nieces: RelativeItem[];
    cousins: RelativeItem[];
    first_cousins_once_removed: RelativeItem[];
    in_laws: RelativeItem[];
  };
  all_relationships?: Record<string, PerspectiveRelationship>;
  total_count: number;
}

export interface PerspectiveRelationshipResult {
  from_person: {
    id: string;
    full_name: string;
    gender: Gender;
  };
  to_person: {
    id: string;
    full_name: string;
    gender: Gender;
  };
  relationship: string;
  reverse_relationship: string;
  category: RelativeCategory | 'self' | 'unrelated';
  path: string[];
}
