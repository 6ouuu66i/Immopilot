-- F-006 corrective migration: guarantee that the invitation bearer token is absent
-- from auth.users metadata when the signup transaction commits.
--
-- public.handle_new_user() already reads the initial token, creates the profile and
-- server-only resume context, then updates auth.users during its regular AFTER INSERT
-- trigger. A hosted Auth signup performs another metadata write later in the same
-- transaction, which can restore the original signup metadata after that trigger.
-- This deferred constraint trigger runs at transaction end, after those writes. It
-- removes only invitation_token from the exact NEW.id row and verifies the persisted
-- postcondition. Any SQL failure or failed postcondition aborts the whole signup
-- transaction, including profile and resume-context creation.

CREATE FUNCTION public.scrub_invitation_token_after_signup()
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

  IF EXISTS (
    SELECT 1
    FROM auth.users AS users
    WHERE users.id = NEW.id
      AND COALESCE(users.raw_user_meta_data, '{}'::jsonb) ? 'invitation_token'
  ) THEN
    RAISE EXCEPTION 'Invitation metadata cleanup failed'
      USING ERRCODE = 'IPV09';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scrub_invitation_token_after_signup()
  FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER scrub_invitation_token_after_signup
AFTER INSERT ON auth.users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.scrub_invitation_token_after_signup();

-- Rollback (manual):
--   DROP TRIGGER IF EXISTS scrub_invitation_token_after_signup ON auth.users;
--   DROP FUNCTION IF EXISTS public.scrub_invitation_token_after_signup();
