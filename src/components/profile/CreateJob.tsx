import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ExperienceLevel } from '../../types';
import { X, Plus, Sparkles, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractJobFromDescription, StructuredJob } from '../../services/aiService';

export function CreateJob({ onClose }: { onClose: () => void }) {
  const { profile } = useUser();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('junior');
  const [salaryRange, setSalaryRange] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [culturalSkills, setCulturalSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [structuredJob, setStructuredJob] = useState<StructuredJob | undefined>(undefined);
  
  const [mindset, setMindset] = useState('');
  const [culture, setCulture] = useState('');
  const [style, setStyle] = useState('');
  const [contractDetails, setContractDetails] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [jdText, setJdText] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const handleAiExtract = async () => {
    if (!jdText.trim()) return;
    setIsAiLoading(true);
    try {
      const extracted = await extractJobFromDescription(jdText);
      setStructuredJob(extracted);
      
      // Map to UI
      setTitle(extracted.job_profile.job_title);
      setDescription(extracted.job_profile.job_summary);
      
      const allSkills = [
        ...(extracted.requirements.must_have_skills || []),
        ...(extracted.requirements.programming_languages || []),
        ...(extracted.requirements.frameworks || [])
      ];
      setSkills(allSkills);
      setCulturalSkills(extracted.requirements.soft_skills || []);
      setSalaryRange(extracted.job_profile.salary_range);
      setContractDetails(extracted.job_profile.employment_type);
      
      const level = extracted.job_quality.seniority_detected?.toLowerCase();
      if (['junior', 'mid', 'senior', 'lead'].includes(level)) {
        setExperienceLevel(level as ExperienceLevel);
      }
      
      setMindset(extracted.job_profile.job_summary.substring(0, 200));
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddSkill = () => {
    if (skillInput && !skills.includes(skillInput)) {
      setSkills([...skills, skillInput]);
      setSkillInput('');
    }
  };

  const getUserLocation = () => {
    setIsGettingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          address: "Detected Office Location"
        });
        setIsGettingLocation(false);
      }, (error) => {
        console.error(error);
        setIsGettingLocation(false);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'jobs'), {
        employerUid: profile.uid,
        companyName: profile.displayName,
        companyLogo: profile.photoURL || '',
        companySize: profile.companySize || '',
        industry: profile.industry || '',
        companyMission: profile.mission || '',
        title,
        description,
        experienceLevel,
        salaryRange,
        requiredSkills: skills,
        culturalSkills,
        requiredLanguages: languages,
        location,
        mindset,
        culture,
        style,
        contractDetails,
        structuredJob,
        createdAt: Date.now()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'jobs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-0 z-[100] bg-white pt-10"
    >
      <div className="px-6 max-w-md mx-auto h-full overflow-y-auto pb-32">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 leading-none">Post a Job</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-6 bg-orange-50 rounded-[32px] border border-orange-100 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500">AI Job Description Parser</h4>
            </div>
            <textarea 
              placeholder="Paste your job description here..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              className="w-full p-4 bg-white rounded-2xl border-none outline-none text-[11px] font-medium resize-none h-24 mb-3"
            />
            <button
              type="button"
              onClick={handleAiExtract}
              disabled={isAiLoading || !jdText}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-black italic uppercase tracking-tighter text-sm flex items-center justify-center gap-2 hover:bg-orange-600 transition-all disabled:opacity-50"
            >
              {isAiLoading ? "Processing JD..." : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Job Requirements
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">General Info</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
              placeholder="Job Title"
            />
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium resize-none text-sm"
              placeholder="Description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <input
                type="text"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium text-sm"
                placeholder="Salary Range"
              />
              <select 
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as any)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold uppercase text-[10px] tracking-widest"
              >
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Contract Details</label>
            <input
              type="text"
              value={contractDetails}
              onChange={(e) => setContractDetails(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
              placeholder="e.g. Full-time, Remote, Equity"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Location</label>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={getUserLocation}
                disabled={isGettingLocation}
                className="bg-black text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {isGettingLocation ? "Locating..." : "Get GPS"}
              </button>
              <input
                type="text"
                value={location?.address || ''}
                onChange={(e) => setLocation(prev => ({ lat: prev?.lat || 0, lng: prev?.lng || 0, address: e.target.value }))}
                className="flex-1 p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium text-sm"
                placeholder="Office Address"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">Culture & Fit</label>
            <input
              type="text"
              value={mindset}
              onChange={(e) => setMindset(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium text-sm"
              placeholder="Company Mindset"
            />
            <input
              type="text"
              value={culture}
              onChange={(e) => setCulture(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium text-sm"
              placeholder="Team Culture"
            />
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium text-sm"
              placeholder="Working Style"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Required Skills</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                className="flex-1 p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
                placeholder="Add skill"
              />
              <button 
                type="button"
                onClick={handleAddSkill} 
                className="bg-black text-white w-14 rounded-2xl flex items-center justify-center font-bold"
              ><Plus/></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {skills.map(s => (
                <span key={s} className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  {s} <X className="w-3 h-3 cursor-pointer" onClick={() => setSkills(skills.filter(sk => sk !== s))} />
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Cultural Values & Traits</label>
            <div className="flex flex-wrap gap-2">
              {culturalSkills.map(s => (
                <span key={s} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  {s} <X className="w-3 h-3 cursor-pointer" onClick={() => setCulturalSkills(culturalSkills.filter(sk => sk !== s))} />
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Languages</label>
            <div className="flex flex-wrap gap-2">
              {languages.map(s => (
                <span key={s} className="bg-green-50 text-green-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  {s} <X className="w-3 h-3 cursor-pointer" onClick={() => setLanguages(languages.filter(sk => sk !== s))} />
                </span>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white p-5 rounded-[40px] font-black italic uppercase tracking-tighter text-2xl shadow-xl shadow-orange-100 disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? "Posting..." : "Confirm & Post"}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
