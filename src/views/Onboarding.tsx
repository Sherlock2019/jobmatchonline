import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { createProfile } from '../services/authService';
import { UserRole, ExperienceLevel } from '../types';
import { Check, User, Briefcase, ChevronRight, Plus, X, Linkedin } from 'lucide-react';
import { motion } from 'motion/react';

export function Onboarding() {
  const { user } = useUser();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('junior');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  
  const [location, setLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [mindset, setMindset] = useState('');
  const [culture, setCulture] = useState('');
  const [style, setStyle] = useState('');
  const [desiredSalary, setDesiredSalary] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [industry, setIndustry] = useState('');
  const [mission, setMission] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

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
        // In a real app we'd reverse geocode here
        setLocation({
          lat: latitude,
          lng: longitude,
          address: "Detected current location"
        });
        setIsGettingLocation(false);
      }, (error) => {
        console.error(error);
        setIsGettingLocation(false);
      });
    }
  };

  const handleComplete = async () => {
    if (!user || !role) return;

    try {
      await createProfile(user.uid, {
        displayName,
        role,
        bio,
        experienceLevel,
        skills,
        photoURL: user.photoURL,
        email: user.email,
        languages: ['English'],
        location,
        githubUrl,
        linkedinUrl,
        resumeUrl,
        mindset,
        culture,
        style,
        desiredSalary,
        companySize,
        industry,
        mission,
      });
      navigate('/discover');
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white pt-16 px-6 max-w-sm mx-auto overflow-y-auto pb-32">
      <div className="mb-8">
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3, 4, 5].map(s => (
            <div 
              key={s} 
              className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-orange-500' : 'bg-gray-100'}`} 
            />
          ))}
        </div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter">
          {step === 1 && "The Role"}
          {step === 2 && "The Person"}
          {step === 3 && "The Talent"}
          {step === 4 && "The Location"}
          {step === 5 && "The Mindset"}
        </h1>
      </div>

      <div className="min-h-[420px]">
        {step === 1 && (
          <div className="space-y-4">
            <button
              onClick={() => setRole('candidate')}
              className={`w-full p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${
                role === 'candidate' ? 'border-orange-500 bg-orange-50' : 'border-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-500">
                <User className="w-6 h-6" />
              </div>
              <div className="text-left font-bold uppercase italic">I'm a Candidate</div>
            </button>

            <button
              onClick={() => setRole('employer')}
              className={`w-full p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${
                role === 'employer' ? 'border-orange-500 bg-orange-50' : 'border-gray-100'
              }`}
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-500">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="text-left font-bold uppercase italic">I'm an Employer</div>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium"
                placeholder="How you want to be seen"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Experience Level</label>
              <div className="grid grid-cols-2 gap-2">
                {(['junior', 'mid', 'senior', 'lead'] as ExperienceLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => setExperienceLevel(level)}
                    className={`p-3 rounded-xl border text-sm font-bold uppercase tracking-tight transition-all ${
                      experienceLevel === level ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Short Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium resize-none"
                placeholder="What makes you stand out?"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Top Skills</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  className="flex-1 p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none transition-all font-medium"
                  placeholder="e.g. React"
                />
                <button onClick={handleAddSkill} className="bg-black text-white w-14 rounded-2xl flex items-center justify-center"><Plus/></button>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                {skills.map(s => (
                  <span key={s} className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full flex items-center gap-1">
                    {s} <X className="w-3 h-3 cursor-pointer" onClick={() => setSkills(skills.filter(sk => sk !== s))} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Location</label>
              <div className="p-6 rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold uppercase italic text-sm">{location ? location.address : "Location Hidden"}</div>
                  <div className="text-xs text-gray-400 font-medium">Use GPS for real-time proximity matching</div>
                </div>
                <button 
                  onClick={getUserLocation}
                  disabled={isGettingLocation}
                  className="bg-black text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                >
                  {isGettingLocation ? "Locating..." : "Get Location"}
                </button>
              </div>
              <input
                type="text"
                value={location?.address || ''}
                onChange={(e) => setLocation(prev => ({ lat: prev?.lat || 0, lng: prev?.lng || 0, address: e.target.value }))}
                className="w-full mt-4 p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium text-sm"
                placeholder="Or type address manually"
              />
            </div>
            {role === 'candidate' ? (
              <>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">GitHub Portfolio</label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
                    placeholder="https://github.com/username"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Desired Salary</label>
                  <input
                    type="text"
                    value={desiredSalary}
                    onChange={(e) => setDesiredSalary(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
                    placeholder="e.g. $120,000"
                  />
                </div>
              </>
            ) : (
              <>
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
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium resize-none"
                    placeholder="Redefining the future of..."
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Work Mindset</label>
              <textarea
                value={mindset}
                onChange={(e) => setMindset(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium min-h-[80px]"
                placeholder="e.g. Speed over perfection"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Team Culture Preference</label>
              <textarea
                value={culture}
                onChange={(e) => setCulture(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium min-h-[80px]"
                placeholder="e.g. Radical transparency"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 mb-2 block">Working Style</label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-medium"
                placeholder="e.g. Brutalist Minimalism"
              />
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-10 left-6 right-6 max-w-sm mx-auto flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-6 rounded-2xl border border-gray-100 font-bold text-gray-400 bg-white"
          >
            Back
          </button>
        )}
        <button
          onClick={() => step === 5 ? handleComplete() : setStep(step + 1)}
          disabled={step === 1 && !role}
          className="flex-1 bg-orange-500 text-white p-4 rounded-3xl font-black uppercase italic tracking-tighter text-xl shadow-xl shadow-orange-100 disabled:opacity-50"
        >
          {step === 5 ? "Finish" : "Next"}
          <ChevronRight className="w-5 h-5 ml-1" />
        </button>
      </div>
    </div>
  );
}
