import React from 'react';

// Pulsing red dot = live numbers are fresh; gray and still = the last refresh failed.
export default function LiveDot({ active = true }) {
  return (
    <span aria-hidden="true" className="relative flex h-2 w-2">
      {active && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#E64164] opacity-60 animate-ping motion-reduce:hidden" />
      )}
      <span
        className={
          active
            ? 'relative inline-flex h-2 w-2 rounded-full bg-[#E64164]'
            : 'relative inline-flex h-2 w-2 rounded-full bg-[#BDBDBD]'
        }
      />
    </span>
  );
}
