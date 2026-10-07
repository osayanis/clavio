// Synthétiseur de piano (Web Audio) + effets sonores de l'app.
const Sound = (() => {
  let ctx = null, master = null, fxBus = null, pianoWave = null;
  let volume = 0.8;
  const voices = new Map(); // midi -> voix active (notes jouées en direct)

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp);
      comp.connect(ctx.destination);
      fxBus = ctx.createGain();
      fxBus.gain.value = 0.5;
      fxBus.connect(master);
      // Réverbération légère (réponse impulsionnelle synthétique)
      const len = ctx.sampleRate * 1.6;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.18;
      master.connect(conv); conv.connect(wet); wet.connect(comp);

      const real = new Float32Array([0, 1, 0.55, 0.32, 0.22, 0.12, 0.09, 0.05, 0.04, 0.02, 0.015]);
      pianoWave = ctx.createPeriodicWave(real, new Float32Array(real.length));
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function makeVoice(midi, velocity, when) {
    const f = Music.freq(midi);
    const t = Math.max(when, ctx.currentTime);
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.5;
    const bright = Math.min(16000, f * (6 + velocity * 10));
    filter.frequency.setValueAtTime(bright, t);
    filter.frequency.setTargetAtTime(Math.max(f * 2.5, 600), t + 0.02, 0.5);

    const oscs = [0, 1].map(i => {
      const o = ctx.createOscillator();
      o.setPeriodicWave(pianoWave);
      o.frequency.value = f;
      o.detune.value = i === 0 ? -3 : 3;
      o.connect(filter);
      o.start(t);
      return o;
    });
    filter.connect(out);
    out.connect(master);

    // Les notes graves résonnent plus longtemps
    const decay = Math.min(4, Math.max(0.6, 2.6 * Math.pow(2, -(midi - 48) / 24)));
    const peak = 0.22 * (0.35 + velocity * 0.65) * (midi > 84 ? 0.8 : 1);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + 0.006);
    out.gain.setTargetAtTime(peak * 0.45, t + 0.01, 0.12);
    out.gain.setTargetAtTime(0, t + 0.25, decay);

    return {
      release(at) {
        const r = Math.max(at ?? ctx.currentTime, t + 0.02);
        out.gain.cancelScheduledValues(r);
        out.gain.setTargetAtTime(0, r, 0.09);
        oscs.forEach(o => o.stop(r + 0.8));
        setTimeout(() => out.disconnect(), (r - ctx.currentTime + 1) * 1000);
      },
    };
  }

  // Note tenue (entrée en direct)
  function noteOn(midi, velocity = 0.75) {
    ensure();
    noteOff(midi);
    voices.set(midi, makeVoice(midi, velocity, ctx.currentTime));
  }

  function noteOff(midi) {
    const v = voices.get(midi);
    if (v) { v.release(); voices.delete(midi); }
  }

  // Note de durée fixe (lecture d'un morceau, démonstrations)
  function play(midi, duration = 0.5, velocity = 0.7, delay = 0) {
    ensure();
    const when = ctx.currentTime + delay;
    const v = makeVoice(midi, velocity, when);
    v.release(when + Math.max(0.08, duration));
  }

  function playSequence(notes, gap = 0.55) {
    notes.forEach((n, i) => {
      const group = Array.isArray(n) ? n : [n];
      group.forEach(m => play(m, gap * 0.95, 0.7, i * gap));
    });
    return notes.length * gap;
  }

  function tone(freq, start, dur, type = 'sine', gain = 0.2) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(fxBus);
    o.start(start); o.stop(start + dur + 0.05);
  }

  const fx = {
    correct() { ensure(); const t = ctx.currentTime; tone(880, t, 0.15); tone(1318.5, t + 0.08, 0.3); },
    wrong() { ensure(); const t = ctx.currentTime; tone(196, t, 0.25, 'square', 0.07); tone(185, t + 0.12, 0.3, 'square', 0.07); },
    complete() {
      ensure(); const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 0.5, 'triangle', 0.18));
      [523.25, 659.25, 783.99].forEach(f => tone(f * 2, t + 0.5, 0.9, 'sine', 0.08));
    },
    pop() { ensure(); tone(1200, ctx.currentTime, 0.08, 'sine', 0.12); },
    click(accent) { ensure(); tone(accent ? 1600 : 1000, ctx.currentTime, 0.05, 'square', accent ? 0.12 : 0.07); },
    clickAt(time, accent) { tone(accent ? 1600 : 1000, time, 0.05, 'square', accent ? 0.12 : 0.07); },
  };

  return {
    ensure, noteOn, noteOff, play, playSequence, fx,
    get now() { return ctx ? ctx.currentTime : 0; },
    get volume() { return volume; },
    set volume(v) { volume = v; if (master) master.gain.value = v; },
  };
})();
