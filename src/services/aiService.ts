import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface StructuredResume {
  candidate_profile: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
    summary: string;
  };
  target_role: {
    desired_title: string;
    seniority_level: string;
    preferred_industries: string[];
    preferred_locations: string[];
    remote_preference: string;
  };
  skills: {
    technical_skills: string[];
    programming_languages: string[];
    frameworks: string[];
    cloud_platforms: string[];
    databases: string[];
    devops_tools: string[];
    ai_ml_tools: string[];
    business_tools: string[];
    soft_skills: string[];
    certifications: string[];
  };
  work_experience: Array<{
    company: string;
    job_title: string;
    start_date: string;
    end_date: string;
    duration_months: number;
    location: string;
    industry: string;
    responsibilities: string[];
    achievements: string[];
    technologies_used: string[];
    leadership_scope: {
      team_size: string;
      budget_owned: string;
      stakeholders: string[];
    };
  }>;
  languages: Array<{
    language: string;
    proficiency: string;
  }>;
  resume_quality: {
    experience_level_detected: string;
  };
}

export interface StructuredJob {
  job_profile: {
    job_title: string;
    company: string;
    department: string;
    location: string;
    remote_policy: string;
    employment_type: string;
    seniority_level: string;
    salary_range: string;
    job_summary: string;
  };
  requirements: {
    must_have_skills: string[];
    nice_to_have_skills: string[];
    programming_languages: string[];
    frameworks: string[];
    soft_skills: string[];
  };
  business_context: {
    industry: string;
  };
  job_quality: {
    seniority_detected: string;
  };
}

export async function extractProfileFromResume(text: string): Promise<StructuredResume> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract professional profile information from the following resume text into the specified structured format. 
  Resume Text:
  ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          candidate_profile: {
            type: Type.OBJECT,
            properties: {
              full_name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              location: { type: Type.STRING },
              linkedin: { type: Type.STRING },
              github: { type: Type.STRING },
              portfolio: { type: Type.STRING },
              summary: { type: Type.STRING }
            }
          },
          target_role: {
            type: Type.OBJECT,
            properties: {
              desired_title: { type: Type.STRING },
              seniority_level: { type: Type.STRING },
              preferred_industries: { type: Type.ARRAY, items: { type: Type.STRING } },
              preferred_locations: { type: Type.ARRAY, items: { type: Type.STRING } },
              remote_preference: { type: Type.STRING }
            }
          },
          skills: {
            type: Type.OBJECT,
            properties: {
              technical_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              programming_languages: { type: Type.ARRAY, items: { type: Type.STRING } },
              frameworks: { type: Type.ARRAY, items: { type: Type.STRING } },
              soft_skills: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          work_experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                job_title: { type: Type.STRING },
                responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          languages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                language: { type: Type.STRING },
                proficiency: { type: Type.STRING }
              }
            }
          },
          resume_quality: {
            type: Type.OBJECT,
            properties: {
              experience_level_detected: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

export async function extractJobFromDescription(text: string): Promise<StructuredJob> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract job requirements from the following job description text into the specified structured format.
  Job Description:
  ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          job_profile: {
            type: Type.OBJECT,
            properties: {
              job_title: { type: Type.STRING },
              company: { type: Type.STRING },
              location: { type: Type.STRING },
              remote_policy: { type: Type.STRING },
              employment_type: { type: Type.STRING },
              seniority_level: { type: Type.STRING },
              salary_range: { type: Type.STRING },
              job_summary: { type: Type.STRING }
            }
          },
          requirements: {
            type: Type.OBJECT,
            properties: {
              must_have_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              nice_to_have_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              programming_languages: { type: Type.ARRAY, items: { type: Type.STRING } },
              soft_skills: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          business_context: {
            type: Type.OBJECT,
            properties: {
              industry: { type: Type.STRING }
            }
          },
          job_quality: {
            type: Type.OBJECT,
            properties: {
              seniority_detected: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text);
}
