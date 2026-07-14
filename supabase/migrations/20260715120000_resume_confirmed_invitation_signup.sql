-- F-006: safely resume an invited signup after Supabase email confirmation.
--
-- The raw invitation bearer token remains only in agency_invitations. The temporary
-- context stores the authenticated user ID and invitation ID for at most 24 hours (and
-- never beyond the invitation expiry). No client-readable policy is created.

CREATE TABLE public.invitation_signup_resumptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.agency_invitations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_signup_resumptions_expiry_check CHECK (expires_at > created_at)
);

ALTER TABLE public.invitation_signup_resumptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.invitation_signup_resumptions FROM PUBLIC, anon, authenticated;

-- Capture only the non-secret invitation ID before removing invitation_token from Auth
-- metadata. This AFTER INSERT trigger runs in the auth.users creation transaction, so
-- the profile, resume context and metadata scrub either all succeed or all roll back.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text := lower(trim(NEW.raw_user_meta_data->>'invitation_token'));
  v_invitation_id uuid;
  v_invitation_expires_at timestamptz;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT invitation.id, invitation.expires_at
  INTO v_invitation_id, v_invitation_expires_at
  FROM public.agency_invitations invitation
  WHERE invitation.token = v_token
    AND lower(trim(invitation.email)) = lower(trim(NEW.email))
    AND invitation.status = 'pending'
    AND invitation.expires_at > now();

  IF v_invitation_id IS NOT NULL THEN
    INSERT INTO public.invitation_signup_resumptions (
      user_id,
      invitation_id,
      expires_at
    )
    VALUES (
      NEW.id,
      v_invitation_id,
      LEAST(v_invitation_expires_at, now() + interval '24 hours')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'invitation_token'
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Returns a small stable status vocabulary. The only function that assigns agency/role
-- or consumes the invitation remains public.accept_invitation(token). Calling it inside
-- this transaction also makes the accepted_at marker atomic with the business mutation.
CREATE FUNCTION public.resume_invitation_signup()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_context public.invitation_signup_resumptions%ROWTYPE;
  v_invitation public.agency_invitations%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_caller_email text;
  v_token text;
  v_result text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 'not_authenticated';
  END IF;

  SELECT context.*
  INTO v_context
  FROM public.invitation_signup_resumptions context
  WHERE context.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_context.expires_at <= now() THEN
    DELETE FROM public.invitation_signup_resumptions WHERE user_id = v_user_id;
    RETURN 'expired';
  END IF;

  SELECT invitation.*
  INTO v_invitation
  FROM public.agency_invitations invitation
  WHERE invitation.id = v_context.invitation_id;

  IF NOT FOUND THEN
    DELETE FROM public.invitation_signup_resumptions WHERE user_id = v_user_id;
    RETURN 'not_found';
  END IF;

  -- A refresh after a completed acceptance must not blindly trust accepted_at. Verify
  -- that the current account still represents the exact membership granted by the
  -- linked invitation. This path never replays accept_invitation() and never changes a
  -- role or agency; any mismatch fails closed for investigation.
  IF v_context.accepted_at IS NOT NULL THEN
    SELECT profile.*
    INTO v_profile
    FROM public.profiles profile
    WHERE profile.id = v_user_id;

    SELECT users.email
    INTO v_caller_email
    FROM auth.users users
    WHERE users.id = v_user_id;

    IF v_profile.id IS NULL
      OR v_caller_email IS NULL
      OR v_profile.agency_id IS DISTINCT FROM v_invitation.agency_id
      OR v_profile.role IS DISTINCT FROM v_invitation.role
      OR lower(trim(v_caller_email)) IS DISTINCT FROM lower(trim(v_invitation.email))
    THEN
      RETURN 'integrity_error';
    END IF;

    RETURN 'already_accepted';
  END IF;

  v_token := v_invitation.token;

  BEGIN
    PERFORM public.accept_invitation(v_token);
    v_result := 'accepted';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN v_result := 'not_authenticated';
    WHEN SQLSTATE 'IPV01' THEN v_result := 'invalid_token';
    WHEN SQLSTATE 'IPV02' THEN v_result := 'not_found';
    WHEN SQLSTATE 'IPV03' THEN v_result := 'already_used';
    WHEN SQLSTATE 'IPV04' THEN v_result := 'expired';
    WHEN SQLSTATE 'IPV05' THEN v_result := 'email_mismatch';
    WHEN SQLSTATE 'IPV06' THEN v_result := 'profile_not_found';
    WHEN SQLSTATE 'IPV07' THEN v_result := 'already_in_agency';
    WHEN SQLSTATE 'IPV08' THEN v_result := 'integrity_error';
    WHEN OTHERS THEN v_result := 'unknown';
  END;

  IF v_result = 'accepted' THEN
    UPDATE public.invitation_signup_resumptions
    SET accepted_at = now()
    WHERE user_id = v_user_id;
  ELSIF v_result IN (
    'invalid_token', 'not_found', 'already_used', 'expired', 'email_mismatch',
    'profile_not_found', 'already_in_agency'
  ) THEN
    DELETE FROM public.invitation_signup_resumptions WHERE user_id = v_user_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resume_invitation_signup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_invitation_signup() TO authenticated;

-- Rollback (manual, local only):
-- 1. REVOKE EXECUTE ON FUNCTION public.resume_invitation_signup() FROM authenticated;
-- 2. DROP FUNCTION public.resume_invitation_signup();
-- 3. Restore public.handle_new_user() exactly from
--    20260713204325_enforce_invitation_only_access.sql.
-- 4. DROP TABLE public.invitation_signup_resumptions;
