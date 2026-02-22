-- Add timestamp columns for draft expiry functionality
ALTER TABLE public.tutor_applications
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');

-- Update existing draft records with expires_at
UPDATE public.tutor_applications
SET expires_at = now() + interval '7 days',
    last_updated_at = now()
WHERE status = 'draft' AND expires_at IS NULL;

-- Create function to delete expired drafts
CREATE OR REPLACE FUNCTION public.delete_expired_drafts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tutor_applications
  WHERE status = 'draft'
  AND expires_at < now();
END;
$$;

-- Create index for efficient expired draft queries
CREATE INDEX IF NOT EXISTS idx_draft_expiry 
ON public.tutor_applications(status, expires_at)
WHERE status = 'draft';
