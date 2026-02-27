import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  LogOut,
  Loader2,
  Users,
  FileText,
  AlertCircle,
  ChevronRight,
  Download,
  Upload,
  FileArchive,
  Printer
} from 'lucide-react';
import { UFHLogo } from '@/components/UFHLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { createAuditLog, fetchAuditLogs, AuditLogEntry } from '@/lib/auditLog';
import { fetchApplicationDocuments, checkDocumentsComplete, getRequiredDocumentsForPack, mergeDocumentsIntoPDF } from '@/lib/hrDocumentPack';
import { fetchMessages, sendMessage, markMessagesRead, fetchUnreadCount, MessageRow } from '@/lib/messages';

interface Application {
  id: string;
  user_id: string; // needed for messaging
  full_name: string;
  student_number: string;
  email: string;
  faculty: string;
  department: string;
  degree_program: string;
  year_of_study: number;
  status: string;
  created_at: string;
  submitted_at: string | null;
  subjects_to_tutor: string[];
  motivation_letter: string;
  contact_number: string;
  nationality: string;
  residential_address: string;
  date_of_birth: string;
  languages_spoken: string[];
  skills_competencies: string[];
  previous_tutoring_experience: string | null;
  work_experience: string | null;
  availability: any;
  rejection_reason: string | null;
  // Offer workflow fields (may be null for older records)
  offer_status?:
    | 'NOT_SENT'
    | 'SENT'
    | 'ACCEPTED_AWAITING_UPLOAD'
    | 'SIGNED_UPLOADED'
    | 'RESUBMISSION_REQUIRED'
    | 'VERIFIED'
    | 'HR_SUBMITTED'
    | 'WITHDRAWN'
    | null;
  offer_sent_at?: string | null;
  document_rejection_reason?: string | null;
  document_rejected_at?: string | null;
  resubmission_count?: number | null;
  last_resubmitted_at?: string | null;
  edit_enabled?: boolean;
}

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
}

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pending', color: 'bg-warning/20 text-warning' },
  under_review: { label: 'Under Review', color: 'bg-primary/20 text-primary' },
  approved: { label: 'Approved', color: 'bg-success/20 text-success' },
  rejected: { label: 'Rejected', color: 'bg-destructive/20 text-destructive' },
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const { setLoading, setMessage } = useLoading();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isSendingOffer, setIsSendingOffer] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isOfferRejecting, setIsOfferRejecting] = useState(false);
  const [offerRejectionReason, setOfferRejectionReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingTemplates, setIsUploadingTemplates] = useState(false);
  const [personalFormFile, setPersonalFormFile] = useState<File | null>(null);
  const [affidavitFile, setAffidavitFile] = useState<File | null>(null);
  const [isForwardingToHR, setIsForwardingToHR] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [documentsComplete, setDocumentsComplete] = useState(false);
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMsgBody, setNewMsgBody] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [allowEdit, setAllowEdit] = useState(false);
  // track unread message counts per application (for admin notifications)
  const [appUnreadCounts, setAppUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && isAdmin !== null) {
      if (!user) {
        navigate('/auth');
      } else if (isAdmin === false) {
        navigate('/dashboard');
        toast.error('Access denied. Admin privileges required.');
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin === true) {
      fetchApplications();
    }
  }, [isAdmin]);

  const fetchApplications = async () => {
    setMessage('Loading applications...');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tutor_applications')
        .select('*')
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      const apps = (((data as any[]) || []).map((app: any) => ({
        ...app,
        subjects_to_tutor: typeof app.subjects_to_tutor === 'string' ? app.subjects_to_tutor.split(',') : app.subjects_to_tutor || [],
        languages_spoken: typeof app.languages_spoken === 'string' ? app.languages_spoken.split(',') : app.languages_spoken || [],
        skills_competencies: typeof app.skills_competencies === 'string' ? app.skills_competencies.split(',') : app.skills_competencies || [],
      })) as Application[]);
      setApplications(apps);
      // after setting, load unread counts
      if (user?.id) {
        const counts: Record<string, number> = {};
        await Promise.all(apps.map(async (a) => {
          try {
            const c = await fetchUnreadCount(a.id, user.id, true);
            counts[a.id] = c;
          } catch (e) {
            counts[a.id] = 0;
          }
        }));
        setAppUnreadCounts(counts);
      }
    } catch (error) {
      logger.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const fetchDocuments = async (applicationId: string) => {
    try {
      const { data, error } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', applicationId);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      logger.error('Error fetching documents:', error);
    }
  };

  const loadAuditLogs = async (applicationId: string) => {
    try {
      setIsLoadingAuditLogs(true);
      const logs = await fetchAuditLogs(applicationId);
      setAuditLogs(logs);
    } catch (error) {
      logger.error('Error loading audit logs:', error);
      setAuditLogs([]);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const checkHRPackCompleteness = async (applicationId: string) => {
    try {
      const complete = await checkDocumentsComplete(applicationId);
      setDocumentsComplete(complete);
    } catch (error) {
      logger.error('Error checking document completeness:', error);
      setDocumentsComplete(false);
    }
  };

  const fetchMessagesForApplication = async (applicationId: string) => {
    try {
      const msgs = await fetchMessages(applicationId);
      setMessages(msgs);
      // keep subject field in sync with latest message from admin if not explicitly changed
      if (msgs.length) {
        const last = msgs[msgs.length - 1];
        setNewMsgSubject(last.subject || '');
      }
    } catch (error) {
      logger.error('Error fetching messages:', error);
      setMessages([]);
    }
  };

  const handleViewApplication = async (application: Application) => {
    setSelectedApplication(application);
    setAllowEdit(application.edit_enabled || false);
    setActiveTab('details');
    await fetchDocuments(application.id);
    await loadAuditLogs(application.id);
    await checkHRPackCompleteness(application.id);
    await fetchMessagesForApplication(application.id);
    // mark any messages sent to admin as read
    if (user?.id) {
      await markMessagesRead(application.id, user.id);
      // refresh unread counters
      const newCount = await fetchUnreadCount(application.id, user.id, true);
      setAppUnreadCounts(prev => ({ ...prev, [application.id]: newCount }));
    }
    setIsDialogOpen(true);
  };

  const withdrawOffer = async (applicationId: string) => {
    setIsUpdating(true);
    setMessage('Withdrawing offer...');
    setLoading(true);
    try {
      let { error } = await supabase
        .from('tutor_applications')
        .update({ offer_status: 'WITHDRAWN', offer_withdrawn_at: new Date().toISOString() } as any)
        .eq('id', applicationId);
      if (error) {
        // if the schema cache doesn't know about the column, try again without it
        if (error.message && error.message.includes("offer_withdrawn_at")) {
          logger.warn('Retrying withdrawOffer without offer_withdrawn_at');
          const { error: retryErr } = await supabase
            .from('tutor_applications')
            .update({ offer_status: 'WITHDRAWN' } as any)
            .eq('id', applicationId);
          if (retryErr) throw retryErr;
        } else {
          throw error;
        }
      }

      await createAuditLog(
        applicationId,
        user?.id || '',
        user?.email || 'Unknown Admin',
        'OFFER_BULK_SENT',
        'Offer withdrawn by admin'
      );

      toast.success('Offer withdrawn successfully');
      await fetchApplications();
      setIsDialogOpen(false);
    } catch (err: any) {
      logger.error('Error withdrawing offer:', err?.message ? err.message : JSON.stringify(err));
      toast.error(err?.message || 'Failed to withdraw offer');
    } finally {
      setIsUpdating(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  // open mailto link with appropriate prefilled template
  const handleEmailStudent = async (application: Application) => {
    if (!application) return;
    // prevent double-click by disabling via local state? outside scope, use a simple guard
    const email = application.email || `${application.student_number}@ufh.ac.za`;
    const subject = `Tutor Application Query - ${application.student_number}`;
    const firstName = application.full_name.split(' ')[0] || '';
    const body = `Dear ${firstName},

I hope this email finds you well.

This message is regarding your Tutor Application.
Student Number: ${application.student_number}
Application ID: ${application.id}

[Please insert your query here.]

Kind regards,
${user?.user_metadata?.full_name || 'Admin'}
Department of Computer Science
University of Fort Hare`;

    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // log audit before navigating
    await createAuditLog(
      application.id,
      user?.id || '',
      user?.email || 'Unknown Admin',
      'EMAIL_CLIENT_OPENED',
      'Admin initiated external email to student'
    );
    // open in new navigation
    window.location.href = mailto;
  };


  const sendOffer = async (applicationId: string) => {
    setIsSendingOffer(true);
    setMessage('Sending offer...');
    setLoading(true);
    try {
      // Call an Edge Function (implement server-side) to send email with attachments
      // Function name: send_offer_email
      const { error } = await supabase
        .from('tutor_applications')
        .update({ offer_status: 'SENT', offer_sent_at: new Date().toISOString() } as any)
        .eq('id', applicationId);

      if (error) throw error;

      // Log the action
      await createAuditLog(
        applicationId,
        user?.id || '',
        user?.email || 'Unknown Admin',
        'OFFER_SENT',
        'Offer documents sent to tutor for signature'
      );

      toast.success('Offer documents sent - tutor can now download and sign from their dashboard');
      await fetchApplications();
    } catch (error) {
      logger.error('Error sending offer:', error);
      toast.error('Failed to send offer');
    } finally {
      setIsSendingOffer(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const approveOfferDocuments = async (applicationId: string) => {
    setIsUpdating(true);
    setMessage('Verifying documents...');
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tutor_applications')
        .update({ offer_status: 'VERIFIED', appointment_status: 'FINALIZED' } as any)
        .eq('id', applicationId);
      if (error) throw error;

      // Log the action
      await createAuditLog(
        applicationId,
        user?.id || '',
        user?.email || 'Unknown Admin',
        'DOCUMENTS_VERIFIED',
        'Offer documents verified and approved by HR'
      );

      toast.success('Offer documents approved');
      await fetchApplications();
      setIsDialogOpen(false);
    } catch (err) {
      logger.error('Error approving offer documents:', err);
      toast.error('Failed to approve documents');
    } finally {
      setIsUpdating(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };


  const rejectOfferDocuments = async (applicationId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('Rejection reason required');
      return;
    }
    setIsUpdating(true);
    setMessage('Rejecting documents...');
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tutor_applications')
        .update({ offer_status: 'WITHDRAWN', document_rejection_reason: reason, document_rejected_at: new Date().toISOString() } as any)
        .eq('id', applicationId);
      if (error) throw error;

      // Log the action
      await createAuditLog(
        applicationId,
        user?.id || '',
        user?.email || 'Unknown Admin',
        'DOCUMENT_REJECTED',
        `Documents rejected with reason: ${reason}`
      );

      toast.success('Documents rejected; applicant will be asked to resubmit');
      await fetchApplications();
      setIsDialogOpen(false);
    } catch (err) {
      logger.error('Error rejecting offer documents:', err);
      toast.error('Failed to reject documents');
    } finally {
      setIsUpdating(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const uploadTemplates = async () => {
    if (!personalFormFile && !affidavitFile) {
      toast.error('Please select at least one PDF to upload');
      return;
    }

    setIsUploadingTemplates(true);
    setMessage('Uploading offer templates...');
    setLoading(true);

    try {
      const errors: string[] = [];

      // Upload personal form if selected
      if (personalFormFile) {
        if (personalFormFile.type !== 'application/pdf') {
          errors.push('Personal Info Form must be a PDF');
        } else {
          try {
            const { error: uploadErr } = await supabase.storage
              .from('offer-templates')
              .upload('tutor_personal_form.pdf', personalFormFile, { contentType: 'application/pdf', upsert: true });
            if (uploadErr) throw uploadErr;
            toast.success('Personal Info Form uploaded');
          } catch (err: any) {
            errors.push(`Personal form upload failed: ${err.message}`);
          }
        }
      }

      // Upload affidavit if selected
      if (affidavitFile) {
        if (affidavitFile.type !== 'application/pdf') {
          errors.push('Affidavit must be a PDF');
        } else {
          try {
            const { error: uploadErr } = await supabase.storage
              .from('offer-templates')
              .upload('offer_affidavit.pdf', affidavitFile, { contentType: 'application/pdf', upsert: true });
            if (uploadErr) throw uploadErr;
            toast.success('Affidavit uploaded');
          } catch (err: any) {
            errors.push(`Affidavit upload failed: ${err.message}`);
          }
        }
      }

      if (errors.length === 0) {
        toast.success('All templates uploaded successfully');
        setPersonalFormFile(null);
        setAffidavitFile(null);

        // Log the system-level action
        const templatesList = [];
        if (personalFormFile) templatesList.push('Personal Info Form');
        if (affidavitFile) templatesList.push('Offer Affidavit');
        
        // Create a system log entry (use a placeholder application_id for system events)
        await createAuditLog(
          'system',
          user?.id || '',
          user?.email || 'Unknown Admin',
          'OFFER_SENT',
          `Updated offer templates: ${templatesList.join(', ')}`
        );
      } else {
        errors.forEach(err => toast.error(err));
      }
    } catch (err) {
      logger.error('Error uploading templates:', err);
      toast.error('Failed to upload templates');
    } finally {
      setIsUploadingTemplates(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const handleForwardToHR = async (applicationId: string) => {
    setIsForwardingToHR(true);
    setMessage('Forwarding to HR...');
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tutor_applications')
        .update({ offer_status: 'HR_SUBMITTED', hr_submitted_at: new Date().toISOString() } as any)
        .eq('id', applicationId);
      if (error) throw error;

      // Log the action
      await createAuditLog(
        applicationId,
        user?.id || '',
        user?.email || 'Unknown Admin',
        'HR_PACK_GENERATED',
        'HR document pack generated and submitted to Human Resources'
      );

      toast.success('Documents forwarded to HR successfully');
      await fetchApplications();
      setIsDialogOpen(false);
    } catch (err) {
      logger.error('Error forwarding to HR:', err);
      toast.error('Failed to forward documents to HR');
    } finally {
      setIsForwardingToHR(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const handleGenerateHRPack = async (applicationId: string) => {
    if (!documentsComplete) {
      toast.error('All required onboarding documents must be uploaded before generating HR Pack');
      return;
    }

    setIsGeneratingPack(true);
    setMessage('Generating HR document pack...');
    setLoading(true);

    try {
      // fetch the latest documents list
      const docs = await fetchApplicationDocuments(applicationId);
      const app = selectedApplication;
      if (!app) throw new Error('Application data missing');

      const blob = await mergeDocumentsIntoPDF(
        docs,
        app.student_number,
        app.full_name,
        app.department,
        applicationId,
        new Date().toLocaleDateString()
      );

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HR_Pack_${applicationId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      await createAuditLog(
        applicationId,
        user?.id || '',
        user?.email || 'Unknown Admin',
        'HR_PACK_DOWNLOADED',
        'HR document pack downloaded for processing'
      );

      toast.success('HR Pack generated successfully');
    } catch (err) {
      logger.error('Error generating HR pack:', err);
      toast.error('Failed to generate HR pack');
    } finally {
      setIsGeneratingPack(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const handlePrintHRPack = async (applicationId: string) => {
    if (!documentsComplete) {
      toast.error('All required onboarding documents must be uploaded before printing HR Pack');
      return;
    }

    setIsGeneratingPack(true);
    setMessage('Preparing HR document pack for printing...');
    setLoading(true);

    try {
      await createAuditLog(
        applicationId,
        user?.id || '',
        user?.email || 'Unknown Admin',
        'HR_PACK_PRINTED',
        'HR document pack sent to printer'
      );

      toast.success('HR Pack sent to printer');
    } catch (err) {
      logger.error('Error printing HR pack:', err);
      toast.error('Failed to print HR pack');
    } finally {
      setIsGeneratingPack(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedApplication) return;

    if (newStatus === 'rejected' && !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsUpdating(true);
    setMessage('Updating application status...');
    setLoading(true);

    try {
      const updateData: any = {
        status: newStatus,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };

      if (newStatus === 'rejected') {
        updateData.rejection_reason = rejectionReason;
        // automatically withdraw any existing offer when an application is rejected
        updateData.offer_status = 'WITHDRAWN';
        updateData.offer_sent_at = null;
      }

      const { error } = await supabase
        .from('tutor_applications')
        .update(updateData)
        .eq('id', selectedApplication.id);

      if (error) throw error;

      toast.success(`Application ${newStatus === 'approved' ? 'approved' : newStatus === 'rejected' ? 'rejected' : 'updated'} successfully`);
      
      setApplications(prev => prev.map(app => 
        app.id === selectedApplication.id 
          ? { ...app, status: newStatus, rejection_reason: newStatus === 'rejected' ? rejectionReason : app.rejection_reason }
          : app
      ));
      // Create audit log for status change
      if (newStatus === 'approved') {
        await createAuditLog(selectedApplication.id, user?.id || '', user?.email || 'Unknown Admin', 'APPLICATION_APPROVED', 'Application approved by admin');
      } else if (newStatus === 'rejected') {
        // withdraw offer if any
        try {
          await supabase.from('tutor_applications').update({ offer_status: 'WITHDRAWN', offer_withdrawn_at: new Date().toISOString() }).eq('id', selectedApplication.id);
        } catch (err: any) {
          logger.error('Error withdrawing offer on rejection:', err?.message ? err.message : JSON.stringify(err));
        }
        await createAuditLog(selectedApplication.id, user?.id || '', user?.email || 'Unknown Admin', 'APPLICATION_REJECTED', `Application rejected: ${rejectionReason}`);
      } else {
        await createAuditLog(selectedApplication.id, user?.id || '', user?.email || 'Unknown Admin', 'APPLICATION_APPROVED', `Status changed to ${newStatus}`);
      }
      
      setIsDialogOpen(false);
      setIsRejecting(false);
      setRejectionReason('');
    } catch (error: any) {
      logger.error('Error updating application:', error);
      toast.error(error.message || 'Failed to update application');
    } finally {
      setIsUpdating(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const downloadDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('application-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      app.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.student_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesFaculty = facultyFilter === 'all' || app.faculty === facultyFilter;
    
    return matchesSearch && matchesStatus && matchesFaculty;
  });

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    underReview: applications.filter(a => a.status === 'under_review').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const faculties = [...new Set(applications.map(a => a.faculty))];

  if (authLoading || isLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <UFHLogo className="w-12 h-12" />
            </div>
            <div>
              <h1 className="font-bold text-lg">UFH Tutors</h1>
              <p className="text-xs text-sidebar-foreground/70">Admin Dashboard</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/admin/documents">
              <Button variant="ghost" className="gap-2 text-sidebar-foreground hover:bg-sidebar-accent">
                <FileArchive className="w-4 h-4" />
                Offer Documents
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleSignOut} className="gap-2 text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.underReview}</p>
                  <p className="text-xs text-muted-foreground">Reviewing</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, student number, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={facultyFilter} onValueChange={setFacultyFilter}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Filter by faculty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Faculties</SelectItem>
                  {faculties.map(faculty => (
                    <SelectItem key={faculty} value={faculty}>{faculty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Offer Templates Upload */}
        <Card className="border-0 shadow-md mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Offer Templates
            </CardTitle>
            <CardDescription>
              Upload or update the PDF templates that will be sent to approved applicants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tutor Personal Info Form */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-sm mb-2">Tutor Personal Information Form</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    File must be named: <code className="bg-muted px-1 py-0.5 rounded">tutor_personal_form.pdf</code>
                  </p>
                </div>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPersonalFormFile(e.target.files?.[0] || null)}
                    disabled={isUploadingTemplates}
                    className="cursor-pointer"
                  />
                  {personalFormFile && (
                    <p className="text-xs text-green-600 mt-2">
                      ✓ Selected: {personalFormFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Offer Affidavit */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-sm mb-2">Offer Acceptance Affidavit</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    File must be named: <code className="bg-muted px-1 py-0.5 rounded">offer_affidavit.pdf</code>
                  </p>
                </div>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setAffidavitFile(e.target.files?.[0] || null)}
                    disabled={isUploadingTemplates}
                    className="cursor-pointer"
                  />
                  {affidavitFile && (
                    <p className="text-xs text-green-600 mt-2">
                      ✓ Selected: {affidavitFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
              <p className="font-semibold mb-1">How this works:</p>
              <ul className="text-xs space-y-1 ml-4 list-disc">
                <li>Upload the templates here first</li>
                <li>Select approved applicants and click "Send Offer"</li>
                <li>Applicants will receive emails with PDF attachments</li>
                <li>They'll print, sign (with Commissioner of Oaths), and upload back</li>
                <li>You'll approve documents and forward to HR</li>
              </ul>
            </div>

            <Button
              onClick={uploadTemplates}
              disabled={isUploadingTemplates || (!personalFormFile && !affidavitFile)}
              className="w-full"
            >
              {isUploadingTemplates ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Templates
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Applications List */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Applications ({filteredApplications.length})</CardTitle>
            <CardDescription>Review and manage tutor applications</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No applications found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleViewApplication(app)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        {app.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium flex items-center">
                          {app.full_name}
                          {appUnreadCounts[app.id] > 0 && (
                            <span className="ml-2 w-2 h-2 rounded-full bg-destructive inline-block" />
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{app.student_number} • {app.faculty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusConfig[app.status as keyof typeof statusConfig]?.color}>
                        {statusConfig[app.status as keyof typeof statusConfig]?.label}
                      </Badge>
                      {/* Offer status badge (if any) */}
                      {app.offer_status && (
                        <Badge variant="outline" className={app.offer_status === 'WITHDRAWN' ? 'text-destructive' : ''}>{String(app.offer_status)}</Badge>
                      )}
                      <span className="text-sm text-muted-foreground hidden md:block">
                        {app.submitted_at && new Date(app.submitted_at).toLocaleDateString('en-ZA')}
                      </span>
                      {/* Send Offer button for approved applicants */}
                      {app.status === 'approved' && !['SENT','ACCEPTED_AWAITING_UPLOAD','SIGNED_UPLOADED','RESUBMISSION_REQUIRED','VERIFIED','HR_SUBMITTED'].includes(app.offer_status || '') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm(`Send offer to ${app.full_name}?`)) return;
                            sendOffer(app.id);
                          }}
                        >
                          Send Offer
                        </Button>
                      )}
                      {/* Email student external button */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEmailStudent(app);
                        }}
                      >
                        Email Student
                      </Button>
                      {/* Withdraw offer button if one has been issued */}
                      {app.offer_status && ['SENT','ACCEPTED_AWAITING_UPLOAD','RESUBMISSION_REQUIRED','SIGNED_UPLOADED','VERIFIED'].includes(app.offer_status) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm(`Withdraw offer for ${app.full_name}?`)) return;
                            withdrawOffer(app.id);
                          }}
                        >
                          Withdraw
                        </Button>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Application Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedApplication && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedApplication.full_name}</DialogTitle>
                    <DialogDescription>{selectedApplication.student_number}</DialogDescription>
                  </div>
                  <Badge className={statusConfig[selectedApplication.status as keyof typeof statusConfig]?.color}>
                    {statusConfig[selectedApplication.status as keyof typeof statusConfig]?.label}
                  </Badge>
                </div>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab('details')} 
                      className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'details' ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                      Details
                    </button>
                    <button 
                      onClick={() => setActiveTab('documents')} 
                      className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'documents' ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                      Documents
                    </button>
                    <button 
                      onClick={() => setActiveTab('audit')} 
                      className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'audit' ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                      Audit Trail
                    </button>
                    <button 
                      onClick={() => setActiveTab('messages')} 
                      className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === 'messages' ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                      Messages
                    </button>
                  </div>
                </div>

                {/* Centralized rejection panel visible across tabs */}
                {isRejecting && (
                  <div className="p-4 mb-4 border rounded bg-destructive/5">
                    <h4 className="font-semibold mb-2 text-destructive">Rejection Reason</h4>
                    <Textarea
                      placeholder="Please provide a reason for rejection. This will be visible to the applicant."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="min-h-[100px] mb-3"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => { setIsRejecting(false); setRejectionReason(''); }}>Cancel</Button>
                      <Button variant="destructive" onClick={() => handleUpdateStatus('rejected')} disabled={!rejectionReason.trim() || isUpdating}>Confirm Rejection</Button>
                    </div>
                  </div>
                )}

                {/* Details Tab */}
                {activeTab === 'details' && (
                <div className="space-y-6 py-4">
                  {/* Personal Information */}
                  <div>
                    <h4 className="font-semibold mb-3">Personal Information</h4>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-muted-foreground">Email</dt><dd>{selectedApplication.email}</dd></div>
                      <div><dt className="text-muted-foreground">Contact</dt><dd>{selectedApplication.contact_number}</dd></div>
                      <div><dt className="text-muted-foreground">Date of Birth</dt><dd>{selectedApplication.date_of_birth}</dd></div>
                      <div><dt className="text-muted-foreground">Nationality</dt><dd>{selectedApplication.nationality}</dd></div>
                      <div className="col-span-2"><dt className="text-muted-foreground">Address</dt><dd>{selectedApplication.residential_address}</dd></div>
                    </dl>
                  </div>

                  {/* Academic Information */}
                  <div>
                    <h4 className="font-semibold mb-3">Academic Information</h4>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-muted-foreground">Degree</dt><dd>{selectedApplication.degree_program}</dd></div>
                      <div><dt className="text-muted-foreground">Year</dt><dd>Year {selectedApplication.year_of_study}</dd></div>
                      <div><dt className="text-muted-foreground">Faculty</dt><dd>{selectedApplication.faculty}</dd></div>
                      <div><dt className="text-muted-foreground">Department</dt><dd>{selectedApplication.department}</dd></div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Subjects to Tutor</dt>
                        <dd className="flex flex-wrap gap-1 mt-1">
                          {(Array.isArray(selectedApplication.subjects_to_tutor) 
                            ? selectedApplication.subjects_to_tutor 
                            : (selectedApplication.subjects_to_tutor as string)?.split(',') || []
                          ).map((subj, index) => (
                            <Badge key={index} variant="secondary">{typeof subj === 'string' ? subj.trim() : subj}</Badge>
                          ))}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Skills & Experience */}
                  <div>
                    <h4 className="font-semibold mb-3">Skills & Experience</h4>
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Languages</dt>
                        <dd className="flex flex-wrap gap-1 mt-1">
                          {(Array.isArray(selectedApplication.languages_spoken)
                            ? selectedApplication.languages_spoken
                            : (selectedApplication.languages_spoken as string)?.split(',') || []
                          ).map((lang, index) => (
                            <Badge key={index} variant="outline">{typeof lang === 'string' ? lang.trim() : lang}</Badge>
                          ))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Skills</dt>
                        <dd className="flex flex-wrap gap-1 mt-1">
                          {(Array.isArray(selectedApplication.skills_competencies)
                            ? selectedApplication.skills_competencies
                            : (selectedApplication.skills_competencies as string)?.split(',') || []
                          ).map((skill, index) => (
                            <Badge key={index} variant="outline">{typeof skill === 'string' ? skill.trim() : skill}</Badge>
                          ))}
                        </dd>
                      </div>
                      {selectedApplication.previous_tutoring_experience && (
                        <div>
                          <dt className="text-muted-foreground">Previous Tutoring Experience</dt>
                          <dd className="mt-1">{selectedApplication.previous_tutoring_experience}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-muted-foreground">Availability</dt>
                        <dd className="mt-1">{selectedApplication.availability?.description || 'Not specified'}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Motivation Letter */}
                  <div>
                    <h4 className="font-semibold mb-3">Motivation Letter</h4>
                    <p className="text-sm bg-muted/50 p-4 rounded-lg whitespace-pre-wrap">
                      {selectedApplication.motivation_letter}
                    </p>
                  </div>
                </div>
                )}

                {activeTab === 'documents' && (
                <div className="space-y-6 py-4">
                  <div>
                    <h4 className="font-semibold mb-3">Documents</h4>
                    <div className="space-y-2">
                      {documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No documents uploaded</p>
                      ) : (
                        documents.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{doc.file_name}</span>
                              <Badge variant="outline" className="text-xs">{doc.document_type.replace('_', ' ')}</Badge>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => downloadDocument(doc)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Offer document verification panel */}
                    {documents.some(d => d.document_type === 'offer_affidavit' || d.document_type === 'offer_personal_info') && (
                      <div className="mt-4 p-4 border rounded">
                        <h5 className="font-semibold">Offer Documents</h5>
                        <p className="text-sm text-muted-foreground mb-2">Uploaded offer acceptance documents</p>
                        <div className="space-y-2">
                          {documents.filter(d => d.document_type === 'offer_affidavit' || d.document_type === 'offer_personal_info').map(d => (
                            <div key={d.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{d.file_name}</span>
                                <Badge variant="outline" className="text-xs">{d.document_type.replace('_', ' ')}</Badge>
                              </div>
                              <div>
                                <Button variant="ghost" size="sm" onClick={() => downloadDocument(d)}><Download className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {selectedApplication.offer_status === 'VERIFIED' ? (
                            <Button 
                              onClick={() => handleForwardToHR(selectedApplication!.id)} 
                              disabled={isForwardingToHR}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {isForwardingToHR ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Forward to HR
                            </Button>
                          ) : (
                            <>
                              <Button onClick={() => approveOfferDocuments(selectedApplication!.id)} disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Approve Documents
                              </Button>
                              {!isOfferRejecting ? (
                                <Button variant="destructive" onClick={() => setIsOfferRejecting(true)}>Reject Documents</Button>
                              ) : (
                                <div className="flex-1 flex gap-2">
                                  <Textarea placeholder="Reason for rejection" value={offerRejectionReason} onChange={(e) => setOfferRejectionReason(e.target.value)} />
                                  <div className="flex gap-2 mt-2">
                                    <Button variant="outline" onClick={() => { setIsOfferRejecting(false); setOfferRejectionReason(''); }}>Cancel</Button>
                                    <Button variant="destructive" onClick={() => rejectOfferDocuments(selectedApplication!.id, offerRejectionReason)} disabled={!offerRejectionReason.trim() || isUpdating}>Confirm Reject</Button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  

                  {/* HR Document Pack Section */}
                  {selectedApplication.offer_status === 'VERIFIED' && (
                    <div className="mt-6 p-4 border rounded bg-blue-50 dark:bg-blue-950">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <FileArchive className="w-4 h-4" />
                        HR Document Pack
                      </h5>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-muted-foreground">
                          {documentsComplete 
                            ? 'All required documents are ready. Download or print the complete HR onboarding pack below.'
                            : 'All required onboarding documents must be uploaded before generating the HR Pack.'}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => selectedApplication && checkHRPackCompleteness(selectedApplication.id)}>
                          Refresh
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div title={!documentsComplete ? 'All required onboarding documents must be uploaded before generating HR Pack' : ''}>
                          <Button 
                            onClick={() => handleGenerateHRPack(selectedApplication!.id)}
                            disabled={!documentsComplete || isGeneratingPack}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {isGeneratingPack ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                            Download HR Pack (PDF)
                          </Button>
                        </div>
                        <div title={!documentsComplete ? 'All required onboarding documents must be uploaded before generating HR Pack' : ''}>
                          <Button 
                            onClick={() => handlePrintHRPack(selectedApplication!.id)}
                            disabled={!documentsComplete || isGeneratingPack}
                            variant="outline"
                          >
                            {isGeneratingPack ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                            Print Full HR Pack
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {activeTab === 'messages' && (
                <div className="space-y-4 py-4">
                  {messages.length === 0 ? (
                    <p className="text-muted-foreground">No messages yet. Use the button below to start a conversation.</p>
                  ) : (
                    <div className="space-y-6">
                      {messages.map((msg) => (
                        <div key={msg.id} className="border rounded p-4 bg-white">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{msg.subject || '(no subject)'}</span>
                            <span className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">From: {msg.sender_role === 'ADMIN' ? 'Administrator' : 'Student'}</div>
                          <p className="whitespace-pre-wrap">{msg.message_body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">New Message</h4>
                    <input
                      type="text"
                      placeholder="Subject (optional)"
                      className="w-full border rounded px-2 py-1 mb-2"
                      value={newMsgSubject}
                      onChange={(e) => setNewMsgSubject(e.target.value)}
                    />
                    <Textarea
                      placeholder="Message body"
                      value={newMsgBody}
                      onChange={(e) => setNewMsgBody(e.target.value)}
                      className="w-full"
                    />
                    <div className="flex items-center gap-2 mb-2">
                      <input
                          type="checkbox"
                          id="allow-edit"
                          checked={allowEdit}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            setAllowEdit(checked);
                            if (selectedApplication) {
                              try {
                                const { error } = await supabase
                                  .from('tutor_applications')
                                  .update({ edit_enabled: checked } as any)
                                  .eq('id', selectedApplication.id);
                                if (error) throw error;
                                // also update local copy so future sends use accurate state
                                setSelectedApplication(prev => prev ? { ...prev, edit_enabled: checked } : prev);
                              } catch (err) {
                                logger.error('Error updating edit_enabled flag:', err);
                                toast.error('Failed to update edit permission');
                              }
                            }
                          }}
                        />
                      <label htmlFor="allow-edit" className="text-sm">Allow student to edit application</label>
                    </div>
                    <Button
                      className="mt-2"
                      disabled={isSendingMsg || !newMsgBody.trim()}
                      onClick={async () => {
                        if (!selectedApplication) return;
                        setIsSendingMsg(true);
                        try {
                          const ok = await sendMessage({
                            application_id: selectedApplication.id,
                            sender_id: user?.id || '',
                            sender_role: 'ADMIN',
                            receiver_id: selectedApplication.user_id || '',
                            subject: newMsgSubject || null,
                            message_body: newMsgBody,
                          });
                          if (!ok) throw new Error('send failed');
                          // update edit_enabled flag based on checkbox
                          await supabase
                            .from('tutor_applications')
                            .update({ edit_enabled: allowEdit } as any)
                            .eq('id', selectedApplication.id);
                          await createAuditLog(
                            selectedApplication.id,
                            user?.id || '',
                            user?.email || 'Unknown Admin',
                            'INTERNAL_MESSAGE_SENT',
                            'Admin sent internal message regarding application'
                          );
                          setNewMsgBody('');
                          // leave subject intact; it will be refreshed by fetchMessagesForApplication
                          setAllowEdit(false);
                          await fetchMessagesForApplication(selectedApplication.id);
                        } catch (err) {
                          logger.error('Error sending message:', err);
                          toast.error('Failed to send message');
                        } finally {
                          setIsSendingMsg(false);
                        }
                      }}
                    >
                      {isSendingMsg ? 'Sending…' : 'Send Message'}
                    </Button>
                  </div>
                </div>
                )}

                {activeTab === 'audit' && (
                <div className="space-y-4 py-4">
                  <div>
                    <h4 className="font-semibold mb-3">Audit Trail</h4>
                    {isLoadingAuditLogs ? (
                      <p className="text-sm text-muted-foreground">Loading audit logs...</p>
                    ) : auditLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No audit logs found</p>
                    ) : (
                      <div className="space-y-3">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <Badge variant="outline" className="mb-2">{log.action_type.replace(/_/g, ' ')}</Badge>
                                <p className="text-sm font-medium">{log.admin_name}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {log.action_description && (
                              <p className="text-sm text-muted-foreground">{log.action_description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )}
              </Tabs>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {!isRejecting ? (
                  <>
                    {selectedApplication.status !== 'approved' && (
                      <Button
                        onClick={() => handleUpdateStatus('approved')}
                        disabled={isUpdating}
                        className="bg-success hover:bg-success/90"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Approve
                      </Button>
                    )}
                    {selectedApplication.status !== 'rejected' && (
                      <Button
                        variant="destructive"
                        onClick={() => setIsRejecting(true)}
                        disabled={isUpdating}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    )}
                    {selectedApplication.status === 'pending' && (
                      <Button
                        variant="outline"
                        onClick={() => handleUpdateStatus('under_review')}
                        disabled={isUpdating}
                      >
                        Mark as Under Review
                      </Button>
                    )}
                    {/* Withdraw offer if it was sent */}
                    {selectedApplication.offer_status === 'SENT' && (
                      <Button variant="destructive" onClick={() => { if (confirm('Withdraw the offer for this applicant?')) withdrawOffer(selectedApplication.id); }} disabled={isUpdating}>
                        Withdraw Offer
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRejecting(false);
                        setRejectionReason('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateStatus('rejected')}
                      disabled={isUpdating || !rejectionReason.trim()}
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Confirm Rejection
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
