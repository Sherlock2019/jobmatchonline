import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { MapPin, Briefcase, GraduationCap, X, Heart, Info, Globe, Linkedin, User as UserIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ExperienceLevel } from '../../types';

interface SwipeCardProps {
  data: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    image?: string;
    skills?: string[];
    languages?: string[];
    experience?: ExperienceLevel;
    location?: string;
    salary?: string;
    mindset?: string;
    culture?: string;
    style?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    contractDetails?: string;
    companySize?: string;
    industry?: string;
    companyMission?: string;
    isCandidate?: boolean;
  };
  onSwipe: (direction: 'left' | 'right') => void;
  isTop: boolean;
}

export function SwipeCard({ data, onSwipe, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-50, -150], [0, 1]);

  const [showDetails, setShowDetails] = useState(false);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onSwipe('right');
    } else if (info.offset.x < -100) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity, zIndex: isTop ? 10 : 0 }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      exit={{ 
        x: x.get() > 0 ? 500 : -500, 
        opacity: 0, 
        scale: 0.5,
        transition: { duration: 0.2 } 
      }}
      className={cn(
        "absolute inset-0 w-full h-full bg-white rounded-3xl shadow-xl overflow-hidden cursor-grab active:cursor-grabbing border border-gray-100",
        !isTop && "scale-95 translate-y-4 opacity-50"
      )}
    >
      {/* Background/Image Placeholder */}
      <div className="relative h-2/3 bg-gradient-to-br from-orange-100 to-red-100">
        {data.image ? (
          <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {data.isCandidate ? (
              <UserIcon className="w-24 h-24 text-blue-200" />
            ) : (
              <Briefcase className="w-24 h-24 text-orange-200" />
            )}
          </div>
        )}
        
        <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {data.location || 'Remote'}
        </div>

        {/* Swipe Indicators */}
        <motion.div 
          style={{ opacity: likeOpacity }}
          className="absolute top-8 left-8 border-4 border-green-500 text-green-500 font-black text-4xl px-4 py-2 rounded-xl rotate-[-20deg] uppercase"
        >
          LIKE
        </motion.div>
        <motion.div 
          style={{ opacity: nopeOpacity }}
          className="absolute top-8 right-8 border-4 border-red-500 text-red-500 font-black text-4xl px-4 py-2 rounded-xl rotate-[20deg] uppercase"
        >
          NOPE
        </motion.div>

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
          <h2 className="text-3xl font-bold uppercase italic tracking-tighter leading-none mb-1">{data.title}</h2>
          <p className="text-xl opacity-90 font-medium italic">{data.subtitle}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {data.experience && (
              <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest flex items-center gap-1">
                <GraduationCap className="w-3 h-3" /> {data.experience}
              </span>
            )}
            {data.salary && (
              <span className="bg-white text-black px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest">
                {data.salary}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details Scroll Area */}
      <div className="p-6 overflow-y-auto h-1/3 bg-white pb-32">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black text-gray-300 uppercase text-[10px] tracking-widest flex items-center gap-1">
            <Info className="w-3 h-3" /> Mission
          </h3>
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="text-orange-500 text-[10px] font-black uppercase tracking-widest"
          >
            {showDetails ? 'Hide' : 'Expand'}
          </button>
        </div>
        
        <p className={cn("text-gray-600 font-medium leading-relaxed mb-4", showDetails ? "" : "line-clamp-2")}>
          {data.description}
        </p>

        {showDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              {data.mindset && (
                <div>
                  <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Mindset</h4>
                  <p className="text-xs font-bold text-gray-900 leading-tight">{data.mindset}</p>
                </div>
              )}
              {data.style && (
                <div>
                  <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Style</h4>
                  <p className="text-xs font-bold text-gray-900 leading-tight">{data.style}</p>
                </div>
              )}
            </div>

            {data.culture && (
              <div>
                <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Culture</h4>
                <p className="text-xs font-bold text-gray-900 leading-tight">{data.culture}</p>
              </div>
            )}

            {data.contractDetails && (
              <div className="bg-gray-50 p-3 rounded-xl">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Contract Details</h4>
                <p className="text-xs font-bold text-gray-900">{data.contractDetails}</p>
              </div>
            )}

            {data.githubUrl && (
              <a href={data.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black text-white p-3 rounded-2xl">
                <Globe className="w-5 h-5" />
                <span className="font-bold uppercase text-[10px] tracking-widest">View GitHub Portfolio</span>
              </a>
            )}

            {data.linkedinUrl && (
              <a href={data.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#0077b5] text-white p-3 rounded-2xl">
                <Linkedin className="w-5 h-5 fill-current" />
                <span className="font-bold uppercase text-[10px] tracking-widest">Connect on LinkedIn</span>
              </a>
            )}

            {(data.companySize || data.industry || data.companyMission) && (
              <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 space-y-4">
                <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Company Overview</h4>
                <div className="grid grid-cols-2 gap-4">
                  {data.industry && (
                    <div>
                      <h5 className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Industry</h5>
                      <p className="text-xs font-bold text-gray-900">{data.industry}</p>
                    </div>
                  )}
                  {data.companySize && (
                    <div>
                      <h5 className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Size</h5>
                      <p className="text-xs font-bold text-gray-900">{data.companySize}</p>
                    </div>
                  )}
                </div>
                {data.companyMission && (
                  <div>
                    <h5 className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Mission</h5>
                    <p className="text-xs font-bold text-gray-900 italic">"{data.companyMission}"</p>
                  </div>
                )}
              </div>
            )}

            {data.skills && data.skills.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Stack</h4>
                <div className="flex flex-wrap gap-2">
                  {data.skills.map(skill => (
                    <span key={skill} className="bg-orange-50 px-3 py-1 rounded-full text-[10px] font-black text-orange-600 uppercase">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Swipe buttons (static placeholders at bottom) */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-8 pointer-events-none">
        <button className="w-14 h-14 rounded-full bg-white shadow-lg border border-red-50 border-b-4 border-b-red-100 flex items-center justify-center text-red-500 pointer-events-auto active:scale-90 transition-transform">
          <X className="w-8 h-8" />
        </button>
        <button className="w-14 h-14 rounded-full bg-white shadow-lg border border-green-50 border-b-4 border-b-green-100 flex items-center justify-center text-green-500 pointer-events-auto active:scale-90 transition-transform">
          <Heart className="w-8 h-8 fill-current" />
        </button>
      </div>
    </motion.div>
  );
}
