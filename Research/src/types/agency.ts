export interface CaseStudy {
  title: string;
  description: string;
  challenge?: string;
  solution?: string;
  results?: string[];
  technologies?: string[];
  projectType?: string;
  duration?: string;
  imageUrl?: string;
}

export interface Client {
  name: string;
  description: string;
  website?: string;
  estimatedRevenue: string;
  platform?: string;
  industry?: string;
  caseStudies?: CaseStudy[];
  testimonial?: string;
  projectCount?: number;
  partnershipDuration?: string;
}

export interface AgencyData {
  name: string;
  description: string;
  website: string;
  platforms: string[];
  clients: Client[];
  totalCaseStudies: number;
  specializations: string[];
  caseStudiesSource?: string;
  additionalCaseStudies?: CaseStudy[];
}