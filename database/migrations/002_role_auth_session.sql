-- ============================================================
-- Migration 002: Role-Based Auth & Session Management
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Fix profiles.role check constraint ──────────────────────────────────
-- Drop old constraint (only allowed 'admin','analyst','user')
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add updated constraint matching all AppRoles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'owner', 'analyst', 'merchant_banker', 'legal', 'viewer'));

-- Back-fill any legacy 'user' rows to 'viewer'
UPDATE public.profiles
  SET role = 'viewer'
  WHERE role NOT IN ('admin', 'owner', 'analyst', 'merchant_banker', 'legal', 'viewer');

-- ── 2. Add role_text, avatar_url & last_seen to profiles ──────────────────
-- role_text: free-text professional title entered at signup (no constraint)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_text    TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ── 3. updated_at trigger for profiles ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. user_sessions table ─────────────────────────────────────────────────
-- Tracks active browser sessions for timeout and security audit
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_token   TEXT,                           -- Supabase session jti or custom token
    ip_address      INET,
    user_agent      TEXT,
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    is_revoked      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id    ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON public.user_sessions(last_active_at);

-- ── 5. audit_events table ─────────────────────────────────────────────────
-- Generic audit log for all significant actions
CREATE TABLE IF NOT EXISTS public.audit_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,          -- e.g. 'login', 'logout', 'role_change', 'doc_upload'
    resource_type TEXT,                 -- e.g. 'project', 'document'
    resource_id UUID,
    metadata    JSONB DEFAULT '{}',
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id  ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event    ON public.audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created  ON public.audit_events(created_at DESC);

-- ── 6. RLS policies for user_sessions ────────────────────────────────────
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "user_sessions_own" ON public.user_sessions
  FOR ALL
  USING (user_id = auth.uid());

-- Admins can see all sessions
CREATE POLICY "user_sessions_admin" ON public.user_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 7. RLS policies for audit_events ─────────────────────────────────────
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit events
CREATE POLICY "audit_events_own" ON public.audit_events
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all audit events
CREATE POLICY "audit_events_admin" ON public.audit_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can insert audit events (backend)
CREATE POLICY "audit_events_insert_service" ON public.audit_events
  FOR INSERT
  WITH CHECK (TRUE);

-- ── 8. Auto-create profile on new user signup ─────────────────────────────
-- Ensures a profile row exists as soon as auth.users gets a new record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, role_text)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'owner'),
    COALESCE(NEW.raw_user_meta_data->>'role_text', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
