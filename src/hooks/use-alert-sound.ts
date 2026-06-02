'use client';

export function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-15, now);
    compressor.knee.setValueAtTime(30, now);
    compressor.ratio.setValueAtTime(8, now);
    compressor.attack.setValueAtTime(0.001, now);
    compressor.release.setValueAtTime(0.15, now);
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.setValueAtTime(1.0, now);
    master.connect(compressor);

    const tone = (freq: number, start: number, dur: number, vol: number = 0.5) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env);
      env.connect(master);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      env.gain.setValueAtTime(0.001, now + start);
      env.gain.linearRampToValueAtTime(vol, now + start + 0.008);
      env.gain.setValueAtTime(vol, now + start + dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    };

    const beep = (freq: number, start: number, dur: number, vol: number = 0.6) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env);
      env.connect(master);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);
      env.gain.setValueAtTime(0.001, now + start);
      env.gain.linearRampToValueAtTime(vol, now + start + 0.005);
      env.gain.setValueAtTime(vol, now + start + dur * 0.5);
      env.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    };

    beep(1046.50, 0.0, 0.08, 0.65);
    beep(1046.50, 0.14, 0.08, 0.65);
    tone(523.25, 0.30, 0.22, 0.5);
    tone(659.25, 0.46, 0.22, 0.5);
    tone(783.99, 0.62, 0.35, 0.55);
    tone(1046.50, 1.05, 0.55, 0.45);
  } catch {
    // Audio not available
  }
}
