import { useEffect, useRef, useCallback } from 'react';
import { vibrateDetentTick } from '../utils/haptics';

interface UseReadingModeSnapDetentOptions {
  enabled?: boolean;
  targetId?: string; // default: 'subtitle-search-bar'
  headerSelector?: string; // default: 'header'
  snapThresholdPx?: number; // Distance window around target where detent activates (default: 65px)
  velocityThreshold?: number; // Max speed (px/ms) considered "slow movement" (default: 0.45 px/ms)
}

/**
 * useReadingModeSnapDetent
 * 
 * 智慧閱讀模式磁吸頓點 Hook：
 * 1. 慢速滑動或拖曳螢幕經過「標準閱讀模式（即播放/切換電台時對齊的搜尋列與最新卡片視角）」時，
 *    系統會自動產生一個磁吸頓點（Detent Snap）並施加微觸感震動，協助使用者精準定位。
 * 2. 快速滑動螢幕時，系統偵測到足夠慣性動量，不會強行卡死，呈現順暢衝過頓點的自然物理滑動效果。
 */
export function useReadingModeSnapDetent({
  enabled = true,
  targetId = 'subtitle-search-bar',
  headerSelector = 'header',
  snapThresholdPx = 65,
  velocityThreshold = 0.45,
}: UseReadingModeSnapDetentOptions = {}) {
  const isTouchingRef = useRef(false);
  const touchStartYRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const lastTouchTimeRef = useRef(0);
  const currentVelocityRef = useRef(0);
  const scrollTimeoutRef = useRef<any>(null);
  const hasSnappedInCurrentGestureRef = useRef(false);
  const lastTickTimeRef = useRef(0);

  // Calculate the exact window.scrollY that places the target right below the sticky header
  const getTargetScrollY = useCallback((): number | null => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return null;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return null;

    const header = document.querySelector(headerSelector);
    const headerBottom = header ? header.getBoundingClientRect().bottom : 56;
    const targetRect = targetEl.getBoundingClientRect();

    // The scroll position where target top touches header bottom
    return window.scrollY + targetRect.top - headerBottom;
  }, [targetId, headerSelector]);

  const snapToReadingMode = useCallback((smooth = true) => {
    const targetY = getTargetScrollY();
    if (targetY === null) return;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: smooth ? 'smooth' : 'auto',
    });

    const now = Date.now();
    if (now - lastTickTimeRef.current > 400) {
      vibrateDetentTick();
      lastTickTimeRef.current = now;
    }
  }, [getTargetScrollY]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isTouchingRef.current = true;
      hasSnappedInCurrentGestureRef.current = false;
      const y = e.touches[0].clientY;
      touchStartYRef.current = y;
      lastTouchYRef.current = y;
      lastTouchTimeRef.current = performance.now();
      currentVelocityRef.current = 0;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchingRef.current || e.touches.length !== 1) return;
      const currentY = e.touches[0].clientY;
      const currentTime = performance.now();
      const deltaY = currentY - lastTouchYRef.current;
      const deltaTime = currentTime - lastTouchTimeRef.current;

      if (deltaTime > 10) {
        // Velocity in px/ms
        currentVelocityRef.current = deltaY / deltaTime;
        lastTouchYRef.current = currentY;
        lastTouchTimeRef.current = currentTime;
      }

      // Check if moving slowly near the snap detent
      const targetY = getTargetScrollY();
      if (targetY !== null) {
        const currentScrollY = window.scrollY;
        const dist = Math.abs(currentScrollY - targetY);

        // If moving slowly through the reading zone, give a tiny haptic tick once
        if (dist <= 25 && Math.abs(currentVelocityRef.current) < velocityThreshold) {
          const now = Date.now();
          if (now - lastTickTimeRef.current > 600) {
            vibrateDetentTick();
            lastTickTimeRef.current = now;
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isTouchingRef.current) return;
      isTouchingRef.current = false;

      const targetY = getTargetScrollY();
      if (targetY === null) return;

      const currentScrollY = window.scrollY;
      const dist = Math.abs(currentScrollY - targetY);
      const velocity = Math.abs(currentVelocityRef.current);

      // Slow scroll condition: velocity is low AND within the snap threshold
      if (dist <= snapThresholdPx && velocity < velocityThreshold) {
        // Trigger soft magnetic snap to standard reading position
        snapToReadingMode(true);
      }
      // If velocity >= velocityThreshold, do nothing -> natural fling continues and shoots past the detent!
    };

    const handleScroll = () => {
      // For mouse wheel or desktop scrolling: perform detent check on scroll idle
      if (isTouchingRef.current) return;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const targetY = getTargetScrollY();
        if (targetY === null) return;

        const currentScrollY = window.scrollY;
        const dist = Math.abs(currentScrollY - targetY);

        // If stopped very close to reading mode (within 40px)
        if (dist > 4 && dist <= 40) {
          snapToReadingMode(true);
        }
      }, 120);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [enabled, getTargetScrollY, snapToReadingMode, snapThresholdPx, velocityThreshold]);

  return {
    snapToReadingMode,
    getTargetScrollY,
  };
}
