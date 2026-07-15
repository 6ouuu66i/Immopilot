-- F-006 follow-up: Supabase copies signup user metadata into the email identity
-- as well as auth.users. Keep the deferred end-of-transaction cleanup, extend it
-- to auth.identities, and fail the complete signup if either copy survives.

CREATE OR REPLACE FUNCTION public.scrub_invitation_token_after_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users AS users
  SET raw_user_meta_data = COALESCE(users.raw_user_meta_data, '{}'::jsonb) - 'invitation_token'
  WHERE users.id = NEW.id
    AND COALESCE(users.raw_user_meta_data, '{}'::jsonb) ? 'invitation_token';

  UPDATE auth.identities AS identities
  SET identity_data = COALESCE(identities.identity_data, '{}'::jsonb) - 'invitation_token'
  WHERE identities.user_id = NEW.id
    AND COALESCE(identities.identity_data, '{}'::jsonb) ? 'invitation_token';

  IF EXISTS (
    SELECT 1
    FROM auth.users AS users
    WHERE users.id = NEW.id
      AND COALESCE(users.raw_user_meta_data, '{}'::jsonb) ? 'invitation_token'
  ) OR EXISTS (
    SELECT 1
    FROM auth.identities AS identities
    WHERE identities.user_id = NEW.id
      AND COALESCE(identities.identity_data, '{}'::jsonb) ? 'invitation_token'
  ) THEN
    RAISE EXCEPTION 'Invitation metadata cleanup failed'
      USING ERRCODE = 'IPV09';
  END IF;

  RETURN NULL;
END;
$$;

-- Remove the key from identities created after the first corrective migration.
-- The pre-deployment audit must confirm the affected rows belong only to the
-- current F-006 test.
UPDATE auth.identities AS identities
SET identity_data = COALESCE(identities.identity_data, '{}'::jsonb) - 'invitation_token'
WHERE COALESCE(identities.identity_data, '{}'::jsonb) ? 'invitation_token';

-- Rollback restores the function body saved in
-- .tmp/f006-token-cleanup-deployment/rollback-identity-follow-up.sql.
