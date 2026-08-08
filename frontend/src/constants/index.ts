import type { ProjectStatus, DocumentCategory, ValidationSeverity, UserRole, Industry, Exchange } from "@/types";
import type { Permission } from "@/context/auth-context";

export const APP_NAME = "AUTODOC";
export const APP_DESCRIPTION = "AI-Powered Document Platform";
export const APP_VERSION = "1.0.0";

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  draft:                   { label: "Draft",                  color: "text-zinc-600",   bg: "bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300" },
  documents_pending:       { label: "Documents Pending",      color: "text-amber-700",  bg: "bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" },
  under_review:            { label: "Under Review",           color: "text-blue-700",   bg: "bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
  validation_in_progress:  { label: "Validation In Progress", color: "text-purple-700", bg: "bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" },
  draft_generation:        { label: "Draft Generation",       color: "text-indigo-700", bg: "bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400" },
  banker_review:           { label: "Banker Review",          color: "text-orange-700", bg: "bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" },
  sebi_filing:             { label: "SEBI Filing",            color: "text-emerald-700",bg: "bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" },
  completed:               { label: "Completed",              color: "text-green-700",  bg: "bg-green-50 dark:bg-green-900/20 dark:text-green-400" },
};

export const DOCUMENT_CATEGORY_COLORS: Record<DocumentCategory, string> = {
  Incorporation:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Financial:       "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Legal:           "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Compliance:      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Directors:       "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  Shareholding:    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  Assets:          "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  Agreements:      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  Licenses:        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  Others:          "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

export const VALIDATION_SEVERITY_CONFIG: Record<ValidationSeverity, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: "Critical", color: "text-red-700",    bg: "bg-red-50 dark:bg-red-900/20 dark:text-red-400",     icon: "AlertCircle" },
  error:    { label: "Error",    color: "text-orange-700", bg: "bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400", icon: "XCircle" },
  warning:  { label: "Warning",  color: "text-amber-700",  bg: "bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",  icon: "AlertTriangle" },
  info:     { label: "Info",     color: "text-blue-700",   bg: "bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400",    icon: "Info" },
};

export const USER_ROLE_CONFIG: Record<UserRole, { label: string; description: string }> = {
  admin:           { label: "Administrator",    description: "Full access to all features and settings" },
  owner:           { label: "Project Owner",    description: "Manage projects and team members" },
  analyst:         { label: "Analyst",          description: "Upload documents, answer questions, view drafts" },
  merchant_banker: { label: "Merchant Banker",  description: "Review and approve offer document sections" },
  legal:           { label: "Legal Counsel",    description: "Review legal sections and compliance" },
  viewer:          { label: "Viewer",           description: "Read-only access to all content" },
};

export const INDUSTRIES: Industry[] = [
  "Manufacturing", "Technology", "Pharmaceuticals", "FMCG",
  "Infrastructure", "Financial Services", "Healthcare", "Retail", "Textile", "Chemical",
];

export const EXCHANGES: { value: Exchange; label: string; description: string }[] = [
  { value: "NSE_SME", label: "NSE Emerge",  description: "NSE SME Platform" },
  { value: "BSE_SME", label: "BSE SME",     description: "BSE SME Platform" },
];

export const DRAFT_SECTIONS = [
  { code: "cover",       title: "Cover Page",                    order: 1 },
  { code: "toc",         title: "Table of Contents",             order: 2 },
  { code: "definitions", title: "Definitions & Abbreviations",   order: 3 },
  { code: "summary",     title: "Issue Summary",                 order: 4 },
  { code: "risk",        title: "Risk Factors",                  order: 5 },
  { code: "intro",       title: "Introduction",                  order: 6 },
  { code: "industry",    title: "Industry Overview",             order: 7 },
  { code: "business",    title: "Our Business",                  order: 8 },
  { code: "regulations", title: "Regulations & Policies",        order: 9 },
  { code: "history",     title: "History & Corporate Structure", order: 10 },
  { code: "management",  title: "Management",                    order: 11 },
  { code: "promoters",   title: "Promoters & Promoter Group",    order: 12 },
  { code: "related",     title: "Related Party Transactions",    order: 13 },
  { code: "financials",  title: "Financial Information",         order: 14 },
  { code: "mda",         title: "MD&A",                         order: 15 },
  { code: "issue_info",  title: "Issue Information",             order: 16 },
  { code: "legal",       title: "Legal & Other Information",     order: 17 },
  { code: "material",    title: "Material Contracts",            order: 18 },
  { code: "declarations","title": "Declarations",               order: 19 },
];

export const REQUIRED_DOCUMENTS = [
  "Certificate of Incorporation",
  "Memorandum & Articles of Association",
  "PAN Card of Company",
  "GST Registration Certificate",
  "Audited Financial Statements (3 Years)",
  "Director KYC Documents",
  "Board Resolution for IPO",
  "Shareholding Pattern",
  "List of Directors",
  "Net Worth Certificate",
  "Bank Statements (12 Months)",
  "Income Tax Returns (3 Years)",
  "Trade License",
  "Factory License",
  "Environmental Clearances",
  "Trademark Registration",
  "Patents & IP Documents",
  "Material Contracts",
  "Related Party Transactions",
  "Statutory Audit Reports",
];

import type { Permission } from "@/context/auth-context";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** If set, only users with this permission will see the item */
  permission?: Permission;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_ITEMS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard",     href: "/dashboard", icon: "LayoutDashboard",
        permission: "projects:read" },
      { label: "Projects",      href: "/projects",  icon: "FolderKanban",
        permission: "projects:read" },
    ],
  },
  {
    title: "Documents",
    items: [
      { label: "Upload",          href: "/documents/upload",          icon: "Upload",
        permission: "documents:upload" },
      { label: "All Documents",   href: "/documents",                 icon: "Files",
        permission: "documents:read" },
      { label: "Classification",  href: "/documents/classification",  icon: "Sparkles",
        permission: "documents:read" },
      { label: "Viewer",          href: "/documents/viewer",          icon: "FileText",
        permission: "documents:read" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { label: "Knowledge Base",  href: "/knowledge-base",  icon: "Database",
        permission: "knowledge_base:manage" },
      { label: "AI Q&A",          href: "/ai-qa",           icon: "MessageSquare",
        permission: "documents:read" },
    ],
  },
  {
    title: "Draft",
    items: [
      { label: "IPO Draft Generator", href: "/draft",    icon: "FileEdit",
        permission: "draft:generate" },
      { label: "Evidence",             href: "/evidence", icon: "Search",
        permission: "draft:generate" },
    ],
  },
  {
    title: "Review",
    items: [
      { label: "Collaboration", href: "/collaboration",  icon: "Users",
        permission: "collaboration:manage" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings",  href: "/settings",  icon: "Settings",
        permission: "settings:manage" },
    ],
  },
];
