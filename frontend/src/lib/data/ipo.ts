import type {
  IpoTemplateMetadata,
  ValidationResult,
  GenerationResult,
  GenerationSummary,
} from "@/types/ipo";

import { API_URL } from "@/lib/api";
const BASE = `${API_URL}/api/v1/ipo`;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getIpoTemplates(): Promise<IpoTemplateMetadata[]> {
  const res = await fetch(`${BASE}/templates`);
  return handleResponse<IpoTemplateMetadata[]>(res);
}

export async function validateKnowledgeBase(userId: string): Promise<ValidationResult> {
  const res = await fetch(`${BASE}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return handleResponse<ValidationResult>(res);
}

export async function generateSection(params: {
  section_id: string;
  user_id: string;
  force?: boolean;
  revision_notes?: string;
  existing_content?: string;
}): Promise<GenerationResult> {
  const res = await fetch(`${BASE}/generate-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<GenerationResult>(res);
}

export async function generateFullDraft(params: {
  user_id: string;
  force?: boolean;
  section_ids?: string[];
}): Promise<GenerationSummary> {
  const res = await fetch(`${BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse<GenerationSummary>(res);
}

export async function downloadMarkdown(params: {
  user_id: string;
  sections: GenerationResult[];
  company_name?: string;
}): Promise<Blob> {
  const res = await fetch(`${BASE}/download/markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Download failed (${res.status})`);
  }
  return res.blob();
}

export async function downloadDocx(params: {
  user_id: string;
  sections: GenerationResult[];
  company_name?: string;
}): Promise<Blob> {
  const res = await fetch(`${BASE}/download/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Download failed (${res.status})`);
  }
  return res.blob();
}
