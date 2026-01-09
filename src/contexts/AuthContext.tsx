import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Check admin role after auth state change
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
            // Ensure profile exists as fallback
            ensureProfileExists(
              session.user.id,
              session.user.email || '',
              session.user.user_metadata?.full_name || ''
            );
          }, 0);
        } else {
          setIsAdmin(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        checkAdminRole(session.user.id);
        // Ensure profile exists as fallback
        ensureProfileExists(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata?.full_name || ''
        );
      } else {
        setIsAdmin(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (!error && data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  };

  const ensureProfileExists = async (userId: string, email: string, fullName: string) => {
    try {
      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error checking profile existence:', checkError);
        return;
      }

      // If profile doesn't exist, create it
      if (!existingProfile) {
        console.log('Profile not found, creating one...');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: email,
            full_name: fullName,
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
        } else {
          console.log('Profile created successfully');
        }
      } else {
        console.log('Profile already exists');
      }
    } catch (error) {
      console.error('Unexpected error in ensureProfileExists:', error);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      // Validate UFH email domain
      if (!email.endsWith('@ufh.ac.za')) {
        return { error: new Error('Please use your University of Fort Hare student email (@ufh.ac.za)') };
      }

      const redirectUrl = `${window.location.origin}/`;

      // Create the auth user - the database trigger will handle profile creation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        return { error: new Error(authError.message) };
      }

      console.log('Auth user created successfully:', authData.user?.id);
      return { error: null };
    } catch (error) {
      console.error('Unexpected error during signup:', error);
      return { error: new Error('An unexpected error occurred during signup. Please try again.') };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAdmin,
      signUp,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
