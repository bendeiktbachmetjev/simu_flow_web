import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, FileText } from 'lucide-react';
import appIcon from '../assets/app-icon.png';

function GooglePlayIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d="M3.6 2.5c-.4.3-.6.8-.6 1.4v16.2c0 .6.2 1.1.6 1.4l10.3-9.5L3.6 2.5z" fill="#414141" opacity="0.85" />
      <path d="M14.5 11.9l2.7-2.5-3.1-1.8-9.1-5.1 9.5 9.4z" fill="#78003F" opacity="0.95" />
      <path d="M14.1 16.4l3.1-1.8-2.7-2.5-9.5 9.4 9.1-5.1z" fill="#E64164" opacity="0.95" />
      <path d="M18 9.9l2.2 1.2c.9.5.9 1.3 0 1.8L18 14.1l-3.1-2.1L18 9.9z" fill="#414141" opacity="0.65" />
    </svg>
  );
}

function AppleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M16.9 12.7c0-1.9 1.5-2.8 1.6-2.9-0.9-1.3-2.2-1.5-2.7-1.5-1.1-0.1-2.2 0.6-2.7 0.6s-1.4-0.6-2.4-0.6c-1.2 0-2.3 0.7-2.9 1.7-1.2 2.1-0.3 5.2 0.9 6.9 0.6 0.9 1.3 1.8 2.2 1.8 0.9 0 1.2-0.6 2.3-0.6 1 0 1.3 0.6 2.3 0.6 1 0 1.6-0.9 2.2-1.8 0.7-1 1-1.9 1-2 0 0-1.8-0.7-1.8-3.2z"
        fill="#414141"
        opacity="0.85"
      />
      <path
        d="M14.5 6.7c0.5-0.6 0.8-1.5 0.7-2.4-0.8 0-1.7 0.5-2.2 1.1-0.5 0.6-0.9 1.5-0.7 2.4 0.9 0.1 1.7-0.4 2.2-1.1z"
        fill="#414141"
        opacity="0.85"
      />
    </svg>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#414141]">
      <header className="sticky top-0 z-30 bg-[#FFFFFF]/80 backdrop-blur border-b border-[#DCDCDC]/60">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[16px] bg-[#DCDCDC]/40 overflow-hidden shadow-[0_8px_20px_rgba(65,65,65,0.08)]">
              <img src={appIcon} alt="SimuFlow" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-extrabold tracking-tight text-lg">SimuFlow</div>
              <div className="text-xs text-[#414141]/60">Simulation Center Management Platform</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <a
              href="/privacy"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-[#414141]/70 hover:text-[#414141] hover:bg-[#DCDCDC]/30 transition-colors"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-[#414141]/70 hover:text-[#414141] hover:bg-[#DCDCDC]/30 transition-colors"
            >
              Terms
            </a>
            <button
              id="admin-login-btn"
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-[#DCDCDC]/40 text-[#414141] hover:bg-[#DCDCDC]/55 transition-colors"
            >
              Admin sign in
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-16 pt-10 space-y-14">
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DCDCDC]/30 border border-[#DCDCDC]/60 text-xs font-semibold text-[#414141]/70 w-fit">
              Minimal, fast, and secure workflows for simulation centers
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Guest access, without friction.
              <span className="block text-[#414141]/80">
                Designed to match the SimuFlow experience.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#414141]/70 leading-relaxed max-w-xl">
              Register guests in seconds, keep access controlled, and connect attendance with your
              simulation workflows — all aligned with your institution&apos;s process.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                id="guest-start-btn"
                type="button"
                onClick={() => navigate('/guest/register')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-[#78003F] to-[#E64164] shadow-[0_8px_20px_rgba(65,65,65,0.08)] active:scale-[0.98] transition-transform"
              >
                Start guest registration
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex gap-3">
                <a
                  href="https://play.google.com/store/apps/details?id=com.simuflow.app&pli=1"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-semibold bg-[#DCDCDC]/40 hover:bg-[#DCDCDC]/55 transition-colors"
                >
                  <GooglePlayIcon className="w-5 h-5" />
                  Google Play
                </a>
                <a
                  href="https://apps.apple.com/lt/app/simuflow/id6760581109"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-semibold bg-[#DCDCDC]/40 hover:bg-[#DCDCDC]/55 transition-colors"
                >
                  <AppleIcon className="w-5 h-5" />
                  App Store
                </a>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-4">
                <div className="text-xs font-extrabold text-[#78003F] mb-1">NFC-ready</div>
                <div className="text-sm font-semibold text-[#414141]/80">Fast guest onboarding</div>
              </div>
              <div className="rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-4">
                <div className="text-xs font-extrabold text-[#78003F] mb-1">Role-based</div>
                <div className="text-sm font-semibold text-[#414141]/80">Clear access boundaries</div>
              </div>
              <div className="rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-4">
                <div className="text-xs font-extrabold text-[#78003F] mb-1">Realtime</div>
                <div className="text-sm font-semibold text-[#414141]/80">Attendance & tracking</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-[#78003F]/10 to-[#E64164]/10 blur-3xl opacity-70" />
            <div className="relative rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-4">
              <div className="grid grid-cols-3 gap-3">
                <img
                  src="/media/mock1.png"
                  alt="SimuFlow mockup 1"
                  className="w-full h-40 sm:h-44 object-cover rounded-[16px] bg-[#DCDCDC]/30"
                />
                <img
                  src="/media/mock2.png"
                  alt="SimuFlow mockup 2"
                  className="w-full h-40 sm:h-44 object-cover rounded-[16px] bg-[#DCDCDC]/30"
                />
                <img
                  src="/media/mock3.png"
                  alt="SimuFlow mockup 3"
                  className="w-full h-40 sm:h-44 object-cover rounded-[16px] bg-[#DCDCDC]/30"
                />
              </div>
              <div className="mt-4 text-xs text-[#414141]/60 font-semibold">
                Product previews (web guest flow)
              </div>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <a
            href="/privacy"
            className="group rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-6 hover:bg-[#DCDCDC]/15 transition-colors"
          >
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#78003F]">
              <ShieldCheck className="w-4 h-4" />
              Privacy
            </div>
            <div className="mt-2 text-lg font-extrabold">Privacy Policy</div>
            <div className="mt-1 text-sm text-[#414141]/70">
              Read how guest data is handled, retained, and protected.
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#414141]/80 group-hover:text-[#414141]">
              Open
              <ArrowRight className="w-4 h-4" />
            </div>
          </a>

          <a
            href="/terms"
            className="group rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-6 hover:bg-[#DCDCDC]/15 transition-colors"
          >
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#78003F]">
              <FileText className="w-4 h-4" />
              Terms
            </div>
            <div className="mt-2 text-lg font-extrabold">Terms of Use</div>
            <div className="mt-1 text-sm text-[#414141]/70">
              Review the usage rules and limitations for guests.
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#414141]/80 group-hover:text-[#414141]">
              Open
              <ArrowRight className="w-4 h-4" />
            </div>
          </a>
        </section>

        <footer className="pt-6 text-xs text-[#414141]/60 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between border-t border-[#DCDCDC]/60">
          <span>© {new Date().getFullYear()} SimuFlow. All rights reserved.</span>
          <span>For institutional use in simulation and training environments.</span>
        </footer>
      </main>
    </div>
  );
}

