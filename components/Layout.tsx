import React from 'react';
import { LOGO_URL } from '../constants';
import { User, UserRole } from '../types';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-[#009a3e] text-white px-4 py-3 shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
        {/* Branding Section */}
        <div className="flex items-center gap-4">
          <img 
            src={LOGO_URL} 
            alt="OsMak Logo" 
            className="h-12 w-auto object-contain"
          />
          <div className="flex flex-col">
            <h1 className="m-0 text-[1.05rem] tracking-wider uppercase font-bold leading-tight">
              OSPITAL NG MAKATI
            </h1>
            <span className="text-[0.8rem] opacity-90 leading-tight">
              Antimicrobial Stewardship System
            </span>
          </div>
        </div>
        
        {/* User Info & Logout Button */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs opacity-80">{user.role.replace('_', ' ')}</p>
          </div>
          <button 
            onClick={onLogout}
            className="bg-black/20 hover:bg-black/30 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors border border-white/20"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Ospital ng Makati. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
