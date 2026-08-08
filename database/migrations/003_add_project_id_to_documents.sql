-- ============================================================
-- Migration 003: Add project_id to documents table
-- Run in Supabase SQL Editor
-- ============================================================

-- Add project_id column to documents table
-- This is nullable to allow documents that aren't linked to projects
-- company_id remains for potential future use with companies table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for faster queries filtering by project
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id);

-- Optional: Add comment for documentation
COMMENT ON COLUMN public.documents.project_id IS 'References projects table - links document to a specific project/company';
