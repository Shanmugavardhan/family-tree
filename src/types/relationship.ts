export type RelationshipType = 'parent' | 'spouse';
export type ParentType = 'biological' | 'adoptive' | 'step' | 'legal' | null;

export interface Relationship {
  id: string;
  person_id: string; // Child ID if parent relationship
  related_person_id: string; // Parent ID if parent relationship
  relationship_type: RelationshipType;
  parent_type: ParentType;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateRelationshipInput {
  person_id: string;
  related_person_id: string;
  relationship_type: RelationshipType;
  parent_type?: ParentType;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export interface UpdateRelationshipInput {
  parent_type?: ParentType;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export interface DerivedRelatives {
  person_id: string;
  father: import('./person').Person | null;
  mother: import('./person').Person | null;
  spouses: import('./person').Person[];
  children: import('./person').Person[];
  siblings: import('./person').Person[];
  paternal_grandparents: {
    grandfather: import('./person').Person | null;
    grandmother: import('./person').Person | null;
  };
  maternal_grandparents: {
    grandfather: import('./person').Person | null;
    grandmother: import('./person').Person | null;
  };
  uncles_and_aunts: import('./person').Person[];
  cousins: import('./person').Person[];
}

