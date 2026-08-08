"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { listProjects, type ApiProject } from "@/lib/data/projects";
import { useAuth } from "@/context/auth-context";

const LS_KEY = "autodoc_selected_project_id";

interface ProjectContextValue {
  projects: ApiProject[];
  selectedProjectId: string | null;
  selectedProject: ApiProject | null;
  setSelectedProjectId: (id: string | null) => void;
  loadingProjects: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  selectedProjectId: null,
  selectedProject: null,
  setSelectedProjectId: () => {},
  loadingProjects: false,
  refreshProjects: async () => {},
});

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "";

  const [projects, setProjects]           = useState<ApiProject[]>([]);
  const [loadingProjects, setLoading]     = useState(false);
  const [selectedProjectId, _setSelected] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_KEY) ?? null;
  });

  const setSelectedProjectId = (id: string | null) => {
    _setSelected(id);
    if (id) localStorage.setItem(LS_KEY, id);
    else localStorage.removeItem(LS_KEY);
  };

  const refreshProjects = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await listProjects(userId);
      setProjects(data);
      // Auto-select first project if nothing persisted or persisted id is gone
      const ids = data.map((p) => p.id);
      if (!selectedProjectId || !ids.includes(selectedProjectId)) {
        setSelectedProjectId(data[0]?.id ?? null);
      }
    } catch (err) {
      console.error("ProjectContext: failed to load projects", err);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedProjectId]);

  useEffect(() => {
    if (!authLoading && userId) refreshProjects();
  }, [userId, authLoading]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <ProjectContext.Provider value={{
      projects,
      selectedProjectId,
      selectedProject,
      setSelectedProjectId,
      loadingProjects,
      refreshProjects,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
