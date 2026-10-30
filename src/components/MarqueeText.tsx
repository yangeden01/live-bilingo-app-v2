import React, { useRef, useState, useEffect } from 'react';

interface MarqueeTextProps {
  text: string;
  className?: string;
  speed?: number; // seconds per cycle
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  className = '',
  speed = 10,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth + 2);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  if (!isOverflowing) {
    return (
      <div ref={containerRef} className={`overflow-hidden whitespace-nowrap min-w-0 ${className}`}>
        <span ref={textRef} className="inline-block font-bold">
          {text}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden whitespace-nowrap min-w-0 flex items-center ${className}`}
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
      }}
    >
      <div
        className="inline-flex gap-8 whitespace-nowrap animate-marquee hover:[animation-play-state:paused]"
        style={{
          animationDuration: `${Math.max(6, Math.min(speed, text.length * 0.8))}s`,
        }}
      >
        <span ref={textRef} className="font-bold">
          {text}
        </span>
        <span className="font-bold" aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
};
