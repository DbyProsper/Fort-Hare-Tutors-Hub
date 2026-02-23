-- Schedule enqueue_offer_reminders() daily at 08:00 UTC using pg_cron
-- Requires pg_cron extension enabled (see earlier migrations)

SELECT cron.unschedule('offer-reminder-enqueue') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'offer-reminder-enqueue'
);

SELECT cron.schedule(
  'offer-reminder-enqueue',
  '0 8 * * *', -- Daily at 08:00 UTC
  'SELECT public.enqueue_offer_reminders();'
);
