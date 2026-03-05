-- Migration: Add documents_verified_at to tutor_applications table

ALTER TABLE IF EXISTS public.tutor_applications
ADD COLUMN IF NOT EXISTS documents_verified_at timestamptz;
