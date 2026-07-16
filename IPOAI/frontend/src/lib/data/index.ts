/**
 * Data layer index — re-exports type definitions.
 *
 * All dummy data has been removed. Data is now fetched from the
 * FastAPI backend which reads from Supabase.
 *
 * API client functions live in:
 *   - @/lib/data/documents.ts  (documents, pipeline)
 *   - @/lib/data/projects.ts   (projects)
 */

export type { ApiDocument, PipelineStatus, ExtractedField } from "./documents";
export type { ApiProject, TeamMember } from "./projects";

// ── Legacy stub exports ───────────────────────────────────────────────────────
// These are kept as empty arrays so existing pages that still import them
// compile without errors. Pages should be migrated to use the API clients.

import type {
  FinancialStatement,
  Director,
  Shareholder,
  AuditLog,
  Notification,
  AIQuestion,
  Review,
} from "@/types";

/** @deprecated Fetch from API instead */
export const DUMMY_FINANCIALS: FinancialStatement[] = [];
/** @deprecated Fetch from API instead */
export const DUMMY_DIRECTORS: Director[] = [];
/** @deprecated Fetch from API instead */
export const DUMMY_SHAREHOLDERS: Shareholder[] = [];
/** @deprecated Fetch from API instead */
export const DUMMY_AUDIT_LOGS: AuditLog[] = [];
/** @deprecated Fetch from API instead */
export const DUMMY_NOTIFICATIONS: Notification[] = [];
/** @deprecated Fetch from API instead */
export const DUMMY_AI_QUESTIONS: AIQuestion[] = [];
/** @deprecated Fetch from API instead */
export const DUMMY_REVIEWS: Review[] = [];
