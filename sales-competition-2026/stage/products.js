export function productSVG(art, uid) {
  if (art === "ps5") return ps5(uid);
  if (art === "ninja") return ninja(uid);
  if (art === "camera") return camera(uid);
  if (art === "prism-warm") return prism(uid, "warm");
  return prism(uid, "cool");
}

function ps5(uid) {
  const p = `ps-${uid}`;
  return `<svg viewBox="0 0 640 760" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${p}-l" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.55" stop-color="#e7edf5"/>
        <stop offset="1" stop-color="#b7c3d4"/>
      </linearGradient>
      <linearGradient id="${p}-r" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fbfcfe"/>
        <stop offset="0.5" stop-color="#d5deea"/>
        <stop offset="1" stop-color="#9eacbf"/>
      </linearGradient>
      <linearGradient id="${p}-c" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#465068"/>
        <stop offset="0.5" stop-color="#10151f"/>
        <stop offset="1" stop-color="#2a3344"/>
      </linearGradient>
    </defs>
    <ellipse cx="320" cy="700" rx="170" ry="22" fill="rgba(0,0,0,0.45)"/>
    <ellipse cx="320" cy="692" rx="110" ry="10" fill="rgba(228,180,92,0.35)"/>
    <path d="M246 70 C190 86 156 150 150 250 C142 390 150 560 176 650 C190 692 230 714 268 718 L292 718 L292 78 Z" fill="url(#${p}-l)"/>
    <path d="M394 70 C450 86 484 150 490 250 C498 390 490 560 464 650 C450 692 410 714 372 718 L348 718 L348 78 Z" fill="url(#${p}-r)"/>
    <rect x="286" y="58" width="68" height="668" rx="22" fill="url(#${p}-c)"/>
    <rect x="300" y="150" width="40" height="9" rx="4" fill="#c5d2e4"/>
    <path d="M186 160 C170 250 168 360 188 470" stroke="rgba(255,255,255,0.7)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M150 250 C142 430 168 640 230 700" stroke="rgba(90,150,255,0.85)" stroke-width="4" fill="none"/>
    <rect x="304" y="688" width="32" height="22" rx="6" fill="#141820"/>
  </svg>`;
}

function ninja(uid) {
  const p = `nj-${uid}`;
  return `<svg viewBox="0 0 760 640" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${p}-steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.5" stop-color="#d5dde6"/>
        <stop offset="1" stop-color="#8e9bab"/>
      </linearGradient>
      <linearGradient id="${p}-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(230,242,255,0.85)"/>
        <stop offset="1" stop-color="rgba(120,160,210,0.3)"/>
      </linearGradient>
      <linearGradient id="${p}-dark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#5b677c"/>
        <stop offset="0.45" stop-color="#232a38"/>
        <stop offset="1" stop-color="#121722"/>
      </linearGradient>
      <linearGradient id="${p}-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe3a8"/>
        <stop offset="1" stop-color="#c4923c"/>
      </linearGradient>
    </defs>
    <ellipse cx="380" cy="575" rx="300" ry="24" fill="rgba(0,0,0,0.4)"/>
    <rect x="78" y="430" width="150" height="58" rx="16" fill="url(#${p}-steel)"/>
    <path d="M104 150 H202 L184 430 H122 Z" fill="url(#${p}-glass)" stroke="rgba(255,255,255,0.85)" stroke-width="4"/>
    <path d="M128 176 H150 L142 400 H124 Z" fill="rgba(255,255,255,0.55)"/>
    <rect x="98" y="122" width="112" height="34" rx="12" fill="url(#${p}-steel)"/>
    <rect x="138" y="96" width="32" height="30" rx="8" fill="url(#${p}-gold)"/>

    <path d="M300 230 H470 C486 230 498 250 498 270 V470 C498 500 470 520 430 520 H340 C300 520 272 500 272 470 V270 C272 250 284 230 300 230 Z" fill="url(#${p}-dark)"/>
    <ellipse cx="385" cy="236" rx="108" ry="26" fill="url(#${p}-steel)"/>
    <ellipse cx="385" cy="214" rx="72" ry="16" fill="#eef3f8"/>
    <rect x="370" y="176" width="30" height="28" rx="9" fill="url(#${p}-gold)"/>
    <rect x="214" y="320" width="52" height="20" rx="10" fill="url(#${p}-steel)"/>
    <rect x="504" y="320" width="52" height="20" rx="10" fill="url(#${p}-steel)"/>

    <rect x="560" y="168" width="160" height="300" rx="36" fill="url(#${p}-dark)" stroke="url(#${p}-gold)" stroke-width="4"/>
    <circle cx="640" cy="300" r="62" fill="#0c121c" stroke="#e7c27a" stroke-width="7"/>
    <circle cx="640" cy="300" r="36" fill="rgba(160,200,255,0.25)"/>
    <path d="M618 284 Q640 304 664 280" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="600" y="430" width="80" height="18" rx="9" fill="url(#${p}-steel)"/>
  </svg>`;
}

function camera(uid) {
  const p = `cam-${uid}`;
  return `<svg viewBox="0 0 760 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${p}-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#66758c"/>
        <stop offset="0.4" stop-color="#2a3142"/>
        <stop offset="1" stop-color="#121722"/>
      </linearGradient>
      <linearGradient id="${p}-grip" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#161b26"/>
        <stop offset="1" stop-color="#3a4458"/>
      </linearGradient>
      <radialGradient id="${p}-lens" cx="36%" cy="34%" r="70%">
        <stop offset="0" stop-color="#eef5ff"/>
        <stop offset="0.28" stop-color="#8eb0dc"/>
        <stop offset="0.62" stop-color="#1c3048"/>
        <stop offset="1" stop-color="#070b12"/>
      </radialGradient>
      <linearGradient id="${p}-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffe6b0"/>
        <stop offset="1" stop-color="#b8893a"/>
      </linearGradient>
    </defs>
    <ellipse cx="390" cy="545" rx="230" ry="22" fill="rgba(0,0,0,0.42)"/>
    <rect x="70" y="210" width="96" height="250" rx="26" fill="url(#${p}-grip)"/>
    <rect x="130" y="168" width="390" height="270" rx="40" fill="url(#${p}-body)"/>
    <rect x="210" y="112" width="180" height="68" rx="18" fill="#30384a"/>
    <rect x="232" y="132" width="64" height="16" rx="8" fill="url(#${p}-gold)"/>
    <circle cx="545" cy="300" r="132" fill="#10141c" stroke="#d5deea" stroke-width="10"/>
    <circle cx="545" cy="300" r="100" fill="url(#${p}-lens)"/>
    <circle cx="545" cy="300" r="42" fill="#0b1524"/>
    <circle cx="508" cy="262" r="18" fill="rgba(255,255,255,0.72)"/>
    <circle cx="600" cy="196" r="18" fill="#1c2433" stroke="url(#${p}-gold)" stroke-width="5"/>
  </svg>`;
}

function prism(uid, tone) {
  const p = `pr-${uid}`;
  const a = tone === "warm" ? "#fff1d6" : "#e7f2ff";
  const b = tone === "warm" ? "#e0b56a" : "#8eb0d4";
  const c = tone === "warm" ? "#8d6438" : "#24344c";
  const core = tone === "warm" ? "rgba(255,196,110,0.85)" : "rgba(80,160,255,0.8)";
  const edge = tone === "warm" ? "#ffe0a4" : "#b9dcff";
  return `<svg viewBox="0 0 640 820" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${p}-m" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a}"/>
        <stop offset="0.38" stop-color="${b}"/>
        <stop offset="1" stop-color="${c}"/>
      </linearGradient>
      <radialGradient id="${p}-c" cx="50%" cy="42%" r="60%">
        <stop offset="0" stop-color="${core}"/>
        <stop offset="1" stop-color="rgba(0,0,0,0)"/>
      </radialGradient>
    </defs>
    <ellipse cx="320" cy="760" rx="160" ry="20" fill="rgba(0,0,0,0.45)"/>
    <ellipse cx="320" cy="750" rx="100" ry="10" fill="${edge}" opacity="0.45"/>
    <rect x="175" y="48" width="290" height="680" rx="64" fill="url(#${p}-m)"/>
    <rect x="204" y="82" width="232" height="612" rx="46" fill="#070b12"/>
    <rect x="204" y="82" width="232" height="612" rx="46" fill="url(#${p}-c)"/>
    <path d="M236 130 H404" stroke="${edge}" stroke-width="4"/>
    <rect x="286" y="156" width="68" height="10" rx="5" fill="${edge}"/>
    <path d="M230 200 C300 340 300 500 236 640" stroke="rgba(255,255,255,0.45)" stroke-width="18" fill="none" stroke-linecap="round"/>
  </svg>`;
}
