import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const ACTION_CLASS =
  'group shrink-0 inline-flex items-center gap-1 rounded-[6px] text-[13px] font-bold text-[#78003F] hover:text-[#E64164] transition-colors print:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

// 'students' → '/admin/students'; full paths pass through.
const toPath = (to) => (typeof to === 'string' && !to.startsWith('/') ? `/admin/${to}` : to);

// The arrow is drawn as an icon, so a label written as "Students →" loses its own arrow.
const cleanLabel = (label) => (typeof label === 'string' ? label.replace(/\s*→\s*$/, '') : label);

export default function SectionTitle({ title, description, action }) {
  return (
    <div className="mt-12 mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold tracking-tight text-[#414141]">{title}</h2>
        {description && <p className="mt-1 text-sm font-medium text-[#414141]/75">{description}</p>}
      </div>
      {action?.to && action.label && (
        <Link to={toPath(action.to)} className={ACTION_CLASS}>
          {cleanLabel(action.label)}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
