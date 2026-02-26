-- Migration: add WITHDRAWN value to offer_status enum
-- This allows the frontend to mark offers as withdrawn instead of relying on NOT_SENT
-- and avoids 400 errors when trying to set an unsupported enum value.

DO $$
BEGIN
    -- add the value only if it doesn't already exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'offer_status' AND e.enumlabel = 'WITHDRAWN'
    ) THEN
        ALTER TYPE offer_status ADD VALUE 'WITHDRAWN';
    END IF;
END$$;

-- 2. trigger: whenever an application is rejected, mark any existing offer as withdrawn
CREATE OR REPLACE FUNCTION public.auto_withdraw_offer_on_reject()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'rejected' THEN
    NEW.offer_status := 'WITHDRAWN';
    NEW.offer_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_withdraw_offer_on_reject'
  ) THEN
    CREATE TRIGGER trg_withdraw_offer_on_reject
    BEFORE UPDATE ON public.tutor_applications
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE PROCEDURE public.auto_withdraw_offer_on_reject();
  END IF;
END$$;
