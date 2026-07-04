CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages(p_agency_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pipeline_stages (agency_id, name, color, position, is_won, is_lost, is_default) VALUES
    (p_agency_id, 'Nouveau', '#6B7280', 1, false, false, true),
    (p_agency_id, 'Qualifié', '#3B82F6', 2, false, false, true),
    (p_agency_id, 'Contact', '#8B5CF6', 3, false, false, true),
    (p_agency_id, 'Visite', '#F59E0B', 4, false, false, true),
    (p_agency_id, 'Proposition', '#EC4899', 5, false, false, true),
    (p_agency_id, 'Mandat signé', '#10B981', 6, false, false, true),
    (p_agency_id, 'Bien vendu', '#059669', 7, true, false, true),
    (p_agency_id, 'Perdu', '#EF4444', 8, false, true, true)
  ON CONFLICT (agency_id, position) DO NOTHING;
END;
$$;

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
      'Demande de transfert reçue',
      'Un agent souhaite reprendre un de vos deals',
      'transfer',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, body, related_type, related_id)
    VALUES (
      NEW.requested_by,
      CASE WHEN NEW.status = 'accepted' THEN 'transfer_accepted' ELSE 'transfer_refused' END,
      CASE WHEN NEW.status = 'accepted' THEN 'Transfert accepté' ELSE 'Transfert refusé' END,
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
$$;;
