import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { updateProfile } from '../../services/authService';
import { X, Sparkles, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';
import { extractProfileFromResume, StructuredResume } from '../../services/aiService';
import { ExperienceLevel } from '../../types';

export function EditProfile({ onClose }: { onClose: () => void }) {
  const { profile } = useUser();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [companySize, setCompanySize] = useState(profile?.companySize || '');
  const [industry, setIndustry] = useState(profile?.industry || '');
  const [mission, setMission] = useState(profile?.mission || '');
  const [skills, setSkills] = useState(profile?.skills?.join(', ') || '');
  const [culturalSkills, setCulturalSkills] = useState(profile?.culturalSkills?.join(', ') || '');
  const [languages, setLanguages] = useState(profile?.languages?.join(', ') || '');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(profile?.experienceLevel || 'junior');
  const [mindset, setMindset] = useState(profile?.mindset || '');
  const [structuredResume, setStructuredResume] = useState<StructuredResume | undefined>(profile?.structuredResume);
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAiExtract = async () => {
    if (!resumeText.trim()) return;
    setIsAiLoading(true);
    try {
      const extracted = await extractProfileFromResume(resumeText);
      setStructuredResume(extracted);
      
      // Map structures to UI
      if (extracted.candidate_profile.full_name) setDisplayName(extracted.candidate_profile.full_name);
      if (extracted.candidate_profile.summary) setBio(extracted.candidate_profile.summary);
      
      const allSkills = [
        ...(extracted.skills.technical_skills || []),
        ...(extracted.skills.programming_languages || []),
        ...(extracted.skills.frameworks || [])
      ];
      setSkills(allSkills.join(', '));
      setCulturalSkills(extracted.skills.soft_skills?.join(', ') || '');
      setLanguages(extracted.languages?.map(l => `${l.language} (${l.proficiency})`).join(', ') || '');
      
      const level = extracted.resume_quality.experience_level_detected?.toLowerCase();
      if (['junior', 'mid', 'senior', 'lead'].includes(level)) {
        setExperienceLevel(level as ExperienceLevel);
      }
      
      setMindset(extracted.candidate_profile.summary.substring(0, 200));
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      await updateProfile(profile.uid, {
        displayName,
        bio,
        companySize,
        industry,
        mission,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        culturalSkills: culturalSkills.split(',').map(s => s.trim()).filter(Boolean),
        languages: languages.split(',').map(s => s.trim()).filter(Boolean),
        experienceLevel,
        mindset,
        structuredResume
      });
      onClose();
    } catch (error) {
      console.error(error);
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
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 leading-none">Edit Profile</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {profile?.role === 'candidate' && (
            <div className="p-6 bg-orange-50 rounded-[32px] border border-orange-100 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-5 h-5 text-orange-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500">AI Resume Import</h4>
              </div>
              <textarea 
                placeholder="Paste your resume text here..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="w-full p-4 bg-white rounded-2xl border-none outline-none text-[11px] font-medium resize-none h-24 mb-3"
              />
              <button
                type="button"
                onClick={handleAiExtract}
                disabled={isAiLoading || !resumeText}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-black italic uppercase tracking-tighter text-sm flex items-center justify-center gap-2 hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                {isAiLoading ? "Analyzing..." : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Extract Profile with AI
                  </>
                )}
              </button>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Name</label>
            <input
              required
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-bold"
              placeholder="Display Name"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Experience Level</label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
            >
              <option value="junior">Junior</option>
              <option value="mid">Mid-Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead / Architect</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Main Skills</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
              placeholder="React, TypeScript, UI Design..."
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Cultural Skills & Values</label>
            <input
              type="text"
              value={culturalSkills}
              onChange={(e) => setCulturalSkills(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
              placeholder="Mentorship, Remote-first, Collaboration..."
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Languages</label>
            <input
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
              placeholder="English, French, Spanish..."
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Philosophical Mindset</label>
            <textarea
              value={mindset}
              onChange={(e) => setMindset(e.target.value)}
              rows={2}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium resize-none text-sm"
              placeholder="What drives your work style?"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Short Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium resize-none text-sm"
              placeholder="Bio"
            />
          </div>

          {profile?.role === 'employer' && (
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Company Size</label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
                >
                  <option value="">Select size</option>
                  <option value="1-10">1-10 Employees</option>
                  <option value="11-50">11-50 Employees</option>
                  <option value="51-200">51-200 Employees</option>
                  <option value="201-500">201-500 Employees</option>
                  <option value="500+">500+ Employees</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
                  placeholder="e.g. Fintech, AI, Design"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Mission Statement</label>
                <textarea
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  rows={3}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium resize-none text-sm"
                  placeholder="Company Mission"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white p-5 rounded-[40px] font-black italic uppercase tracking-tighter text-2xl shadow-xl shadow-gray-100 disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
