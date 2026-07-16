/**
 * Project data types and API client functions.
 *
 * Dummy data has been removed — all data comes from the backend API.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "merchant_banker" | "legal" | "auditor" | "viewer";
  addedAt: string;
}

export interface ApiProject {
  id: string;
  name: string;
  company_name: string;
  cin: string | null;
  pan: string | null;
  exchange: string | null;
  industry: string | null;
  status: string;
  progress: number;
  ipo_size: number | null;
  created_at: string;
  updated_at: string;
  target_filing_date: string | null;
  documents_uploaded: number;
  documents_required: number;
  validation_score: number;
  ai_confidence: number;
  description: string | null;
  registered_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  website: string | null;
  incorporation_date: string | null;
  face_value: number | null;
  issue_price: number | null;
  lot_size: number | null;
  created_by: string;
  team_members: TeamMember[];
}

// ── API client ────────────────────────────────────────────────────────────────

/** Fetch all projects for a user. */
export async function listProjects(userId: string): Promise<ApiProject[]> {
  const res = await fetch(
    `${API_URL}/api/v1/projects/?user_id=${encodeURIComponent(userId)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `List projects failed (${res.status})`);
  }
  const data = await res.json();
  return data.projects ?? [];
}

/** Fetch a single project by ID. */
export async function getProject(projectId: string, userId: string): Promise<ApiProject> {
  const res = await fetch(
    `${API_URL}/api/v1/projects/${projectId}?user_id=${encodeURIComponent(userId)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Get project failed (${res.status})`);
  }
  return res.json();
}

/** Create a new project. */
export async function createProject(
  userId: string,
  payload: Partial<Omit<ApiProject, "id" | "created_at" | "updated_at" | "created_by" | "team_members">>
): Promise<ApiProject> {
  const res = await fetch(`${API_URL}/api/v1/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, created_by: userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Create project failed (${res.status})`);
  }
  return res.json();
}

/** Update a project. */
export async function updateProject(
  projectId: string,
  userId: string,
  payload: Partial<ApiProject>
): Promise<ApiProject> {
  const res = await fetch(
    `${API_URL}/api/v1/projects/${projectId}?user_id=${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Update project failed (${res.status})`);
  }
  return res.json();
}

/** Delete a project. */
export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/projects/${projectId}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Delete project failed (${res.status})`);
  }
}

// ── Legacy export (empty — dummy data removed) ────────────────────────────────

/** @deprecated Use listProjects() to fetch real data from the API. */
export const DUMMY_PROJECTS: never[] = [];
