import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { fetchMessages, sendMessage, markMessagesRead, fetchUnreadCount, MessageRow } from '@/lib/messages';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';

interface ConversationSummary {
  application_id: string;
  full_name: string;
  student_number: string;
  user_id?: string; // student's user id
  unread: number;
  lastSubject: string | null;
  lastBody: string | null;
  lastAt: string | null;
}

const Messages = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { setLoading, setMessage } = useLoading();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<MessageRow[]>([]);
  const [newMsgBody, setNewMsgBody] = useState('');
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Real-time notification system
  useMessageNotifications({
    onUnreadCountUpdate: (count) => {
      // Student: update total unread
      if (!isAdmin && conversations.length) {
        setConversations(prev => [{ ...prev[0], unread: count }]);
      }
    },
    onApplicationUnreadUpdate: (appId, count) => {
      // Admin: update unread by application
      if (isAdmin) {
        setConversations(prev =>
          prev.map(c => c.application_id === appId ? { ...c, unread: count } : c)
        );
      }
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      if (isAdmin) {
        loadAdminConversations();
      } else {
        loadStudentConversation();
      }
    }
  }, [user, isAdmin, authLoading]);

  const loadAdminConversations = async () => {
    setLoading(true);
    setMessage('Loading conversations...');
    try {
      const { data: apps } = await supabase
        .from('tutor_applications')
        .select('id, full_name, student_number, user_id')
        .neq('status', 'draft');
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (!apps) return;
      const map: Record<string, ConversationSummary> = {};
      msgs?.forEach(m => {
        if (!map[m.application_id]) {
          const app = apps.find(a => a.id === m.application_id);
          if (!app) return;
          map[m.application_id] = {
            application_id: m.application_id,
            full_name: app.full_name,
            student_number: app.student_number,
            user_id: app.user_id,
            unread: 0,
            lastSubject: m.subject,
            lastBody: m.message_body,
            lastAt: m.created_at,
          };
        }
        if (m.receiver_id === user?.id && !m.is_read) {
          map[m.application_id].unread = (map[m.application_id].unread || 0) + 1;
        }
      });
      const list = Object.values(map).sort((a, b) => {
        return (new Date(b.lastAt || '')).getTime() - (new Date(a.lastAt || '')).getTime();
      });
      setConversations(list);
      if (list.length) {
        // default to first conversation
        await selectConversation(list[0].application_id);
      }
    } catch (err) {
      logger.error('Error loading admin conversations:', err);
    } finally {
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const loadStudentConversation = async () => {
    setLoading(true);
    setMessage('Loading your conversation...');
    try {
      if (!user?.id) return;
      const { data: app } = await supabase
        .from('tutor_applications')
        .select('id,full_name,student_number,user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!app || !app.id) return;
      const conv: ConversationSummary = {
        application_id: app.id,
        full_name: app.full_name,
        student_number: app.student_number,
        user_id: app.user_id,
        unread: 0,
        lastSubject: null,
        lastBody: null,
        lastAt: null,
      };
      setConversations([conv]);
      await selectConversation(app.id);
    } catch (err) {
      logger.error('Error loading student conversation:', err);
    } finally {
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const selectConversation = async (appId: string) => {
    setCurrentAppId(appId);
    try {
      const msgs = await fetchMessages(appId);
      setCurrentMessages(msgs);
      if (user?.id) {
        await markMessagesRead(appId, user.id, !!isAdmin);
      }
      if (msgs.length) {
        setNewMsgSubject(msgs[msgs.length - 1].subject || '');
      }
    } catch (err) {
      logger.error('Error loading messages for conversation:', err);
      setCurrentMessages([]);
    }
    // refresh unread badge for this conv
    setConversations(prev =>
      prev.map(c =>
        c.application_id === appId ? { ...c, unread: 0 } : c
      )
    );
  };

  const handleSend = async () => {
    if (!currentAppId || !user?.id) return;
    setIsSending(true);
    try {
      let subjectToSend = newMsgSubject;
      if (!subjectToSend && currentMessages.length) {
        subjectToSend = currentMessages[currentMessages.length - 1].subject || '';
      }
      const payload: any = {
        application_id: currentAppId,
        sender_id: user.id,
        sender_role: isAdmin ? 'ADMIN' : 'STUDENT',
        receiver_id: '',
        subject: subjectToSend || null,
        message_body: newMsgBody,
      };
      if (isAdmin) {
        // send to student (lookup user_id from conversation)
        const conv = conversations.find(c => c.application_id === currentAppId);
        if (conv?.user_id) payload.receiver_id = conv.user_id;
      } else {
        // student sending to admin; put own id or blank; unread logic does not rely on it
        payload.receiver_id = user.id;
      }
      const ok = await sendMessage(payload);
      if (!ok) throw new Error('send failed');
      setNewMsgBody('');
      setNewMsgSubject(subjectToSend);
      await selectConversation(currentAppId);
    } catch (err) {
      logger.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/10">
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg">Messages</h1>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 flex gap-4">
        <aside className="w-1/4">
          <h2 className="font-semibold mb-2">Conversations</h2>
          <div className="space-y-2">
            {conversations.map(conv => (
              <div key={conv.application_id} className="p-2 rounded-lg border flex items-center justify-between cursor-pointer" onClick={() => selectConversation(conv.application_id)}>
                <div>
                  <p className="font-medium">{conv.full_name}</p>
                  <p className="text-xs text-muted-foreground">{conv.student_number}</p>
                </div>
                {conv.unread > 0 && <span className="w-2 h-2 rounded-full bg-destructive" />}
              </div>
            ))}
          </div>
        </aside>
        <section className="flex-1 flex flex-col">
          {currentAppId ? (
            <>
              <div className="flex-1 overflow-auto mb-4">
                {currentMessages.map(msg => (
                  <div key={msg.id} className="mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{msg.sender_role === 'ADMIN' ? 'Admin' : 'You'}</span>
                      <span>{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    {msg.subject && <div className="font-semibold">{msg.subject}</div>}
                    <div className="whitespace-pre-wrap">{msg.message_body}</div>
                  </div>
                ))}
              </div>
              <div className="mt-auto">
                <input
                  type="text"
                  placeholder="Subject (optional)"
                  className="w-full border rounded px-2 py-1 mb-2"
                  value={newMsgSubject}
                  onChange={e => setNewMsgSubject(e.target.value)}
                />
                <Textarea
                  placeholder="Type your message..."
                  className="w-full"
                  value={newMsgBody}
                  onChange={e => setNewMsgBody(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <Button onClick={handleSend} disabled={isSending || !newMsgBody.trim()}>
                    {isSending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p>Select a conversation to view messages.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default Messages;
