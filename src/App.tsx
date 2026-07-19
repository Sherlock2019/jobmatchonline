import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { Navbar } from './components/layout/Navbar';
import { Landing } from './views/Landing';
import { Onboarding } from './views/Onboarding';
import { Discover } from './views/Discover';
import { Matches } from './views/Matches';
import { seedMockData } from './services/mockDataService';
import { CreateJob } from './components/profile/CreateJob';
import { EditProfile } from './components/profile/EditProfile';
import { AnimatePresence } from 'motion/react';
import { Settings } from 'lucide-react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/" />;
}

function AppContent() {
  const { user, profile } = useUser();

  useEffect(() => {
    if (user && profile) {
      seedMockData(user.uid, profile.role);
    }
  }, [user, profile]);

  return (
    <Router>
      <div className="min-h-screen bg-white">
        {user && profile && <Navbar />}
        <Routes>
          <Route path="/" element={user && profile ? <Navigate to="/discover" /> : <Landing />} />
          <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
          <Route path="/discover" element={<PrivateRoute><Discover /></PrivateRoute>} />
          <Route path="/matches" element={<PrivateRoute><Matches /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfileView /></PrivateRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

// Simple Profile View
function ProfileView() {
  const { profile, logout } = useUser();
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  if (!profile) return null;

  return (
    <div className="pt-20 px-6 max-w-md mx-auto relative min-h-screen pb-20">
      <div className="absolute top-24 right-6">
        <button 
          onClick={() => setShowEditProfile(true)}
          className="p-3 bg-gray-100 rounded-2xl text-gray-400 hover:text-black transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="text-center mb-12">
        <div className="w-32 h-32 bg-gray-100 rounded-[50px] mx-auto mb-6 overflow-hidden ring-8 ring-orange-50/50 border-4 border-white shadow-2xl shadow-orange-100 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
          {profile.photoURL ? (
            <img src={profile.photoURL} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-4xl italic">
              {profile.displayName[0]}
            </div>
          )}
        </div>
        <h2 className="text-4xl font-black italic uppercase italic tracking-tighter text-gray-900 leading-none">
          {profile.displayName}
        </h2>
        <p className="text-orange-500 font-bold uppercase text-[10px] tracking-[0.4em] mt-2">
          {profile.role}
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-8 bg-gray-50 rounded-[40px] border border-gray-100">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6">Activity</h3>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-left">
              <div className="text-4xl font-black italic tracking-tighter">12</div>
              <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-1">Swipes</div>
            </div>
            <div className="text-left">
              <div className="text-4xl font-black italic tracking-tighter text-orange-500">3</div>
              <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-1">Matches</div>
            </div>
          </div>
        </div>

        {profile.role === 'employer' && (
          <div className="space-y-4">
            <div className="p-8 bg-gray-50 rounded-[40px] border border-gray-100">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 mb-6">Company Profile</h3>
              <div className="space-y-4">
                {profile.industry && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Industry</span>
                    <p className="text-sm font-bold text-gray-900">{profile.industry}</p>
                  </div>
                )}
                {profile.companySize && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Size</span>
                    <p className="text-sm font-bold text-gray-900">{profile.companySize}</p>
                  </div>
                )}
                {profile.mission && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Mission</span>
                    <p className="text-sm font-bold text-gray-900 italic leading-relaxed">"{profile.mission}"</p>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => setShowCreateJob(true)}
              className="w-full p-6 rounded-[32px] bg-black text-white font-black italic uppercase tracking-tighter text-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl shadow-black/20"
            >
              Post a New Job
            </button>
          </div>
        )}

        <button 
          onClick={() => logout()}
          className="w-full p-6 rounded-[32px] border-2 border-gray-100 text-gray-400 font-black italic uppercase tracking-tighter text-lg hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all active:scale-95"
        >
          Sign Out
        </button>
      </div>

      <AnimatePresence>
        {showCreateJob && (
          <CreateJob onClose={() => setShowCreateJob(false)} />
        )}
        {showEditProfile && (
          <EditProfile onClose={() => setShowEditProfile(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
