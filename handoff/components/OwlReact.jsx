import { useEffect, useRef } from 'react';
import './Owl.css';

/**
 * Owl mascot with 5 states and optional speech bubble.
 *
 * <Owl state="thinking" message="Секунду…" size={200} onClick={...} />
 *
 * Place PNGs in /public/assets/owl/owl-{state}.png (or override `assetBase`).
 */
const STATES = ['idle', 'alert', 'thinking', 'greeting', 'error'];

const DEFAULT_MESSAGES = {
  idle: '',
  alert: 'Новий запис у Inbox — глянемо?',
  thinking: 'Секунду, обдумую…',
  greeting: 'Привіт! Радий тебе бачити',
  error: 'Ой… щось пішло не так.',
};

export default function Owl({
  state = 'idle',
  message,
  size = 200,
  assetBase = '/assets/owl',
  showBubble = true,
  onClick,
}) {
  const bubbleRef = useRef(null);

  useEffect(() => {
    const b = bubbleRef.current;
    if (!b) return;
    if (state === 'idle') {
      b.setAttribute('data-show', 'false');
      return;
    }
    b.setAttribute('data-show', 'false');
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => b.setAttribute('data-show', 'true'));
    });
    return () => cancelAnimationFrame(id);
  }, [state, message]);

  const text = message ?? DEFAULT_MESSAGES[state] ?? '';

  return (
    <div className="owl-root" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        className="owl"
        data-state={state}
        role="img"
        aria-label={`Owl ${state}`}
        onClick={onClick}
        style={{ '--owl-size': `${size}px` }}
      >
        {STATES.map((s) => (
          <img
            key={s}
            className="owl-frame"
            data-frame={s}
            src={`${assetBase}/owl-${s}.png`}
            alt=""
            loading={s === 'idle' ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>

      {showBubble && state !== 'idle' && (
        <div className="owl-bubble-wrap">
          <div className="owl-bubble" ref={bubbleRef} role="status" aria-live="polite">
            <span>{text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
