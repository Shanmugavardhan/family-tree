export type VerifiableField =
  | 'birth_date'
  | 'birth_place'
  | 'relationship'
  | 'is_living'
  | 'death_date'
  | 'alias';

export interface VerificationRecord {
  fact_id: string;
  entity_type: 'person' | 'relationship';
  entity_id: string;
  field: VerifiableField;
  recorded_by: string | null;
  verifiers: string[];
  disputed_by: string[];
  suggested_corrections?: Array<{
    by: string;
    value: string;
    at: string;
  }>;
  updated_at: string;
}

export interface VerificationBadgeInfo {
  count: number; // 1 for 1/2, 2 for 2/2 Verified
  isVerified: boolean;
  label: string; // "1/2" or "2/2 Verified"
  disputed: boolean;
}

export interface LineageTrustScore {
  verifiedCount: number;
  totalFacts: number;
  percentage: number;
}

export interface TfaQuestionOption {
  id: string;
  label: string;
  action: 'confirm' | 'reject' | 'skip' | 'fill';
  isCorrectOption?: boolean;
}

export interface TfaQuestion {
  fact_id: string;
  entity_type: 'person' | 'relationship';
  entity_id: string;
  field: VerifiableField;
  recorded_by: string | null;
  subject_person_id: string;
  subject_name: string;
  subject_photo: string | null;
  subject_gender: string;
  category_label: string;
  question_text: string;
  detail_hint?: string;
  options: TfaQuestionOption[];
  relevance_score: number;
  allowCorrection?: boolean;
  correctionPlaceholder?: string;
  allowFillInput?: boolean;
  fillPlaceholder?: string;
  isDisputed?: boolean;
  isAnomaly?: boolean;
  branchKey?: string;
}
