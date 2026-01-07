import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  GraduationCap, 
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
  XCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    color: 'bg-gray-100 text-gray-800',
    description: 'Your application is saved but not submitted yet.',
  },
  pending: {
    label: 'Pending Review',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Your application has been submitted and is awaiting review.',
  },
  under_review: {
    label: 'Under Review',
    icon: AlertCircle,
    color: 'bg-blue-100 text-blue-800',
    description: 'An administrator is currently reviewing your application.',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    color: 'bg-green-100 text-green-800',
    description: 'Congratulations! Your application has been approved.',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    color: 'bg-red-100 text-red-800',
    description: 'Your application has been reviewed and unfortunately not approved.',
  },
};

const ApplicationView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!id) {
      navigate('/dashboard');
      return;
    }

    loadApplication();
  }, [user, id, navigate]);

  const loadApplication = async () => {
    try {
      const { data, error } = await supabase
        .from('tutor_applications')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (!data) {
        toast.error('Application not found');
        navigate('/dashboard');
        return;
      }

      setApplication(data);

      // Load documents
      const { data: docs, error: docsError } = await supabase
        .from('application_documents')
        .select('*')
        .eq('application_id', id);

      if (!docsError && docs) {
        setUploadedDocuments(docs);
      }

    } catch (error) {
      console.error('Error loading application:', error);
      toast.error('Failed to load application');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

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

  const currentStatus = statusConfig[application.status as keyof typeof statusConfig];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8" />
            <span className="font-bold text-xl">UFH Tutors</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {user?.user_metadata?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${currentStatus?.color.replace('text-', 'bg-').replace('-800', '-100')}`}>
                <currentStatus.icon className={`w-6 h-6 ${currentStatus?.color.replace('bg-', 'text-').replace('-100', '-600')}`} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Application Details</h1>
                <p className="text-muted-foreground">{currentStatus?.description}</p>
              </div>
            </div>
            <Badge className={currentStatus?.color}>
              {currentStatus?.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button */}
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <p className="text-foreground">{application.full_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Student Number</label>
                    <p className="text-foreground">{application.student_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                    <p className="text-foreground">{application.date_of_birth}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <p className="text-foreground">{application.gender || 'Not specified'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nationality</label>
                    <p className="text-foreground">{application.nationality}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Residential Address</label>
                    <p className="text-foreground whitespace-pre-wrap">{application.residential_address}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Contact Number</label>
                    <p className="text-foreground">{application.contact_number}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Academic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Academic Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Degree Program</label>
                    <p className="text-foreground">{application.degree_program}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Faculty</label>
                    <p className="text-foreground">{application.faculty}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Department</label>
                    <p className="text-foreground">{application.department}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Year of Study</label>
                    <p className="text-foreground">Year {application.year_of_study}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Subjects Completed</label>
                    <p className="text-foreground whitespace-pre-wrap">{application.subjects_completed}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Subjects to Tutor</label>
                    <p className="text-foreground whitespace-pre-wrap">{application.subjects_to_tutor}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Experience & Skills */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Experience & Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Previous Tutoring Experience</label>
                  <p className="text-foreground whitespace-pre-wrap mt-1">
                    {application.previous_tutoring_experience || 'None specified'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Work Experience</label>
                  <p className="text-foreground whitespace-pre-wrap mt-1">
                    {application.work_experience || 'None specified'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Skills & Competencies</label>
                  <p className="text-foreground whitespace-pre-wrap mt-1">{application.skills_competencies}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Languages Spoken</label>
                  <p className="text-foreground mt-1">{application.languages_spoken}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Availability</label>
                  <p className="text-foreground whitespace-pre-wrap mt-1">{application.availability}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Motivation Letter</label>
                  <p className="text-foreground whitespace-pre-wrap mt-1">{application.motivation_letter}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Documents
              </CardTitle>
              <CardDescription>
                Required documents for your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {REQUIRED_DOCUMENTS.map((doc) => {
                  const uploaded = uploadedDocuments.find(d => d.document_type === doc.type);
                  return (
                    <div key={doc.type} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{doc.label}</h4>
                        <p className="text-sm text-muted-foreground">{doc.description}</p>
                        {uploaded && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ Uploaded: {uploaded.file_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {uploaded ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {/* Handle view/download */}}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        ) : (
                          <Badge variant="destructive">Not Uploaded</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Application Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Application Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">Application Created</p>
                    <p className="text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">Application Submitted</p>
                      <p className="text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">Application Approved</p>
                      <p className="text-sm text-muted-foreground">Congratulations!</p>
                    </div>
                  </div>
                )}
                {application.status === 'rejected' && application.rejection_reason && (
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">Application Rejected</p>
                      <p className="text-sm text-muted-foreground">{application.rejection_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ApplicationView;