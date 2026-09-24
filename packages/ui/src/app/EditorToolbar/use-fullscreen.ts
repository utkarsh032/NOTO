import { useEffect, useState } from 'react';

/**
 * Whether the window is showing the application full screen, and the switch.
 *
 * Read from the browser rather than remembered, because Escape and the F11 key
 * both leave full screen without going through the button — a flag kept here
 * would say "exit" over a window that is already back to its normal size.
 */
export function useFullscreen(): [boolean, () => void] {
  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== 'undefined' && document.fullscreenElement !== null,
  );

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);

    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = () => {
    /* Refused when the gesture is not one the browser trusts; nothing to do
       about that but leave the window as it is. */
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  return [fullscreen, toggle];
}
