import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{
    error: Error | null;
    userExists?: boolean;
    needsConfirmation?: boolean;
    user?: User;
    session?: Session;
  }>;
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
        logger.log('Auth state change:', event, session?.user?.id);
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
      logger.log('Initial session check:', session?.user?.id);
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
      console.log('Checking admin role for userId:', userId);

      // TEMPORARY: For testing, let's manually check if this is the admin user
      if (userId === '90d13069-ee78-4846-979f-2acf1d0942e0') {
        console.log('TEMPORARY: Setting isAdmin to true for known admin user');
        setIsAdmin(true);
        return;
      }

      // Try using the has_role function with positional parameters
      const { data: hasRoleData, error: hasRoleError } = await supabase.rpc('has_role', [userId, 'admin']);

      console.log('has_role RPC result (positional):', { hasRoleData, hasRoleError });

      if (!hasRoleError && hasRoleData === true) {
        console.log('Setting isAdmin to true (via RPC)');
        setIsAdmin(true);
        return;
      }

      // Fallback: Try direct query with more debugging
      console.log('Trying direct query...');
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')  // Select all columns for debugging
        .eq('user_id', userId);

      console.log('All user roles for this user:', { data, error });

      // Check specifically for admin role
      const adminRole = data?.find(role => role.role === 'admin');
      console.log('Admin role found:', adminRole);

      if (!error && adminRole) {
        console.log('Setting isAdmin to true (via direct query)');
        setIsAdmin(true);
      } else {
        console.log('Setting isAdmin to false');
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
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
        logger.error('Error checking profile existence:', checkError);
        return;
      }

      // If profile doesn't exist, create it
      if (!existingProfile) {
        logger.log('Profile not found, creating one...');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: email,
            full_name: fullName,
          });

        if (insertError) {
          logger.error('Error creating profile:', insertError);
        } else {
          logger.log('Profile created successfully');
        }
      } else {
        logger.log('Profile already exists');
      }
    } catch (error) {
      logger.error('Unexpected error in ensureProfileExists:', error);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      // Validate UFH email domain
      if (!email.endsWith('@ufh.ac.za')) {
        return { error: new Error('Please use your University of Fort Hare student email (@ufh.ac.za)') };
      }

      // Check if user already exists by looking for a profile with this email
      console.log('Checking if user already exists for email:', email);
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      console.log('Profile check result:', { existingProfile, profileCheckError });

      // Also check total profiles count for debugging
      const { count: profileCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      console.log('Total profiles in database:', profileCount);

      if (existingProfile) {
        console.log('User already exists with this email:', existingProfile.email);
        return {
          error: new Error('ACCOUNT_EXISTS'),
          userExists: true
        };
      }

      // If profile check failed for reasons other than "not found", log but continue
      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        logger.warn('Profile check failed:', profileCheckError);
      }

      const redirectUrl = `${window.location.origin}/`;

      // Attempt signup
      logger.log('Attempting signup');
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

      logger.log('Signup response received');

      if (authError) {
        logger.error('Auth signup error:', authError.message);

        // Handle specific error cases for existing users
        const errorMessage = authError.message.toLowerCase();
        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('user already registered') ||
          errorMessage.includes('email already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('email address already in use') ||
          errorMessage.includes('email already in use') ||
          errorMessage.includes('user already exists') ||
          errorMessage.includes('signup is disabled') ||
          errorMessage.includes('email not confirmed')
        ) {
          logger.log('User already exists based on auth error');
          return {
            error: new Error('ACCOUNT_EXISTS'),
            userExists: true
          };
        }

        return { error: new Error(authError.message) };
      }

      // Check if user was created but needs email confirmation
      if (authData.user && !authData.session) {
        logger.log('User created, email confirmation required');
        return {
          error: null,
          needsConfirmation: true,
          user: authData.user
        };
      }

      // User was created and automatically signed in (no email confirmation required)
      if (authData.user && authData.session) {
        logger.log('User created and signed in automatically');
        return {
          error: null,
          user: authData.user,
          session: authData.session
        };
      }

      logger.log('Unexpected signup response');
      return { error: new Error('Unexpected response from signup service') };
    } catch (error) {
      logger.error('Unexpected error during signup:', error);
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
