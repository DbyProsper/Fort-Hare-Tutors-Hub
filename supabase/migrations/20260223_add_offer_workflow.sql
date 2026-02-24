-- Migration: Add offer workflow fields and reminder queue
-- Run this in Supabase SQL editor with service role/admin

-- 1. Create ENUM type for offer_status
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

-- 2. Add columns to tutor_applications
ALTER TABLE IF EXISTS tutor_applications
    ADD COLUMN IF NOT EXISTS offer_status offer_status DEFAULT 'NOT_SENT',
    ADD COLUMN IF NOT EXISTS offer_sent_at timestamp,
    ADD COLUMN IF NOT EXISTS document_rejection_reason text,
    ADD COLUMN IF NOT EXISTS document_rejected_at timestamp,
    ADD COLUMN IF NOT EXISTS resubmission_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_resubmitted_at timestamp,
    ADD COLUMN IF NOT EXISTS hr_submitted_at timestamp;

-- 3. Create a reminder queue table (workers can poll this to send emails)
CREATE TABLE IF NOT EXISTS offer_reminder_queue (
    id bigserial PRIMARY KEY,
    application_id uuid REFERENCES tutor_applications(id) ON DELETE CASCADE,
    reminder_type text NOT NULL,
    created_at timestamp DEFAULT now(),
    processed boolean DEFAULT false,
    processed_at timestamp
);

-- 4. Create helper function to enqueue reminders (placeholder)
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

-- 5. (Optional) Schedule this function with pg_cron. NOTE: run the pg_cron setup migration if not already enabled.
-- The following scheduling requires pg_cron extension and admin access; uncomment and run in Supabase SQL editor if available.
-- SELECT cron.schedule('offer-reminder-enqueue', '0 8 * * *', 'SELECT public.enqueue_offer_reminders();');

-- End migration
