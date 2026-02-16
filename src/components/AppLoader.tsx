import { useLoading } from '@/contexts/LoadingContext';

const AppLoader = () => {
  const { loading, message } = useLoading();

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white opacity-95"
      style={{
        animation: 'fadeIn 0.3s ease-in-out',
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 0.95;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        .loader-logo {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 20%, 50%, 80%, 100% {
            opacity: 1;
          }
          40%, 60% {
            opacity: 0.4;
          }
        }

        .loading-dot {
          animation: pulse-dot 1.4s ease-in-out infinite;
        }

        .loading-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .loading-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>

      <div className="flex flex-col items-center justify-center gap-8">
        {/* Logo */}
        <div className="loader-logo">
          <img
            src="/ufhlogo.png"
            alt="Loading"
            className="w-24 h-24 object-contain opacity-80"
          />
        </div>

        {/* Loading Text */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-medium text-gray-700">{message}</p>

          {/* Animated Dots */}
          <div className="flex gap-2">
            <div className="loading-dot w-2 h-2 rounded-full bg-blue-600" />
            <div className="loading-dot w-2 h-2 rounded-full bg-blue-600" />
            <div className="loading-dot w-2 h-2 rounded-full bg-blue-600" />
          </div>
        </div>

        {/* Academic accent line */}
        <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full opacity-60" />
      </div>
    </div>
  );
};

export default AppLoader;
