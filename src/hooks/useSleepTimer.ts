import { useState, useEffect, useRef } from 'react';
import { PlaybackStatus } from '../types';

interface UseSleepTimerOptions {
  playbackStatus: PlaybackStatus;
  onTimerEnd: () => void;
}

export function useSleepTimer({ playbackStatus, onTimerEnd }: UseSleepTimerOptions) {
  const [sleepMinutes, setSleepMinutes] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isTimerDropdownOpen, setIsTimerDropdownOpen] = useState(false);
  const timerDropdownRef = useRef<HTMLDivElement>(null);

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

  // Countdown timer logic
  useEffect(() => {
    if (sleepMinutes === 0 || remainingSeconds === null) {
      return;
    }

    if (playbackStatus !== 'PLAYING') {
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          onTimerEnd();
          setSleepMinutes(0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepMinutes, playbackStatus, remainingSeconds, onTimerEnd]);

  const selectSleepTimer = (minutes: number) => {
    setSleepMinutes(minutes);
    setIsTimerDropdownOpen(false);
    if (minutes === 0) {
      setRemainingSeconds(null);
    } else {
      setRemainingSeconds(minutes * 60);
    }
  };

  const addMinutes = (extraMinutes: number) => {
    setRemainingSeconds((prev) => {
      const current = prev || 0;
      const next = current + extraMinutes * 60;
      setSleepMinutes(Math.ceil(next / 60));
      return next;
    });
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
