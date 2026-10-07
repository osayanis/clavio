// Clavier de piano à l'écran (cliquable, synchronisé avec toutes les entrées).
class PianoKeyboard {
  constructor(container, opts = {}) {
    this.container = container;
    this.lo = opts.lo ?? 48;
    this.hi = opts.hi ?? 72;
    this.labels = opts.labels ?? 'none'; // 'none' | 'names' | 'c' (seulement les Do) | 'pc'
    this.interactive = opts.interactive ?? true;
    this.keyEls = new Map();
    this.marks = new Map(); // midi -> Set de classes
    this.fingers = new Map();
    this.el = document.createElement('div');
    this.el.className = 'piano';
    container.appendChild(this.el);
    this.unsubs = [
      Input.on('noteon', m => this.setPressed(m, true)),
      Input.on('noteoff', m => this.setPressed(m, false)),
      Input.on('status', () => { if (this.labels === 'pc') this.renderLabels(); }),
    ];
    this.render();
  }

  setRange(lo, hi) { this.lo = lo; this.hi = hi; this.render(); }
  setLabels(mode) { this.labels = mode; this.renderLabels(); }

  render() {
    this.el.innerHTML = '';
    this.keyEls.clear();
    const { keys } = Music.layout(this.lo, this.hi);
    this.layoutKeys = keys;
    for (const [midi, k] of keys) {
      const key = document.createElement('div');
      key.className = 'key ' + (k.black ? 'black' : 'white');
      if (midi === Music.MIDDLE_C) key.classList.add('middle-c');
      key.style.left = (k.x * 100) + '%';
      key.style.width = (k.w * 100) + '%';
      key.dataset.midi = midi;
      key.innerHTML = '<span class="finger"></span><span class="label"></span>';
      this.el.appendChild(key);
      this.keyEls.set(midi, key);
      if (Input.held.has(midi)) key.classList.add('pressed');
    }
    for (const [m, set] of this.marks) set.forEach(c => this.keyEls.get(m)?.classList.add(c));
    for (const [m, f] of this.fingers) this.setFinger(m, f);
    this.renderLabels();
    if (this.interactive) this.bindPointer();
  }

  renderLabels() {
    for (const [midi, key] of this.keyEls) {
      let text = '';
      if (this.labels === 'names') text = Music.name(midi);
      else if (this.labels === 'c' && Music.pc(midi) === 0) text = Music.name(midi) + (midi === 60 ? '★' : '');
      else if (this.labels === 'pc') text = Input.pcKeyLabel(midi) || '';
      key.querySelector('.label').textContent = text;
    }
  }

  bindPointer() {
    if (this.boundPointer) return;
    this.boundPointer = true;
    const active = new Map(); // pointerId -> midi
    const keyAt = e => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const k = el && el.closest('.key');
      return k && this.el.contains(k) ? parseInt(k.dataset.midi, 10) : null;
    };
    this.el.addEventListener('pointerdown', e => {
      const m = keyAt(e);
      if (m == null) return;
      e.preventDefault();
      this.el.setPointerCapture(e.pointerId);
      active.set(e.pointerId, m);
      Input.noteOn(m, 0.7, 'mouse');
    });
    this.el.addEventListener('pointermove', e => {
      if (!active.has(e.pointerId)) return;
      const m = keyAt(e);
      const prev = active.get(e.pointerId);
      if (m !== prev) {
        Input.noteOff(prev, 'mouse');
        if (m != null) { Input.noteOn(m, 0.7, 'mouse'); active.set(e.pointerId, m); }
        else active.delete(e.pointerId);
      }
    });
    const end = e => {
      if (!active.has(e.pointerId)) return;
      Input.noteOff(active.get(e.pointerId), 'mouse');
      active.delete(e.pointerId);
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  setPressed(midi, on) {
    const k = this.keyEls.get(midi);
    if (k) k.classList.toggle('pressed', on);
  }

  mark(midi, cls) {
    if (!this.marks.has(midi)) this.marks.set(midi, new Set());
    this.marks.get(midi).add(cls);
    this.keyEls.get(midi)?.classList.add(cls);
  }

  unmark(midi, cls) {
    this.marks.get(midi)?.delete(cls);
    this.keyEls.get(midi)?.classList.remove(cls);
  }

  clear(cls) {
    for (const [m, set] of this.marks) {
      if (!cls) { set.forEach(c => this.keyEls.get(m)?.classList.remove(c)); set.clear(); }
      else if (set.has(cls)) { set.delete(cls); this.keyEls.get(m)?.classList.remove(cls); }
    }
  }

  // Petit flash coloré (bonne / mauvaise note)
  flash(midi, cls, ms = 350) {
    const k = this.keyEls.get(midi);
    if (!k) return;
    k.classList.remove(cls);
    void k.offsetWidth;
    k.classList.add(cls);
    clearTimeout(k['_t' + cls]);
    k['_t' + cls] = setTimeout(() => k.classList.remove(cls), ms);
  }

  setFinger(midi, n) {
    if (n == null) this.fingers.delete(midi); else this.fingers.set(midi, n);
    const k = this.keyEls.get(midi);
    if (k) k.querySelector('.finger').textContent = n ?? '';
  }

  clearFingers() {
    for (const m of [...this.fingers.keys()]) this.setFinger(m, null);
  }

  destroy() {
    this.unsubs.forEach(u => u());
    this.el.remove();
  }
}
