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

      <main>
        {/* ── Hero ── */}
        <section className="max-w-6xl mx-auto px-4 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DCDCDC]/30 border border-[#DCDCDC]/60 text-xs font-semibold text-[#414141]/70 mb-6">
            Built specifically for simulation centers
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-3xl mx-auto leading-[1.1]">
            A complete management system for your simulation center.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-[#414141]/70 leading-relaxed max-w-2xl mx-auto">
            Track attendance, record simulator activity, manage roles across students, teachers,
            residents, and guests — all in one platform designed to keep your center running smoothly.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="guest-start-btn"
              type="button"
              onClick={() => navigate('/guest/register')}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-[#78003F] to-[#E64164] shadow-[0_8px_20px_rgba(65,65,65,0.08)] active:scale-[0.98] transition-transform"
            >
              Open guest web check-in
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="https://play.google.com/store/apps/details?id=com.simuflow.app&pli=1"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full text-sm font-semibold bg-[#DCDCDC]/40 hover:bg-[#DCDCDC]/55 transition-colors"
            >
              <GooglePlayIcon className="w-5 h-5" />
              Google Play
            </a>

            <a
              href="https://apps.apple.com/lt/app/simuflow/id6760581109"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full text-sm font-semibold bg-[#DCDCDC]/40 hover:bg-[#DCDCDC]/55 transition-colors"
            >
              <AppleIcon className="w-5 h-5" />
              App Store
            </a>
          </div>
        </section>

        {/* ── Feature 1: Attendance ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#DCDCDC]/20 py-20">
          <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 space-y-5">
              <div className="text-xs font-extrabold tracking-widest uppercase text-[#78003F]">
                Attendance
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Know who is present. Always.
              </h2>
              <p className="text-base sm:text-lg text-[#414141]/70 leading-relaxed max-w-lg">
                Participants check in via NFC, QR code, or manual confirmation. Every session gets a
                reliable attendance log — no more paper lists or guesswork.
              </p>
              <ul className="space-y-2 text-sm font-semibold text-[#414141]/80">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Instant NFC tap or QR scan to register presence
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Automatic session logs with timestamps
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Supports students, residents, teachers, and guests
                </li>
              </ul>
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-10 bg-[#E64164]/8 rounded-full blur-3xl" />
                <img
                  src="/media/mock1.png"
                  alt="SimuFlow attendance screen"
                  className="relative h-[480px] sm:h-[560px] lg:h-[600px] object-contain drop-shadow-[0_12px_32px_rgba(65,65,65,0.14)]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature 2: Simulator tracking ── */}
        <section className="relative overflow-hidden bg-[#FFFFFF] py-20">
          <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-10 bg-[#78003F]/8 rounded-full blur-3xl" />
                <img
                  src="/media/mock2.png"
                  alt="SimuFlow simulator activity screen"
                  className="relative h-[480px] sm:h-[560px] lg:h-[600px] object-contain drop-shadow-[0_12px_32px_rgba(65,65,65,0.14)]"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="text-xs font-extrabold tracking-widest uppercase text-[#78003F]">
                Simulator Activity
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                See who trained, where, and when.
              </h2>
              <p className="text-base sm:text-lg text-[#414141]/70 leading-relaxed max-w-lg">
                Every simulator session is recorded: which participant used which equipment, for how
                long, and as part of which scheduled session. Transparent usage history for your
                entire center.
              </p>
              <ul className="space-y-2 text-sm font-semibold text-[#414141]/80">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Per-simulator usage logs linked to participants
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Works independently of simulator software
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Real-time occupancy and availability view
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Feature 3: Center operations ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#DCDCDC]/20 to-[#FFFFFF] py-20">
          <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 space-y-5">
              <div className="text-xs font-extrabold tracking-widest uppercase text-[#78003F]">
                Center Operations
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                One system for the entire workflow.
              </h2>
              <p className="text-base sm:text-lg text-[#414141]/70 leading-relaxed max-w-lg">
                From scheduling and role management to analytics and guest access — SimuFlow connects
                every part of your simulation center into a single coordinated process.
              </p>
              <ul className="space-y-2 text-sm font-semibold text-[#414141]/80">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Five distinct roles: Admin, Teacher, Student, Resident, Guest
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Centralized scheduling and session planning
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#E64164] shrink-0" />
                  Live analytics on facility utilization
                </li>
              </ul>
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-10 bg-[#E64164]/8 rounded-full blur-3xl" />
                <img
                  src="/media/mock3.png"
                  alt="SimuFlow operations and analytics screen"
                  className="relative h-[480px] sm:h-[560px] lg:h-[600px] object-contain drop-shadow-[0_12px_32px_rgba(65,65,65,0.14)]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Why SimuFlow ── */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="rounded-[24px] border border-[#DCDCDC]/60 bg-[#FFFFFF] shadow-[0_8px_20px_rgba(65,65,65,0.08)] p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Why simulation centers choose SimuFlow
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#414141]/75 max-w-4xl">
              SimuFlow is not just a guest form. It is an operational layer for the entire center:
              attendance, simulator activity, role-based access, and transparent reporting in one ecosystem.
            </p>
            <div className="mt-6 grid md:grid-cols-3 gap-4">
              <div className="rounded-[16px] bg-[#DCDCDC]/30 p-4">
                <div className="text-sm font-extrabold text-[#78003F]">For administrators</div>
                <div className="text-sm font-semibold text-[#414141]/75 mt-1">
                  Control access, monitor occupancy, and see utilization in real time.
                </div>
              </div>
              <div className="rounded-[16px] bg-[#DCDCDC]/30 p-4">
                <div className="text-sm font-extrabold text-[#78003F]">For educators</div>
                <div className="text-sm font-semibold text-[#414141]/75 mt-1">
                  Run sessions with clear participant records and simulator engagement history.
                </div>
              </div>
              <div className="rounded-[16px] bg-[#DCDCDC]/30 p-4">
                <div className="text-sm font-extrabold text-[#78003F]">For guests and learners</div>
                <div className="text-sm font-semibold text-[#414141]/75 mt-1">
                  Join quickly, check in smoothly, and follow a simple guided workflow.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Legal cards ── */}
        <section className="max-w-6xl mx-auto px-4 pb-8">
          <div className="grid md:grid-cols-2 gap-6">
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
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-[#414141]/60 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between border-t border-[#DCDCDC]/60">
          <span>&copy; {new Date().getFullYear()} SimuFlow. All rights reserved.</span>
          <span>For institutional use in simulation and training environments.</span>
        </footer>
      </main>
    </div>
  );
}
