import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Sparkles } from 'lucide-react';

export default function GuestLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo / Branding */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-blue-200/50">
            <Sparkles className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
            SimuFlow
          </h1>
          <p className="text-slate-500 mt-3 font-semibold text-lg">
            Welcome, Guest!
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/60 p-8 mb-6">
          <p className="text-slate-600 font-medium leading-relaxed mb-8">
            Register as a temporary guest to access the simulation center. 
            No account or app download required.
          </p>

          <button
            onClick={() => navigate('/guest/register')}
            id="guest-register-btn"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-200/50 flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
          >
            <UserPlus className="w-6 h-6" />
            Register as Guest
          </button>
        </div>

        <p className="text-sm text-slate-400 font-medium">
          Your information will only be used for center access today.
        </p>
      </div>
    </div>
  );
}
