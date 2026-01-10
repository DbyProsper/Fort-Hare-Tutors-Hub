-- Fix critical privilege escalation vulnerability in user_roles table
-- The current "System can create user roles" policy allows ANY authenticated user to INSERT ANY role

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can create user roles" ON public.user_roles;

-- Create a restrictive policy: only admins can create new roles
-- Note: The handle_new_user trigger function uses SECURITY DEFINER, so it bypasses RLS
-- and can still insert the initial 'student' role for new users
CREATE POLICY "Admins can insert roles" 
  ON public.user_roles 
  FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));