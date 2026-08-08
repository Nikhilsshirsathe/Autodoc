-- ============================================================
-- IPOAI Supabase Schema
-- Run this in the Supabase SQL editor to initialize the database
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- pgvector for embeddings

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    full_name   TEXT,
    role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'analyst', 'user')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    cin         TEXT UNIQUE,               -- Company Identification Number
    industry    TEXT,
    created_by  UUID REFERENCES public.profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS (uploaded IPO document files)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    file_path       TEXT NOT NULL,          -- Supabase Storage path
    storage_bucket  TEXT NOT NULL DEFAULT 'documents',
    file_size       BIGINT,
    mime_type       TEXT,
    doc_type        TEXT DEFAULT 'ipo_prospectus',  -- ipo_prospectus, drhp, rta, etc.
    status          TEXT NOT NULL DEFAULT 'uploaded'
                        CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
    error_message   TEXT,
    page_count      INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT PAGES (per-page extracted content)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_pages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number     INT NOT NULL,
    raw_text        TEXT,
    markdown_text   TEXT,
    ocr_used        BOOLEAN DEFAULT FALSE,
    ocr_confidence  FLOAT,
    has_tables      BOOLEAN DEFAULT FALSE,
    has_images      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT CHUNKS (semantic text chunks for RAG / embeddings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_id         UUID REFERENCES public.document_pages(id) ON DELETE SET NULL,
    chunk_index     INT NOT NULL,
    chunk_text      TEXT NOT NULL,
    token_count     INT,
    embedding       VECTOR(1536),           -- OpenAI text-embedding-3-small
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXTRACTED FIELDS (structured IPO data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extracted_fields (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    field_name      TEXT NOT NULL,
    field_value     TEXT,
    field_type      TEXT DEFAULT 'text',   -- text, number, date, table, list
    page_number     INT,
    confidence      FLOAT,
    extraction_method TEXT DEFAULT 'docling',  -- docling, ocr, llm
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXTRACTED TABLES (tabular data from documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extracted_tables (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number     INT,
    table_index     INT,
    caption         TEXT,
    headers         JSONB,                  -- ["col1", "col2", ...]
    rows            JSONB,                  -- [["val1", "val2"], ...]
    raw_markdown    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OFFER DOCUMENTS (generated IPO offer docs / analysis)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.offer_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    source_doc_id   UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES public.profiles(id),
    title           TEXT NOT NULL,
    content         TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'review', 'approved', 'published')),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES public.profiles(id),
    action      TEXT NOT NULL,
    table_name  TEXT,
    record_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documents_company_id   ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_status        ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by   ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_doc_pages_document_id   ON public.document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id  ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding    ON public.document_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_doc_id ON public.extracted_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_tables_doc_id ON public.extracted_tables(document_id);
CREATE INDEX IF NOT EXISTS idx_offer_docs_company_id   ON public.offer_documents(company_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_companies
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_documents
    BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_offer_documents
    BEFORE UPDATE ON public.offer_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Profiles
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_fields  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_tables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see/edit only their own profile; admins see all
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Companies: authenticated users can read; only admins/analysts can write
CREATE POLICY "companies_select_auth" ON public.companies
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "companies_insert_auth" ON public.companies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "companies_update_auth" ON public.companies
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Documents: users see their own uploads; admins/analysts see all
CREATE POLICY "documents_select_own" ON public.documents
    FOR SELECT USING (
        uploaded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'analyst')
        )
    );

CREATE POLICY "documents_insert_auth" ON public.documents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "documents_update_own" ON public.documents
    FOR UPDATE USING (
        uploaded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'analyst')
        )
    );

-- Document pages / chunks / extracted data: inherit document access
CREATE POLICY "doc_pages_select" ON public.document_pages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_id
            AND (
                d.uploaded_by = auth.uid()
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'analyst'))
            )
        )
    );

CREATE POLICY "doc_chunks_select" ON public.document_chunks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_id
            AND (
                d.uploaded_by = auth.uid()
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'analyst'))
            )
        )
    );

CREATE POLICY "extracted_fields_select" ON public.extracted_fields
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_id
            AND (
                d.uploaded_by = auth.uid()
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'analyst'))
            )
        )
    );

CREATE POLICY "extracted_tables_select" ON public.extracted_tables
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_id
            AND (
                d.uploaded_by = auth.uid()
                OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'analyst'))
            )
        )
    );

-- Offer documents
CREATE POLICY "offer_docs_select" ON public.offer_documents
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "offer_docs_insert" ON public.offer_documents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "offer_docs_update" ON public.offer_documents
    FOR UPDATE USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'analyst'))
    );

-- Audit log: admins only
CREATE POLICY "audit_log_admin_only" ON public.audit_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

-- ============================================================
-- STORAGE BUCKET POLICIES
-- (Create the bucket first in Supabase Dashboard or via API)
-- ============================================================

-- Run in Supabase Dashboard → Storage → Create bucket named 'documents' (private)
-- Then apply these policies:

-- Allow authenticated users to upload
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    FALSE,
    52428800,   -- 50MB limit
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/tiff',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_upload_auth" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents' AND auth.role() = 'authenticated'
    );

CREATE POLICY "storage_select_own" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents'
        AND (auth.uid()::text = (storage.foldername(name))[1]
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'analyst')))
    );

CREATE POLICY "storage_delete_own" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
