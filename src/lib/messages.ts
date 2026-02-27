import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface MessageRow {
  id: string;
  application_id: string;
  sender_id: string;
  sender_role: 'ADMIN' | 'STUDENT';
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
    const { error } = await supabase
      .from('messages')
      .insert({
        application_id: payload.application_id,
        sender_id: payload.sender_id,
        sender_role: payload.sender_role,
        receiver_id: payload.receiver_id,
        subject: payload.subject || null,
        message_body: payload.message_body,
        is_read: false,
      });

    if (error) {
      logger.error('Failed to send message:', error);
      return false;
    }

    return true;
  } catch (err) {
    logger.error('Error sending message:', err);
    return false;
  }
};

export const markMessagesRead = async (applicationId: string, receiverId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('application_id', applicationId)
      .eq('receiver_id', receiverId)
      .eq('is_read', false);

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

export const fetchUnreadCount = async (applicationId: string, receiverId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('application_id', applicationId)
      .eq('receiver_id', receiverId)
      .eq('is_read', false);

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
