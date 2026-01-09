import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

const Apply = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      full_name: '',
      student_number: '',
      date_of_birth: '',
      nationality: 'South African',
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
      languages_spoken: 'English',
      availability: '',
      motivation_letter: '',
    },
  });

  const selectedFaculty = form.watch('faculty');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      form.setValue('full_name', user.user_metadata?.full_name || '');
      checkExistingApplication();
    }
  }, [user]);

  const checkExistingApplication = async () => {
    try {
      const { data, error } = await supabase
        .from('tutor_applications')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'draft')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setApplicationId(data.id);
        // Populate form with existing data
        form.reset({
          full_name: data.full_name,
          student_number: data.student_number,
          date_of_birth: data.date_of_birth,
          gender: data.gender || undefined,
          nationality: data.nationality,
          residential_address: data.residential_address,
          contact_number: data.contact_number,
          degree_program: data.degree_program,
          faculty: data.faculty,
          department: data.department,
          year_of_study: data.year_of_study,
          subjects_completed: data.subjects_completed?.join(', ') || '',
          subjects_to_tutor: data.subjects_to_tutor?.join(', ') || '',
          previous_tutoring_experience: data.previous_tutoring_experience || '',
          work_experience: data.work_experience || '',
          skills_competencies: data.skills_competencies?.join(', ') || '',
          languages_spoken: data.languages_spoken?.join(', ') || '',
          availability: typeof data.availability === 'object' && data.availability !== null && !Array.isArray(data.availability) ? ((data.availability as Record<string, unknown>)?.description as string || JSON.stringify(data.availability)) : String(data.availability || '{}'),
          motivation_letter: data.motivation_letter,
        });

        // Fetch uploaded documents
        const { data: docs } = await supabase
          .from('application_documents')
          .select('*')
          .eq('application_id', data.id);

        if (docs) {
          setUploadedDocuments(docs);
        }

        toast.info('Continuing from your saved draft');
      }
    } catch (error) {
      console.error('Error checking existing application:', error);
    }
  };

  const handleSaveDraft = async () => {
    console.log('Starting save draft, user:', user, 'applicationId:', applicationId);

    if (!user) {
      toast.error('You must be logged in to save a draft');
      return;
    }

    // Check if form is valid for basic required fields
    const formData = form.getValues();
    const basicFieldsValid = formData.full_name && formData.email;

    if (!basicFieldsValid) {
      toast.error('Please fill in at least your name and email before saving');
      return;
    }

    setIsSaving(true);
    try {
      const formData = form.getValues();
      console.log('Form data:', formData);

      const applicationData = {
        user_id: user?.id,
        full_name: formData.full_name || 'Draft',
        student_number: formData.student_number || 'Draft',
        date_of_birth: formData.date_of_birth ? new Date(formData.date_of_birth).toISOString().split('T')[0] : '2000-01-01', // Default date for drafts
        gender: formData.gender || null,
        nationality: formData.nationality || 'Draft',
        residential_address: formData.residential_address || 'Draft',
        contact_number: formData.contact_number || 'Draft',
        email: user?.email || '',
        degree_program: formData.degree_program || 'Draft',
        faculty: formData.faculty || 'Draft',
        department: formData.department || 'Draft',
        year_of_study: formData.year_of_study || 1,
        subjects_completed: formData.subjects_completed?.split(',').map(s => s.trim()).filter(Boolean) || [],
        subjects_to_tutor: formData.subjects_to_tutor?.split(',').map(s => s.trim()).filter(Boolean) || [],
        previous_tutoring_experience: formData.previous_tutoring_experience || null,
        work_experience: formData.work_experience || null,
        skills_competencies: formData.skills_competencies?.split(',').map(s => s.trim()).filter(Boolean) || [],
        languages_spoken: formData.languages_spoken?.split(',').map(s => s.trim()).filter(Boolean) || [],
        availability: formData.availability ? (() => { try { return JSON.parse(formData.availability); } catch { return {}; } })() : {},
        motivation_letter: formData.motivation_letter || 'Draft',
        status: 'draft' as const,
      };

      console.log('Application data to save:', applicationData);

      if (applicationId) {
        console.log('Updating existing application:', applicationId);
        const { error } = await supabase
          .from('tutor_applications')
          .update(applicationData)
          .eq('id', applicationId);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        console.log('Update successful');
      } else {
        console.log('Inserting new application');
        const { data, error } = await supabase
          .from('tutor_applications')
          .insert(applicationData)
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        console.log('Insert successful, new ID:', data.id);
        setApplicationId(data.id);
      }

      toast.success('Draft saved successfully');
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error(error.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (documentType: string, file: File) => {
    if (!applicationId) {
      await handleSaveDraft();
    }

    const appId = applicationId;
    if (!appId) {
      toast.error('Please save your application first');
      return;
    }

    // Validate file
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(documentType);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/${appId}/${documentType}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('application-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Remove existing document of same type
      const existingDoc = uploadedDocuments.find(d => d.document_type === documentType);
      if (existingDoc?.id) {
        await supabase
          .from('application_documents')
          .delete()
          .eq('id', existingDoc.id);
      }

      // Save document record
      const { data: docData, error: docError } = await supabase
        .from('application_documents')
        .insert({
          application_id: appId,
          user_id: user?.id,
          document_type: documentType,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single();

      if (docError) throw docError;

      setUploadedDocuments(prev => [
        ...prev.filter(d => d.document_type !== documentType),
        docData,
      ]);

      toast.success('Document uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setIsUploading(null);
    }
  };

  const handleSubmit = async (data: ApplicationFormData) => {
    // Check all required documents are uploaded
    const missingDocs = REQUIRED_DOCUMENTS.filter(
      doc => !uploadedDocuments.find(d => d.document_type === doc.type)
    );

    if (missingDocs.length > 0) {
      toast.error(`Please upload: ${missingDocs.map(d => d.label).join(', ')}`);
      setCurrentStep(4);
      return;
    }

    setIsSubmitting(true);

    try {
      const applicationData = {
        user_id: user?.id,
        full_name: data.full_name,
        student_number: data.student_number,
        date_of_birth: data.date_of_birth,
        gender: data.gender || null,
        nationality: data.nationality,
        residential_address: data.residential_address,
        contact_number: data.contact_number,
        email: user?.email || '',
        degree_program: data.degree_program,
        faculty: data.faculty,
        department: data.department,
        year_of_study: data.year_of_study,
        subjects_completed: data.subjects_completed.split(',').map(s => s.trim()),
        subjects_to_tutor: data.subjects_to_tutor.split(',').map(s => s.trim()),
        previous_tutoring_experience: data.previous_tutoring_experience,
        work_experience: data.work_experience,
        skills_competencies: data.skills_competencies.split(',').map(s => s.trim()),
        languages_spoken: data.languages_spoken.split(',').map(s => s.trim()),
        availability: { description: data.availability },
        motivation_letter: data.motivation_letter,
        status: 'pending' as const,
        submitted_at: new Date().toISOString(),
      };

      if (applicationId) {
        const { error } = await supabase
          .from('tutor_applications')
          .update(applicationData)
          .eq('id', applicationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tutor_applications')
          .insert(applicationData);

        if (error) throw error;
      }

      toast.success('Application submitted successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = (currentStep / 5) * 100;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">UFH Tutors</h1>
              <p className="text-xs text-muted-foreground">Application Form</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Save Draft</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of 5</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-success text-success-foreground' : 'bg-muted'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                  </div>
                  <span className="text-xs hidden sm:block">{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <Card className="border-0 shadow-lg animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>Tell us about yourself</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="student_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Number *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 201900001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
                      <FormField
                        control={form.control}
                        name="nationality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nationality *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., South African" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="residential_address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Residential Address *</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter your full residential address" {...field} />
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
                            <Input type="tel" placeholder="e.g., 0821234567" {...field} />
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
                <Card className="border-0 shadow-lg animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      Academic Information
                    </CardTitle>
                    <CardDescription>Tell us about your studies</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="degree_program"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Degree Program *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Bachelor of Science in Computer Science" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="faculty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Faculty *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select faculty" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {FACULTIES.map(faculty => (
                                  <SelectItem key={faculty} value={faculty}>{faculty}</SelectItem>
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
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedFaculty}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {selectedFaculty && DEPARTMENTS[selectedFaculty as keyof typeof DEPARTMENTS]?.map(dept => (
                                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7].map(year => (
                                <SelectItem key={year} value={year.toString()}>Year {year}</SelectItem>
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
                          <FormLabel>Subjects/Modules Completed *</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="List subjects you've completed (comma-separated)"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Separate each subject with a comma</FormDescription>
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
                              placeholder="List subjects you want to tutor (comma-separated)"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Separate each subject with a comma</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Experience & Skills */}
              {currentStep === 3 && (
                <Card className="border-0 shadow-lg animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-primary" />
                      Experience & Skills
                    </CardTitle>
                    <CardDescription>Share your experience and competencies</CardDescription>
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
                              placeholder="Describe any previous tutoring experience (optional)"
                              {...field} 
                            />
                          </FormControl>
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
                              placeholder="Describe any relevant work experience (optional)"
                              {...field} 
                            />
                          </FormControl>
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
                              placeholder="e.g., Communication, Patience, Problem-solving"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Separate each skill with a comma</FormDescription>
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
                            <Input placeholder="e.g., English, Xhosa, Afrikaans" {...field} />
                          </FormControl>
                          <FormDescription>Separate each language with a comma</FormDescription>
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
                              placeholder="Describe your available days and times (e.g., Mondays and Wednesdays, 2pm-5pm)"
                              {...field} 
                            />
                          </FormControl>
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
                              placeholder="Tell us why you want to become a tutor and what you can offer..."
                              className="min-h-[150px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Minimum 100 characters</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 4: Documents */}
              {currentStep === 4 && (
                <Card className="border-0 shadow-lg animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-primary" />
                      Required Documents
                    </CardTitle>
                    <CardDescription>Upload the following documents (PDF, JPG, or PNG, max 5MB each)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {REQUIRED_DOCUMENTS.map((doc) => {
                      const uploaded = uploadedDocuments.find(d => d.document_type === doc.type);
                      return (
                        <div 
                          key={doc.type}
                          className={`p-4 rounded-lg border-2 border-dashed transition-colors ${
                            uploaded ? 'border-success bg-success/5' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{doc.label}</span>
                                {uploaded && <Badge variant="outline" className="text-success border-success">Uploaded</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground">{doc.description}</p>
                              {uploaded && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                  <FileText className="w-4 h-4" />
                                  {uploaded.file_name}
                                </div>
                              )}
                            </div>
                            <div>
                              {isUploading === doc.type ? (
                                <Button variant="outline" size="sm" disabled>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                </Button>
                              ) : (
                                <label>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(doc.type, file);
                                    }}
                                  />
                                  <Button variant={uploaded ? 'outline' : 'default'} size="sm" asChild>
                                    <span className="cursor-pointer">
                                      {uploaded ? 'Replace' : 'Upload'}
                                    </span>
                                  </Button>
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Step 5: Review */}
              {currentStep === 5 && (
                <Card className="border-0 shadow-lg animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      Review Your Application
                    </CardTitle>
                    <CardDescription>Please review your information before submitting</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Personal Info Summary */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <User className="w-4 h-4" /> Personal Information
                      </h4>
                      <dl className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                        <div><dt className="text-muted-foreground">Name</dt><dd>{form.getValues('full_name')}</dd></div>
                        <div><dt className="text-muted-foreground">Student #</dt><dd>{form.getValues('student_number')}</dd></div>
                        <div><dt className="text-muted-foreground">Contact</dt><dd>{form.getValues('contact_number')}</dd></div>
                        <div><dt className="text-muted-foreground">Nationality</dt><dd>{form.getValues('nationality')}</dd></div>
                      </dl>
                    </div>

                    {/* Academic Info Summary */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Academic Information
                      </h4>
                      <dl className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                        <div><dt className="text-muted-foreground">Degree</dt><dd>{form.getValues('degree_program')}</dd></div>
                        <div><dt className="text-muted-foreground">Faculty</dt><dd>{form.getValues('faculty')}</dd></div>
                        <div><dt className="text-muted-foreground">Department</dt><dd>{form.getValues('department')}</dd></div>
                        <div><dt className="text-muted-foreground">Year</dt><dd>{form.getValues('year_of_study')}</dd></div>
                      </dl>
                    </div>

                    {/* Documents Summary */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Documents ({uploadedDocuments.length}/{REQUIRED_DOCUMENTS.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {REQUIRED_DOCUMENTS.map(doc => {
                          const uploaded = uploadedDocuments.find(d => d.document_type === doc.type);
                          return (
                            <Badge 
                              key={doc.type} 
                              variant={uploaded ? 'default' : 'outline'}
                              className={uploaded ? 'bg-success hover:bg-success' : 'text-destructive border-destructive'}
                            >
                              {uploaded ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                              {doc.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    {/* Motivation Preview */}
                    <div>
                      <h4 className="font-medium mb-2">Motivation Letter</h4>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg line-clamp-3">
                        {form.getValues('motivation_letter')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-6">
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
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Application
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

export default Apply;
