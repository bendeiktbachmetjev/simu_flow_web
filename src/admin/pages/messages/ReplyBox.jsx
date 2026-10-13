import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { ErrorBanner } from '../../ui';
import { REPLY_MAX_LENGTH, prepareReply } from '../../data/support/threads.js';

const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';

const TEXTAREA_CLASS =
  'flex-1 min-w-0 resize-none px-4 py-2.5 rounded-[20px] border border-[#DCDCDC] bg-[#FFFFFF] text-sm font-medium leading-relaxed text-[#414141] placeholder:text-[#414141]/50 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#78003F]/40';
const SEND_CLASS = `shrink-0 inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full bg-gradient-to-br from-[#78003F] to-[#E64164] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40 ${RING}`;

const MAX_HEIGHT_PX = 160; // about six lines, then the box scrolls
const COUNTER_FROM = REPLY_MAX_LENGTH - 200;

/**
 * Text box under a conversation. Enter sends, Shift+Enter starts a new line (Enter that ends an
 * input-method composition does neither). The text is cleared only after the reply is stored; on
 * a failure it stays, under the error. No Escape handler (a shell rule, see AdminShell).
 * `onSend(text)` resolves true when the reply was stored.
 */
export default function ReplyBox({ recipient, initialText = '', onTextChange, onSend, sending = false, error = null }) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef(null);
  const busyRef = useRef(false); // a second Enter or click before `sending` reaches the props
  const id = useId();

  const canSend = !sending && !prepareReply(text).error;

  // Grows with the text up to MAX_HEIGHT_PX.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const change = (value) => {
    setText(value);
    onTextChange?.(value);
  };

  const submit = async () => {
    if (!canSend || busyRef.current) return;
    busyRef.current = true;
    let sent = false;
    try {
      sent = await onSend(text);
    } finally {
      busyRef.current = false;
    }
    if (!sent) return;
    change('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="shrink-0 px-4 sm:px-6 py-3 border-t border-[#DCDCDC]/60 bg-[#FFFFFF]"
    >
      {error && <ErrorBanner title="Your reply was not sent" message={error.message} className="mb-3" />}
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          {`Reply to ${recipient}`}
        </label>
        <textarea
          id={id}
          ref={textareaRef}
          rows={1}
          value={text}
          maxLength={REPLY_MAX_LENGTH}
          readOnly={sending}
          placeholder="Write a reply…"
          onChange={(event) => change(event.target.value)}
          onKeyDown={handleKeyDown}
          className={TEXTAREA_CLASS}
          style={{ maxHeight: MAX_HEIGHT_PX }}
        />
        <button type="submit" disabled={!canSend} aria-label="Send reply" className={SEND_CLASS}>
          <SendHorizontal className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#414141]/60">
        <span className="hidden sm:inline">Enter sends · Shift + Enter starts a new line</span>
        {text.length >= COUNTER_FROM && (
          <span className={`ml-auto ${text.length >= REPLY_MAX_LENGTH ? 'text-[#B3205A]' : ''}`}>
            {text.length} / {REPLY_MAX_LENGTH}
          </span>
        )}
      </div>
    </form>
  );
}
