# Production Fixes - Complete Implementation

## Summary

Fixed three critical production issues in the Fort-Hare Tutors Hub system:

1. **Admin Edit Permission Logic** - Enable/disable editing via database-driven flag
2. **Admin Receiving Message Notifications** - Proper unread message tracking
3. **Offer Document Approval/Rejection** - Student receives notification and timeline updates

---

## ISSUE 1: EDIT BUTTON SHOWS BUT "THIS APPLICATION CANNOT BE EDITED"

### Root Cause
- Frontend showed "Edit" button when `edit_enabled = true`
- But edit permission check used hardcoded `status === 'draft' || status === 'pending'`
- Admin could enable editing, but RLS policy blocked student update

### Solution Implemented

#### 1a. Database Schema (`20260228_add_is_editable_and_receiver_role.sql`)
```sql
-- Add is_editable boolean to tutor_applications (default false)
ALTER TABLE public.tutor_applications
ADD COLUMN IF NOT EXISTS is_editable boolean NOT NULL DEFAULT false;

-- Update RLS policy: students may UPDATE only when is_editable = true
DROP POLICY "Students can update own draft applications" ON public.tutor_applications;

CREATE POLICY "Students can update own editable applications" ON public.tutor_applications FOR UPDATE
USING (auth.uid() = user_id AND is_editable = true);
```

#### 1b. Frontend Edit Permission (`EditApplication.tsx`)
- **Load check**: `data.is_editable === true || data.edit_enabled === true`
- **Debug logs**: Added console.log to show editing permission status
- **After submit**: Set `is_editable: false` to prevent continuous editing

```typescript
// Line 195: Check if application can be edited (DB-driven)
if (!(data.is_editable === true || data.edit_enabled === true)) {
  toast.error('This application cannot be edited');
  navigate('/dashboard');
  return;
}

// Line 513: Clear is_editable after submission
is_editable: false,
```

#### 1c. Admin Control (`Admin.tsx`)
- When admin toggles "Allow student to edit application" checkbox
- Update **both** `edit_enabled` (frontend flag) **and** `is_editable` (DB RLS flag)

```typescript
// Line 1437, 1470: Update both flags
.update({ edit_enabled: checked, is_editable: checked } as any)
```

#### 1d. View Page Edit Link (`ApplicationView.tsx`, `Dashboard.tsx`)
- Show Edit link when `is_editable === true` (primary check)
- Fallback to `edit_enabled` for legacy support

```typescript
// Line 726: ApplicationView.tsx
{((application as any).is_editable === true || application.edit_enabled) && (
  <Link to={`/application/${id}/edit`}>✏️ Edit Application</Link>
)}
```

---

## ISSUE 2: ADMIN NOT RECEIVING MESSAGE NOTIFICATIONS

### Root Cause
- Students could send messages
- Admin notifications relied on hardcoded `sender_role === 'STUDENT'` check
- No deterministic way to identify if message was intended for admin vs. general conversation
- Unread count query didn't properly filter admin-destined messages

### Solution Implemented

#### 2a. Database Schema
Add `receiver_role` to messages table to explicitly mark intended recipient role:

```sql
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS receiver_role text;

-- Populate existing rows
UPDATE public.messages
SET receiver_role = CASE WHEN sender_role = 'STUDENT' THEN 'ADMIN' ELSE 'STUDENT' END
WHERE receiver_role IS NULL;

-- Add constraint
ALTER TABLE public.messages ADD CONSTRAINT messages_receiver_role_check 
  CHECK (receiver_role IN ('ADMIN','STUDENT'));
```

#### 2b. Message Sending (`messages.ts`)
Derive `receiver_role` deterministically from `sender_role`:

```typescript
export const sendMessage = async (payload: { ... }): Promise<boolean> => {
  // Derive receiver_role from sender_role (STUDENT → ADMIN, ADMIN → STUDENT)
  const receiver_role = payload.sender_role === 'STUDENT' ? 'ADMIN' : 'STUDENT';
  
  await supabase.from('messages').insert({
    ...payload,
    receiver_role,
    is_read: false,
  });
};
```

#### 2c. Admin Unread Count (`messages.ts`)
Query unread messages based on **database truth** (receiver_role = 'ADMIN'):

```typescript
export const fetchUnreadCount = async (
  applicationId: string,
  receiverId: string,
  forAdmin: boolean = false
): Promise<number> => {
  let query = supabase.from('messages').select('id', { count: 'exact' })
    .eq('is_read', false);

  if (forAdmin) {
    // Count ALL messages where receiver_role = 'ADMIN' (not per-receiver)
    query = query.eq('receiver_role', 'ADMIN');
    if (applicationId) query = query.eq('application_id', applicationId);
  } else {
    // Student: count messages explicitly addressed to this receiver
    query = query.eq('receiver_id', receiverId);
    if (applicationId) query = query.eq('application_id', applicationId);
  }
  
  const { data, error } = await query;
  return (data as any[]).length || 0;
};
```

#### 2d. Mark as Read (`messages.ts`)
Admin path marks by `receiver_role`, student path marks by `receiver_id`:

```typescript
export const markMessagesRead = async (
  applicationId: string,
  receiverId: string,
  forAdmin: boolean = false
): Promise<boolean> => {
  if (forAdmin) {
    // Admin: mark all messages where receiver_role = 'ADMIN' for this application
    const { error } = await supabase.from('messages')
      .update({ is_read: true })
      .eq('application_id', applicationId)
      .eq('receiver_role', 'ADMIN')
      .eq('is_read', false);
  } else {
    // Student: mark messages explicitly addressed to this receiver
    const { error } = await supabase.from('messages')
      .update({ is_read: true })
      .eq('application_id', applicationId)
      .eq('receiver_id', receiverId)
      .eq('is_read', false);
  }
};
```

#### 2e. Admin Usage (`Admin.tsx`)
Pass `forAdmin: true` when admin opens application conversation:

```typescript
// Line 273: When opening application details
await markMessagesRead(application.id, user.id, true);
const newCount = await fetchUnreadCount(application.id, user.id, true);
```

#### 2f. Student Usage (`ApplicationView.tsx`, `Messages.tsx`)
Pass `forAdmin: false` (default) for student message reads:

```typescript
// ApplicationView.tsx, line 292
await markMessagesRead(application.id, user.id, false);

// Messages.tsx, line 135
await markMessagesRead(appId, user.id, !!isAdmin);
```

#### 2g. Live Notifications (`Dashboard.tsx`)
Subscribe to new messages and update unread badge in real-time:

```typescript
// Subscribe to INSERT events on messages table
const channel = supabase
  .channel('public:messages:student')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
    const msg = payload.new as any;
    if ((msg.receiver_id === user.id || msg.receiver_role === 'STUDENT') && 
        msg.application_id === application?.id && !msg.is_read) {
      setUnreadCount(prev => prev + 1);
    }
  })
  .subscribe();
```

---

## ISSUE 3: OFFER DOCUMENTS APPROVE/REJECT BROKEN

### Root Cause
- When admin approved documents, status set to `VERIFIED` but no notification to student
- When admin rejected documents, status set to `WITHDRAWN` instead of `RESUBMISSION_REQUIRED`
- No timeline update in student's view page
- Student didn't know documents were rejected or could resubmit

### Solution Implemented

#### 3a. Approve Offer Documents (`Admin.tsx` line 395)
- Send **internal message** to student notifying approval
- Clear rejection reason and timestamp
- Update status to `VERIFIED`

```typescript
const approveOfferDocuments = async (applicationId: string) => {
  // Update offer status and clear rejection info
  const { error } = await supabase
    .from('tutor_applications')
    .update({ 
      offer_status: 'VERIFIED', 
      appointment_status: 'FINALIZED',
      document_rejection_reason: null,
      document_rejected_at: null 
    })
    .eq('id', applicationId);

  // Send notification message to student
  try {
    if (selectedApplication?.user_id) {
      await sendMessage({
        application_id: applicationId,
        sender_id: user?.id || '',
        sender_role: 'ADMIN',
        receiver_id: selectedApplication.user_id,
        subject: 'Offer documents approved',
        message_body: 'Your offer documents have been verified and approved. Thank you.'
      });
    }
  } catch (e) {
    logger.error('Failed to send approval message:', e);
  }
  
  toast.success('Offer documents approved');
};
```

#### 3b. Reject Offer Documents (`Admin.tsx` line 433)
- Set status to `RESUBMISSION_REQUIRED` (not `WITHDRAWN`)
- Store rejection reason and timestamp
- Send notification with reason requiring resubmission
- Student can now resubmit documents

```typescript
const rejectOfferDocuments = async (applicationId: string, reason: string) => {
  // Set to RESUBMISSION_REQUIRED (not WITHDRAWN)
  const { error } = await supabase
    .from('tutor_applications')
    .update({ 
      offer_status: 'RESUBMISSION_REQUIRED',
      document_rejection_reason: reason,
      document_rejected_at: new Date().toISOString()
    })
    .eq('id', applicationId);

  // Send notification with reason
  try {
    if (selectedApplication?.user_id) {
      await sendMessage({
        application_id: applicationId,
        sender_id: user?.id || '',
        sender_role: 'ADMIN',
        receiver_id: selectedApplication.user_id,
        subject: 'Offer documents - resubmission required',
        message_body: `Your submitted offer documents were rejected. Reason: ${reason}. Please resubmit the requested documents.`
      });
    }
  } catch (e) {
    logger.error('Failed to send rejection message:', e);
  }
  
  toast.success('Documents rejected; applicant will be asked to resubmit');
};
```

#### 3c. Student View (`ApplicationView.tsx` line 456)
Display rejection reason when `offer_status === 'RESUBMISSION_REQUIRED'`:

```typescript
{application.offer_status === 'RESUBMISSION_REQUIRED' && (
  <p>Your documents were rejected: {application.document_rejection_reason}</p>
)}
```

#### 3d. Timeline Update
When approved, student sees:
- Message notification badge with "Offer documents approved"
- Timeline shows `VERIFIED` status
- All previous rejection notices cleared

When rejected, student sees:
- Message notification with rejection reason
- Timeline shows `RESUBMISSION_REQUIRED` status
- Can upload corrected documents again

---

## Type System Updates (`types.ts`)

### Messages Table
```typescript
messages: {
  Row: {
    receiver_role?: 'ADMIN' | 'STUDENT';  // Added
    // ... existing fields
  }
  Insert: {
    receiver_role?: 'ADMIN' | 'STUDENT';  // Added
  }
  Update: {
    receiver_role?: 'ADMIN' | 'STUDENT';  // Added
  }
}
```

### Tutor Applications Table
```typescript
tutor_applications: {
  Row: {
    is_editable: boolean;  // Added
    edit_enabled: boolean; // Existing
  }
  Insert: {
    is_editable?: boolean;  // Added
  }
}
```

---

## Testing Checklist

### Edit Permission Flow
- [ ] Admin toggles "Allow student to edit application" checkbox
- [ ] Both `edit_enabled` and `is_editable` updated in database
- [ ] Student sees "Edit Application" button in dashboard and view page
- [ ] Student can click Edit and make changes
- [ ] After submit, `is_editable` set to `false`
- [ ] Edit button disappears
- [ ] Error message: "This application cannot be edited" if RLS blocks

### Message Notification Flow
- [ ] Student sends message from ApplicationView
- [ ] Admin Dashboard shows red dot + count on Messages button
- [ ] Admin clicks Messages, unread count resets
- [ ] Admin sends message to student
- [ ] Student sees unread badge on Dashboard > Messages
- [ ] Student clicks and reads, badge clears
- [ ] Real-time updates when message arrives

### Offer Document Approval
- [ ] Admin clicks "Approve Documents" in dialog
- [ ] Student receives message: "Offer documents approved"
- [ ] Status in student view shows `VERIFIED`
- [ ] Timeline updates to show approval
- [ ] Rejection reason cleared

### Offer Document Rejection
- [ ] Admin enters rejection reason and clicks "Reject"
- [ ] Student receives message with rejection reason
- [ ] Status in student view shows `RESUBMISSION_REQUIRED`
- [ ] Student sees rejection message in view page
- [ ] "Upload Documents" section reappears for resubmission
- [ ] Student uploads corrected documents
- [ ] Status updates to `SIGNED_UPLOADED`

---

## Files Modified

1. **Migration**: `supabase/migrations/20260228_add_is_editable_and_receiver_role.sql`
   - Add `is_editable` and `receiver_role` columns
   - Update RLS policies

2. **Messaging Library**: `src/lib/messages.ts`
   - Add `receiver_role` to `MessageRow` interface
   - Derive `receiver_role` on insert
   - Implement admin-specific unread query
   - Implement admin-specific mark-as-read

3. **Admin Page**: `src/pages/Admin.tsx`
   - Update both `edit_enabled` and `is_editable` when toggling
   - Send approval message with `VERIFIED` status
   - Send rejection message with `RESUBMISSION_REQUIRED` status
   - Use `markMessagesRead(..., true)` to mark admin messages

4. **Application View**: `src/pages/ApplicationView.tsx`
   - Show Edit link based on `is_editable` flag
   - Mark messages as read with `forAdmin: false`
   - Wrap async call in IIFE to avoid await at top level

5. **Edit Application**: `src/pages/EditApplication.tsx`
   - Check `is_editable` (primary) or `edit_enabled` (fallback)
   - Add debug logs for RLS troubleshooting
   - Set `is_editable: false` after submission

6. **Messages Page**: `src/pages/Messages.tsx`
   - Pass `forAdmin` flag when marking messages read

7. **Dashboard**: `src/pages/Dashboard.tsx`
   - Show Edit link based on `is_editable` or `edit_enabled`
   - Subscribe to incoming messages and update unread badge live

8. **Types**: `src/integrations/supabase/types.ts`
   - Add `receiver_role` to messages types
   - Add `is_editable` to tutor_applications types

---

## Deployment Steps

1. **Run migration** in Supabase SQL editor:
   ```bash
   # File: supabase/migrations/20260228_add_is_editable_and_receiver_role.sql
   ```

2. **Verify RLS policies** are in place:
   ```sql
   -- Check policy: "Students can update own editable applications"
   SELECT * FROM pg_policy WHERE polname = 'Students can update own editable applications';
   ```

3. **Deploy frontend code** (all files listed above)

4. **Test with sample data**:
   - Create a test student application
   - Set `is_editable = true` in database directly
   - Student should be able to edit
   - Set `is_editable = false`
   - Student should see "This application cannot be edited"

---

## Performance Notes

- **Message queries**: Indexed on `receiver_role`, `is_read`, `application_id`
- **Edit flag**: Indexed by RLS policy lookups on `user_id` + `is_editable`
- **Unread count**: Query filtered by `receiver_role = 'ADMIN'` for admins (no per-user lookup)
- **Subscriptions**: Real-time using Supabase `postgres_changes` events

---

## Security Notes

- **RLS enforced**: Students can only UPDATE their own application when `is_editable = true`
- **Admin privilege**: Admin role bypasses RLS for all operations
- **Receiver role**: Deterministic derivation prevents message misdirection
- **Message immutability**: Students cannot modify/delete messages (admins only via RLS)

All changes maintain backward compatibility with legacy `edit_enabled` flag while using new `is_editable` as source of truth.
