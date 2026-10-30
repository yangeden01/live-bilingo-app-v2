// Web Audio API synthesizer for wooden bean hitting boundary wall impact sound
export const playBeanWallImpactSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Deep resonant wood block impact (thump against boundary wall)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.035);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);

    // Sharp wooden boundary bounce click transient
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();

    oscClick.type = 'sine';
    oscClick.frequency.setValueAtTime(1100, now);
    oscClick.frequency.exponentialRampToValueAtTime(180, now + 0.012);

    gainClick.gain.setValueAtTime(0.3, now);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);

    oscClick.start(now);
    oscClick.stop(now + 0.015);
  } catch {
    // Ignore audio initialization errors if blocked by browser policy
  }
};
