// Le parcours d'apprentissage : unités, leçons et générateurs d'exercices.
const Course = (() => {
  const N = s => Music.parse(s);
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pickSeq = (pool, n) => {
    const out = [];
    let prev = null;
    for (let i = 0; i < n; i++) {
      let c, tries = 0;
      do { c = pool[Math.floor(Math.random() * pool.length)]; } while (c === prev && pool.length > 1 && ++tries < 20);
      out.push(c); prev = c;
    }
    return out;
  };
  const notes = str => str.split(/\s+/).filter(Boolean).map(N);

  // "C4:1 D4:2 C4+E4+G4" -> étapes + doigtés
  function parseSeq(str) {
    const steps = [], fingers = [];
    str.split(/\s+/).filter(Boolean).forEach(tok => {
      const [p, f] = tok.split(':');
      steps.push(p.split('+').map(N));
      fingers.push(f ? f.split(',').map(Number) : null);
    });
    return { steps, fingers };
  }

  // ---------- Fabriques d'exercices ----------
  const intro = (title, html, extra = {}) => ({ type: 'intro', title, html, ...extra });
  const finds = (pool, n, anyOctave = false) => pickSeq(pool, n).map(midi => ({ type: 'find', midi, anyOctave }));
  const reads = (pool, n, clef = 'treble', anyOctave = false) => pickSeq(pool, n).map(midi => ({ type: 'read', midi, clef, anyOctave }));
  const nameIt = (pool, n, show = 'staff', clef = 'treble') => pickSeq(pool, n).map(midi => {
    const others = shuffle([...new Set(pool.filter(m => Music.pc(m) !== Music.pc(midi)).map(Music.pc))]).slice(0, 3);
    const choices = shuffle([Music.pc(midi), ...others]);
    return { type: 'name', midi, show, clef, choices };
  });
  const seq = (str, opts = {}) => ({ type: 'seq', ...parseSeq(str), guide: true, staff: true, names: true, ...opts });
  const chord = (str, title, opts = {}) => ({ type: 'seq', ...parseSeq(str), guide: true, staff: true, names: true, title, chord: true, ...opts });
  const ear = (str, opts = {}) => ({ type: 'ear', steps: notes(str), ...opts });
  const highLow = n => Array.from({ length: n }, () => {
    const a = 55 + Math.floor(Math.random() * 18);
    let b;
    do { b = a + (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 8)); } while (b === a);
    return { type: 'choice', prompt: 'Laquelle est la plus aiguë ?', play: [[a], [b]], options: [{ label: '1re note', correct: a > b }, { label: '2e note', correct: b > a }] };
  });
  const upDown = n => Array.from({ length: n }, () => {
    const start = 60 + Math.floor(Math.random() * 5);
    const up = Math.random() < 0.5;
    const mel = [0, 2, 4].map(i => start + (up ? i : -i));
    return { type: 'choice', prompt: 'La mélodie monte ou descend ?', play: mel.map(m => [m]), options: [{ label: '⬆️ Elle monte', correct: up }, { label: '⬇️ Elle descend', correct: !up }] };
  });
  const majMin = n => Array.from({ length: n }, () => {
    const root = 57 + Math.floor(Math.random() * 8);
    const major = Math.random() < 0.5;
    const ch = [root, root + (major ? 4 : 3), root + 7];
    return { type: 'choice', prompt: 'Cet accord est majeur ou mineur ?', play: [ch], options: [{ label: '😊 Majeur', correct: major }, { label: '😢 Mineur', correct: !major }] };
  });
  const rhythm = (pattern, bpm = 80) => ({ type: 'rhythm', pattern, bpm });

  const WHITE_C4 = notes('C4 D4 E4 F4 G4 A4 B4');
  const units = [
    {
      id: 'u1', title: 'Découvrir le clavier', color: 'green', icon: '🎹',
      desc: 'Repère-toi sur les 61 touches de ton CT-S100.',
      lessons: [
        {
          id: 'u1l1', title: 'Trouver le Do', icon: '🔍', labels: 'none', range: [48, 84],
          build: () => [
            intro('Les touches noires', `Regarde les touches noires : elles forment des <b>groupes de 2</b> et des <b>groupes de 3</b>, qui se répètent sur tout le clavier.<br><br>C'est ta boussole pour te repérer !`, { keys: notes('C#4 D#4'), keys2: notes('F#4 G#4 A#4') }),
            intro('Voici le Do', `Le <b>Do</b> est la touche blanche <b>juste à gauche d'un groupe de 2 touches noires</b>.<br><br>Il y a plusieurs Do sur ton clavier : un dans chaque octave.`, { keys: notes('C3 C4 C5 C6') }),
            ...finds([48, 60, 72], 4, true),
            intro('Le Do central ★', `Le <b>Do central</b> est au milieu du piano. Sur ton CT-S100, c'est le <b>3e Do en partant de la gauche</b>.<br><br>Il est marqué d'une étoile ★ dans l'app. C'est LE point de repère du pianiste.`, { keys: [60] }),
            ...finds([60], 2),
          ],
        },
        {
          id: 'u1l2', title: 'Do, Ré, Mi', icon: '🎵', labels: 'c',
          build: () => [
            intro('Ré et Mi', `Le <b>Ré</b> est <b>entre les 2 touches noires</b>.<br>Le <b>Mi</b> est juste à leur <b>droite</b>.<br><br>Do – Ré – Mi : les trois touches blanches autour du groupe de 2 !`, { keys: notes('C4 D4 E4') }),
            ...finds(notes('C4 D4 E4'), 6, true),
            seq('C4 D4 E4', { title: 'Joue Do – Ré – Mi' }),
            seq('E4 D4 C4', { title: 'Et maintenant à l\'envers' }),
            ...finds(notes('C4 D4 E4'), 3),
          ],
        },
        {
          id: 'u1l3', title: 'Fa, Sol, La, Si', icon: '🎶', labels: 'c',
          build: () => [
            intro('Le groupe de 3', `Le <b>Fa</b> est juste à <b>gauche d'un groupe de 3</b> touches noires.<br>Ensuite viennent <b>Sol</b>, <b>La</b> et <b>Si</b>, puis on retombe sur un Do !`, { keys: notes('F4 G4 A4 B4') }),
            ...finds(notes('F4 G4 A4 B4'), 6, true),
            seq('C4 D4 E4 F4 G4 A4 B4 C5', { title: 'La gamme de Do !' }),
            ...finds(WHITE_C4, 4, true),
          ],
        },
        {
          id: 'u1l4', title: 'Révision', icon: '⭐', labels: 'none',
          build: () => [
            ...finds(WHITE_C4, 5, true),
            ...nameIt(WHITE_C4, 4, 'key'),
            ...finds(WHITE_C4, 4, true),
            seq('C5 B4 A4 G4 F4 E4 D4 C4', { title: 'La gamme en descendant' }),
          ],
        },
      ],
    },
    {
      id: 'u2', title: 'Main droite : position de Do', color: 'blue', icon: '✋',
      desc: 'Tes 5 doigts sur 5 touches, tes premières mélodies.',
      lessons: [
        {
          id: 'u2l1', title: 'Les numéros des doigts', icon: '🖐️', labels: 'c',
          build: () => [
            intro('Les doigts ont des numéros', `Pouce = <b>1</b>, index = <b>2</b>, majeur = <b>3</b>, annulaire = <b>4</b>, auriculaire = <b>5</b>.<br><br>Pose ton <b>pouce droit sur le Do central</b>, et chaque doigt sur la touche blanche suivante. C'est la <b>position de Do</b>.<br><br>Garde les doigts arrondis, comme si tu tenais une balle.`, { keys: notes('C4 D4 E4 F4 G4'), fingers: [1, 2, 3, 4, 5] }),
            seq('C4:1 D4:2 E4:3 F4:4 G4:5', { title: 'Monte avec les 5 doigts' }),
            seq('G4:5 F4:4 E4:3 D4:2 C4:1', { title: 'Redescends' }),
            seq('C4:1 E4:3 G4:5 E4:3 C4:1', { title: 'Saute une touche' }),
            seq('C4:1 D4:2 C4:1 E4:3 C4:1 F4:4 C4:1 G4:5', { title: 'Le pouce reste en place' }),
          ],
        },
        {
          id: 'u2l2', title: 'Premières mélodies', icon: '🎼', labels: 'c',
          build: () => [
            seq('C4:1 D4:2 E4:3 D4:2 C4:1'),
            seq('E4:3 F4:4 G4:5 F4:4 E4:3'),
            seq('C4:1 E4:3 D4:2 F4:4 E4:3 G4:5'),
            seq('G4:5 E4:3 F4:4 D4:2 E4:3 C4:1'),
            seq('C4:1 C4:1 G4:5 G4:5 E4:3 E4:3 C4:1', { names: false, title: 'Sans les noms cette fois !' }),
          ],
        },
        {
          id: 'u2l3', title: 'Le rythme', icon: '🥁', labels: 'none',
          build: () => [
            intro('Tenir le tempo', `En musique, le temps est découpé en <b>pulsations</b> régulières, comme un cœur qui bat.<br><br>♩ <b>noire</b> = 1 temps &nbsp;·&nbsp; 𝅗𝅥 <b>blanche</b> = 2 temps<br><br>Le métronome compte 4 temps, puis tape sur <b>n'importe quelle touche</b> au bon moment.`),
            rhythm([1, 1, 1, 1, 1, 1, 1, 1], 70),
            rhythm([1, 1, 2, 1, 1, 2], 70),
            rhythm([2, 1, 1, 2, 2], 75),
            rhythm([1, 1, 1, 1, 2, 2], 80),
          ],
        },
        {
          id: 'u2l4', title: 'Au clair de la lune', icon: '🌙', labels: 'c',
          build: () => [
            intro('Ton premier morceau !', `« Au clair de la lune » n'utilise que <b>Do, Ré, Mi</b> pour la première phrase.<br><br>Place ta main en position de Do et suis les touches qui s'allument.`),
            seq('C4:1 C4:1 C4:1 D4:2 E4:3 D4:2', { title: 'Au clair de la lune…' }),
            seq('C4:1 E4:3 D4:2 D4:2 C4:1', { title: '…mon ami Pierrot' }),
            seq('C4:1 C4:1 C4:1 D4:2 E4:3 D4:2 C4:1 E4:3 D4:2 D4:2 C4:1', { title: 'La phrase entière', guide: false }),
          ],
        },
        {
          id: 'u2l5', title: 'Ode à la joie', icon: '🎉', labels: 'c',
          build: () => [
            intro('Beethoven !', `L'Ode à la joie tient entièrement dans la <b>position de Do</b> (Do à Sol). Chaque doigt reste sur sa touche.`, { keys: notes('C4 D4 E4 F4 G4'), fingers: [1, 2, 3, 4, 5] }),
            seq('E4:3 E4:3 F4:4 G4:5 G4:5 F4:4 E4:3 D4:2'),
            seq('C4:1 C4:1 D4:2 E4:3 E4:3 D4:2 D4:2'),
            seq('C4:1 C4:1 D4:2 E4:3 D4:2 C4:1 C4:1'),
            seq('E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4', { title: 'Sans aide, de mémoire !', guide: false, names: false }),
          ],
        },
      ],
    },
    {
      id: 'u3', title: 'Lire la clé de Sol', color: 'purple', icon: '𝄞',
      desc: 'Déchiffre les notes sur la portée.',
      lessons: [
        {
          id: 'u3l1', title: 'La portée', icon: '📜', labels: 'none',
          build: () => [
            intro('La portée', `Les notes s'écrivent sur <b>5 lignes</b> : la portée. Plus la note est <b>haute</b> sur la portée, plus elle est <b>aiguë</b>.<br><br>La <b>clé de Sol</b> 𝄞 sert pour la main droite. Le <b>Do central</b> s'écrit sur une petite ligne en dessous.`, { staff: notes('C4') }),
            intro('Do, Ré, Mi', `Do est <b>sur</b> la petite ligne, Ré est <b>juste sous</b> la portée, et Mi est <b>sur la 1re ligne</b>.`, { staff: notes('C4 D4 E4') }),
            ...nameIt(notes('C4 D4 E4'), 4),
            ...reads(notes('C4 D4 E4'), 5),
          ],
        },
        {
          id: 'u3l2', title: 'Fa et Sol', icon: '📗', labels: 'none',
          build: () => [
            intro('Fa et Sol', `Les notes alternent : <b>ligne, interligne, ligne…</b><br>Fa est dans le 1er interligne, Sol sur la 2e ligne (c'est la ligne où s'enroule la clé de Sol !).`, { staff: notes('C4 D4 E4 F4 G4') }),
            ...nameIt(notes('C4 D4 E4 F4 G4'), 4),
            ...reads(notes('C4 D4 E4 F4 G4'), 6),
          ],
        },
        {
          id: 'u3l3', title: 'La, Si, Do aigu', icon: '📘', labels: 'none',
          build: () => [
            intro('Plus haut', `On continue de monter : <b>La</b> (interligne), <b>Si</b> (ligne du milieu), <b>Do</b> aigu (interligne).`, { staff: notes('G4 A4 B4 C5') }),
            ...nameIt(notes('G4 A4 B4 C5'), 3),
            ...reads(notes('C4 D4 E4 F4 G4 A4 B4 C5'), 7),
          ],
        },
        {
          id: 'u3l4', title: 'Lecture rapide', icon: '⚡', labels: 'none',
          build: () => [
            ...reads(notes('C4 D4 E4 F4 G4 A4 B4 C5 D5 E5'), 8),
            seq('C4 E4 G4 E4 C4', { title: 'Lis et joue', guide: false, names: false }),
            seq('G4 A4 G4 F4 E4 D4 C4', { title: 'Lis et joue', guide: false, names: false }),
          ],
        },
      ],
    },
    {
      id: 'u4', title: 'Main gauche & clé de Fa', color: 'orange', icon: '🤚',
      desc: 'Le grave du piano, pour accompagner.',
      lessons: [
        {
          id: 'u4l1', title: 'Position de Do à gauche', icon: '🤚', labels: 'c', range: [36, 72],
          build: () => [
            intro('La main gauche', `Pose ton <b>auriculaire gauche (5)</b> sur le Do <b>sous</b> le Do central, et ton <b>pouce (1)</b> sur le Sol.<br><br>Attention : à gauche, les numéros vont dans l'autre sens !`, { keys: notes('C3 D3 E3 F3 G3'), fingers: [5, 4, 3, 2, 1] }),
            seq('C3:5 D3:4 E3:3 F3:2 G3:1', { title: 'Monte avec la main gauche' }),
            seq('G3:1 F3:2 E3:3 D3:4 C3:5', { title: 'Redescends' }),
            ...finds(notes('C3 D3 E3 F3 G3'), 5),
          ],
        },
        {
          id: 'u4l2', title: 'La clé de Fa', icon: '𝄢', labels: 'none', range: [36, 72],
          build: () => [
            intro('La clé de Fa', `La main gauche lit la <b>clé de Fa</b> 𝄢. Ses deux points entourent la ligne du <b>Fa</b>.<br><br>Le Do de ta position est dans le <b>2e interligne</b>.`, { staff: notes('C3 D3 E3 F3 G3'), clef: 'bass' }),
            ...nameIt(notes('C3 D3 E3 F3 G3'), 4, 'staff', 'bass'),
            ...reads(notes('C3 D3 E3 F3 G3'), 6, 'bass'),
          ],
        },
        {
          id: 'u4l3', title: 'Mélodie à gauche', icon: '🎻', labels: 'c', range: [36, 72],
          build: () => [
            seq('C3:5 E3:3 G3:1 E3:3 C3:5'),
            seq('C3:5 D3:4 E3:3 F3:2 G3:1 F3:2 E3:3 D3:4 C3:5'),
            seq('G3 F3 E3 D3 E3 C3', { guide: false, names: false, title: 'Lis et joue' }),
            ...reads(notes('C3 D3 E3 F3 G3 A3 B3'), 4, 'bass'),
          ],
        },
      ],
    },
    {
      id: 'u5', title: 'Entraîne ton oreille', color: 'red', icon: '👂',
      desc: 'Reconnais et rejoue ce que tu entends.',
      lessons: [
        {
          id: 'u5l1', title: 'Grave ou aigu ?', icon: '🎧', labels: 'c',
          build: () => [
            intro('Écoute bien', `Un son <b>aigu</b> est haut (à droite du piano), un son <b>grave</b> est bas (à gauche).<br><br>Clique sur 🔊 pour réécouter autant que tu veux.`),
            ...highLow(4), ...upDown(3),
          ],
        },
        {
          id: 'u5l2', title: 'Répète la note', icon: '🔁', labels: 'c',
          build: () => [
            intro('Rejoue ce que tu entends', `L'app joue une note, à toi de la retrouver sur le clavier. Indice : elle est entre <b>Do et Sol</b> (position de Do).`, { keys: notes('C4 D4 E4 F4 G4') }),
            ...pickSeq(notes('C4 D4 E4 F4 G4'), 6).map(m => ({ type: 'ear', steps: [m] })),
          ],
        },
        {
          id: 'u5l3', title: 'Répète la mélodie', icon: '🎤', labels: 'c',
          build: () => [
            ear('C4 D4 E4'), ear('C4 E4 G4'), ear('C4 D4 C4'), ear('E4 D4 C4'), ear('C4 G4 E4'), ear('G4 F4 E4 D4 C4'),
          ],
        },
      ],
    },
    {
      id: 'u6', title: 'Les touches noires', color: 'gray', icon: '♯',
      desc: 'Les dièses, et ton premier Beethoven.',
      lessons: [
        {
          id: 'u6l1', title: 'Les dièses', icon: '♯', labels: 'c',
          build: () => [
            intro('Le dièse ♯', `Un <b>dièse</b> ♯ monte une note d'un demi-ton : on joue la touche <b>juste à droite</b>, souvent une touche noire.<br><br>Fa♯ est la touche noire juste à droite du Fa.`, { keys: notes('F#4 C#4') }),
            ...finds(notes('F#4 C#4'), 4, true),
            ...reads(notes('C#4 F#4 G#4'), 4),
          ],
        },
        {
          id: 'u6l2', title: 'Toutes les noires', icon: '🖤', labels: 'c',
          build: () => [
            intro('5 touches noires', `Groupe de 2 : <b>Do♯, Ré♯</b>.<br>Groupe de 3 : <b>Fa♯, Sol♯, La♯</b>.`, { keys: notes('C#4 D#4 F#4 G#4 A#4') }),
            ...finds(notes('C#4 D#4 F#4 G#4 A#4'), 6, true),
            ...nameIt(notes('C#4 D#4 F#4 G#4 A#4'), 3, 'key'),
            seq('C4 C#4 D4 D#4 E4 F4 F#4 G4', { title: 'La gamme chromatique' }),
          ],
        },
        {
          id: 'u6l3', title: 'Lettre à Élise', icon: '💌', labels: 'c', range: [60, 84],
          build: () => [
            intro('Lettre à Élise', `Le célèbre début alterne <b>Mi</b> et <b>Ré♯</b> (touche noire). Va doucement, la vitesse viendra.`, { keys: notes('E5 D#5') }),
            seq('E5 D#5 E5 D#5 E5'),
            seq('E5 D#5 E5 D#5 E5 B4 D5 C5 A4'),
            seq('C4 E4 A4 B4'),
            seq('E5 D#5 E5 D#5 E5 B4 D5 C5 A4', { guide: false, title: 'De mémoire !' }),
          ],
        },
      ],
    },
    {
      id: 'u7', title: 'Les accords', color: 'yellow', icon: '🎹',
      desc: 'Plusieurs notes ensemble pour accompagner.',
      lessons: [
        {
          id: 'u7l1', title: 'Do majeur', icon: '🟡', labels: 'c',
          build: () => [
            intro('Ton premier accord', `Un <b>accord</b>, c'est plusieurs notes jouées <b>en même temps</b>.<br><br>Do majeur = <b>Do + Mi + Sol</b>, avec les doigts 1, 3 et 5. Appuie les 3 touches ensemble !`, { keys: notes('C4 E4 G4'), fingers: [1, 3, 5] }),
            chord('C4+E4+G4:1,3,5', 'Joue Do majeur'),
            chord('C4+E4+G4:1,3,5 C4+E4+G4:1,3,5 C4+E4+G4:1,3,5', 'Trois fois !'),
            seq('C4:1 E4:3 G4:5 C4+E4+G4:1,3,5', { title: 'Note par note, puis ensemble' }),
          ],
        },
        {
          id: 'u7l2', title: 'Fa et Sol majeur', icon: '🟠', labels: 'c',
          build: () => [
            intro('Même forme, autre départ', `Garde la même forme de main (1-3-5) et déplace-la :<br><b>Fa majeur</b> = Fa La Do<br><b>Sol majeur</b> = Sol Si Ré`, { keys: notes('F4 A4 C5') }),
            chord('F4+A4+C5:1,3,5', 'Joue Fa majeur'),
            chord('G4+B4+D5:1,3,5', 'Joue Sol majeur'),
            chord('C4+E4+G4 F4+A4+C5 G4+B4+D5 C4+E4+G4', 'Do – Fa – Sol – Do'),
          ],
        },
        {
          id: 'u7l3', title: 'Majeur ou mineur', icon: '🎭', labels: 'c',
          build: () => [
            intro('Les accords mineurs', `Un accord <b>mineur</b> sonne plus triste : la note du milieu descend d'un demi-ton.<br><br>La mineur = <b>La + Do + Mi</b>.`, { keys: notes('A4 C5 E5') }),
            ...majMin(4),
            chord('A4+C5+E5', 'Joue La mineur'),
            chord('D4+F4+A4', 'Joue Ré mineur'),
            chord('E4+G4+B4', 'Joue Mi mineur'),
          ],
        },
        {
          id: 'u7l4', title: 'Accords à gauche', icon: '🤚', labels: 'c', range: [36, 72],
          build: () => [
            intro('Accompagner', `La main gauche joue souvent les accords pendant que la droite chante la mélodie.`, { keys: notes('C3 E3 G3'), fingers: [5, 3, 1] }),
            chord('C3+E3+G3:5,3,1', 'Do majeur à gauche'),
            chord('F2+A2+C3:5,3,1', 'Fa majeur à gauche'),
            chord('G2+B2+D3:5,3,1', 'Sol majeur à gauche'),
            chord('C3+E3+G3 F2+A2+C3 G2+B2+D3 C3+E3+G3', 'L\'enchaînement complet'),
          ],
        },
      ],
    },
    {
      id: 'u8', title: 'Les deux mains', color: 'teal', icon: '🙌',
      desc: 'Le grand saut : main gauche et main droite ensemble.',
      lessons: [
        {
          id: 'u8l1', title: 'Ensemble !', icon: '🤝', labels: 'c', range: [36, 84],
          build: () => [
            intro('Deux mains', `Les deux mains en position de Do : gauche sur le Do grave, droite sur le Do central. Commence par jouer <b>la même note</b> avec les deux mains.`, { keys: notes('C3 C4') }),
            seq('C3+C4 D3+D4 E3+E4 F3+F4 G3+G4', { title: 'En miroir' }),
            seq('G3+G4 F3+F4 E3+E4 D3+D4 C3+C4', { title: 'Et en descendant' }),
            seq('C3+E4 C3+F4 C3+G4 G2+D4 C3+C4', { title: 'La gauche tient la basse' }),
          ],
        },
        {
          id: 'u8l2', title: 'Mélodie + basse', icon: '🎼', labels: 'c', range: [36, 84],
          build: () => [
            intro('Ode à la joie à 2 mains', `La main gauche joue une seule note au <b>début de chaque mesure</b>, la droite fait la mélodie.`),
            seq('C3+E4 E4 F4 G4 G2+G4 F4 E4 D4'),
            seq('C3+C4 C4 D4 E4 G2+E4 D4 D4'),
            seq('C3+E4 E4 F4 G4 G2+G4 F4 E4 D4 C3+C4 C4 D4 E4 G2+D4 C4 C3+C4', { title: 'Tout le passage' }),
          ],
        },
      ],
    },
  ];

  const allLessons = units.flatMap(u => u.lessons.map(l => ({ ...l, unit: u })));
  const lessonById = id => allLessons.find(l => l.id === id);

  return { units, allLessons, lessonById, shuffle };
})();
