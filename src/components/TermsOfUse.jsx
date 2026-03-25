import React from 'react';
import LegalLayout from './LegalLayout';

export default function TermsOfUse() {
  return (
    <LegalLayout title="Terms of Use">
      <div className="space-y-6 text-sm leading-relaxed text-[#414141]/90">
        <p>
          These Terms of Use govern your access to and use of SimuFlow, including the guest web
          registration flow, any pages, and any associated features provided by your institution
          or simulation center.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">1. Authorized use</h2>
          <p>
            You may use SimuFlow only if you are authorized by the institution operating the
            simulation center. You must provide accurate information and must not impersonate
            others.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">2. Acceptable use</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Do not attempt to gain unauthorized access to accounts, data, or systems.</li>
            <li>Do not interfere with platform availability or performance.</li>
            <li>Do not submit harmful, unlawful, or misleading content.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">3. Guest registration</h2>
          <p>
            Guest registration is intended to enable temporary access for the current visit or
            session. The institution may apply additional local rules for entry, attendance, and
            facility use.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">4. Communications</h2>
          <p>
            If you opt in to receive emails, you may receive operational updates, reminders, or
            information relevant to the simulation center. You can opt out later if the
            institution provides an opt-out mechanism.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">5. Disclaimer</h2>
          <p>
            SimuFlow is a management and training support tool. It does not provide medical
            advice and does not replace professional judgement.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">6. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, SimuFlow is provided “as is” and the
            institution and service providers are not liable for indirect, incidental, or
            consequential damages arising from use of the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">7. Changes</h2>
          <p>
            The institution may update these Terms to reflect operational or legal requirements.
            Continued use after changes means you accept the updated Terms.
          </p>
        </section>

        <p className="text-xs text-[#414141]/60">
          This page provides a practical summary and may be adapted by the institution to match
          local legal requirements.
        </p>
      </div>
    </LegalLayout>
  );
}

