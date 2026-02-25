Supabase SQL Run Checklist — copy-paste ready

Run these SQL statements in the Supabase SQL Editor in the order shown. Use a service-role/admin account where noted (creating extensions, types, and scheduled jobs requires admin privileges).

1) (Optional, admin) Enable pg_cron extension
-- Run this if you plan to use Supabase's `pg_cron` scheduling from the database.

```sql
-- Enable pg_cron extension (requires admin)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role (adjust role if your project uses a different admin role)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- (Optional) Example: unschedule previous job and schedule a maintenance job
-- SELECT cron.unschedule('delete-expired-tutor-drafts') WHERE EXISTS (
--   SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-tutor-drafts'
-- );

-- SELECT cron.schedule(
--   'delete-expired-tutor-drafts',
--   '0 2 * * *', -- Daily at 2 AM UTC
--   'SELECT public.delete_expired_drafts();'
-- );
```

2) Add offer workflow type, columns, reminder queue and enqueue helper
-- Run the following as a service-role / admin in the SQL editor.

```sql
-- Create ENUM type for offer_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
        CREATE TYPE offer_status AS ENUM (
            'NOT_SENT',
            'SENT',
            'ACCEPTED_AWAITING_UPLOAD',
            'SIGNED_UPLOADED',
            'RESUBMISSION_REQUIRED',
            'VERIFIED',
            'HR_SUBMITTED'
        );
    END IF;
END$$;

-- Add columns to tutor_applications (idempotent)
ALTER TABLE IF EXISTS tutor_applications
    ADD COLUMN IF NOT EXISTS offer_status offer_status DEFAULT 'NOT_SENT',
    ADD COLUMN IF NOT EXISTS offer_sent_at timestamp,
    ADD COLUMN IF NOT EXISTS document_rejection_reason text,
    ADD COLUMN IF NOT EXISTS document_rejected_at timestamp,
    ADD COLUMN IF NOT EXISTS resubmission_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_resubmitted_at timestamp,
    ADD COLUMN IF NOT EXISTS hr_submitted_at timestamp;

-- Create a reminder queue table
CREATE TABLE IF NOT EXISTS offer_reminder_queue (
    id bigserial PRIMARY KEY,
    application_id uuid REFERENCES tutor_applications(id) ON DELETE CASCADE,
    reminder_type text NOT NULL,
    created_at timestamp DEFAULT now(),
    processed boolean DEFAULT false,
    processed_at timestamp
);

-- Enqueue helper: inserts reminder records (idempotent behavior handled by query)
CREATE OR REPLACE FUNCTION public.enqueue_offer_reminders() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Enqueue reminders for offers sent more than 5 days ago and not yet uploaded
  INSERT INTO offer_reminder_queue (application_id, reminder_type)
  SELECT id, 'OFFER_SENT_REMINDER'
  FROM tutor_applications
  WHERE offer_status = 'SENT'
    AND offer_sent_at IS NOT NULL
    AND offer_sent_at < now() - INTERVAL '5 days'
    AND NOT EXISTS (
      SELECT 1 FROM offer_reminder_queue q
      WHERE q.application_id = tutor_applications.id
        AND q.reminder_type = 'OFFER_SENT_REMINDER'
        AND q.processed = false
    );

  -- Enqueue reminders for resubmissions requested more than 3 days ago and not resubmitted
  INSERT INTO offer_reminder_queue (application_id, reminder_type)
  SELECT id, 'RESUBMISSION_REMINDER'
  FROM tutor_applications
  WHERE offer_status = 'RESUBMISSION_REQUIRED'
    AND document_rejected_at IS NOT NULL
    AND document_rejected_at < now() - INTERVAL '3 days'
    AND NOT EXISTS (
      SELECT 1 FROM offer_reminder_queue q
      WHERE q.application_id = tutor_applications.id
        AND q.reminder_type = 'RESUBMISSION_REMINDER'
        AND q.processed = false
    );
END;
$$;
```

3) (Optional, admin) Schedule the enqueue helper with pg_cron
-- Only run this if you enabled pg_cron in step 1.

```sql
-- Unschedule existing job (safe no-op if not present)
SELECT cron.unschedule('offer-reminder-enqueue') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'offer-reminder-enqueue'
);

-- Schedule the enqueue function to run daily at 08:00 UTC
SELECT cron.schedule(
  'offer-reminder-enqueue',
  '0 8 * * *', -- Daily at 08:00 UTC
  'SELECT public.enqueue_offer_reminders();'
);
```

4) Verification / sanity queries (run after step 2)

```sql
-- Confirm the enum exists
SELECT typname FROM pg_type WHERE typname = 'offer_status';
```

5) Storage buckets (manual via Supabase dashboard)
- Create a bucket named `offer-templates` and upload the following admin template files:
  - `tutor_personal_form.pdf`
  - `offer_affidavit.pdf`

Notes: If you want the files downloadable from the browser by authenticated users, set bucket to public or configure signed URLs appropriately.

6) Reminder worker / background processor
- The DB-only schedule above only enqueues reminder rows; you must run a worker to process `offer_reminder_queue` and send notifications (or implement server-side Edge Function to process and notify).

Example (run on a host/service):

```bash
# Run the Node.js reminder worker locally or on a server
node supabase/functions/process_offer_reminders/index.js
```

7) Edge function / send-offer behavior
- If you previously implemented `send_offer_email` Edge Function but switched to UI-based send, you may skip email deployment. Otherwise deploy `supabase/functions/send_offer_email/index.js` and ensure service keys are configured.

8) Rollback snippets (use with caution)

```sql
-- Remove columns and objects created by this migration (destructive)
ALTER TABLE IF EXISTS tutor_applications
  DROP COLUMN IF EXISTS offer_status,
  DROP COLUMN IF EXISTS offer_sent_at,
  DROP COLUMN IF EXISTS document_rejection_reason,
  DROP COLUMN IF EXISTS document_rejected_at,
  DROP COLUMN IF EXISTS resubmission_count,
  DROP COLUMN IF EXISTS last_resubmitted_at,
  DROP COLUMN IF EXISTS hr_submitted_at;

DROP TABLE IF EXISTS offer_reminder_queue;
DROP FUNCTION IF EXISTS public.enqueue_offer_reminders();
DROP TYPE IF EXISTS offer_status;

-- If you created cron jobs and want to remove them (admin):
-- SELECT cron.unschedule('offer-reminder-enqueue');
```

9) Quick deployment checklist
- Run steps 1 (optional) and 2 in Supabase SQL editor as admin (copy-paste the blocks above).
- Create `offer-templates` storage bucket and upload two PDFs via the Storage UI.
- If using scheduling, run step 3 (requires pg_cron enabled).
- Deploy your reminder worker / background processor and any Edge Functions as needed.

If you want, I can inline the full SQL from other migrations or create a single combined migration file. Tell me if you prefer that.