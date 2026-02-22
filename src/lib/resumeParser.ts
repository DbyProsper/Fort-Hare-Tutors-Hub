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
  contact_number?: string;
  residential_address?: string;
  languages_spoken?: string;
  skills_competencies?: string;
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

  // Extract contact number (starts with 0 or +)
  const phoneRegex = /(?:\+27|0)\s*(?:\d[\s-]*){8,10}/gi;
  const phoneMatches = normalizedText.match(phoneRegex);
  if (phoneMatches && phoneMatches.length > 0) {
    data.contact_number = phoneMatches[0].trim();
  }

  // Extract degree program (BSc, BA, BCom, Honours, etc.) - expanded list
  const degreeKeywords = [
    'Bachelor of Science', 'BSc',
    'Bachelor of Arts', 'BA',
    'Bachelor of Commerce', 'BCom',
    'Bachelor of Education', 'BEd',
    'Master of Science', 'MSc',
    'Master of Commerce', 'MCom',
    'Master of Public Administration', 'MPA',
    'Master of Arts', 'MA',
    'Doctor of Philosophy', 'PhD',
    'Bachelor of Social Science',
    'Bachelor of Music',
    'Bachelor of Social Work',
    'Bachelor of Nursing',
    'Bachelor of Speech-Language Therapy',
    'Master of Nursing',
    'Bachelor of Agriculture', 'BAgric', 'BSc (Agric)',
    'Master of Education', 'MEd',
    'Post Graduate Diploma in Education', 'PGCE',
    'Doctor of Law', 'LLD',
    'Master of Law', 'LLM',
    'Bachelor of Laws', 'LLB',
  ];

  for (const degree of degreeKeywords) {
    if (normalizedText.toLowerCase().includes(degree.toLowerCase())) {
      data.degree_program = degree;
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

  // Extract residential address (look for keywords like street, avenue, road, etc.)
  const addressPatterns = [
    /(?:Address|Residential Address|Home Address)[:\s]+([^,\n]+(?:,[^,\n]+){0,2})/gi,
    /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Close|Crescent|Gardens|Park|Place|Square|Court|Terrace|Heights)[\w\s]*,?\s*[A-Za-z\s]+,?\s*\d{4,5})/gi,
  ];

  for (const pattern of addressPatterns) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      data.residential_address = matches[0].replace(/^Address[:\s]+|^Residential Address[:\s]+|^Home Address[:\s]+/i, '').trim();
      break;
    }
  }

  // Extract work experience and employment history
  const experienceSectionPatterns = [
    /(?:Work Experience|Professional Experience|Employment|Employment History|Previous Roles?)[:\s]+([\s\S]*?)(?=\n\n|Work Experience|Education|Skills|Languages|$)/gi,
    /(?:Experience)[:\s]+([\s\S]*?)(?=\n\n|Education|Skills|Languages|$)/gi,
  ];

  for (const pattern of experienceSectionPatterns) {
    const matches = normalizedText.match(pattern);
    if (matches && matches.length > 0) {
      const experienceText = matches[0]
        .replace(/^Work Experience[:\s]+|^Professional Experience[:\s]+|^Employment[:\s]+|^Employment History[:\s]+|^Experience[:\s]+/i, '')
        .trim();
      if (experienceText.length > 0) {
        data.experience = experienceText.substring(0, 300).trim();
        break;
      }
    }
  }

  // Extract languages spoken
  const languageSectionPatterns = [
    /(?:Languages?|Languages Spoken)[:\s]+([\s\S]*?)(?=\n\n|Skills|Experience|Education|$)/gi,
  ];

  for (const pattern of languageSectionPatterns) {
    const matches = normalizedText.match(pattern);
    if (matches && matches.length > 0) {
      const languagesText = matches[0]
        .replace(/^Languages?[:\s]+|^Languages Spoken[:\s]+/i, '')
        .split(/[,\n]/)
        .map(lang => lang.trim())
        .filter(lang => lang && lang.length > 1)
        .filter(lang => !lang.match(/^\d+|^•|^-|^language/i))
        .slice(0, 8)
        .join(', ');
      if (languagesText.length > 0) {
        data.languages_spoken = languagesText;
        break;
      }
    }
  }

  // Extract skills and competencies
  const skillsSectionPatterns = [
    /(?:Skills|Competencies|Skills & Competencies|Key Skills)[:\s]+([\s\S]*?)(?=\n\n|Experience|Languages|Education|$)/gi,
  ];

  for (const pattern of skillsSectionPatterns) {
    const matches = normalizedText.match(pattern);
    if (matches && matches.length > 0) {
      const skillsText = matches[0]
        .replace(/^Skills[:\s]+|^Competencies[:\s]+|^Skills & Competencies[:\s]+|^Key Skills[:\s]+/i, '')
        .split(/[,\n]/)
        .map(skill => skill.trim().replace(/^•\s*|^-\s*/g, ''))
        .filter(skill => skill && skill.length > 1)
        .slice(0, 10)
        .join(', ');
      if (skillsText.length > 0) {
        data.skills_competencies = skillsText;
        break;
      }
    }
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
