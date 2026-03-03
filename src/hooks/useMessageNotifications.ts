/**
 * useMessageNotifications Hook
 * 
 * Handles real-time message subscriptions for both Admin and Student roles
 * - Manages a single subscription per user
 * - Updates unread counts dynamically
 * - Plays notification sounds with debouncing
 * - Properly cleans up on unmount
 * - No memory leaks or duplicate subscriptions
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { playNotificationSound } from '@/lib/notificationSound';
import {
  fetchUnreadCounts,
  fetchAdminUnreadCountsByApplication,
  fetchUnreadCountForApplication,
  IncomingMessage,
} from '@/lib/notificationService';
import { logger } from '@/lib/logger';

export interface MessageNotificationCallbacks {
  onUnreadCountUpdate?: (count: number) => void;
  onApplicationUnreadUpdate?: (applicationId: string, count: number) => void;
  onNewMessage?: (message: IncomingMessage) => void;
}

/**
 * Hook for managing message notifications
 * 
 * @param callbacks - Optional callbacks for handling notification events
 * @param enabled - Whether to enable notifications (default: true)
 * 
 * @returns Object with current unread count and utility functions
 */
export const useMessageNotifications = (
  callbacks?: MessageNotificationCallbacks,
  enabled: boolean = true
) => {
  const { user, isAdmin } = useAuth();
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const unreadCountRef = useRef<number>(0);
  const appUnreadCountsRef = useRef<Record<string, number>>({});
  const lastSoundTimeRef = useRef<number>(0);
  const lastProcessedMessageRef = useRef<Set<string>>(new Set());

  /**
   * Handle incoming message from realtime subscription
   */
  const handleIncomingMessage = useCallback(
    async (message: IncomingMessage) => {
      if (!user?.id) return;

      try {
        // Prevent duplicate processing of the same message
        if (lastProcessedMessageRef.current.has(message.id)) {
          return;
        }
        lastProcessedMessageRef.current.add(message.id);

        // Clear old messages from tracking (keep last 100)
        if (lastProcessedMessageRef.current.size > 100) {
          const arr = Array.from(lastProcessedMessageRef.current);
          lastProcessedMessageRef.current = new Set(arr.slice(-100));
        }

        logger.log('New message received:', {
          messageId: message.id,
          sender: message.sender_id,
          receiver: message.receiver_id,
        });

        // Only process if message is intended for current user
        if (message.receiver_id !== user.id) {
          logger.log('Message not for current user, skipping');
          return;
        }

        // Only process if not sent by self
        if (message.sender_id === user.id) {
          logger.log('Self-sent message, not playing sound');
          return;
        }

        // Play notification sound immediately without waiting
        playNotificationSound();

        // Call custom callback
        if (callbacks?.onNewMessage) {
          callbacks.onNewMessage(message);
        }

        // Update unread counts based on role
        if (isAdmin) {
          // Admin: update per-application count
          const appId = message.application_id;
          const count = await fetchUnreadCountForApplication(appId, user.id);
          appUnreadCountsRef.current[appId] = count;
          if (callbacks?.onApplicationUnreadUpdate) {
            callbacks.onApplicationUnreadUpdate(appId, count);
          }
        } else {
          // Student: update total count
          const counts = await fetchUnreadCounts(user.id, false);
          unreadCountRef.current = counts.total;
          if (callbacks?.onUnreadCountUpdate) {
            callbacks.onUnreadCountUpdate(counts.total);
          }
        }
      } catch (error) {
        logger.error('Error handling incoming message:', error);
      }
    },
    [user?.id, isAdmin, callbacks]
  );

  /**
   * Initialize or reinitialize subscription
   */
  const initializeSubscription = useCallback(() => {
    if (!user?.id || !enabled) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      logger.log('Removing existing message subscription');
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    logger.log('Initializing message subscription for user:', user.id);

    try {
      const channel = supabase
        .channel(`realtime-messages-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          (payload) => {
            const message = payload.new as IncomingMessage;
            handleIncomingMessage(message);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.log('Message subscription established');
          } else if (status === 'CHANNEL_ERROR') {
            logger.error('Message subscription channel error');
          } else if (status === 'CLOSED') {
            logger.log('Message subscription closed');
          }
        });

      subscriptionRef.current = channel;
    } catch (error) {
      logger.error('Failed to initialize message subscription:', error);
    }
  }, [user?.id, enabled, handleIncomingMessage]);

  /**
   * Load initial unread counts on mount
   */
  const loadInitialCounts = useCallback(async () => {
    if (!user?.id) return;

    try {
      if (isAdmin) {
        const counts = await fetchAdminUnreadCountsByApplication(user.id);
        appUnreadCountsRef.current = counts;
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        if (callbacks?.onUnreadCountUpdate) {
          callbacks.onUnreadCountUpdate(total);
        }
      } else {
        const counts = await fetchUnreadCounts(user.id, false);
        unreadCountRef.current = counts.total;
        appUnreadCountsRef.current = counts.byApplication;
        if (callbacks?.onUnreadCountUpdate) {
          callbacks.onUnreadCountUpdate(counts.total);
        }
      }
    } catch (error) {
      logger.error('Failed to load initial unread counts:', error);
    }
  }, [user?.id, isAdmin, callbacks]);

  /**
   * Setup subscription on mount and cleanup on unmount
   */
  useEffect(() => {
    loadInitialCounts();
    initializeSubscription();

    return () => {
      if (subscriptionRef.current) {
        logger.log('Cleaning up message subscription');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, enabled, initializeSubscription, loadInitialCounts]);

  /**
   * Listen to visibility changes to enable/disable sound
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.log('Page became visible');
      } else {
        logger.log('Page became hidden');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    unreadCount: unreadCountRef.current,
    applicationUnreadCounts: appUnreadCountsRef.current,
    reloadCounts: loadInitialCounts,
  };
};

export default useMessageNotifications;
