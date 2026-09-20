import React, { useRef } from 'react';

const ITEM_SIZE = {
  sm: 'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
  md: 'px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors',
};

const ITEM_BASE =
  'inline-flex items-center gap-1.5 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const ITEM_ACTIVE = 'bg-[#78003F] text-white';
const ITEM_IDLE = 'text-[#414141]/70 hover:bg-[#DCDCDC]/20';

const KEY_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// `icon` is a lucide component (preferred, sized here) or an already built element.
const renderIcon = (icon) => {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  return React.createElement(icon, { className: 'w-3.5 h-3.5', 'aria-hidden': true });
};

/**
 * Pill switch with radio-group behaviour: one tab stop, arrow keys move and select.
 * `onChange` also fires for a click on the option that is already selected, so an option
 * that opens something (the period picker's "Custom") can be opened again.
 */
export default function Segmented({ options = [], value, onChange, size = 'sm', ariaLabel, className = '' }) {
  const itemRefs = useRef([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  const select = (index) => {
    itemRefs.current[index]?.focus();
    onChange?.(options[index].value);
  };

  const handleKeyDown = (event, index) => {
    const last = options.length - 1;
    let next = null;
    if (Object.hasOwn(KEY_STEP, event.key)) next = (index + KEY_STEP[event.key] + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={['inline-flex p-0.5 rounded-full border border-[#DCDCDC] bg-[#FFFFFF] print:hidden', className]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange?.(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={[ITEM_SIZE[size] || ITEM_SIZE.sm, ITEM_BASE, checked ? ITEM_ACTIVE : ITEM_IDLE].join(' ')}
          >
            {renderIcon(option.icon)}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
