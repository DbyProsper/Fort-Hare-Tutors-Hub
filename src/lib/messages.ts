import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface MessageRow {
  id: string;
  application_id: string;
  sender_id: string;
  sender_role: 'ADMIN' | 'STUDENT';
  receiver_role: 'ADMIN' | 'STUDENT';
  receiver_id: string;
  subject: string | null;
  message_body: string;
  is_read: boolean;
  created_at: string;
}

export const fetchMessages = async (applicationId: string): Promise<MessageRow[]> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch messages:', error);
      return [];
    }

    return (data as MessageRow[]) || [];
  } catch (err) {
    logger.error('Error fetching messages:', err);
    return [];
  }
};

export const sendMessage = async (payload: {
  application_id: string;
  sender_id: string;
  sender_role: 'ADMIN' | 'STUDENT';
  receiver_id: string;
  subject?: string | null;
  message_body: string;
}): Promise<boolean> => {
  try {
    // derive receiver_role deterministically from sender_role
    const receiver_role = payload.sender_role === 'STUDENT' ? 'ADMIN' : 'STUDENT';
    const { error } = await supabase
      .from('messages')
      .insert({
        application_id: payload.application_id,
        sender_id: payload.sender_id,
        sender_role: payload.sender_role,
        receiver_id: payload.receiver_id,
        receiver_role,
        subject: payload.subject || null,
        message_body: payload.message_body,
        is_read: false,
      });

    if (error) {
      logger.error('Failed to send message:', error);
      return false;
    }

    // optional email notification bridge
    // we don't include the full message body for privacy
    // this is a stub: real implementation can call an edge function or third-party service
    try {
      // Example: await sendEmailNotification(receiverEmail, ...)
      logger.log('Email notification would be sent here (stub)');
    } catch (notifyErr) {
      logger.error('Failed to send email notification:', notifyErr);
    }

    return true;
  } catch (err) {
    logger.error('Error sending message:', err);
    return false;
  }
};

export const markMessagesRead = async (applicationId: string, receiverId: string, forAdmin: boolean = false): Promise<boolean> => {
  try {
    // If admin is opening the application conversation, mark any messages where receiver_role = 'ADMIN' for that application
    if (forAdmin) {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('application_id', applicationId)
        .eq('receiver_role', 'ADMIN')
        .eq('is_read', false);
      if (error) {
        logger.error('Failed to mark admin messages read:', error);
        return false;
      }
      return true;
    }

    // Default: mark unread messages explicitly addressed to this receiver for the given application
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('application_id', applicationId)
      .eq('is_read', false)
      .eq('receiver_id', receiverId);

    if (error) {
      logger.error('Failed to mark messages read:', error);
      return false;
    }

    return true;
  } catch (err) {
    logger.error('Error marking messages read:', err);
    return false;
  }
};

export const fetchUnreadCount = async (
  applicationId: string,
  receiverId: string,
  forAdmin: boolean = false
): Promise<number> => {
  try {
    // Admin unread count should be derived from DB truth: messages where receiver_role = 'ADMIN' and is_read = false
    let query = supabase.from('messages').select('id', { count: 'exact' }).eq('is_read', false);
    if (forAdmin) {
      query = query.eq('receiver_role', 'ADMIN');
      // if applicationId provided, narrow to application
      if (applicationId) query = query.eq('application_id', applicationId);
    } else {
      // normal case: count messages explicitly addressed to this receiver for this application
      query = query.eq('receiver_id', receiverId);
      if (applicationId) query = query.eq('application_id', applicationId);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch unread count:', error);
      return 0;
    }
    return (data as any[]).length || 0;
  } catch (err) {
    logger.error('Error fetching unread count:', err);
    return 0;
  }
};
