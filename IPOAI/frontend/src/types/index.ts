// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = "admin" | "owner" | "analyst" | "merchant_banker" | "legal" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  organization: string;
  designation: string;
  phone?: string;
  createdAt: string;
  lastLogin: string;
  isActive: boolean;
}

export interface Session {
  id: string;
  userId: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  createdAt: string;
  lastActivity: string;
  isCurrent: boolean;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "draft"
  | "documents_pending"
  | "under_review"
  | "validation_in_progress"
  | "draft_generation"
  | "banker_review"
  | "sebi_filing"
  | "completed";

export type Exchange = "NSE_SME" | "BSE_SME";

export type Industry =
  | "Manufacturing"
  | "Technology"
  | "Pharmaceuticals"
  | "FMCG"
  | "Infrastructure"
  | "Financial Services"
  | "Healthcare"
  | "Retail"
  | "Textile"
  | "Chemical";

export interface Project {
  id: string;
  name: string;
  companyName: string;
  cin: string;
  pan: string;
  exchange: Exchange;
  industry: Industry;
  status: ProjectStatus;
  progress: number;
  ipoSize: number;
  createdAt: string;
  updatedAt: string;
  targetFilingDate: string;
  teamMembers: TeamMember[];
  documentsUploaded: number;
  documentsRequired: number;
  validationScore: number;
  aiConfidence: number;
  description: string;
  registeredAddress: string;
  city: string;
  state: string;
  pincode: string;
  website: string;
  incorporationDate: string;
  faceValue: number;
  issuePrice: number;
  lotSize: number;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  addedAt: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | "pending"
  | "uploading"
  | "processing"
  | "classified"
  | "verified"
  | "rejected"
  | "duplicate";

export type DocumentCategory =
  | "Incorporation"
  | "Financial"
  | "Legal"
  | "Compliance"
  | "Directors"
  | "Shareholding"
  | "Assets"
  | "Agreements"
  | "Licenses"
  | "Others";

export interface Document {
  id: string;
  projectId: string;
  name: string;
  originalName: string;
  category: DocumentCategory;
  detectedType: string;
  status: DocumentStatus;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  confidence: number;
  pageCount: number;
  version: number;
  tags: string[];
  thumbnailUrl?: string;
  checksum: string;
  extractedFields?: Record<string, string>;
  aiSummary?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: number;
  notes: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type ValidationSeverity = "critical" | "error" | "warning" | "info";
export type ValidationStatus = "open" | "resolved" | "ignored" | "pending";

export interface ValidationIssue {
  id: string;
  projectId: string;
  type: "missing_document" | "data_mismatch" | "compliance" | "duplicate" | "risk" | "format";
  severity: ValidationSeverity;
  status: ValidationStatus;
  title: string;
  description: string;
  affectedSection: string;
  affectedDocuments: string[];
  suggestedFix: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  ruleCode: string;
}

export interface ValidationReport {
  id: string;
  projectId: string;
  generatedAt: string;
  score: number;
  totalIssues: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  resolvedCount: number;
  issues: ValidationIssue[];
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export interface Director {
  id: string;
  projectId: string;
  name: string;
  designation: string;
  din: string;
  pan: string;
  dob: string;
  address: string;
  qualification: string;
  experience: number;
  appointmentDate: string;
  isIndependent: boolean;
  isExecutive: boolean;
  otherDirectorships: string[];
}

export interface Shareholder {
  id: string;
  projectId: string;
  name: string;
  type: "Promoter" | "Public" | "FII" | "DII" | "Employee";
  shares: number;
  percentage: number;
  category: string;
}

export interface FinancialStatement {
  id: string;
  projectId: string;
  year: string;
  revenue: number;
  ebitda: number;
  pat: number;
  totalAssets: number;
  netWorth: number;
  debtEquityRatio: number;
  eps: number;
  pe: number;
  roe: number;
}

// ─── AI & Draft ───────────────────────────────────────────────────────────────

export interface DraftSection {
  id: string;
  projectId: string;
  sectionCode: string;
  sectionTitle: string;
  content: string;
  status: "not_started" | "generating" | "draft" | "approved" | "rejected";
  confidence: number;
  wordCount: number;
  version: number;
  generatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  evidenceSources: EvidenceSource[];
  aiExplanation: string;
}

export interface EvidenceSource {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  confidence: number;
  fieldName: string;
}

export interface AIQuestion {
  id: string;
  projectId: string;
  question: string;
  reason: string;
  isRequired: boolean;
  suggestedAnswers: string[];
  userResponse?: string;
  confidence?: number;
  status: "pending" | "answered" | "skipped";
  category: string;
  sectionReference: string;
}

// ─── Review & Collaboration ───────────────────────────────────────────────────

export type ReviewStatus = "pending" | "approved" | "rejected" | "revision_requested";

export interface Review {
  id: string;
  projectId: string;
  sectionId: string;
  sectionTitle: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  status: ReviewStatus;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
  dueDate: string;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  type: "comment" | "suggestion" | "approval" | "rejection";
  createdAt: string;
  resolvedAt?: string;
  parentId?: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  projectId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
}
