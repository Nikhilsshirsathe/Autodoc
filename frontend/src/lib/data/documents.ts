/**
 * Document data and API client functions.
 *
 * All functions talk to the FastAPI backend at NEXT_PUBLIC_API_URL.
 * The dummy data has been removed — the app now uses real data from Supabase via the backend.
 */

import { API_URL } from "@/lib/api";

export interface ApiDocument {
  id: string;
  uploaded_by: string;
  project_id: string | null;
  company_id: string | null;
  filename: string;
  original_name: string;
  file_path: string;
  storage_bucket: string;
  file_size: number;
  mime_type: string;
  doc_type: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  page_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineStatus {
  document_id: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  page_count: number | null;
  error_message: string | null;
  extracted_fields_count: number;
  extracted_tables_count: number;
  chunks_count: number;
}

export interface ExtractedField {
  id: string;
  document_id: string;
  field_name: string;
  field_value: string;
  field_type: string;
  page_number: number | null;
  confidence: number;
  extraction_method: string;
}

// ── Upload ─────────────────────────────────────────────────────────────────────

/**
 * Upload a file to the backend. Returns the created document record.
 * @param file - The File object to upload
 * @param userId - Supabase user ID
 * @param companyId - Optional project/company ID
 * @param docType - Document category (default: "ipo_prospectus")
 * @param autoProcess - Whether to trigger extraction pipeline immediately
 * @param onProgress - Optional progress callback (0–100)
 */
export async function uploadDocument(
  file: File,
  userId: string,
  projectId?: string,
  docType = "ipo_prospectus",
  autoProcess = true,
  onProgress?: (pct: number) => void
): Promise<ApiDocument> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", userId);
    if (projectId) form.append("project_id", projectId);
    form.append("doc_type", docType);
    form.append("auto_process", String(autoProcess));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/v1/documents/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 201) {
        resolve(JSON.parse(xhr.responseText) as ApiDocument);
      } else {
        const body = JSON.parse(xhr.responseText ?? "{}");
        reject(new Error(body.detail ?? `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

/** Trigger (or re-trigger) extraction pipeline for an already-uploaded document. */
export async function triggerPipeline(documentId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/process`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Pipeline trigger failed (${res.status})`);
  }
  return res.json();
}

/** Poll the extraction pipeline status for a document. */
export async function getPipelineStatus(documentId: string): Promise<PipelineStatus> {
  const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/status`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Status check failed (${res.status})`);
  }
  return res.json();
}

// ── Documents ──────────────────────────────────────────────────────────────────

/** Fetch all documents for a user. */
export async function listDocuments(
  userId: string,
  limit = 50
): Promise<ApiDocument[]> {
  const res = await fetch(
    `${API_URL}/api/v1/documents/?user_id=${encodeURIComponent(userId)}&limit=${limit}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `List documents failed (${res.status})`);
  }
  const data = await res.json();
  return data.documents ?? [];
}

/** Fetch a single document by ID. */
export async function getDocument(
  documentId: string,
  userId: string
): Promise<ApiDocument> {
  const res = await fetch(
    `${API_URL}/api/v1/documents/${documentId}?user_id=${encodeURIComponent(userId)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Get document failed (${res.status})`);
  }
  return res.json();
}

/** Update mutable fields on a document (project_id, doc_type). */
export async function updateDocument(
  documentId: string,
  userId: string,
  payload: { project_id?: string | null; company_id?: string | null; doc_type?: string }
): Promise<ApiDocument> {
  const res = await fetch(
    `${API_URL}/api/v1/documents/${documentId}?user_id=${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Update document failed (${res.status})`);
  }
  return res.json();
}

/** Delete a document by ID. */
export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/documents/${documentId}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Delete failed (${res.status})`);
  }
}

// ── Extracted data ─────────────────────────────────────────────────────────────

/** Fetch extracted fields for a document. */
export async function getExtractedFields(documentId: string): Promise<ExtractedField[]> {
  const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/fields`);
  if (!res.ok) {
    throw new Error(`Failed to fetch fields (${res.status})`);
  }
  const data = await res.json();
  return data.fields ?? [];
}

/** Fetch extracted tables for a document. */
export async function getExtractedTables(documentId: string): Promise<unknown[]> {
  const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/tables`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tables (${res.status})`);
  }
  const data = await res.json();
  return data.tables ?? [];
}

// ── Legacy export (empty — dummy data removed) ────────────────────────────────

/** @deprecated Use listDocuments() to fetch real data from the API. */
export const DUMMY_DOCUMENTS: never[] = [];
