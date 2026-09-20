import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TooltipBox } from './ChartTooltip.jsx';

const POINTER_GAP = 12;
const WINDOW_EDGE = 8;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

// The chart tooltip for HTML marks (bar rows, share segments, heat cells).
//
//   const tip = useChartTooltip();
//   <div {...tip.bind({ title, rows: [{ value, name, color }], footer })} />   // content or () => content
//   {tip.tooltip}
//
// Pointer: 12 px from the cursor, flipped and clamped to the window.
// Keyboard focus: anchored above the centre of the focused element.
// The box is portalled to <body>, so a clipped or transformed ancestor of the mark cannot misplace it.
export default function useChartTooltip() {
  const [content, setContent] = useState(null);
  const boxRef = useRef(null);
  const anchorRef = useRef(null);

  const place = useCallback(() => {
    const box = boxRef.current;
    const anchor = anchorRef.current;
    if (!box || !anchor) return;

    const { width, height } = box.getBoundingClientRect();
    const maxLeft = window.innerWidth - width - WINDOW_EDGE;
    const maxTop = window.innerHeight - height - WINDOW_EDGE;
    let left;
    let top;

    if (anchor.rect) {
      left = anchor.rect.left + anchor.rect.width / 2 - width / 2;
      top = anchor.rect.top - POINTER_GAP - height;
      if (top < WINDOW_EDGE) top = anchor.rect.bottom + POINTER_GAP;
    } else {
      left = anchor.x + POINTER_GAP;
      top = anchor.y + POINTER_GAP;
      if (left > maxLeft) left = anchor.x - POINTER_GAP - width;
      if (top > maxTop) top = anchor.y - POINTER_GAP - height;
    }

    box.style.left = `${Math.round(clamp(left, WINDOW_EDGE, maxLeft))}px`;
    box.style.top = `${Math.round(clamp(top, WINDOW_EDGE, maxTop))}px`;
    box.style.visibility = 'visible';
  }, []);

  const hide = useCallback(() => {
    anchorRef.current = null;
    setContent(null);
  }, []);

  const show = useCallback((next, anchor) => {
    const resolved = typeof next === 'function' ? next() : next;
    if (!resolved) return;
    anchorRef.current = anchor;
    setContent(resolved);
  }, []);

  // Runs after every render while the box is open: new content changes the size of the box.
  useLayoutEffect(() => {
    if (content) place();
  });

  // A scrolled page leaves the box behind its mark, so it closes; Escape closes it for keyboard users.
  useEffect(() => {
    if (!content) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') hide();
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [content, hide]);

  const bind = useCallback(
    (next) => ({
      onPointerEnter: (event) => show(next, { x: event.clientX, y: event.clientY }),
      onPointerMove: (event) => {
        const point = { x: event.clientX, y: event.clientY };
        if (anchorRef.current) {
          anchorRef.current = point;
          place();
        } else {
          show(next, point);
        }
      },
      onPointerLeave: hide,
      onFocus: (event) => {
        const target = event.currentTarget;
        // A mouse click also focuses the mark; only keyboard focus re-anchors the box.
        if (typeof target.matches === 'function' && !target.matches(':focus-visible')) return;
        show(next, { rect: target.getBoundingClientRect() });
      },
      onBlur: hide,
    }),
    [show, hide, place]
  );

  const tooltip =
    content && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={boxRef}
            role="tooltip"
            className="fixed z-40 pointer-events-none print:hidden"
            style={{ left: 0, top: 0, visibility: 'hidden' }}
          >
            <TooltipBox title={content.title} rows={content.rows} footer={content.footer} />
          </div>,
          document.body
        )
      : null;

  return { bind, show, hide, tooltip };
}
