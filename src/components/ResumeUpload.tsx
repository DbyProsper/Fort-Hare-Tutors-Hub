import { useState, useRef } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseResume, ParsedResumeData } from '@/lib/resumeParser';
import { logger } from '@/lib/logger';

interface ResumeUploadProps {
  onParsingStart: () => void;
  onParsingComplete: (data: ParsedResumeData) => void;
  onError: (error: string) => void;
}

export const ResumeUpload = ({ onParsingStart, onParsingComplete, onError }: ResumeUploadProps) => {
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.docx'];
    const fileName = file.name.toLowerCase();
    const isValidType = validTypes.includes(file.type) || validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidType) {
      setError('Please upload a PDF or DOCX file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setUploadedFileName(file.name);

    try {
      onParsingStart();
      logger.log('Starting resume parsing for file:', file.name);
      
      const parsedData = await parseResume(file);
      logger.log('Resume parsed successfully:', parsedData);
      
      onParsingComplete(parsedData);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to parse resume';
      logger.error('Error parsing resume:', err);
      setError(errorMsg);
      onError(errorMsg);
      setUploadedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    setUploadedFileName(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20 hover:bg-muted/40">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload resume"
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-2"
        >
          <Upload className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {uploadedFileName ? `✓ ${uploadedFileName}` : 'Upload your CV'}
            </p>
            <p className="text-xs text-muted-foreground">
              {uploadedFileName ? 'Click to replace' : 'PDF or DOCX, up to 5MB'}
            </p>
          </div>
        </div>
      </div>

      {uploadedFileName && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="w-full"
        >
          Clear
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
