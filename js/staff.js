// Rendu d'une portée musicale en SVG (clé de Sol, clé de Fa ou grand système).
const Staff = (() => {
  const GAP = 12;    // distance entre deux lignes
  const HALF = GAP / 2;
  const STAFFS = {
    treble: { top: 38, glyph: '𝄞', glyphSize: 66, glyphDy: 47 }, // ligne du haut = Fa5
    bass: { top: 26, glyph: '𝄢', glyphSize: 40, glyphDy: 26 },   // ligne du haut = La3
  };

  // notes : [{ midis:[...], state:'current'|'done'|'wrong'|'', label?, finger? }]
  function render(notes, opts = {}) {
    const clef = opts.clef || 'auto';
    const all = notes.flatMap(n => n.midis);
    let staves;
    if (clef === 'grand') staves = ['treble', 'bass'];
    else if (clef === 'auto') {
      const hasLow = all.some(m => m < 57), hasHigh = all.some(m => m >= 64);
      staves = hasLow && hasHigh ? ['treble', 'bass'] : hasLow ? ['bass'] : ['treble'];
    } else staves = [clef];

    const spacing = opts.spacing || 54;
    const left = 70;
    const width = Math.max(opts.minWidth || 240, left + notes.length * spacing + 30);
    const staffHeight = GAP * 4;
    const pad = 42; // espace pour les lignes supplémentaires
    const tops = [];
    let y = pad;
    staves.forEach(() => { tops.push(y); y += staffHeight + (staves.length > 1 ? 70 : 0); });
    const height = (staves.length > 1 ? tops[1] : tops[0]) + staffHeight + pad + (opts.labels ? 18 : 0);

    let svg = `<svg class="staff" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    staves.forEach((s, i) => {
      const top = tops[i];
      for (let l = 0; l < 5; l++) svg += `<line class="staff-line" x1="8" x2="${width - 8}" y1="${top + l * GAP}" y2="${top + l * GAP}"/>`;
      const st = STAFFS[s];
      svg += `<text class="clef" x="12" y="${top + st.glyphDy}" font-size="${st.glyphSize}">${st.glyph}</text>`;
    });
    if (staves.length > 1) {
      svg += `<line class="staff-line" x1="8" x2="8" y1="${tops[0]}" y2="${tops[1] + staffHeight}"/>`;
    }

    const staffFor = m => staves.length === 1 ? 0 : (m >= 60 ? 0 : 1);

    notes.forEach((n, idx) => {
      const x = left + idx * spacing + spacing / 2;
      const cls = 'note ' + (n.state || '');
      if (n.state === 'current') svg += `<rect class="cursor" x="${x - spacing / 2 + 4}" y="6" width="${spacing - 8}" height="${height - 12}" rx="10"/>`;
      const sorted = [...n.midis].sort((a, b) => a - b);
      let prevD = -99;
      sorted.forEach(m => {
        const si = staffFor(m);
        const s = staves[si];
        const top = tops[si];
        const d = Music.diatonic(m);
        const topD = STAFFS[s].top;
        const bottomD = topD - 8;
        const ny = top + (topD - d) * HALF;
        // décalage si deux notes voisines (seconde)
        const nx = (d - prevD === 1) ? x + 13 : x;
        prevD = d;
        // lignes supplémentaires
        for (let ld = bottomD - 2; ld >= d; ld -= 2) {
          const ly = top + (topD - ld) * HALF;
          svg += `<line class="ledger" x1="${nx - 13}" x2="${nx + 13}" y1="${ly}" y2="${ly}"/>`;
        }
        for (let ld = topD + 2; ld <= d; ld += 2) {
          const ly = top + (topD - ld) * HALF;
          svg += `<line class="ledger" x1="${nx - 13}" x2="${nx + 13}" y1="${ly}" y2="${ly}"/>`;
        }
        svg += `<g class="${cls}">`;
        if (Music.isBlack(m)) svg += `<text class="accidental" x="${nx - 24}" y="${ny + 6}" font-size="20">♯</text>`;
        svg += `<ellipse cx="${nx}" cy="${ny}" rx="7.6" ry="5.6" transform="rotate(-20 ${nx} ${ny})"/>`;
        if (!opts.noStems && n.midis.length === 1) {
          const middle = topD - 4;
          if (d < middle) svg += `<line class="stem" x1="${nx + 6.8}" x2="${nx + 6.8}" y1="${ny - 1}" y2="${ny - 36}"/>`;
          else svg += `<line class="stem" x1="${nx - 6.8}" x2="${nx - 6.8}" y1="${ny + 1}" y2="${ny + 36}"/>`;
        }
        svg += `</g>`;
      });
      if (opts.labels && n.label) {
        svg += `<text class="note-label ${n.state || ''}" x="${x}" y="${height - 6}" text-anchor="middle">${n.label}</text>`;
      }
    });
    svg += '</svg>';
    return svg;
  }

  return { render };
})();
