# Autosave Feature Documentation

## Overview

The autosave feature automatically saves form data to the database as users type, without disrupting the user experience. The system includes robust error handling, offline support, and visual feedback.

---

## Architecture

### Components

1. **useAutoSave Hook** (`src/hooks/useAutoSave.ts`)
   - Core logic for debounced saving
   - Handles online/offline states
   - Manages race conditions and throttling
   - Provides save status and monitoring

2. **SaveStatusIndicator Component** (`src/components/SaveStatusIndicator.tsx`)
   - Non-intrusive UI feedback
   - Shows saving, saved, error, and offline states
   - Uses Tailwind CSS for styling
   - Displays icons and status messages

3. **Integration in Apply.tsx**
   - Watches form changes
   - Passes form data to useAutoSave
   - Displays status indicator in header
   - Keeps existing "Save Draft" button

---

## useAutoSave Hook

### Usage

```typescript
const { saveStatus, isSaving, isOnline } = useAutoSave({
  userId: user?.id,
  applicationId: applicationId || undefined,
  formData: formValues,
  debounceMs: 900,      // Wait 900ms after user stops typing
  enabled: !!user && !!applicationId && form.formState.isDirty,
});
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | `string \| undefined` | - | Current user ID (from Auth context) |
| `applicationId` | `string \| undefined` | - | Application ID to update |
| `formData` | `Record<string, any>` | - | Form values to save (use `form.watch()`) |
| `debounceMs` | `number` | 900 | Delay before saving (in ms) |
| `enabled` | `boolean` | true | Enable/disable autosave |

### Return Value

```typescript
{
  saveStatus: {
    status: 'idle' | 'saving' | 'saved' | 'error' | 'offline',
    message: string,
    timestamp?: number
  },
  isSaving: boolean,      // True when actively saving
  isOnline: boolean       // Current network status
}
```

### Save Status States

- **idle**: No active operation
- **saving**: Currently saving to database
- **saved**: Successfully saved (auto-clears after 3s)
- **error**: Save failed (auto-clears after 3s)
- **offline**: No internet connection

---

## Key Features

### 1. Debounced Saving

- Waits 800-1000ms after user stops typing
- Prevents excessive database writes
- Example: User types full name → 900ms delay → save triggers

```typescript
// Automatic with debounceMs parameter
const { saveStatus } = useAutoSave({
  // ...
  debounceMs: 900,  // Custom delay
});
```

### 2. Change Detection

- Only saves if data actually changed
- Compares new data with previously saved data
- Prevents unnecessary requests

```typescript
// Built-in: previousDataRef tracks last saved state
const hasChanged = JSON.stringify(previousDataRef.current) !== 
                   JSON.stringify(formData);
if (!hasChanged) return; // Skip save
```

### 3. Throttling

- Prevents more than 1 save every 2 seconds
- Protects against rapid successive changes
- Balances responsiveness with safety

```typescript
const now = Date.now();
if (now - lastSaveTimeRef.current < 2000) {
  return; // Wait before saving again
}
```

### 4. Offline Support

- Detects network status via `navigator.onLine`
- Falls back to localStorage when offline
- Syncs to database when connection resumes
- Gracefully handles network events

```typescript
if (!isOnline) {
  setSaveStatus({ status: 'offline', message: 'Offline – changes not saved' });
  saveToLocalStorage();
  return;
}
```

### 5. Race Condition Prevention

- Uses `isSavingRef` flag to prevent concurrent saves
- Only one save operation at a time
- Ensures data consistency

```typescript
if (isSavingRef.current) return; // Already saving
isSavingRef.current = true;
try {
  // Save operation
} finally {
  isSavingRef.current = false;
}
```

### 6. Database Upsert

- Uses Supabase `upsert()` for create/update
- Identified by `id` (applicationId)
- Always saves as `status: 'draft'`
- Respects existing submitted applications

```typescript
const { error } = await supabase
  .from('tutor_applications')
  .upsert(applicationData, { onConflict: 'id' });
```

---

## Integration in Apply.tsx

### Step 1: Import

```typescript
import { useAutoSave } from '@/hooks/useAutoSave';
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator';
```

### Step 2: Initialize Hook

```typescript
const Apply = () => {
  // ... existing code ...
  
  const formValues = form.watch();  // Get all form values

  const { saveStatus } = useAutoSave({
    userId: user?.id,
    applicationId: applicationId || undefined,
    formData: formValues,
    debounceMs: 900,
    enabled: !!user && !!applicationId && form.formState.isDirty,
  });
```

### Step 3: Display Status

```tsx
<SaveStatusIndicator 
  status={saveStatus.status} 
  message={saveStatus.message} 
/>
```

### Full Example Section

```tsx
return (
  <div className="min-h-screen bg-muted/30">
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          {/* Logo */}
        </Link>
        <div className="flex items-center gap-2">
          <Button onClick={handleSaveDraft} disabled={isSaving}>
            Save Draft
          </Button>
        </div>
      </div>
    </header>

    <div className="container mx-auto px-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Step {currentStep} of 5</span>
        <div className="flex items-center gap-4">
          {/* Autosave indicator */}
          <SaveStatusIndicator 
            status={saveStatus.status} 
            message={saveStatus.message} 
          />
          <span className="text-sm text-muted-foreground">
            {Math.round(progress)}% complete
          </span>
        </div>
      </div>
    </div>

    {/* Form continues below */}
  </div>
);
```

---

## Database Field Mapping

The useAutoSave hook automatically maps form fields to database columns:

```typescript
{
  full_name: formData.full_name,
  student_number: formData.student_number,
  date_of_birth: formData.date_of_birth,
  nationality: formData.nationality,
  residential_address: formData.residential_address,
  contact_number: formData.contact_number,
  degree_program: formData.degree_program,
  faculty: formData.faculty,
  department: formData.department,
  year_of_study: formData.year_of_study,
  subjects_completed: Array (split from string if needed),
  subjects_to_tutor: Array (split from string if needed),
  skills_competencies: Array (split from string if needed),
  languages_spoken: Array (split from string if needed),
  previous_tutoring_experience: formData.previous_tutoring_experience,
  work_experience: formData.work_experience,
  availability: formData.availability,
  motivation_letter: formData.motivation_letter,
  status: 'draft',  // Always draft via autosave
  updated_at: ISO timestamp
}
```

---

## Error Handling

### Failed Save

When a save fails:
1. Displays "Failed to save" message
2. Automatically stores data in localStorage
3. Message auto-clears after 3 seconds
4. User can retry manually with "Save Draft" button

```typescript
try {
  // Save attempt
} catch (error) {
  logger.error('Autosave failed:', error);
  setSaveStatus({ status: 'error', message: 'Failed to save' });
  saveToLocalStorage();  // Fallback
  setTimeout(() => {
    setSaveStatus({ status: 'idle', message: '' });
  }, 3000);
}
```

### Offline Mode

When offline:
1. Displays "Offline – changes not saved"
2. Stores data in localStorage
3. Automatically retries when online
4. No error message, non-intrusive

```typescript
if (!isOnline) {
  setSaveStatus({ status: 'offline', message: 'Offline – changes not saved' });
  saveToLocalStorage();
  return;
}
```

---

## Performance Considerations

### Debouncing
- **Default**: 900ms (9/10 of a second)
- **User Types "John"**: 
  - 'J' → wait 900ms
  - 'o' → reset timer, wait 900ms
  - 'h' → reset timer, wait 900ms
  - 'n' → reset timer, wait 900ms
  - (stop typing) → 900ms elapsed → save once

### Throttling
- Prevents saving more than once per 2 seconds
- Protects against rapid successive saves
- User still sees "Saving..." → "Saved" feedback

### Memory
- Minimal state tracking
- Uses refs for non-rendering values
- Clears localStorage on successful sync

---

## Testing Recommendations

### Manual Testing

1. **Basic Autosave**
   - Type in form fields
   - Observe "Saving..." → "All changes saved"
   - Check database for updates

2. **Offline Mode**
   - Open DevTools → Network → Offline
   - Type in form fields
   - Observe "Offline – changes not saved"
   - Go back online → watch sync occur
   - Check localStorage in DevTools

3. **Concurrent Saves**
   - Rapidly switch between form fields
   - Verify only one save request at a time
   - Check Network tab

4. **Error Handling**
   - Use DevTools to block network
   - Try saving → should show error
   - Data should be in localStorage
   - Fix network → manually save → should sync

### Automated Testing (Jest Example)

```typescript
describe('useAutoSave', () => {
  it('should save after debounce delay', async () => {
    jest.useFakeTimers();
    const mockSave = jest.fn();
    
    // Simulate typing
    act(() => {
      rerender({ formData: { name: 'J' } });
      jest.advanceTimersByTime(900);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });

  it('should detect offline status', () => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false
    });
    // Assert offline state
  });
});
```

---

## Customization

### Custom Debounce Delay

```typescript
const { saveStatus } = useAutoSave({
  // ... other props
  debounceMs: 1500,  // Save after 1.5 seconds
});
```

### Disable Autosave Conditionally

```typescript
const { saveStatus } = useAutoSave({
  // ... other props
  enabled: !!user && !!applicationId && form.formState.isDirty && !isSubmitting,
});
```

### Custom Status Messages

Edit `SaveStatusIndicator.tsx`:

```typescript
const statusConfig = {
  saving: {
    message: 'Syncing your changes...',  // Custom message
    color: 'text-blue-600',
    icon: Loader2,
  },
  // ...
};
```

---

## Integrating into Other Forms

### Apply to EditApplication.tsx

```typescript
import { useAutoSave } from '@/hooks/useAutoSave';
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator';

const EditApplication = () => {
  const form = useForm<ApplicationFormData>({ /* ... */ });
  const formValues = form.watch();

  const { saveStatus } = useAutoSave({
    userId: user?.id,
    applicationId: applicationId,  // Required here
    formData: formValues,
    debounceMs: 900,
    enabled: !!user && !!applicationId && form.formState.isDirty,
  });

  return (
    <>
      <SaveStatusIndicator status={saveStatus.status} message={saveStatus.message} />
      {/* Form UI */}
    </>
  );
};
```

### Apply to Other Pages

The hook works with any form that has:
1. User ID (from auth context)
2. Application ID (or any unique identifier)
3. Form data object (from `form.watch()`)
4. React Hook Form integration

---

## Troubleshooting

### "Autosave not triggering"

**Check:**
- Is `enabled` prop true?
- Does `applicationId` exist?
- Is user authenticated?
- Has form data actually changed?

**Solution:**
```typescript
const { saveStatus } = useAutoSave({
  userId: user?.id,
  applicationId: applicationId || undefined,  // Must be defined
  formData: formValues,
  debounceMs: 900,
  enabled: !!user && !!applicationId && form.formState.isDirty,  // All true?
});
```

### "Getting 'offline' message but I'm online"

**Cause:** Browser has poor network detection

**Solution:** 
```typescript
// Force online check via Supabase
const testOnline = async () => {
  try {
    await supabase.from('tutor_applications').select('id').limit(1);
    setIsOnline(true);
  } catch {
    setIsOnline(false);
  }
};
```

### "Data stuck in localStorage"

**Check localStorage:**
```javascript
// In browser console
localStorage.getItem('autosave_[userId]_[appId]')
```

**Clear manually:**
```javascript
localStorage.removeItem('autosave_[userId]_[appId]')
```

### "Duplicate saves occurring"

**Check:**
- Network tab in DevTools
- Should see only 1 request per 2 seconds minimum
- If more, increase `debounceMs`

---

## Future Enhancements

1. **Sync on Window Focus**
   - Auto-sync when user switches back to browser tab
   - Ensures latest data is saved

2. **Conflict Resolution**
   - Handle simultaneous edits across devices
   - Last-write-wins or merge strategy

3. **Partial Field Save**
   - Track which fields changed
   - Only send changed fields to database
   - Reduces bandwidth

4. **Progressive Sync**
   - Queue saves offline
   - Batch sync when online
   - Prevents data loss

5. **User Notification**
   - Toast when autosave fails
   - Option to retry or cancel
   - Better UX for power users

---

## Summary

The autosave feature provides a seamless, production-ready experience for users filling out long forms. It automatically saves progress without disruption, handles offline scenarios gracefully, and maintains data integrity through race condition prevention and error handling.

**Key Benefits:**
- ✅ No data loss from browser crashes
- ✅ Seamless save experience
- ✅ Offline support with localStorage
- ✅ Non-intrusive feedback
- ✅ Zero configuration needed
- ✅ Works with existing "Save Draft" button
