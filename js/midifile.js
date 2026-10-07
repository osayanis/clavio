// Lecture des fichiers MIDI standard (.mid) et conversion en morceau jouable.
const MidiFile = (() => {
  const GM_FAMILIES = ['Piano', 'Percussions chromatiques', 'Orgue', 'Guitare', 'Basse', 'Cordes', 'Ensemble',
    'Cuivres', 'Anches', 'Flûte', 'Synthé lead', 'Synthé pad', 'Effets synthé', 'Ethnique', 'Percussions', 'Effets'];

  function parse(buffer) {
    const data = new DataView(buffer);
    let p = 0;
    const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(data.getUint8(p + i)); p += n; return s; };
    const u32 = () => { const v = data.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = data.getUint16(p); p += 2; return v; };
    const u8 = () => data.getUint8(p++);
    const vlq = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

    // Certains fichiers ont un en-tête RIFF
    if (str(4) === 'RIFF') { p = 20; } else p = 0;
    if (str(4) !== 'MThd') throw new Error("Ce n'est pas un fichier MIDI valide.");
    const hlen = u32();
    const format = u16();
    const ntracks = u16();
    const division = u16();
    p += hlen - 6;
    if (division & 0x8000) throw new Error('Format temporel SMPTE non pris en charge.');
    const ppq = division;

    const tempos = [];
    const timeSigs = [];
    const tracks = [];

    for (let t = 0; t < ntracks && p < data.byteLength - 8; t++) {
      const id = str(4);
      const len = u32();
      const end = p + len;
      if (id !== 'MTrk') { p = end; continue; }
      const track = { name: '', notes: [], programs: {}, channels: new Set() };
      const open = new Map();
      let tick = 0, running = 0;
      while (p < end) {
        tick += vlq();
        let st = data.getUint8(p);
        if (st & 0x80) { p++; if (st < 0xf0) running = st; }
        else st = running;
        if (st === 0xff) {
          const type = u8();
          const l = vlq();
          if (type === 0x51 && l === 3) {
            const us = (data.getUint8(p) << 16) | (data.getUint8(p + 1) << 8) | data.getUint8(p + 2);
            tempos.push({ tick, us });
          } else if (type === 0x58 && l >= 2) {
            timeSigs.push({ tick, num: data.getUint8(p), den: Math.pow(2, data.getUint8(p + 1)) });
          } else if ((type === 0x03 || type === 0x04) && !track.name) {
            let s = '';
            for (let i = 0; i < l; i++) s += String.fromCharCode(data.getUint8(p + i));
            track.name = s.replace(/\0/g, '').trim();
          }
          p += l;
          if (type === 0x2f) break;
        } else if (st === 0xf0 || st === 0xf7) {
          p += vlq();
        } else {
          const type = st & 0xf0, ch = st & 0x0f;
          if (type === 0xc0 || type === 0xd0) {
            const v = u8();
            if (type === 0xc0 && track.programs[ch] === undefined) track.programs[ch] = v;
          } else {
            const d1 = u8(), d2 = u8();
            const key = ch * 128 + d1;
            if (type === 0x90 && d2 > 0) {
              if (!open.has(key)) open.set(key, []);
              open.get(key).push({ tick, vel: d2 });
              track.channels.add(ch);
            } else if (type === 0x80 || type === 0x90) {
              const q = open.get(key);
              if (q && q.length) {
                const s = q.shift();
                track.notes.push({ midi: d1, ch, startTick: s.tick, endTick: Math.max(tick, s.tick + 1), vel: s.vel / 127 });
              }
            }
          }
        }
      }
      // notes jamais relâchées
      for (const [key, q] of open) for (const s of q) {
        track.notes.push({ midi: key % 128, ch: Math.floor(key / 128), startTick: s.tick, endTick: s.tick + ppq, vel: s.vel / 127 });
      }
      p = end;
      tracks.push(track);
    }

    // Conversion ticks -> secondes avec la carte des tempos
    tempos.sort((a, b) => a.tick - b.tick);
    if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, us: 500000 });
    const segs = [];
    let acc = 0;
    tempos.forEach((tp, i) => {
      if (i > 0) acc += (tp.tick - tempos[i - 1].tick) * tempos[i - 1].us / 1e6 / ppq;
      segs.push({ tick: tp.tick, sec: acc, us: tp.us });
    });
    const toSec = tick => {
      let s = segs[0];
      for (const x of segs) { if (x.tick <= tick) s = x; else break; }
      return s.sec + (tick - s.tick) * s.us / 1e6 / ppq;
    };

    timeSigs.sort((a, b) => a.tick - b.tick);
    const ts = timeSigs[0] || { num: 4, den: 4 };

    let maxTick = 0;
    tracks.forEach(tr => tr.notes.forEach(n => { maxTick = Math.max(maxTick, n.endTick); }));

    // Barres de mesure
    const bars = [];
    const sigs = timeSigs.length ? timeSigs : [{ tick: 0, num: 4, den: 4 }];
    let tick = 0, si = 0;
    while (tick <= maxTick + 1 && bars.length < 5000) {
      while (si + 1 < sigs.length && sigs[si + 1].tick <= tick) si++;
      bars.push(toSec(tick));
      tick += ppq * 4 * sigs[si].num / sigs[si].den;
    }

    const parts = [];
    tracks.forEach((tr, ti) => {
      // Une piste peut contenir plusieurs canaux : on les sépare
      const byCh = new Map();
      tr.notes.forEach(n => { if (!byCh.has(n.ch)) byCh.set(n.ch, []); byCh.get(n.ch).push(n); });
      for (const [ch, notes] of byCh) {
        const program = tr.programs[ch] ?? 0;
        const isDrum = ch === 9;
        const name = tr.name || (isDrum ? 'Batterie' : GM_FAMILIES[program >> 3]) || `Piste ${ti + 1}`;
        parts.push({
          id: `t${ti}c${ch}`,
          name: byCh.size > 1 ? `${name} (canal ${ch + 1})` : name,
          isDrum,
          program,
          notes: notes.map(n => ({
            midi: n.midi,
            time: toSec(n.startTick),
            dur: Math.max(0.05, toSec(n.endTick) - toSec(n.startTick)),
            vel: n.vel,
          })).sort((a, b) => a.time - b.time || a.midi - b.midi),
        });
      }
    });

    return {
      format, ppq, parts, bars,
      bpm: Math.round(60e6 / tempos[0].us),
      timeSig: ts,
      duration: toSec(maxTick),
    };
  }

  // Transforme un MIDI analysé en morceau pour l'app
  function toSong(parsed, title, id) {
    const parts = parsed.parts.filter(pt => pt.notes.length > 0);
    if (!parts.some(pt => !pt.isDrum)) throw new Error('Aucune note jouable dans ce fichier.');
    // Devine la main : grave = gauche
    parts.forEach(pt => {
      const avg = pt.notes.reduce((s, n) => s + n.midi, 0) / pt.notes.length;
      pt.hand = avg < 58 ? 'L' : 'R';
    });
    // Recale le tout pour démarrer près de 0
    const first = Math.min(...parts.flatMap(pt => pt.notes.map(n => n.time)));
    const shift = Math.max(0, first - 0.5);
    parts.forEach(pt => pt.notes.forEach(n => { n.time -= shift; }));
    return {
      id, title, source: 'midi',
      bpm: parsed.bpm,
      timeSig: parsed.timeSig,
      bars: parsed.bars.map(b => b - shift).filter(b => b >= -0.01),
      parts,
      duration: parsed.duration - shift,
    };
  }

  return { parse, toSong };
})();
