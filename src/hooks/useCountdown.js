import { useEffect, useState } from 'react';

export default function useCountdown(socket) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!socket?.isConnected) return;

    const unsubscribe = socket.on('mission:tick', ({ timeLeft: newTimeLeft, isRunning: newIsRunning }) => {
      console.log('[useCountdown] Received tick:', newTimeLeft, newIsRunning);
      setTimeLeft(newTimeLeft);
      setIsRunning(newIsRunning);
    });

    return unsubscribe;
  }, [socket]);

  return { timeLeft, isRunning };
}
