-- Change TEXT[] columns to TEXT and JSONB to TEXT for better compatibility
ALTER TABLE public.tutor_applications
ALTER COLUMN subjects_completed TYPE TEXT,
ALTER COLUMN subjects_to_tutor TYPE TEXT,
ALTER COLUMN skills_competencies TYPE TEXT,
ALTER COLUMN languages_spoken TYPE TEXT,
ALTER COLUMN availability TYPE TEXT;