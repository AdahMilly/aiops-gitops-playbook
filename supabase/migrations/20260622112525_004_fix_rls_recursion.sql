-- Create SECURITY DEFINER function to check user role without RLS recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_engineer_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'engineer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop the problematic policies
DROP POLICY IF EXISTS profiles_admin_all ON profiles;
DROP POLICY IF EXISTS incidents_engineer_insert ON incidents;
DROP POLICY IF EXISTS incidents_engineer_update ON incidents;
DROP POLICY IF EXISTS comments_engineer_insert ON incident_comments;
DROP POLICY IF EXISTS audit_logs_admin_select ON audit_logs;
DROP POLICY IF EXISTS notifications_self_select ON notifications;
DROP POLICY IF EXISTS teams_admin_delete ON teams;
DROP POLICY IF EXISTS teams_admin_insert ON teams;
DROP POLICY IF EXISTS teams_admin_update ON teams;

-- Recreate policies using the helper functions
-- Profiles: admins can manage all
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Incidents: engineers and admins can insert/update
CREATE POLICY "incidents_engineer_insert" ON incidents FOR INSERT
  TO authenticated WITH CHECK (is_engineer_or_admin());

CREATE POLICY "incidents_engineer_update" ON incidents FOR UPDATE
  TO authenticated USING (is_engineer_or_admin());

-- Incident comments: engineers and admins can insert
CREATE POLICY "comments_engineer_insert" ON incident_comments FOR INSERT
  TO authenticated WITH CHECK (is_engineer_or_admin());

-- Audit logs: only admins can select
CREATE POLICY "audit_logs_admin_select" ON audit_logs FOR SELECT
  TO authenticated USING (is_admin());

-- Notifications: users can see their own or admins can see all
CREATE POLICY "notifications_self_select" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR is_admin());

-- Teams: only admins can modify
CREATE POLICY "teams_admin_delete" ON teams FOR DELETE
  TO authenticated USING (is_admin());

CREATE POLICY "teams_admin_insert" ON teams FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "teams_admin_update" ON teams FOR UPDATE
  TO authenticated USING (is_admin());