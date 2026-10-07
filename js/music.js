// Utilitaires musicaux : noms de notes, fréquences, position sur la portée, accords.
const Music = (() => {
  const LATIN = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  const ENGLISH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const BLACK_PC = new Set([1, 3, 6, 8, 10]);
  // Index de la lettre (C=0 ... B=6) pour chaque classe de hauteur, dièses
  const LETTER_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const PC_OF_LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Clavier Casio CT-S100 : 61 touches, de Do2 (36) à Do7 (96)
  const KEYBOARD_LO = 36;
  const KEYBOARD_HI = 96;
  const MIDDLE_C = 60;

  let notation = 'latin';

  const pc = m => ((m % 12) + 12) % 12;
  const isBlack = m => BLACK_PC.has(pc(m));
  const octave = m => Math.floor(m / 12) - 1;

  function name(m, withOctave = false) {
    const n = (notation === 'latin' ? LATIN : ENGLISH)[pc(m)];
    if (!withOctave) return n;
    return n + octave(m);
  }

  // "C4", "F#3", "Bb2" -> numéro MIDI
  function parse(str) {
    const m = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(str.trim());
    if (!m) throw new Error('Note invalide : ' + str);
    let v = PC_OF_LETTER[m[1].toUpperCase()];
    if (m[2] === '#' || m[2] === '♯') v += 1;
    if (m[2] === 'b' || m[2] === '♭') v -= 1;
    return v + (parseInt(m[3], 10) + 1) * 12;
  }

  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  // Position diatonique (pour la portée) : Do4 = 28, Mi4 = 30...
  const diatonic = m => octave(m) * 7 + LETTER_OF_PC[pc(m)];

  const CHORDS = [
    { iv: [0, 4, 7], latin: 'majeur', en: '' },
    { iv: [0, 3, 7], latin: 'mineur', en: 'm' },
    { iv: [0, 4, 7, 10], latin: '7', en: '7' },
    { iv: [0, 4, 7, 11], latin: 'maj7', en: 'maj7' },
    { iv: [0, 3, 7, 10], latin: 'm7', en: 'm7' },
    { iv: [0, 3, 6], latin: 'diminué', en: 'dim' },
    { iv: [0, 4, 8], latin: 'augmenté', en: 'aug' },
    { iv: [0, 2, 7], latin: 'sus2', en: 'sus2' },
    { iv: [0, 5, 7], latin: 'sus4', en: 'sus4' },
    { iv: [0, 7], latin: '5 (quinte)', en: '5' },
  ];

  // Reconnaît un accord à partir d'une liste de notes MIDI
  function chordName(midis) {
    if (midis.length < 2) return null;
    const sorted = [...midis].sort((a, b) => a - b);
    const pcs = [...new Set(sorted.map(pc))];
    if (pcs.length < 2) return null;
    const bass = pc(sorted[0]);
    let best = null;
    for (const root of pcs) {
      const set = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
      for (const c of CHORDS) {
        if (c.iv.length === set.length && c.iv.every((v, i) => v === set[i])) {
          const score = (root === bass ? 2 : 0) + c.iv.length;
          if (!best || score > best.score) best = { root, chord: c, score };
        }
      }
    }
    if (!best) return null;
    const rootName = (notation === 'latin' ? LATIN : ENGLISH)[best.root];
    const label = notation === 'latin' ? `${rootName} ${best.chord.latin}` : rootName + best.chord.en;
    const inversion = best.root !== bass ? ` / ${(notation === 'latin' ? LATIN : ENGLISH)[bass]}` : '';
    return label + inversion;
  }

  // Disposition du clavier : position x (0..1) et largeur de chaque touche
  function layout(lo, hi) {
    const keys = new Map();
    let whites = 0;
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
    const ww = 1 / whites;
    const bw = ww * 0.62;
    // décalages réalistes des touches noires
    const offset = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      if (isBlack(m)) {
        keys.set(m, { x: wi * ww - bw / 2 + offset[pc(m)] * bw, w: bw, black: true });
      } else {
        keys.set(m, { x: wi * ww, w: ww, black: false });
        wi++;
      }
    }
    return { keys, whites, whiteWidth: ww };
  }

  // Étend une liste de notes à une plage d'octaves entières (de Do à Do) dans le clavier
  function fitRange(midis, minOctaves = 2) {
    let lo = Math.min(...midis), hi = Math.max(...midis);
    if (!isFinite(lo)) { lo = 48; hi = 72; }
    lo = Math.floor(lo / 12) * 12;
    hi = Math.ceil(hi / 12) * 12;
    while ((hi - lo) / 12 < minOctaves) {
      if (lo - 12 >= KEYBOARD_LO && (lo + hi) / 2 > MIDDLE_C) lo -= 12; else hi += 12;
    }
    lo = Math.max(KEYBOARD_LO, lo);
    hi = Math.min(KEYBOARD_HI, hi);
    return [lo, hi];
  }

  return {
    get notation() { return notation; },
    set notation(v) { notation = v; },
    LATIN, ENGLISH, KEYBOARD_LO, KEYBOARD_HI, MIDDLE_C,
    pc, isBlack, octave, name, parse, freq, diatonic, chordName, layout, fitRange,
  };
})();
