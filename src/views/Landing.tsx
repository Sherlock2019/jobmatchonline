import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, Zap, Shield, Heart } from 'lucide-react';
import { signIn } from '../services/authService';
import { useNavigate } from 'react-router-dom';

export function Landing() {
  const navigate = useNavigate();

  const handleSignIn = async (provider: 'google' | 'github') => {
    try {
      const { isNew } = await signIn(provider);
      if (isNew) {
        navigate('/onboarding');
      } else {
        navigate('/discover');
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden pt-20">
      {/* Hero Section */}
      <section className="px-6 py-12 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <div className="flex flex-col items-center mb-6">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="w-64 h-64 md:w-80 md:h-80 -mb-12"
            >
              <img 
                src="/logo.png" 
                alt="JobMatch Logo" 
                className="w-full h-full object-contain drop-shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight mb-6 uppercase text-gray-900 px-4">
            <span className="text-[#f94e3e] italic leading-none">Let’s put love</span> <br />
            <span className="text-gray-300">back into work</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed px-6 mb-4">
            Let’s match the right people for the right roles in the right companies culture that they love and bring their heart and soul.
          </p>
          <p className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-400">
            Right People <span className="text-[#f94e3e] mx-1">+</span> Right Roles <span className="text-[#f94e3e] mx-1">+</span> Right Company
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-4 max-w-xs mx-auto"
        >
          <button
            onClick={() => handleSignIn('google')}
            className="group relative flex items-center justify-center gap-3 bg-white text-black border-2 border-black px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all shadow-xl active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>

          <button
            onClick={() => handleSignIn('github')}
            className="group relative flex items-center justify-center gap-3 bg-black text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all shadow-xl active:scale-95"
          >
            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <img src="https://github.githubassets.com/favicons/favicon.svg" className="w-4 h-4" alt="GitHub" />
            </div>
            Continue with GitHub
          </button>

          <p className="text-xs text-gray-400">
            By signing in, you agree to our Terms of Service
          </p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#00a4b4]">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold italic uppercase tracking-tight">Instant Match</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Matching by skills and experience automatically. Only swipe on what fits.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#f94e3e]">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold italic uppercase tracking-tight">Real People</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Direct connection between job seekers and hiring managers. No gatekeepers.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#004085]">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold italic uppercase tracking-tight">Verified</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Profiles are verified by Google Auth and community feedback.
            </p>
          </div>
        </div>
      </section>

      {/* Footer Decoration */}
      <div className="h-32 bg-gradient-to-t from-gray-100 to-transparent"></div>
    </div>
  );
}
