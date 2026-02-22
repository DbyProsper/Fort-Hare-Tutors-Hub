# Supabase Migration Setup Instructions

## Overview
This document provides step-by-step instructions for applying the database migrations for draft expiry functionality.

---

## Step 1: Apply Migration 1 - Add Draft Expiry Columns

### In Supabase Dashboard:
1. Go to **SQL Editor**
2. Click **"New Query"**
3. Copy and paste the SQL below
4. Click **Run**

```sql
-- Add timestamp columns for draft expiry functionality
ALTER TABLE public.tutor_applications
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');
-- Done

-- Update existing draft records with expires_at
UPDATE public.tutor_applications
SET expires_at = now() + interval '7 days',
    last_updated_at = now()
WHERE status = 'draft' AND expires_at IS NULL;
-- Done

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
-- Done 

-- Create index for efficient expired draft queries
CREATE INDEX IF NOT EXISTS idx_draft_expiry 
ON public.tutor_applications(status, expires_at)
WHERE status = 'draft';
-- Done
```

### Expected Output:
- ✅ 4 successful operations (ALTER, UPDATE, CREATE FUNCTION, CREATE INDEX)

---

## Step 2: Verify Migration 1

Run this query to verify columns were added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tutor_applications' 
AND column_name IN ('last_updated_at', 'expires_at');
```

**Expected Result:**
```
column_name       | data_type
------------------+--------------------------------
last_updated_at   | timestamp with time zone
expires_at        | timestamp with time zone

-- Done
```

---

## Step 3: Apply Migration 2 - Setup Cron Job

### ⚠️ IMPORTANT: Requires Admin Access

This must be run with a **service role** or **admin** account in Supabase.

1. Go to **SQL Editor**
2. Make sure you're logged in as **admin**
3. Click **"New Query"**
4. Copy and paste the SQL below
5. Click **Run**

```sql
-- Enable pg_cron extension (requires admin access)
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
  '0 2 * * *',
  'SELECT public.delete_expired_drafts();'
);

-- Done
```

### Expected Output:
- ✅ `CREATE EXTENSION` (if not exists)
- ✅ `GRANT` statements
- ✅ `SELECT` for unschedule
- ✅ `SELECT` for schedule (returns job ID)

---

## Step 4: Verify Migration 2

Run this query to check if cron job was created:

```sql
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'delete-expired-tutor-drafts';
```

**Expected Result:**
```
jobid | jobname                      | schedule  | command
------+------------------------------+-----------+---------------------------
  XX  | delete-expired-tutor-drafts  | 0 2 * * * | SELECT public.delete_expired_drafts();
```

---

## Step 5: Test Cleanup Function (Manual)

### Run the cleanup function manually:

```sql
SELECT public.delete_expired_drafts();
```

This will delete any drafts that have already expired.

### View drafts that will be deleted:

```sql
SELECT id, user_id, full_name, expires_at 
FROM public.tutor_applications 
WHERE status = 'draft' AND expires_at < now();
```
-- Done 
---

## Step 6: Verify Complete Setup

Run all checks:

```sql
-- Check columns exist
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'tutor_applications' 
  AND column_name = 'expires_at'
) as columns_exist;

-- Check function exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'delete_expired_drafts'
) as function_exists;

-- Check index exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.statistics 
  WHERE table_name = 'tutor_applications' 
  AND index_name = 'idx_draft_expiry'
) as index_exists;

-- Check cron job exists
SELECT EXISTS (
  SELECT 1 FROM cron.job 
  WHERE jobname = 'delete-expired-tutor-drafts'
) as cron_job_exists;

-- Done
```

**Expected Result:** All `true`

---

## Troubleshooting

### Issue: "Permission denied" when running cron setup

**Solution:**  
Make sure you're using an **admin** or **service role** account in Supabase.

Steps:
1. Go to Supabase Dashboard → Project Settings
2. Verify you're in the right project
3. Try using the Supabase API with service role key instead

### Issue: Cron job not found after creation

**Solution:**  
Wait a few seconds and run the verification query again. If still not found:

```sql
-- Check for any cron-related errors
SELECT * FROM cron.job;

-- Try creating it again
SELECT cron.schedule(
  'delete-expired-tutor-drafts',
  '0 2 * * *',
  'SELECT public.delete_expired_drafts();'
);
```

### Issue: "Function delete_expired_drafts does not exist"

**Solution:**  
Make sure Migration 1 was applied successfully. Check:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'delete_expired_drafts';
```

If not found, re-run Migration 1.

### Issue: Cron job running but not deleting drafts

**Solution:**  
Check the cron logs in Supabase (if available):

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'delete-expired-tutor-drafts')
ORDER BY start_time DESC LIMIT 10;
```

Or manually test the function:

```sql
-- Check drafts before
SELECT COUNT(*) FROM public.tutor_applications 
WHERE status = 'draft' AND expires_at < now();

-- Run cleanup
SELECT public.delete_expired_drafts();

-- Check drafts after (should be fewer)
SELECT COUNT(*) FROM public.tutor_applications 
WHERE status = 'draft' AND expires_at < now();
```

---

## Cron Job Scheduling Reference

The cron schedule format is: `minute hour day month day_of_week`

### Common Examples:

| Schedule | Meaning |
|----------|---------|
| `0 2 * * *` | Daily at 2 AM UTC |
| `0 0 * * *` | Daily at midnight UTC |
| `*/30 * * * *` | Every 30 minutes |
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |
| `0 0 1 * *` | Monthly (1st of month) |
| `0 0 * * 0` | Weekly (Sundays) |

To change the schedule, delete and recreate:

```sql
SELECT cron.unschedule('delete-expired-tutor-drafts');

SELECT cron.schedule(
  'delete-expired-tutor-drafts',
  '0 3 * * *',  -- Change to desired time
  'SELECT public.delete_expired_drafts();'
);
```

---

## Reverting Migrations (if needed)

### Remove Cron Job:
```sql
SELECT cron.unschedule('delete-expired-tutor-drafts');
```

### Remove Function:
```sql
DROP FUNCTION IF EXISTS public.delete_expired_drafts();
```

### Remove Index:
```sql
DROP INDEX IF EXISTS idx_draft_expiry;
```

### Remove Columns:
```sql
ALTER TABLE public.tutor_applications
DROP COLUMN IF EXISTS last_updated_at,
DROP COLUMN IF EXISTS expires_at;
```

---

## Monitoring the Cron Job

### Check when cron job last ran:
```sql
SELECT start_time, end_time, status 
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'delete-expired-tutor-drafts')
ORDER BY start_time DESC LIMIT 5;
```

### Disable the cron job temporarily:
```sql
UPDATE cron.job 
SET active = false 
WHERE jobname = 'delete-expired-tutor-drafts';
```

### Re-enable the cron job:
```sql
UPDATE cron.job 
SET active = true 
WHERE jobname = 'delete-expired-tutor-drafts';
```

---

## Summary

After completing all steps, you'll have:

✅ Two new columns: `last_updated_at` and `expires_at`  
✅ Cleanup function: `public.delete_expired_drafts()`  
✅ Database index: `idx_draft_expiry`  
✅ Daily cron job: Runs cleanup at 2 AM UTC  

All features are now ready to use!

---

**Last Updated:** February 22, 2026
