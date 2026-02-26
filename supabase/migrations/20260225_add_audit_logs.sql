-- Migration: Add Audit Logs Table for Admin Actions
-- Run this in Supabase SQL editor with service role/admin

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES tutor_applications(id) ON DELETE CASCADE,
    admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_name text NOT NULL,
    action_type text NOT NULL,
    action_description text,
    timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_application_id ON audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view audit logs for applications they have access to
CREATE POLICY "Admins can view audit logs"
ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- RLS Policy: Only service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON audit_logs FOR INSERT
WITH CHECK (auth.uid() = auth.uid()); -- Service role bypass

-- Audit logs are immutable (no updates or deletes)

-- Grant permissions
GRANT SELECT ON audit_logs TO anon, authenticated;
GRANT INSERT ON audit_logs TO service_role;
