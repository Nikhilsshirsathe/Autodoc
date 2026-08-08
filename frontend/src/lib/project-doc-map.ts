/**
 * Client-side project↔document association mapping.
 *
 * documents.company_id references the `companies` table, not `projects`.
 * Until a schema migration adds project_id to documents, we store the
 * mapping in localStorage: { [docId]: projectId }
 */

const MAPPING_KEY = "autodoc_proj_doc_map";

export function getProjDocMapping(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(MAPPING_KEY) ?? "{}"); } catch { return {}; }
}

export function setProjDocMapping(m: Record<string, string>) {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(m));
}

export function linkDocToProject(docId: string, projectId: string) {
  const m = getProjDocMapping();
  m[docId] = projectId;
  setProjDocMapping(m);
}

export function unlinkDoc(docId: string) {
  const m = getProjDocMapping();
  delete m[docId];
  setProjDocMapping(m);
}

/** Returns doc IDs that belong to the given project. */
export function getDocIdsForProject(projectId: string): Set<string> {
  const m = getProjDocMapping();
  return new Set(Object.entries(m).filter(([, pid]) => pid === projectId).map(([did]) => did));
}
