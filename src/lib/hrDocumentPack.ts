import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface DocumentForPack {
  type: string;
  label: string;
  file_path: string;
  file_name: string;
}

export const fetchApplicationDocuments = async (applicationId: string): Promise<DocumentForPack[]> => {
  try {
    const { data, error } = await supabase
      .from('application_documents')
      .select('document_type, file_name, file_path')
      .eq('application_id', applicationId);

    if (error) throw error;

    // Map documents to HR pack order
    const documentMap: Record<string, string> = {
      'offer_affidavit': 'Signed Acceptance Affidavit',
      'offer_personal_info': 'Tutor Personal Info Form',
      'certified_id': 'Certified ID Copy',
      'proof_of_registration': 'Proof of Registration',
      'bank_statement': 'Bank Stamped Statement',
      'tax_number': 'Tax Number Confirmation'
    };

    return (data || [])
      .filter(doc => documentMap[doc.document_type])
      .map(doc => ({
        type: doc.document_type,
        label: documentMap[doc.document_type] || doc.document_type,
        file_path: doc.file_path,
        file_name: doc.file_name
      }));
  } catch (err) {
    logger.error('Error fetching application documents:', err);
    return [];
  }
};

export const getRequiredDocumentsForPack = (): string[] => {
  return [
    'offer_affidavit',
    'offer_personal_info',
    'certified_id',
    'proof_of_registration'
  ];
};

export const checkDocumentsComplete = async (applicationId: string): Promise<boolean> => {
  try {
    const documents = await fetchApplicationDocuments(applicationId);
    const documentTypes = documents.map(d => d.type);
    const required = getRequiredDocumentsForPack();
    
    return required.every(type => documentTypes.includes(type));
  } catch (err) {
    logger.error('Error checking document completeness:', err);
    return false;
  }
};

export const downloadDocumentFile = async (filePath: string): Promise<Blob | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('application-documents')
      .download(filePath);

    if (error) throw error;
    return data;
  } catch (err) {
    logger.error('Error downloading document:', err);
    return null;
  }
};

export const generateCoverPagePDF = async (
  studentNumber: string,
  fullName: string,
  department: string,
  applicationId: string,
  dateVerified: string
): Promise<Blob | null> => {
  try {
    // For now, return a simple HTML-based PDF using a canvas approach
    // In production, you might use a library like jsPDF for better control
    
    const canvas = document.createElement('canvas');
    canvas.width = 210 * 3.78; // A4 width in pixels (mm * DPI/25.4)
    canvas.height = 297 * 3.78; // A4 height in pixels

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Tutor Appointment', canvas.width / 2, 150);
    ctx.fillText('Document Pack', canvas.width / 2, 220);

    // Separator line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(100, 280);
    ctx.lineTo(canvas.width - 100, 280);
    ctx.stroke();

    // Details
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    const margin = 150;
    let y = 400;

    const details = [
      ['Applicant Name:', fullName],
      ['Student Number:', studentNumber],
      ['Department:', department],
      ['Application ID:', applicationId],
      ['Date Verified:', dateVerified]
    ];

    details.forEach(([label, value]) => {
      ctx.font = 'bold 20px Arial';
      ctx.fillText(label, margin, y);
      ctx.font = '20px Arial';
      ctx.fillText(value, margin + 400, y);
      y += 100;
    });

    // Footer
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Generated for HR Department', canvas.width / 2, canvas.height - 100);
    ctx.fillText(new Date().toLocaleDateString(), canvas.width / 2, canvas.height - 50);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'application/pdf');
    });
  } catch (err) {
    logger.error('Error generating cover page PDF:', err);
    return null;
  }
};

export const mergeDocumentsIntoPDF = async (
  documents: DocumentForPack[],
  studentNumber: string,
  fullName: string,
  department: string,
  applicationId: string,
  dateVerified: string
): Promise<Blob | null> => {
  try {
    // For browser-based PDF merging, we need a library like pdf-lib or pdfkit-browserify
    // Since those aren't in the dependencies, we'll create a simplified approach
    // that concatenates PDFs using a server-side function or creates a ZIP

    logger.warn('Full PDF merge requires pdf-lib. Creating downloadable pack info instead.');

    // Create a JSON manifest that can be processed server-side
    const manifest = {
      studentNumber,
      fullName,
      department,
      applicationId,
      dateVerified,
      documents: documents.map(d => ({
        type: d.type,
        label: d.label,
        fileName: d.file_name,
        filePath: d.file_path
      })),
      generatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json'
    });

    return blob;
  } catch (err) {
    logger.error('Error merging documents:', err);
    return null;
  }
};

/**
 * Alternative: Use a server-side Edge Function to merge PDFs
 * This would be more efficient and reliable
 */
export const generateHRPackViaFunction = async (
  applicationId: string,
  studentNumber: string,
  fullName: string,
  department: string
): Promise<Blob | null> => {
  try {
    // Call Supabase Edge Function to merge PDFs server-side
    const response = await fetch('/api/generate-hr-pack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicationId,
        studentNumber,
        fullName,
        department,
      })
    });

    if (!response.ok) throw new Error('Failed to generate HR pack');
    return await response.blob();
  } catch (err) {
    logger.error('Error generating HR pack via function:', err);
    return null;
  }
};
