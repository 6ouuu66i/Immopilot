CREATE OR REPLACE FUNCTION handle_commission_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_reference TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('payable', 'paid')
  THEN
    SELECT reference INTO v_deal_reference FROM deals WHERE id = NEW.deal_id;

    INSERT INTO notifications (user_id, type, title, body, related_type, related_id, metadata)
    VALUES (
      NEW.agent_id,
      'commission_ready',
      CASE WHEN NEW.status = 'paid' THEN 'Commission payée' ELSE 'Commission à recevoir' END,
      CASE WHEN v_deal_reference IS NOT NULL
        THEN (CASE WHEN NEW.status = 'paid' THEN 'Commission payée pour ' ELSE 'Commission à recevoir pour ' END) || v_deal_reference
        ELSE NULL
      END,
      'commission',
      NEW.id,
      jsonb_build_object(
        'commission_id', NEW.id,
        'deal_reference', v_deal_reference,
        'amount', NEW.amount,
        'status', NEW.status,
        'route', '#commissions?commissionId=' || NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_commission_notification ON commissions;
CREATE TRIGGER trg_commission_notification
AFTER UPDATE OF status ON commissions
FOR EACH ROW
EXECUTE FUNCTION handle_commission_notification();
REVOKE ALL ON FUNCTION handle_commission_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION handle_commission_notification() FROM anon;
REVOKE ALL ON FUNCTION handle_commission_notification() FROM authenticated;
