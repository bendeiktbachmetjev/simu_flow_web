import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import appIcon from '../assets/app-icon.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if we have an active session (which Supabase sets automatically from the recovery token/code)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setHasSession(true);
      } else {
        setHasSession(false);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setSuccess(true);
      // Log out immediately to clear the recovery session, forcing a clean login
      await supabase.auth.signOut();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-4">
        <Loader2 className="w-10 h-10 text-[#78003F] animate-spin" />
        <span className="font-semibold text-slate-600">Verifying session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFFFFF] via-[#DCDCDC]/20 to-[#FFFFFF] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-8">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#DCDCDC]/40 rounded-[16px] mx-auto flex items-center justify-center mb-5 shadow-[0_8px_20px_rgba(65,65,65,0.08)] overflow-hidden">
              <img src={appIcon} alt="SimuFlow" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-3xl font-extrabold text-[#414141]">
              {success ? 'Success!' : 'Update Password'}
            </h2>
            <p className="text-[#414141]/70 mt-2 font-medium">
              {success 
                ? 'Your password has been successfully updated'
                : 'Choose a new secure password for your account'
              }
            </p>
          </div>

          {success ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-[#34A853] stroke-[1.5]" />
              </div>
              <p className="text-sm font-medium text-[#414141]/80">
                Your password is now updated. You can log in using your new credentials.
              </p>
              <button
                onClick={() => navigate('/admin')}
                className="w-full bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-3.5 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                Go to Login
              </button>
            </div>
          ) : !hasSession ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <AlertCircle className="w-16 h-16 text-[#E64164] stroke-[1.5]" />
              </div>
              <div className="bg-[#E64164]/10 text-[#E64164] text-sm font-semibold p-4 rounded-[16px] border border-[#E64164]/20">
                Invalid or expired password reset link. Please request a new one from the login page.
              </div>
              <button
                onClick={() => navigate('/admin')}
                className="w-full bg-[#FFFFFF] border border-[#DCDCDC] hover:bg-[#DCDCDC]/20 text-[#414141] font-bold py-3.5 rounded-[16px] transition-all shadow-sm flex items-center justify-center gap-3"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              {error && (
                <div className="bg-[#E64164]/10 text-[#E64164] text-sm font-semibold p-4 rounded-[16px] border border-[#E64164]/20">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[#414141] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#414141]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    className="w-full pl-10 pr-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#414141] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#414141]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-3.5 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
