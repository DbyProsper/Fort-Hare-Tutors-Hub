-- Migration: add is_editable to tutor_applications and receiver_role to messages

-- 1) Add is_editable boolean to tutor_applications (default false)
ALTER TABLE IF EXISTS public.tutor_applications
ADD COLUMN IF NOT EXISTS is_editable boolean NOT NULL DEFAULT false;

-- 2) Add receiver_role to messages and populate existing rows
ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS receiver_role text;

-- populate receiver_role for existing rows based on sender_role
UPDATE public.messages
SET receiver_role = CASE WHEN sender_role = 'STUDENT' THEN 'ADMIN' ELSE 'STUDENT' END
WHERE receiver_role IS NULL;

-- add a check constraint and default for future inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_receiver_role_check'
  ) THEN
    ALTER TABLE public.messages
    ALTER COLUMN receiver_role SET DEFAULT 'ADMIN';
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_receiver_role_check CHECK (receiver_role IN ('ADMIN','STUDENT'));
  END IF;
END$$;

-- 3) Update RLS policy for tutor_applications: students may UPDATE only when is_editable = true
-- Drop the older policy (if exists) and create new one
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Students can update own draft applications' AND polrelid = 'public.tutor_applications'::regclass) THEN
    EXECUTE 'DROP POLICY "Students can update own draft applications" ON public.tutor_applications';
  END IF;
END$$;

CREATE POLICY "Students can update own editable applications" ON public.tutor_applications FOR UPDATE
USING (auth.uid() = user_id AND is_editable = true);

-- Grant select/insert privileges remain unchanged; ensure messages still selectable
GRANT SELECT, INSERT ON public.messages TO authenticated;
