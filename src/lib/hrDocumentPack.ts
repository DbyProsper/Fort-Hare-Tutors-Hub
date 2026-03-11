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

export interface MergeResult {
  blob: Blob | null;
  failedDocuments: Array<{
    name: string;
    reason: string;
  }>;
  placeholdersInserted: number;
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

const createPlaceholderPage = async (
  mergedPdf: any,
  documentName: string
): Promise<void> => {
  try {
    const placeholderPdf = await PDFDocument.create();
    const page = placeholderPdf.addPage([612, 792]); // Standard letter size
    const { width, height } = page.getSize();
    const font = await placeholderPdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await placeholderPdf.embedFont(StandardFonts.HelveticaBold);

    // Draw warning box
    page.drawRectangle({
      x: 50,
      y: height - 150,
      width: width - 100,
      height: 100,
      borderColor: rgb(0.9, 0.2, 0.2),
      borderWidth: 3,
    });

    // Title
    page.drawText('DOCUMENT COULD NOT BE MERGED', {
      x: 70,
      y: height - 75,
      font: boldFont,
      size: 16,
      color: rgb(0.9, 0.2, 0.2),
    });

    // Details
    page.drawText(
      'This file is encrypted and could not be decrypted automatically.',
      {
        x: 70,
        y: height - 100,
        font: font,
        size: 12,
        color: rgb(0.2, 0.2, 0.2),
      }
    );

    page.drawText(`Document Name: ${documentName}`, {
      x: 70,
      y: height - 120,
      font: font,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText('Please download it manually from the applicant profile.', {
      x: 70,
      y: height - 140,
      font: font,
      size: 11,
      color: rgb(0.5, 0.5, 0.5),
    });

    const placeholderPages = await mergedPdf.copyPages(
      placeholderPdf,
      placeholderPdf.getPageIndices()
    );

    placeholderPages.forEach((p) => mergedPdf.addPage(p));
  } catch (err) {
    logger.error('Error creating placeholder page:', err);
  }
};

const tryDecryptPDF = async (
  bytes: ArrayBuffer,
  passwords: string[]
): Promise<any | null> => {
  for (const password of passwords) {
    try {
      const pdf = await PDFDocument.load(bytes, { password });
      return pdf;
    } catch (e: any) {
      // Continue to next password
      continue;
    }
  }
  return null;
};

export const mergeDocumentsIntoPDF = async (
  documents: DocumentForPack[],
  studentNumber: string,
  fullName: string,
  department: string,
  applicationId: string,
  dateVerified: string,
  studentId: string
): Promise<MergeResult> => {
  try {
    const mergedPdf = await PDFDocument.create();
    let validPdfCount = 0;
    const failedDocuments: Array<{ name: string; reason: string }> = [];
    let placeholdersInserted = 0;

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
        coverPages.forEach((p) => mergedPdf.addPage(p));
        validPdfCount++;
      } else {
        logger.error('Cover page is not a valid PDF');
      }
    }

    // ✅ Merge each uploaded document safely
    for (const doc of documents) {
      try {
        logger.log('Downloading:', doc.file_path);

        const { data, error } = await supabase.storage
          .from('application-documents')
          .download(doc.file_path);

        if (error) {
          logger.error('Storage error:', error);
          failedDocuments.push({
            name: doc.file_name,
            reason: 'Failed to download from storage',
          });
          continue;
        }

        if (!data) {
          logger.error('No data returned for:', doc.file_path);
          failedDocuments.push({
            name: doc.file_name,
            reason: 'No data returned from storage',
          });
          continue;
        }

        const bytes = await data.arrayBuffer();

        if (bytes.byteLength === 0) {
          logger.error('Empty file skipped:', doc.file_path);
          failedDocuments.push({
            name: doc.file_name,
            reason: 'File is empty',
          });
          continue;
        }

        // 🔥 Critical validation
        const header = new TextDecoder().decode(bytes.slice(0, 5));

        if (!header.startsWith('%PDF-')) {
          logger.error('Invalid PDF skipped:', doc.file_path);
          failedDocuments.push({
            name: doc.file_name,
            reason: 'Not a valid PDF file',
          });
          continue;
        }

        let pdf: any = null;

        try {
          // Try loading without password first
          logger.log(`Attempting to load PDF: ${doc.file_name}`);
          pdf = await PDFDocument.load(bytes);
          logger.log(`Successfully loaded unencrypted PDF: ${doc.file_name}`);
        } catch (e: any) {
          // If encrypted, try multiple strategies
          if (
            e.message &&
            (e.message.includes('is encrypted') ||
              e.message.includes('encrypted'))
          ) {
            logger.log(
              `🔒 Encrypted PDF detected: ${doc.file_name}`
            );

            // Try decryption strategies in order
            const passwordsToTry = [
              studentId, // student ID
              '', // empty password
            ];

            pdf = await tryDecryptPDF(bytes, passwordsToTry);

            if (pdf) {
              logger.log(
                `✅ Decryption successful for: ${doc.file_name}`
              );
            } else {
              logger.warn(
                `❌ Decryption failed for: ${doc.file_name} - will insert placeholder`
              );
              failedDocuments.push({
                name: doc.file_name,
                reason: 'Encrypted and could not be decrypted',
              });

              // Insert placeholder page instead of skipping
              await createPlaceholderPage(mergedPdf, doc.file_name);
              placeholdersInserted++;
              continue;
            }
          } else {
            logger.error(
              'An unexpected error occurred while loading a PDF:',
              e
            );
            failedDocuments.push({
              name: doc.file_name,
              reason: `Error loading PDF: ${e.message}`,
            });
            throw e;
          }
        }

        if (pdf) {
          const copied = await mergedPdf.copyPages(
            pdf,
            pdf.getPageIndices()
          );
          copied.forEach((p) => mergedPdf.addPage(p));
          validPdfCount++;
        }
      } catch (e) {
        logger.error('Failed merging file:', doc.file_path, e);
        failedDocuments.push({
          name: doc.file_name,
          reason: `Failed to merge: ${e instanceof Error ? e.message : 'Unknown error'}`,
        });
        continue;
      }
    }

    if (validPdfCount === 0 && placeholdersInserted === 0) {
      logger.error('No valid PDFs found to merge.');
      return {
        blob: null,
        failedDocuments,
        placeholdersInserted,
      };
    }

    const mergedBytes = await mergedPdf.save();
    logger.log(
      `✅ HR Pack created successfully: ${validPdfCount} documents merged, ${placeholdersInserted} placeholders inserted`
    );

    return {
      blob: new Blob([mergedBytes], { type: 'application/pdf' }),
      failedDocuments,
      placeholdersInserted,
    };
  } catch (err) {
    logger.error('Error merging documents:', err);
    return {
      blob: null,
      failedDocuments: [],
      placeholdersInserted: 0,
    };
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
