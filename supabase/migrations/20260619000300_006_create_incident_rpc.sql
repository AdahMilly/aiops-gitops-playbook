-- Create incidents through a SECURITY DEFINER RPC so the write path does not
-- depend on recursive table policies while the API gateway/RBAC layer is rebuilt.

CREATE OR REPLACE FUNCTION public.create_incident_rpc(
  p_title text,
  p_description text DEFAULT NULL,
  p_severity text DEFAULT 'medium',
  p_assigned_to uuid DEFAULT NULL,
  p_team_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_incident public.incidents%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000';
  END IF;

  IF NULLIF(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Title is required' USING ERRCODE = '22023';
  END IF;

  IF p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid severity' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.incidents (
    title,
    description,
    severity,
    status,
    created_by,
    assigned_to,
    team_id,
    metadata
  )
  VALUES (
    trim(p_title),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    p_severity,
    'open',
    v_user_id,
    p_assigned_to,
    p_team_id,
    '{}'::jsonb
  )
  RETURNING * INTO v_incident;

  INSERT INTO public.incident_timeline (
    incident_id,
    event_type,
    description,
    user_id
  )
  VALUES (
    v_incident.id,
    'created',
    'Incident created',
    v_user_id
  );

  IF p_assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      incident_id,
      type,
      title,
      message
    )
    VALUES (
      p_assigned_to,
      v_incident.id,
      'incident_assigned',
      'New Incident Assigned',
      format('You have been assigned to "%s"', v_incident.title)
    );
  END IF;

  RETURN to_jsonb(v_incident);
END;
$$;

REVOKE ALL ON FUNCTION public.create_incident_rpc(text, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_incident_rpc(text, text, text, uuid, uuid) TO authenticated;
