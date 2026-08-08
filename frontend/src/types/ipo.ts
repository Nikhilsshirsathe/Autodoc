// IPO Draft Generation types

export type IpoSectionStatus = "complete" | "partial" | "missing" | "generated" | "error";

export interface IpoTemplateMetadata {
  id: string;
  section_name: string;
  display_order: number;
  description: string;
  estimated_pages: number;
  dependencies: string[];
  sebi_reference: string | null;
}

export interface MissingField {
  field_key: string;
  description: string;
  required: boolean;
  suggested_document: string;
}

export interface SectionValidation {
  section_id: string;
  section_name: string;
  display_order: number;
  status: IpoSectionStatus;
  completeness_pct: number;
  required_fields_present: number;
  required_fields_total: number;
  missing_required: MissingField[];
  missing_optional: MissingField[];
  can_generate: boolean;
}

export interface ValidationResult {
  user_id: string;
  overall_readiness_pct: number;
  total_sections: number;
  complete_sections: number;
  partial_sections: number;
  missing_sections: number;
  sections: SectionValidation[];
  all_missing_required: MissingField[];
  available_knowledge_fields: number;
}

export interface SourceReference {
  document_id: string;
  document_name: string | null;
  page_number: number | null;
  field_name: string | null;
  chunk_ids: string[];
}

export interface GenerationResult {
  section_id: string;
  section_name: string;
  status: IpoSectionStatus;
  content: string;
  word_count: number;
  confidence: number;
  completeness: number;
  sources: SourceReference[];
  generated_at: string | null;
  generation_time_seconds: number;
  model_used: string;
  warnings: string[];
  missing_fields: string[];
}

export interface GenerationSummary {
  total_sections: number;
  generated_count: number;
  missing_count: number;
  error_count: number;
  partial_count: number;
  total_word_count: number;
  average_confidence: number;
  average_completeness_pct: number;
  estimated_pages: number;
  sections: GenerationResult[];
}
