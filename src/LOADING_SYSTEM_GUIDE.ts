/**
 * LOADING SYSTEM - USAGE GUIDE
 * 
 * This guide shows how to use the global loading system in your application.
 * The loading system is already integrated into the app via LoadingProvider.
 */

/**
 * BASIC USAGE
 * ============
 * 
 * Import the useLoading hook in any component:
 * 
 *   import { useLoading } from '@/contexts/LoadingContext';
 * 
 * Then use it in your component:
 * 
 *   const { loading, setLoading, message, setMessage } = useLoading();
 */

/**
 * EXAMPLE 1: Auth.tsx - Login with Loading
 * ==========================================
 */

/**
// src/pages/Auth.tsx

import { useLoading } from '@/contexts/LoadingContext';
import { useState } from 'react';

export default function Auth() {
  const { setLoading, setMessage } = useLoading();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show loading state with custom message
    setMessage('Signing you in...');
    setLoading(true);

    try {
      // Simulate API call
      const response = await signIn(email, password);
      // Response handling...
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      // Always stop loading when done
      setLoading(false);
      setMessage('Loading...');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setMessage('Creating your account...');
    setLoading(true);

    try {
      const response = await signUp(email, password, fullName);
      // Response handling...
    } catch (error) {
      console.error('Signup failed:', error);
    } finally {
      setLoading(false);
      setMessage('Loading...');
    }
  };

  return (
    // Your auth form JSX
  );
}
 */

/**
 * EXAMPLE 2: Dashboard.tsx - Load Data with Skeleton
 * ===================================================
 */

/**
// src/pages/Dashboard.tsx

import { useLoading } from '@/contexts/LoadingContext';
import { SkeletonCard } from '@/components/skeletons/SkeletonCard';
import { SkeletonTable } from '@/components/skeletons/SkeletonTable';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { setLoading, setMessage } = useLoading();
  const [data, setData] = useState(null);
  const [applications, setApplications] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // Option 1: Use full-screen overlay (blocks interaction)
    // setMessage('Loading your dashboard...');
    // setLoading(true);

    // Option 2: Use skeleton loaders (allows partial interaction)
    // Just render SkeletonCard/SkeletonTable while fetching

    try {
      // Fetch dashboard stats
      const statsData = await fetchDashboardStats();
      setData(statsData);

      // Fetch applications with minimal blocking
      const appsData = await fetchApplications();
      setApplications(appsData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      // setLoading(false);
      // setMessage('Loading...');
    }
  };

  if (!data) {
    return <SkeletonCard className="mb-4" />; // Show while loading
  }

  if (!applications) {
    return (
      <>
        {/* Show loaded data */}
        <div>Dashboard stats...</div>
        {/* Show loading skeleton for table */}
        <SkeletonTable rows={8} columns={5} />
      </>
    );
  }

  return (
    <>
      {/* Full loaded dashboard */}
      <div>Dashboard content...</div>
      {/* Applications table */}
    </>
  );
}
 */

/**
 * EXAMPLE 3: Apply.tsx - Form Submission with Loading
 * ====================================================
 */

/**
// src/pages/Apply.tsx

import { useLoading } from '@/contexts/LoadingContext';

export default function Apply() {
  const { setLoading, setMessage } = useLoading();

  const handleSubmitApplication = async (formData: FormData) => {
    setMessage('Submitting your application...');
    setLoading(true);

    try {
      const response = await submitApplication(formData);
      
      if (response.ok) {
        setMessage('Application submitted successfully!');
        // Redirect or handle success
      }
    } catch (error) {
      console.error('Submission failed:', error);
      setMessage('Loading...'); // Reset message
      setLoading(false);
      // Show error toast
    }
  };

  return (
    // Your application form
  );
}
 */

/**
 * API REFERENCE
 * =============
 * 
 * useLoading() Returns:
 * - loading: boolean
 *     Current loading state
 * 
 * - setLoading: (value: boolean) => void
 *     Set loading state (true = show loader, false = hide loader)
 * 
 * - message: string
 *     Current loading message (default: "Loading...")
 * 
 * - setMessage: (value: string) => void
 *     Set custom loading message
 * 
 * 
 * COMPONENT STRUCTURE
 * ===================
 * 
 * AppLoader Component:
 * - Full-screen fixed overlay
 * - z-index: 50
 * - Shows only when loading === true
 * - Displays logo with floating animation
 * - Shows dynamic loading message with animated dots
 * - White background with fade-in animation
 * 
 * TopProgressBar Component:
 * - Fixed at top of page
 * - z-index: 40
 * - Blue gradient (blue-500 to blue-600)
 * - Animated width transition
 * - 4px height (h-1)
 * - Does not shift page content
 * 
 * SkeletonCard Component:
 * - Reusable card skeleton
 * - Gray-200 animated pulse blocks
 * - Rounded corners
 * - Accepts optional className prop
 * 
 * SkeletonTable Component:
 * - Reusable table skeleton
 * - Configurable rows (default: 5)
 * - Configurable columns (default: 4)
 * - Gray-200 animated pulse blocks
 * - Realistic row/cell widths
 * 
 * 
 * BEST PRACTICES
 * ==============
 * 
 * 1. Always wrap async operations with try/catch/finally
 * 2. Set loading to false in the finally block
 * 3. Use descriptive messages for better UX
 * 4. Use skeletons for non-critical data to avoid full-screen overlay
 * 5. Use full-screen loader for critical auth operations
 * 6. Reset message to default in finally block
 * 
 * 
 * WHEN TO USE FULL-SCREEN LOADER vs SKELETON
 * ===========================================
 * 
 * Use Full-Screen Loader (AppLoader):
 * - Authentication (login, signup, logout)
 * - Critical data that blocks page functionality
 * - Page transitions/route changes
 * - Important async operations that should block interaction
 * 
 * Use Skeleton Loaders:
 * - Non-critical data (optional data, secondary info)
 * - Partial page loads (load header first, then content)
 * - Table data, card lists
 * - To maintain page responsiveness
 */

// Export this file for reference
export {};
