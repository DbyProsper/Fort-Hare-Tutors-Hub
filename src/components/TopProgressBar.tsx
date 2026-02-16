import { useLoading } from '@/contexts/LoadingContext';

const TopProgressBar = () => {
  const { loading } = useLoading();

  return (
    <div
      className="fixed top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 z-40"
      style={{
        width: loading ? '100%' : '0%',
        opacity: loading ? 1 : 0,
      }}
    />
  );
};

export default TopProgressBar;
