import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Info, Sparkles } from 'lucide-react';

const ROW_CLASS = 'flex items-start gap-3.5 p-3 -mx-3 rounded-[16px]';
// Only a row that goes somewhere reacts to the pointer.
const LINK_CLASS =
  'hover:bg-[#DCDCDC]/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const TONES = {
  neutral: { chip: 'bg-[#78003F]/8', icon: 'text-[#78003F]', fallback: Sparkles },
  attention: { chip: 'bg-[#E64164]/10', icon: 'text-[#E64164]', fallback: AlertCircle },
  quiet: { chip: 'bg-[#DCDCDC]/30', icon: 'text-[#414141]/60', fallback: Info },
};

// 'students' → '/admin/students'; full paths pass through.
const toPath = (to) => (typeof to === 'string' && !to.startsWith('/') ? `/admin/${to}` : to);

// `icon` is a lucide component (preferred, sized here) or an already built element.
const renderIcon = (icon, className) => {
  if (React.isValidElement(icon)) return icon;
  return React.createElement(icon, { className, 'aria-hidden': true });
};

/**
 * One computed sentence with an icon chip. `parts` is `[{ t, b? }]`; parts marked `b` are
 * set in bold. Text is rendered as text, never as HTML. `children` may replace `parts`.
 */
export default function InsightRow({ icon, tone = 'neutral', parts = [], to, children }) {
  const style = TONES[tone] || TONES.neutral;

  const content = (
    <>
      <span className={`shrink-0 w-9 h-9 rounded-[12px] flex items-center justify-center ${style.chip}`}>
        {renderIcon(icon || style.fallback, `w-[18px] h-[18px] ${style.icon}`)}
      </span>
      <span className="min-w-0 pt-2 text-sm font-semibold leading-snug text-[#414141]/80">
        {children ??
          parts.map((part, index) =>
            part.b ? (
              <strong key={index} className="font-extrabold text-[#414141]">
                {part.t}
              </strong>
            ) : (
              <React.Fragment key={index}>{part.t}</React.Fragment>
            ),
          )}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={toPath(to)} className={`${ROW_CLASS} ${LINK_CLASS}`}>
        {content}
      </Link>
    );
  }
  return <div className={ROW_CLASS}>{content}</div>;
}
