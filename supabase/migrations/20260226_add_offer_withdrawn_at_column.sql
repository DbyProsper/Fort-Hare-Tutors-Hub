-- Migration: add offer_withdrawn_at timestamp to tutor_applications
-- This column tracks when an offer was withdrawn by admin or system.

ALTER TABLE IF EXISTS public.tutor_applications
ADD COLUMN IF NOT EXISTS offer_withdrawn_at TIMESTAMP WITH TIME ZONE;

-- Note: RLS policies for tutor_applications already allow admins to update all fields,
-- so no additional policy is required.