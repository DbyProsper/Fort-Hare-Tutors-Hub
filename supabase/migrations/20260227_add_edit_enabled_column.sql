-- Migration: add edit_enabled column to tutor_applications

ALTER TABLE tutor_applications
ADD COLUMN IF NOT EXISTS edit_enabled boolean NOT NULL DEFAULT false;

-- make sure RLS policies still allow required access (admins already have full update rights)

-- Update types.ts if needed (done on client side separately).