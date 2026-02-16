import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface UseAutoSaveOptions {
  userId: string | undefined;
  applicationId: string | undefined;
  formData: Record<string, any>;
  debounceMs?: number;
  enabled?: boolean;
}

interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  message: string;
  timestamp?: number;
}

export const useAutoSave = ({
  userId,
  applicationId,
  formData,
  debounceMs = 900,
  enabled = true,
}: UseAutoSaveOptions) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    status: 'idle',
    message: '',
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<Record<string, any>>(formData);
  const isSavingRef = useRef(false);
  const lastSaveTimeRef = useRef<number>(0);

  // Check if online
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveToLocalStorage = useCallback(() => {
    if (!userId || !applicationId) return;
    try {
      const key = `autosave_${userId}_${applicationId}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          data: formData,
          timestamp: Date.now(),
        })
      );
      logger.log('Autosave stored in localStorage:', key);
    } catch (error) {
      logger.error('Failed to save to localStorage:', error);
    }
  }, [userId, applicationId, formData]);

  const clearLocalStorage = useCallback(() => {
    if (!userId || !applicationId) return;
    try {
      const key = `autosave_${userId}_${applicationId}`;
      localStorage.removeItem(key);
      logger.log('Cleared localStorage autosave:', key);
    } catch (error) {
      logger.error('Failed to clear localStorage:', error);
    }
  }, [userId, applicationId]);

  const performSave = useCallback(async () => {
    // Validation checks
    if (!userId || !applicationId || isSavingRef.current || !enabled) {
      return;
    }

    // Check if data actually changed
    const hasChanged = JSON.stringify(previousDataRef.current) !== JSON.stringify(formData);
    if (!hasChanged) {
      logger.log('No changes detected, skipping autosave');
      return;
    }

    // Throttle: don't save more than once per 2 seconds
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 2000) {
      logger.log('Save throttled, waiting before next save');
      return;
    }

    isSavingRef.current = true;
    setSaveStatus({ status: 'saving', message: 'Saving...' });

    try {
      if (!isOnline) {
        setSaveStatus({ status: 'offline', message: 'Offline – changes not saved' });
        saveToLocalStorage();
        isSavingRef.current = false;
        return;
      }

      // Prepare data for Supabase - map form fields to database columns
      const applicationData = {
        id: applicationId,
        user_id: userId,
        full_name: formData.full_name || '',
        student_number: formData.student_number || '',
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        nationality: formData.nationality || '',
        residential_address: formData.residential_address || '',
        contact_number: formData.contact_number || '',
        email: formData.email || '',
        degree: formData.degree_program || '', // Map degree_program to degree
        degree_program: formData.degree_program || '',
        faculty: formData.faculty || '',
        department: formData.department || '',
        year_of_study: formData.year_of_study || 1,
        subjects_completed: formData.subjects_completed
          ? typeof formData.subjects_completed === 'string'
            ? formData.subjects_completed.split(',').map((s: string) => s.trim())
            : formData.subjects_completed
          : [],
        subjects_to_tutor: formData.subjects_to_tutor
          ? typeof formData.subjects_to_tutor === 'string'
            ? formData.subjects_to_tutor.split(',').map((s: string) => s.trim())
            : formData.subjects_to_tutor
          : [],
        previous_tutoring_experience: formData.previous_tutoring_experience || null,
        work_experience: formData.work_experience || null,
        skills_competencies: formData.skills_competencies
          ? typeof formData.skills_competencies === 'string'
            ? formData.skills_competencies.split(',').map((s: string) => s.trim())
            : formData.skills_competencies
          : [],
        languages_spoken: formData.languages_spoken
          ? typeof formData.languages_spoken === 'string'
            ? formData.languages_spoken.split(',').map((s: string) => s.trim())
            : formData.languages_spoken
          : [],
        availability: formData.availability || null,
        motivation_letter: formData.motivation_letter || '',
        status: 'draft', // Always save as draft via autosave
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('tutor_applications')
        .upsert(applicationData, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      // Update previous data to track changes
      previousDataRef.current = formData;
      lastSaveTimeRef.current = now;

      setSaveStatus({
        status: 'saved',
        message: 'All changes saved',
        timestamp: now,
      });

      // Clear localStorage on successful save
      clearLocalStorage();

      logger.log('Autosave successful for application:', applicationId);

      // Reset status after 3 seconds
      setTimeout(() => {
        setSaveStatus({ status: 'idle', message: '' });
      }, 3000);
    } catch (error) {
      logger.error('Autosave failed:', error);
      setSaveStatus({
        status: 'error',
        message: 'Failed to save',
      });

      // Fallback to localStorage on error
      saveToLocalStorage();

      // Retry status after 3 seconds
      setTimeout(() => {
        setSaveStatus({ status: 'idle', message: '' });
      }, 3000);
    } finally {
      isSavingRef.current = false;
    }
  }, [userId, applicationId, formData, enabled, isOnline, saveToLocalStorage, clearLocalStorage]);

  // Main autosave effect with debouncing
  useEffect(() => {
    if (!enabled || !userId || !applicationId) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced save
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData, debounceMs, performSave, enabled, userId, applicationId]);

  return {
    saveStatus,
    isSaving: saveStatus.status === 'saving',
    isOnline,
  };
};
