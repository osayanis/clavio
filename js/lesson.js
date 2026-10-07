// Moteur de leçon façon Duolingo : exercices successifs, cœurs, retours immédiats.
const LessonPlayer = (() => {
  const MAX_HEARTS = 5;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function octaveHint(m) {
    if (m === 60) return 'Le Do central ★';
    if (m > 60 && m < 72) return 'Juste à droite du Do central ★';
    if (m >= 72 && m < 84) return 'Une octave au-dessus du Do central';
    if (m >= 48 && m < 60) return 'Juste à gauche du Do central ★';
    if (m < 48) return 'Dans le grave, deux octaves sous le Do central';
    return 'Dans l\'aigu';
  }

  function allMidis(ex) {
    switch (ex.type) {
      case 'find': case 'read': case 'name': return [ex.midi];
      case 'seq': return ex.steps.flat();
      case 'ear': return ex.steps;
      case 'intro': return [...(ex.keys || []), ...(ex.keys2 || []), ...(ex.staff || [])];
      default: return [];
    }
  }

  function start(lesson, root, onExit) {
    const exercises = lesson.build();
    const queue = exercises.map(e => ({ ...e }));
    let total = queue.length;
    let done = 0;
    let hearts = MAX_HEARTS;
    let mistakes = 0;
    let current = null;
    let exMistake = false;
    let locked = false;
    let cleanup = [];
    let advanceTimer = null;
    const startedAt = Date.now();

    const range = lesson.range || Music.fitRange(exercises.flatMap(allMidis), 2);

    root.innerHTML = `
      <div class="lesson">
        <header class="lesson-top">
          <button class="icon-btn close" title="Quitter">✕</button>
          <div class="progress"><div class="progress-bar"></div></div>
          <div class="hearts"><span class="heart-icon">❤️</span><span class="heart-count">${hearts}</span></div>
        </header>
        <main class="lesson-body"><div class="ex"></div></main>
        <div class="lesson-piano"></div>
        <footer class="lesson-foot">
          <div class="foot-inner">
            <div class="feedback"></div>
            <button class="btn primary continue hidden">Continuer</button>
          </div>
        </footer>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const exEl = $('.ex');
    const foot = $('.lesson-foot');
    const feedback = $('.feedback');
    const contBtn = $('.continue');
    const piano = new PianoKeyboard($('.lesson-piano'), { lo: range[0], hi: range[1], labels: lesson.labels || 'c' });

    const updateTop = () => {
      $('.progress-bar').style.width = (done / total * 100) + '%';
      $('.heart-count').textContent = hearts;
    };

    const unsubNote = Input.on('noteon', (m, v, src) => {
      if (locked || !current || !current.onNote) return;
      current.onNote(m);
    });
    const keyHandler = e => {
      if (e.key === 'Enter' && !contBtn.classList.contains('hidden')) { e.preventDefault(); contBtn.click(); }
      if (current && current.onKey) current.onKey(e);
    };
    window.addEventListener('keydown', keyHandler);

    $('.close').onclick = async () => {
      if (await UI.confirm('Quitter la leçon ?', 'Ta progression dans cette leçon sera perdue.', 'Quitter', 'Continuer la leçon')) exit(false);
    };

    function exit(completed) {
      clearTimeout(advanceTimer);
      cleanup.forEach(f => f());
      unsubNote();
      window.removeEventListener('keydown', keyHandler);
      piano.destroy();
      onExit(completed);
    }

    function setFoot(state, html = '', button = null) {
      foot.className = 'lesson-foot ' + state;
      feedback.innerHTML = html;
      if (button) { contBtn.textContent = button; contBtn.classList.remove('hidden'); }
      else contBtn.classList.add('hidden');
    }

    function mistake(msg) {
      mistakes++;
      exMistake = true;
      hearts--;
      Sound.fx.wrong();
      updateTop();
      const h = $('.hearts');
      h.classList.remove('shake'); void h.offsetWidth; h.classList.add('shake');
      setFoot('error', `<div class="fb-icon">✕</div><div><div class="fb-title">Pas tout à fait…</div><div class="fb-sub">${msg}</div></div>`);
      if (hearts <= 0) { locked = true; setTimeout(showFailed, 700); }
    }

    function succeed(msg) {
      if (locked) return;
      locked = true;
      Sound.fx.correct();
      const praise = ['Bravo !', 'Excellent !', 'Parfait !', 'Super !', 'Génial !', 'Bien joué !'];
      const title = exMistake ? 'C\'est ça !' : praise[Math.floor(Math.random() * praise.length)];
      setFoot('success', `<div class="fb-icon">✓</div><div><div class="fb-title">${title}</div>${msg ? `<div class="fb-sub">${msg}</div>` : ''}</div>`, 'Continuer');
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(next, exMistake ? 1600 : 1000);
    }

    contBtn.onclick = () => { clearTimeout(advanceTimer); next(); };

    function next() {
      clearTimeout(advanceTimer);
      if (current) {
        if (current.unmount) current.unmount();
        if (exMistake && !current.ex.retry && current.ex.type !== 'intro') {
          queue.push({ ...current.ex, retry: true });
          total++;
        }
        done++;
      }
      updateTop();
      piano.clear(); piano.clearFingers(); piano.setLabels(lesson.labels || 'c');
      exMistake = false;
      locked = false;
      setFoot('');
      const ex = queue.shift();
      if (!ex) return finish();
      current = mount(ex);
      current.ex = ex;
      exEl.classList.remove('enter'); void exEl.offsetWidth; exEl.classList.add('enter');
    }

    function mount(ex) {
      const api = { mistake, succeed, piano, setFoot };
      return Exercises[ex.type](ex, exEl, api);
    }

    function finish() {
      current = null;
      const accuracy = Math.round(100 * Math.max(0, total - mistakes) / total);
      const xp = Game.completeLesson(lesson.id, accuracy, mistakes);
      const secs = Math.round((Date.now() - startedAt) / 1000);
      Sound.fx.complete();
      UI.confetti();
      root.querySelector('.lesson').innerHTML = `
        <div class="lesson-end">
          ${UI.mascot('happy', 140)}
          <h1>Leçon terminée !</h1>
          <p class="muted">${esc(lesson.title)}</p>
          <div class="end-stats">
            <div class="end-stat yellow"><div class="es-label">XP gagnés</div><div class="es-value">⚡ ${xp}</div></div>
            <div class="end-stat green"><div class="es-label">${mistakes === 0 ? 'Sans faute !' : 'Précision'}</div><div class="es-value">🎯 ${accuracy}%</div></div>
            <div class="end-stat blue"><div class="es-label">Temps</div><div class="es-value">⏱️ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</div></div>
          </div>
          <button class="btn primary big end-continue">Continuer</button>
        </div>`;
      piano.destroy();
      root.querySelector('.end-continue').onclick = () => exit(true);
      cleanup.push(() => {});
    }

    function showFailed() {
      if (current && current.unmount) current.unmount();
      current = null;
      root.querySelector('.lesson').innerHTML = `
        <div class="lesson-end">
          ${UI.mascot('sad', 140)}
          <h1>Plus de cœurs !</h1>
          <p class="muted">Pas grave, c'est en se trompant qu'on apprend.<br>Prends ton temps et réessaie.</p>
          <div class="row gap">
            <button class="btn ghost big fail-quit">Quitter</button>
            <button class="btn primary big fail-retry">Réessayer</button>
          </div>
        </div>`;
      root.querySelector('.fail-quit').onclick = () => exit(false);
      root.querySelector('.fail-retry').onclick = () => {
        cleanup.forEach(f => f());
        unsubNote();
        window.removeEventListener('keydown', keyHandler);
        piano.destroy();
        start(lesson, root, onExit);
      };
    }

    updateTop();
    next();
  }

  // ---------------- Exercices ----------------
  const Exercises = {
    intro(ex, el, api) {
      el.innerHTML = `
        <div class="ex-intro">
          <div class="intro-mascot">${UI.mascot('talk', 96)}</div>
          <div class="bubble">
            <h2>${ex.title}</h2>
            <p>${ex.html}</p>
          </div>
        </div>
        ${ex.staff ? `<div class="staff-wrap">${Staff.render(ex.staff.map(m => ({ midis: [m], label: Music.name(m) })), { clef: ex.clef || 'auto', labels: true })}</div>` : ''}
        ${ex.keys ? '<button class="btn ghost small hear">🔊 Écouter</button>' : ''}`;
      (ex.keys || []).forEach((m, i) => { api.piano.mark(m, 'target'); if (ex.fingers) api.piano.setFinger(m, ex.fingers[i]); });
      (ex.keys2 || []).forEach(m => api.piano.mark(m, 'hint2'));
      if (ex.keys || ex.keys2) api.piano.setLabels(ex.fingers ? 'c' : 'names');
      const hear = el.querySelector('.hear');
      if (hear) hear.onclick = () => Sound.playSequence(ex.keys, 0.45);
      api.setFoot('info', '', 'Compris !');
      return {};
    },

    find(ex, el, api) {
      el.innerHTML = `
        <h2 class="ex-title">Joue la note</h2>
        <div class="big-note">${Music.name(ex.midi)}</div>
        <p class="muted center">${ex.anyOctave ? `N'importe quel ${Music.name(ex.midi)} du clavier` : octaveHint(ex.midi)}</p>`;
      let fails = 0;
      return {
        onNote(m) {
          const ok = ex.anyOctave ? Music.pc(m) === Music.pc(ex.midi) : m === ex.midi;
          if (ok) { api.piano.flash(m, 'good'); api.piano.clear('hint'); api.succeed(); }
          else {
            fails++;
            api.piano.flash(m, 'bad');
            const sameName = Music.pc(m) === Music.pc(ex.midi);
            api.mistake(sameName ? `Bonne note, mauvaise octave ! ${octaveHint(ex.midi)}.` : `Ça, c'était <b>${Music.name(m)}</b>. Regarde la touche qui clignote.`);
            api.piano.mark(ex.midi, 'hint');
          }
        },
      };
    },

    read(ex, el, api) {
      const render = (state, label) => Staff.render([{ midis: [ex.midi], state, label }], { clef: ex.clef, labels: !!label, minWidth: 220 });
      el.innerHTML = `
        <h2 class="ex-title">Joue cette note</h2>
        <div class="staff-wrap big">${render('')}</div>`;
      const wrap = el.querySelector('.staff-wrap');
      return {
        onNote(m) {
          const ok = ex.anyOctave ? Music.pc(m) === Music.pc(ex.midi) : m === ex.midi;
          if (ok) { api.piano.flash(m, 'good'); wrap.innerHTML = render('done', Music.name(ex.midi)); api.succeed(`C'était <b>${Music.name(ex.midi)}</b>.`); }
          else {
            api.piano.flash(m, 'bad');
            wrap.innerHTML = render('wrong', Music.name(ex.midi));
            api.mistake(`Cette note est un <b>${Music.name(ex.midi)}</b>. ${Music.pc(m) === Music.pc(ex.midi) ? 'Bon nom, mais mauvaise octave !' : ''}`);
            api.piano.mark(ex.midi, 'hint');
          }
        },
      };
    },

    name(ex, el, api) {
      el.innerHTML = `
        <h2 class="ex-title">${ex.show === 'staff' ? 'Quelle est cette note ?' : 'Comment s\'appelle la touche en surbrillance ?'}</h2>
        ${ex.show === 'staff' ? `<div class="staff-wrap big">${Staff.render([{ midis: [ex.midi] }], { clef: ex.clef, minWidth: 220 })}</div>` : '<div class="spacer"></div>'}
        <div class="choices">${ex.choices.map((pc, i) => `<button class="choice" data-pc="${pc}"><span class="kbd">${i + 1}</span>${Music.name(pc + 60)}</button>`).join('')}</div>`;
      if (ex.show === 'key') api.piano.mark(ex.midi, 'target');
      const buttons = [...el.querySelectorAll('.choice')];
      const pick = btn => {
        if (!btn || btn.disabled) return;
        const pc = parseInt(btn.dataset.pc, 10);
        if (pc === Music.pc(ex.midi)) {
          btn.classList.add('correct');
          Sound.play(ex.midi, 0.6);
          api.succeed();
        } else {
          btn.classList.add('wrong'); btn.disabled = true;
          api.mistake(`Ce n'est pas <b>${Music.name(pc + 60)}</b>. Essaie encore !`);
        }
      };
      buttons.forEach(b => b.onclick = () => pick(b));
      return { onKey(e) { const n = parseInt(e.key, 10); if (n >= 1 && n <= buttons.length) pick(buttons[n - 1]); } };
    },

    choice(ex, el, api) {
      el.innerHTML = `
        <h2 class="ex-title">${ex.prompt}</h2>
        <button class="sound-btn">🔊</button>
        <div class="choices two">${ex.options.map((o, i) => `<button class="choice" data-i="${i}"><span class="kbd">${i + 1}</span>${o.label}</button>`).join('')}</div>`;
      const playIt = () => {
        ex.play.forEach((g, i) => g.forEach(m => Sound.play(m, 0.7, 0.7, i * 0.8)));
      };
      el.querySelector('.sound-btn').onclick = playIt;
      const t = setTimeout(playIt, 400);
      const buttons = [...el.querySelectorAll('.choice')];
      const pick = btn => {
        if (!btn || btn.disabled) return;
        const o = ex.options[btn.dataset.i];
        if (o.correct) { btn.classList.add('correct'); api.succeed(); }
        else { btn.classList.add('wrong'); btn.disabled = true; api.mistake('Réécoute bien et réessaie.'); }
      };
      buttons.forEach(b => b.onclick = () => pick(b));
      return {
        onKey(e) { const n = parseInt(e.key, 10); if (n >= 1 && n <= buttons.length) pick(buttons[n - 1]); if (e.code === 'Space') { e.preventDefault(); playIt(); } },
        unmount() { clearTimeout(t); },
      };
    },

    ear(ex, el, api) {
      el.innerHTML = `
        <h2 class="ex-title">Écoute et rejoue ${ex.steps.length > 1 ? 'la mélodie' : 'la note'}</h2>
        <div class="row center gap">
          <button class="sound-btn">🔊</button>
          <button class="sound-btn slow" title="Plus lentement">🐢</button>
        </div>
        <div class="dots">${ex.steps.map(() => '<span class="dot"></span>').join('')}</div>
        ${ex.steps.length > 1 ? `<p class="muted center">Indice : ça commence par <b>${Music.name(ex.steps[0])}</b></p>` : ''}`;
      let pos = 0;
      const dots = [...el.querySelectorAll('.dot')];
      const playIt = (gap = 0.6) => Sound.playSequence(ex.steps, gap);
      el.querySelector('.sound-btn').onclick = () => playIt();
      el.querySelector('.slow').onclick = () => playIt(1);
      const t = setTimeout(() => playIt(), 400);
      return {
        onNote(m) {
          if (m === ex.steps[pos]) {
            api.piano.flash(m, 'good');
            api.piano.clear('hint');
            dots[pos].classList.add('on');
            pos++;
            if (pos >= ex.steps.length) api.succeed(`${ex.steps.map(x => Music.name(x)).join(' – ')}`);
          } else {
            api.piano.flash(m, 'bad');
            api.mistake(`Pas ${Music.name(m)}… la touche qui clignote est la bonne.`);
            api.piano.mark(ex.steps[pos], 'hint');
          }
        },
        onKey(e) { if (e.code === 'Space') { e.preventDefault(); playIt(); } },
        unmount() { clearTimeout(t); },
      };
    },

    seq(ex, el, api) {
      let pos = 0;
      let hits = new Map(); // midi -> temps
      const title = ex.title || (ex.chord ? 'Joue l\'accord' : 'Joue ces notes');
      el.innerHTML = `
        <h2 class="ex-title">${title}</h2>
        <div class="staff-wrap scroll"></div>
        <div class="row center gap"><button class="btn ghost small hear">🔊 Écouter</button></div>`;
      const wrap = el.querySelector('.staff-wrap');
      const draw = () => {
        const items = ex.steps.map((s, i) => ({
          midis: s,
          state: i < pos ? 'done' : i === pos ? 'current' : '',
          label: ex.names ? s.map(m => Music.name(m)).join('·') : '',
        }));
        wrap.innerHTML = Staff.render(items, { clef: 'auto', labels: ex.names, spacing: ex.steps.some(s => s.length > 1) ? 62 : 54 });
        const cur = wrap.querySelector('.cursor');
        if (cur) {
          const x = cur.getBBox ? cur.getBBox().x : 0;
          wrap.scrollTo({ left: Math.max(0, x - wrap.clientWidth / 2 + 30), behavior: 'smooth' });
        }
        api.piano.clear('target'); api.piano.clear('hint'); api.piano.clearFingers();
        if (pos < ex.steps.length && ex.guide) {
          ex.steps[pos].forEach((m, i) => {
            api.piano.mark(m, 'target');
            if (ex.fingers && ex.fingers[pos]) api.piano.setFinger(m, ex.fingers[pos][i]);
          });
        }
      };
      draw();
      el.querySelector('.hear').onclick = () => Sound.playSequence(ex.steps, 0.5);
      return {
        onNote(m) {
          const step = ex.steps[pos];
          if (!step) return;
          if (step.includes(m)) {
            api.piano.flash(m, 'good');
            const now = performance.now();
            hits.set(m, now);
            for (const [k, t] of hits) if (now - t > 900 && !Input.held.has(k)) hits.delete(k);
            if (step.every(x => hits.has(x))) {
              pos++;
              hits = new Map();
              draw();
              if (pos >= ex.steps.length) api.succeed();
            }
          } else {
            api.piano.flash(m, 'bad');
            const want = step.map(x => Music.name(x)).join(' + ');
            api.mistake(`Tu as joué <b>${Music.name(m)}</b>, il fallait <b>${want}</b>.`);
            step.forEach(x => api.piano.mark(x, 'hint'));
          }
        },
      };
    },

    rhythm(ex, el, api) {
      const beat = 60 / ex.bpm;
      const total = ex.pattern.reduce((a, b) => a + b, 0);
      const sym = b => b >= 4 ? '𝅝' : b >= 2 ? '𝅗𝅥' : '♩';
      el.innerHTML = `
        <h2 class="ex-title">Tape en rythme</h2>
        <p class="muted center">4 clics de métronome, puis tape une touche sur chaque note.</p>
        <div class="rhythm">
          <div class="rhythm-track">
            ${ex.pattern.map(b => `<div class="r-note" style="flex:${b}"><span>${sym(b)}</span></div>`).join('')}
            <div class="r-cursor"></div>
          </div>
          <div class="countin"></div>
        </div>
        <div class="row center"><button class="btn primary rstart">▶ Commencer</button></div>`;
      const blocks = [...el.querySelectorAll('.r-note')];
      const cursor = el.querySelector('.r-cursor');
      const countin = el.querySelector('.countin');
      const startBtn = el.querySelector('.rstart');
      let running = false, raf = null, timers = [];
      let onsets = [], matched = [], taps = [], t0 = 0;

      function run() {
        Sound.ensure();
        running = true;
        startBtn.disabled = true;
        blocks.forEach(b => b.classList.remove('hit', 'miss'));
        const lead = 0.15;
        const audioStart = Sound.now + lead;
        t0 = performance.now() + lead * 1000;
        for (let i = 0; i < 4 + total; i++) Sound.fx.clickAt(audioStart + i * beat, i % 4 === 0);
        onsets = [];
        let acc = 4;
        ex.pattern.forEach(b => { onsets.push(acc * beat); acc += b; });
        matched = onsets.map(() => false);
        taps = [];
        for (let i = 0; i < 4; i++) timers.push(setTimeout(() => { countin.textContent = 4 - i; countin.classList.remove('pop'); void countin.offsetWidth; countin.classList.add('pop'); }, (lead + i * beat) * 1000));
        timers.push(setTimeout(() => { countin.textContent = ''; }, (lead + 4 * beat) * 1000));
        const endAt = (4 + total) * beat + 0.3;
        const loop = () => {
          const t = (performance.now() - t0) / 1000;
          const prog = Math.min(1, Math.max(0, (t - 4 * beat) / (total * beat)));
          cursor.style.left = (prog * 100) + '%';
          onsets.forEach((o, i) => { if (!matched[i] && t > o + 0.2) blocks[i].classList.add('miss'); });
          if (t > endAt) return evaluate();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }

      function evaluate() {
        running = false;
        startBtn.disabled = false;
        const hits = matched.filter(Boolean).length;
        const extra = taps.filter(t => !t.matched).length;
        if (hits / onsets.length >= 0.75 && extra <= 2) api.succeed(`${hits}/${onsets.length} notes en rythme`);
        else {
          api.mistake(`${hits}/${onsets.length} notes en rythme${extra ? `, ${extra} en trop` : ''}. Écoute bien le métronome et réessaie !`);
          startBtn.textContent = '↻ Réessayer';
        }
      }

      startBtn.onclick = run;
      return {
        onNote() {
          if (!running) return;
          const t = (performance.now() - t0) / 1000;
          const tap = { t, matched: false };
          taps.push(tap);
          let best = -1, bd = 0.2;
          onsets.forEach((o, i) => { const d = Math.abs(o - t); if (!matched[i] && d < bd) { bd = d; best = i; } });
          if (best >= 0) { matched[best] = true; tap.matched = true; blocks[best].classList.add('hit'); }
        },
        unmount() { cancelAnimationFrame(raf); timers.forEach(clearTimeout); },
      };
    },
  };

  return { start };
})();
