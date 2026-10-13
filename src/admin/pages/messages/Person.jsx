import React from 'react';
import { initialsOf, roleLabel } from '../../data/support/threads.js';

// Initials in a cherry circle; a red dot on the corner while the person waits for a reply.
export function Avatar({ name, surname, waiting = false, size = 'md' }) {
  const box = size === 'sm' ? 'w-9 h-9 text-[11px]' : 'w-10 h-10 text-xs';
  return (
    <span
      aria-hidden="true"
      className={`relative shrink-0 ${box} rounded-full bg-[#78003F]/10 text-[#78003F] font-extrabold flex items-center justify-center`}
    >
      {initialsOf(name, surname)}
      {waiting && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#E64164] ring-2 ring-[#FFFFFF]" />
      )}
    </span>
  );
}

// 'TEACHER', 'STUDENT'… from the profile role; nothing for an unknown role.
export function RoleBadge({ role }) {
  const label = roleLabel(role);
  if (!label) return null;
  return (
    <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#414141]/[0.06] text-[10px] font-bold uppercase tracking-[0.06em] text-[#414141]/70">
      {label}
    </span>
  );
}
