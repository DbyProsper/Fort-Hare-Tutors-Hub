import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  GraduationCap, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  User, 
  BookOpen, 
  Briefcase, 
  Upload, 
  CheckCircle2,
  Save,
  Send,
  X,
  FileText,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FACULTIES = [
  'Faculty of Education',
  'Faculty of Health Sciences',
  'Faculty of Law',
  'Faculty of Management and Commerce',
  'Faculty of Science and Agriculture',
  'Faculty of Social Sciences and Humanities',
];

const DEPARTMENTS = {
  'Faculty of Education': ['Educational Foundations', 'Educational Psychology', 'Curriculum Studies'],
  'Faculty of Health Sciences': ['Human Movement Science', 'Nursing Science', 'Pharmacy'],
  'Faculty of Law': ['Mercantile Law', 'Private Law', 'Public Law'],
  'Faculty of Management and Commerce': ['Accounting', 'Business Management', 'Economics', 'Industrial Psychology'],
  'Faculty of Science and Agriculture': ['Agricultural Economics', 'Biochemistry', 'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Statistics'],
  'Faculty of Social Sciences and Humanities': ['Anthropology', 'Communication', 'History', 'Philosophy', 'Political Science', 'Psychology', 'Sociology'],
};

const applicationSchema = z.object({
  // Personal Information
  full_name: z.string().min(2, 'Full name is required').max(100),
  student_number: z.string().min(5, 'Valid student number is required').max(20),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  nationality: z.string().min(2, 'Nationality is required'),
  residential_address: z.string().min(10, 'Full address is required'),
  contact_number: z.string().min(10, 'Valid contact number is required').max(15),
  
  // Academic Information
  degree_program: z.string().min(2, 'Degree program is required'),
  faculty: z.string().min(1, 'Faculty is required'),
  department: z.string().min(1, 'Department is required'),
  year_of_study: z.coerce.number().min(1).max(7),
  subjects_completed: z.string().min(1, 'List at least one subject'),
  subjects_to_tutor: z.string().min(1, 'List at least one subject'),
  
  // Employment Information
  previous_tutoring_experience: z.string().optional(),
  work_experience: z.string().optional(),
  skills_competencies: z.string().min(1, 'List your skills'),
  languages_spoken: z.string().min(1, 'List languages you speak'),
  availability: z.string().min(1, 'Describe your availability'),
  motivation_letter: z.string().min(100, 'Motivation letter must be at least 100 characters').max(2000),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

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

const STEPS = [
  { id: 1, title: 'Personal Info', icon: User },
  { id: 2, title: 'Academic Info', icon: BookOpen },
  { id: 3, title: 'Experience', icon: Briefcase },
  { id: 4, title: 'Documents', icon: Upload },
  { id: 5, title: 'Review', icon: CheckCircle2 },
];

const EditApplication = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      full_name: '',
      student_number: '',
      date_of_birth: '',
      gender: undefined,
      nationality: '',
      residential_address: '',
      contact_number: '',
      degree_program: '',
      faculty: '',
      department: '',
      year_of_study: 1,
      subjects_completed: '',
      subjects_to_tutor: '',
      previous_tutoring_experience: '',
      work_experience: '',
      skills_competencies: '',
      languages_spoken: '',
      availability: '',
      motivation_letter: '',
    },
  });

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

      // Check if application can be edited
      if (data.status !== 'draft' && data.status !== 'pending') {
        toast.error('This application cannot be edited');
        navigate('/dashboard');
        return;
      }

      setApplication(data);
      form.reset({
        full_name: data.full_name || '',
        student_number: data.student_number || '',
        date_of_birth: data.date_of_birth || '',
        gender: data.gender,
        nationality: data.nationality || '',
        residential_address: data.residential_address || '',
        contact_number: data.contact_number || '',
        degree_program: data.degree_program || '',
        faculty: data.faculty || '',
        department: data.department || '',
        year_of_study: data.year_of_study || 1,
        subjects_completed: Array.isArray(data.subjects_completed) ? data.subjects_completed.join(', ') : (data.subjects_completed || ''),
        subjects_to_tutor: Array.isArray(data.subjects_to_tutor) ? data.subjects_to_tutor.join(', ') : (data.subjects_to_tutor || ''),
        previous_tutoring_experience: data.previous_tutoring_experience || '',
        work_experience: data.work_experience || '',
        skills_competencies: Array.isArray(data.skills_competencies) ? data.skills_competencies.join(', ') : (data.skills_competencies || ''),
        languages_spoken: Array.isArray(data.languages_spoken) ? data.languages_spoken.join(', ') : (data.languages_spoken || ''),
        availability: typeof data.availability === 'object' && data.availability !== null && !Array.isArray(data.availability) ? ((data.availability as Record<string, unknown>)?.description as string || JSON.stringify(data.availability)) : String(data.availability || ''),
        motivation_letter: data.motivation_letter || '',
      });

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

  const nextStep = () => {
    const fields = getFieldsForStep(currentStep);
    const isValid = form.trigger(fields);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const getFieldsForStep = (step: number): (keyof ApplicationFormData)[] => {
    switch (step) {
      case 1:
        return ['full_name', 'student_number', 'date_of_birth', 'gender', 'nationality', 'residential_address', 'contact_number'];
      case 2:
        return ['degree_program', 'faculty', 'department', 'year_of_study', 'subjects_completed', 'subjects_to_tutor'];
      case 3:
        return ['previous_tutoring_experience', 'work_experience', 'skills_competencies', 'languages_spoken', 'availability', 'motivation_letter'];
      default:
        return [];
    }
  };

  const handleSubmit = async (data: ApplicationFormData) => {
    if (!application) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tutor_applications')
        .update({
          full_name: data.full_name,
          student_number: data.student_number,
          date_of_birth: data.date_of_birth,
          gender: data.gender || null,
          nationality: data.nationality,
          residential_address: data.residential_address,
          contact_number: data.contact_number,
          degree_program: data.degree_program,
          faculty: data.faculty,
          department: data.department,
          year_of_study: data.year_of_study,
          subjects_completed: data.subjects_completed.split(',').map(s => s.trim()).filter(Boolean),
          subjects_to_tutor: data.subjects_to_tutor.split(',').map(s => s.trim()).filter(Boolean),
          previous_tutoring_experience: data.previous_tutoring_experience || null,
          work_experience: data.work_experience || null,
          skills_competencies: data.skills_competencies.split(',').map(s => s.trim()).filter(Boolean),
          languages_spoken: data.languages_spoken.split(',').map(s => s.trim()).filter(Boolean),
          availability: { description: data.availability },
          motivation_letter: data.motivation_letter,
          updated_at: new Date().toISOString(),
        })
        .eq('id', application.id);

      if (error) throw error;

      toast.success('Application updated successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error updating application:', error);
      toast.error('Failed to update application');
    } finally {
      setIsSubmitting(false);
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

  const selectedFaculty = form.watch('faculty');
  const progress = (currentStep / 5) * 100;

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

      {/* Progress Bar */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold">Edit Application</h1>
            <Badge variant="outline">Step {currentStep} of 5</Badge>
          </div>
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between mt-2">
            {STEPS.map((step) => (
              <div key={step.id} className={`flex items-center gap-2 text-sm ${currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                <step.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>
                      Please provide your personal details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="student_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 202100001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="date_of_birth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nationality *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. South African" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="residential_address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Residential Address *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter your full residential address"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contact_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. +27 12 345 6789" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Academic Information */}
              {currentStep === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Academic Information
                    </CardTitle>
                    <CardDescription>
                      Tell us about your academic background
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="degree_program"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Degree Program *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Bachelor of Science in Computer Science" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="faculty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Faculty *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select faculty" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {FACULTIES.map((faculty) => (
                                  <SelectItem key={faculty} value={faculty}>
                                    {faculty}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedFaculty}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {selectedFaculty && DEPARTMENTS[selectedFaculty as keyof typeof DEPARTMENTS]?.map((dept) => (
                                  <SelectItem key={dept} value={dept}>
                                    {dept}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="year_of_study"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year of Study *</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7].map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  Year {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subjects_completed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subjects Completed *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="List subjects you've completed with good grades"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            List subjects you've completed successfully
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subjects_to_tutor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subjects You Want to Tutor *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="List subjects you're confident to tutor"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Subjects you feel qualified to teach
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Experience */}
              {currentStep === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5" />
                      Experience & Skills
                    </CardTitle>
                    <CardDescription>
                      Share your experience and skills
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="previous_tutoring_experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous Tutoring Experience</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe any previous tutoring experience"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            If none, you can leave this blank
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="work_experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Experience</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your work experience"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Any relevant work experience
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="skills_competencies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Skills & Competencies *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="List your skills and competencies"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Teaching skills, communication skills, etc.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="languages_spoken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Languages Spoken *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. English, Afrikaans, Xhosa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="availability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Availability *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your availability for tutoring"
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Days and times you're available
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="motivation_letter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Motivation Letter *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Why do you want to be a tutor?"
                              className="min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum 100 characters. Explain your motivation for becoming a tutor.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 4: Documents */}
              {currentStep === 4 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Documents
                    </CardTitle>
                    <CardDescription>
                      Upload required documents
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {/* Handle upload */}}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 5: Review */}
              {currentStep === 5 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Review Your Application
                    </CardTitle>
                    <CardDescription>
                      Please review all information before submitting
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Personal Info Summary */}
                      <div>
                        <h3 className="font-semibold mb-2">Personal Information</h3>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div><strong>Name:</strong> {form.watch('full_name')}</div>
                          <div><strong>Student Number:</strong> {form.watch('student_number')}</div>
                          <div><strong>Date of Birth:</strong> {form.watch('date_of_birth')}</div>
                          <div><strong>Gender:</strong> {form.watch('gender') || 'Not specified'}</div>
                          <div><strong>Nationality:</strong> {form.watch('nationality')}</div>
                          <div><strong>Contact:</strong> {form.watch('contact_number')}</div>
                        </div>
                      </div>

                      {/* Academic Info Summary */}
                      <div>
                        <h3 className="font-semibold mb-2">Academic Information</h3>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div><strong>Degree:</strong> {form.watch('degree_program')}</div>
                          <div><strong>Faculty:</strong> {form.watch('faculty')}</div>
                          <div><strong>Department:</strong> {form.watch('department')}</div>
                          <div><strong>Year:</strong> {form.watch('year_of_study')}</div>
                        </div>
                      </div>

                      {/* Documents Summary */}
                      <div>
                        <h3 className="font-semibold mb-2">Documents</h3>
                        <div className="space-y-2">
                          {REQUIRED_DOCUMENTS.map((doc) => {
                            const uploaded = uploadedDocuments.find(d => d.document_type === doc.type);
                            return (
                              <div key={doc.type} className="flex items-center gap-2 text-sm">
                                {uploaded ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                  <X className="w-4 h-4 text-red-500" />
                                )}
                                {doc.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation */}
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                
                {currentStep < 5 ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    className="btn-gradient-accent text-accent-foreground"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Update Application
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
};

export default EditApplication;