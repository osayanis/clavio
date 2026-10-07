// Sauvegarde de la progression (localStorage) et des fichiers MIDI (IndexedDB).
const Store = (() => {
  const KEY = 'clavio-v1';
  const today = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-JJ
  const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  const defaults = () => ({
    onboarded: false,
    name: '',
    xp: 0,
    dailyGoal: 30,
    xpByDay: {},
    streak: 0,
    bestStreak: 0,
    lastActiveDay: null,
    lessons: {},     // id -> { done, best, count }
    songs: {},       // id -> { stars, best, sections: { idx: stars } }
    badges: {},      // id -> date
    notesPlayed: 0,
    practiceSeconds: 0,
    perfectLessons: 0,
    settings: { notation: 'latin', soundMode: 'auto', volume: 0.8, keyLabels: 'c', speed: 0.6 },
  });

  let state = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) state = { ...defaults(), ...saved, settings: { ...defaults().settings, ...(saved.settings || {}) } };
  } catch (e) { /* stockage indisponible */ }

  // La série est perdue si on a raté un jour entier
  if (state.lastActiveDay && dayDiff(state.lastActiveDay, today()) > 1) state.streak = 0;

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }, 200);
  }

  function reset() { state = defaults(); state.onboarded = true; save(); }

  // ---------- IndexedDB pour les fichiers MIDI ----------
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('clavio', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('midis', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction('midis', mode);
      const req = fn(t.objectStore('midis'));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
    });
  }
  const midis = {
    add: rec => tx('readwrite', s => s.put(rec)),
    all: () => tx('readonly', s => s.getAll()),
    remove: id => tx('readwrite', s => s.delete(id)),
  };

  return {
    get state() { return state; },
    save, reset, today, dayDiff, midis,
  };
})();

// ---------- Gamification ----------
const Game = (() => {
  const listeners = new Set();
  const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const changed = () => listeners.forEach(fn => fn());

  const LEVELS = [0, 50, 120, 220, 350, 520, 750, 1000, 1300, 1700, 2200, 2800, 3500, 4300, 5200, 6200, 7500, 9000, 11000, 13500];
  function level(xp = Store.state.xp) {
    let l = 0;
    while (l + 1 < LEVELS.length && xp >= LEVELS[l + 1]) l++;
    if (l === LEVELS.length - 1) {
      const extra = Math.floor((xp - LEVELS[l]) / 3000);
      return { level: l + 1 + extra, from: LEVELS[l] + extra * 3000, to: LEVELS[l] + (extra + 1) * 3000 };
    }
    return { level: l + 1, from: LEVELS[l], to: LEVELS[l + 1] };
  }

  const BADGES = [
    { id: 'first-lesson', icon: '🎓', title: 'Premier pas', desc: 'Termine ta première leçon' },
    { id: 'first-song', icon: '🎵', title: 'Mélomane', desc: 'Termine un morceau' },
    { id: 'midi-import', icon: '📂', title: 'Explorateur', desc: 'Importe un fichier MIDI' },
    { id: 'streak-3', icon: '🔥', title: 'En feu', desc: 'Série de 3 jours' },
    { id: 'streak-7', icon: '🌋', title: 'Inarrêtable', desc: 'Série de 7 jours' },
    { id: 'streak-30', icon: '☄️', title: 'Légende', desc: 'Série de 30 jours' },
    { id: 'xp-100', icon: '⚡', title: 'Électrisé', desc: 'Gagne 100 XP' },
    { id: 'xp-1000', icon: '💎', title: 'Virtuose en herbe', desc: 'Gagne 1000 XP' },
    { id: 'perfect', icon: '💯', title: 'Sans faute', desc: 'Leçon sans aucune erreur' },
    { id: 'three-stars', icon: '🌟', title: 'Trois étoiles', desc: '3 étoiles sur un morceau' },
    { id: 'unit-1', icon: '🗺️', title: 'Repéré !', desc: 'Termine l\'unité 1' },
    { id: 'notes-1000', icon: '🎹', title: 'Mille notes', desc: 'Joue 1000 notes' },
    { id: 'notes-10000', icon: '🏆', title: 'Dix mille notes', desc: 'Joue 10 000 notes' },
    { id: 'goal', icon: '🎯', title: 'Objectif atteint', desc: 'Atteins ton objectif du jour' },
    { id: 'night', icon: '🦉', title: 'Oiseau de nuit', desc: 'Pratique après 22 h' },
    { id: 'all-units', icon: '👑', title: 'Diplômé', desc: 'Termine tout le parcours' },
  ];

  let toastFn = () => {};
  const setToast = fn => { toastFn = fn; };

  function award(id) {
    const s = Store.state;
    if (s.badges[id]) return;
    const b = BADGES.find(x => x.id === id);
    if (!b) return;
    s.badges[id] = Store.today();
    Store.save();
    toastFn(`${b.icon} Badge débloqué : <b>${b.title}</b>`, 'badge');
  }

  function touchStreak() {
    const s = Store.state;
    const t = Store.today();
    if (s.lastActiveDay === t) return;
    if (s.lastActiveDay && Store.dayDiff(s.lastActiveDay, t) === 1) s.streak += 1;
    else s.streak = 1;
    s.lastActiveDay = t;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (s.streak > 1) toastFn(`🔥 Série de <b>${s.streak} jours</b> !`, 'streak');
  }

  function addXP(amount) {
    const s = Store.state;
    const before = level().level;
    const goalBefore = todayXP() >= s.dailyGoal;
    touchStreak();
    s.xp += amount;
    const t = Store.today();
    s.xpByDay[t] = (s.xpByDay[t] || 0) + amount;
    if (!goalBefore && todayXP() >= s.dailyGoal) { award('goal'); toastFn('🎯 Objectif du jour atteint !', 'goal'); }
    const after = level().level;
    if (after > before) toastFn(`🆙 Niveau <b>${after}</b> atteint !`, 'level');
    checkBadges();
    Store.save();
    changed();
  }

  function todayXP() { return Store.state.xpByDay[Store.today()] || 0; }

  function checkBadges() {
    const s = Store.state;
    if (s.streak >= 3) award('streak-3');
    if (s.streak >= 7) award('streak-7');
    if (s.streak >= 30) award('streak-30');
    if (s.xp >= 100) award('xp-100');
    if (s.xp >= 1000) award('xp-1000');
    if (s.notesPlayed >= 1000) award('notes-1000');
    if (s.notesPlayed >= 10000) award('notes-10000');
    if (Object.values(s.lessons).some(l => l.done)) award('first-lesson');
    if (Course.units[0].lessons.every(l => s.lessons[l.id]?.done)) award('unit-1');
    if (Course.allLessons.every(l => s.lessons[l.id]?.done)) award('all-units');
    if (Object.values(s.songs).some(x => x.stars >= 1)) award('first-song');
    if (Object.values(s.songs).some(x => x.stars >= 3)) award('three-stars');
    if (new Date().getHours() >= 22) award('night');
  }

  function completeLesson(id, accuracy, mistakes) {
    const s = Store.state;
    const rec = s.lessons[id] || { done: false, best: 0, count: 0 };
    const first = !rec.done;
    rec.done = true;
    rec.best = Math.max(rec.best, accuracy);
    rec.count += 1;
    s.lessons[id] = rec;
    let xp = first ? 15 : 10;
    if (mistakes === 0) { xp += 5; s.perfectLessons++; award('perfect'); }
    addXP(xp);
    return xp;
  }

  function completeSong(id, section, stars, accuracy, notes) {
    const s = Store.state;
    const rec = s.songs[id] || { stars: 0, best: 0, sections: {} };
    if (section == null) { rec.stars = Math.max(rec.stars, stars); rec.best = Math.max(rec.best, accuracy); }
    else rec.sections[section] = Math.max(rec.sections[section] || 0, stars);
    rec.last = Date.now();
    s.songs[id] = rec;
    const xp = Math.max(2, Math.round(Math.min(40, notes * 0.25) * (0.4 + stars * 0.2)));
    addXP(xp);
    return xp;
  }

  // Le prochain élément du parcours
  function nextLesson() {
    return Course.allLessons.find(l => !Store.state.lessons[l.id]?.done) || null;
  }
  function isUnlocked(id) {
    const idx = Course.allLessons.findIndex(l => l.id === id);
    if (idx <= 0) return true;
    return !!Store.state.lessons[Course.allLessons[idx - 1].id]?.done;
  }

  // Comptage des notes et du temps de pratique
  Input.on('noteon', () => { Store.state.notesPlayed++; Store.save(); });
  setInterval(() => {
    if (performance.now() - Input.lastNoteAt < 20000 && document.visibilityState === 'visible') {
      Store.state.practiceSeconds += 5;
      Store.save();
    }
  }, 5000);
  setInterval(() => { checkBadges(); }, 60000);

  return { level, addXP, todayXP, completeLesson, completeSong, nextLesson, isUnlocked, BADGES, award, onChange, changed, setToast, checkBadges };
})();
