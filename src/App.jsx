import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase, supabaseConfigError } from './lib/supabase';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import GuestRegister from './components/GuestRegister';
import { Loader2 } from 'lucide-react';
import Landing from './components/Landing';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';

function AdminRoute() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <span className="font-semibold text-slate-600">Loading...</span>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <Dashboard />;
}

export default function App() {
  if (supabaseConfigError) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-6">
          <div className="text-2xl font-extrabold tracking-tight text-[#414141]">
            Configuration error
          </div>
          <div className="mt-2 text-sm font-semibold text-[#414141]/70">
            {supabaseConfigError}
          </div>
          <div className="mt-5 text-sm font-semibold text-[#414141]/75">
            Expected variables:
            <div className="mt-2 rounded-[16px] bg-[#DCDCDC]/30 p-4 font-mono text-xs text-[#414141]">
              VITE_SUPABASE_URL
              <br />
              VITE_SUPABASE_ANON_KEY
              <br />
              VITE_PUBLIC_APP_URL
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/guest/register" element={<GuestRegister />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}
