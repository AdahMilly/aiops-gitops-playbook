-- Add incident_timeline table
CREATE TABLE IF NOT EXISTS incident_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns to incidents if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'acknowledged_at') THEN
    ALTER TABLE incidents ADD COLUMN acknowledged_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'metadata') THEN
    ALTER TABLE incidents ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Add missing column to incident_comments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_comments' AND column_name = 'is_internal') THEN
    ALTER TABLE incident_comments ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index for incident_timeline
CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident ON incident_timeline(incident_id);

-- Enable RLS on incident_timeline
ALTER TABLE incident_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_select" ON incident_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "timeline_insert" ON incident_timeline FOR INSERT TO authenticated WITH CHECK (true);

-- Create handle_new_user function if it doesn't exist
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 'engineer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Seed teams
INSERT INTO teams (name, slug, description) VALUES
  ('Platform Engineering', 'platform-engineering', 'Infrastructure and platform team'),
  ('SRE Team', 'sre-team', 'Site reliability engineering'),
  ('Security Team', 'security-team', 'Security operations'),
  ('Customer Support', 'customer-support', 'Customer-facing support team')
ON CONFLICT (slug) DO NOTHING;

-- Seed sample incidents data for testing
INSERT INTO incidents (title, description, severity, status, created_by, team_id)
SELECT 
  'Database connection timeout',
  'Multiple services experiencing intermittent database connection timeouts. Investigation ongoing.',
  'high',
  'investigating',
  p.id,
  (SELECT id FROM teams WHERE slug = 'sre-team')
FROM profiles p LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO incidents (title, description, severity, status, created_by, team_id)
SELECT 
  'API latency spike detected',
  'Prometheus alerting shows 95th percentile latency has exceeded 2s threshold.',
  'medium',
  'open',
  p.id,
  (SELECT id FROM teams WHERE slug = 'platform-engineering')
FROM profiles p LIMIT 1
ON CONFLICT DO NOTHING;