/**
 * Notification service helpers
 * Handles unread counts, message reads, and data queries
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface UnreadCounts {
  total: number;
  byApplication: Record<string, number>;
}

export interface IncomingMessage {
  id: string;
  application_id: string;
  sender_id: string;
  receiver_id: string;
  receiver_role?: string;
  message_body: string;
  created_at: string;
  is_read: boolean;
}

/**
 * Fetch all unread messages for a user
 * Returns total count and breakdown by application
 */
export const fetchUnreadCounts = async (
  userId: string,
  isAdmin: boolean = false
): Promise<UnreadCounts> => {
  try {
    const query = supabase
      .from('messages')
      .select('id, application_id', { count: 'exact' })
      .eq('receiver_id', userId)
      .eq('is_read', false);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch unread counts:', error);
      return { total: 0, byApplication: {} };
    }

    const byApplication: Record<string, number> = {};
    (data || []).forEach((msg: any) => {
      const appId = msg.application_id;
      byApplication[appId] = (byApplication[appId] || 0) + 1;
    });

    return {
      total: count || 0,
      byApplication,
    };
  } catch (err) {
    logger.error('Error fetching unread counts:', err);
    return { total: 0, byApplication: {} };
  }
};

/**
 * Fetch unread count for a specific application
 */
export const fetchUnreadCountForApplication = async (
  applicationId: string,
  userId: string
): Promise<number> => {
  try {
    const { data, error, count } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('application_id', applicationId)
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.error(`Failed to fetch unread count for app ${applicationId}:`, error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    logger.error(`Error fetching unread count for app ${applicationId}:`, err);
    return 0;
  }
};

/**
 * Mark messages as read for a specific application
 */
export const markApplicationMessagesAsRead = async (
  applicationId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('application_id', applicationId)
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.error(`Failed to mark messages as read for app ${applicationId}:`, error);
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`Error marking messages as read for app ${applicationId}:`, err);
    return false;
  }
};

/**
 * Mark a specific message as read
 */
export const markMessageAsRead = async (messageId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .eq('is_read', false);

    if (error) {
      logger.error(`Failed to mark message ${messageId} as read:`, error);
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`Error marking message ${messageId} as read:`, err);
    return false;
  }
};

/**
 * Fetch unread message count for admin across all applications
 */
export const fetchAdminUnreadCount = async (
  adminId: string
): Promise<number> => {
  try {
    const { error, count } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('receiver_id', adminId)
      .eq('is_read', false);

    if (error) {
      logger.error('Failed to fetch admin unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    logger.error('Error fetching admin unread count:', err);
    return 0;
  }
};

/**
 * Fetch unread counts per application for admin
 */
export const fetchAdminUnreadCountsByApplication = async (
  adminId: string
): Promise<Record<string, number>> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('application_id')
      .eq('receiver_id', adminId)
      .eq('is_read', false);

    if (error) {
      logger.error('Failed to fetch admin unread counts by application:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((msg: any) => {
      const appId = msg.application_id;
      counts[appId] = (counts[appId] || 0) + 1;
    });

    return counts;
  } catch (err) {
    logger.error('Error fetching admin unread counts by application:', err);
    return {};
  }
};
