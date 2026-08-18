import { useEffect, useRef, useState } from 'react';

// Reveals children on scroll into view, once. Purposeful, subtle; honors
// prefers-reduced-motion (shows immediately, no transition).
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  // Seeded, not set in an effect: someone who has asked for reduced motion sees
  // the content on the first paint rather than after a second render.
  const [visible, setVisible] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    if (visible) return undefined;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
