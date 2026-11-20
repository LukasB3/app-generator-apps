// Synthesised drum voices. Each takes (ctx, out, time).
const Drums = (() => {
  let noise = null;
  function noiseBuf(ctx) {
    if (!noise || noise.sampleRate !== ctx.sampleRate) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noise;
  }
  function noiseSrc(ctx, t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf(ctx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
    return s;
  }
  function env(ctx, out, t, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
  }
  return {
    kick(ctx, out, t) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      o.connect(env(ctx, out, t, 1.1, 0.45));
      o.start(t); o.stop(t + 0.5);
    },
    snare(ctx, out, t) {
      const n = noiseSrc(ctx, t, 0.25);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
      n.connect(f); f.connect(env(ctx, out, t, 0.7, 0.2));
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(130, t + 0.08);
      o.connect(env(ctx, out, t, 0.6, 0.12));
      o.start(t); o.stop(t + 0.2);
    },
    hat(ctx, out, t) {
      const n = noiseSrc(ctx, t, 0.1);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      n.connect(f); f.connect(env(ctx, out, t, 0.4, 0.06));
    },
    clap(ctx, out, t) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.2;
      f.connect(out);
      [0, 0.011, 0.023].forEach((d) => {
        const n = noiseSrc(ctx, t + d, 0.05);
        n.connect(env(ctx, f, t + d, 0.8, 0.04));
      });
      const n = noiseSrc(ctx, t + 0.035, 0.25);
      n.connect(env(ctx, f, t + 0.035, 0.7, 0.18));
    },
  };
})();
