import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import { logger } from './logger';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedResumeData {
  full_name?: string;
  email?: string;
  degree_program?: string;
  faculty?: string;
  year_of_study?: string;
  subjects_completed?: string;
  experience?: string;
}

/**
 * Extract text from a PDF file
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    logger.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

/**
 * Extract text from a DOCX file
 */
export const extractTextFromDOCX = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    logger.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};

/**
 * Extract text from resume file (PDF or DOCX)
 */
export const extractTextFromResume = async (file: File): Promise<string> => {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    return extractTextFromDOCX(file);
  } else {
    throw new Error('Unsupported file format. Please use PDF or DOCX.');
  }
};

/**
 * Parse extracted text to detect resume fields
 */
export const parseResumeText = (text: string): ParsedResumeData => {
  const data: ParsedResumeData = {};

  // Normalize text
  const normalizedText = text.trim();
  const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line);

  // Extract email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = normalizedText.match(emailRegex);
  if (emails && emails.length > 0) {
    data.email = emails[0];
  }

  // Extract full name (top lines with 2+ capitalized words)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    const words = line.split(/\s+/);
    const capitalizedWords = words.filter(word => /^[A-Z]/.test(word) && word.length > 1);

    if (capitalizedWords.length >= 2 && !line.includes('@')) {
      data.full_name = line;
      break;
    }
  }

  // Extract degree program (BSc, BA, BCom, Honours, etc.)
  const degreePatterns = [
    /\b(Bachelor of Science|BSc|Bachelor of Arts|BA|Bachelor of Commerce|BCom|Bachelor of Education|BEd|Master of Science|MSc|Honours?)\b/gi,
  ];

  for (const pattern of degreePatterns) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      data.degree_program = matches[0];
      break;
    }
  }

  // Extract year of study (1st Year, 2nd Year, 3rd Year, Final Year, etc.)
  const yearPattern = /\b(1st|2nd|3rd|4th|Final)\s+(?:Year|year)\b/gi;
  const yearMatches = normalizedText.match(yearPattern);
  if (yearMatches) {
    data.year_of_study = yearMatches[0];
  }

  // Extract subjects (uppercase module codes like CSC311, MAT201, etc.)
  const subjectPattern = /\b[A-Z]{2,}[0-9]{3,}\b/g;
  const subjects = normalizedText.match(subjectPattern);
  if (subjects && subjects.length > 0) {
    data.subjects_completed = [...new Set(subjects)].slice(0, 10).join(', ');
  }

  // Extract experience from sections
  const experienceSectionPattern =
    /(?:Experience|Work History|Professional Experience|Employment|Previous Roles?)[:\s]+([\s\S]*?)(?=\n\n|Experience|Education|Skills|$)/gi;

  const experienceMatches = normalizedText.match(experienceSectionPattern);
  if (experienceMatches && experienceMatches.length > 0) {
    // Extract first 200 characters from experience section
    const experienceText = experienceMatches[0].replace(/^Experience[:\s]+/i, '');
    data.experience = experienceText.substring(0, 200).trim();
  }

  // Extract faculty (Faculty of Education, Faculty of Science, etc.)
  const facultyPattern = /Faculty of (?:[A-Z][a-z]+ ){0,3}[A-Z][a-z]+/g;
  const facultyMatches = normalizedText.match(facultyPattern);
  if (facultyMatches) {
    data.faculty = facultyMatches[0];
  }

  return data;
};

/**
 * Complete resume parsing: extract and parse
 */
export const parseResume = async (file: File): Promise<ParsedResumeData> => {
  try {
    const extractedText = await extractTextFromResume(file);
    const parsedData = parseResumeText(extractedText);
    return parsedData;
  } catch (error) {
    logger.error('Error parsing resume:', error);
    throw error;
  }
};
