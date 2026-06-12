import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicAppUrl, supabase } from '../lib/supabase';
import { ArrowLeft, Lock, Loader2, Mail, UserPlus } from 'lucide-react';
import appIcon from '../assets/app-icon.png';

export default function Login() {
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [view, setView] = useState('login'); // 'login' or 'forgot'
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    
    try {
      const base = getPublicAppUrl() || window.location.origin
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Must match Supabase Auth → Redirect URLs (e.g. https://simuflow.net/admin)
          redirectTo: `${base}/admin`,
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setEmailLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setError(null);

    try {
      const base = getPublicAppUrl() || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${base}/reset-password`,
        }
      );

      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFFFFF] via-[#DCDCDC]/20 to-[#FFFFFF] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        <button
          onClick={() => {
            if (view === 'forgot') {
              setView('login');
              setError(null);
              setResetSent(false);
            } else {
              navigate('/');
            }
          }}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#414141]/70 hover:text-[#414141] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#DCDCDC]/40 rounded-[16px] mx-auto flex items-center justify-center mb-5 shadow-[0_8px_20px_rgba(65,65,65,0.08)] overflow-hidden">
              <img src={appIcon} alt="SimuFlow" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-3xl font-extrabold text-[#414141]">
              {view === 'login' ? 'Admin Login' : 'Reset Password'}
            </h2>
            <p className="text-[#414141]/70 mt-2 font-medium">
              {view === 'login' 
                ? 'Sign in to access the SimuFlow dashboard'
                : 'Enter your email to receive a password reset link'
              }
            </p>
          </div>

          {error && (
            <div className="bg-[#E64164]/10 text-[#E64164] text-sm font-semibold p-4 rounded-[16px] mb-6 border border-[#E64164]/20">
              {error}
            </div>
          )}

          {view === 'forgot' && resetSent ? (
            <div className="space-y-6">
              <div className="bg-[#DCDCDC]/30 text-[#414141] text-sm font-semibold p-4 rounded-[16px] border border-[#DCDCDC]/60 text-center">
                We've sent a password reset link to <span className="text-[#78003F]">{email}</span>. Please check your inbox and click the link to reset your password.
              </div>
              <button
                onClick={() => {
                  setView('login');
                  setResetSent(false);
                  setError(null);
                }}
                className="w-full bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-3.5 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                Back to Login
              </button>
            </div>
          ) : view === 'forgot' ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#414141] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#414141]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@simuflow.net"
                    className="w-full pl-10 pr-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-3.5 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98]"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                }}
                className="w-full bg-[#FFFFFF] border border-[#DCDCDC] hover:bg-[#DCDCDC]/20 text-[#414141] font-bold py-3.5 rounded-[16px] transition-all shadow-sm flex items-center justify-center gap-3"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#414141] mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#414141]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="admin@simuflow.net"
                      className="w-full pl-10 pr-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#414141] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#414141]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
                    />
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot');
                        setError(null);
                      }}
                      className="text-xs font-semibold text-[#78003F] hover:text-[#E64164] transition-colors focus:outline-none"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={emailLoading || googleLoading}
                  className="w-full bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-3.5 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98]"
                >
                  {emailLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in with Email'
                  )}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-[#DCDCDC]/80" />
                <span className="text-xs font-semibold text-[#414141]/50 uppercase">or</span>
                <div className="flex-1 h-px bg-[#DCDCDC]/80" />
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading || emailLoading}
                className="w-full bg-[#FFFFFF] border border-[#DCDCDC] hover:bg-[#DCDCDC]/20 text-[#414141] font-bold py-3.5 rounded-[16px] transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#78003F]" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <button
                onClick={() => navigate('/guest/register')}
                id="guest-access-btn"
                className="mt-4 w-full bg-[#DCDCDC]/40 hover:bg-[#DCDCDC]/55 text-[#414141] font-bold py-3.5 rounded-[16px] transition-all shadow-sm flex items-center justify-center gap-3"
              >
                <UserPlus className="w-5 h-5" />
                Enter as Guest
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
