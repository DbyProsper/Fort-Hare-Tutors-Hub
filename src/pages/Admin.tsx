import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  GraduationCap, 
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
  Download
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Application {
  id: string;
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
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/dashboard');
        toast.error('Access denied. Admin privileges required.');
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchApplications();
    }
  }, [isAdmin]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('tutor_applications')
        .select('*')
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
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
      console.error('Error fetching documents:', error);
    }
  };

  const handleViewApplication = async (application: Application) => {
    setSelectedApplication(application);
    await fetchDocuments(application.id);
    setIsDialogOpen(true);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedApplication) return;

    if (newStatus === 'rejected' && !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsUpdating(true);

    try {
      const updateData: any = {
        status: newStatus,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };

      if (newStatus === 'rejected') {
        updateData.rejection_reason = rejectionReason;
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
      
      setIsDialogOpen(false);
      setIsRejecting(false);
      setRejectionReason('');
    } catch (error: any) {
      console.error('Error updating application:', error);
      toast.error(error.message || 'Failed to update application');
    } finally {
      setIsUpdating(false);
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
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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

  if (authLoading || isLoading) {
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
              <GraduationCap className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">UFH Tutors</h1>
              <p className="text-xs text-sidebar-foreground/70">Admin Dashboard</p>
            </div>
          </Link>
          <Button variant="ghost" onClick={handleSignOut} className="gap-2 text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
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
                        <p className="font-medium">{app.full_name}</p>
                        <p className="text-sm text-muted-foreground">{app.student_number} • {app.faculty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusConfig[app.status as keyof typeof statusConfig]?.color}>
                        {statusConfig[app.status as keyof typeof statusConfig]?.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground hidden md:block">
                        {app.submitted_at && new Date(app.submitted_at).toLocaleDateString('en-ZA')}
                      </span>
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
                        {selectedApplication.subjects_to_tutor?.map(subj => (
                          <Badge key={subj} variant="secondary">{subj}</Badge>
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
                        {selectedApplication.languages_spoken?.map(lang => (
                          <Badge key={lang} variant="outline">{lang}</Badge>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Skills</dt>
                      <dd className="flex flex-wrap gap-1 mt-1">
                        {selectedApplication.skills_competencies?.map(skill => (
                          <Badge key={skill} variant="outline">{skill}</Badge>
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

                {/* Documents */}
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
                </div>

                {/* Rejection Reason Input */}
                {isRejecting && (
                  <div>
                    <h4 className="font-semibold mb-3 text-destructive">Rejection Reason</h4>
                    <Textarea
                      placeholder="Please provide a reason for rejection. This will be visible to the applicant."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                )}
              </div>

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
