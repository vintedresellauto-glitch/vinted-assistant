import { useState, useRef, useCallback, useEffect } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CATEGORY_PREFIXES = {
  camiseta:"CAM", camisa:"CAM", top:"CAM", blusa:"CAM", polo:"CAM",
  pantalon:"PAN", pantalón:"PAN", vaquero:"PAN", jeans:"PAN", shorts:"PAN", bermuda:"PAN",
  vestido:"VES", falda:"FAL",
  chaqueta:"CHA", blazer:"CHA", americana:"CHA",
  abrigo:"ABR", cazadora:"ABR", parka:"ABR", anorak:"ABR",
  jersey:"JER", sudadera:"JER", suéter:"JER", sweater:"JER",
  calzado:"CAL", zapato:"CAL", zapatilla:"CAL", bota:"CAL", sandalia:"CAL",
  accesorio:"ACC", bolso:"ACC", cinturón:"ACC", bufanda:"ACC", gorro:"ACC",
};

const CATEGORIES_LIST = ["Todas","camiseta","pantalón","vestido","falda","chaqueta","abrigo","jersey","calzado","accesorio"];
const CONDITIONS_LIST = ["Nuevo con etiqueta","Nuevo sin etiqueta","Muy buen estado","Buen estado","Aceptable"];
const SIZES_LIST = ["XS","S","M","L","XL","XXL","34","36","38","40","42","44","46","36EU","37EU","38EU","39EU","40EU","41EU","42EU","Única"];

const DEFAULT_PROMPT = `Analiza esta prenda de ropa y devuelve ÚNICAMENTE un JSON válido con esta estructura exacta, sin texto adicional ni backticks:
{
  "title_en": "título corto en inglés con marca, tipo de prenda y talla (máx 60 caracteres)",
  "description_es": "descripción en español de 3-4 líneas destacando puntos fuertes, estado y características",
  "brand": "marca detectada o Unknown",
  "category": "tipo de prenda en español (camiseta, pantalón, vestido, chaqueta, abrigo, jersey, calzado, accesorio)",
  "color": "color principal en español",
  "size": "talla detectada o estima según proporción",
  "condition": "Nuevo con etiqueta / Nuevo sin etiqueta / Muy buen estado / Buen estado / Aceptable",
  "hashtags": ["hashtag1","hashtag2","hashtag3","hashtag4","hashtag5"],
  "price_min": número entero euros,
  "price_rec": número entero euros,
  "price_target": número entero euros,
  "price_premium": número entero euros
}`;

// ─── CANVAS COMPOSITION ──────────────────────────────────────────────────────
// Replicates the reference style: white background, wooden hanger centered top,
// soft diffused lighting, natural fabric drape, product-photo look.

const HANGER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 180" width="400" height="180">
  <defs>
    <linearGradient id="wood" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"  stop-color="#C8986A"/>
      <stop offset="40%" stop-color="#A0723E"/>
      <stop offset="100%" stop-color="#7A5230"/>
    </linearGradient>
    <linearGradient id="hook" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"  stop-color="#888"/>
      <stop offset="50%" stop-color="#CCCCCC"/>
      <stop offset="100%" stop-color="#999"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.18)"/>
    </filter>
  </defs>
  <!-- Hook -->
  <path d="M200 8 Q200 0 208 0 Q220 0 220 12 Q220 26 208 32 L204 35"
        fill="none" stroke="url(#hook)" stroke-width="5" stroke-linecap="round"/>
  <!-- Hanger body -->
  <g filter="url(#shadow)">
    <path d="M200 35 Q200 55 130 100 Q80 120 30 128 Q18 130 16 138 Q14 146 24 148 Q34 150 50 142 L50 146 Q30 156 18 152 Q4 146 6 136 Q8 124 26 120 Q78 112 126 92 Q196 64 200 42 Q204 64 274 92 Q322 112 374 120 Q392 124 394 136 Q396 146 382 152 L382 148 Q398 142 376 138 Q364 130 352 128 Q302 120 270 100 Q200 55 200 35Z"
          fill="url(#wood)" rx="4"/>
    <!-- Wood grain lines -->
    <path d="M80 118 Q140 100 200 98 Q260 100 320 118" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <path d="M60 124 Q140 106 200 104 Q260 106 340 124" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="0.5"/>
  </g>
</svg>`;

async function composeWithHanger(noBgDataUrl, view = "FRONT") {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const W = 800, H = 1000;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // 1. White background with subtle vignette (studio look)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    // Soft vignette for studio feel
    const vignette = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(235,235,235,0.4)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // 2. Draw garment (removed background PNG)
    const garment = new Image();
    garment.onload = () => {
      // Natural fabric variation: subtle random rotation & drape offset
      const wobble = (Math.random() - 0.5) * 0.012; // ±0.7°
      const driftX = (Math.random() - 0.5) * 8;
      const driftY = (Math.random() - 0.5) * 6;

      // Garment fills ~72% of canvas width, positioned below hanger
      const gW = W * 0.72;
      const gH = (garment.height / garment.width) * gW;
      const gX = (W - gW) / 2 + driftX;
      const gY = H * 0.16 + driftY; // starts just below hanger crossbar

      ctx.save();
      ctx.translate(W / 2 + driftX, gY + gH / 2);
      ctx.rotate(wobble);

      // Soft shadow under garment
      ctx.shadowColor = "rgba(0,0,0,0.10)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(garment, -gW / 2, -gH / 2, gW, gH);
      ctx.restore();

      // 3. Draw SVG hanger on top
      const svgBlob = new Blob([HANGER_SVG], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const hanger = new Image();
      hanger.onload = () => {
        const hW = W * 0.62;
        const hH = (180 / 400) * hW;
        const hX = (W - hW) / 2;
        const hY = H * 0.055;
        ctx.drawImage(hanger, hX, hY, hW, hH);
        URL.revokeObjectURL(svgUrl);

        // 4. FRONT/BACK watermark (subtle, bottom center)
        ctx.font = "500 13px 'DM Sans', sans-serif";
        ctx.fillStyle = "rgba(160,152,144,0.6)";
        ctx.textAlign = "center";
        ctx.fillText(view === "BACK" ? "BACK VIEW" : "FRONT VIEW", W / 2, H - 18);

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      hanger.src = svgUrl;
    };
    garment.src = noBgDataUrl;
  });
}

async function removeBackground(file, apiKey) {
  if (!apiKey) return null;
  const formData = new FormData();
  formData.append("image_file", file);
  formData.append("size", "auto");
  try {
    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST", headers: { "X-Api-Key": apiKey }, body: formData,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } catch { return null; }
}

async function analyzeWithMistral(base64Image, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: "Eres un experto en moda y segunda mano. Analiza imágenes de prendas y devuelve SOLO JSON válido sin texto adicional ni backticks.",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
        { type: "text", text: prompt }
      ]}]
    })
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

const loadInventory  = () => { try { return JSON.parse(localStorage.getItem("vinted_inv") || "[]"); } catch { return []; } };
const saveInventory  = (d) => localStorage.setItem("vinted_inv", JSON.stringify(d));
const loadCounters   = () => { try { return JSON.parse(localStorage.getItem("vinted_cnt") || "{}"); } catch { return {}; } };
const saveCounters   = (d) => localStorage.setItem("vinted_cnt", JSON.stringify(d));
const loadSettings   = () => { try { return JSON.parse(localStorage.getItem("vinted_cfg") || "{}"); } catch { return {}; } };
const saveSettings   = (d) => localStorage.setItem("vinted_cfg", JSON.stringify(d));

function generateSKU(category, counters) {
  const cat = (category || "").toLowerCase();
  let prefix = "OTR";
  for (const [k, v] of Object.entries(CATEGORY_PREFIXES)) { if (cat.includes(k)) { prefix = v; break; } }
  const count = (counters[prefix] || 0) + 1;
  return { sku: `${prefix}-${String(count).padStart(3,"0")}`, prefix, count };
}

// ─── ZIP DOWNLOAD ─────────────────────────────────────────────────────────────

async function downloadAllImages(composedImages, sku) {
  // Simple sequential download (no JSZip needed)
  for (let i = 0; i < composedImages.length; i++) {
    const a = document.createElement("a");
    a.href = composedImages[i];
    a.download = `${sku}_${i + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    await new Promise(r => setTimeout(r, 300));
  }
}

// ─── ICONS ───────────────────────────────────────────────────────────────────

const PATHS = {
  upload:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  sparkle:"M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z",
  package:"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM12 22V12M3.27 6.96L12 12.01l8.73-5.05",
  settings:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  download:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  check:"M20 6L9 17l-5-5",
  x:"M18 6L6 18M6 6l12 12",
  trash:"M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  search:"M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  export:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  plus:"M12 5v14M5 12h14",
  filter:"M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  images:"M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10.5 5l-5-5L5 20",
  tag:"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
};
const Icon = ({ name, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={PATHS[name]} />
  </svg>
);

// ─── STYLES ──────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#F5F3EE; --surface:#FFFFFF; --surface2:#F0EDE6; --border:#E2DDD6;
  --text:#1A1714; --text2:#6B6560; --text3:#A09890;
  --green:#2D6A4F; --green-lt:#E8F4EE; --green-bd:#B8DFC8;
  --amber:#C9773A; --amber-lt:#FDF1E8; --amber-bd:#F0D4B8;
  --blue:#1A5C9E; --blue-lt:#EBF3FB; --blue-bd:#BDDAF7;
  --red:#C0392B; --red-lt:#FDECEA;
  --r:10px; --r-sm:6px;
  --shadow:0 1px 3px rgba(26,23,20,.08),0 4px 12px rgba(26,23,20,.04);
  --font-d:'DM Serif Display',Georgia,serif;
  --font:'DM Sans',system-ui,sans-serif;
}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;}
/* NAV */
.nav{background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;display:flex;align-items:center;position:sticky;top:0;z-index:100;}
.nav-logo{font-family:var(--font-d);font-size:18px;padding:16px 20px 16px 0;border-right:1px solid var(--border);margin-right:8px;letter-spacing:-.02em;white-space:nowrap;}
.nav-logo em{color:var(--green);font-style:italic;}
.nav-tab{display:flex;align-items:center;gap:7px;padding:18px 16px;font-size:13px;font-weight:500;color:var(--text2);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;}
.nav-tab:hover{color:var(--text);}
.nav-tab.active{color:var(--green);border-bottom-color:var(--green);}
/* LAYOUT */
.main{flex:1;padding:32px 24px;max-width:1140px;margin:0 auto;width:100%;}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
/* CARD */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:22px;box-shadow:var(--shadow);}
.card+.card{margin-top:16px;}
.card-hd{font-family:var(--font-d);font-size:16px;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:10px;}
.card-icon{width:30px;height:30px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;background:var(--green-lt);color:var(--green);flex-shrink:0;}
/* UPLOAD */
.drop{border:2px dashed var(--border);border-radius:var(--r);padding:36px 20px;text-align:center;cursor:pointer;transition:all .2s;background:var(--bg);}
.drop:hover,.drop.drag{border-color:var(--green);background:var(--green-lt);}
.drop p{font-size:13px;color:var(--text2);margin-top:8px;}
.drop small{font-size:11px;color:var(--text3);margin-top:3px;display:block;}
/* PHOTO GRID */
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;}
.pthumb{position:relative;aspect-ratio:1;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--border);background:var(--bg);}
.pthumb img{width:100%;height:100%;object-fit:cover;}
.pthumb-rm{position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(26,23,20,.65);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;}
.pthumb:hover .pthumb-rm{opacity:1;}
.pthumb-lbl{position:absolute;bottom:4px;left:4px;font-size:9px;font-weight:600;padding:2px 6px;border-radius:20px;background:var(--green);color:#fff;letter-spacing:.03em;}
/* COMPOSED GALLERY */
.cgallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:14px;}
.cthumb{position:relative;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--border);background:#fff;aspect-ratio:.8;}
.cthumb img{width:100%;height:100%;object-fit:contain;padding:4px;}
.cthumb-dl{position:absolute;bottom:6px;right:6px;width:26px;height:26px;border-radius:50%;background:var(--surface);border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text2);opacity:0;transition:opacity .15s;}
.cthumb:hover .cthumb-dl{opacity:1;}
.cthumb-view{position:absolute;top:6px;left:6px;font-size:9px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(26,23,20,.55);color:#fff;letter-spacing:.05em;}
/* BTNS */
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:var(--r-sm);font-size:13px;font-weight:500;font-family:var(--font);cursor:pointer;border:1px solid transparent;transition:all .15s;white-space:nowrap;}
.btn:disabled{opacity:.4;cursor:not-allowed;}
.btn-primary{background:var(--green);color:#fff;}
.btn-primary:hover:not(:disabled){background:#245a42;}
.btn-secondary{background:var(--surface);color:var(--text);border-color:var(--border);}
.btn-secondary:hover:not(:disabled){background:var(--surface2);}
.btn-ghost{background:transparent;color:var(--text2);border-color:transparent;}
.btn-ghost:hover{background:var(--surface2);color:var(--text);}
.btn-amber{background:var(--amber);color:#fff;}
.btn-amber:hover:not(:disabled){background:#b5662f;}
.btn-danger{background:var(--red-lt);color:var(--red);border-color:#f5c6c2;}
.btn-sm{padding:5px 11px;font-size:12px;}
/* FORM */
.field{margin-bottom:13px;}
.field label{display:block;font-size:11px;font-weight:600;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em;}
.field input,.field textarea,.field select{width:100%;padding:8px 11px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:var(--font);color:var(--text);background:var(--surface);transition:border-color .15s;}
.field input:focus,.field textarea:focus,.field select:focus{outline:none;border-color:var(--green);}
.field textarea{resize:vertical;min-height:76px;line-height:1.5;}
/* SKU */
.sku{display:inline-block;font-size:12px;font-weight:700;padding:3px 11px;border-radius:20px;background:var(--amber-lt);color:var(--amber);border:1px solid var(--amber-bd);letter-spacing:.06em;font-variant-numeric:tabular-nums;}
/* PRICE */
.pgrid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.pcard{background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;text-align:center;}
.pcard.rec{background:var(--green-lt);border-color:var(--green-bd);}
.plabel{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;}
.pvalue{font-family:var(--font-d);font-size:20px;color:var(--text);}
.pcard.rec .pvalue{color:var(--green);}
/* TAGS */
.tags{display:flex;flex-wrap:wrap;gap:5px;}
.tag{font-size:11px;padding:3px 9px;border-radius:20px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);}
.tag.g{background:var(--green-lt);color:var(--green);border-color:var(--green-bd);}
/* STATUS */
.status{font-size:11px;font-weight:500;padding:3px 9px;border-radius:20px;}
.s-draft{background:var(--surface2);color:var(--text2);border:1px solid var(--border);}
.s-listed{background:var(--blue-lt);color:var(--blue);border:1px solid var(--blue-bd);}
.s-sold{background:var(--green-lt);color:var(--green);border:1px solid var(--green-bd);}
/* INVENTORY TABLE */
.itable{width:100%;border-collapse:collapse;}
.itable th{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;padding:9px 12px;text-align:left;border-bottom:1px solid var(--border);}
.itable td{padding:11px 12px;font-size:13px;color:var(--text);border-bottom:1px solid var(--border);vertical-align:middle;}
.itable tr:last-child td{border-bottom:none;}
.itable tr:hover td{background:var(--bg);}
/* FILTERS */
.filter-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;padding:14px 16px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border);}
.filter-label{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:5px;white-space:nowrap;}
.filter-sel{font-size:12px;padding:5px 9px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);color:var(--text2);font-family:var(--font);cursor:pointer;}
.filter-sel:focus{outline:none;border-color:var(--green);}
.search-wrap{display:flex;align-items:center;gap:7px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:7px 11px;flex:1;min-width:180px;}
.search-wrap input{border:none;background:none;outline:none;font-size:13px;font-family:var(--font);color:var(--text);width:100%;}
.ftab{font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer;transition:all .15s;}
.ftab.active{background:var(--green);color:#fff;border-color:var(--green);}
.ftabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px;}
/* ALERT */
.alert{padding:11px 15px;border-radius:var(--r-sm);font-size:13px;border:1px solid;margin-bottom:12px;}
.alert-warn{background:var(--amber-lt);color:var(--amber);border-color:var(--amber-bd);}
.alert-ok{background:var(--green-lt);color:var(--green);border-color:var(--green-bd);}
.alert-err{background:var(--red-lt);color:var(--red);border-color:#f5c6c2;}
/* PROCESSING */
.spin{width:28px;height:28px;border:2px solid var(--border);border-top-color:var(--green);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.proc{display:flex;flex-direction:column;align-items:center;gap:12px;padding:36px;}
.proc p{font-size:13px;color:var(--text2);}
/* STEP HDR */
.shdr{display:flex;align-items:center;gap:10px;margin-bottom:22px;}
.snum{width:26px;height:26px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;}
.stitle{font-family:var(--font-d);font-size:20px;}
.sdesc{font-size:13px;color:var(--text2);margin-top:2px;}
/* EMPTY */
.empty{text-align:center;padding:56px 20px;color:var(--text3);}
.empty-ic{width:52px;height:52px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:var(--text3);}
.empty h3{font-family:var(--font-d);font-size:17px;color:var(--text2);margin-bottom:5px;}
/* SETTINGS */
.stitle2{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--border);}
/* THUMB MINI */
.inv-thumb{width:38px;height:38px;border-radius:5px;object-fit:cover;border:1px solid var(--border);}
/* TOAST */
.toast{position:fixed;bottom:24px;right:24px;z-index:9999;padding:11px 17px;border-radius:8px;font-size:13px;font-family:var(--font);box-shadow:0 8px 24px rgba(0,0,0,.14);display:flex;align-items:center;gap:10px;max-width:340px;}
/* RESPONSIVE */
@media(max-width:720px){
  .two,.three{grid-template-columns:1fr;}
  .pgrid4{grid-template-columns:1fr 1fr;}
  .main{padding:16px;}
  .nav-logo{font-size:14px;padding:12px 10px 12px 0;}
  .nav-tab{padding:13px 10px;font-size:12px;}
}
`;

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "#C0392B" : type === "warning" ? "#C9773A" : "#2D6A4F";
  return <div className="toast" style={{ background: bg, color: "#fff" }}><span>{msg}</span><button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",cursor:"pointer",opacity:.7 }}>✕</button></div>;
}

// ─── NEW LISTING TAB ─────────────────────────────────────────────────────────

function NewListing({ settings, onSaved, toast }) {
  const [photos, setPhotos] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState(null);
  const [composed, setComposed] = useState([]); // [{url, view}]
  const [copied, setCopied] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const addFiles = useCallback((files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 9 - photos.length);
    valid.forEach(f => fileToDataURL(f).then(url => setPhotos(p => [...p, { file: f, preview: url, id: Math.random().toString(36).slice(2) }])));
  }, [photos.length]);

  const process = async () => {
    if (!photos.length) { toast("Añade al menos una foto","warning"); return; }
    if (!settings.mistralKey) { toast("Configura tu clave Mistral en Ajustes","warning"); return; }
    setProcessing(true); setResult(null); setComposed([]);

    try {
      // 1. Remove background (first photo for analysis, all for composition)
      setStep("Eliminando fondos…");
      const noBgUrls = [];
      for (const p of photos) {
        const noBg = settings.removeBgKey ? await removeBackground(p.file, settings.removeBgKey) : null;
        noBgUrls.push(noBg || p.preview);
      }

      // 2. Compose with hanger: first photo → FRONT, second → BACK (if exists)
      setStep("Componiendo imágenes con percha…");
      const composedImgs = [];
      for (let i = 0; i < noBgUrls.length; i++) {
        const view = i === 1 ? "BACK" : i === 0 ? "FRONT" : `IMG ${i+1}`;
        const url = await composeWithHanger(noBgUrls[i], view);
        composedImgs.push({ url, view });
      }
      setComposed(composedImgs);

      // 3. Analyze with AI
      setStep("Analizando prenda con IA…");
      const b64 = await fileToBase64(photos[0].file);
      const aiResult = await analyzeWithMistral(b64, settings.descPrompt || DEFAULT_PROMPT);

      // 4. SKU
      const counters = loadCounters();
      const { sku, prefix, count } = generateSKU(aiResult.category, counters);
      counters[prefix] = count;
      saveCounters(counters);

      setResult({ ...aiResult, sku, composedImgs });
    } catch (e) {
      toast("Error: " + e.message, "error");
    } finally {
      setProcessing(false); setStep("");
    }
  };

  const copyForVinted = () => {
    const text = `${result.title_en}\n\n${result.description_es}\n\n${(result.hashtags||[]).map(h=>"#"+h).join(" ")}`;
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const dlSingle = (url, name) => { const a = document.createElement("a"); a.href=url; a.download=name; a.click(); };

  const dlAll = () => downloadAllImages(composed.map(c=>c.url), result?.sku || "prenda");

  const save = () => {
    const inv = loadInventory();
    inv.push({
      id: Math.random().toString(36).slice(2),
      sku: result.sku, title_en: result.title_en, description_es: result.description_es,
      brand: result.brand, category: result.category, color: result.color,
      size: result.size, condition: result.condition, hashtags: result.hashtags||[],
      price_min: result.price_min, price_rec: result.price_rec,
      price_target: result.price_target, price_premium: result.price_premium,
      photos: composed.map(c=>c.url),
      status: "draft", created_at: new Date().toISOString(),
    });
    saveInventory(inv);
    toast("Guardado como " + result.sku, "success");
    onSaved();
    setPhotos([]); setResult(null); setComposed([]);
  };

  return (
    <div>
      <div className="shdr">
        <div className="snum">✦</div>
        <div><div className="stitle">Nuevo anuncio</div><div className="sdesc">Sube las fotos · la IA edita, compone y genera todo</div></div>
      </div>

      <div className="two">
        {/* LEFT */}
        <div>
          <div className="card">
            <div className="card-hd"><div className="card-icon"><Icon name="images" size={14}/></div>Fotografías ({photos.length}/9)</div>

            {!photos.length ? (
              <div className={`drop${drag?" drag":""}`}
                onClick={()=>fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();setDrag(true);}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files);}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:"var(--surface)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",color:"var(--text2)"}}>
                  <Icon name="upload" size={20}/>
                </div>
                <p>Arrastra las fotos aquí o haz clic</p>
                <small>JPG · PNG · HEIC · máx. 9 fotos<br/>1ª foto = FRONT VIEW · 2ª foto = BACK VIEW</small>
              </div>
            ) : (
              <div className="pgrid">
                {photos.map((p,i)=>(
                  <div key={p.id} className="pthumb">
                    <img src={p.preview} alt={`foto ${i+1}`}/>
                    <div className="pthumb-lbl">{i===0?"FRONT":i===1?"BACK":`#${i+1}`}</div>
                    <button className="pthumb-rm" onClick={()=>setPhotos(prev=>prev.filter(x=>x.id!==p.id))}><Icon name="x" size={9}/></button>
                  </div>
                ))}
                {photos.length<9 && (
                  <div className="pthumb" style={{cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",border:"2px dashed var(--border)"}} onClick={()=>fileRef.current.click()}>
                    <div style={{color:"var(--text3)",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Icon name="plus" size={16}/><span style={{fontSize:9}}>añadir</span></div>
                  </div>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>addFiles(e.target.files)}/>

            {photos.length>0 && !processing && !result && (
              <button className="btn btn-primary" style={{marginTop:14,width:"100%"}} onClick={process}>
                <Icon name="sparkle" size={14}/> Procesar con IA
              </button>
            )}
            {processing && <div className="proc"><div className="spin"/><p>{step}</p></div>}
          </div>

          {/* COMPOSED IMAGES */}
          {composed.length>0 && (
            <div className="card">
              <div className="card-hd" style={{justifyContent:"space-between"}}>
                <span style={{display:"flex",alignItems:"center",gap:8}}><div className="card-icon"><Icon name="images" size={14}/></div>Imágenes generadas ({composed.length})</span>
                <button className="btn btn-secondary btn-sm" onClick={dlAll}><Icon name="download" size={13}/> Descargar todo</button>
              </div>
              <div className="cgallery">
                {composed.map((c,i)=>(
                  <div key={i} className="cthumb">
                    <img src={c.url} alt={c.view}/>
                    <div className="cthumb-view">{c.view}</div>
                    <button className="cthumb-dl" onClick={()=>dlSingle(c.url,`${result?.sku||"prenda"}_${c.view.replace(" ","_")}.jpg`)}><Icon name="download" size={12}/></button>
                  </div>
                ))}
              </div>
              <p style={{fontSize:11,color:"var(--text3)",marginTop:10,textAlign:"center"}}>Haz clic en ↓ sobre cada imagen para descargar individualmente</p>
            </div>
          )}
        </div>

        {/* RIGHT: result */}
        <div>
          {!result ? (
            <div className="card" style={{minHeight:220,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div className="empty">
                <div className="empty-ic"><Icon name="sparkle" size={22}/></div>
                <h3>Resultado aquí</h3>
                <p>Sube fotos y pulsa "Procesar con IA"</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <span className="sku">{result.sku}</span>
                <button className="btn btn-secondary btn-sm" onClick={copyForVinted}>
                  <Icon name={copied?"check":"copy"} size={12}/>{copied?"Copiado":"Copiar para Vinted"}
                </button>
              </div>

              <div className="field"><label>Título (inglés)</label>
                <input type="text" defaultValue={result.title_en} onChange={e=>setResult(r=>({...r,title_en:e.target.value}))}/>
              </div>
              <div className="field"><label>Descripción (español)</label>
                <textarea rows={4} defaultValue={result.description_es} onChange={e=>setResult(r=>({...r,description_es:e.target.value}))}/>
              </div>

              <div className="two">
                <div className="field"><label>Marca</label><input type="text" defaultValue={result.brand} onChange={e=>setResult(r=>({...r,brand:e.target.value}))}/></div>
                <div className="field"><label>Categoría</label>
                  <select defaultValue={result.category} onChange={e=>setResult(r=>({...r,category:e.target.value}))}>
                    {CATEGORIES_LIST.filter(c=>c!=="Todas").map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field"><label>Talla</label>
                  <select defaultValue={result.size} onChange={e=>setResult(r=>({...r,size:e.target.value}))}>
                    {SIZES_LIST.map(s=><option key={s}>{s}</option>)}
                    <option value={result.size}>{result.size}</option>
                  </select>
                </div>
                <div className="field"><label>Color</label><input type="text" defaultValue={result.color} onChange={e=>setResult(r=>({...r,color:e.target.value}))}/></div>
                <div className="field" style={{gridColumn:"1/-1"}}><label>Estado</label>
                  <select defaultValue={result.condition} onChange={e=>setResult(r=>({...r,condition:e.target.value}))}>
                    {CONDITIONS_LIST.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Precios</label>
                <div className="pgrid4">
                  {[["Mínimo",result.price_min],["Recomendado",result.price_rec,true],["Objetivo",result.price_target],["Premium",result.price_premium]].map(([l,v,r])=>(
                    <div key={l} className={`pcard${r?" rec":""}`}><div className="plabel">{l}</div><div className="pvalue">{v}€</div></div>
                  ))}
                </div>
              </div>

              {result.hashtags?.length>0 && (
                <div style={{marginBottom:16}}>
                  <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Hashtags</label>
                  <div className="tags">{result.hashtags.map(h=><span key={h} className="tag g">#{h}</span>)}</div>
                </div>
              )}

              <button className="btn btn-primary" style={{width:"100%"}} onClick={save}>
                <Icon name="package" size={14}/> Guardar en inventario
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── INVENTORY TAB ────────────────────────────────────────────────────────────

function Inventory({ refresh }) {
  const [items, setItems]       = useState([]);
  const [search, setSearch]     = useState("");
  const [statusF, setStatusF]   = useState("all");
  const [catF, setCatF]         = useState("Todas");
  const [brandF, setBrandF]     = useState("Todas");
  const [sizeF, setSizeF]       = useState("Todas");
  const [colorF, setColorF]     = useState("Todos");

  useEffect(()=>setItems(loadInventory()),[refresh]);

  // Unique values for filter selects
  const brands = ["Todas",...[...new Set(items.map(i=>i.brand).filter(Boolean))].sort()];
  const sizes  = ["Todas",...[...new Set(items.map(i=>i.size).filter(Boolean))].sort()];
  const colors = ["Todos",...[...new Set(items.map(i=>i.color).filter(Boolean))].sort()];

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const mSearch = !q || i.sku?.toLowerCase().includes(q) || i.title_en?.toLowerCase().includes(q) || i.brand?.toLowerCase().includes(q) || i.color?.toLowerCase().includes(q);
    const mStatus = statusF==="all" || i.status===statusF;
    const mCat    = catF==="Todas" || i.category?.toLowerCase().includes(catF.toLowerCase());
    const mBrand  = brandF==="Todas" || i.brand===brandF;
    const mSize   = sizeF==="Todas" || i.size===sizeF;
    const mColor  = colorF==="Todos" || i.color===colorF;
    return mSearch && mStatus && mCat && mBrand && mSize && mColor;
  });

  const counts = { all:items.length, draft:items.filter(i=>i.status==="draft").length, listed:items.filter(i=>i.status==="listed").length, sold:items.filter(i=>i.status==="sold").length };

  const updateStatus = (id,status)=>{ const u=items.map(i=>i.id===id?{...i,status}:i); setItems(u); saveInventory(u); };
  const del = (id)=>{ const u=items.filter(i=>i.id!==id); setItems(u); saveInventory(u); };

  const exportCSV = ()=>{
    const h=["SKU","Título","Marca","Categoría","Color","Talla","Estado artículo","Precio rec.","Estado venta","Fecha"];
    const rows=items.map(i=>[i.sku,i.title_en,i.brand,i.category,i.color,i.size,i.condition,i.price_rec,i.status,new Date(i.created_at).toLocaleDateString("es-ES")]);
    const csv=[h,...rows].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})); a.download="inventario_vinted.csv"; a.click();
  };

  const clearFilters = ()=>{ setCatF("Todas"); setBrandF("Todas"); setSizeF("Todas"); setColorF("Todos"); setSearch(""); };
  const hasFilters = catF!=="Todas"||brandF!=="Todas"||sizeF!=="Todas"||colorF!=="Todos"||search;

  return (
    <div>
      <div className="shdr">
        <div className="snum"><Icon name="package" size={13}/></div>
        <div><div className="stitle">Inventario</div><div className="sdesc">{items.length} prendas · {counts.listed} publicadas · {counts.sold} vendidas</div></div>
      </div>

      <div className="card">
        {/* SEARCH + EXPORT */}
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <div className="search-wrap"><Icon name="search" size={14}/><input placeholder="Buscar SKU, título, marca, color…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <button className="btn btn-secondary" onClick={exportCSV}><Icon name="export" size={13}/> CSV</button>
        </div>

        {/* STATUS TABS */}
        <div className="ftabs">
          {[["all",`Todas (${counts.all})`],["draft",`Borrador (${counts.draft})`],["listed",`Publicadas (${counts.listed})`],["sold",`Vendidas (${counts.sold})`]].map(([v,l])=>(
            <div key={v} className={`ftab${statusF===v?" active":""}`} onClick={()=>setStatusF(v)}>{l}</div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div className="filter-bar">
          <span className="filter-label"><Icon name="filter" size={12}/> Filtros</span>
          <select className="filter-sel" value={catF} onChange={e=>setCatF(e.target.value)}>
            {CATEGORIES_LIST.map(c=><option key={c}>{c}</option>)}
          </select>
          <select className="filter-sel" value={brandF} onChange={e=>setBrandF(e.target.value)}>
            {brands.map(b=><option key={b}>{b}</option>)}
          </select>
          <select className="filter-sel" value={sizeF} onChange={e=>setSizeF(e.target.value)}>
            {sizes.map(s=><option key={s}>{s}</option>)}
          </select>
          <select className="filter-sel" value={colorF} onChange={e=>setColorF(e.target.value)}>
            {colors.map(c=><option key={c}>{c}</option>)}
          </select>
          {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters}><Icon name="x" size={12}/> Limpiar</button>}
          <span style={{marginLeft:"auto",fontSize:12,color:"var(--text3)"}}>{filtered.length} resultado{filtered.length!==1?"s":""}</span>
        </div>

        {/* TABLE */}
        {!filtered.length ? (
          <div className="empty">
            <div className="empty-ic"><Icon name="package" size={22}/></div>
            <h3>{items.length?"Sin resultados":"Inventario vacío"}</h3>
            <p>{items.length?"Prueba cambiando los filtros":"Crea tu primer anuncio para empezar"}</p>
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table className="itable">
              <thead><tr>
                <th></th><th>SKU</th><th>Título</th><th>Marca</th><th>Cat.</th><th>Color</th><th>Talla</th><th>Precio</th><th>Estado</th><th>Fecha</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(item=>(
                  <tr key={item.id}>
                    <td>{item.photos?.[0] && <img className="inv-thumb" src={item.photos[0]} alt="thumb"/>}</td>
                    <td><span className="sku" style={{fontSize:11}}>{item.sku}</span></td>
                    <td style={{maxWidth:180}}><div style={{fontWeight:500,fontSize:13}}>{item.title_en}</div><div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{item.condition}</div></td>
                    <td style={{color:"var(--text2)"}}>{item.brand}</td>
                    <td style={{color:"var(--text2)",fontSize:12}}>{item.category}</td>
                    <td style={{color:"var(--text2)"}}>{item.color}</td>
                    <td style={{color:"var(--text2)"}}>{item.size}</td>
                    <td style={{fontWeight:600}}>{item.price_rec}€</td>
                    <td>
                      <select value={item.status} onChange={e=>updateStatus(item.id,e.target.value)}
                        style={{fontSize:12,padding:"3px 8px",borderRadius:20,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text2)",fontFamily:"var(--font)",cursor:"pointer"}}>
                        <option value="draft">Borrador</option>
                        <option value="listed">Publicada</option>
                        <option value="sold">Vendida</option>
                      </select>
                    </td>
                    <td style={{color:"var(--text3)",fontSize:11}}>{new Date(item.created_at).toLocaleDateString("es-ES")}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={()=>del(item.id)} style={{color:"var(--red)"}}><Icon name="trash" size={13}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────

function Settings({ settings, onSave }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const save = () => { onSave(form); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  return (
    <div>
      <div className="shdr">
        <div className="snum"><Icon name="settings" size={13}/></div>
        <div><div className="stitle">Configuración</div><div className="sdesc">Se configura una vez y se reutiliza en todos los anuncios</div></div>
      </div>
      <div className="two">
        <div>
          <div className="card">
            <div className="stitle2">Claves API</div>
            <div className="field"><label>Mistral API Key *</label>
              <input type="password" placeholder="console.mistral.ai → API Keys" value={form.mistralKey||""} onChange={e=>setForm(f=>({...f,mistralKey:e.target.value}))}/>
            </div>
            <div className="field"><label>Remove.bg API Key (opcional)</label>
              <input type="password" placeholder="remove.bg → Account → API Key" value={form.removeBgKey||""} onChange={e=>setForm(f=>({...f,removeBgKey:e.target.value}))}/>
              <div style={{fontSize:11,color:"var(--text3)",marginTop:3}}>Sin esta clave se compone la imagen sin eliminar fondo</div>
            </div>
          </div>
          <div className="card">
            <div className="stitle2">Dónde conseguir las claves</div>
            {[["Mistral API Key","console.mistral.ai → API Keys → Create Key","Gratis · solo verificación de teléfono"],["Remove.bg","remove.bg → Account → API Key","50 imágenes/mes gratis"]].map(([n,s,d])=>(
              <div key={n} style={{padding:"10px 12px",background:"var(--bg)",borderRadius:6,border:"1px solid var(--border)",marginBottom:8}}>
                <div style={{fontWeight:500,fontSize:13,marginBottom:2}}>{n}</div>
                <div style={{fontSize:12,color:"var(--text2)"}}>{s}</div>
                <div style={{fontSize:11,color:"var(--green)",marginTop:2}}>{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="card">
            <div className="stitle2">Prompt de descripción personalizado</div>
            <div className="field"><label>Plantilla (deja vacío para usar la predeterminada)</label>
              <textarea rows={10} placeholder={DEFAULT_PROMPT} value={form.descPrompt||""} onChange={e=>setForm(f=>({...f,descPrompt:e.target.value}))}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-primary" onClick={save}><Icon name={saved?"check":"settings"} size={14}/>{saved?"Guardado":"Guardar"}</button>
              <button className="btn btn-secondary" onClick={()=>setForm(f=>({...f,descPrompt:""}))}>Restaurar por defecto</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]         = useState("new");
  const [settings, setSettings] = useState(()=>loadSettings());
  const [invRefresh, setInvRefresh] = useState(0);
  const [toast, setToast]     = useState(null);
  const showToast = (msg, type="success") => setToast({msg,type});

  const handleSaveSettings = (s) => { setSettings(s); saveSettings(s); showToast("Configuración guardada"); };

  return (
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <nav className="nav">
          <div className="nav-logo">vinted<em>assist</em></div>
          {[["new","sparkle","Nuevo anuncio"],["inventory","package","Inventario"],["settings","settings","Ajustes"]].map(([id,icon,label])=>(
            <div key={id} className={`nav-tab${tab===id?" active":""}`} onClick={()=>setTab(id)}>
              <Icon name={icon} size={14}/>{label}
            </div>
          ))}
        </nav>
        <main className="main">
          {!settings.mistralKey && tab!=="settings" && (
            <div className="alert alert-warn" style={{cursor:"pointer",marginBottom:20}} onClick={()=>setTab("settings")}>
              ⚙ Primero configura tu clave Mistral API en Ajustes → haz clic aquí
            </div>
          )}
          {tab==="new"       && <NewListing settings={settings} onSaved={()=>setInvRefresh(r=>r+1)} toast={showToast}/>}
          {tab==="inventory" && <Inventory refresh={invRefresh}/>}
          {tab==="settings"  && <Settings settings={settings} onSave={handleSaveSettings}/>}
        </main>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      </div>
    </>
  );
}
