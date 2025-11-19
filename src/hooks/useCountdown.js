import { useEffect, useState } from 'react';
import useSession from './useSession';

export default function useCountdown(sessionId) {
  const { session } = useSession(sessionId);
  const [timeLeft, setTimeLeft] = useState(session ? (session.timeLeft || 0) : 0);

  useEffect(() => {
    if (!session) return;
    // if session provides startedAt + timeLeftAtStart use that to compute live countdown
    if (session.isRunning && session.startedAt && session.timeLeftAtStart != null) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
        const remaining = Math.max(0, (session.timeLeftAtStart || 0) - elapsed);
        setTimeLeft(remaining);
      };
      tick();
      const id = setInterval(tick, 500);
      return () => clearInterval(id);
    }

    // otherwise fall back to session.timeLeft
    setTimeLeft(session.timeLeft || 0);
    return undefined;
  }, [session]);

  return { timeLeft, isRunning: session?.isRunning || false };
}
