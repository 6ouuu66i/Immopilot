-- F-006: invitation-only account creation and active-membership data gating.
--
-- Hosted activation required after this migration is deployed:
-- Authentication > Hooks > Before User Created > Postgres function
-- public.hook_require_invitation. The hook is the server-side control that prevents a
-- direct Auth API signUp from creating auth.users before accept_invitation runs.

CREATE OR REPLACE FUNCTION public.hook_require_invitation(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(trim(event->'user'->>'email'));
  v_provider text := event->'user'->'app_metadata'->>'provider';
  v_token text := lower(trim(event->'user'->'user_metadata'->>'invitation_token'));
BEGIN
  IF v_provider IS DISTINCT FROM 'email'
     OR v_email IS NULL
     OR v_token IS NULL
     OR v_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'ImmoPilot est actuellement accessible sur invitation.'
      )
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agency_invitations invitation
    WHERE invitation.token = v_token
      AND lower(trim(invitation.email)) = v_email
      AND invitation.status = 'pending'
      AND invitation.expires_at > now()
  ) THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Deliberately one generic response: do not reveal whether the email, account or
  -- invitation exists, expired, was revoked or was already consumed.
  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'ImmoPilot est actuellement accessible sur invitation.'
    )
  );
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT (email, token, status, expires_at)
  ON public.agency_invitations TO supabase_auth_admin;

DROP POLICY IF EXISTS "Supabase Auth validates signup invitations"
  ON public.agency_invitations;
CREATE POLICY "Supabase Auth validates signup invitations"
  ON public.agency_invitations
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

REVOKE EXECUTE ON FUNCTION public.hook_require_invitation(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_require_invitation(jsonb)
  TO supabase_auth_admin;

-- Preserve handle_new_user's F-002 profile creation contract, but remove the bearer
-- invitation token from Auth metadata inside the same transaction as user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'invitation_token'
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Membership is represented by profiles.agency_id. Inactive or agency-less profiles
-- must behave as non-members for every policy that uses these helpers.
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
    AND agency_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
    AND agency_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND agency_id IS NOT NULL
  ), false);
$$;

REVOKE EXECUTE ON FUNCTION public.current_agency_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Global market data remains shared across agencies, but only active agency members may
-- read it. A plain authenticated JWT is no longer sufficient.
DROP POLICY IF EXISTS "Authenticated users can read all properties" ON public.properties;
CREATE POLICY "Active agency members can read all properties"
  ON public.properties FOR SELECT TO authenticated
  USING (public.current_agency_id() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can read all listings" ON public.listings;
CREATE POLICY "Active agency members can read all listings"
  ON public.listings FOR SELECT TO authenticated
  USING (public.current_agency_id() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can read all price history" ON public.price_history;
CREATE POLICY "Active agency members can read all price history"
  ON public.price_history FOR SELECT TO authenticated
  USING (public.current_agency_id() IS NOT NULL);

DROP POLICY IF EXISTS "listing_signals_read_all_authenticated" ON public.listing_signals;
CREATE POLICY "listing_signals_read_active_agency_members"
  ON public.listing_signals FOR SELECT TO authenticated
  USING (public.current_agency_id() IS NOT NULL);

DROP POLICY IF EXISTS "listing_scores_read_all_authenticated" ON public.listing_scores;
CREATE POLICY "listing_scores_read_active_agency_members"
  ON public.listing_scores FOR SELECT TO authenticated
  USING (public.current_agency_id() IS NOT NULL);

DROP POLICY IF EXISTS "listing_score_history_read_all_authenticated" ON public.listing_score_history;
CREATE POLICY "listing_score_history_read_active_agency_members"
  ON public.listing_score_history FOR SELECT TO authenticated
  USING (public.current_agency_id() IS NOT NULL);

DROP POLICY IF EXISTS "listing_outcomes_read_all_authenticated" ON public.listing_outcomes;
CREATE POLICY "listing_outcomes_read_active_agency_members"
  ON public.listing_outcomes FOR SELECT TO authenticated
  USING (public.current_agency_id() IS NOT NULL);

-- The materialized views cannot enforce RLS. Keep them internal and route application
-- reads through the security-invoker canonical view instead.
REVOKE SELECT ON public.active_properties_canonical_mat FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.market_reference FROM PUBLIC, anon, authenticated;

-- Add the two fields used by the React property list to the RLS-aware view. PostgreSQL
-- requires new CREATE OR REPLACE VIEW columns to be appended after existing columns.
CREATE OR REPLACE VIEW public.active_properties_canonical
AS
WITH seller_segments AS (
  SELECT
    active_listing.property_id,
    CASE
      WHEN bool_or(active_listing.customer_type = 'PRIVATE') THEN 'particulier'
      WHEN bool_or(active_listing.customer_type IN (
        'AGENCY',
        'AGENCY_PAYING_WITH_OGONE',
        'REAL_ESTATE_AGENCY'
      )) THEN 'agence'
      ELSE NULL
    END AS seller_segment
  FROM public.listings active_listing
  WHERE active_listing.status = 'active'
    AND active_listing.property_id IS NOT NULL
  GROUP BY active_listing.property_id
)
SELECT DISTINCT ON (l.property_id)
  l.id AS listing_id,
  l.property_id,
  l.source,
  l.url,
  l.status,
  l.price,
  l.old_price,
  l.is_fsbo,
  l.first_seen_at,
  l.last_seen_at,
  l.published_at,
  l.ai_badges,
  l.ai_summary,
  l.ai_gross_yield,
  l.title_fr,
  l.title_nl,
  COALESCE(score.score, 0) AS seller_score,
  CASE
    WHEN l.old_price IS NOT NULL AND l.price IS NOT NULL AND l.old_price > l.price THEN true
    ELSE false
  END AS has_price_drop,
  EXISTS (
    SELECT 1
    FROM public.listing_signals signal
    WHERE signal.listing_id = l.id
      AND signal.signal_type = 'republished'
      AND signal.is_active = true
  ) AS has_republished_signal,
  GREATEST(
    0,
    ceil(extract(epoch FROM (now() - COALESCE(l.published_at, l.first_seen_at))) / 86400.0)
  )::integer AS days_online,
  l.photo_urls[1] AS primary_photo_url,
  p.id AS canonical_property_id,
  p.street,
  p.house_number,
  p.postal_code,
  p.locality,
  p.province,
  p.property_type,
  p.property_subtype,
  p.bedroom_count,
  p.bathroom_count,
  p.living_area,
  p.land_area,
  COALESCE(p.living_area, p.land_area, 0) AS surface_value,
  l.customer_type,
  seller_segments.seller_segment,
  l.is_under_option,
  l.photo_urls
FROM public.listings l
JOIN seller_segments ON seller_segments.property_id = l.property_id
JOIN public.properties p ON p.id = l.property_id
LEFT JOIN public.listing_scores score ON score.property_id = l.property_id
WHERE l.status = 'active'
  AND l.property_id IS NOT NULL
  AND seller_segments.seller_segment IS NOT NULL
ORDER BY
  l.property_id,
  CASE
    WHEN seller_segments.seller_segment = 'particulier' AND l.customer_type = 'PRIVATE' THEN 0
    WHEN seller_segments.seller_segment = 'agence' AND l.customer_type IN (
      'AGENCY',
      'AGENCY_PAYING_WITH_OGONE',
      'REAL_ESTATE_AGENCY'
    ) THEN 0
    ELSE 1
  END,
  l.last_seen_at DESC,
  l.first_seen_at DESC;

ALTER VIEW public.active_properties_canonical SET (security_invoker = true);
REVOKE SELECT ON public.active_properties_canonical FROM PUBLIC, anon;
GRANT SELECT ON public.active_properties_canonical TO authenticated;

-- The dashboard RPC no longer bypasses the membership-aware table policies.
ALTER FUNCTION public.get_dashboard_snapshot(integer) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_snapshot(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_snapshot(integer) TO authenticated;

-- Rollback (manual, local preparation only):
-- 1. Disable the Before User Created hook in Authentication > Hooks.
-- 2. Drop public.hook_require_invitation(jsonb) and its auth-admin SELECT policy/grants.
-- 3. Restore the former helper definitions and USING (true) read policies from their
--    immutable historical migrations.
-- 4. Restore SELECT on both materialized views and SECURITY DEFINER on
--    public.get_dashboard_snapshot(integer), then point the frontend back to the matview.
