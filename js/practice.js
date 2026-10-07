// Mode Morceaux : notes qui tombent, apprentissage pas à pas, mode rythme, écoute.
const Practice = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PALETTE = ['#1cb0f6', '#ff9600', '#ce82ff', '#58cc02', '#ff4b4b', '#ffc800', '#2bd9c5', '#ff86d0'];
  const HAND_COLOR = { R: '#1cb0f6', L: '#ff9600' };
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // Parties effectives du morceau (avec séparation des mains éventuelle)
  function effectiveParts(song, split) {
    const playable = song.parts.filter(p => !p.isDrum);
    if (split && playable.length >= 1) {
      const out = [];
      song.parts.forEach(p => {
        if (p.isDrum || p !== playable[0]) { out.push(p); return; }
        out.push({ ...p, id: p.id + ':R', name: 'Main droite', hand: 'R', notes: p.notes.filter(n => n.midi >= 60) });
        out.push({ ...p, id: p.id + ':L', name: 'Main gauche', hand: 'L', notes: p.notes.filter(n => n.midi < 60) });
      });
      return out.filter(p => p.notes.length);
    }
    return song.parts;
  }

  function defaultConfig(song) {
    const parts = song.parts;
    const roles = {};
    if (song.source === 'builtin') {
      parts.forEach(p => { roles[p.id] = p.hand === 'R' ? 'play' : 'accomp'; });
    } else {
      const main = parts.filter(p => !p.isDrum).sort((a, b) => b.notes.length - a.notes.length)[0];
      parts.forEach(p => { roles[p.id] = p === main ? 'play' : p.isDrum ? 'mute' : 'accomp'; });
    }
    return { mode: 'wait', speed: Store.state.settings.speed || 0.6, roles, split: false, section: null, showNames: true, loop: false };
  }

  // Regroupe les notes à jouer en "étapes" (notes simultanées)
  function buildSteps(playNotes) {
    const steps = [];
    playNotes.forEach(n => {
      const last = steps[steps.length - 1];
      if (last && n.time - last.time < 0.04) last.notes.push(n);
      else steps.push({ time: n.time, notes: [n] });
    });
    return steps;
  }

  function computeSections(song, playNotes) {
    if (!playNotes.length) return [];
    const end = Math.max(...playNotes.map(n => n.time + n.dur)) + 0.01;
    let bounds = [];
    if (song.bars && song.bars.length > 2) {
      const bars = song.bars;
      for (let i = 0; i < bars.length; i += 4) bounds.push(bars[i]);
    } else {
      const steps = buildSteps(playNotes);
      for (let i = 0; i < steps.length; i += 16) bounds.push(steps[i].time - 0.01);
    }
    bounds[0] = Math.min(bounds[0], playNotes[0].time - 0.01);
    bounds.push(end);
    let sections = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const from = bounds[i], to = bounds[i + 1];
      const count = playNotes.filter(n => n.time >= from && n.time < to).length;
      if (count > 0) sections.push({ from, to, count });
    }
    // fusionne les toutes petites sections
    const merged = [];
    sections.forEach(s => {
      const prev = merged[merged.length - 1];
      if (prev && (s.count < 4 || prev.count < 4)) { prev.to = s.to; prev.count += s.count; }
      else merged.push({ ...s });
    });
    return merged;
  }

  function prepareNotes(song, config) {
    const parts = effectiveParts(song, config.split);
    const notes = [];
    let shifted = 0;
    parts.forEach((p, pi) => {
      const role = config.roles[p.id] || 'accomp';
      if (role === 'mute' || p.isDrum && role !== 'accomp') return;
      const color = p.hand && parts.filter(x => !x.isDrum).length <= 2 ? HAND_COLOR[p.hand] : PALETTE[pi % PALETTE.length];
      p.notes.forEach(n => {
        let midi = n.midi;
        if (role === 'play') {
          while (midi < Music.KEYBOARD_LO) { midi += 12; shifted++; }
          while (midi > Music.KEYBOARD_HI) { midi -= 12; shifted++; }
        }
        notes.push({ midi, time: n.time, dur: n.dur, vel: n.vel ?? 0.7, role, hand: p.hand, color, drum: p.isDrum, state: '' });
      });
    });
    notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
    return { notes, parts, shifted };
  }

  // ======================= Écran de réglages =======================
  function openSetup(song, root, onExit) {
    const saved = Store.state.songs[song.id]?.config;
    const config = saved ? { ...defaultConfig(song), ...saved, roles: { ...defaultConfig(song).roles, ...saved.roles } } : defaultConfig(song);
    const playableCount = song.parts.filter(p => !p.isDrum).length;
    const canSplit = playableCount === 1 && (() => {
      const ns = song.parts.find(p => !p.isDrum).notes;
      return ns.some(n => n.midi < 57) && ns.some(n => n.midi >= 62);
    })();

    function render() {
      const parts = effectiveParts(song, config.split);
      parts.forEach(p => { if (!config.roles[p.id]) config.roles[p.id] = p.hand === 'R' || !config.split ? 'play' : 'accomp'; });
      const { notes, shifted } = prepareNotes(song, config);
      const playNotes = notes.filter(n => n.role === 'play');
      const sections = computeSections(song, playNotes);
      if (config.section != null && config.section >= sections.length) config.section = null;
      const rec = Store.state.songs[song.id] || { sections: {} };
      const dur = Math.max(...song.parts.flatMap(p => p.notes.map(n => n.time + n.dur)));

      root.innerHTML = `
        <div class="setup">
          <div class="setup-head">
            <button class="icon-btn back">←</button>
            <div>
              <h1>${esc(song.title)}</h1>
              <p class="muted">${esc(song.artist || (song.source === 'midi' ? 'Fichier MIDI importé' : ''))} · ${fmtTime(dur)} · ${playNotes.length} notes à jouer</p>
            </div>
            <div class="setup-stars">${UI.stars(rec.stars || 0)}</div>
          </div>

          <section class="card">
            <h3>1. Qui joue quoi ?</h3>
            ${canSplit ? `<label class="toggle-row"><input type="checkbox" class="split" ${config.split ? 'checked' : ''}><span class="switch"></span> Séparer en <b>main droite</b> / <b>main gauche</b> (autour du Do central)</label>` : ''}
            <div class="parts">
              ${parts.map((p, i) => {
                const color = p.hand && parts.filter(x => !x.isDrum).length <= 2 ? HAND_COLOR[p.hand] : PALETTE[i % PALETTE.length];
                const role = config.roles[p.id];
                return `<div class="part-row">
                  <span class="part-dot" style="background:${color}"></span>
                  <div class="part-info"><b>${esc(p.name)}</b><span class="muted small">${p.notes.length} notes${p.isDrum ? ' · batterie' : ` · ${Music.name(Math.min(...p.notes.map(n => n.midi)), true)}–${Music.name(Math.max(...p.notes.map(n => n.midi)), true)}`}</span></div>
                  <div class="seg" data-part="${esc(p.id)}">
                    ${p.isDrum ? '' : `<button data-role="play" class="${role === 'play' ? 'on' : ''}">🎹 Je joue</button>`}
                    <button data-role="accomp" class="${role === 'accomp' ? 'on' : ''}">🔊 L'app</button>
                    <button data-role="mute" class="${role === 'mute' ? 'on' : ''}">🔇 Muet</button>
                  </div>
                </div>`;
              }).join('')}
            </div>
            ${shifted ? `<p class="muted small">ℹ️ ${shifted} notes dépassaient les 61 touches du CT-S100 : elles ont été déplacées d'une octave.</p>` : ''}
            ${!playNotes.length ? '<p class="warn">Choisis au moins une partie « Je joue » (ou passe en mode Écouter).</p>' : ''}
          </section>

          <section class="card">
            <h3>2. Mode</h3>
            <div class="modes">
              <button class="mode ${config.mode === 'wait' ? 'on' : ''}" data-mode="wait"><span class="mode-icon">🐢</span><b>Pas à pas</b><span>La musique t'attend jusqu'à ce que tu joues la bonne note.</span></button>
              <button class="mode ${config.mode === 'rhythm' ? 'on' : ''}" data-mode="rhythm"><span class="mode-icon">🎯</span><b>En rythme</b><span>La musique avance : joue au bon moment.</span></button>
              <button class="mode ${config.mode === 'listen' ? 'on' : ''}" data-mode="listen"><span class="mode-icon">👂</span><b>Écouter</b><span>Regarde et écoute le morceau d'abord.</span></button>
            </div>
            <div class="speed-row">
              <span>Vitesse</span>
              <input type="range" class="speed" min="0.2" max="1.5" step="0.05" value="${config.speed}">
              <b class="speed-val">${Math.round(config.speed * 100)}%</b>
            </div>
          </section>

          <section class="card">
            <h3>3. Apprendre partie par partie</h3>
            <p class="muted small">Le secret des pianistes : on apprend un petit bout à la fois. Maîtrise chaque partie (3 étoiles), puis enchaîne le morceau entier.</p>
            <div class="sections">
              ${sections.map((s, i) => `<button class="section-chip ${config.section === i ? 'on' : ''}" data-sec="${i}">
                  <span>Partie ${i + 1}</span><span class="chip-stars">${UI.stars(rec.sections?.[i] || 0, true)}</span></button>`).join('')}
              <button class="section-chip whole ${config.section == null ? 'on' : ''}" data-sec="all"><span>🎼 Morceau entier</span><span class="chip-stars">${UI.stars(rec.stars || 0, true)}</span></button>
            </div>
            <div class="opts">
              <label class="toggle-row"><input type="checkbox" class="names" ${config.showNames ? 'checked' : ''}><span class="switch"></span> Noms des notes sur les notes qui tombent</label>
              <label class="toggle-row"><input type="checkbox" class="loop" ${config.loop ? 'checked' : ''}><span class="switch"></span> Répéter en boucle</label>
            </div>
          </section>

          <div class="setup-go">
            <button class="btn primary big go" ${!playNotes.length && config.mode !== 'listen' ? 'disabled' : ''}>C'est parti ! 🎹</button>
          </div>
        </div>`;

      const $ = s => root.querySelector(s);
      $('.back').onclick = () => onExit();
      const split = $('.split');
      if (split) split.onchange = () => { config.split = split.checked; config.section = null; render(); };
      root.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => {
        b.onclick = () => { config.roles[seg.dataset.part] = b.dataset.role; config.section = null; render(); };
      }));
      root.querySelectorAll('.mode').forEach(b => b.onclick = () => { config.mode = b.dataset.mode; render(); });
      const speed = $('.speed');
      speed.oninput = () => { config.speed = parseFloat(speed.value); $('.speed-val').textContent = Math.round(config.speed * 100) + '%'; };
      root.querySelectorAll('.section-chip').forEach(b => b.onclick = () => {
        config.section = b.dataset.sec === 'all' ? null : parseInt(b.dataset.sec, 10);
        root.querySelectorAll('.section-chip').forEach(x => x.classList.toggle('on', x === b));
      });
      $('.names').onchange = e => { config.showNames = e.target.checked; };
      $('.loop').onchange = e => { config.loop = e.target.checked; };
      $('.go').onclick = () => {
        saveConfig();
        play(song, config, sections, root, () => openSetup(song, root, onExit), onExit);
      };
    }

    function saveConfig() {
      const s = Store.state;
      s.songs[song.id] = { stars: 0, best: 0, sections: {}, ...(s.songs[song.id] || {}), config: { ...config } };
      s.settings.speed = config.speed;
      Store.save();
    }

    render();
  }

  // ======================= Lecture / jeu =======================
  function play(song, config, sections, root, backToSetup, exitAll) {
    const { notes: allNotes } = prepareNotes(song, config);
    const section = config.section != null ? sections[config.section] : null;
    const notes = section ? allNotes.filter(n => n.time >= section.from && n.time < section.to) : allNotes;
    if (!notes.length) { backToSetup(); return; }
    const mode = config.mode;
    let speed = config.speed;
    const playNotes = mode === 'listen' ? [] : notes.filter(n => n.role === 'play');
    const accNotes = mode === 'listen' ? notes : notes.filter(n => n.role === 'accomp');
    const steps = buildSteps(playNotes);
    steps.forEach(s => { s.pending = new Set(s.notes.map(n => n.midi)); s.err = false; s.done = false; });

    const firstT = notes[0].time;
    const endT = Math.max(...notes.map(n => n.time + n.dur));
    const visibleMidis = notes.filter(n => !n.drum && n.midi >= Music.KEYBOARD_LO && n.midi <= Music.KEYBOARD_HI).map(n => n.midi);
    const [lo, hi] = Music.fitRange(visibleMidis.length ? visibleMidis : [60], 2);

    const sectionLabel = section ? `Partie ${config.section + 1}/${sections.length}` : 'Morceau entier';
    const modeLabel = { wait: '🐢 Pas à pas', rhythm: '🎯 En rythme', listen: '👂 Écoute' }[mode];

    root.innerHTML = `
      <div class="practice">
        <header class="pr-top">
          <button class="icon-btn pr-back" title="Réglages (Échap)">←</button>
          <div class="pr-title"><b>${esc(song.title)}</b><span class="muted small">${sectionLabel} · ${modeLabel}</span></div>
          <div class="pr-progress"><div class="progress"><div class="progress-bar"></div></div><span class="pr-time muted small"></span></div>
          <div class="pr-stats">
            ${mode !== 'listen' ? '<span class="pill green pr-acc">🎯 100%</span><span class="pill orange pr-combo">🔥 0</span>' : ''}
          </div>
          <div class="pr-controls">
            <button class="icon-btn pr-slower" title="Plus lent">−</button>
            <span class="pr-speed">${Math.round(speed * 100)}%</span>
            <button class="icon-btn pr-faster" title="Plus rapide">+</button>
            <button class="icon-btn pr-restart" title="Recommencer (R)">↻</button>
            <button class="icon-btn pr-pause" title="Pause (Espace)">⏸</button>
          </div>
        </header>
        <div class="pr-stage">
          <canvas></canvas>
          <div class="pr-overlay hidden"></div>
          <div class="pr-hint"></div>
        </div>
        <div class="pr-piano"></div>
      </div>`;

    const $ = s => root.querySelector(s);
    const canvas = $('canvas');
    const ctx2d = canvas.getContext('2d');
    const stage = $('.pr-stage');
    const overlay = $('.pr-overlay');
    const hintEl = $('.pr-hint');
    const piano = new PianoKeyboard($('.pr-piano'), { lo, hi, labels: Store.state.settings.keyLabels === 'none' ? 'none' : 'c' });
    const { keys: layoutKeys } = Music.layout(lo, hi);

    let t, si, waiting, paused, finished, accIdx, raf, last;
    let wrong, clean, combo, bestCombo, perfect, good, missed;
    let markedStep = -1;
    const tol = () => 0.2 * speed;
    const lookahead = () => 2.4 * speed;

    function reset() {
      t = firstT - (mode === 'wait' ? 1.2 : 2.5) * speed;
      si = 0; waiting = false; paused = false; finished = false; accIdx = 0;
      wrong = 0; clean = 0; combo = 0; bestCombo = 0; perfect = 0; good = 0; missed = 0;
      notes.forEach(n => { n.state = ''; });
      steps.forEach(s => { s.pending = new Set(s.notes.map(n => n.midi)); s.err = false; s.done = false; });
      markedStep = -1;
      piano.clear();
      overlay.classList.add('hidden');
      hintEl.textContent = mode === 'wait' ? 'Joue les notes quand elles touchent la ligne — la musique t\'attend.' : mode === 'rhythm' ? 'Prépare-toi…' : '';
      setTimeout(() => { if (hintEl) hintEl.textContent = ''; }, 3500);
      updateStats();
      last = performance.now();
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const r = stage.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    function updateStats() {
      if (mode === 'listen') return;
      const acc = $('.pr-acc'), cb = $('.pr-combo');
      if (acc) acc.textContent = `🎯 ${accuracy()}%`;
      if (cb) cb.textContent = `🔥 ${combo}`;
    }

    function accuracy() {
      if (mode === 'wait') {
        const doneSteps = steps.filter(s => s.done).length;
        if (!doneSteps) return 100;
        return Math.round(100 * clean / doneSteps);
      }
      const judged = perfect + good + missed;
      if (!judged && !wrong) return 100;
      return Math.max(0, Math.round(100 * (perfect + good * 0.75) / Math.max(1, judged + wrong * 0.5)));
    }

    function markCurrentStep() {
      // surligne les touches à jouer
      let target = -1;
      if (mode === 'wait') target = si < steps.length ? si : -1;
      else if (mode === 'rhythm') {
        let j = si;
        while (j < steps.length && steps[j].done) j++;
        target = j < steps.length && steps[j].time - t < 0.5 * speed ? j : -1;
      }
      if (target === markedStep) return;
      piano.clear('target-R'); piano.clear('target-L'); piano.clear('target-X');
      markedStep = target;
      if (target < 0) return;
      steps[target].notes.forEach(n => {
        if (steps[target].pending.has(n.midi)) piano.mark(n.midi, 'target-' + (n.hand === 'L' ? 'L' : n.hand === 'R' ? 'R' : 'X'));
      });
    }

    function completeStep(step) {
      step.done = true;
      if (!step.err) { clean++; combo++; bestCombo = Math.max(bestCombo, combo); }
      if (step === steps[si]) si++;
      while (si < steps.length && steps[si].done) si++;
      waiting = false;
      updateStats();
      markCurrentStep();
    }

    const unsubNote = Input.on('noteon', m => {
      if (paused || finished || mode === 'listen') return;
      if (mode === 'wait') {
        const step = steps[si];
        if (!step) return;
        if (step.pending.has(m)) {
          // joué en avance : la musique rattrape le joueur
          if (t < step.time) t = step.time;
          step.pending.delete(m);
          step.notes.forEach(n => { if (n.midi === m) n.state = 'hit'; });
          piano.flash(m, 'good');
          piano.unmark(m, 'target-R'); piano.unmark(m, 'target-L'); piano.unmark(m, 'target-X');
          if (!step.pending.size) completeStep(step);
        } else if (!step.notes.some(n => n.midi === m)) {
          wrong++; step.err = true; combo = 0;
          piano.flash(m, 'bad');
          updateStats();
        }
      } else if (mode === 'rhythm') {
        let hit = false;
        for (let j = si; j < steps.length && steps[j].time <= t + tol(); j++) {
          const s = steps[j];
          if (s.pending.has(m) && Math.abs(s.time - t) <= tol()) {
            s.pending.delete(m);
            const dt = Math.abs(s.time - t) / speed;
            const q = dt < 0.08 ? 'perfect' : 'good';
            if (q === 'perfect') perfect++; else good++;
            s.notes.forEach(n => { if (n.midi === m) n.state = 'hit'; });
            piano.flash(m, 'good');
            piano.unmark(m, 'target-R'); piano.unmark(m, 'target-L'); piano.unmark(m, 'target-X');
            combo++; bestCombo = Math.max(bestCombo, combo);
            showJudgement(q === 'perfect' ? 'Parfait !' : 'Bien', q);
            if (!s.pending.size) { s.done = true; while (si < steps.length && steps[si].done) si++; }
            hit = true;
            break;
          }
        }
        if (!hit) { wrong++; combo = 0; piano.flash(m, 'bad'); }
        updateStats();
        markCurrentStep();
      }
    });

    let judgeTimer;
    function showJudgement(text, cls) {
      hintEl.className = 'pr-hint judge ' + cls;
      hintEl.textContent = text;
      clearTimeout(judgeTimer);
      judgeTimer = setTimeout(() => { hintEl.className = 'pr-hint'; hintEl.textContent = ''; }, 500);
    }

    function frame(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused && !finished) {
        let nt = t + dt * speed;
        if (mode === 'wait' && si < steps.length && nt >= steps[si].time) { nt = steps[si].time; waiting = true; }
        // accompagnement (et toutes les notes en mode écoute)
        const limit = waiting ? steps[si].time - 0.035 : nt;
        while (accIdx < accNotes.length && accNotes[accIdx].time <= limit) {
          const n = accNotes[accIdx];
          if (!n.drum) {
            Sound.play(n.midi, n.dur / speed, n.vel * (n.role === 'accomp' && mode !== 'listen' ? 0.6 : 0.8));
            if (layoutKeys.has(n.midi)) piano.flash(n.midi, n.role === 'play' ? 'demo-' + (n.hand === 'L' ? 'L' : 'R') : 'accomp', Math.max(120, n.dur / speed * 1000));
            if (mode === 'listen') n.state = 'hit';
          }
          accIdx++;
        }
        // notes ratées en mode rythme
        if (mode === 'rhythm') {
          while (si < steps.length && (steps[si].done || steps[si].time + tol() < nt)) {
            const s = steps[si];
            if (!s.done) {
              s.notes.forEach(n => { if (s.pending.has(n.midi)) { n.state = 'miss'; missed++; } });
              s.pending.clear(); s.done = true; combo = 0;
              updateStats();
            }
            si++;
          }
        }
        t = nt;
        markCurrentStep();
        if (si >= steps.length && t >= endT + 0.3) finish();
      }
      draw();
      updateProgress();
      raf = requestAnimationFrame(frame);
    }

    function updateProgress() {
      const p = Math.min(1, Math.max(0, (t - firstT) / (endT - firstT)));
      $('.progress-bar').style.width = (p * 100) + '%';
      $('.pr-time').textContent = `${fmtTime(Math.min(endT - firstT, Math.max(0, t - firstT)))} / ${fmtTime(endT - firstT)}`;
    }

    function roundRect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx2d.beginPath();
      ctx2d.moveTo(x + r, y);
      ctx2d.arcTo(x + w, y, x + w, y + h, r);
      ctx2d.arcTo(x + w, y + h, x, y + h, r);
      ctx2d.arcTo(x, y + h, x, y, r);
      ctx2d.arcTo(x, y, x + w, y, r);
      ctx2d.closePath();
    }

    function draw() {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const hitY = H - 4;
      const pps = H / lookahead();
      ctx2d.clearRect(0, 0, W, H);

      // couloirs des touches noires + séparations d'octave
      for (const [m, k] of layoutKeys) {
        if (k.black) { ctx2d.fillStyle = 'rgba(0,0,0,0.18)'; ctx2d.fillRect(k.x * W, 0, k.w * W, H); }
        else if (Music.pc(m) === 0) { ctx2d.fillStyle = 'rgba(255,255,255,0.07)'; ctx2d.fillRect(k.x * W, 0, 1, H); }
      }
      // barres de mesure
      if (song.bars) {
        ctx2d.font = '600 11px Nunito, sans-serif';
        song.bars.forEach((b, i) => {
          const y = hitY - (b - t) * pps;
          if (y < -10 || y > H) return;
          ctx2d.fillStyle = 'rgba(255,255,255,0.08)';
          ctx2d.fillRect(0, y, W, 1);
          ctx2d.fillStyle = 'rgba(255,255,255,0.25)';
          ctx2d.fillText(String(i + 1), 6, y - 4);
        });
      }

      const curStep = mode === 'wait' ? steps[si] : null;
      for (const n of notes) {
        if (n.drum) continue;
        const y2 = hitY - (n.time - t) * pps;
        if (y2 < -20) break;
        const y1 = y2 - Math.max(n.dur * pps, 10);
        if (y1 > H) continue;
        const k = layoutKeys.get(n.midi);
        if (!k) continue;
        const pad = k.black ? 1 : 2;
        const x = k.x * W + pad, w = k.w * W - pad * 2;
        let color = n.color;
        let alpha = n.role === 'accomp' && mode !== 'listen' ? 0.28 : 1;
        if (n.state === 'hit') color = '#58cc02';
        else if (n.state === 'miss') color = '#ff4b4b';
        ctx2d.globalAlpha = alpha * (n.state === 'hit' && y2 > hitY + 2 ? 0.55 : 1);
        roundRect(x, y1, w, y2 - y1, 6);
        ctx2d.fillStyle = color;
        ctx2d.fill();
        if (curStep && curStep.notes.includes(n) && n.state !== 'hit') {
          ctx2d.lineWidth = 3;
          ctx2d.strokeStyle = '#fff';
          ctx2d.shadowColor = color; ctx2d.shadowBlur = 16;
          ctx2d.stroke();
          ctx2d.shadowBlur = 0;
        } else {
          ctx2d.fillStyle = 'rgba(255,255,255,0.18)';
          ctx2d.fillRect(x + 3, y1 + 2, Math.max(0, w - 6), 2);
        }
        if (config.showNames && n.role === 'play' && w > 13 && y2 - y1 > 16) {
          ctx2d.fillStyle = 'rgba(0,0,0,0.65)';
          ctx2d.font = `800 ${Math.min(13, Math.max(9, w * 0.42))}px Nunito, sans-serif`;
          ctx2d.textAlign = 'center';
          ctx2d.fillText(Music.name(n.midi).replace('♯', '#'), x + w / 2, y2 - 6);
          ctx2d.textAlign = 'left';
        }
        ctx2d.globalAlpha = 1;
      }

      // ligne de frappe
      const g = ctx2d.createLinearGradient(0, hitY - 18, 0, hitY + 2);
      g.addColorStop(0, 'rgba(28,176,246,0)');
      g.addColorStop(1, waiting ? 'rgba(255,200,0,0.55)' : 'rgba(28,176,246,0.45)');
      ctx2d.fillStyle = g;
      ctx2d.fillRect(0, hitY - 18, W, 20);
      ctx2d.fillStyle = waiting ? '#ffc800' : '#1cb0f6';
      ctx2d.fillRect(0, hitY - 1, W, 3);
    }

    function setPaused(p) {
      if (finished) return;
      paused = p;
      $('.pr-pause').textContent = p ? '▶' : '⏸';
      if (p) {
        overlay.classList.remove('hidden');
        overlay.innerHTML = `<div class="pause-card">
          <h2>⏸ Pause</h2>
          <button class="btn primary big ov-resume">Reprendre</button>
          <button class="btn ghost ov-restart">↻ Recommencer</button>
          <button class="btn ghost ov-setup">⚙️ Réglages du morceau</button>
        </div>`;
        overlay.querySelector('.ov-resume').onclick = () => setPaused(false);
        overlay.querySelector('.ov-restart').onclick = () => reset();
        overlay.querySelector('.ov-setup').onclick = () => { teardown(); backToSetup(); };
      } else {
        overlay.classList.add('hidden');
        last = performance.now();
      }
    }

    function finish() {
      finished = true;
      piano.clear();
      if (mode === 'listen') {
        if (config.loop) { setTimeout(reset, 800); return; }
        overlay.classList.remove('hidden');
        overlay.innerHTML = `<div class="pause-card">
          ${UI.mascot('happy', 90)}
          <h2>Écoute terminée</h2>
          <p class="muted">Prêt à le jouer toi-même ?</p>
          <button class="btn primary big ov-wait">🐢 Jouer pas à pas</button>
          <button class="btn ghost ov-again">↻ Réécouter</button>
          <button class="btn ghost ov-setup">⚙️ Réglages</button>
        </div>`;
        overlay.querySelector('.ov-wait').onclick = () => { teardown(); config.mode = 'wait'; play(song, config, sections, root, backToSetup, exitAll); };
        overlay.querySelector('.ov-again').onclick = () => reset();
        overlay.querySelector('.ov-setup').onclick = () => { teardown(); backToSetup(); };
        return;
      }
      const acc = accuracy();
      let stars = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 40 ? 1 : 0;
      if (mode === 'wait' && stars === 0) stars = 1;
      if (mode === 'wait' && speed < 0.5 && stars === 3) stars = 2; // 3 étoiles : au moins 50 % de vitesse
      const xp = Game.completeSong(song.id, section ? config.section : null, stars, acc, playNotes.length);
      Sound.fx.complete();
      if (stars === 3) UI.confetti();
      if (config.loop) {
        UI.toast(`${'⭐'.repeat(stars)} ${acc}% · +${xp} XP — on recommence !`);
        setTimeout(reset, 1500);
        return;
      }
      const hasNext = section && config.section + 1 < sections.length;
      overlay.classList.remove('hidden');
      overlay.innerHTML = `<div class="pause-card results">
        <div class="big-stars">${[1, 2, 3].map(i => `<span class="bstar ${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.18}s">★</span>`).join('')}</div>
        <h2>${stars === 3 ? 'Magnifique !' : stars === 2 ? 'Très bien !' : stars === 1 ? 'Bon début !' : 'Continue comme ça !'}</h2>
        <div class="end-stats">
          <div class="end-stat green"><div class="es-label">Précision</div><div class="es-value">🎯 ${acc}%</div></div>
          <div class="end-stat orange"><div class="es-label">Meilleur combo</div><div class="es-value">🔥 ${bestCombo}</div></div>
          <div class="end-stat yellow"><div class="es-label">XP</div><div class="es-value">⚡ +${xp}</div></div>
        </div>
        <p class="muted small">${wrong} fausse${wrong > 1 ? 's' : ''} note${wrong > 1 ? 's' : ''}${mode === 'rhythm' ? ` · ${missed} ratée${missed > 1 ? 's' : ''}` : ''} · vitesse ${Math.round(speed * 100)}%</p>
        <p class="tip">${tipFor(acc, stars)}</p>
        <div class="row gap center wrap">
          <button class="btn ghost ov-setup">⚙️ Réglages</button>
          <button class="btn ${hasNext ? 'ghost' : 'primary'} ov-again">↻ Rejouer</button>
          ${hasNext ? '<button class="btn primary ov-next">Partie suivante →</button>' : ''}
        </div>
      </div>`;
      overlay.querySelector('.ov-again').onclick = () => reset();
      overlay.querySelector('.ov-setup').onclick = () => { teardown(); backToSetup(); };
      const nx = overlay.querySelector('.ov-next');
      if (nx) nx.onclick = () => { teardown(); config.section++; play(song, config, sections, root, backToSetup, exitAll); };
    }

    function tipFor(acc, stars) {
      if (mode === 'wait' && stars === 3) return '💡 Essaie maintenant le mode « En rythme » !';
      if (mode === 'wait' && speed < 0.5 && acc >= 90) return '💡 Super précision ! Monte la vitesse à 50 % ou plus pour viser 3 étoiles.';
      if (acc < 70) return '💡 Baisse la vitesse et regarde les touches qui s\'allument. La lenteur est ta meilleure amie.';
      if (mode === 'rhythm' && acc < 90) return '💡 Repasse en « Pas à pas » quelques fois pour bien mémoriser.';
      if (section) return '💡 Quand toutes les parties ont 3 étoiles, essaie le morceau entier.';
      return '💡 Augmente un peu la vitesse pour progresser.';
    }

    function changeSpeed(d) {
      speed = Math.min(1.5, Math.max(0.2, Math.round((speed + d) * 100) / 100));
      config.speed = speed;
      $('.pr-speed').textContent = Math.round(speed * 100) + '%';
    }

    const keyHandler = e => {
      if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
      else if (e.code === 'Escape') { teardown(); backToSetup(); }
      else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) reset();
      else if (e.code === 'ArrowUp') { e.preventDefault(); changeSpeed(0.05); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); changeSpeed(-0.05); }
    };
    window.addEventListener('keydown', keyHandler);

    $('.pr-back').onclick = () => { teardown(); backToSetup(); };
    $('.pr-pause').onclick = () => setPaused(!paused);
    $('.pr-restart').onclick = () => reset();
    $('.pr-slower').onclick = () => changeSpeed(-0.05);
    $('.pr-faster').onclick = () => changeSpeed(0.05);

    let tornDown = false;
    function teardown() {
      if (tornDown) return;
      tornDown = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsubNote();
      window.removeEventListener('keydown', keyHandler);
      piano.destroy();
      Store.state.settings.speed = speed;
      Store.save();
    }
    Practice._teardown = teardown;

    Sound.ensure();
    reset();
    raf = requestAnimationFrame(t0 => { last = t0; frame(t0); });
  }

  return { openSetup, teardown: () => Practice._teardown && Practice._teardown() };
})();
