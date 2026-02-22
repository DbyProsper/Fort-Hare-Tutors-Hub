import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReviewNotificationBannerProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const ReviewNotificationBanner = ({ isVisible, onDismiss }: ReviewNotificationBannerProps) => {
  if (!isVisible) return null;

  return (
    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">
          We detected some details from your resume. Please review before submitting.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};
