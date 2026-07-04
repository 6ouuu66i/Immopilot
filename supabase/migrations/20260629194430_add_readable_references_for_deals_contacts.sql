CREATE TABLE IF NOT EXISTS public.reference_counters (
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('deal', 'contact')),
  current_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agency_id, entity_type)
);

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_reference ON public.deals(agency_id, reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_reference ON public.contacts(agency_id, reference);

CREATE OR REPLACE FUNCTION public.generate_reference(p_agency_id UUID, p_entity_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_value INTEGER;
  v_prefix TEXT;
BEGIN
  IF p_entity_type NOT IN ('deal', 'contact') THEN
    RAISE EXCEPTION 'Invalid reference entity type: %', p_entity_type;
  END IF;

  INSERT INTO public.reference_counters (agency_id, entity_type, current_value)
  VALUES (p_agency_id, p_entity_type, 1)
  ON CONFLICT (agency_id, entity_type)
  DO UPDATE SET current_value = public.reference_counters.current_value + 1
  RETURNING current_value INTO v_new_value;

  v_prefix := CASE p_entity_type
    WHEN 'deal' THEN 'DEAL'
    WHEN 'contact' THEN 'CTC'
  END;

  RETURN v_prefix || '-' || LPAD(v_new_value::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_deal_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := public.generate_reference(NEW.agency_id, 'deal');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_deal_reference ON public.deals;
CREATE TRIGGER trigger_set_deal_reference
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_deal_reference();

CREATE OR REPLACE FUNCTION public.set_contact_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := public.generate_reference(NEW.agency_id, 'contact');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_contact_reference ON public.contacts;
CREATE TRIGGER trigger_set_contact_reference
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_reference();

ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own agency counters" ON public.reference_counters;
CREATE POLICY "Users see own agency counters"
  ON public.reference_counters FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id());;
