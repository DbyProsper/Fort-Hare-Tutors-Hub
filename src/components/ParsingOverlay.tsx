import { Loader2 } from 'lucide-react';

interface ParsingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export const ParsingOverlay = ({ isVisible, message = 'Parsing CV... Extracting information' }: ParsingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 pointer-events-auto">
      <div className="bg-background rounded-lg shadow-lg p-6 flex flex-col items-center gap-4 max-w-sm">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-center font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
};
