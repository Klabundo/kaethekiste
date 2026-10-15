/* ============================================================
   KätheKiste – Digitales Fundsachen-System
   Prototyp für das Käthe-Kollwitz-Gymnasium (KKG)
   -----------------------------------------------------------
   - Frontend statisch (GitHub Pages), Backend: Supabase
   - Gemeinsame Datenbank für die ganze Klasse (kein Login)
   - Fotos: Supabase Storage (automatisch verkleinert)
   - Live-Synchronisation: neue Einträge erscheinen bei allen
   - Smart Matching: Verlorene ↔ Gefundene werden erkannt
   ============================================================ */
"use strict";

/* ---------------- Konstanten ---------------- */
const CATEGORIES = [
  { id: "nichting", label: "Tasche / Rucksack" },
  { id: "hefte", label: "Hefte / Notizbücher" },
  { id: "stifte", label: "Stifte / Schreibzeug" },
  { id: "buecher", label: "Bücher" },
  { id: "handy", label: "Handy / Tablet" },
  { id: "kopfhörer", label: "Kopfhörer / Audio" },
  { id: "kleidung", label: "Jacke / Kleidung" },
  { id: "ausweis", label: "Schülerausweis / Ausweis" },
  { id: "essen", label: "Verpflegung / Lunchbox" },
  { id: "flasche", label: "Flasche / Thermoskanne" },
  { id: "rechner", label: "Taschenrechner" },
  { id: "schluessel", label: "Schlüssel / Armbändchen" },
  { id: "sonstiges", label: "Sonstiges" },
];

const LOCATIONS = [
  "Flur Erdgeschoss", "Flur 1. OG", "Flur 2. OG",
  "Stichelturm / Bibliothek", "Mensa / Cafeteria", "Pausenhof", "Kiosk",
  "Turnhalle / Sporthalle", "Schulzimmer (bitte Nr.)", "Kopierraum",
  "Musikraum", "Naturwissenschaftliche Räume",
  "Schulleitung / Sekretariat", "Lehrerarbeitsraum",
  "Schulhof / Bushaltestelle", "Sonstige (in Beschreibung)",
];

const COLORS = [
  "Schwarz", "Weiß", "Grau", "Blau", "Grün", "Rot",
  "Gelb", "Orange", "Pink", "Lila", "Braun", "Weitere / bunt",
];

const STATUS = {
  offen: { label: "Offen" },
  in_abwicklung: { label: "In Zuordnung" },
  abgeholt: { label: "Abgeholt" },
  archiviert: { label: "Archiviert" },
};

const ACTIVE_STATUSES = ["offen", "in_abwicklung"];

/* ---------------- Icons (Inline-SVG) ---------------- */
const ICONS = {
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM14.5 10a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z",
  calendar: "M7 3v3M17 3v3M5 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20.5 20.5 16 16",
  image: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9.5 11a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 9.5 11zM3 19l6-6 4 4 3-3 5 5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  upload: "M12 19V8M7 13l5-5 5 5M5 20h14",
  samples: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4",
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12",
  archive: "M4 7h16v13H4zM4 4h16v3H4zM10 12h4",
};
function icon(name, size = 14) {
  const d = ICONS[name] || "";
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

/* ---------------- State ---------------- */
const state = {
  items: [],
  view: "hilfe", // Start: Hilfe mit kompaktem Onboarding
  filters: { q: "", type: "alle", status: "aktiv", cat: "alle", loc: "alle" },
  selectedId: null,
  loadError: false, // letzter Datenabruf fehlgeschlagen (Banner über der Ansicht)
  saving: false,    // Formular-Submit läuft (Doppelklick-Schutz)
};
let draftPhoto = null; // Bild für das gerade ausgefüllte Formular (Data-URL)

/* ---------------- Utilities ---------------- */
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(ts) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function catLabel(id) {
  const c = CATEGORIES.find(c => c.id === id);
  return c ? c.label : (id || "–");
}

/* ---------------- Persistenz (Supabase – gemeinsame Datenbank) ---------------- */
const SUPABASE_URL = "https://fhszzxxtvvqtdnqhnktk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoc3p6eHh0dnZxdGRucWhua3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NjY0NjEsImV4cCI6MjEwNzU0MjQ2MX0.tSIwHT71-nv71Q1SQ0j-EDbkaLG-bYApgitRRTiD5g4";
const TBL_ITEMS = "fundsachen";
const TBL_LINKS = "zuordnungen";
const BUCKET_FOTOS = "fotos";
/* Anon-Key ist PUBLIC – er liegt bewusst auch im App-Code (GitHub Pages ist
   statisch, es gäbe keinen Ort zum Verbergen). RLS erlaubt der Rolle „anon“
   Lese- und Schreibzugriff: bewusste Prototyp-Entscheidung, begründet in
   backend/README.md. Der Service-Key bleibt ausschließlich lokal in backend/.env. */
const db = SupabaseJS.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function tsMs(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}

function rowToItem(row, partnerId) {
  return {
    id: row.id, type: row.type, title: row.title,
    category: row.category || "sonstiges",
    brand: row.brand || "", color: row.color || "",
    description: row.description || "", location: row.location || "",
    date: tsMs(row.reported_at),
    reporter: row.reporter || "", contact: row.contact || "",
    status: row.status || "offen",
    photo: row.photo || "",
    createdAt: tsMs(row.created_at),
    matchedWith: partnerId || null,
    events: Array.isArray(row.events) ? row.events : [],
  };
}

function itemToRow(it) {
  return {
    type: it.type, title: it.title,
    description: it.description || "",
    category: it.category || "sonstiges",
    brand: it.brand || "", color: it.color || "",
    location: it.location || "", photo: it.photo || "",
    status: it.status || "offen",
    reporter: it.reporter || "", contact: it.contact || "",
    reported_at: new Date(it.date || Date.now()).toISOString(),
    events: Array.isArray(it.events) ? it.events : [],
  };
}

async function loadItems() {
  const [rItems, rLinks] = await Promise.all([
    db.from(TBL_ITEMS).select("*"),
    db.from(TBL_LINKS).select("item_a,item_b"),
  ]);
  if (rItems.error || rLinks.error) {
    console.error("Daten konnten nicht geladen werden.", rItems.error || rLinks.error);
    state.loadError = true;
    return false;
  }
  state.loadError = false;
  const partner = {};
  for (const l of rLinks.data || []) { partner[l.item_a] = l.item_b; partner[l.item_b] = l.item_a; }
  state.items = (rItems.data || []).map(r => rowToItem(r, partner[r.id]));
  updateFooterCount();
  return true;
}

let rtTimer = null, realtimeOn = false;
function onRemoteChange() {
  clearTimeout(rtTimer);
  rtTimer = setTimeout(async () => {
    if (!(await loadItems())) return;
    if (state.view === "liste") refreshList();
    else if (!/^form/.test(state.view)) render(); // Formular-Eingaben nicht unterbrechen
  }, 400);
}

function subscribeRealtime() {
  if (realtimeOn) return;
  realtimeOn = true;
  db.channel("kkg-live")
    .on("postgres_changes", { event: "*", schema: "public", table: TBL_ITEMS }, onRemoteChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TBL_LINKS }, onRemoteChange)
    .subscribe();
}

async function retryLoad() {
  if (await loadItems()) subscribeRealtime();
  render();
}

function photoPath(publicUrl) {
  const i = publicUrl.indexOf("/object/public/");
  return i === -1 ? null : publicUrl.slice(i + "/object/public/".length);
}

async function uploadPhoto(dataUrl, id) {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const path = id + ".jpg";
  const { error } = await db.storage.from(BUCKET_FOTOS).upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return db.storage.from(BUCKET_FOTOS).getPublicUrl(path).data.publicUrl;
}

async function removePhoto(item) {
  if (!item || !item.photo || !item.photo.startsWith("http")) return;
  const p = photoPath(item.photo);
  if (p) await db.storage.from(BUCKET_FOTOS).remove([p]);
}

function updateFooterCount() {
  const el = document.getElementById("footer-count");
  if (el) el.textContent = state.items.length + " Einträge in der gemeinsamen Datenbank.";
}

/* ---------------- Matching (Smart Link) ---------------- */
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}
const STOPWORDS = new Set(["und", "der", "die", "das", "ein", "eine", "einen", "einem", "des",
  "den", "mit", "von", "im", "in", "am", "auf", "zu", "ich", "meine", "mein", "meiner",
  "wird", "wurde", "habe", "hat", "ist", "war", "nicht", "etwas", "bitte"]);

function tokenize(s) {
  return normalize(s).split(" ").filter(w => w.length > 2 && !STOPWORDS.has(w));
}
function jaccard(a, b) {
  const ta = new Set(tokenize(a)), tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}
function itemText(item) {
  return [item.title, item.brand, item.color, item.description].filter(Boolean).join(" ");
}
function matchScore(a, b) {
  let s = jaccard(itemText(a), itemText(b));
  if (a.category && a.category === b.category) s += 0.30;
  if (a.brand && a.brand && a.brand === b.brand) s += 0.20;
  if (a.color && a.color && a.color === b.color) s += 0.10;
  if (a.location === b.location) s += 0.05;
  return Math.min(1, s);
}
function findMatches(item, limit = 3, minScore = 0.35) {
  return state.items
    .filter(o => o.id !== item.id && o.type !== item.type && ACTIVE_STATUSES.includes(o.status))
    .map(o => ({ item: o, score: matchScore(item, o) }))
    .filter(m => m.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/* ---------------- Bild-Komprimierung (vor dem Foto-Upload) ---------------- */
function compressImage(file, maxDim = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ---------------- Toast ---------------- */
let toastTimer = null;
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show " + type;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); el.hidden = true; }, 3800);
}

/* ---------------- Routing & Rendering ---------------- */
function setView(view) {
  state.view = view;
  if (view === "start" || view === "statistik" || view === "hilfe") state.filters = { q: "", type: "alle", status: "aktiv", cat: "alle", loc: "alle" };
  render();
}
function toggleMenu(btn) {
  const nav = document.getElementById("nav-mobile");
  const open = nav.hidden;
  nav.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}
function render() {
  const main = document.getElementById("main");
  const v = state.view;
  const banner = state.loadError
    ? `<div class="conn-banner"><span>Keine Verbindung zur Datenbank – Einträge konnten gerade nicht geladen werden.</span><button class="btn btn--primary btn--sm" data-action="retry-load">Erneut versuchen</button></div>`
    : "";
  main.innerHTML = banner +
    (v === "start" ? viewStart() :
    v === "liste" ? viewList() :
    v === "form-lost" ? viewForm("lost") :
    v === "form-found" ? viewForm("found") :
    v === "statistik" ? viewStats() :
    viewHelp());
  document.querySelectorAll(".nav [data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyFilters(items) {
  const f = state.filters;
  const q = normalize(f.q);
  return items.filter(i => {
    if (f.type !== "alle" && i.type !== f.type) return false;
    if (f.status === "aktiv") { if (!ACTIVE_STATUSES.includes(i.status)) return false; }
    else if (f.status !== "alle" && i.status !== f.status) return false;
    if (f.cat !== "alle" && i.category !== f.cat) return false;
    if (f.loc !== "alle" && i.location !== f.loc) return false;
    if (q) {
      const hay = normalize([i.title, i.description, i.brand, i.color, i.location, i.reporter, catLabel(i.category)].join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.date - a.date);
}

/* ---------------- Bausteine ---------------- */
function typeTag(type) {
  return `<span class="type-tag type-tag--${type}"><span class="dot"></span>${type === "found" ? "Gefunden" : "Verloren"}</span>`;
}
function statusTag(status) {
  const st = STATUS[status] || STATUS.offen;
  return `<span class="status-tag status-tag--${status}">${st.label}</span>`;
}
function photoPlaceholder(id) {
  return `<span class="ph-empty">${escapeHtml(catLabel(id))}</span>`;
}
function itemCard(item) {
  const photo = item.photo ? `<img src="${item.photo}" alt="">` : photoPlaceholder(item.category);
  return `
  <article class="item-card" data-action="open-item" data-id="${item.id}" tabindex="0">
    <div class="item-card__photo">${photo}</div>
    <div class="item-card__body">
      <div class="item-row">${typeTag(item.type)}${statusTag(item.status)}</div>
      <h3 class="item-card__title">${escapeHtml(item.title)}</h3>
      ${item.description ? `<p class="item-card__desc">${escapeHtml(item.description)}</p>` : ""}
      <div class="item-card__meta">
        <span class="meta-item">${icon("pin", 13)}${escapeHtml(item.location || "–")}</span>
        <span class="meta-item">${icon("calendar", 13)}${fmtDate(item.date)}</span>
      </div>
      <div class="item-card__foot">
        <span class="cat-label">${escapeHtml(catLabel(item.category))}</span>
        <span class="details-link">Details${icon("arrow", 13)}</span>
      </div>
    </div>
  </article>`;
}

function matchBoxHtml(item, matches, headline, canLink = true) {
  if (!matches.length) return "";
  return `
  <div class="match-box">
    <div class="match-box__head">
      <h3>${headline}</h3>
      <p>Der Algorithmus hat ähnliche Einträge erkannt. Mit „Zuordnen“ wird ein Abhol-Prozess gestartet – die eigentliche Abholung läuft über die Schule (z.&nbsp;B. Sekretariat).</p>
    </div>
    <div class="match-list">
      ${matches.map(m => `
      <div class="match-item">
        <div class="match-item__thumb">${m.item.photo ? `<img src="${m.item.photo}" alt="">` : `<span class="ph-small">${escapeHtml(catLabel(m.item.category))}</span>`}</div>
        <div class="match-item__body">
          <div class="match-item__title">${escapeHtml(m.item.title)}</div>
          <div class="match-item__sub">${escapeHtml(catLabel(m.item.category))} · ${escapeHtml(m.item.location || "–")} · ${fmtDate(m.item.date)}</div>
        </div>
        <span class="match-score">${Math.round(m.score * 100)}&nbsp;%</span>
        ${canLink
          ? `<button class="btn btn--primary btn--sm" data-action="link-items" data-a="${item.id}" data-b="${m.item.id}">Zuordnen</button>`
          : `<span class="chip-muted">wird nach Absenden geprüft</span>`}
      </div>`).join("")}
    </div>
  </div>`;
}

function dropzoneHtml() {
  return `${icon("image", 22)}
  <div><strong>Foto hochladen</strong> <span class="muted">· optional</span></div>
  <div class="dz-sub">JPG oder PNG – wird automatisch verkleinert.</div>`;
}

function emptyHtml(kind) {
  if (kind === "list") {
    return `<div class="empty">
      <h3 class="empty-title">Keine Einträge gefunden</h3>
      <p>Filter oder Suchbegriff anpassen – oder direkt einen neuen Eintrag anlegen.</p>
      <div class="empty-actions">
        <button class="btn btn--primary" data-action="nav" data-view="form-lost">Verlust melden</button>
        <button class="btn btn--outline" data-action="nav" data-view="form-found">Fund melden</button>
      </div>
    </div>`;
  }
  return `<div class="empty">
    <h3 class="empty-title">Noch keine aktiven Einträge</h3>
    <p>Die gemeinsame Liste ist gerade leer – beim ersten Melden wird sie hier automatisch gefüllt.</p>
    <div class="empty-actions">
      <button class="btn btn--primary" data-action="nav" data-view="form-lost">Verlust melden</button>
      <button class="btn btn--outline" data-action="nav" data-view="form-found">Fund melden</button>
    </div>
  </div>`;
}

/* ---------------- Ansicht: Start ---------------- */
function viewStart() {
  const active = state.items.filter(i => ACTIVE_STATUSES.includes(i.status));
  const found = active.filter(i => i.type === "found").length;
  const lost = active.length - found;
  const solved = state.items.filter(i => i.status === "abgeholt").length;
  const recent = active.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  return `
  <div class="hero">
    <p class="hero-kicker">Käthe-Kollwitz-Gymnasium · Fundsachen</p>
    <h1>Das Fundsachen-System der Schule.</h1>
    <p class="lead">Verluste und Funde an einem Ort – der Algorithmus erkennt automatisch, welcher Verlust zu welchem Fund passt. Die Abholung läuft über das Sekretariat.</p>
    <div class="hero-actions">
      <button class="btn btn--outline" data-action="nav" data-view="form-lost">Etwas verloren?</button>
      <button class="btn btn--primary" data-action="nav" data-view="form-found">Etwas gefunden?</button>
      <span class="link-arrow" role="button" tabindex="0" data-action="nav" data-view="liste">Zur Fundsachen-Liste${icon("arrow", 14)}</span>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="num">${found}</div><div class="lbl">Funde offen</div><div class="hint">warten auf Eigentümer:in</div></div>
    <div class="stat"><div class="num">${lost}</div><div class="lbl">Verluste offen</div><div class="hint">werden aktiv gesucht</div></div>
    <div class="stat"><div class="num">${solved}</div><div class="lbl">Erfolgreich gelöst</div><div class="hint">seit Einrichtung</div></div>
    <div class="stat"><div class="num">${state.items.length}</div><div class="lbl">Einträge gesamt</div><div class="hint">inkl. Archiv</div></div>
  </div>

  <section class="card">
    <div class="section-head">
      <div>
        <h2 class="section-title">Aktuelle Fundsachen</h2>
        <p class="section-sub">Die ${Math.min(8, recent.length)} neuesten offenen Einträge – Details, Matches und Aktionen im Klick.</p>
      </div>
      <span class="count-pill">${active.length} aktiv</span>
    </div>
    ${recent.length ? `<div class="item-grid">${recent.map(itemCard).join("")}</div>` : emptyHtml("start")}
  </section>`;
}

/* ---------------- Ansicht: Liste ---------------- */
function viewList() {
  const items = applyFilters(state.items);
  const f = state.filters;
  return `
  <section class="card">
    <div class="section-head">
      <div>
        <h2 class="section-title">Alle Fundsachen</h2>
        <p class="section-sub">Verlorenes und Gefundenes der Schule – durchsuchen, filtern und im Detail vergleichen.</p>
      </div>
      <span class="count-pill" id="count-pill">${items.length} Treffer</span>
    </div>
    <div class="toolbar">
      <label class="search">${icon("search", 15)}
        <input id="f-q" placeholder="Suchen: z.&nbsp;B. „iPhone“, „Puma“, „Mensa“ …" value="${escapeHtml(f.q)}" autocomplete="off">
      </label>
      <select id="f-type" aria-label="Art filtern">
        <option value="alle">Alle</option>
        <option value="found">Gefunden</option>
        <option value="lost">Verloren</option>
      </select>
      <select id="f-status" aria-label="Status filtern">
        <option value="aktiv">Aktiv (offen)</option>
        <option value="offen">Offen</option>
        <option value="in_abwicklung">In Zuordnung</option>
        <option value="abgeholt">Abgeholt</option>
        <option value="archiviert">Archiviert</option>
        <option value="alle">Alle Status</option>
      </select>
      <select id="f-cat" aria-label="Kategorie filtern">
        <option value="alle">Alle Kategorien</option>
        ${CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join("")}
      </select>
      <select id="f-loc" aria-label="Ort filtern">
        <option value="alle">Alle Orte</option>
        ${LOCATIONS.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("")}
      </select>
    </div>
    <div id="item-grid-wrap">${items.length ? `<div class="item-grid">${items.map(itemCard).join("")}</div>` : emptyHtml("list")}</div>
  </section>`;
}

/* ---------------- Ansicht: Formular (Verloren / Gefunden) ---------------- */
function viewForm(type) {
  const isFound = type === "found";
  const head = isFound
    ? { title: "Du hast etwas gefunden.", sub: "Damit die:r Besitzer:in es zurückbekommt, erfasse den Fund hier. Der Algorithmus prüft sofort, ob jemand den Verlust schon gemeldet hat." }
    : { title: "Etwas von dir fehlt?", sub: "Beschreib das Teil möglichst genau (Marke, Farbe, Details). So kann der Algorithmus passende Funde finden und die Zuordnung vorschlagen." };
  return `
  <section class="card">
    <div class="section-head">
      <div>
        <h2 class="section-title">${head.title}</h2>
        <p class="section-sub">${head.sub}</p>
      </div>
      <span class="form-type form-type--${type}"><span class="dot"></span>${isFound ? "Fund melden" : "Verlust melden"}</span>
    </div>

    <form id="form-${type}" novalidate>
      <div class="form-grid">
        <div class="field field--full">
          <label for="f-title">Was ist es? <span class="req">*</span></label>
          <input name="title" id="f-title" required maxlength="90" placeholder="${isFound ? "z.&nbsp;B. „Rote Puma-Jacke, Größe M“" : "z.&nbsp;B. „iPhone 14, weiß, mit Stern-Hülle“"}" value="">
        </div>

        <div class="field">
          <label for="f-cat">Kategorie <span class="req">*</span></label>
          <select name="category" id="f-cat" required>
            <option value="" disabled selected>Bitte wählen …</option>
            ${CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-date">${isFound ? "Wann gefunden?" : "Wann verschwunden?"} <span class="req">*</span></label>
          <input type="date" name="date" id="f-date" required value="${todayISO()}">
        </div>

        <div class="field">
          <label for="f-brand">Marke / Hersteller</label>
          <input name="brand" id="f-brand" maxlength="60" placeholder="z.&nbsp;B. Puma, Casio, Klett …">
        </div>
        <div class="field">
          <label for="f-color">Farbe</label>
          <select name="color" id="f-color">
            <option value="">Keine Angabe</option>
            ${COLORS.map(c => `<option>${c}</option>`).join("")}
          </select>
        </div>

        <div class="field field--full">
          <label for="f-loc">${isFound ? "Wo gefunden?" : "Wo vermutlich verloren?"} <span class="req">*</span></label>
          <select name="location" id="f-loc" required>
            <option value="" disabled selected>Bitte wählen …</option>
            ${LOCATIONS.map(l => `<option>${escapeHtml(l)}</option>`).join("")}
          </select>
        </div>

        <div class="field field--full">
          <label for="f-desc">Beschreibung &amp; Erkennungsmerkmale</label>
          <textarea name="description" id="f-desc" maxlength="500" placeholder="Details helfen bei der Zuordnung: Beschriftung, Aufkleber, Inhalt, Zustand …"></textarea>
          <span class="hint">Max. 500 Zeichen. Keine Passwörter, Schlüssel oder vollständigen Adressen eintragen.</span>
        </div>

        <div class="field">
          <label for="f-reporter">Dein Name / Klasse</label>
          <input name="reporter" id="f-reporter" maxlength="60" placeholder="${isFound ? "z.&nbsp;B. „Mira, 8c“ – bleibt intern" : "z.&nbsp;B. „Sami K. (9a)“"}">
        </div>
        <div class="field">
          <label for="f-contact">${isFound ? "Weiterleitung an <span class=\"req\">*</span>" : "Rückmeldung"}</label>
          <input name="contact" id="f-contact" ${isFound ? "required" : ""} maxlength="80" placeholder="${isFound ? "z.&nbsp;B. „Lehrkraft H. Weber“ oder „Schülerin:in 9b, Platz 12“" : "z.&nbsp;B. „per E-Mail an Klassenlehrkraft“"}">
          ${isFound ? `<span class="hint">Wohin der Fund gebracht wird (z.&nbsp;B. Sekretariat, Lehrkraft) – nicht deine private Handynummer.</span>` : ""}
        </div>

        <div class="field field--full">
          <label>Foto</label>
          <div class="dropzone" id="dropzone" data-action="pick-photo" role="button" tabindex="0">
            ${dropzoneHtml()}
          </div>
          <input type="file" id="photo-input" accept="image/*" hidden>
        </div>
      </div>

      <div id="live-matches" aria-live="polite"></div>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary">${isFound ? "Fund melden" : "Verlust melden"}</button>
        <button type="button" class="btn btn--ghost" data-action="nav" data-view="liste">Abbrechen</button>
        <span class="consent">Mit dem Absenden erklären sich einverstanden, dass die Angaben intern zur Vermittlung genutzt werden. Es gelten die Datenschutzregeln der Schule.</span>
      </div>
    </form>
  </section>`;
}

/* Live-Matching während des Ausfüllens */
let liveTimer = null;
function updateLiveMatches(form) {
  const box = form.querySelector("#live-matches");
  if (!box) return;
  const type = form.id === "form-lost" ? "lost" : "found";
  const probe = {
    id: "__probe__",
    type,
    title: form.querySelector("[name=title]").value,
    brand: form.querySelector("[name=brand]").value,
    color: form.querySelector("[name=color]").value,
    location: form.querySelector("[name=location]").value,
    category: form.querySelector("[name=category]").value,
    description: form.querySelector("[name=description]").value,
  };
  if (tokenize(probe.title + " " + probe.description).length < 2) {
    box.innerHTML = `<p class="hint live-hint">Während du Titel und Beschreibung eingibst, sucht der Algorithmus hier automatisch nach passenden ${type === "lost" ? "Funden" : "Verlusten"} in der Datenbank.</p>`;
    return;
  }
  const matches = findMatches(probe, 3, 0.30);
  const counterpart = type === "lost" ? "Funde" : "Verluste";
  box.innerHTML = matches.length
    ? matchBoxHtml(probe, matches, `Mögliche ${counterpart} in der Datenbank`, false)
    : `<p class="hint live-hint">Bisher keine passenden ${counterpart} gefunden – deine Angaben sind gut und eindeutig. Nach dem Absenden bleibt der Eintrag aktiv und wird abgeglichen.</p>`;
}

/* ---------------- Ansicht: Statistik ---------------- */
function viewStats() {
  const active = state.items.filter(i => ACTIVE_STATUSES.includes(i.status));
  const found = active.filter(i => i.type === "found").length;
  const lost = active.length - found;
  const inWork = state.items.filter(i => i.status === "in_abwicklung").length;
  const solved = state.items.filter(i => i.status === "abgeholt");
  const archived = state.items.filter(i => i.status === "archiviert").length;
  const total = state.items.length;

  // Ø Bearbeitungszeit (Meldedatum bis Abholung)
  let sumHours = 0, n = 0;
  for (const it of solved) {
    const done = (it.events || []).find(e => /Abholung/i.test(e.text));
    if (done && it.date) { sumHours += (done.ts - it.date) / 36e5; n++; }
  }
  const avgHours = n ? Math.round(sumHours / n) : null;
  const matchRate = total ? Math.round((solved.length / total) * 100) : 0;

  // Kategorien-Verteilung (aktive + gelöste)
  const byCat = {};
  for (const it of state.items.filter(i => i.status !== "archiviert")) byCat[it.category] = (byCat[it.category] || 0) + 1;
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = topCats.length ? topCats[0][1] : 1;
  const recent = state.items.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  return `
  <section class="card">
    <div class="section-head">
      <div>
        <h2 class="section-title">Übersicht</h2>
        <p class="section-sub">Ein Blick auf das Fundsachen-System – wie es für die Schule läuft.</p>
      </div>
    </div>
    <div class="dash-grid">
      <div class="stat"><div class="num">${found}</div><div class="lbl">Funde offen</div></div>
      <div class="stat"><div class="num">${lost}</div><div class="lbl">Verluste offen</div></div>
      <div class="stat"><div class="num">${inWork}</div><div class="lbl">In Zuordnung</div></div>
      <div class="stat"><div class="num">${solved.length}</div><div class="lbl">Erfolgreich gelöst</div></div>
      <div class="stat"><div class="num">${matchRate}&nbsp;%</div><div class="lbl">Erfolgsquote</div><div class="hint">gelöst / alle Einträge</div></div>
      <div class="stat"><div class="num">${avgHours != null ? avgHours + " h" : "–"}</div><div class="lbl">Ø bis zur Abholung</div><div class="hint">Melderfassung → Abholung</div></div>
    </div>
  </section>

  <div class="grid-2">
    <section class="card">
      <div class="section-head">
        <div>
          <h2 class="section-title">Top-Kategorien</h2>
          <p class="section-sub">Wo die meisten Sachen landen (aktive + gelöste Einträge).</p>
        </div>
      </div>
      ${topCats.length ? `<div class="bars">
        ${topCats.map(([id, v]) => `
        <div class="bar-row">
          <span class="lbl">${escapeHtml(catLabel(id))}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.round((v / maxCat) * 100)}%"></span></span>
          <span class="val">${v}</span>
        </div>`).join("")}
      </div>` : `<p class="hint">Noch keine Daten – erst ein paar Einträge anlegen.</p>`}
      <div class="stat-note">
        <span class="meta-item">${active.length} aktiv</span>
        <span class="meta-item">${archived} archiviert</span>
        <span class="meta-item">${total} gesamt</span>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <h2 class="section-title">Letzte Aktivitäten</h2>
          <p class="section-sub">Die letzten 8 Einträge, unabhängig vom Status.</p>
        </div>
      </div>
      <div class="recent-list">
        ${recent.map(i => `
        <div class="recent-item" data-action="open-item" data-id="${i.id}" role="button" tabindex="0">
          <div class="recent-item__body">
            <strong>${escapeHtml(i.title)}</strong>
            <span>${(STATUS[i.status] || STATUS.offen).label} · ${fmtDateTime(i.createdAt)}</span>
          </div>
          ${typeTag(i.type)}
          ${icon("arrow", 14)}
        </div>`).join("") || `<p class="hint">Noch keine Einträge.</p>`}
      </div>
    </section>
  </div>`;
}

/* ---------------- Ansicht: Hilfe ---------------- */
function viewHelp() {
  return `
  <section class="card onb">
    <div class="section-head">
      <div>
        <h2 class="section-title">So funktioniert’s</h2>
        <p class="section-sub">Vier Schritte – vom Fund bis zur Abholung. So nimmt deine Klasse das System in zwei Minuten in Betrieb.</p>
      </div>
    </div>
    <ol class="steps onb-steps">
      <li><strong>Melden:</strong> Verlust oder Fund erfassen – am besten mit Foto, Kategorie und Ort.</li>
      <li><strong>Auto-Abgleich:</strong> Der Algorithmus schlägt sofort passende Gegenstücke vor, inkl. Ähnlichkeits-Grad.</li>
      <li><strong>Zuordnen:</strong> Passt der Vorschlag, werden beide Einträge verknüpft – Status wechselt auf „In Abwicklung“.</li>
      <li><strong>Abholen:</strong> Im Sekretariat abholen – nach kurzer Identifikation wird der Eintrag als erledigt markiert.</li>
    </ol>
    <div class="card-actions">
      <button class="btn btn--primary btn--sm" data-action="nav" data-view="form-lost">Etwas verloren?</button>
      <button class="btn btn--outline btn--sm" data-action="nav" data-view="form-found">Etwas gefunden?</button>
      <span class="link-arrow" role="button" tabindex="0" data-action="nav" data-view="liste">Zur Fundsachen-Liste${icon("arrow", 14)}</span>
    </div>
  </section>

  <section class="card">
    <div class="section-head">
      <div>
        <h2 class="section-title">Hilfe</h2>
        <p class="section-sub">Kurz erklärt: Rollen, Ablauf und was unter der Haube läuft.</p>
      </div>
    </div>
    <div class="help-grid">
      <div class="help-card">
        <h3>Rollen</h3>
        <ul>
          <li><strong>Schüler:innen:</strong> Verluste und Funde melden, Matches prüfen.</li>
          <li><strong>Lehrkräfte / Sekretariat:</strong> Zuordnungen freigeben, Abholungen bestätigen (im Prototyp: direkt über die Detailansicht).</li>
        </ul>
      </div>
      <div class="help-card">
        <h3>Matching</h3>
        <p>Titel, Beschreibung, Marke, Farbe, Kategorie und Ort werden normalisiert und per Jaccard-Ähnlichkeit verglichen; Kategorien-Matches zählen besonders stark. Ab ~35&nbsp;% wird ein Treffer angezeigt – die Freigabe bleibt immer bei Menschen.</p>
      </div>
      <div class="help-card">
        <h3>Datenschutz</h3>
        <p>Die Einträge liegen gemeinsam in einer Cloud-Datenbank (Supabase, Region Frankfurt) – wer das System öffnet, sieht dieselben Daten in Echtzeit. Fotos werden automatisch verkleinert. Private Handynummern oder Adressen gehören nicht in die Meldungen.</p>
      </div>
      <div class="help-card">
        <h3>Starten &amp; Verwalten</h3>
        <ul>
          <li>Online: <code>klabundo.github.io/kaethekiste</code> – kein Login, kein Download.</li>
          <li>Live-Sync: Neue Einträge erscheinen sofort bei allen, die die Seite offen haben.</li>
          <li>Export/Import (JSON) unter „Daten“ – Backup oder Übertragung.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="section-head">
      <div>
        <h2 class="section-title">Häufige Fragen</h2>
      </div>
    </div>
    <div class="faq">
      <details open>
        <summary>Was mache ich, wenn ich etwas finde?</summary>
        <p>Abgabe ist beim Sekretariat (oder der zuständigen Lehrkraft). Parallel im System unter „Fund melden“ erfassen – am besten mit Foto und Ort. Passt ein Verlust dazu, wird die Zuordnung vorgeschlagen.</p>
      </details>
      <details>
        <summary>Wie lange bleiben Funde im System?</summary>
        <p>Offene Einträge bleiben aktiv, bis sie abgeholt oder archiviert werden. Im echten System würde ein Zeitplan laufen (z.&nbsp;B. 4 Wochen aktiv, dann Archiv/Fundbüro).</p>
      </details>
      <details>
        <summary>Wofür brauche ich einen Account?</summary>
        <p>Keinen – die gemeinsame Datenbank ist ohne Login erreichbar, damit die ganze Klasse sofort mitmachen kann. Alle Meldungen sind im System für alle sichtbar, deshalb bitte nur Angaben aus dem Schul-Kontext (Name/Klasse) und keine privaten Kontaktdaten.</p>
      </details>
      <details>
        <summary>Was ist der nächste Schritt nach dem Prototyp?</summary>
        <p>Erledigt: gemeinsame Cloud-Datenbank (Supabase) mit Live-Synchronisation und Foto-Upload. Nächste Ausbaustufen: Benachrichtigung per E-Mail/Intranet, eine „Fundbüro“-Sicht für das Sekretariat mit Druckfunktion für Fundzettel und automatische Archivierung nach 4 Wochen.</p>
      </details>
    </div>

    <div class="data-block">
      <h2 class="data-block__title">Daten &amp; Pflege</h2>
      <p class="data-block__sub">Die Daten liegen gemeinsam in der Cloud (Supabase). Hier lassen sich Daten sichern, übernehmen oder zurücksetzen – Vorsicht: „Alle Daten löschen“ betrifft die ganze Klasse.</p>
      <div class="data-actions">
        <button class="btn btn--outline btn--sm" data-action="export-data">${icon("download", 14)} Als JSON exportieren</button>
        <button class="btn btn--outline btn--sm" data-action="import-data">${icon("upload", 14)} JSON importieren</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <button class="btn btn--danger btn--sm" data-action="reset-data">${icon("trash", 14)} Alle Daten löschen</button>
      </div>
    </div>
  </section>`;
}

/* ---------------- Detail-Modal ---------------- */
function openItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  state.selectedId = id;
  const isFound = item.type === "found";
  const matched = item.matchedWith ? state.items.find(i => i.id === item.matchedWith) : null;
  const matches = (!matched && ACTIVE_STATUSES.includes(item.status)) ? findMatches(item) : [];
  const photoHtml = item.photo
    ? `<img src="${item.photo}" alt="">`
    : photoPlaceholder(item.category);

  const timeline = (item.events || []).slice().reverse().map((ev, i) =>
    `<li class="${i === 0 ? "current" : "done"}"><span class="tl-text">${escapeHtml(ev.text)}</span><span class="t-date">${fmtDateTime(ev.ts)}</span></li>`
  ).join("");

  document.querySelector("#modal .modal-panel").innerHTML = `
  <div class="modal-panel__photo">${photoHtml}</div>
  <div class="modal-panel__body">
    <div class="modal-panel__head">
      <div class="item-row">${typeTag(item.type)}${statusTag(item.status)}</div>
      <button class="modal-close" data-action="close-modal" aria-label="Schließen">${icon("close", 16)}</button>
    </div>
    <h2 class="detail-title" id="modal-title">${escapeHtml(item.title)}</h2>
    ${item.description ? `<p class="detail-desc">${escapeHtml(item.description)}</p>` : ""}

    <dl class="detail-grid">
      <div class="detail-grid__item"><dt>Kategorie</dt><dd>${escapeHtml(catLabel(item.category))}</dd></div>
      <div class="detail-grid__item"><dt>${isFound ? "Fundort" : "Verdachtsort"}</dt><dd>${escapeHtml(item.location || "–")}</dd></div>
      <div class="detail-grid__item"><dt>${isFound ? "Funddatum" : "Verschwunden am"}</dt><dd>${fmtDate(item.date)}</dd></div>
      <div class="detail-grid__item"><dt>Meldeperson</dt><dd>${escapeHtml(item.reporter || "anonym")}</dd></div>
      ${item.color ? `<div class="detail-grid__item"><dt>Farbe</dt><dd>${escapeHtml(item.color)}</dd></div>` : ""}
      ${item.brand ? `<div class="detail-grid__item"><dt>Marke</dt><dd>${escapeHtml(item.brand)}</dd></div>` : ""}
      ${item.contact ? `<div class="detail-grid__item detail-grid__wide"><dt>${isFound ? "Weiterleitung an" : "Rückmeldung"}</dt><dd>${escapeHtml(item.contact)}</dd></div>` : ""}
      ${matched ? `
      <div class="detail-grid__item detail-grid__wide">
        <dt>Zugeordneter ${isFound ? "Verlust" : "Fund"}</dt>
        <dd>${escapeHtml(matched.title)}<span class="sub">${escapeHtml(matched.location || "–")} · ${fmtDate(matched.date)}${matched.reporter ? " · " + escapeHtml(matched.reporter) : ""}</span></dd>
      </div>` : ""}
    </dl>

    ${matches.length && !matched
      ? matchBoxHtml(item, matches, isFound ? "Passende Verluste erkannt" : "Passende Funde erkannt")
      : ""}

    ${matched && item.status === "in_abwicklung" ? `
    <div class="match-box match-box--done">
      <div class="match-box__head">
        <h3>${icon("check", 15)} Zuordnung bestätigt</h3>
        <p>Die Abholung wird über das Sekretariat / die zuständige Lehrkraft geregelt. Nach der Abholung hier bestätigen.</p>
      </div>
      <button class="btn btn--primary btn--sm" data-action="mark-retrieved" data-id="${item.id}">Abholung bestätigen</button>
    </div>` : ""}

    <div class="tl-block">
      <div class="tl-label">Verlauf</div>
      <ul class="timeline">${timeline}</ul>
    </div>

    <div class="modal-actions">
      <div class="modal-actions__left">
        ${item.status !== "abgeholt" ? `<button class="btn btn--outline btn--sm" data-action="archive-item" data-id="${item.id}">${icon("archive", 14)} Archivieren</button>` : ""}
        <button class="btn btn--danger btn--sm" data-action="delete-item" data-id="${item.id}">${icon("trash", 14)} Löschen</button>
      </div>
      <button class="btn btn--ghost btn--sm" data-action="close-modal">Schließen</button>
    </div>
  </div>`;
  document.getElementById("modal").hidden = false;
}

function openSuccess(item, matches) {
  state.selectedId = item.id;
  const isFound = item.type === "found";
  const counterpart = isFound ? "Verlust" : "Fund";
  document.querySelector("#modal .modal-panel").innerHTML = `
  <div class="modal-panel__body modal-panel__body--center">
    <div class="success-ic">${icon("check", 24)}</div>
    <h2 class="detail-title" id="modal-title">${escapeHtml(item.title)}</h2>
    <p class="detail-desc">
      ${isFound
        ? "Der Fund ist im System erfasst und wird bei passenden Verlusten automatisch gesucht."
        : "Der Verlust ist gemeldet – bei passenden Funden wird die Zuordnung vorgeschlagen."}
    </p>
    ${matches.length
      ? matchBoxHtml(item, matches, isFound ? "Passende Verluste gefunden – jetzt zuordnen!" : "Passende Funde gefunden – jetzt zuordnen!")
      : `<div class="match-box match-box--plain"><p>Kein passender ${counterpart} in der Datenbank gefunden. Der Eintrag bleibt aktiv und wird laufend abgeglichen.</p></div>`}
    <div class="modal-actions">
      <button class="btn btn--primary" data-action="open-item" data-id="${item.id}">Details ansehen</button>
      <button class="btn btn--ghost" data-action="nav-close" data-view="liste">Zur Liste</button>
    </div>
  </div>`;
  document.getElementById("modal").hidden = false;
}

function closeModal() {
  document.getElementById("modal").hidden = true;
  state.selectedId = null;
}

/* ---------------- Abläufe / Aktionen ---------------- */
async function linkItems(aId, bId) {
  const a = state.items.find(i => i.id === aId);
  const b = state.items.find(i => i.id === bId);
  if (!a || !b || a.type === b.type || aId === bId) return;
  const { error: eLink } = await db.from(TBL_LINKS).insert({ item_a: aId, item_b: bId });
  if (eLink) { toast("Zuordnung fehlgeschlagen: " + eLink.message, "error"); return; }
  const ts = Date.now();
  a.status = "in_abwicklung"; b.status = "in_abwicklung";
  a.matchedWith = b.id; b.matchedWith = a.id;
  a.events.push({ ts, text: "Mit „" + b.title + "“ zugeordnet" });
  b.events.push({ ts, text: "Mit „" + a.title + "“ zugeordnet" });
  await Promise.all([
    db.from(TBL_ITEMS).update({ status: "in_abwicklung", events: a.events }).eq("id", aId),
    db.from(TBL_ITEMS).update({ status: "in_abwicklung", events: b.events }).eq("id", bId),
  ]);
  toast("Zuordnung gestartet – Abholung läuft über das Sekretariat.", "success");
  render();
  openItem(aId);
}

async function markRetrieved(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  const ts = Date.now();
  item.status = "abgeholt";
  item.events.push({ ts, text: "Abholung bestätigt – Sache erledigt" });
  let other = null;
  if (item.matchedWith) {
    other = state.items.find(i => i.id === item.matchedWith);
    if (other) {
      other.status = "abgeholt";
      other.events.push({ ts, text: "Abholung bestätigt – Sache erledigt" });
    }
  }
  const calls = [db.from(TBL_ITEMS).update({ status: "abgeholt", events: item.events }).eq("id", id)];
  if (other) calls.push(db.from(TBL_ITEMS).update({ status: "abgeholt", events: other.events }).eq("id", other.id));
  const results = await Promise.all(calls);
  if (results.some(r => r.error)) { toast("Bestätigung konnte nicht gespeichert werden.", "error"); return; }
  toast("Abholung bestätigt – erledigt.", "success");
  render();
  openItem(id);
}

async function archiveItem(id) {
  const it = state.items.find(i => i.id === id);
  if (!it) return;
  it.status = "archiviert";
  it.events.push({ ts: Date.now(), text: "Archiviert" });
  const { error } = await db.from(TBL_ITEMS).update({ status: "archiviert", events: it.events }).eq("id", id);
  if (error) { toast("Archivieren fehlgeschlagen: " + error.message, "error"); return; }
  toast("Eintrag archiviert.");
  render();
  if (state.selectedId === id) openItem(id);
}

async function deleteItem(id) {
  const it = state.items.find(i => i.id === id);
  if (!it) return;
  if (!confirm(`„${it.title}“ wirklich löschen?`)) return;
  const { error } = await db.from(TBL_ITEMS).delete().eq("id", id);
  if (error) { toast("Löschen fehlgeschlagen: " + error.message, "error"); return; }
  removePhoto(it);
  state.items = state.items.filter(i => i.id !== id);
  const other = state.items.find(i => i.matchedWith === id);
  if (other) {
    other.matchedWith = null;
    if (other.status === "in_abwicklung") {
      other.status = "offen";
      await db.from(TBL_ITEMS).update({ status: "offen" }).eq("id", other.id);
    }
  }
  updateFooterCount();
  render();
  closeModal();
  toast("Eintrag gelöscht.");
}

/* ---------------- Formular-Submit ---------------- */
async function handleFormSubmit(form) {
  const type = form.id === "form-lost" ? "lost" : "found";
  const v = name => (form.querySelector("[name=" + name + "]").value || "").trim();
  const title = v("title"), category = v("category"), location = v("location"), dateStr = v("date");
  if (!title || !category || !location) {
    toast("Bitte die Pflichtfelder ausfüllen: Titel, Kategorie, Ort.", "error");
    return;
  }
  if (type === "found" && !v("contact")) {
    toast("Bitte angeben, an wen der Fund weitergeleitet wird.", "error");
    return;
  }
  if (state.saving) return; // Doppelklick-Schutz
  state.saving = true;
  const now = Date.now();
  const ts = dateStr ? new Date(dateStr + "T12:00:00").getTime() : now;
  const item = {
    id: uid(), type, title, category,
    brand: v("brand"), color: v("color"),
    description: v("description"), location,
    date: Number.isFinite(ts) ? ts : now,
    reporter: v("reporter"), contact: v("contact"),
    status: "offen", photo: draftPhoto || "",
    createdAt: now, matchedWith: null,
    events: [{ ts: now, text: type === "found" ? "Fund gemeldet" : "Verlust gemeldet" }],
  };
  try {
    if (item.photo) item.photo = await uploadPhoto(item.photo, item.id);
    const { error } = await db.from(TBL_ITEMS).insert(Object.assign({ id: item.id }, itemToRow(item)));
    if (error) throw error;
  } catch (err) {
    console.error("Speichern fehlgeschlagen:", err);
    state.saving = false;
    toast("Eintrag konnte nicht gespeichert werden – bitte erneut versuchen.", "error");
    return;
  }
  state.saving = false;
  draftPhoto = null;
  state.items.unshift(item);
  updateFooterCount();
  const matches = findMatches(item, 3, 0.30);
  render();
  openSuccess(item, matches);
}

/* ---------------- Foto & Import/Export ---------------- */
function handlePhoto(input) {
  const f = input.files && input.files[0];
  input.value = "";
  if (!f) return;
  if (!f.type.startsWith("image/")) { toast("Bitte eine Bilddatei wählen.", "error"); return; }
  compressImage(f).then(url => {
    draftPhoto = url;
    const dz = document.getElementById("dropzone");
    if (dz) {
      dz.classList.add("has-photo");
      dz.innerHTML = `
        <img src="${url}" alt="Vorschau">
        <div class="dz-note">Vorschau – beim Absenden wird das Bild gespeichert.</div>
        <button type="button" class="btn btn--outline btn--sm" data-action="clear-photo">Bild entfernen</button>`;
    }
  }).catch(() => { toast("Bild konnte nicht verarbeitet werden.", "error"); });
}

function clearPhoto() {
  draftPhoto = null;
  const dz = document.getElementById("dropzone");
  if (dz) { dz.classList.remove("has-photo"); dz.innerHTML = dropzoneHtml(); }
  const inp = document.getElementById("photo-input");
  if (inp) inp.value = "";
}

function exportData() {
  const blob = new Blob([JSON.stringify(
    { app: "kaethekiste", version: 1, exportedAt: new Date().toISOString(), items: state.items },
    null, 2
  )], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kkg-fundsachen-export-" + todayISO() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast("Export gestartet.", "success");
}

async function handleImport(input) {
  const f = input.files && input.files[0];
  input.value = "";
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); }
  catch { toast("Datei ist kein gültiges JSON.", "error"); return; }
  const arr = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(arr)) {
    toast("Kein passendes Format (erwartet: Array oder {items:[…]}).", "error"); return;
  }
  const known = new Set(state.items.map(i => i.id));
  const fresh = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object" || !raw.title) continue;
    const it = {
      id: raw.id || uid(),
      type: raw.type === "lost" ? "lost" : "found",
      title: String(raw.title).slice(0, 90),
      category: raw.category || "sonstiges",
      brand: raw.brand || "", color: raw.color || "",
      description: raw.description || "", location: raw.location || "",
      date: raw.date || Date.now(),
      reporter: raw.reporter || "", contact: raw.contact || "",
      status: raw.status || "offen",
      photo: raw.photo || "",
      createdAt: raw.createdAt || Date.now(),
      events: Array.isArray(raw.events) ? raw.events : [],
      matchedWith: raw.matchedWith || null,
    };
    if (!it.events.length) it.events.push({ ts: it.createdAt, text: it.type === "found" ? "Fund gemeldet" : "Verlust gemeldet" });
    if (!known.has(it.id)) { fresh.push(it); known.add(it.id); }
  }
  if (!fresh.length) { toast("Nichts Neues gefunden (alle Einträge existieren bereits)."); return; }
  try {
    for (const it of fresh) {
      if (it.photo && it.photo.startsWith("data:")) {
        try { it.photo = await uploadPhoto(it.photo, it.id); }
        catch { it.photo = ""; } // Foto weglassen, Eintrag trotzdem importieren
      }
    }
    const { error } = await db.from(TBL_ITEMS).insert(fresh.map(it => Object.assign({ id: it.id }, itemToRow(it))));
    if (error) throw error;
    const links = []; const seen = new Set();
    for (const it of fresh) {
      if (!it.matchedWith || !fresh.find(o => o.id === it.matchedWith)) continue;
      const key = [it.id, it.matchedWith].sort().join("|");
      if (!seen.has(key)) { seen.add(key); links.push({ item_a: it.id, item_b: it.matchedWith }); }
    }
    if (links.length) {
      const { error: eL } = await db.from(TBL_LINKS).insert(links);
      if (eL) console.warn("Teil der Zuordnungen konnte nicht importiert werden:", eL);
    }
  } catch (err) {
    console.error("Import fehlgeschlagen:", err);
    toast("Import fehlgeschlagen – bitte erneut versuchen.", "error");
    return;
  }
  await loadItems();
  render();
  toast(fresh.length + " Einträge importiert (Duplikate übersprungen).", "success");
}

/* ---------------- Beispieldaten (Referenz für Tests & backend/seed.sql) ---------------- */
function sampleItems() {
  const now = Date.now(), D = 864e5;
  const mk = (type, daysAgo, extra) => {
    const ts = now - daysAgo * D;
    const it = {
      id: uid(), type, title: "", category: "sonstiges", brand: "", color: "",
      description: "", location: "", date: ts, reporter: "", contact: "",
      status: "offen", photo: "", createdAt: ts,
      events: [{ ts, text: type === "found" ? "Fund gemeldet" : "Verlust gemeldet" }],
      matchedWith: null,
    };
    return Object.assign(it, extra);
  };
  const linkPair = (a, b, daysAgoLink, daysAgoPickup) => {
    a.matchedWith = b.id; b.matchedWith = a.id;
    const tl = now - daysAgoLink * D;
    a.status = b.status = "in_abwicklung";
    a.events.push({ ts: tl, text: "Zuordnung bestätigt (Match)" });
    b.events.push({ ts: tl, text: "Zuordnung bestätigt (Match)" });
    if (daysAgoPickup != null) {
      const tp = now - daysAgoPickup * D;
      a.status = b.status = "abgeholt";
      a.events.push({ ts: tp, text: "Abholung bestätigt – Sache erledigt" });
      b.events.push({ ts: tp, text: "Abholung bestätigt – Sache erledigt" });
    }
  };

  const FOTO_BASE = "https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/fotos/";
  const items = [];

  // iPhone-Paar: zugeordnet, Abholung steht aus
  const ipF = mk("found", 3, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000001.jpg", title: "Weißes iPhone 14 mit Stern-Hülle", category: "handy", color: "Weiß", location: "Flur 1. OG", reporter: "Lena M. (9b)", contact: "Abgabe: Sekretariat", description: "Im Briefkasten des 1. OG gefunden. Gehäuse weiß, Hülle mit kleinen Sternen, Code gesperrt." });
  const ipL = mk("lost", 2, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000002.jpg", title: "iPhone 14, weiß, Stern-Hülle", category: "handy", color: "Weiß", location: "Flur 1. OG", reporter: "Sami K. (9a)", description: "iPhone 14 weiß, Hülle mit kleinen Sternen. Bitte dringend!" });
  linkPair(ipF, ipL, 1, null);
  items.push(ipF, ipL);

  // Puma-Jacke: abgeschlossen
  const jkF = mk("found", 6, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000003.jpg", title: "Schwarze Puma-Jacke, Größe M", category: "kleidung", brand: "Puma", color: "Schwarz", location: "Turnhalle / Sporthalle", reporter: "Tom R. (10a)", contact: "Abgabe: Sekretariat", description: "Schwarze Puma-Trainingsjacke Größe M, lag auf der Bank in der Sporthalle." });
  const jkL = mk("lost", 5, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000004.jpg", title: "Puma-Jacke, schwarz, Größe M", category: "kleidung", brand: "Puma", color: "Schwarz", location: "Turnhalle / Sporthalle", reporter: "Ela B. (10b)", description: "Nach dem Sport die Puma-Jacke verloren, schwarz, Größe M." });
  linkPair(jkF, jkL, 4, 2);
  items.push(jkF, jkL);

  // Stifte-Set: abgeschlossen
  const stF = mk("found", 9, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000005.jpg", title: "Grünes Stifte-Set (5×)", category: "stifte", color: "Grün", location: "Flur 2. OG", reporter: "Mira S. (7c)", contact: "Abgabe: Sekretariat", description: "Fünf grüne Kugelschreiber in einer kleinen Schachtel." });
  const stL = mk("lost", 8, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000006.jpg", title: "Fünf grüne Kugelschreiber", category: "stifte", color: "Grün", location: "Flur 2. OG", reporter: "Ben H. (7a)", description: "Ganzes Stifte-Set (5×) verloren, alle grün." });
  linkPair(stF, stL, 7, 5);
  items.push(stF, stL);

  // Offene Einzel-Einträge (noch kein passender Gegenpart)
  items.push(
    mk("found", 1, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000007.jpg", title: "Casio-Rechner fx-991EX", category: "rechner", brand: "Casio", color: "Schwarz", location: "Kopierraum", reporter: "Jonas P. (12c)", contact: "Abgabe: Sekretariat", description: "Lag auf dem Tisch im Kopierraum, Casio fx-991EX." }),
    mk("found", 1, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000008.jpg", title: "Rote Lunchbox mit Katzen-Aufkleber", category: "essen", color: "Rot", location: "Mensa / Cafeteria", reporter: "Mila T. (6c)", contact: "Abgabe: Cafeteria", description: "Rote Lunchbox, leer, mit Katzen-Aufkleber." }),
    mk("found", 4, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000009.jpg", title: "Blauer Rucksack, voll mit Büchern", category: "nichting", color: "Blau", location: "Pausenhof", reporter: "anonym", contact: "Abgabe: Sekretariat", description: "Blaue Schultasche, voll mit Büchern, am Zaun im Pausenhof gefunden." }),
    mk("found", 2, { photo: FOTO_BASE + "a0000000-0000-4000-8000-00000000000c.jpg", title: "Schlüsselbund mit gelbem Hund-Anhänger", category: "schluessel", color: "Gelb", location: "Briefkasten 1. OG", reporter: "Jonas P. (12c)", contact: "Abgabe: Sekretariat", description: "Schlüssel mit gelbem Hund-Charms, lag in einem Briefkasten im 1. OG." }),
    mk("found", 5, { photo: FOTO_BASE + "a0000000-0000-4000-8000-00000000000d.jpg", title: "Taschenbuch „Der kleine Prinz“", category: "buecher", location: "Bibliothek", reporter: "Frau Brandt", contact: "Abgabe: Bibliothek", description: "Taschenbuch, lag auf einem Sitzplatz in der Bibliothek." }),
    mk("lost", 1, { photo: FOTO_BASE + "a0000000-0000-4000-8000-00000000000a.jpg", title: "Schülerausweis, Elena Berger (11a)", category: "ausweis", location: "Mensa / Cafeteria", reporter: "Elena B. (11a)", description: "Schülerausweis verloren, Name: Elena Berger, 11a. Bitte melden!" }),
    mk("lost", 2, { photo: FOTO_BASE + "a0000000-0000-4000-8000-00000000000b.jpg", title: "Grüne Thermosflasche", category: "flasche", color: "Grün", location: "Mensa / Cafeteria", reporter: "Nora F. (8b)", description: "Grüne Thermosflasche, vermutlich in der Mensa, mit Gravur „N.F.“." }),
    mk("lost", 1, { photo: FOTO_BASE + "a0000000-0000-4000-8000-00000000000f.jpg", title: "Weiße AirPods Pro im Ladeetui", category: "kopfhörer", color: "Weiß", location: "Musiksaal", reporter: "Jule H. (11c)", description: "AirPods Pro im weißen Etui, vermutlich im Musiksaal verloren." }),
    mk("lost", 3, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000010.jpg", title: "Grünes Matheheft (9c)", category: "hefte", color: "Grün", location: "Raum 9c", reporter: "Max W. (9c)", description: "Grünes Matheheft mit Stempeln, im Klassenzimmer 9c vergessen." }),
    mk("lost", 1, { photo: FOTO_BASE + "a0000000-0000-4000-8000-000000000011.jpg", title: "Schwarzer Regenschirm", location: "Pausenhof", reporter: "Finn G. (8a)", description: "Schwarzer Regenschirm, nach dem Regen im Pausenhof vergessen." }),
  );

  // Archiviert: älterer Fund, nach zwei Wochen ohne Abholung
  const cap = mk("found", 21, { photo: FOTO_BASE + "a0000000-0000-4000-8000-00000000000e.jpg", title: "Blaue Mütze mit weißem Bommel", category: "kleidung", color: "Blau", location: "Aula", reporter: "anonym", contact: "Abgabe: Sekretariat", description: "Wollmütze mit Bommel, lag nach der großen Pause in der Aula.", status: "archiviert" });
  cap.events.push({ ts: now - 7 * D, text: "Archiviert" });
  items.push(cap);

  return items;
}

async function resetData() {
  if (!confirm("Wirklich ALLE Einträge in der gemeinsamen Datenbank löschen? Das betrifft die Daten der ganzen Klasse.")) return;
  const dummy = "00000000-0000-0000-0000-000000000000";
  const rLinks = await db.from(TBL_LINKS).delete().neq("item_a", dummy);
  const rItems = await db.from(TBL_ITEMS).delete().neq("id", dummy);
  if (rLinks.error || rItems.error) {
    toast("Löschen fehlgeschlagen – bitte erneut versuchen.", "error");
    console.error(rLinks.error || rItems.error);
    return;
  }
  await Promise.all(state.items.map(it => removePhoto(it)));
  state.items = [];
  updateFooterCount();
  render();
  toast("Alle Daten gelöscht.", "success");
}

/* ---------------- Event-Bindung (Delegierung) ---------------- */
let listTimer = null;
function refreshList() {
  const items = applyFilters(state.items);
  const grid = document.getElementById("item-grid-wrap");
  const pill = document.getElementById("count-pill");
  if (!grid) return;
  grid.innerHTML = items.length
    ? `<div class="item-grid">${items.map(itemCard).join("")}</div>`
    : emptyHtml("list");
  if (pill) pill.textContent = items.length + " Treffer";
}

function bindEvents() {
  document.addEventListener("click", e => {
    const el = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!el) return;
    const a = el.dataset.action;
    switch (a) {
      case "nav": setView(el.dataset.view); break;
      case "nav-close": closeModal(); setView(el.dataset.view); break;
      case "home": setView("start"); break;
      case "toggle-menu": toggleMenu(el); break;
      case "open-item": openItem(el.dataset.id); break;
      case "close-modal": closeModal(); break;
      case "link-items": linkItems(el.dataset.a, el.dataset.b); break;
      case "mark-retrieved": markRetrieved(el.dataset.id); break;
      case "archive-item": archiveItem(el.dataset.id); break;
      case "delete-item": deleteItem(el.dataset.id); break;
      case "export-data": exportData(); break;
      case "import-data": { const i = document.getElementById("import-file"); if (i) i.click(); break; }
      case "retry-load": retryLoad(); break;
      case "reset-data": resetData(); break;
      case "pick-photo": { const i = document.getElementById("photo-input"); if (i) i.click(); break; }
      case "clear-photo": clearPhoto(); break;
    }
  });

  document.addEventListener("submit", e => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "form-lost" || form.id === "form-found") {
      e.preventDefault();
      handleFormSubmit(form);
    }
  });

  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "f-q") {
      state.filters.q = t.value;
      clearTimeout(listTimer);
      listTimer = setTimeout(refreshList, 200);
      return;
    }
    const form = t.closest ? t.closest("form") : null;
    if (form && (form.id === "form-lost" || form.id === "form-found")) {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => updateLiveMatches(form), 250);
    }
  });

  document.addEventListener("change", e => {
    const id = e.target.id;
    if (id === "f-type") { state.filters.type = e.target.value; refreshList(); }
    else if (id === "f-status") { state.filters.status = e.target.value; refreshList(); }
    else if (id === "f-cat") { state.filters.cat = e.target.value; refreshList(); }
    else if (id === "f-loc") { state.filters.loc = e.target.value; refreshList(); }
    else if (id === "photo-input") handlePhoto(e.target);
    else if (id === "import-file") handleImport(e.target);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !document.getElementById("modal").hidden) closeModal();
    // Karten auch per Enter/Leertaste öffnen
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("item-card")) {
      e.preventDefault();
      openItem(e.target.dataset.id);
    }
  });
}

/* ---------------- Init ---------------- */
async function init() {
  bindEvents();
  updateFooterCount();
  if (await loadItems()) subscribeRealtime();
  render();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
