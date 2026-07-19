import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SwipeCard } from '../components/swipe/SwipeCard';
import { useUser } from '../contexts/UserContext';
import { getJobsForCandidate, getCandidatesForEmployer, handleSwipeAction } from '../services/swipeService';
import { JobPost, UserProfile, ExperienceLevel } from '../types';
import { PartyPopper, RefreshCw, SlidersHorizontal, X, Plus, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export function Discover() {
  const { profile } = useUser();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchFound, setMatchFound] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters state
  const [expFilters, setExpFilters] = useState<ExperienceLevel[]>([]);
  const [skillFilters, setSkillFilters] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  useEffect(() => {
    loadItems();
  }, [profile, expFilters, skillFilters]);

  const loadItems = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const filters = { experience: expFilters, skills: skillFilters };
      if (profile.role === 'candidate') {
        const jobs = await getJobsForCandidate(profile, filters);
        setItems(jobs);
      } else {
        const candidates = await getCandidatesForEmployer(profile, filters);
        setItems(candidates);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpFilter = (level: ExperienceLevel) => {
    setExpFilters(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const addSkillFilter = () => {
    if (skillInput && !skillFilters.includes(skillInput)) {
      setSkillFilters([...skillFilters, skillInput]);
      setSkillInput('');
    }
  };

  const removeSkillFilter = (skill: string) => {
    setSkillFilters(prev => prev.filter(s => s !== skill));
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!profile || items.length === 0) return;
    
    const currentItem = items[items.length - 1];
    const type = profile.role === 'candidate' ? 'candidate-to-job' : 'employer-to-candidate';
    const targetId = profile.role === 'candidate' ? currentItem.id : currentItem.uid;
    const mappedDirection = direction === 'right' ? 'like' : 'pass';

    const isMatch = await handleSwipeAction(profile.uid, targetId, type, mappedDirection);
    
    if (isMatch) {
      setMatchFound(true);
      setTimeout(() => setMatchFound(false), 3000);
    }

    setItems(prev => prev.slice(0, -1));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const transformToCardData = (item: any) => {
    if (profile?.role === 'candidate') {
      const job = item as JobPost;
      return {
        id: job.id,
        title: job.companyName || 'Company',
        subtitle: job.title,
        description: job.description,
        image: job.companyLogo,
        skills: job.requiredSkills,
        experience: job.experienceLevel,
        salary: job.salaryRange,
        location: job.location?.address,
        companySize: (job as any).companySize,
        industry: (job as any).industry,
        companyMission: (job as any).companyMission,
        mindset: job.mindset,
        culture: job.culture,
        style: job.style,
        contractDetails: job.contractDetails,
        isCandidate: false
      };
    } else {
      const candidate = item as UserProfile;
      return {
        id: candidate.uid,
        title: candidate.displayName,
        subtitle: candidate.experienceLevel || 'Candidate',
        description: candidate.bio || 'No bio provided',
        image: candidate.photoURL,
        skills: candidate.skills,
        experience: candidate.experienceLevel,
        location: candidate.location?.address,
        mindset: candidate.mindset,
        culture: candidate.culture,
        style: candidate.style,
        githubUrl: candidate.githubUrl,
        linkedinUrl: candidate.linkedinUrl,
        salary: candidate.desiredSalary,
        isCandidate: true
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 pb-24 overflow-hidden relative">
      {/* Header Actions */}
      <div className="max-w-md mx-auto mb-4 flex justify-end">
        <button 
          onClick={() => setShowFilters(true)}
          className={cn(
            "p-3 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest transition-all active:scale-95",
            (expFilters.length > 0 || skillFilters.length > 0) ? "text-orange-500 border-orange-100" : "text-gray-400"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters {(expFilters.length + skillFilters.length) > 0 && `(${expFilters.length + skillFilters.length})`}
        </button>
      </div>

      <div className="max-w-md mx-auto h-[70vh] relative">
        <AnimatePresence>
          {items.length > 0 ? (
            items.map((item, index) => (
              <div key={item.id || item.uid}>
                <SwipeCard
                  data={transformToCardData(item)}
                  onSwipe={handleSwipe}
                  isTop={index === items.length - 1}
                />
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <RefreshCw className="w-10 h-10 text-gray-300" />
              </div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Out of cards</h2>
              <p className="text-gray-500 mb-8 font-medium">
                {expFilters.length > 0 || skillFilters.length > 0 
                  ? "No one matches your current filters. Try broadening your search!" 
                  : "No one new in your area. Check back later or try different filters."}
              </p>
              <div className="flex flex-col gap-2 w-full">
                <button 
                  onClick={loadItems}
                  className="bg-black text-white px-8 py-3 rounded-2xl font-bold uppercase tracking-tight active:scale-95 transition-all shadow-lg"
                >
                  Reload
                </button>
                {(expFilters.length > 0 || skillFilters.length > 0) && (
                  <button 
                    onClick={() => { setExpFilters([]); setSkillFilters([]); }}
                    className="text-gray-400 font-bold uppercase text-[10px] tracking-widest p-2"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 z-[120] bg-white rounded-t-[40px] p-8 pb-12 max-w-md mx-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="p-2 bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-8">
                {/* Experience Levels */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 block mb-4">Experience Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['junior', 'mid', 'senior', 'lead'] as ExperienceLevel[]).map(level => (
                      <button
                        key={level}
                        onClick={() => toggleExpFilter(level)}
                        className={cn(
                          "p-3 rounded-xl border text-sm font-bold uppercase tracking-tight transition-all flex items-center justify-between",
                          expFilters.includes(level) 
                            ? "bg-black text-white border-black" 
                            : "border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        {level}
                        {expFilters.includes(level) && <Check className="w-4 h-4 ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Skills Filters */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 block mb-4">Skills</label>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSkillFilter()}
                      placeholder="Add a skill to filter..."
                      className="flex-1 bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                    />
                    <button 
                      onClick={addSkillFilter}
                      className="bg-black text-white w-14 rounded-2xl flex items-center justify-center shadow-lg"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skillFilters.map(skill => (
                      <span key={skill} className="bg-orange-50 text-orange-600 font-bold uppercase text-[10px] tracking-widest px-3 py-1.5 rounded-full flex items-center gap-2">
                        {skill}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => removeSkillFilter(skill)} />
                      </span>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-orange-500 text-white p-5 rounded-[32px] font-black italic uppercase tracking-tighter text-xl shadow-xl shadow-orange-100 active:scale-95 transition-all"
                >
                  Show Results
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Match Overlay */}
      <AnimatePresence>
        {matchFound && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-white rounded-[40px] p-8 text-center shadow-2xl max-w-sm w-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500" />
              <PartyPopper className="w-16 h-16 text-orange-500 mx-auto mb-6" />
              <h2 className="text-4xl font-black italic uppercase italic tracking-tighter mb-2">It's a Match!</h2>
              <p className="text-gray-500 font-medium mb-8">You both liked each other. Head over to matches to start talking.</p>
              <button 
                onClick={() => setMatchFound(false)}
                className="w-full bg-orange-500 text-white p-4 rounded-2xl font-bold uppercase tracking-tight shadow-xl shadow-orange-100"
              >
                Keep Swiping
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
