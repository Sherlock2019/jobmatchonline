import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Briefcase, Heart, LogOut, Search } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { cn } from '../../lib/utils';

export function Navbar() {
  const { profile, logout } = useUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-50 px-4">
      <div className="max-w-md mx-auto h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase italic">JOBMATCH</span>
        </Link>

        {profile && (
          <div className="flex items-center gap-4">
            <Link to="/discover" className="p-2 text-gray-500 hover:text-orange-500 transition-colors">
              <Search className="w-6 h-6" />
            </Link>
            <Link to="/matches" className="p-2 text-gray-500 hover:text-red-500 transition-colors">
              <Heart className="w-6 h-6" />
            </Link>
            <Link to="/profile" className="p-2 text-gray-500 hover:text-blue-500 transition-colors">
              <User className="w-6 h-6" />
            </Link>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
