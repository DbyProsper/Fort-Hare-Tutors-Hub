# SQL Migration Checklist for Production Fixes

Run this SQL migration in Supabase SQL editor to enable all fixes:

## Step 1: Add Columns to Tables

```sql
-- Add is_editable to tutor_applications
ALTER TABLE IF EXISTS public.tutor_applications
ADD COLUMN IF NOT EXISTS is_editable boolean NOT NULL DEFAULT false;

-- Add receiver_role to messages
ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS receiver_role text DEFAULT 'ADMIN';
```

## Step 2: Populate Existing Messages

```sql
-- For existing messages, derive receiver_role from sender_role
UPDATE public.messages
SET receiver_role = CASE 
  WHEN sender_role = 'STUDENT' THEN 'ADMIN' 
  ELSE 'STUDENT' 
END
WHERE receiver_role IS NULL;
```

## Step 3: Add Constraints

```sql
-- Ensure receiver_role follows valid values
ALTER TABLE public.messages
ADD CONSTRAINT messages_receiver_role_check CHECK (receiver_role IN ('ADMIN','STUDENT'));
```

## Step 4: Update RLS Policies

Drop old policy and create new one:

```sql
-- Drop the old policy that only checked status
DROP POLICY IF EXISTS "Students can update own draft applications" ON public.tutor_applications;

-- Create new policy that checks is_editable flag
CREATE POLICY "Students can update own editable applications" ON public.tutor_applications FOR UPDATE
USING (auth.uid() = user_id AND is_editable = true);
```

## Step 5: Verify Changes

```sql
-- Check is_editable column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tutor_applications' AND column_name = 'is_editable';

-- Check receiver_role column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'messages' AND column_name = 'receiver_role';

-- Verify no NULLs exist in receiver_role
SELECT COUNT(*) as null_receiver_roles FROM public.messages WHERE receiver_role IS NULL;

-- Check policy exists
SELECT polname, polcmd, polroles 
FROM pg_policy 
WHERE relname = 'tutor_applications' 
AND polname = 'Students can update own editable applications';
```

## Step 6: Create Indexes (Optional, for Performance)

```sql
-- Index for admin unread count queries
CREATE INDEX IF NOT EXISTS idx_messages_receiver_role_is_read 
ON public.messages(receiver_role, is_read) 
WHERE receiver_role = 'ADMIN' AND is_read = false;

-- Index for application-specific message queries
CREATE INDEX IF NOT EXISTS idx_messages_app_receiver_role 
ON public.messages(application_id, receiver_role, is_read);

-- Index for edit permission checks
CREATE INDEX IF NOT EXISTS idx_applications_user_is_editable 
ON public.tutor_applications(user_id, is_editable);
```

## Step 7: Test the Migration

After running migration, test:

```sql
-- Test 1: Verify a message's receiver_role
SELECT id, sender_role, receiver_role, message_body 
FROM public.messages 
ORDER BY created_at DESC 
LIMIT 1;

-- Test 2: Count unread admin messages
SELECT COUNT(*) as unread_admin_messages 
FROM public.messages 
WHERE receiver_role = 'ADMIN' AND is_read = false;

-- Test 3: Verify RLS policy
INSERT INTO public.messages (
  id, application_id, sender_id, sender_role, receiver_id, receiver_role, 
  message_body, is_read, created_at
) VALUES (
  gen_random_uuid(),
  'test-app-id',
  (SELECT auth.uid()),
  'STUDENT',
  'test-admin-id',
  'ADMIN',
  'Test message',
  false,
  now()
);
-- This should succeed; receiver_role is correctly set

-- Test 4: Try to update application with is_editable = false (should fail)
-- This will require a test user; RLS should block the update
```

## Rollback Plan (if needed)

```sql
-- Remove is_editable column
ALTER TABLE public.tutor_applications DROP COLUMN IF EXISTS is_editable;

-- Remove receiver_role column
ALTER TABLE public.messages DROP COLUMN IF EXISTS receiver_role;

-- Restore old policy
DROP POLICY IF EXISTS "Students can update own editable applications" ON public.tutor_applications;

CREATE POLICY "Students can update own draft applications" ON public.tutor_applications FOR UPDATE
USING (auth.uid() = user_id AND status IN ('draft', 'pending'));

-- Drop new indexes
DROP INDEX IF EXISTS idx_messages_receiver_role_is_read;
DROP INDEX IF EXISTS idx_messages_app_receiver_role;
DROP INDEX IF EXISTS idx_applications_user_is_editable;
```

## Frontend Configuration

No additional configuration needed. Frontend code automatically:
- Syncs `is_editable` flag when admin toggles "Allow student to edit"
- Derives `receiver_role` when sending messages
- Queries unread counts using `receiver_role = 'ADMIN'` for admin users
- Marks messages read by `receiver_role` for admins, by `receiver_id` for students

---

## Deployment Order

1. **Backup database** (Supabase auto-backups, but good to verify)
2. **Run SQL migration** above
3. **Verify migration** using test queries
4. **Deploy frontend code** (all modified .tsx files)
5. **Test with sample data** per "Testing Checklist" in PRODUCTION_FIXES_COMPLETE.md
6. **Monitor admin/student workflows** for 24 hours
7. **Notify stakeholders** of changes

---

## Timeline

- Migration script runtime: < 1 second
- Frontend deployment: < 2 minutes
- Total downtime: 0 minutes (no downtime required)
- Safe to deploy during business hours

---

## Support

If issues arise:
1. Check error logs in Supabase dashboard
2. Verify RLS policies with `pg_policy` query (step 5)
3. Review application logs for `console.error` entries
4. Use rollback plan to restore previous state if critical issues occur
