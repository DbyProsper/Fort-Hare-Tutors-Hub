Supabase SQL Run Checklist (sequential)

Run these SQL migrations and commands in the Supabase SQL Editor (in order). Use a service-role/admin account when required (creating types, extensions, cron scheduling).

1) (Optional) Enable pg_cron if you plan to use scheduled cron jobs
- File: `supabase/migrations/20260222_setup_cron_job.sql`
- Purpose: Creates `pg_cron` extension and schedules other maintenance jobs (if you already ran this earlier, skip).
- Run: open the file contents and execute in the Supabase SQL editor as an admin.

2) Add offer workflow columns, enum type, and enqueue helper
- File: `supabase/migrations/20260223_add_offer_workflow.sql`
- Purpose: Creates `offer_status` enum, adds columns to `tutor_applications`, creates `offer_reminder_queue`, and defines `enqueue_offer_reminders()` helper.
- Run: paste and execute in Supabase SQL editor using a service role.

3) (Optional) Schedule the enqueue helper using pg_cron
- File: `supabase/migrations/20260223_schedule_offer_reminder_cron.sql`
- Purpose: Creates a scheduled job that runs `enqueue_offer_reminders()` daily at 08:00 UTC.
- Precondition: `pg_cron` must be enabled and accessible (see step 1). If you cannot enable `pg_cron`, you can run the enqueue function from an external worker instead.
- Run: paste and execute in Supabase SQL editor as admin.

4) Verify schema changes
- Query to run in SQL editor (sanity checks):

```sql
-- Confirm enum exists
SELECT typname FROM pg_type WHERE typname = 'offer_status';

-- Check new columns on tutor_applications
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tutor_applications' AND column_name IN ('offer_status','offer_sent_at','document_rejection_reason','document_rejected_at','resubmission_count','last_resubmitted_at');
```

5) Create storage buckets and upload admin offer PDFs
- In Supabase Dashboard → Storage:
  - Create bucket: `offer-templates` (public or private depending on your email worker access; service-role key required to download in server-side functions)
  - Upload files (admin):
    - `tutor_personal_form.pdf`
    - `offer_affidavit.pdf`

6) (Optional) Seed or test data
- If you want to test end-to-end, ensure one application is `approved` then run the send offer flow (via Admin UI or Edge Function).

7) Reminder worker setup
- If using `pg_cron` schedule (step 3) and `enqueue_offer_reminders()` is scheduled, deploy the `process_offer_reminders` worker (see `supabase/functions/process_offer_reminders`). The worker will poll `offer_reminder_queue` and send reminder emails.
- If not using `pg_cron`, run this command periodically (e.g., cron or hosted worker):

```bash
# run once (or as service)
node supabase/functions/process_offer_reminders/index.js
```

8) Edge Function / send-offer function
- Deploy `supabase/functions/send_offer_email/index.js` to your serverless environment (or run locally with `node` for testing).
- Ensure environment variables are set (see `supabase/functions/README.md`).

9) Post-run checks
- Verify that when `send_offer_email` is invoked (either via the Admin UI button or by calling the Edge Function), the `tutor_applications` row for that applicant updates:
  - `offer_status` => `SENT`
- new value `WITHDRAWN` can be assigned when an offer is pulled back by an admin or when an application is rejected (see migration 20260226_add_withdrawn_offer_status.sql).
- migration also installs a trigger so that any change of `status` to `rejected` automatically updates `offer_status` to `WITHDRAWN` and clears the timestamp.
  - `offer_sent_at` => timestamp

- Verify applicant sees instructions and can upload signed PDFs (these are stored in `application-documents` and `application_documents` table is populated).

Notes and rollback
- To rollback the schema changes, you can manually drop the columns and enum (exercise caution):

```sql
ALTER TABLE tutor_applications DROP COLUMN IF EXISTS offer_status, DROP COLUMN IF EXISTS offer_sent_at, DROP COLUMN IF EXISTS document_rejection_reason, DROP COLUMN IF EXISTS document_rejected_at, DROP COLUMN IF EXISTS resubmission_count, DROP COLUMN IF EXISTS last_resubmitted_at;
DROP TYPE IF EXISTS offer_status;
DROP TABLE IF EXISTS offer_reminder_queue;
DROP FUNCTION IF EXISTS enqueue_offer_reminders();
```

If you'd like, I can convert the Node.js functions to Deno-compatible Edge Functions for direct Supabase Edge deployment next.
