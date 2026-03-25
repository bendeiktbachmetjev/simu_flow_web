import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import appIcon from '../assets/app-icon.png';

export default function LegalLayout({ title, children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#414141]">
      <header className="sticky top-0 z-30 bg-[#FFFFFF]/80 backdrop-blur border-b border-[#DCDCDC]/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-[#414141]/70 hover:text-[#414141] font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[12px] bg-[#DCDCDC]/40 overflow-hidden shadow-[0_8px_20px_rgba(65,65,65,0.08)]">
              <img src={appIcon} alt="SimuFlow" className="w-full h-full object-cover" />
            </div>
            <div className="text-sm font-extrabold tracking-tight">SimuFlow</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6">
          {title}
        </h1>
        <div className="bg-[#FFFFFF] rounded-[24px] border border-[#DCDCDC]/60 shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-6 sm:p-8">
          {children}
        </div>
        <footer className="pt-6 text-xs text-[#414141]/60">
          © {new Date().getFullYear()} SimuFlow. All rights reserved.
        </footer>
      </main>
    </div>
  );
}

