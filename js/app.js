// Interface principale : navigation, parcours, bibliothèque, jeu libre, profil, réglages.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ======================= Composants d'interface =======================
const UI = (() => {
  function mascot(mood = 'happy', size = 100) {
    const eyes = mood === 'happy'
      ? '<path d="M40 64 q7 -8 14 0" class="m-line"/><path d="M66 64 q7 -8 14 0" class="m-line"/>'
      : `<circle cx="47" cy="63" r="9" fill="#fff"/><circle cx="73" cy="63" r="9" fill="#fff"/>
         <circle cx="${mood === 'sad' ? 46 : 49}" cy="${mood === 'sad' ? 66 : 64}" r="4.5" fill="#1b2a30"/><circle cx="${mood === 'sad' ? 72 : 75}" cy="${mood === 'sad' ? 66 : 64}" r="4.5" fill="#1b2a30"/>`;
    const mouth = mood === 'sad' ? '<path d="M50 86 q10 -8 20 0" class="m-line"/>'
      : mood === 'talk' ? '<ellipse cx="60" cy="83" rx="8" ry="6" fill="#1b2a30"/><ellipse cx="60" cy="86" rx="5" ry="2.5" fill="#ff7a8a"/>'
      : '<path d="M48 79 q12 12 24 0" class="m-line"/>';
    const brows = mood === 'sad' ? '<path d="M38 50 l14 4" class="m-line thin"/><path d="M82 50 l-14 4" class="m-line thin"/>' : '';
    return `<svg class="mascot ${mood}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M86 8 v40" stroke="#46a302" stroke-width="6" stroke-linecap="round"/>
      <path d="M86 8 q16 4 20 20 q-8 -8 -20 -6" fill="#46a302"/>
      <ellipse cx="60" cy="110" rx="34" ry="5" fill="rgba(0,0,0,.25)"/>
      <rect x="18" y="34" width="84" height="74" rx="34" fill="#58cc02"/>
      <rect x="18" y="34" width="84" height="40" rx="30" fill="#6ad80f" opacity=".5"/>
      <rect x="32" y="92" width="56" height="12" rx="4" fill="#fff"/>
      <rect x="40" y="92" width="5" height="7" fill="#1b2a30"/><rect x="50" y="92" width="5" height="7" fill="#1b2a30"/>
      <rect x="65" y="92" width="5" height="7" fill="#1b2a30"/><rect x="75" y="92" width="5" height="7" fill="#1b2a30"/>
      <circle cx="34" cy="76" r="6" fill="#ff8fa3" opacity=".55"/><circle cx="86" cy="76" r="6" fill="#ff8fa3" opacity=".55"/>
      ${eyes}${brows}${mouth}
    </svg>`;
  }

  function stars(n, small = false) {
    return `<span class="stars ${small ? 'small' : ''}">${[1, 2, 3].map(i => `<span class="${i <= n ? 'on' : ''}">★</span>`).join('')}</span>`;
  }

  function toast(html, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = html;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  function modal(html, { onClose, wide, persistent } = {}) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
    root.appendChild(wrap);
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); onClose && onClose(); };
    if (!persistent) wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
    return { el: wrap.querySelector('.modal'), close };
  }

  function confirm(title, text, ok = 'OK', cancel = 'Annuler') {
    return new Promise(resolve => {
      let answered = false;
      const m = modal(`<h2>${title}</h2><p class="muted">${text}</p>
        <div class="row gap end"><button class="btn ghost c-no">${cancel}</button><button class="btn danger c-yes">${ok}</button></div>`,
        { onClose: () => { if (!answered) resolve(false); } });
      m.el.querySelector('.c-no').onclick = () => { answered = true; resolve(false); m.close(); };
      m.el.querySelector('.c-yes').onclick = () => { answered = true; resolve(true); m.close(); };
    });
  }

  function confetti() {
    const c = document.getElementById('confetti');
    const ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff', '#ff9600'];
    const parts = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4,
      r: Math.random() * 6 + 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frames = 0;
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach(p => {
        p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      });
      if (++frames < 200) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    };
    tick();
  }

  return { mascot, stars, toast, modal, confirm, confetti };
})();

// ======================= Application =======================
const App = (() => {
  const S = () => Store.state;
  const main = () => document.getElementById('main');
  let viewCleanup = null;
  const midiSongs = new Map(); // id -> morceau analysé
  const UNIT_SONGS = { u2: 'clair-lune', u3: 'twinkle', u4: 'frere-jacques', u5: 'jingle', u6: 'elise', u7: 'canon', u8: 'ode-joie-2m' };

  const TIPS = [
    'Joue lentement et juste plutôt que vite et faux. La vitesse vient toute seule.',
    'Garde les doigts arrondis, comme si tu tenais une petite balle dans la main.',
    '10 minutes par jour valent mieux qu\'une heure le dimanche.',
    'Assieds-toi pour que tes avant-bras soient à peu près à la hauteur du clavier.',
    'Regarde la partition (ou l\'écran) plutôt que tes mains : ton cerveau apprend la géographie du clavier.',
    'Quand un passage bloque, isole 2 ou 3 notes et répète-les en boucle.',
    'Le CT-S100 a un métronome intégré, mais tu en as aussi un dans « Jeu libre ».',
    'Respire et relâche les épaules : un pianiste détendu joue mieux.',
  ];

  // ---------- Barre supérieure ----------
  function renderTopbar() {
    const s = S();
    const lv = Game.level();
    const st = Input.status;
    const connected = Input.connected;
    document.getElementById('topbar').innerHTML = `
      <button class="chip midi-chip ${connected ? 'ok' : ''}" data-go="settings" title="${connected ? esc(st.devices.join(', ')) : 'Aucun clavier MIDI détecté'}">
        <span class="led"></span>${connected ? esc(st.devices[0]).slice(0, 22) : 'Clavier non connecté'}
      </button>
      <div class="top-stats">
        <span class="stat streak ${Store.state.lastActiveDay === Store.today() ? 'lit' : ''}" title="Série de jours">🔥 <b>${s.streak}</b></span>
        <span class="stat xp" title="XP total">⚡ <b>${s.xp}</b></span>
        <span class="stat lvl" title="Niveau">🏅 <b>Niv. ${lv.level}</b></span>
      </div>`;
    document.querySelector('.midi-chip').onclick = () => go('settings');
  }

  // ---------- Navigation ----------
  const VIEWS = { learn: viewLearn, songs: viewSongs, free: viewFree, profile: viewProfile, settings: viewSettings };
  function go(name) {
    if (!VIEWS[name]) name = 'learn';
    if (location.hash !== '#' + name) { location.hash = name; return; }
    if (viewCleanup) { viewCleanup(); viewCleanup = null; }
    document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === name));
    main().scrollTop = 0;
    document.getElementById('app').dataset.view = name;
    viewCleanup = VIEWS[name]() || null;
  }
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));

  function fullscreen(on) {
    document.getElementById('app').classList.toggle('hidden', on);
    document.getElementById('fullscreen').classList.toggle('hidden', !on);
    if (!on) document.getElementById('fullscreen').innerHTML = '';
  }

  function startLesson(lesson) {
    Sound.ensure();
    if (viewCleanup) { viewCleanup(); viewCleanup = null; }
    fullscreen(true);
    LessonPlayer.start(lesson, document.getElementById('fullscreen'), () => {
      fullscreen(false);
      renderTopbar();
      go(location.hash.slice(1) || 'learn');
    });
  }

  async function openSong(id) {
    const song = await getSong(id);
    if (!song) { UI.toast('Morceau introuvable', 'error'); return; }
    if (viewCleanup) { viewCleanup(); viewCleanup = null; }
    fullscreen(true);
    Practice.openSetup(song, document.getElementById('fullscreen'), () => {
      Practice.teardown();
      fullscreen(false);
      renderTopbar();
      go(location.hash.slice(1) || 'songs');
    });
  }

  async function getSong(id) {
    const b = Songs.get(id);
    if (b) return b;
    if (midiSongs.has(id)) return midiSongs.get(id);
    await loadMidiLibrary();
    return midiSongs.get(id);
  }

  let midiLoaded = null;
  function loadMidiLibrary() {
    if (!midiLoaded) {
      midiLoaded = Store.midis.all().then(recs => {
        recs.sort((a, b) => b.added - a.added);
        recs.forEach(r => {
          try { midiSongs.set(r.id, MidiFile.toSong(MidiFile.parse(r.data), r.name, r.id)); }
          catch (e) { console.warn('MIDI illisible', r.name, e); }
        });
      }).catch(e => console.warn(e));
    }
    return midiLoaded;
  }

  async function importFiles(files) {
    let ok = 0;
    for (const file of files) {
      if (!/\.(mid|midi|kar|rmi)$/i.test(file.name)) { UI.toast(`« ${esc(file.name)} » n'est pas un fichier MIDI`, 'error'); continue; }
      try {
        const data = await file.arrayBuffer();
        const name = file.name.replace(/\.(mid|midi|kar|rmi)$/i, '').replace(/[_-]+/g, ' ').trim();
        const id = 'midi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const song = MidiFile.toSong(MidiFile.parse(data), name, id);
        await Store.midis.add({ id, name, data, added: Date.now() });
        midiSongs.set(id, song);
        ok++;
      } catch (e) {
        UI.toast(`Impossible de lire « ${esc(file.name)} » : ${esc(e.message)}`, 'error');
      }
    }
    if (ok) { UI.toast(`🎵 ${ok} morceau${ok > 1 ? 'x' : ''} importé${ok > 1 ? 's' : ''} !`); Game.award('midi-import'); }
    return ok;
  }

  // ======================= Vue : Apprendre =======================
  function viewLearn() {
    const s = S();
    const next = Game.nextLesson();
    let html = '<div class="learn-layout"><div class="path-col">';
    Course.units.forEach((u, ui) => {
      const doneCount = u.lessons.filter(l => s.lessons[l.id]?.done).length;
      html += `<section class="unit">
        <div class="unit-banner c-${u.color}">
          <div><div class="unit-kicker">Unité ${ui + 1} · ${doneCount}/${u.lessons.length}</div>
          <h2>${esc(u.title)}</h2><p>${esc(u.desc)}</p></div>
          <div class="unit-icon">${u.icon}</div>
        </div>
        <div class="path">`;
      u.lessons.forEach((l, li) => {
        const done = s.lessons[l.id]?.done;
        const unlocked = Game.isUnlocked(l.id);
        const isCurrent = next && next.id === l.id;
        const offset = Math.round(Math.sin((li + ui * 2) * 1.1) * 72);
        html += `<div class="node-wrap" style="transform:translateX(${offset}px)">
          ${isCurrent ? '<div class="start-bubble">COMMENCER</div>' : ''}
          <button class="node c-${u.color} ${done ? 'done' : ''} ${isCurrent ? 'current' : ''} ${!unlocked ? 'locked' : ''}" data-lesson="${l.id}" title="${esc(l.title)}">
            <span>${!unlocked ? '🔒' : done ? '✓' : l.icon}</span>
          </button>
          <div class="node-label">${esc(l.title)}</div>
        </div>`;
      });
      const songId = UNIT_SONGS[u.id];
      if (songId) {
        const unitDone = u.lessons.every(l => s.lessons[l.id]?.done);
        const song = Songs.get(songId);
        const st = s.songs[songId]?.stars || 0;
        html += `<div class="node-wrap" style="transform:translateX(${Math.round(Math.sin((u.lessons.length + ui * 2) * 1.1) * 72)}px)">
          <button class="node song-node ${unitDone ? '' : 'locked'} ${st ? 'done' : ''}" data-song="${songId}" title="${esc(song.title)}">
            <span>${unitDone ? '🎵' : '🔒'}</span>
          </button>
          <div class="node-label">🎁 ${esc(song.title)} ${st ? UI.stars(st, true) : ''}</div>
        </div>`;
      }
      html += '</div></section>';
    });
    html += `<div class="path-end">${UI.mascot(next ? 'talk' : 'happy', 90)}<p>${next ? 'D\'autres unités arrivent… en attendant, importe tes propres morceaux MIDI !' : 'Tu as terminé tout le parcours, bravo ! Continue avec tes propres morceaux.'}</p></div>`;
    html += '</div>';
    html += `<aside class="side-col">${sideCards()}</aside></div>`;
    main().innerHTML = html;

    main().querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => lessonPopup(Course.lessonById(b.dataset.lesson)));
    main().querySelectorAll('[data-song]').forEach(b => b.onclick = () => {
      if (b.classList.contains('locked')) { UI.toast('🔒 Termine les leçons de l\'unité pour débloquer ce morceau'); return; }
      openSong(b.dataset.song);
    });
    bindSideCards();
    const cur = main().querySelector('.node.current');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
    const unsub = Input.on('status', () => { const box = main().querySelector('.side-col'); if (box) { box.innerHTML = sideCards(); bindSideCards(); } });
    return unsub;
  }

  function lessonPopup(lesson) {
    const s = S();
    const unlocked = Game.isUnlocked(lesson.id);
    const rec = s.lessons[lesson.id];
    const idx = lesson.unit.lessons.findIndex(l => l.id === lesson.id);
    const m = UI.modal(`
      <div class="lesson-pop c-${lesson.unit.color}">
        <div class="pop-icon">${lesson.icon}</div>
        <div class="unit-kicker">${esc(lesson.unit.title)} · Leçon ${idx + 1}/${lesson.unit.lessons.length}</div>
        <h2>${esc(lesson.title)}</h2>
        ${rec?.done ? `<p class="muted">Terminée ${rec.count} fois · meilleure précision ${rec.best}%</p>` : ''}
        ${unlocked
          ? `<button class="btn primary big pop-start">${rec?.done ? 'Revoir · +10 XP' : 'Commencer · +15 XP'}</button>`
          : '<p class="muted">🔒 Termine la leçon précédente pour débloquer celle-ci.</p><button class="btn ghost pop-start-anyway">Je connais déjà, essayer quand même</button>'}
      </div>`);
    const b = m.el.querySelector('.pop-start') || m.el.querySelector('.pop-start-anyway');
    b.onclick = () => { m.close(); startLesson(lesson); };
  }

  function sideCards() {
    const s = S();
    const today = Game.todayXP();
    const pct = Math.min(100, Math.round(today / s.dailyGoal * 100));
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA');
      days.push({ label: d.toLocaleDateString('fr-FR', { weekday: 'narrow' }), on: (s.xpByDay[key] || 0) > 0, today: i === 0 });
    }
    const st = Input.status;
    const tip = TIPS[new Date().getDate() % TIPS.length];
    const next = Game.nextLesson();
    return `
      ${next ? `<div class="card next-card c-${next.unit.color}">
        <div class="unit-kicker">Prochaine leçon</div>
        <h3>${next.icon} ${esc(next.title)}</h3>
        <button class="btn primary side-next">Continuer</button>
      </div>` : ''}
      <div class="card goal-card">
        <div class="card-head"><h3>🎯 Objectif du jour</h3><span class="muted small">${today}/${s.dailyGoal} XP</span></div>
        <div class="progress big"><div class="progress-bar yellow" style="width:${pct}%"></div></div>
        <p class="muted small">${pct >= 100 ? 'Objectif atteint, bravo ! 🎉' : 'Termine une leçon ou un morceau pour avancer.'}</p>
      </div>
      <div class="card streak-card">
        <div class="card-head"><h3>🔥 ${s.streak} jour${s.streak > 1 ? 's' : ''} de suite</h3><span class="muted small">record ${s.bestStreak}</span></div>
        <div class="week">${days.map(d => `<div class="day ${d.on ? 'on' : ''} ${d.today ? 'today' : ''}"><span>${d.on ? '🔥' : ''}</span><small>${d.label}</small></div>`).join('')}</div>
      </div>
      <div class="card midi-card ${Input.connected ? 'ok' : ''}">
        <h3>${Input.connected ? '🎹 Clavier connecté' : '🔌 Connecte ton CT-S100'}</h3>
        ${Input.connected
          ? `<p class="muted small">${esc(st.devices.join(', '))}<br>Le son vient de ton clavier. Tout est prêt !</p>`
          : `<p class="muted small">${st.error ? esc(st.error) + '<br><br>' : ''}Relie le port USB à l'arrière du piano à ton ordinateur avec un câble USB, allume le piano, puis clique ci-dessous. En attendant, tu peux jouer à la souris ou au clavier d'ordinateur.</p>
             <button class="btn ghost small side-midi">Rechercher le clavier</button>`}
      </div>
      <div class="card tip-card"><h3>💡 Conseil</h3><p class="muted small">${tip}</p></div>`;
  }

  function bindSideCards() {
    const n = main().querySelector('.side-next');
    if (n) n.onclick = () => startLesson(Game.nextLesson());
    const m = main().querySelector('.side-midi');
    if (m) m.onclick = () => { Input.initMidi(); UI.toast('Recherche du clavier…'); };
  }

  // ======================= Vue : Morceaux =======================
  function songCard(song, mine) {
    const rec = S().songs[song.id] || {};
    const notesCount = song.parts.filter(p => !p.isDrum).reduce((a, p) => a + p.notes.length, 0);
    const level = song.level || (notesCount < 150 ? 2 : notesCount < 500 ? 3 : 4);
    const hue = [...song.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return `<div class="song-card" data-id="${esc(song.id)}">
      <div class="song-art" style="--h:${hue}"><span>${mine ? '📂' : '🎼'}</span></div>
      <div class="song-body">
        <b class="song-title">${esc(song.title)}</b>
        <span class="muted small">${esc(song.artist || 'Fichier MIDI')} · ${notesCount} notes</span>
        <div class="song-meta"><span class="level" title="Difficulté">${'●'.repeat(level)}<span class="off">${'●'.repeat(Math.max(0, 4 - level))}</span></span>${UI.stars(rec.stars || 0, true)}</div>
      </div>
      ${mine ? `<button class="icon-btn del" data-del="${esc(song.id)}" title="Supprimer">🗑</button>` : ''}
    </div>`;
  }

  function viewSongs() {
    main().innerHTML = `
      <div class="page">
        <div class="page-head">
          <div><h1>Morceaux</h1><p class="muted">Apprends n'importe quel morceau, partie par partie.</p></div>
          <label class="btn primary upload-btn">⬆ Importer un MIDI<input type="file" accept=".mid,.midi,.kar,.rmi,audio/midi" multiple hidden></label>
        </div>
        <div class="dropzone">
          <div class="dz-icon">🎹</div>
          <div><b>Glisse tes fichiers .mid ici</b><br><span class="muted small">Tu trouveras des milliers de fichiers MIDI gratuits sur Internet (cherche « nom du morceau midi »). Choisis de préférence des versions « piano ».</span></div>
        </div>
        <h2 class="section-title">Mes fichiers MIDI</h2>
        <div class="song-grid mine"><div class="muted">Chargement…</div></div>
        <h2 class="section-title">Bibliothèque</h2>
        <div class="song-grid builtin">${Songs.list.map(s => songCard(s, false)).join('')}</div>
      </div>`;
    const renderMine = () => {
      const grid = main().querySelector('.song-grid.mine');
      if (!grid) return;
      grid.innerHTML = midiSongs.size ? [...midiSongs.values()].map(s => songCard(s, true)).join('')
        : '<p class="muted empty">Aucun fichier importé pour l\'instant. Importe ton premier morceau !</p>';
      bindCards(grid);
    };
    const bindCards = scope => {
      scope.querySelectorAll('.song-card').forEach(c => c.onclick = e => { if (!e.target.closest('.del')) openSong(c.dataset.id); });
      scope.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
        e.stopPropagation();
        const song = midiSongs.get(b.dataset.del);
        if (await UI.confirm('Supprimer ce morceau ?', `« ${esc(song.title)} » sera retiré de ta bibliothèque.`, 'Supprimer')) {
          await Store.midis.remove(song.id);
          midiSongs.delete(song.id);
          delete S().songs[song.id];
          Store.save();
          renderMine();
        }
      });
    };
    bindCards(main().querySelector('.song-grid.builtin'));
    loadMidiLibrary().then(renderMine);
    const input = main().querySelector('input[type=file]');
    input.onchange = async () => { if (await importFiles([...input.files])) renderMine(); input.value = ''; };
    const dz = main().querySelector('.dropzone');
    const page = main().querySelector('.page');
    page.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    page.addEventListener('dragleave', e => { if (!page.contains(e.relatedTarget)) dz.classList.remove('over'); });
    page.addEventListener('drop', async e => {
      e.preventDefault(); dz.classList.remove('over');
      if (await importFiles([...e.dataTransfer.files])) renderMine();
    });
  }

  // ======================= Vue : Jeu libre =======================
  function viewFree() {
    main().innerHTML = `
      <div class="page free">
        <div class="page-head">
          <div><h1>Jeu libre</h1><p class="muted">Joue ce que tu veux : l'app reconnaît les notes et les accords.</p></div>
          <div class="seg labels-seg">
            <button data-l="none">Aucun nom</button><button data-l="c">Do</button><button data-l="names">Notes</button><button data-l="pc">Touches PC</button>
          </div>
        </div>
        <div class="free-display card">
          <div class="fd-notes">—</div>
          <div class="fd-chord muted">Appuie sur des touches…</div>
        </div>
        <div class="free-tools">
          <div class="card tool metro">
            <h3>⏱️ Métronome</h3>
            <div class="metro-beats"></div>
            <div class="speed-row"><input type="range" class="bpm" min="40" max="200" value="80"><b class="bpm-val">80 BPM</b></div>
            <div class="row gap">
              <select class="beats"><option value="2">2 temps</option><option value="3">3 temps</option><option value="4" selected>4 temps</option><option value="6">6 temps</option></select>
              <button class="btn primary small metro-btn">▶ Démarrer</button>
            </div>
          </div>
          <div class="card tool rec">
            <h3>🎙️ Enregistreur</h3>
            <p class="muted small rec-info">Enregistre-toi et réécoute-toi : c'est super pour progresser.</p>
            <div class="row gap">
              <button class="btn danger small rec-btn">● Enregistrer</button>
              <button class="btn ghost small play-btn" disabled>▶ Réécouter</button>
            </div>
          </div>
          <div class="card tool pc">
            <h3>⌨️ Clavier d'ordinateur</h3>
            <p class="muted small">Les touches de la rangée du milieu jouent les notes blanches, celle du dessus les noires.<br>Octave : <b class="pc-oct"></b> (${esc(Input.pcOctaveKeys().down)} / ${esc(Input.pcOctaveKeys().up)} pour changer)</p>
          </div>
        </div>
        <div class="free-piano"></div>
      </div>`;
    const $ = s => main().querySelector(s);
    const piano = new PianoKeyboard($('.free-piano'), { lo: Music.KEYBOARD_LO, hi: Music.KEYBOARD_HI, labels: S().settings.freeLabels || 'c' });
    const segBtns = main().querySelectorAll('.labels-seg button');
    const setLabels = l => { piano.setLabels(l); segBtns.forEach(b => b.classList.toggle('on', b.dataset.l === l)); S().settings.freeLabels = l; Store.save(); };
    segBtns.forEach(b => b.onclick = () => setLabels(b.dataset.l));
    setLabels(S().settings.freeLabels || 'c');

    const updatePc = () => {
      const el = $('.pc-oct');
      if (el) el.textContent = Input.pcOctave === 4 ? 'à partir du Do central' : `${Input.pcOctave > 4 ? '+' : ''}${Input.pcOctave - 4} octave(s) par rapport au Do central`;
    };
    updatePc();

    const display = () => {
      const held = [...Input.held].sort((a, b) => a - b);
      $('.fd-notes').textContent = held.length ? held.map(m => Music.name(m)).join('  ') : '—';
      const ch = Music.chordName(held);
      $('.fd-chord').textContent = ch ? `Accord : ${ch}` : held.length ? '' : 'Appuie sur des touches…';
      $('.fd-chord').classList.toggle('chord', !!ch);
    };

    // enregistreur
    let recording = false, recStart = 0, events = [], playTimers = [];
    const onOn = (m, v) => { display(); if (recording) events.push({ m, v, on: true, t: performance.now() - recStart }); };
    const onOff = m => { display(); if (recording) events.push({ m, on: false, t: performance.now() - recStart }); };
    const u1 = Input.on('noteon', onOn), u2 = Input.on('noteoff', onOff), u3 = Input.on('status', updatePc);
    $('.rec-btn').onclick = () => {
      recording = !recording;
      if (recording) {
        events = []; recStart = performance.now();
        $('.rec-btn').textContent = '■ Arrêter'; $('.rec-info').textContent = '🔴 Enregistrement en cours…';
        $('.play-btn').disabled = true;
      } else {
        $('.rec-btn').textContent = '● Enregistrer';
        const n = events.filter(e => e.on).length;
        $('.rec-info').textContent = n ? `${n} notes enregistrées (${Math.round((events.at(-1)?.t || 0) / 1000)} s).` : 'Rien enregistré.';
        $('.play-btn').disabled = !n;
      }
    };
    $('.play-btn').onclick = () => {
      playTimers.forEach(clearTimeout); playTimers = [];
      const first = events.find(e => e.on)?.t || 0;
      events.forEach(e => {
        if (!e.on) return;
        const off = events.find(x => !x.on && x.m === e.m && x.t > e.t);
        const dur = off ? (off.t - e.t) / 1000 : 0.5;
        playTimers.push(setTimeout(() => { Sound.play(e.m, dur, e.v); piano.flash(e.m, 'demo-R', dur * 1000); }, e.t - first));
      });
    };

    // métronome
    let metroTimer = null, beatIdx = 0, nextTime = 0;
    const beatsSel = $('.beats'), bpmIn = $('.bpm');
    const drawBeats = () => { $('.metro-beats').innerHTML = Array.from({ length: +beatsSel.value }, (_, i) => `<span class="mb ${i === 0 ? 'accent' : ''}"></span>`).join(''); };
    drawBeats();
    beatsSel.onchange = drawBeats;
    bpmIn.oninput = () => { $('.bpm-val').textContent = bpmIn.value + ' BPM'; };
    const schedule = () => {
      Sound.ensure();
      const beat = 60 / +bpmIn.value;
      while (nextTime < Sound.now + 0.12) {
        const idx = beatIdx % +beatsSel.value;
        Sound.fx.clickAt(nextTime, idx === 0);
        const delay = Math.max(0, (nextTime - Sound.now) * 1000);
        setTimeout(() => {
          const dots = main().querySelectorAll('.mb');
          dots.forEach((d, i) => d.classList.toggle('on', i === idx));
        }, delay);
        nextTime += beat; beatIdx++;
      }
    };
    $('.metro-btn').onclick = () => {
      if (metroTimer) { clearInterval(metroTimer); metroTimer = null; $('.metro-btn').textContent = '▶ Démarrer'; main().querySelectorAll('.mb').forEach(d => d.classList.remove('on')); return; }
      Sound.ensure();
      beatIdx = 0; nextTime = Sound.now + 0.05;
      metroTimer = setInterval(schedule, 25);
      $('.metro-btn').textContent = '■ Arrêter';
    };

    return () => { u1(); u2(); u3(); clearInterval(metroTimer); playTimers.forEach(clearTimeout); piano.destroy(); };
  }

  // ======================= Vue : Profil =======================
  function viewProfile() {
    const s = S();
    const lv = Game.level();
    const lessonsDone = Object.values(s.lessons).filter(l => l.done).length;
    const songsDone = Object.values(s.songs).filter(x => x.stars > 0).length;
    const totalStars = Object.values(s.songs).reduce((a, x) => a + (x.stars || 0), 0);
    const mins = Math.round(s.practiceSeconds / 60);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA');
      days.push({ label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), xp: s.xpByDay[key] || 0, today: i === 0 });
    }
    const maxXp = Math.max(s.dailyGoal, ...days.map(d => d.xp));
    main().innerHTML = `
      <div class="page">
        <div class="profile-head card">
          <div class="avatar">${UI.mascot('happy', 96)}</div>
          <div class="ph-info">
            <h1 class="ph-name">${esc(s.name || 'Pianiste')}</h1>
            <p class="muted">Niveau ${lv.level} · ${s.xp} XP</p>
            <div class="progress big"><div class="progress-bar" style="width:${Math.round((s.xp - lv.from) / (lv.to - lv.from) * 100)}%"></div></div>
            <p class="muted small">${lv.to - s.xp} XP avant le niveau ${lv.level + 1}</p>
          </div>
        </div>
        <h2 class="section-title">Statistiques</h2>
        <div class="stat-grid">
          <div class="stat-card"><span>🔥</span><b>${s.streak}</b><small>jours de suite (record ${s.bestStreak})</small></div>
          <div class="stat-card"><span>⚡</span><b>${s.xp}</b><small>XP au total</small></div>
          <div class="stat-card"><span>🎓</span><b>${lessonsDone}/${Course.allLessons.length}</b><small>leçons terminées</small></div>
          <div class="stat-card"><span>🌟</span><b>${totalStars}</b><small>étoiles sur ${songsDone} morceau${songsDone > 1 ? 'x' : ''}</small></div>
          <div class="stat-card"><span>🎹</span><b>${s.notesPlayed.toLocaleString('fr-FR')}</b><small>notes jouées</small></div>
          <div class="stat-card"><span>⏱️</span><b>${mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) : mins + ' min'}</b><small>de pratique</small></div>
        </div>
        <h2 class="section-title">Cette semaine</h2>
        <div class="card week-chart">
          <div class="bars">
            <div class="goal-line" style="bottom:calc(26px + (100% - 46px) * ${s.dailyGoal / maxXp})"><span>objectif</span></div>
            ${days.map(d => `<div class="bar-col ${d.today ? 'today' : ''}"><div class="bar-area"><div class="bar" style="height:${d.xp / maxXp * 100}%"><span>${d.xp || ''}</span></div></div><small>${d.label}</small></div>`).join('')}
          </div>
        </div>
        <h2 class="section-title">Badges · ${Object.keys(s.badges).length}/${Game.BADGES.length}</h2>
        <div class="badge-grid">
          ${Game.BADGES.map(b => `<div class="badge ${s.badges[b.id] ? 'got' : ''}" title="${esc(b.desc)}">
            <div class="badge-icon">${b.icon}</div><b>${esc(b.title)}</b><small>${esc(b.desc)}</small></div>`).join('')}
        </div>
      </div>`;
    main().querySelector('.ph-name').onclick = () => {
      const m = UI.modal(`<h2>Ton prénom</h2><input class="input name-in" maxlength="24" value="${esc(s.name)}" placeholder="Ton prénom"><div class="row gap end"><button class="btn primary ok">Enregistrer</button></div>`);
      const inp = m.el.querySelector('.name-in'); inp.focus();
      m.el.querySelector('.ok').onclick = () => { s.name = inp.value.trim(); Store.save(); m.close(); viewProfile(); };
    };
  }

  // ======================= Vue : Réglages =======================
  function viewSettings() {
    const s = S();
    const seg = (name, value, options) => `<div class="seg" data-setting="${name}">${options.map(([v, l]) => `<button data-v="${v}" class="${String(value) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const st = Input.status;
    main().innerHTML = `
      <div class="page settings">
        <div class="page-head"><div><h1>Réglages</h1></div></div>

        <section class="card">
          <h3>🎹 Clavier MIDI (CT-S100)</h3>
          <div class="midi-status ${Input.connected ? 'ok' : ''}">
            <span class="led"></span>
            ${Input.connected ? `Connecté : <b>${esc(st.devices.join(', '))}</b>` : st.error ? esc(st.error) : 'Aucun clavier détecté'}
          </div>
          <ol class="guide">
            <li>Utilise <b>Google Chrome</b> ou <b>Microsoft Edge</b> (le MIDI ne marche pas dans Firefox/Safari).</li>
            <li>Branche un câble USB entre le <b>port USB à l'arrière du CT-S100</b> et ton ordinateur.</li>
            <li>Allume le piano, puis clique sur « Rechercher ». Accepte l'autorisation MIDI si le navigateur la demande.</li>
            <li>Joue une note : la touche doit s'allumer à l'écran ci-dessous.</li>
          </ol>
          <div class="row gap"><button class="btn primary small rescan">🔄 Rechercher le clavier</button></div>
          <div class="test-piano"></div>
        </section>

        <section class="card">
          <h3>🔊 Son</h3>
          <div class="setting-row"><div><b>Son de l'app quand tu joues</b><p class="muted small">En automatique, l'app se tait quand ton CT-S100 est branché (il a ses propres haut-parleurs).</p></div>
            ${seg('soundMode', s.settings.soundMode, [['auto', 'Auto'], ['on', 'Toujours'], ['off', 'Jamais']])}</div>
          <div class="setting-row"><div><b>Volume de l'app</b></div>
            <div class="row gap"><input type="range" class="vol" min="0" max="1" step="0.05" value="${s.settings.volume}"><button class="btn ghost small test-sound">🔊 Tester</button></div></div>
        </section>

        <section class="card">
          <h3>🎼 Affichage</h3>
          <div class="setting-row"><div><b>Nom des notes</b></div>${seg('notation', s.settings.notation, [['latin', 'Do Ré Mi'], ['english', 'C D E']])}</div>
          <div class="setting-row"><div><b>Repères sur le clavier (morceaux)</b></div>${seg('keyLabels', s.settings.keyLabels, [['none', 'Aucun'], ['c', 'Les Do']])}</div>
        </section>

        <section class="card">
          <h3>🎯 Objectif quotidien</h3>
          <div class="setting-row"><div><b>XP par jour</b><p class="muted small">Une leçon rapporte environ 15 XP.</p></div>
            ${seg('dailyGoal', s.dailyGoal, [[10, 'Détente · 10'], [20, 'Normal · 20'], [30, 'Sérieux · 30'], [50, 'Intense · 50']])}</div>
        </section>

        <section class="card danger-zone">
          <h3>⚠️ Zone dangereuse</h3>
          <div class="setting-row"><div><b>Réinitialiser la progression</b><p class="muted small">Efface XP, série, leçons et badges (tes fichiers MIDI sont conservés).</p></div>
            <button class="btn danger small reset">Réinitialiser</button></div>
        </section>
        <p class="muted small center">Clavio · tes données restent sur cet ordinateur, dans ce navigateur.</p>
      </div>`;
    const $ = q => main().querySelector(q);
    const piano = new PianoKeyboard($('.test-piano'), { lo: Music.KEYBOARD_LO, hi: Music.KEYBOARD_HI, labels: 'c' });
    main().querySelectorAll('.seg[data-setting]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = g.dataset.setting, v = b.dataset.v;
      if (k === 'dailyGoal') s.dailyGoal = parseInt(v, 10); else s.settings[k] = v;
      applySettings(); Store.save();
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (k === 'notation') piano.renderLabels();
    }));
    $('.vol').oninput = e => { s.settings.volume = parseFloat(e.target.value); applySettings(); Store.save(); };
    $('.test-sound').onclick = () => Sound.playSequence([[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]], 0.4);
    $('.rescan').onclick = () => { Input.initMidi(); UI.toast('Recherche du clavier…'); };
    $('.reset').onclick = async () => {
      if (await UI.confirm('Tout réinitialiser ?', 'Ta progression sera définitivement effacée.', 'Tout effacer')) {
        Store.reset(); applySettings(); renderTopbar(); UI.toast('Progression réinitialisée'); go('learn');
      }
    };
    const unsub = Input.on('status', () => {
      if (location.hash === '#settings' && !document.getElementById('app').classList.contains('hidden')) {
        piano.destroy(); unsub(); viewCleanup = viewSettings();
      }
    });
    return () => { unsub(); piano.destroy(); };
  }

  // ======================= Accueil (premier lancement) =======================
  function onboarding() {
    const s = S();
    let step = 0;
    const m = UI.modal('<div class="onb"></div>', { wide: true, persistent: true });
    const box = m.el.querySelector('.onb');
    let unsub = null;
    const render = () => {
      if (unsub) { unsub(); unsub = null; }
      if (step === 0) {
        box.innerHTML = `${UI.mascot('talk', 120)}
          <h1>Salut, moi c'est Clavi !</h1>
          <p class="muted">Je vais t'apprendre le piano, quelques minutes par jour, de tes premières notes jusqu'à tes morceaux préférés.</p>
          <input class="input onb-name" maxlength="24" placeholder="Comment tu t'appelles ?" value="${esc(s.name)}">
          <button class="btn primary big onb-next">C'est parti !</button>`;
        box.querySelector('.onb-name').focus();
        box.querySelector('.onb-next').onclick = () => { s.name = box.querySelector('.onb-name').value.trim(); step++; render(); };
      } else if (step === 1) {
        box.innerHTML = `${UI.mascot('happy', 100)}
          <h1>Ton objectif quotidien</h1>
          <p class="muted">Le secret, c'est la régularité. Choisis un rythme facile à tenir.</p>
          <div class="goal-choices">
            ${[[10, '☕ Détente', '5 min / jour'], [20, '🙂 Normal', '10 min / jour'], [30, '💪 Sérieux', '15 min / jour'], [50, '🔥 Intense', '25 min / jour']].map(([v, l, d]) =>
              `<button class="goal-choice ${s.dailyGoal === v ? 'on' : ''}" data-v="${v}"><b>${l}</b><span>${d}</span></button>`).join('')}
          </div>
          <button class="btn primary big onb-next">Continuer</button>`;
        box.querySelectorAll('.goal-choice').forEach(b => b.onclick = () => { s.dailyGoal = +b.dataset.v; box.querySelectorAll('.goal-choice').forEach(x => x.classList.toggle('on', x === b)); });
        box.querySelector('.onb-next').onclick = () => { step++; render(); };
      } else {
        box.innerHTML = `
          <h1>Branche ton CT-S100</h1>
          <ol class="guide">
            <li>Relie le <b>port USB</b> à l'arrière du piano à ton ordinateur avec un câble USB.</li>
            <li>Allume le piano.</li>
            <li>Accepte l'accès MIDI si le navigateur le demande.</li>
          </ol>
          <div class="onb-detect"><div class="detect-icon">🎹</div><div class="detect-text">${Input.connected ? `<b>${esc(Input.status.devices[0])}</b> détecté ! Appuie sur une touche…` : 'En attente du clavier…'}</div></div>
          <div class="row gap center wrap">
            <button class="btn ghost onb-rescan">🔄 Rechercher</button>
            <button class="btn primary big onb-done">${Input.connected ? 'Commencer !' : 'Plus tard, je joue à la souris'}</button>
          </div>
          <p class="muted small">Pas de câble sous la main ? Tu peux jouer avec la souris ou le clavier de l'ordinateur.</p>`;
        const det = box.querySelector('.onb-detect');
        const u1 = Input.on('noteon', (mi, v, src) => {
          det.classList.add('ok');
          det.querySelector('.detect-text').innerHTML = `${src === 'midi' ? '✅ Ça marche !' : '✅ Note reçue !'} Tu as joué <b>${Music.name(mi)}</b>`;
          box.querySelector('.onb-done').textContent = 'Commencer !';
        });
        const u2 = Input.on('status', () => { if (step === 2 && !det.classList.contains('ok')) render(); });
        unsub = () => { u1(); u2(); };
        box.querySelector('.onb-rescan').onclick = () => Input.initMidi();
        box.querySelector('.onb-done').onclick = () => {
          unsub(); unsub = null;
          s.onboarded = true; Store.save(); m.close(); renderTopbar(); go('learn');
        };
      }
    };
    render();
  }

  function applySettings() {
    const st = S().settings;
    Music.notation = st.notation;
    Input.soundMode = st.soundMode;
    Sound.volume = st.volume;
  }

  function init() {
    applySettings();
    Game.setToast(UI.toast);
    Game.onChange(renderTopbar);
    Input.on('status', renderTopbar);
    let wasConnected = false;
    Input.on('status', st => {
      if (st.devices.length && !wasConnected) UI.toast(`🎹 <b>${esc(st.devices[0])}</b> connecté !`);
      else if (!st.devices.length && wasConnected) UI.toast('🔌 Clavier déconnecté', 'error');
      wasConnected = st.devices.length > 0;
    });
    document.querySelectorAll('.nav-item').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.view); });
    renderTopbar();
    Input.initMidi();
    // Le son ne peut démarrer qu'après une interaction
    const unlock = () => { Sound.ensure(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    Input.on('noteon', () => Sound.ensure());
    loadMidiLibrary();
    go(location.hash.slice(1) || 'learn');
    if (!S().onboarded) onboarding();
  }

  return { init, go };
})();

document.addEventListener('DOMContentLoaded', App.init);
