-- Migration: Allow users to edit their own applications if the status is 'draft' or 'pending', or if an admin has enabled editing.

-- Drop the old policy
DROP POLICY IF EXISTS "Students can update own editable applications" ON public.tutor_applications;

-- Create the new, more permissive policy
CREATE POLICY "Students can update own applications" ON public.tutor_applications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  (status IN ('draft', 'pending'))
  OR
  (edit_enabled = true)
);
