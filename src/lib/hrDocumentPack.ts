import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Title
    page.drawText('Tutor Appointment', {
      x: width / 2 - 100,
      y: height - 150,
      font: boldFont,
      size: 30,
      color: rgb(0.12, 0.16, 0.22),
    });
    page.drawText('Document Pack', {
      x: width / 2 - 80,
      y: height - 200,
      font: boldFont,
      size: 30,
      color: rgb(0.12, 0.16, 0.22),
    });

    // Separator line (UFH Blue)
    page.drawLine({
      start: { x: 50, y: height - 250 },
      end: { x: width - 50, y: height - 250 },
      thickness: 3,
      color: rgb(0, 0.23, 0.56),
    });

    // Details
    let y = height - 350;
    const details = [
      ['Applicant Name:', fullName],
      ['Student Number:', studentNumber],
      ['Department:', department],
      ['Application ID:', applicationId],
      ['Date Verified:', dateVerified]
    ];

    details.forEach(([label, value]) => {
      page.drawText(label, {
        x: 70,
        y,
        font: boldFont,
        size: 14,
        color: rgb(0.22, 0.25, 0.32),
      });
      page.drawText(value, {
        x: 250,
        y,
        font: font,
        size: 14,
        color: rgb(0.22, 0.25, 0.32),
      });
      y -= 40;
    });

    // Footer
    page.drawText('Generated for HR Department', {
      x: width / 2 - 100,
      y: 100,
      font: font,
      size: 12,
      color: rgb(0.42, 0.45, 0.49),
    });
    page.drawText(new Date().toLocaleDateString(), {
      x: width / 2 - 40,
      y: 80,
      font: font,
      size: 12,
      color: rgb(0.42, 0.45, 0.49),
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });

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
          if (e.message.includes('is encrypted')) {
            console.log('PDF is encrypted, trying with student ID as password.');
            try {
              pdf = await PDFDocument.load(bytes, { password: studentId });
            } catch (passwordError) {
              console.warn('Failed to decrypt with student ID password. Trying to load by ignoring encryption. This may result in blank pages if the document is heavily encrypted.');
              pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
            }
          } else {
            console.error('An unexpected error occurred while loading a PDF, re-throwing.', e)
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
