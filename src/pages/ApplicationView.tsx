import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Loader2, 
  User, 
  BookOpen, 
  Briefcase, 
  Upload, 
  CheckCircle2,
  FileText,
  LogOut,
  Clock,
  AlertCircle,
  XCircle,
  Download
} from 'lucide-react';
import { UFHLogo } from '@/components/UFHLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface UploadedDocument {
  id?: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

const REQUIRED_DOCUMENTS = [
  { type: 'certified_id', label: 'Certified ID Copy', description: 'Must be certified within the last 3 months' },
  { type: 'academic_transcript', label: 'Academic Transcript', description: 'Official UFH transcript' },
  { type: 'cv', label: 'CV / Resume', description: 'PDF format preferred' },
  { type: 'proof_of_registration', label: 'Proof of Registration', description: 'Current year registration' },
];

const statusConfig = {
  draft: {
    label: 'Draft',
    icon: FileText,
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    iconColor: 'text-muted-foreground',
    description: 'Your application is saved but not submitted yet.',
  },
  pending: {
    label: 'Pending Review',
    icon: Clock,
    bgColor: 'bg-warning',
    textColor: 'text-warning-foreground',
    iconColor: 'text-warning-foreground',
    description: 'Your application has been submitted and is awaiting review.',
  },
  under_review: {
    label: 'Under Review',
    icon: AlertCircle,
    bgColor: 'bg-primary/10',
    textColor: 'text-primary',
    iconColor: 'text-primary',
    description: 'An administrator is currently reviewing your application.',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    bgColor: 'bg-success',
    textColor: 'text-success-foreground',
    iconColor: 'text-success-foreground',
    description: 'Congratulations! Your application has been approved.',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    bgColor: 'bg-destructive',
    textColor: 'text-destructive-foreground',
    iconColor: 'text-destructive-foreground',
    description: 'Your application has been reviewed and unfortunately not approved.',
  },
};

const ApplicationView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { setLoading, setMessage } = useLoading();
  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [offerAffidavitFile, setOfferAffidavitFile] = useState<File | null>(null);
  const [offerPersonalFormFile, setOfferPersonalFormFile] = useState<File | null>(null);
  const [isUploadingOfferDocs, setIsUploadingOfferDocs] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  logger.log('ApplicationView rendered');

  const loadApplication = async () => {
    logger.log('Starting loadApplication');
    setMessage('Loading your application...');
    setLoading(true);
    try {
      logger.log('Making Supabase query...');
      const { data, error } = await supabase
        .from('tutor_applications')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      logger.log('Query result received');

      if (error) {
        logger.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        logger.log('No application data found');
        toast.error('Application not found');
        navigate('/dashboard');
        return;
      }

      logger.log('Setting application data');
      setApplication(data);

      // Load documents
      logger.log('Loading documents...');
      const { data: docs, error: docsError } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', id);

      logger.log('Documents query completed');

      if (!docsError && docs) {
        setUploadedDocuments(docs);
      }

      logger.log('Application loaded successfully');
      // Clear the timeout since loading completed successfully
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    } catch (error) {
      logger.error('Error in loadApplication:', error);
      toast.error('Failed to load application');
      navigate('/dashboard');
    } finally {
      logger.log('Setting isLoading to false');
      setIsLoading(false);
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const handleSignOut = async () => {
    setMessage('Signing you out...');
    setLoading(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
      // Add a small delay to ensure auth state is cleared before navigation
      await new Promise(resolve => setTimeout(resolve, 500));
      navigate('/auth');
    } catch (error) {
      toast.error('Failed to sign out');
    } finally {
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const downloadTemplateFile = async (fileName: 'tutor_personal_form.pdf' | 'offer_affidavit.pdf', displayName: string) => {
    try {
      setLoading(true);
      setMessage(`Downloading ${displayName}...`);
      const { data, error } = await supabase.storage.from('offer-templates').download(fileName);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${displayName}`);
    } catch (err) {
      logger.error(`Error downloading ${fileName}:`, err);
      toast.error(`Failed to download ${displayName}`);
    } finally {
      setLoading(false);
      setMessage('Loading...');
    }
  };

  useEffect(() => {
    logger.log('useEffect triggered');
    if (!user || !id) return;
    loadApplication();

    // Fallback timeout in case loading gets stuck
    loadingTimeoutRef.current = setTimeout(() => {
      logger.log('Loading timeout reached, showing error');
      setIsLoading(false);
      toast.error('Loading timed out. Please check your connection and try again.');
      loadingTimeoutRef.current = null;
    }, 5000); // 5 seconds

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [user, id]);

  // If no user, show a message
  if (!user) {
    return (
      <div style={{ backgroundColor: 'white', color: 'black', padding: '20px' }}>
        <h1>Not authenticated</h1>
        <p>Please log in first</p>
      </div>
    );
  }

  // If no id, show a message
  if (!id) {
    return (
      <div style={{ backgroundColor: 'white', color: 'black', padding: '20px' }}>
        <h1>No application ID</h1>
        <p>Invalid application ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Application Not Found</h1>
          <Link to="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.draft;

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#3b82f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UFHLogo />
              </div>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>UFH Tutors</h1>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>University of Fort Hare</p>
              </div>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Welcome, {user?.user_metadata?.full_name || user?.email}</span>
              <button 
                onClick={handleSignOut}
                style={{ backgroundColor: 'transparent', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '0.375rem', color: '#6b7280', cursor: 'pointer' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
            {/* Offer Documents (Applicant Upload / Instructions) */}
            {application.offer_status === 'WITHDRAWN' && (
              <div style={{ backgroundColor: '#fee2e2', borderRadius: '0.5rem', padding: '1rem', marginBottom: '2rem' }}>
                <p style={{ color: '#b91c1c', margin: 0 }}>Your offer has been withdrawn by the administrator.</p>
              </div>
            )}
            {(application.offer_status === 'SENT' || application.offer_status === 'RESUBMISSION_REQUIRED') && (
              <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
                <div style={{ padding: '1.5rem' }}>
                  <h2
                    style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem', cursor: 'pointer' }}
                    onClick={() => {
                      const el = document.getElementById('documents-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title="Click to jump to required documents"
                  >
                    Offer Acceptance Documents
                  </h2>
                  {application.offer_status === 'RESUBMISSION_REQUIRED' && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #fde68a', borderRadius: '0.375rem' }}>
                      <p style={{ color: '#92400e' }}>Your documents were rejected: {application.document_rejection_reason}</p>
                      <p style={{ color: '#92400e' }}>Please correct and re-upload the signed documents.</p>
                    </div>
                  )}
                  <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                    Download the two forms, print and sign them before uploading signed copies: the Tutor Personal Information Form and the Student Tutor/Assistance Acceptance of Post Form/Affidavit.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                      onClick={() => downloadTemplateFile('tutor_personal_form.pdf', 'Tutor Personal Information Form')}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Download size={16} />
                      Download Personal Form
                    </button>
                    <button
                      onClick={() => downloadTemplateFile('offer_affidavit.pdf', 'Offer Acceptance Affidavit')}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Download size={16} />
                      Download Affidavit
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>Signed Acceptance Affidavit (PDF)</label>
                      <input disabled={isUploadingOfferDocs} accept="application/pdf" type="file" onChange={(e) => setOfferAffidavitFile(e.target.files?.[0] || null)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>Signed Personal Info Form (PDF)</label>
                      <input disabled={isUploadingOfferDocs} accept="application/pdf" type="file" onChange={(e) => setOfferPersonalFormFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem' }}>
                    Make sure the file names clearly describe the document (e.g. "Affidavit_Signed.pdf").
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                      disabled={isUploadingOfferDocs}
                      onClick={async () => {
                        // if no new files selected, allow if there are already uploaded offer docs
                        if (!offerAffidavitFile && !offerPersonalFormFile) {
                          const hasAff = uploadedDocuments.some(d => d.document_type === 'offer_affidavit');
                          const hasPer = uploadedDocuments.some(d => d.document_type === 'offer_personal_info');
                          if (!hasAff && !hasPer) {
                            toast.error('Please choose at least one PDF to upload');
                            return;
                          }
                        }
                        setIsUploadingOfferDocs(true);
                        setMessage('Uploading signed documents...');
                        setLoading(true);
                        try {
                          const uploads: UploadedDocument[] = [];
                          const nowTs = Date.now();
                          if (offerAffidavitFile) {
                            if (offerAffidavitFile.type !== 'application/pdf') throw new Error('Affidavit must be a PDF');
                            const path = `${id}/offer_affidavit_${nowTs}.pdf`;
                            const { data, error } = await supabase.storage.from('application-documents').upload(path, offerAffidavitFile, { contentType: 'application/pdf' });
                            if (error) throw error;
                            // insert metadata
                            const { error: insErr } = await supabase.from('application_documents').insert({ application_id: id, document_type: 'offer_affidavit', file_name: offerAffidavitFile.name, file_path: path, file_size: offerAffidavitFile.size, mime_type: 'application/pdf' } as any);
                            if (insErr) throw insErr;
                            uploads.push({ document_type: 'offer_affidavit', file_name: offerAffidavitFile.name, file_path: path, file_size: offerAffidavitFile.size, mime_type: 'application/pdf' });
                          }
                          if (offerPersonalFormFile) {
                            if (offerPersonalFormFile.type !== 'application/pdf') throw new Error('Personal info form must be a PDF');
                            const path = `${id}/offer_personal_info_${nowTs}.pdf`;
                            const { data, error } = await supabase.storage.from('application-documents').upload(path, offerPersonalFormFile, { contentType: 'application/pdf' });
                            if (error) throw error;
                            const { error: insErr } = await supabase.from('application_documents').insert({ application_id: id, document_type: 'offer_personal_info', file_name: offerPersonalFormFile.name, file_path: path, file_size: offerPersonalFormFile.size, mime_type: 'application/pdf' } as any);
                            if (insErr) throw insErr;
                            uploads.push({ document_type: 'offer_personal_info', file_name: offerPersonalFormFile.name, file_path: path, file_size: offerPersonalFormFile.size, mime_type: 'application/pdf' });
                          }

                          // Update application status (if resubmission, increment counters)
                          const updates: any = { offer_status: 'SIGNED_UPLOADED' };
                          if (application.offer_status === 'RESUBMISSION_REQUIRED') {
                            updates.resubmission_count = (application.resubmission_count || 0) + 1;
                            updates.last_resubmitted_at = new Date().toISOString();
                          }
                          const { error: appErr } = await supabase.from('tutor_applications').update(updates as any).eq('id', id);
                          if (appErr) throw appErr;

                          toast.success('Documents uploaded successfully');
                          // Refresh documents list
                          const { data: docs, error: docsError } = await supabase.from('application_documents').select('*').eq('application_id', id);
                          if (!docsError && docs) setUploadedDocuments(docs);
                          // update local application state
                          setApplication((prev: any) => ({ ...prev, ...updates }));
                        } catch (err: any) {
                          logger.error('Error uploading offer documents:', err);
                          toast.error(err.message || 'Failed to upload documents');
                        } finally {
                          setIsUploadingOfferDocs(false);
                          setLoading(false);
                          setMessage('Loading...');
                        }
                      }}
                      style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none' }}
                    >
                      {isUploadingOfferDocs ? 'Uploading...' : 'Upload Signed Documents'}
                    </button>
                  </div>
                </div>
              </div>
            )}
      </header>

      {/* Status Banner */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>📄</span>
              </div>
              <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937' }}>Application Details</h1>
                <p style={{ color: '#6b7280' }}>{currentStatus?.description}</p>
              </div>
            </div>
            <div style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: '500' }}>
              {currentStatus?.label}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Back Button and Edit Button */}
          <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/dashboard">
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', border: '1px solid #d1d5db', padding: '0.75rem 1.5rem', borderRadius: '0.375rem', color: '#6b7280', textDecoration: 'none', cursor: 'pointer' }}>
                ← Back to Dashboard
              </button>
            </Link>
            {(application.status === 'draft' || application.status === 'pending') && (
              <Link to={`/application/${id}/edit`}>
                <button style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#3b82f6', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.375rem', color: 'white', textDecoration: 'none', cursor: 'pointer', fontWeight: '500' }}>
                  ✏️ Edit Application
                </button>
              </Link>
            )}
          </div>

          {/* Personal Information */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                👤 Personal Information
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Full Name</label>
                  <p style={{ color: '#1f2937' }}>{application.full_name}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Student Number</label>
                  <p style={{ color: '#1f2937' }}>{application.student_number}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Date of Birth</label>
                  <p style={{ color: '#1f2937' }}>{application.date_of_birth}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Gender</label>
                  <p style={{ color: '#1f2937' }}>{application.gender || 'Not specified'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Nationality</label>
                  <p style={{ color: '#1f2937' }}>{application.nationality}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Contact Number</label>
                  <p style={{ color: '#1f2937' }}>{application.contact_number}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Residential Address</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{application.residential_address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📚 Academic Information
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Degree Program</label>
                  <p style={{ color: '#1f2937' }}>{application.degree_program}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Faculty</label>
                  <p style={{ color: '#1f2937' }}>{application.faculty}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Department</label>
                  <p style={{ color: '#1f2937' }}>{application.department}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Year of Study</label>
                  <p style={{ color: '#1f2937' }}>Year {application.year_of_study}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Subjects Completed</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{application.subjects_completed}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Subjects to Tutor</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{application.subjects_to_tutor}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Experience & Skills */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💼 Experience & Skills
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Previous Tutoring Experience</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{application.previous_tutoring_experience || 'None specified'}</p>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Work Experience</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{application.work_experience || 'None specified'}</p>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Skills & Competencies</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{application.skills_competencies}</p>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Languages Spoken</label>
                  <p style={{ color: '#1f2937' }}>{application.languages_spoken}</p>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Availability</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{typeof application.availability === 'object' ? application.availability?.description : application.availability}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Motivation Letter</label>
                  <p style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{application.motivation_letter}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div id="documents-section" style={{ backgroundColor: '#374151', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem', color: 'white' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📎 Documents
              </h2>
              <p style={{ color: '#d1d5db', marginBottom: '1rem' }}>
                Required documents for your application – please give each file a descriptive name (e.g. "ID_Copy.pdf") so administrators can identify them easily.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {REQUIRED_DOCUMENTS.map((doc) => {
                  const uploaded = uploadedDocuments.find(d => d.document_type === doc.type);
                  return (
                    <div key={doc.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', marginBottom: '1rem' }}>
                      <div>
                        <h4 style={{ fontWeight: '500', color: '#1f2937' }}>{doc.label}</h4>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{doc.description}</p>
                        {uploaded && (
                          <p style={{ fontSize: '0.875rem', color: '#059669', marginTop: '0.25rem' }}>
                            ✓ Uploaded: {uploaded.file_name}
                          </p>
                        )}
                      </div>
                      <div>
                        {uploaded ? (
                          <button 
                            style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.storage
                                  .from('application-documents')
                                  .download(uploaded.file_path);
                                if (error) throw error;
                                const url = URL.createObjectURL(data);
                                window.open(url, '_blank');
                              } catch (err) {
                                console.error('Error viewing document:', err);
                                toast.error('Failed to open document');
                              }
                            }}
                          >
                            View
                          </button>
                        ) : (
                          <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>Not Uploaded</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Application Timeline */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem' }}>Application Timeline</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
                  <div>
                    <p style={{ fontWeight: '500', color: '#1f2937' }}>Application Created</p>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {new Date(application.created_at).toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                {application.submitted_at && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></div>
                    <div>
                      <p style={{ fontWeight: '500', color: '#1f2937' }}>Application Submitted</p>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {new Date(application.submitted_at).toLocaleDateString('en-ZA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {application.status === 'approved' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
                    <div>
                      <p style={{ fontWeight: '500', color: '#1f2937' }}>Application Approved</p>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Congratulations!</p>
                    </div>
                  </div>
                )}
                {application.status === 'rejected' && application.rejection_reason && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '50%' }}></div>
                    <div>
                      <p style={{ fontWeight: '500', color: '#1f2937' }}>Application Rejected</p>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{application.rejection_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApplicationView;