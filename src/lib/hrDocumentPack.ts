import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface DocumentForPack {
  type: string;
  label: string;
  file_path: string;
  file_name: string;
  mime_type?: string;
}

export const fetchApplicationDocuments = async (applicationId: string): Promise<DocumentForPack[]> => {
  try {
    const { data, error } = await supabase
      .from('application_documents')
      .select('document_type, file_name, file_path, mime_type')
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

    // Return all documents. If a document type is recognised map to a friendly label,
    // otherwise fall back to the uploaded file name or a prettified type string.
    return (data || []).map(doc => ({
      type: doc.document_type,
      label:
        documentMap[doc.document_type] ||
        doc.file_name ||
        doc.document_type.replace(/_/g, ' '),
      file_path: doc.file_path,
      file_name: doc.file_name,
      mime_type: doc.mime_type || ''
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

    // Separator line (UFH Blue)
    ctx.strokeStyle = '#003A8F';
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
  dateVerified: string,
  studentId: string
): Promise<Blob | null> => {
  try {
    const mergedPdf = await PDFDocument.create();
    let validPdfCount = 0;

    // ✅ Generate cover page
    const coverBlob = await generateCoverPagePDF(
      studentNumber,
      fullName,
      department,
      applicationId,
      dateVerified
    );

    if (coverBlob) {
      const coverBytes = await coverBlob.arrayBuffer();
      const coverHeader = new TextDecoder().decode(coverBytes.slice(0, 5));

      if (coverHeader.startsWith('%PDF-')) {
        const coverDoc = await PDFDocument.load(coverBytes);
        const coverPages = await mergedPdf.copyPages(
          coverDoc,
          coverDoc.getPageIndices()
        );
        coverPages.forEach(p => mergedPdf.addPage(p));
        validPdfCount++;
      } else {
        console.error('Cover page is not a valid PDF');
      }
    }

    // ✅ Merge each uploaded document safely
    for (const doc of documents) {
      try {
        console.log('Downloading:', doc.file_path);

        const { data, error } = await supabase.storage
          .from('application-documents')
          .download(doc.file_path);

        if (error) {
          console.error('Storage error:', error);
          continue;
        }

        if (!data) {
          console.error('No data returned for:', doc.file_path);
          continue;
        }

        const bytes = await data.arrayBuffer();

        if (bytes.byteLength === 0) {
          console.error('Empty file skipped:', doc.file_path);
          continue;
        }

        // 🔥 Critical validation
        const header = new TextDecoder().decode(bytes.slice(0, 5));

        if (!header.startsWith('%PDF-')) {
          console.error('Invalid PDF skipped:', doc.file_path);
          continue;
        }

        let pdf;
        try {
          // Try loading without password first
          pdf = await PDFDocument.load(bytes);
        } catch (e: any) {
          // If encrypted, try loading with student ID as password
          if (e.name === 'PasswordDecryptor') {
            console.log('PDF is encrypted, trying with student ID');
            pdf = await PDFDocument.load(bytes, { ownerPassword: studentId });
          } else {
            throw e; // re-throw other errors
          }
        }

        const copied = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices()
        );

        copied.forEach(p => mergedPdf.addPage(p));
        validPdfCount++;

      } catch (e) {
        console.error('Failed merging file:', doc.file_path, e);
        continue;
      }
    }

    if (validPdfCount === 0) {
      console.error('No valid PDFs found to merge.');
      return null;
    }

    const mergedBytes = await mergedPdf.save();

    return new Blob([mergedBytes], { type: 'application/pdf' });

  } catch (err) {
    console.error('Error merging documents:', err);
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
