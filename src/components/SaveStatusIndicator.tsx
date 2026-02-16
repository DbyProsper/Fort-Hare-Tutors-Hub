import { CheckCircle2, AlertCircle, WifiOff, Loader2 } from 'lucide-react';

interface SaveStatusIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  message: string;
}

export const SaveStatusIndicator = ({ status, message }: SaveStatusIndicatorProps) => {
  if (!message) return null;

  const statusConfig = {
    idle: {
      color: 'text-gray-500',
      icon: null,
      show: false,
    },
    saving: {
      color: 'text-blue-600',
      icon: Loader2,
      show: true,
    },
    saved: {
      color: 'text-green-600',
      icon: CheckCircle2,
      show: true,
    },
    error: {
      color: 'text-red-600',
      icon: AlertCircle,
      show: true,
    },
    offline: {
      color: 'text-amber-600',
      icon: WifiOff,
      show: true,
    },
  };

  const config = statusConfig[status];

  if (!config.show) return null;

  const IconComponent = config.icon;

  return (
    <div className={`flex items-center gap-2 text-xs ${config.color}`}>
      {IconComponent && (
        <IconComponent
          className={`w-4 h-4 ${status === 'saving' ? 'animate-spin' : ''}`}
        />
      )}
      <span className="font-medium">{message}</span>
    </div>
  );
};
