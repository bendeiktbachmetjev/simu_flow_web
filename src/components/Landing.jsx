import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ShieldCheck, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold tracking-tight text-lg">SimuFlow</div>
              <div className="text-xs text-slate-400">Simulation Center Management Platform</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('privacy');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-slate-300 hover:text-slate-50 hover:bg-slate-800 transition-colors"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('terms');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-slate-300 hover:text-slate-50 hover:bg-slate-800 transition-colors"
            >
              Terms
            </button>
            <button
              id="admin-login-btn"
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-slate-100 text-slate-900 hover:bg-white transition-colors"
            >
              Admin sign in
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-16 pt-10 space-y-16">
        {/* Hero */}
        <section className="grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/70 border border-slate-700 text-xs text-slate-300 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Designed for medical simulation centers
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-50 mb-4">
              Run high‑fidelity simulations
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-300">
                with zero administrative chaos.
              </span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-6">
              SimuFlow is a web and mobile platform that connects students, teachers, residents and
              simulation staff in one place. Schedule sessions, track presence, manage simulators
              and provide guests with guided access — all with real‑time data from your center.
            </p>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-slate-200 mb-8">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400" />
                <span>Role‑based flows for students, teachers, residents and guests.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400" />
                <span>Real‑time simulator availability and attendance tracking.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400" />
                <span>Temporary guest access without installing the mobile app.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400" />
                <span>Secure integration with your existing authentication and Supabase backend.</span>
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                id="guest-start-btn"
                type="button"
                onClick={() => navigate('/guest/register')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 hover:from-blue-400 hover:to-indigo-400 transition-transform active:scale-[0.98]"
              >
                Start as guest
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold bg-slate-900/80 border border-slate-700 text-slate-100 hover:bg-slate-800 transition-colors"
              >
                Learn how it works
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-tr from-blue-500/20 via-sky-400/10 to-emerald-400/10 blur-3xl opacity-70" />
            <div className="relative bg-slate-900/80 border border-slate-700/80 rounded-3xl p-5 shadow-2xl shadow-slate-900/80">
              <div className="text-xs font-semibold text-slate-400 mb-3">High‑level overview</div>
              <div className="space-y-3 text-xs text-slate-200">
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-1 h-10 rounded-full bg-blue-400" />
                  <div>
                    <div className="font-semibold text-sm">Simulation center</div>
                    <p className="text-slate-300">
                      Configures simulators, rooms, and institution‑specific rules for sessions and access.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-1 h-10 rounded-full bg-sky-400" />
                  <div>
                    <div className="font-semibold text-sm">Educators & coordinators</div>
                    <p className="text-slate-300">
                      Plan sessions, assign learners, create schedules and monitor participation analytics.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-1 h-10 rounded-full bg-emerald-400" />
                  <div>
                    <div className="font-semibold text-sm">Learners & guests</div>
                    <p className="text-slate-300">
                      Join sessions, confirm presence and interact with simulators using mobile or guest web access.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
            How SimuFlow works
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-slate-200">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs font-semibold text-slate-400 mb-2">1 · Configure</div>
              <h3 className="font-semibold mb-2 text-slate-50">Set up your center</h3>
              <p className="text-slate-300">
                Define simulators, rooms and institutions. Configure who can access which simulator,
                and how presence is confirmed (NFC, QR, manual confirmation and more).
              </p>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs font-semibold text-slate-400 mb-2">2 · Orchestrate</div>
              <h3 className="font-semibold mb-2 text-slate-50">Plan and run sessions</h3>
              <p className="text-slate-300">
                Teachers and coordinators schedule sessions, connect groups of learners and assign
                simulators. The system guides each participant through the session flow.
              </p>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <div className="text-xs font-semibold text-slate-400 mb-2">3 · Observe</div>
              <h3 className="font-semibold mb-2 text-slate-50">Track activity in real time</h3>
              <p className="text-slate-300">
                See who is present, which simulators are busy, and how resources are utilized across
                days and weeks. Export data to your institutional systems if required.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy & Terms */}
        <section
          id="privacy"
          className="grid md:grid-cols-2 gap-6 items-start border-t border-slate-800 pt-10"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-semibold mb-2">
              <ShieldCheck className="w-4 h-4" />
              Data protection & compliance
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-50">Privacy Policy</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              This summary explains how SimuFlow processes personal data when used by your
              institution. The exact legal terms may be further specified in a separate data
              processing agreement with your organization.
            </p>
            <ul className="list-disc list-inside text-sm text-slate-200 space-y-2">
              <li>
                <span className="font-semibold">Categories of data.</span> We process identification
                and contact details, institutional affiliation, session participation information and
                technical logs required to operate the platform.
              </li>
              <li>
                <span className="font-semibold">Purpose of processing.</span> Data is used to plan,
                deliver and document simulation activities, provide access control to simulators,
                and generate analytics required by the institution.
              </li>
              <li>
                <span className="font-semibold">Legal basis.</span> The legal basis is typically the
                legitimate interest of the institution in managing education and training, or
                contractual necessity where a direct agreement exists.
              </li>
              <li>
                <span className="font-semibold">Data sharing.</span> Personal data is only shared
                with service providers that support hosting, logging and communication under data
                processing agreements, or with the institution that operates the center.
              </li>
              <li>
                <span className="font-semibold">Retention.</span> Session and attendance data is
                retained for as long as required by the institution&apos;s academic or regulatory
                policies, after which it is deleted or anonymized.
              </li>
              <li>
                <span className="font-semibold">Data subject rights.</span> Depending on your
                jurisdiction, you may have rights of access, rectification, deletion, restriction or
                objection. These requests are usually handled in cooperation with your institution.
              </li>
            </ul>
          </div>

          <div
            id="terms"
            className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200 text-xs font-semibold">
              <FileText className="w-4 h-4" />
              Terms of Use (summary)
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              By accessing SimuFlow as a student, teacher, resident, guest or administrator, you
              agree to use the platform only in accordance with your institution&apos;s policies and
              applicable law.
            </p>
            <ul className="list-disc list-inside text-sm text-slate-200 space-y-2">
              <li>
                <span className="font-semibold">Authorized use.</span> Access is limited to
                individuals who have been invited or onboarded by the institution or simulation
                center operating SimuFlow.
              </li>
              <li>
                <span className="font-semibold">Account responsibility.</span> If you are provided
                with login credentials, you are responsible for keeping them confidential and for
                all actions performed under your account.
              </li>
              <li>
                <span className="font-semibold">Content and conduct.</span> You must not misuse the
                platform, attempt to gain unauthorized access, or interfere with simulations or
                other users.
              </li>
              <li>
                <span className="font-semibold">Availability and changes.</span> The service may be
                updated, suspended or modified by the institution or provider in order to improve
                functionality, maintain security or comply with regulations.
              </li>
              <li>
                <span className="font-semibold">No medical advice.</span> SimuFlow is a training and
                management tool and does not provide medical advice or replace clinical judgement.
              </li>
              <li>
                <span className="font-semibold">Limitation of liability.</span> To the maximum
                extent permitted by law, the platform is provided &quot;as is&quot; and any
                liability is limited in accordance with the contract between the provider and the
                institution.
              </li>
            </ul>
            <p className="text-xs text-slate-500">
              This section is a high‑level summary. The full legally binding version of the Privacy
              Policy and Terms of Use can be provided to your institution and may differ depending
              on jurisdiction and deployment model.
            </p>
          </div>
        </section>

        <footer className="border-t border-slate-800 pt-6 text-xs text-slate-500 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SimuFlow. All rights reserved.</span>
          <span>For institutional use in simulation and training environments.</span>
        </footer>
      </main>
    </div>
  );
}

