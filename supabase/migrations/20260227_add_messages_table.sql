-- Migration: Add messages table for internal messaging
-- Run in Supabase SQL editor with appropriate privileges

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES tutor_applications(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('ADMIN','STUDENT')),
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  message_body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_application_id ON messages(application_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Admins can select/insert/manage messages
CREATE POLICY "Admins can manage messages" ON messages FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Students can select messages related to their applications and insert messages for their application
CREATE POLICY "Students can view own application messages" ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tutor_applications ta WHERE ta.id = application_id AND ta.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Students can insert messages for own application" ON messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tutor_applications ta WHERE ta.id = application_id AND ta.user_id = auth.uid()
  )
);

-- Prevent updates/deletes by regular users (messages are immutable). Admins can manage (covered by ALL policy for admins above).
CREATE POLICY "Prevent updates/deletes for non-admins" ON messages FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Prevent deletes for non-admins" ON messages FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Grant minimal privileges
GRANT SELECT ON messages TO anon, authenticated;
GRANT INSERT ON messages TO authenticated;
