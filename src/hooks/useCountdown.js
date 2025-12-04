import { useEffect, useState } from 'react';

export default function useCountdown(socket) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(1);
  const [roundDurationMinutes, setRoundDurationMinutes] = useState(0);

  useEffect(() => {
    if (!socket?.isConnected) return;

    const unsubscribe = socket.on('mission:tick', ({ timeLeft: newTimeLeft, isRunning: newIsRunning, currentRound: incomingRound = 1, totalRounds: incomingTotal = 1, roundDurationMinutes: roundMinutes = 0 }) => {
      console.log('[useCountdown] Received tick:', newTimeLeft, newIsRunning);
      setTimeLeft(newTimeLeft);
      setIsRunning(newIsRunning);
      setCurrentRound(incomingRound);
      setTotalRounds(Math.max(1, incomingTotal));
      setRoundDurationMinutes(roundMinutes || 0);
    });

    return unsubscribe;
  }, [socket]);

  return { timeLeft, isRunning, currentRound, totalRounds, roundDurationMinutes };
}
