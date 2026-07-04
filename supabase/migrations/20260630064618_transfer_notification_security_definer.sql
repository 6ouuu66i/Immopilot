CREATE OR REPLACE FUNCTION handle_transfer_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_reference TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;

    INSERT INTO notifications (user_id, type, title, body, related_type, related_id, metadata)
    VALUES (
      NEW.from_agent_id,
      'transfer_requested',
      'Demande de transfert reçue',
      'Un agent souhaite reprendre votre deal ' || v_deal_reference,
      'transfer',
      NEW.id,
      jsonb_build_object(
        'deal_id', NEW.deal_id,
        'deal_reference', v_deal_reference,
        'requested_by', NEW.requested_by,
        'to_agent_id', NEW.to_agent_id
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('accepted', 'refused') THEN
    SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;

    INSERT INTO notifications (user_id, type, title, body, related_type, related_id, metadata)
    VALUES (
      NEW.requested_by,
      CASE WHEN NEW.status = 'accepted' THEN 'transfer_accepted' ELSE 'transfer_refused' END,
      CASE WHEN NEW.status = 'accepted'
        THEN 'Transfert accepté pour ' || v_deal_reference
        ELSE 'Transfert refusé pour ' || v_deal_reference END,
      NULL,
      'transfer',
      NEW.id,
      jsonb_build_object(
        'deal_id', NEW.deal_id,
        'deal_reference', v_deal_reference,
        'status', NEW.status,
        'refusal_reason', NEW.refusal_reason
      )
    );

    IF NEW.status = 'accepted' THEN
      UPDATE deals SET owner_id = NEW.to_agent_id, updated_at = NOW() WHERE id = NEW.deal_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION handle_transfer_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION handle_transfer_notification() FROM anon;
REVOKE ALL ON FUNCTION handle_transfer_notification() FROM authenticated;
