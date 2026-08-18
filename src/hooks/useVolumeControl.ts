import React, { useState, useRef } from 'react';

export function useVolumeControl(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isAdjustingVolume, setIsAdjustingVolume] = useState(false);
  const volumeTouchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerVolumeFeedback = () => {
    setIsAdjustingVolume(true);
    if (volumeTouchTimeoutRef.current) clearTimeout(volumeTouchTimeoutRef.current);
    volumeTouchTimeoutRef.current = setTimeout(() => {
      setIsAdjustingVolume(false);
    }, 1500);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    triggerVolumeFeedback();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else setIsMuted(false);
    }
    triggerVolumeFeedback();
  };

  return {
    isMuted,
    volume,
    isAdjustingVolume,
    toggleMute,
    handleVolumeChange,
    triggerVolumeFeedback,
  };
}
