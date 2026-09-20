import React from 'react';

const VARIANTS = {
  default:
    'sf-card relative bg-[#FFFFFF] rounded-[24px] border border-[#DCDCDC]/60 shadow-[0_8px_20px_rgba(65,65,65,0.08)]',
  accent:
    'sf-card sf-card--accent relative overflow-hidden rounded-[24px] border border-transparent text-white bg-gradient-to-br from-[#78003F] to-[#E64164] shadow-[0_12px_28px_rgba(120,0,63,0.28)]',
  inset: 'rounded-[16px] border border-[#DCDCDC]/50 bg-gradient-to-b from-[#FFFFFF] to-[#DCDCDC]/10',
};

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-6 sm:p-8',
};

// Hover changes shadow and border only. A transform here would break any position: fixed
// child, and cards are allowed to hold popover anchors.
const INTERACTIVE =
  'transition-[box-shadow,border-color] duration-200 ease-out hover:shadow-[0_14px_32px_rgba(65,65,65,0.12)] hover:border-[#DCDCDC]';

const ACCENT_GLOW = 'absolute -top-24 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none';

export default function Card({
  as: Tag = 'div',
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    VARIANTS[variant] || VARIANTS.default,
    PADDING[padding] ?? PADDING.md,
    interactive ? INTERACTIVE : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...rest}>
      {variant === 'accent' && <span aria-hidden="true" className={ACCENT_GLOW} />}
      {children}
    </Tag>
  );
}
