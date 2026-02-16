import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  GraduationCap, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  LogOut,
  Plus,
  Eye,
  Edit,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLoading } from '@/contexts/LoadingContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface Application {
  id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  rejection_reason: string | null;
  full_name: string;
  degree_program: string;
  faculty: string;
}

const statusConfig = {
  draft: {
    label: 'Draft',
    icon: FileText,
    color: 'status-draft',
    description: 'Your application is saved but not submitted yet.',
  },
  pending: {
    label: 'Pending Review',
    icon: Clock,
    color: 'status-pending',
    description: 'Your application has been submitted and is awaiting review.',
  },
  under_review: {
    label: 'Under Review',
    icon: AlertCircle,
    color: 'status-under-review',
    description: 'An administrator is currently reviewing your application.',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    color: 'status-approved',
    description: 'Congratulations! Your application has been approved.',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    color: 'status-rejected',
    description: 'Unfortunately, your application was not successful.',
  },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { setLoading, setMessage } = useLoading();
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchApplication();
    }
  }, [user]);

  const fetchApplication = async () => {
    setMessage('Loading your application...');
    setLoading(true);
    try {
      logger.log('Fetching application for user');
      if (!user?.id) {
        logger.warn('No user ID available for fetching application');
        setIsLoading(false);
        setLoading(false);
        setMessage('Loading...');
        return;
      }

      // First check if user has the student role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'student')
        .maybeSingle();

      logger.log('User role check completed');

      const { data, error } = await supabase
        .from('tutor_applications')
        .select('id, status, created_at, submitted_at, rejection_reason, full_name, degree_program, faculty')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      logger.log('Application fetch completed');

      if (error) {
        logger.error('Database error fetching application:', error);
        // Check if it's an RLS error
        if (error.code === 'PGRST301') {
          logger.error('RLS policy error - user may not have permission to read applications');
        }
        toast.error('Failed to load your application');
        return;
      }

      setApplication(data);
      logger.log('Application loaded successfully');
    } catch (error) {
      logger.error('Unexpected error fetching application:', error);
      toast.error('Failed to load your application');
    } finally {
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
      navigate('/auth');
      toast.success('Signed out successfully');
    } catch (error) {
      setLoading(false);
      setMessage('Loading...');
      toast.error('Failed to sign out');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentStatus = application ? statusConfig[application.status as keyof typeof statusConfig] : null;
  const StatusIcon = currentStatus?.icon || FileText;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">UFH Tutors</h1>
              <p className="text-xs text-muted-foreground">Student Dashboard</p>
            </div>
          </Link>
          <Button variant="ghost" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Welcome, {user?.user_metadata?.full_name || 'Student'}!
            </h2>
            <p className="text-muted-foreground">
              Manage your tutor application and track your progress here.
            </p>
          </div>

          {application ? (
            <div className="space-y-6">
              {/* Status Card */}
              <Card className="border-0 shadow-lg overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className={`h-2 ${
                  application.status === 'approved' ? 'bg-success' :
                  application.status === 'rejected' ? 'bg-destructive' :
                  application.status === 'under_review' ? 'bg-primary' :
                  application.status === 'pending' ? 'bg-warning' : 'bg-muted'
                }`} />
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        application.status === 'approved' ? 'bg-success/10' :
                        application.status === 'rejected' ? 'bg-destructive/10' :
                        application.status === 'under_review' ? 'bg-primary/10' :
                        application.status === 'pending' ? 'bg-warning/10' : 'bg-muted'
                      }`}>
                        <StatusIcon className={`w-7 h-7 ${
                          application.status === 'approved' ? 'text-success' :
                          application.status === 'rejected' ? 'text-destructive' :
                          application.status === 'under_review' ? 'text-primary' :
                          application.status === 'pending' ? 'text-warning' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Application Status</CardTitle>
                        <Badge className={`mt-1 ${currentStatus?.color}`}>
                          {currentStatus?.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/application/${application.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </Link>
                      {(application.status === 'draft' || application.status === 'pending') && (
                        <Link to={`/application/${application.id}/edit`}>
                          <Button size="sm" className="gap-2">
                            <Edit className="w-4 h-4" />
                            Edit
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {currentStatus?.description}
                  </p>
                  
                  {/* Progress Tracker */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium text-sm text-muted-foreground mb-4">Application Progress</h4>
                    <div className="flex items-center justify-between relative">
                      <div className="absolute top-5 left-8 right-8 h-0.5 bg-border" />
                      <div className="absolute top-5 left-8 h-0.5 bg-primary transition-all" style={{
                        width: application.status === 'draft' ? '0%' :
                               application.status === 'pending' ? '33%' :
                               application.status === 'under_review' ? '66%' : '100%'
                      }} />
                      
                      {['Submitted', 'Under Review', 'Decision'].map((step, index) => {
                        const stepIndex = ['pending', 'under_review', 'approved'].indexOf(application.status);
                        const isCompleted = index < stepIndex || application.status === 'approved' || application.status === 'rejected';
                        const isCurrent = (application.status === 'pending' && index === 0) ||
                                         (application.status === 'under_review' && index === 1) ||
                                         ((application.status === 'approved' || application.status === 'rejected') && index === 2);
                        
                        return (
                          <div key={step} className="flex flex-col items-center relative z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                              isCompleted || isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}>
                              {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                            </div>
                            <span className={`text-xs mt-2 ${isCurrent ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rejection Reason Alert */}
              {application.status === 'rejected' && application.rejection_reason && (
                <Alert variant="destructive" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Reason for Rejection</AlertTitle>
                  <AlertDescription>{application.rejection_reason}</AlertDescription>
                </Alert>
              )}

              {/* Application Summary */}
              <Card className="border-0 shadow-md animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <CardHeader>
                  <CardTitle className="text-lg">Application Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-muted-foreground">Full Name</dt>
                      <dd className="font-medium">{application.full_name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Faculty</dt>
                      <dd className="font-medium">{application.faculty}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Degree Program</dt>
                      <dd className="font-medium">{application.degree_program}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Submitted</dt>
                      <dd className="font-medium">
                        {application.submitted_at 
                          ? new Date(application.submitted_at).toLocaleDateString('en-ZA', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'Not yet submitted'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* No Application State */
            <Card className="border-0 shadow-lg text-center animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="py-16">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">No Application Yet</CardTitle>
                <CardDescription className="mb-8 max-w-md mx-auto">
                  Start your journey to becoming a UFH tutor. Complete your application to get started.
                </CardDescription>
                <Link to="/apply">
                  <Button size="lg" className="btn-gradient-primary text-primary-foreground gap-2">
                    <Plus className="w-5 h-5" />
                    Start Application
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
