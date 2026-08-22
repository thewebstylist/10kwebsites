'use strict';
/*
 * Procedural SVG asset kit.
 *
 * The template is designed around real photography and transparent product
 * cut-outs. Until a brand supplies those, every image slot is filled with a
 * generated SVG drawn from that brand's own palette, so a fresh brand looks
 * intentional on the very first build. Any generated file can be replaced by
 * dropping a real asset path into the brand file - see docs/BRIEF.md.
 */

const DISPLAY = "'Arial Narrow','Liberation Sans Narrow','DejaVu Sans Condensed','Haettenschweiler',Impact,sans-serif";
const BODY = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">${body}</svg>`;

/* deterministic per-slot jitter so repeated shapes are not identical */
function seeded(seed) {
  let s = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---------------------------------------------------------------- motifs -- */
/* The recurring floating decoration. Outlined only, no fill, so it can drift
   over any colour block without covering copy. */
const MOTIFS = {
  slice: (c) => `
    <circle cx="50" cy="50" r="44" fill="none" stroke="${c}" stroke-width="2.6"/>
    <circle cx="50" cy="50" r="35" fill="none" stroke="${c}" stroke-width="1.8"/>
    <circle cx="50" cy="50" r="4.5" fill="none" stroke="${c}" stroke-width="1.8"/>
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI * 2) / 8 + Math.PI / 8;
      const x1 = 50 + Math.cos(a) * 6.5, y1 = 50 + Math.sin(a) * 6.5;
      const x2 = 50 + Math.cos(a) * 34, y2 = 50 + Math.sin(a) * 34;
      const b = a + Math.PI / 8;
      const x3 = 50 + Math.cos(b) * 34, y3 = 50 + Math.sin(b) * 34;
      const x4 = 50 + Math.cos(b) * 6.5, y4 = 50 + Math.sin(b) * 6.5;
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A34 34 0 0 1 ${x3.toFixed(1)} ${y3.toFixed(1)} L${x4.toFixed(1)} ${y4.toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }).join('')}`,

  leaf: (c) => `
    <path d="M50 6C24 24 12 46 14 68c2 20 18 26 30 26s28-6 30-26C76 46 70 24 50 6Z" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M50 12v82" fill="none" stroke="${c}" stroke-width="1.8"/>
    ${[26, 40, 54, 68].map((y, i) => {
      const s = 16 + i * 4;
      return `<path d="M50 ${y} C${50 - s / 2} ${y + 4} ${50 - s} ${y + 10} ${50 - s} ${y + 14}M50 ${y} C${50 + s / 2} ${y + 4} ${50 + s} ${y + 10} ${50 + s} ${y + 14}" fill="none" stroke="${c}" stroke-width="1.4"/>`;
    }).join('')}`,

  spark: (c) => `
    <path d="M50 4 C54 32 68 46 96 50 C68 54 54 68 50 96 C46 68 32 54 4 50 C32 46 46 32 50 4Z" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="12" fill="none" stroke="${c}" stroke-width="1.5"/>`,

  wave: (c) => `
    ${[0, 1, 2].map((i) => `<path d="M4 ${34 + i * 16} q23 -16 46 0 t46 0" fill="none" stroke="${c}" stroke-width="${2.6 - i * 0.4}" stroke-linecap="round"/>`).join('')}
    <circle cx="50" cy="14" r="7" fill="none" stroke="${c}" stroke-width="1.8"/>`,

  bloom: (c) => `
    ${Array.from({ length: 6 }, (_, i) => `<ellipse cx="50" cy="26" rx="13" ry="23" fill="none" stroke="${c}" stroke-width="2.1" transform="rotate(${i * 60} 50 50)"/>`).join('')}
    <circle cx="50" cy="50" r="8" fill="none" stroke="${c}" stroke-width="1.8"/>`,

  arc: (c) => `
    ${[44, 33, 22].map((r, i) => `<path d="M${50 - r} 66 a${r} ${r} 0 0 1 ${r * 2} 0" fill="none" stroke="${c}" stroke-width="${2.6 - i * 0.4}" stroke-linecap="round"/>`).join('')}
    <path d="M4 66h92" fill="none" stroke="${c}" stroke-width="1.6"/>`,

  ring: (c) => `
    <circle cx="40" cy="46" r="32" fill="none" stroke="${c}" stroke-width="2.4"/>
    <circle cx="62" cy="58" r="32" fill="none" stroke="${c}" stroke-width="1.7"/>`,

  bolt: (c) => `
    <path d="M56 4 26 56h20l-8 40 34-56H50l6-36Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="45" fill="none" stroke="${c}" stroke-width="1.3" stroke-dasharray="5 7"/>`
};

function motif(name, color) {
  const draw = MOTIFS[name] || MOTIFS.slice;
  return svg(100, 100, `<title>Decorative motif</title>${draw(color)}`);
}

/* --------------------------------------------------------------- product -- */
/* Flat vector stand-in for a transparent product cut-out. Drawn on a
   transparent canvas so the template's drop-shadow and rotation read
   correctly, exactly as they would with a real PNG. */
/* Text on a label has to fit the label, whatever font the viewer's machine
   actually resolves. textLength pins every line to an exact width so the
   result is identical on a Mac, on Windows and on a bare Linux box. */
function fitted(text, cx, y, width, opts) {
  const t = String(text || '');
  if (!t) return '';
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${opts.font}"
    font-size="${opts.size}" fill="${opts.fill}"
    textLength="${Math.round(width)}" lengthAdjust="spacingAndGlyphs"
    ${opts.opacity ? `opacity="${opts.opacity}"` : ''}>${esc(t)}</text>`;
}

function labelBlock(p, x, y, w) {
  const { brandName, productName, meta, ink } = p;
  const name = String(productName || '').toUpperCase();
  const inner = w * 0.86;
  const cx = x + w / 2;
  const size = Math.max(18, Math.min(44, Math.round(inner / (name.length * 0.5))));
  return `
    ${fitted(String(brandName || '').toUpperCase(), cx, y, inner * 0.6,
      { font: BODY, size: 14, fill: ink, opacity: '.85' })}
    <line x1="${x + w * 0.2}" y1="${y + 14}" x2="${x + w * 0.8}" y2="${y + 14}" stroke="${ink}" stroke-width="1.4" opacity=".5"/>
    ${fitted(name, cx, y + 16 + size, inner,
      { font: DISPLAY, size, fill: ink })}
    ${fitted(String(meta || '').toUpperCase(), cx, y + 42 + size, inner * 0.9,
      { font: BODY, size: 11, fill: ink, opacity: '.8' })}`;
}

const SHAPES = {
  can(p) {
    const { body, ink, shade, light } = p;
    return svg(320, 640, `
      <title>${esc(p.alt)}</title>
      <defs><clipPath id="cb"><path d="M46 96c0-14 46-22 114-22s114 8 114 22v452c0 14-46 22-114 22S46 562 46 548Z"/></clipPath></defs>
      <ellipse cx="160" cy="86" rx="108" ry="22" fill="${shade}"/>
      <ellipse cx="160" cy="80" rx="98" ry="18" fill="${light}"/>
      <path d="M46 96c0-14 46-22 114-22s114 8 114 22v452c0 14-46 22-114 22S46 562 46 548Z" fill="${body}"/>
      <g clip-path="url(#cb)">
        <rect x="46" y="74" width="34" height="500" fill="${light}" opacity=".45"/>
        <rect x="240" y="74" width="40" height="500" fill="${shade}" opacity=".35"/>
        <rect x="46" y="188" width="228" height="268" fill="${p.panel}"/>
        <g opacity=".16" transform="translate(96 300) scale(1.28)">${(MOTIFS[p.motif] || MOTIFS.slice)(ink)}</g>
      </g>
      <path d="M46 96c0-14 46-22 114-22s114 8 114 22v452c0 14-46 22-114 22S46 562 46 548Z" fill="none" stroke="${shade}" stroke-width="2"/>
      ${labelBlock(p, 46, 236, 228)}
      <ellipse cx="160" cy="548" rx="114" ry="20" fill="${shade}" opacity=".55"/>`);
  },

  bottle(p) {
    const { body, ink, shade, light } = p;
    return svg(320, 700, `
      <title>${esc(p.alt)}</title>
      <defs><clipPath id="cb"><path d="M126 40h68v92c0 34 62 66 62 126v334c0 40-28 62-96 62s-96-22-96-62V258c0-60 62-92 62-126Z"/></clipPath></defs>
      <path d="M126 40h68v92c0 34 62 66 62 126v334c0 40-28 62-96 62s-96-22-96-62V258c0-60 62-92 62-126Z" fill="${body}"/>
      <g clip-path="url(#cb)">
        <rect x="64" y="40" width="26" height="620" fill="${light}" opacity=".45"/>
        <rect x="228" y="40" width="30" height="620" fill="${shade}" opacity=".3"/>
        <rect x="60" y="300" width="204" height="250" fill="${p.panel}"/>
        <g opacity=".16" transform="translate(102 386) scale(1.16)">${(MOTIFS[p.motif] || MOTIFS.slice)(ink)}</g>
      </g>
      <rect x="118" y="24" width="84" height="34" rx="8" fill="${shade}"/>
      <path d="M126 40h68v92c0 34 62 66 62 126v334c0 40-28 62-96 62s-96-22-96-62V258c0-60 62-92 62-126Z" fill="none" stroke="${shade}" stroke-width="2"/>
      ${labelBlock(p, 60, 344, 204)}`);
  },

  jar(p) {
    const { body, ink, shade, light } = p;
    return svg(360, 560, `
      <title>${esc(p.alt)}</title>
      <defs><clipPath id="cb"><path d="M40 172c0-26 40-40 140-40s140 14 140 40v300c0 30-40 46-140 46S40 502 40 472Z"/></clipPath></defs>
      <rect x="62" y="52" width="236" height="86" rx="18" fill="${shade}"/>
      <rect x="62" y="52" width="60" height="86" rx="18" fill="${light}" opacity=".4"/>
      <path d="M40 172c0-26 40-40 140-40s140 14 140 40v300c0 30-40 46-140 46S40 502 40 472Z" fill="${body}"/>
      <g clip-path="url(#cb)">
        <rect x="40" y="132" width="38" height="400" fill="${light}" opacity=".45"/>
        <rect x="280" y="132" width="40" height="400" fill="${shade}" opacity=".3"/>
        <rect x="40" y="238" width="280" height="196" fill="${p.panel}"/>
        <g opacity=".15" transform="translate(126 268) scale(1.2)">${(MOTIFS[p.motif] || MOTIFS.slice)(ink)}</g>
      </g>
      <path d="M40 172c0-26 40-40 140-40s140 14 140 40v300c0 30-40 46-140 46S40 502 40 472Z" fill="none" stroke="${shade}" stroke-width="2"/>
      ${labelBlock(p, 40, 282, 280)}`);
  },

  box(p) {
    const { body, ink, shade, light } = p;
    return svg(360, 600, `
      <title>${esc(p.alt)}</title>
      <path d="M60 130 180 88l120 42v352l-120 42L60 482Z" fill="${body}"/>
      <path d="M60 130 180 88v396L60 482Z" fill="${light}" opacity=".35"/>
      <path d="M180 88 300 130v352l-120 42Z" fill="${shade}" opacity=".28"/>
      <path d="M60 130 180 172l120-42" fill="none" stroke="${shade}" stroke-width="2"/>
      <path d="M180 172v352" fill="none" stroke="${shade}" stroke-width="1.4" opacity=".5"/>
      <rect x="196" y="236" width="94" height="188" fill="${p.panel}" opacity=".92"/>
      <g opacity=".16" transform="translate(74 250) scale(1)">${(MOTIFS[p.motif] || MOTIFS.slice)(ink)}</g>
      <path d="M60 130 180 88l120 42v352l-120 42L60 482Z" fill="none" stroke="${shade}" stroke-width="2" stroke-linejoin="round"/>
      <g transform="translate(0 40)">${labelBlock(p, 190, 252, 106)}</g>`);
  },

  tube(p) {
    const { body, ink, shade, light } = p;
    return svg(300, 620, `
      <title>${esc(p.alt)}</title>
      <defs><clipPath id="cb"><path d="M64 128h172v382c0 40-30 60-86 60s-86-20-86-60Z"/></clipPath></defs>
      <rect x="120" y="34" width="60" height="46" rx="8" fill="${shade}"/>
      <rect x="96" y="76" width="108" height="30" rx="6" fill="${shade}" opacity=".8"/>
      <path d="M64 128h172v382c0 40-30 60-86 60s-86-20-86-60Z" fill="${body}"/>
      <g clip-path="url(#cb)">
        <rect x="64" y="106" width="26" height="480" fill="${light}" opacity=".45"/>
        <rect x="212" y="106" width="24" height="480" fill="${shade}" opacity=".3"/>
        <rect x="64" y="240" width="172" height="222" fill="${p.panel}"/>
        <g opacity=".15" transform="translate(94 292) scale(1.1)">${(MOTIFS[p.motif] || MOTIFS.slice)(ink)}</g>
      </g>
      <path d="M64 128h172v382c0 40-30 60-86 60s-86-20-86-60Z" fill="none" stroke="${shade}" stroke-width="2"/>
      ${labelBlock(p, 64, 286, 172)}`);
  },

  pouch(p) {
    const { body, ink, shade, light } = p;
    return svg(340, 580, `
      <title>${esc(p.alt)}</title>
      <defs><clipPath id="cb"><path d="M56 96h228l-14 372c-2 44-38 62-100 62s-98-18-100-62Z"/></clipPath></defs>
      <path d="M56 96h228l-14 372c-2 44-38 62-100 62s-98-18-100-62Z" fill="${body}"/>
      <g clip-path="url(#cb)">
        <rect x="56" y="70" width="34" height="500" fill="${light}" opacity=".42"/>
        <rect x="256" y="70" width="34" height="500" fill="${shade}" opacity=".3"/>
        <rect x="56" y="218" width="228" height="212" fill="${p.panel}"/>
        <g opacity=".15" transform="translate(116 268) scale(1.1)">${(MOTIFS[p.motif] || MOTIFS.slice)(ink)}</g>
      </g>
      <path d="M56 70h228v34H56Z" fill="${shade}"/>
      <path d="M56 96h228l-14 372c-2 44-38 62-100 62s-98-18-100-62Z" fill="none" stroke="${shade}" stroke-width="2"/>
      ${labelBlock(p, 56, 264, 228)}`);
  }
};

function product(opts) {
  const draw = SHAPES[opts.shape] || SHAPES.can;
  return draw(opts);
}

/* ------------------------------------------------------------------ muse -- */
/* The oversized line-art illustration that sits behind the product in the
   intro and closing sections. Outlined, never a filled block. */
function muse(color) {
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = (i * Math.PI * 2) / 18;
    const x1 = 300 + Math.cos(a) * 150, y1 = 300 + Math.sin(a) * 150;
    const x2 = 300 + Math.cos(a) * (196 + (i % 3) * 22), y2 = 300 + Math.sin(a) * (196 + (i % 3) * 22);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join('');
  return svg(600, 820, `
    <title>Decorative illustration</title>
    <g fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round">
      <circle cx="300" cy="300" r="150"/>
      <circle cx="300" cy="300" r="118" stroke-width="1.8"/>
      <g stroke-width="2.2">${rays}</g>
      <path d="M120 470h360" stroke-width="2"/>
      <path d="M186 470c0-118 52-186 114-186s114 68 114 186" stroke-width="2.4"/>
      <path d="M300 470v300" stroke-width="2.4"/>
      <path d="M300 560c-58 0-96-34-104-92M300 560c58 0 96-34 104-92" stroke-width="2"/>
      <path d="M232 770h136" stroke-width="2.4"/>
      <ellipse cx="300" cy="284" rx="58" ry="74" stroke-width="1.6" opacity=".7"/>
      <path d="M60 640q60-52 120 0t120 0 120 0 120 0" stroke-width="1.8" opacity=".6"/>
      <path d="M60 690q60-52 120 0t120 0 120 0 120 0" stroke-width="1.4" opacity=".4"/>
    </g>`);
}

/* ----------------------------------------------------------------- photo -- */
/* Editorial stand-in panel. Flat colour blocking and geometry rather than a
   grey box, so card layouts read at full strength before real photography. */
function photo(opts) {
  const { label, seed, base, ink, accent, motifName } = opts;
  const rnd = seeded(seed || label || 'x');
  const W = 900, H = 1100;
  const horizon = 420 + Math.round(rnd() * 200);
  const sunX = 180 + Math.round(rnd() * 540);
  const sunR = 120 + Math.round(rnd() * 90);
  const bars = Array.from({ length: 7 }, (_, i) => {
    const y = horizon + 40 + i * 88;
    const w = 180 + Math.round(rnd() * 600);
    const x = Math.round(rnd() * (W - w));
    return `<rect x="${x}" y="${y}" width="${w}" height="${18 + Math.round(rnd() * 26)}" rx="14" fill="${ink}" opacity="${(0.06 + rnd() * 0.1).toFixed(2)}"/>`;
  }).join('');
  const dots = Array.from({ length: 26 }, () => {
    const x = Math.round(rnd() * W), y = Math.round(rnd() * H), r = 3 + Math.round(rnd() * 9);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}" opacity="${(0.05 + rnd() * 0.09).toFixed(2)}"/>`;
  }).join('');
  return svg(W, H, `
    <title>${esc(label || 'Placeholder image')}</title>
    <rect width="${W}" height="${H}" fill="${base}"/>
    <circle cx="${sunX}" cy="${horizon - 40}" r="${sunR}" fill="${accent}" opacity=".9"/>
    <circle cx="${sunX}" cy="${horizon - 40}" r="${sunR + 46}" fill="none" stroke="${accent}" stroke-width="3" opacity=".55"/>
    <rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="${ink}" opacity=".08"/>
    <path d="M0 ${horizon}h${W}" stroke="${ink}" stroke-width="3" opacity=".35"/>
    ${bars}${dots}
    <g opacity=".22" transform="translate(${W - 250} 70) scale(1.7)">${(MOTIFS[motifName] || MOTIFS.slice)(ink)}</g>
    <text x="52" y="${H - 54}" font-family="${BODY}" font-size="26" letter-spacing="7"
      fill="${ink}" opacity=".55">${esc(String(label || '').toUpperCase())}</text>`);
}

module.exports = { motif, product, muse, photo, MOTIF_NAMES: Object.keys(MOTIFS), SHAPE_NAMES: Object.keys(SHAPES) };
