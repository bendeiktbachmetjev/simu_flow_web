import React from 'react';
import LegalLayout from './LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <div className="space-y-6 text-sm leading-relaxed text-[#414141]/90">
        <p>
          This Privacy Policy explains how SimuFlow may collect, use, store, and disclose
          information when you access the SimuFlow guest web interface or any related services
          provided by your institution or simulation center.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">1. Data we collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-semibold">Identification data:</span> name and affiliation.</li>
            <li><span className="font-semibold">Contact data:</span> email address (if provided).</li>
            <li><span className="font-semibold">Usage data:</span> basic technical logs required to operate and secure the service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">2. How we use your data</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To provide guest access and record attendance or participation.</li>
            <li>To operate, maintain, and improve service reliability and security.</li>
            <li>To communicate with you if you opted in to receive emails and updates.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">3. Legal basis</h2>
          <p>
            Depending on jurisdiction and institutional configuration, processing may be based on
            legitimate interest, contractual necessity, compliance obligations, or your consent
            (for example, email updates).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">4. Sharing & service providers</h2>
          <p>
            Your data may be shared with the institution operating the simulation center and with
            trusted service providers used to host, secure, and operate the platform. We do not
            sell personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">5. Retention</h2>
          <p>
            Data is retained for as long as needed for operational, academic, or compliance
            purposes as determined by the institution, after which it may be deleted or
            anonymized.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">6. Your rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, delete, restrict,
            or object to processing. Requests are typically handled together with the institution
            operating the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">7. Contact</h2>
          <p>
            To request help with privacy inquiries, please contact the simulation center or
            institution that provided access to SimuFlow.
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

