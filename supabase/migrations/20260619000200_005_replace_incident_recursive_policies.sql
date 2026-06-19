-- Replace incident-management policies that may depend on recursive profile role checks.
-- This keeps access simple while the gateway/RBAC layer is being rebuilt.

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'teams',
    'incidents',
    'incident_comments',
    'incident_timeline',
    'notifications',
    'audit_logs'
  ]
  LOOP
    FOR policy_name IN
      SELECT pol.polname
      FROM pg_policy pol
      JOIN pg_class cls ON cls.oid = pol.polrelid
      JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'public'
        AND cls.relname = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_authenticated_select"
  ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_authenticated_insert"
  ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "teams_authenticated_update"
  ON public.teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "incidents_authenticated_select"
  ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "incidents_authenticated_insert"
  ON public.incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "incidents_authenticated_update"
  ON public.incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "incident_comments_authenticated_select"
  ON public.incident_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "incident_comments_authenticated_insert"
  ON public.incident_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "incident_timeline_authenticated_select"
  ON public.incident_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "incident_timeline_authenticated_insert"
  ON public.incident_timeline FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "notifications_owner_select"
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_authenticated_insert"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_owner_update"
  ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_owner_delete"
  ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "audit_logs_authenticated_select"
  ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_authenticated_insert"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
