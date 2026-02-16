/**
 * PRACTICAL INTEGRATION EXAMPLE
 * =============================
 * 
 * This file shows how to integrate the loading system into your existing
 * Auth.tsx component. This is a minimal example showing where to add
 * the useLoading hook and how to use it.
 * 
 * DO NOT copy this entire file - only the relevant parts for your Auth.tsx
 */

// At the top of src/pages/Auth.tsx, add this import:
// import { useLoading } from '@/contexts/LoadingContext';

/**
 * EXAMPLE STRUCTURE FOR AUTH.TSX
 * ==============================
 */

/*

import { useLoading } from '@/contexts/LoadingContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Auth() {
  const navigate = useNavigate();
  const { setLoading, setMessage } = useLoading();  // ← Add this
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  // ============================================
  // LOGIN HANDLER - WITH LOADING
  // ============================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show loading state
    setMessage('Signing you in...');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        throw error;
      }
      
      // If successful, the auth listener in AuthContext will handle
      // the user state update and navigation
      
    } catch (error) {
      console.error('Login failed:', error);
      
      // Stop loading on error
      setLoading(false);
      setMessage('Loading...');
      
      // Show error toast to user
      // toast.error('Invalid email or password');
    }
    // Note: Don't set loading to false on success - let auth listener handle it
    // Or keep loading=true until auth state updates
  };

  // ============================================
  // SIGNUP HANDLER - WITH LOADING
  // ============================================
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show loading state
    setMessage('Creating your account...');
    setLoading(true);

    try {
      const { error, userExists, needsConfirmation } = await signUp(
        email,
        password,
        fullName
      );

      if (error) {
        throw error;
      }

      if (userExists) {
        setLoading(false);
        setMessage('Loading...');
        // toast.error('Account already exists');
        return;
      }

      if (needsConfirmation) {
        setLoading(false);
        setMessage('Loading...');
        // toast.success('Please check your email to confirm your account');
        setIsLogin(true);
        return;
      }

      // If successful, auth listener will update user state
      
    } catch (error) {
      console.error('Signup failed:', error);
      
      // Stop loading on error
      setLoading(false);
      setMessage('Loading...');
      
      // toast.error('Failed to create account');
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="auth-container">
      <form onSubmit={isLogin ? handleLogin : handleSignUp}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        
        {!isLogin && (
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            required
          />
        )}
        
        <button type="submit">
          {isLogin ? 'Sign In' : 'Sign Up'}
        </button>
        
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? 'Need an account?' : 'Have an account?'}
        </button>
      </form>
    </div>
  );
}

*/

/**
 * EXAMPLE: FORGOT PASSWORD WITH LOADING
 * ======================================
 */

/*

import { useLoading } from '@/contexts/LoadingContext';

export default function ForgotPassword() {
  const { setLoading, setMessage } = useLoading();
  const [email, setEmail] = useState('');

  const handleResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setMessage('Sending reset email...');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        throw error;
      }

      setLoading(false);
      setMessage('Loading...');
      // toast.success('Check your email for reset link');
      
    } catch (error) {
      console.error('Reset failed:', error);
      setLoading(false);
      setMessage('Loading...');
      // toast.error('Failed to send reset email');
    }
  };

  return (
    <form onSubmit={handleResetEmail}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <button type="submit">Send Reset Link</button>
    </form>
  );
}

*/

/**
 * KEY POINTS
 * ==========
 * 
 * 1. Import useLoading at top of component
 *    import { useLoading } from '@/contexts/LoadingContext';
 * 
 * 2. Get the functions in your component
 *    const { setLoading, setMessage } = useLoading();
 * 
 * 3. Show loading before async operation
 *    setMessage('Your message...');
 *    setLoading(true);
 * 
 * 4. Always hide loading on error
 *    catch (error) {
 *      setLoading(false);
 *      setMessage('Loading...');
 *    }
 * 
 * 5. For successful auth, you can let loading persist
 *    (Auth state change will happen, page will navigate)
 *    OR stop loading manually
 * 
 * 6. Use descriptive messages for better UX
 *    - 'Signing you in...'
 *    - 'Creating your account...'
 *    - 'Sending reset email...'
 */

export {};
