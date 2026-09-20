import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { fmt } from '../format.js';

const BASE = 'inline-flex items-center gap-0.5 h-6 px-2 rounded-full text-xs font-bold whitespace-nowrap';

const TONES = {
  good: 'bg-[#78003F]/8 text-[#78003F]',
  bad: 'bg-[#E64164]/10 text-[#B3205A]',
  flat: 'bg-[#DCDCDC]/40 text-[#414141]/75',
  onAccent: 'bg-white/20 text-white',
};

const ICONS = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

const UNIT_WORDS = { pct: ' percent', pp: ' percentage points', abs: '' };

// "Up 18 percent vs Aug 2026" — the pill itself only shows "+18%".
const spokenDelta = (delta, compareLabel) => {
  const tail = compareLabel ? ` ${compareLabel}` : '';
  if (delta.dir === 'flat') return `No change${tail}`;
  // Same rounding as the visible text, without sign and unit: "+1,240%" → "1,240"
  const amount = fmt.delta(delta).replace(/[^\d.,]/g, '');
  return `${delta.dir === 'up' ? 'Up' : 'Down'} ${amount}${UNIT_WORDS[delta.kind] ?? ''}${tail}`;
};

// Signed change against the comparison period.
//   delta        { kind: 'pct' | 'pp' | 'abs', value, dir: 'up' | 'down' | 'flat' } from makeDelta; null renders nothing
//   goodWhen     'up' (default) or 'down' — which direction is good news
//   onAccent     white-on-gradient variant for the hero tile
//   compareLabel 'vs Aug 2026' — only used for the accessible name
export default function Delta({ delta, goodWhen = 'up', onAccent = false, compareLabel, className = '' }) {
  if (!delta || typeof delta.value !== 'number' || !Number.isFinite(delta.value)) return null;

  const dir = ICONS[delta.dir] ? delta.dir : 'flat';
  let tone = 'flat';
  if (onAccent) tone = 'onAccent';
  else if (dir !== 'flat') tone = dir === goodWhen ? 'good' : 'bad';

  const Icon = ICONS[dir];

  return (
    <span
      role="img"
      aria-label={spokenDelta({ ...delta, dir }, compareLabel)}
      className={[BASE, TONES[tone], className].filter(Boolean).join(' ')}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span aria-hidden="true">{fmt.delta({ ...delta, dir })}</span>
    </span>
  );
}
