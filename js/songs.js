// Bibliothèque de morceaux intégrés (domaine public).
// Notation : "E4" = noire, "E4/2" = 2 temps, "E4/0.5" = croche, "C4+E4" = accord, "r/1" = silence, "|" = barre.
const Songs = (() => {
  function seq(text, bpm) {
    const beat = 60 / bpm;
    const notes = [];
    let t = 0;
    text.split(/\s+/).filter(Boolean).forEach(tok => {
      if (tok === '|') return;
      const [pitch, d] = tok.split('/');
      const beats = d ? parseFloat(d) : 1;
      if (pitch !== 'r') {
        pitch.split('+').forEach(p => notes.push({ midi: Music.parse(p), time: t, dur: beats * beat * 0.92, vel: 0.7 }));
      }
      t += beats * beat;
    });
    return { notes, length: t };
  }

  function song({ id, title, artist, level, bpm, beats = 4, right, left, desc }) {
    const r = seq(right, bpm);
    const parts = [{ id: 'R', name: 'Main droite', hand: 'R', notes: r.notes }];
    let length = r.length;
    if (left) {
      const l = seq(left, bpm);
      parts.push({ id: 'L', name: 'Main gauche', hand: 'L', notes: l.notes });
      length = Math.max(length, l.length);
    }
    const barLen = beats * 60 / bpm;
    const bars = [];
    for (let b = 0; b <= length + 0.001; b += barLen) bars.push(b);
    return { id, title, artist, level, bpm, desc, source: 'builtin', timeSig: { num: beats, den: 4 }, bars, parts, duration: length };
  }

  const list = [
    song({
      id: 'clair-lune', title: 'Au clair de la lune', artist: 'Traditionnel', level: 1, bpm: 90,
      desc: 'Seulement 5 notes, idéal pour débuter.',
      right: `C4 C4 C4 D4 | E4/2 D4/2 | C4 E4 D4 D4 | C4/4 |
              C4 C4 C4 D4 | E4/2 D4/2 | C4 E4 D4 D4 | C4/4 |
              D4 D4 D4 D4 | A3/2 A3/2 | D4 C4 B3 A3 | G3/4 |
              C4 C4 C4 D4 | E4/2 D4/2 | C4 E4 D4 D4 | C4/4`,
    }),
    song({
      id: 'frere-jacques', title: 'Frère Jacques', artist: 'Traditionnel', level: 1, bpm: 100,
      desc: 'Un grand classique en position de Do.',
      right: `C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4/2 | E4 F4 G4/2 |
              G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 | G4/0.5 A4/0.5 G4/0.5 F4/0.5 E4 C4 |
              C4 G3 C4/2 | C4 G3 C4/2`,
    }),
    song({
      id: 'twinkle', title: 'Ah ! vous dirai-je, maman', artist: 'Mozart (thème)', level: 1, bpm: 100,
      desc: '« Twinkle Twinkle Little Star ».',
      right: `C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2 |
              G4 G4 F4 F4 | E4 E4 D4/2 | G4 G4 F4 F4 | E4 E4 D4/2 |
              C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2`,
    }),
    song({
      id: 'ode-joie', title: 'Ode à la joie', artist: 'Beethoven', level: 2, bpm: 110,
      desc: 'La 9e symphonie, main droite en position de Do.',
      right: `E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/0.5 D4/2 |
              E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/0.5 C4/2 |
              D4 D4 E4 C4 | D4 E4/0.5 F4/0.5 E4 C4 | D4 E4/0.5 F4/0.5 E4 D4 | C4 D4 G3/2 |
              E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/0.5 C4/2`,
    }),
    song({
      id: 'ode-joie-2m', title: 'Ode à la joie (2 mains)', artist: 'Beethoven', level: 3, bpm: 100,
      desc: 'Ajoute une basse simple à la main gauche.',
      right: `E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/0.5 D4/2 |
              E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/0.5 C4/2`,
      left: `C3/4 | G2/4 | C3/4 | G2/4 | C3/4 | G2/4 | C3/2 G2/2 | C3/4`,
    }),
    song({
      id: 'jingle', title: 'Vive le vent', artist: 'J. Pierpont', level: 2, bpm: 120,
      desc: '« Jingle Bells », le refrain.',
      right: `E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/0.5 | E4/4 |
              F4 F4 F4/1.5 F4/0.5 | F4 E4 E4 E4/0.5 E4/0.5 | E4 D4 D4 E4 | D4/2 G4/2 |
              E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/0.5 | E4/4 |
              F4 F4 F4/1.5 F4/0.5 | F4 E4 E4 E4/0.5 E4/0.5 | G4 G4 F4 D4 | C4/4`,
    }),
    song({
      id: 'anniversaire', title: 'Joyeux anniversaire', artist: 'Traditionnel', level: 2, bpm: 100, beats: 3,
      desc: 'En 3 temps, avec quelques sauts.',
      right: `r/2 G3/0.75 G3/0.25 | A3 G3 C4 | B3/2 G3/0.75 G3/0.25 | A3 G3 D4 | C4/2 G3/0.75 G3/0.25 |
              G4 E4 C4 | B3 A3 F4/0.75 F4/0.25 | E4 C4 D4 | C4/3`,
    }),
    song({
      id: 'elise', title: 'Lettre à Élise (début)', artist: 'Beethoven', level: 3, bpm: 75, beats: 3,
      desc: 'Avec des touches noires (Ré♯ et Sol♯).',
      right: `r/2 E5/0.5 D#5/0.5 | E5/0.5 D#5/0.5 E5/0.5 B4/0.5 D5/0.5 C5/0.5 | A4/1.5 C4/0.5 E4/0.5 A4/0.5 |
              B4/1.5 E4/0.5 G#4/0.5 B4/0.5 | C5/1.5 E4/0.5 E5/0.5 D#5/0.5 |
              E5/0.5 D#5/0.5 E5/0.5 B4/0.5 D5/0.5 C5/0.5 | A4/1.5 C4/0.5 E4/0.5 A4/0.5 |
              B4/1.5 E4/0.5 C5/0.5 B4/0.5 | A4/3`,
      left: `r/3 | r/3 | A2/0.5 E3/0.5 A3/0.5 r/1.5 | E2/0.5 E3/0.5 G#3/0.5 r/1.5 | A2/0.5 E3/0.5 A3/0.5 r/1.5 |
             r/3 | A2/0.5 E3/0.5 A3/0.5 r/1.5 | E2/0.5 E3/0.5 G#3/0.5 r/1.5 | A2/3`,
    }),
    song({
      id: 'canon', title: 'Canon (accords)', artist: 'Pachelbel', level: 3, bpm: 70,
      desc: 'Une célèbre suite d\'accords à la main gauche, mélodie à droite.',
      right: `E5/2 D5/2 | C5/2 B4/2 | A4/2 G4/2 | A4/2 B4/2 | E5/2 D5/2 | C5/2 B4/2 | A4/2 G4/2 | A4/2 B4/2 | C5/4`,
      left: `C3+E3+G3/2 G2+B2+D3/2 | A2+C3+E3/2 E2+G2+B2/2 | F2+A2+C3/2 C3+E3+G3/2 | F2+A2+C3/2 G2+B2+D3/2 |
             C3+E3+G3/2 G2+B2+D3/2 | A2+C3+E3/2 E2+G2+B2/2 | F2+A2+C3/2 C3+E3+G3/2 | F2+A2+C3/2 G2+B2+D3/2 | C3+E3+G3/4`,
    }),
  ];

  return { list, seq, get: id => list.find(s => s.id === id) };
})();
