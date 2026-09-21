import { useState, useEffect, useRef } from 'react';

interface UseSleepTimerOptions {
  onTimerEnd: () => void;
}

export function useSleepTimer({ onTimerEnd }: UseSleepTimerOptions) {
  const [sleepMinutes, setSleepMinutes] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isTimerDropdownOpen, setIsTimerDropdownOpen] = useState(false);
  const timerDropdownRef = useRef<HTMLDivElement>(null);
  const targetEndTimeRef = useRef<number | null>(null);
  const onTimerEndRef = useRef(onTimerEnd);
  onTimerEndRef.current = onTimerEnd;

  // Close timer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timerDropdownRef.current && !timerDropdownRef.current.contains(event.target as Node)) {
        setIsTimerDropdownOpen(false);
      }
    };
    if (isTimerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTimerDropdownOpen]);

  // Reliable wall-clock countdown timer logic: uses targetEndTimeRef to prevent drift across sleep/background
  useEffect(() => {
    if (sleepMinutes <= 0 || targetEndTimeRef.current === null) {
      return;
    }

    const updateCountdown = () => {
      if (targetEndTimeRef.current === null) return;
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));

      if (diffSeconds <= 0) {
        targetEndTimeRef.current = null;
        setSleepMinutes(0);
        setRemainingSeconds(null);
        try {
          onTimerEndRef.current();
        } catch (err) {
          console.warn('[SleepTimer] onTimerEnd error:', err);
        }
      } else {
        setRemainingSeconds(diffSeconds);
      }
    };

    // Calculate immediately so UI updates without 1s delay
    updateCountdown();

    const interval = setInterval(updateCountdown, 1000);

    // Also update immediately on window visibility change or focus (e.g. phone screen unlock)
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        updateCountdown();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [sleepMinutes]);

  const selectSleepTimer = (minutes: number) => {
    setSleepMinutes(minutes);
    setIsTimerDropdownOpen(false);
    if (minutes <= 0) {
      targetEndTimeRef.current = null;
      setRemainingSeconds(null);
    } else {
      const targetTime = Date.now() + minutes * 60 * 1000;
      targetEndTimeRef.current = targetTime;
      setRemainingSeconds(minutes * 60);
    }
  };

  const addMinutes = (extraMinutes: number) => {
    const now = Date.now();
    const currentRemaining = targetEndTimeRef.current && targetEndTimeRef.current > now
      ? (targetEndTimeRef.current - now) / 1000
      : (remainingSeconds || 0);

    const newSeconds = Math.max(0, currentRemaining + extraMinutes * 60);
    const newTarget = Date.now() + newSeconds * 1000;
    targetEndTimeRef.current = newTarget;
    setSleepMinutes(Math.ceil(newSeconds / 60));
    setRemainingSeconds(Math.ceil(newSeconds));
  };

  return {
    sleepMinutes,
    remainingSeconds,
    isTimerDropdownOpen,
    setIsTimerDropdownOpen,
    timerDropdownRef,
    selectSleepTimer,
    addMinutes,
  };
}

