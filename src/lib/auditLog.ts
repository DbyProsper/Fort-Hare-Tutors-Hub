import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AuditLogEntry {
  id: string;
  application_id: string;
  admin_id: string;
  admin_name: string;
  action_type: string;
  action_description?: string | null;
  timestamp: string;
}

export type AuditActionType = 
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'DOCUMENT_REJECTED'
  | 'OFFER_SENT'
  | 'OFFER_BULK_SENT'
  | 'DOCUMENTS_VERIFIED'
  | 'HR_PACK_GENERATED'
  | 'HR_PACK_DOWNLOADED'
  | 'HR_PACK_PRINTED'
  | 'EMAIL_CLIENT_OPENED'
  | 'INTERNAL_MESSAGE_SENT'
  | 'STUDENT_MESSAGE_SENT';

export const createAuditLog = async (
  applicationId: string,
  adminId: string,
  adminName: string,
  actionType: AuditActionType,
  actionDescription?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        application_id: applicationId,
        admin_id: adminId,
        admin_name: adminName,
        action_type: actionType,
        action_description: actionDescription || null,
      });

    if (error) {
      logger.error('Failed to create audit log:', error);
      return false;
    }

    logger.log(`Audit log created: ${actionType} for application ${applicationId}`);
    return true;
  } catch (err) {
    logger.error('Error creating audit log:', err);
    return false;
  }
};

export const fetchAuditLogs = async (applicationId: string): Promise<AuditLogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('application_id', applicationId)
      .order('timestamp', { ascending: false });

    if (error) {
      logger.error('Failed to fetch audit logs:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    logger.error('Error fetching audit logs:', err);
    return [];
  }
};
