import { StructuredResume, StructuredJob } from '../services/aiService';

export type UserRole = 'candidate' | 'employer';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead';

export interface UserProfile {
  uid: string;
  role: UserRole;
  displayName: string;
  photoURL?: string;
  email?: string;
  bio?: string;
  skills?: string[];
  culturalSkills?: string[];
  languages?: string[];
  experienceLevel?: ExperienceLevel;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  linkedinUrl?: string;
  resumeUrl?: string;
  githubUrl?: string;
  desiredSkills?: string[];
  mindset?: string;
  culture?: string;
  style?: string;
  desiredSalary?: string;
  // Employer / Company specific
  companySize?: string;
  industry?: string;
  mission?: string;
  createdAt: number;
  // AI Enhanced Data
  structuredResume?: StructuredResume;
}

export interface JobPost {
  id: string;
  employerUid: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  description: string;
  requiredSkills: string[];
  culturalSkills?: string[];
  requiredLanguages: string[];
  experienceLevel: ExperienceLevel;
  salaryRange?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  mindset?: string;
  culture?: string;
  style?: string;
  contractDetails?: string;
  createdAt: number;
  // AI Enhanced Data
  structuredJob?: StructuredJob;
}

export interface Swipe {
  id?: string;
  fromUid: string;
  toId: string;
  type: 'candidate-to-job' | 'employer-to-candidate';
  direction: 'like' | 'pass';
  timestamp: number;
}

export interface Match {
  id: string;
  candidateUid: string;
  jobPostId: string;
  employerUid: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastTimestamp?: number;
  candidateName: string;
  candidatePhoto: string;
  employerName: string;
  employerPhoto: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  read?: boolean;
  meetingRequest?: {
    title: string;
    startTime: number;
    meetLink: string;
  };
}
