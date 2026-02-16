import { createContext, useContext, useState, ReactNode } from 'react';
import AppLoader from '@/components/AppLoader';
import TopProgressBar from '@/components/TopProgressBar';

interface LoadingContextType {
  loading: boolean;
  setLoading: (value: boolean) => void;
  message: string;
  setMessage: (value: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Loading...');

  return (
    <LoadingContext.Provider value={{ loading, setLoading, message, setMessage }}>
      <TopProgressBar />
      <AppLoader />
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
