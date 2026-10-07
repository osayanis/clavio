// Entrées : clavier MIDI (USB), clavier d'ordinateur, souris/tactile.
const Input = (() => {
  const listeners = { noteon: new Set(), noteoff: new Set(), status: new Set() };
  const held = new Set();
  let midiAccess = null;
  let status = { supported: !!navigator.requestMIDIAccess, devices: [], error: null };
  let lastNoteAt = 0;
  let pcOctave = 4; // octave de base du clavier d'ordinateur
  let soundMode = 'auto'; // 'auto' | 'on' | 'off'
  let enabled = true;
  let layoutMap = null;

  function on(evt, fn) { listeners[evt].add(fn); return () => listeners[evt].delete(fn); }
  function emit(evt, ...args) { [...listeners[evt]].forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); }

  function shouldSound(source) {
    if (soundMode === 'on') return true;
    if (soundMode === 'off') return false;
    return source !== 'midi'; // le CT-S100 a ses propres haut-parleurs
  }

  function noteOn(midi, velocity = 0.75, source = 'mouse') {
    if (!enabled) return;
    if (held.has(midi)) noteOff(midi, source);
    held.add(midi);
    lastNoteAt = performance.now();
    if (shouldSound(source)) Sound.noteOn(midi, velocity);
    emit('noteon', midi, velocity, source);
  }

  function noteOff(midi, source = 'mouse') {
    if (!held.has(midi)) return;
    held.delete(midi);
    Sound.noteOff(midi);
    emit('noteoff', midi, source);
  }

  // ---------- Web MIDI ----------
  function onMidiMessage(e) {
    const [st, d1, d2] = e.data;
    const type = st & 0xf0;
    if (type === 0x90 && d2 > 0) noteOn(d1, d2 / 127, 'midi');
    else if (type === 0x80 || (type === 0x90 && d2 === 0)) noteOff(d1, 'midi');
  }

  function refreshDevices() {
    if (!midiAccess) return;
    const devices = [];
    midiAccess.inputs.forEach(inp => {
      inp.onmidimessage = onMidiMessage;
      if (inp.state === 'connected') devices.push(inp.name || 'Clavier MIDI');
    });
    status = { ...status, devices, error: null };
    emit('status', status);
  }

  async function initMidi() {
    if (!navigator.requestMIDIAccess) {
      status = { ...status, supported: false, error: 'Ton navigateur ne gère pas le MIDI. Utilise Chrome ou Edge.' };
      emit('status', status);
      return;
    }
    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      midiAccess.onstatechange = refreshDevices;
      refreshDevices();
    } catch (err) {
      status = { ...status, error: 'Accès MIDI refusé. Autorise le MIDI dans le navigateur puis recharge la page.' };
      emit('status', status);
    }
  }

  // ---------- Clavier d'ordinateur ----------
  // Codes physiques (fonctionne en AZERTY comme en QWERTY)
  const KEYMAP = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9,
    KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
  };

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  window.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (e.code === 'KeyZ') { pcOctave = Math.max(2, pcOctave - 1); emit('status', status); return; }
    if (e.code === 'KeyX') { pcOctave = Math.min(6, pcOctave + 1); emit('status', status); return; }
    const off = KEYMAP[e.code];
    if (off === undefined) return;
    const midi = (pcOctave + 1) * 12 + off;
    if (midi > Music.KEYBOARD_HI) return;
    e.preventDefault();
    noteOn(midi, 0.75, 'keyboard');
  });

  window.addEventListener('keyup', e => {
    const off = KEYMAP[e.code];
    if (off === undefined) return;
    noteOff((pcOctave + 1) * 12 + off, 'keyboard');
  });

  window.addEventListener('blur', () => [...held].forEach(m => noteOff(m)));

  if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
    navigator.keyboard.getLayoutMap().then(map => { layoutMap = map; emit('status', status); }).catch(() => {});
  }

  // Lettre affichée pour une note sur le clavier d'ordinateur (ou null)
  function pcKeyLabel(midi) {
    const off = midi - (pcOctave + 1) * 12;
    const code = Object.keys(KEYMAP).find(k => KEYMAP[k] === off);
    if (!code) return null;
    if (layoutMap && layoutMap.get(code)) return layoutMap.get(code).toUpperCase();
    return code.replace('Key', '').replace('Semicolon', ';').replace('Quote', "'");
  }

  function pcOctaveKeys() {
    const get = c => (layoutMap && layoutMap.get(c)) ? layoutMap.get(c).toUpperCase() : c.replace('Key', '');
    return { down: get('KeyZ'), up: get('KeyX') };
  }

  return {
    on, noteOn, noteOff, initMidi, refreshDevices, pcKeyLabel, pcOctaveKeys,
    held,
    get status() { return status; },
    get connected() { return status.devices.length > 0; },
    get lastNoteAt() { return lastNoteAt; },
    get pcOctave() { return pcOctave; },
    set pcOctave(v) { pcOctave = v; emit('status', status); },
    get soundMode() { return soundMode; },
    set soundMode(v) { soundMode = v; },
    set enabled(v) { enabled = v; },
  };
})();
