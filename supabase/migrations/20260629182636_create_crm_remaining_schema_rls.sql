-- CRM core tables, interactions, system tables, triggers, RLS and seed function.
-- Base tables agencies/profiles/agency_invitations were created in the previous migration.

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  position INTEGER NOT NULL,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, position)
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  owner_id UUID REFERENCES public.profiles(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  roles TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  source TEXT,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id),
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT,
  estimated_commission INTEGER,
  expected_close_date DATE,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_property_marks (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  mark_type TEXT NOT NULL CHECK (mark_type IN ('favorite', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, property_id, mark_type)
);

CREATE TABLE IF NOT EXISTS public.contact_properties (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'interested' CHECK (relationship IN ('owner', 'interested', 'former_owner', 'tenant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, property_id, relationship)
);

CREATE TABLE IF NOT EXISTS public.transfer_requests (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_agent_id UUID NOT NULL REFERENCES public.profiles(id),
  to_agent_id UUID NOT NULL REFERENCES public.profiles(id),
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled')),
  refusal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT same_agency_transfer CHECK (from_agent_id != to_agent_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'transfer_requested', 'transfer_accepted', 'transfer_refused', 'task_due', 'task_overdue',
    'deal_moved', 'deal_assigned', 'property_price_drop', 'property_republished',
    'commission_ready', 'commission_paid', 'mention'
  )),
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  related_type TEXT,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  amount INTEGER NOT NULL,
  percentage NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'expected', 'payable', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  payload JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stages_agency ON public.pipeline_stages(agency_id, position);
CREATE INDEX IF NOT EXISTS idx_contacts_agency ON public.contacts(agency_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_deals_agency ON public.deals(agency_id);
CREATE INDEX IF NOT EXISTS idx_deals_property ON public.deals(property_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON public.deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON public.deals(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_active_per_property_agency ON public.deals(property_id, agency_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_agency ON public.tasks(agency_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_due ON public.tasks(owner_id, due_date) WHERE is_completed = false;
CREATE INDEX IF NOT EXISTS idx_tasks_deal ON public.tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_property ON public.tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON public.tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_notes_agency ON public.notes(agency_id);
CREATE INDEX IF NOT EXISTS idx_notes_deal ON public.notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_notes_property ON public.notes(property_id);
CREATE INDEX IF NOT EXISTS idx_notes_contact ON public.notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_marks_user ON public.user_property_marks(user_id, mark_type);
CREATE INDEX IF NOT EXISTS idx_marks_property ON public.user_property_marks(property_id);
CREATE INDEX IF NOT EXISTS idx_transfers_agency ON public.transfer_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_agent ON public.transfer_requests(to_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_from_agent ON public.transfer_requests(from_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_deal ON public.transfer_requests(deal_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON public.notifications(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agency ON public.commissions(agency_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agent ON public.commissions(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_deal ON public.commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_agency_date ON public.activities(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON public.activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_property ON public.activities(property_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON public.activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_audit_agency_date ON public.audit_logs(agency_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_agencies ON public.agencies;
CREATE TRIGGER set_updated_at_agencies BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_contacts ON public.contacts;
CREATE TRIGGER set_updated_at_contacts BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_deals ON public.deals;
CREATE TRIGGER set_updated_at_deals BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_notes ON public.notes;
CREATE TRIGGER set_updated_at_notes BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_commissions ON public.commissions;
CREATE TRIGGER set_updated_at_commissions BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO public.activities (agency_id, actor_id, type, deal_id, property_id, payload)
    VALUES (
      NEW.agency_id,
      auth.uid(),
      'stage_changed',
      NEW.id,
      NEW.property_id,
      jsonb_build_object('old_stage_id', OLD.stage_id, 'new_stage_id', NEW.stage_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_deal_stage_change_trigger ON public.deals;
CREATE TRIGGER log_deal_stage_change_trigger AFTER UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();

CREATE OR REPLACE FUNCTION public.handle_transfer_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, related_type, related_id)
    VALUES (
      NEW.from_agent_id,
      'transfer_requested',
      'Demande de transfert recue',
      'Un agent souhaite reprendre un de vos deals',
      'transfer',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, body, related_type, related_id)
    VALUES (
      NEW.requested_by,
      CASE WHEN NEW.status = 'accepted' THEN 'transfer_accepted' ELSE 'transfer_refused' END,
      CASE WHEN NEW.status = 'accepted' THEN 'Transfert accepte' ELSE 'Transfert refuse' END,
      NULL,
      'transfer',
      NEW.id
    );

    IF NEW.status = 'accepted' THEN
      UPDATE public.deals SET owner_id = NEW.to_agent_id, updated_at = NOW() WHERE id = NEW.deal_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transfer_notification_trigger ON public.transfer_requests;
CREATE TRIGGER transfer_notification_trigger AFTER INSERT OR UPDATE ON public.transfer_requests FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_notification();

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_property_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read all properties" ON public.properties;
CREATE POLICY "Authenticated users can read all properties" ON public.properties FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read all listings" ON public.listings;
CREATE POLICY "Authenticated users can read all listings" ON public.listings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read all price history" ON public.price_history;
CREATE POLICY "Authenticated users can read all price history" ON public.price_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can read own agency" ON public.agencies;
CREATE POLICY "Users can read own agency" ON public.agencies FOR SELECT TO authenticated USING (id = public.current_agency_id());
DROP POLICY IF EXISTS "Admins can update own agency" ON public.agencies;
CREATE POLICY "Admins can update own agency" ON public.agencies FOR UPDATE TO authenticated USING (id = public.current_agency_id() AND public.is_admin());

DROP POLICY IF EXISTS "Users can read agency profiles" ON public.profiles;
CREATE POLICY "Users can read agency profiles" ON public.profiles FOR SELECT TO authenticated USING (agency_id = public.current_agency_id() OR id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage agency profiles" ON public.profiles;
CREATE POLICY "Admins can manage agency profiles" ON public.profiles FOR ALL TO authenticated USING (agency_id = public.current_agency_id() AND public.is_admin());

DROP POLICY IF EXISTS "Users see agency stages" ON public.pipeline_stages;
CREATE POLICY "Users see agency stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "Admins manage agency stages" ON public.pipeline_stages;
CREATE POLICY "Admins manage agency stages" ON public.pipeline_stages FOR ALL TO authenticated USING (agency_id = public.current_agency_id() AND public.is_admin());

DROP POLICY IF EXISTS "Agency users see all contacts" ON public.contacts;
CREATE POLICY "Agency users see all contacts" ON public.contacts FOR SELECT TO authenticated USING (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "Agency users can create contacts" ON public.contacts;
CREATE POLICY "Agency users can create contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "Agency users can update contacts" ON public.contacts;
CREATE POLICY "Agency users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
CREATE POLICY "Admins can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (agency_id = public.current_agency_id() AND public.is_admin());

DROP POLICY IF EXISTS "Agency users see all deals" ON public.deals;
CREATE POLICY "Agency users see all deals" ON public.deals FOR SELECT TO authenticated USING (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "Users create own deals" ON public.deals;
CREATE POLICY "Users create own deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_agency_id() AND (owner_id = auth.uid() OR public.is_admin()));
DROP POLICY IF EXISTS "Owners and admins can update deals" ON public.deals;
CREATE POLICY "Owners and admins can update deals" ON public.deals FOR UPDATE TO authenticated USING (agency_id = public.current_agency_id() AND (owner_id = auth.uid() OR public.is_admin()));
DROP POLICY IF EXISTS "Admins can delete deals" ON public.deals;
CREATE POLICY "Admins can delete deals" ON public.deals FOR DELETE TO authenticated USING (agency_id = public.current_agency_id() AND public.is_admin());

DROP POLICY IF EXISTS "Agency users see agency tasks" ON public.tasks;
CREATE POLICY "Agency users see agency tasks" ON public.tasks FOR SELECT TO authenticated USING (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "Users create own tasks" ON public.tasks;
CREATE POLICY "Users create own tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_agency_id() AND owner_id = auth.uid());
DROP POLICY IF EXISTS "Owners update own tasks" ON public.tasks;
CREATE POLICY "Owners update own tasks" ON public.tasks FOR UPDATE TO authenticated USING (agency_id = public.current_agency_id() AND (owner_id = auth.uid() OR public.is_admin()));
DROP POLICY IF EXISTS "Owners delete own tasks" ON public.tasks;
CREATE POLICY "Owners delete own tasks" ON public.tasks FOR DELETE TO authenticated USING (agency_id = public.current_agency_id() AND (owner_id = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "Agency users see agency notes" ON public.notes;
CREATE POLICY "Agency users see agency notes" ON public.notes FOR SELECT TO authenticated USING (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "Users create notes in agency" ON public.notes;
CREATE POLICY "Users create notes in agency" ON public.notes FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_agency_id() AND author_id = auth.uid());
DROP POLICY IF EXISTS "Authors update own notes" ON public.notes;
CREATE POLICY "Authors update own notes" ON public.notes FOR UPDATE TO authenticated USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors or admins delete notes" ON public.notes;
CREATE POLICY "Authors or admins delete notes" ON public.notes FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users see own marks" ON public.user_property_marks;
CREATE POLICY "Users see own marks" ON public.user_property_marks FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own marks" ON public.user_property_marks;
CREATE POLICY "Users manage own marks" ON public.user_property_marks FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Agency users see contact properties" ON public.contact_properties;
CREATE POLICY "Agency users see contact properties" ON public.contact_properties FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.agency_id = public.current_agency_id())
);
DROP POLICY IF EXISTS "Agency users manage contact properties" ON public.contact_properties;
CREATE POLICY "Agency users manage contact properties" ON public.contact_properties FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.agency_id = public.current_agency_id())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.agency_id = public.current_agency_id())
);

DROP POLICY IF EXISTS "See own transfers" ON public.transfer_requests;
CREATE POLICY "See own transfers" ON public.transfer_requests FOR SELECT TO authenticated USING (
  agency_id = public.current_agency_id()
  AND (from_agent_id = auth.uid() OR to_agent_id = auth.uid() OR requested_by = auth.uid() OR public.is_admin())
);
DROP POLICY IF EXISTS "Create transfer request" ON public.transfer_requests;
CREATE POLICY "Create transfer request" ON public.transfer_requests FOR INSERT TO authenticated WITH CHECK (
  agency_id = public.current_agency_id()
  AND requested_by = auth.uid()
  AND to_agent_id = auth.uid()
);
DROP POLICY IF EXISTS "From agent can resolve transfer" ON public.transfer_requests;
CREATE POLICY "From agent can resolve transfer" ON public.transfer_requests FOR UPDATE TO authenticated USING (from_agent_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Agents see own commissions" ON public.commissions;
CREATE POLICY "Agents see own commissions" ON public.commissions FOR SELECT TO authenticated USING (agency_id = public.current_agency_id() AND (agent_id = auth.uid() OR public.is_admin()));
DROP POLICY IF EXISTS "Admins manage commissions" ON public.commissions;
CREATE POLICY "Admins manage commissions" ON public.commissions FOR ALL TO authenticated USING (agency_id = public.current_agency_id() AND public.is_admin());

DROP POLICY IF EXISTS "Agency users see agency activities" ON public.activities;
CREATE POLICY "Agency users see agency activities" ON public.activities FOR SELECT TO authenticated USING (agency_id = public.current_agency_id());
DROP POLICY IF EXISTS "System can insert activities" ON public.activities;
CREATE POLICY "System can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_agency_id());

DROP POLICY IF EXISTS "Admins see audit logs" ON public.audit_logs;
CREATE POLICY "Admins see audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (agency_id = public.current_agency_id() AND public.is_admin());

DROP POLICY IF EXISTS "Admins manage invitations" ON public.agency_invitations;
CREATE POLICY "Admins manage invitations" ON public.agency_invitations FOR ALL TO authenticated USING (agency_id = public.current_agency_id() AND public.is_admin());

CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages(p_agency_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pipeline_stages (agency_id, name, color, position, is_won, is_lost, is_default) VALUES
    (p_agency_id, 'Nouveau', '#6B7280', 1, false, false, true),
    (p_agency_id, 'Qualifie', '#3B82F6', 2, false, false, true),
    (p_agency_id, 'Contact', '#8B5CF6', 3, false, false, true),
    (p_agency_id, 'Visite', '#F59E0B', 4, false, false, true),
    (p_agency_id, 'Proposition', '#EC4899', 5, false, false, true),
    (p_agency_id, 'Mandat signe', '#10B981', 6, false, false, true),
    (p_agency_id, 'Bien vendu', '#059669', 7, true, false, true),
    (p_agency_id, 'Perdu', '#EF4444', 8, false, true, true)
  ON CONFLICT (agency_id, position) DO NOTHING;
END;
$$;;
