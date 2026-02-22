-- Enable pg_cron extension (requires admin access in Supabase)
-- This should be run from the Supabase SQL editor with a service role or admin account
-- 
-- To enable and schedule the cleanup:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query and paste the code below:
--
-- Execute this to enable the extension:
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage on pg_cron to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule the cleanup function to run every day at 2 AM UTC
-- Delete any existing schedule first
SELECT cron.unschedule('delete-expired-tutor-drafts') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-tutor-drafts'
);

-- Create the new scheduled job
SELECT cron.schedule(
  'delete-expired-tutor-drafts',
  '0 2 * * *', -- Daily at 2 AM UTC
  'SELECT public.delete_expired_drafts();'
);

-- Alternatively, for testing purposes, you can run the cleanup manually:
-- SELECT public.delete_expired_drafts();
