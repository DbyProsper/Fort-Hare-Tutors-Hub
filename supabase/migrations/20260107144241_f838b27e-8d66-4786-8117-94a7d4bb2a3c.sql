-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('draft', 'pending', 'under_review', 'approved', 'rejected');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

-- Create enum for gender
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  student_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create tutor applications table
CREATE TABLE public.tutor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Personal Information
  full_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender public.gender_type,
  nationality TEXT NOT NULL,
  residential_address TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  email TEXT NOT NULL,
  
  -- Academic Information
  degree_program TEXT NOT NULL,
  faculty TEXT NOT NULL,
  department TEXT NOT NULL,
  year_of_study INTEGER NOT NULL,
  subjects_completed TEXT[] DEFAULT '{}',
  subjects_to_tutor TEXT[] DEFAULT '{}',
  
  -- Employment Information
  previous_tutoring_experience TEXT,
  work_experience TEXT,
  skills_competencies TEXT[],
  languages_spoken TEXT[] DEFAULT '{}',
  availability JSONB DEFAULT '{}',
  motivation_letter TEXT NOT NULL,
  
  -- Application Status
  status public.application_status NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE
);

-- Create application documents table
CREATE TABLE public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.tutor_applications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  
  -- Assign student role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student');
  
  RETURN new;
END;
$$;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.tutor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create user roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tutor_applications
CREATE POLICY "Students can view own applications"
  ON public.tutor_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own applications"
  ON public.tutor_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update own draft applications"
  ON public.tutor_applications FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('draft', 'pending'));

CREATE POLICY "Admins can view all applications"
  ON public.tutor_applications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all applications"
  ON public.tutor_applications FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for application_documents
CREATE POLICY "Users can view own documents"
  ON public.application_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON public.application_documents FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.tutor_applications
      WHERE id = application_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own documents"
  ON public.application_documents FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents"
  ON public.application_documents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('application-documents', 'application-documents', false, 10485760);

-- Storage policies
CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'application-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'application-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'application-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'application-documents' AND public.has_role(auth.uid(), 'admin'));