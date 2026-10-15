/* ============================================================
   UI-Klick-Test für app.js (ohne Browser)
   Simuliert alle Buttons/Links der App über die echte
   Document-Event-Delegation (Klick, Submit, Input, Change,
   Tastatur) – inkl. Topbar-Navigation.
   Aufruf: node tests/ui_clicks.js
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  OK   " + name); }
  else { failed++; console.log("  FAIL " + name + (extra ? " → " + extra : "")); }
}
function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- In-Memory-DB + Supabase-Mock (wie smoke.js) ---------- */
function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: k => m.delete(String(k)),
    clear: () => m.clear(),
  };
}

function makeStore() {
  return { fundsachen: [], zuordnungen: [], storage: new Map(), channels: [] };
}

function makeTable(store, table) {
  let op = "select", payload = null;
  const wheres = [];
  function builder() {
    const b = {};
    b.select = () => { op = "select"; return b; };
    b.insert = vals => { op = "insert"; payload = Array.isArray(vals) ? vals : [vals]; return b; };
    b.upsert = vals => { op = "upsert"; payload = Array.isArray(vals) ? vals : [vals]; return b; };
    b.update = vals => { op = "update"; payload = vals; return b; };
    b.delete = () => { op = "delete"; return b; };
    b.eq = (col, v) => { wheres.push({ t: "eq", col, v }); return b; };
    b.neq = (col, v) => { wheres.push({ t: "neq", col, v }); return b; };
    b.in = (col, vals) => { wheres.push({ t: "in", col, vals }); return b; };
    b.or = spec => { wheres.push({ t: "or", spec }); return b; };
    b.then = (ok, err) => Promise.resolve(run()).then(ok, err);
    return b;
  }
  function match(r, w) {
    if (w.t === "eq") return r[w.col] === w.v;
    if (w.t === "neq") return r[w.col] !== w.v;
    if (w.t === "in") return w.vals.includes(r[w.col]);
    if (w.t === "or") return w.spec.split(",").map(p => {
      const m = p.match(/^([a-z_]+)(eq|neq)(.+)$/);
      return m ? (m[2] === "eq" ? r[m[1]] === m[3] : r[m[1]] !== m[3]) : false;
    }).some(Boolean);
    return true;
  }
  function run() {
    const now = new Date().toISOString();
    const rows = store[table];
    if (op === "select") {
      return { data: deepCopy(rows.filter(r => wheres.every(w => match(r, w)))), error: null };
    }
    if (op === "insert" || op === "upsert") {
      const created = [];
      for (const p of payload) {
        const row = { ...p };
        if (table === "fundsachen") {
          if (!row.id) row.id = "gen-" + Math.random().toString(16).slice(2);
          const existing = rows.find(r => r.id === row.id);
          if (existing) {
            if (op === "upsert") { Object.assign(existing, row, { updated_at: now }); created.push(existing); continue; }
            return { data: null, error: { message: "duplicate key (id " + row.id + ")" } };
          }
          row.created_at = row.created_at || now;
          row.updated_at = now;
          rows.push(row);
        } else {
          const dup = rows.find(r => r.item_a === row.item_a && r.item_b === row.item_b);
          if (dup) {
            if (op === "upsert") { created.push(dup); continue; }
            return { data: null, error: { message: "duplicate pair" } };
          }
          row.created_at = row.created_at || now;
          rows.push(row);
        }
        created.push(row);
      }
      return { data: deepCopy(created), error: null };
    }
    if (op === "update") {
      const hits = rows.filter(r => wheres.every(w => match(r, w)));
      for (const r of hits) { Object.assign(r, payload); r.updated_at = now; }
      return { data: deepCopy(hits), error: null };
    }
    if (op === "delete") {
      const keep = rows.filter(r => !wheres.every(w => match(r, w)));
      store[table] = keep;
      if (table === "fundsachen") {
        const ids = new Set(keep.map(r => r.id));
            store.zuordnungen = store.zuordnungen.filter(l => ids.has(l.item_a) && ids.has(l.item_b));
          }
      return { data: null, error: null };
    }
    return { data: null, error: { message: "unknown op " + op } };
  }
  return builder();
}

function makeStorageClient(store) {
  const from = bucket => ({
    upload: async (p, blob) => {
      store.storage.set(bucket + "/" + p, blob);
      return { data: { Key: bucket + "/" + p }, error: null };
    },
    getPublicUrl: p => ({ data: { publicUrl: "https://fhszzxxtvvqtdnqhnktk.supabase.co/storage/v1/object/public/" + bucket + "/" + p } }),
    remove: async paths => {
      for (const p of (Array.isArray(paths) ? paths : [paths])) store.storage.delete(bucket + "/" + p);
      return { data: null, error: null };
    },
  });
  return { from };
}

function makeChannel(store, name) {
  const ch = { name, handlers: [] };
  ch.on = (type, filter, cb) => { ch.handlers.push({ type, filter, cb }); return ch; };
  ch.subscribe = () => { store.channels.push(ch); return ch; };
  return ch;
}

function makeSupabaseJS(store) {
  return {
    createClient: () => ({
      from: table => makeTable(store, table),
      storage: makeStorageClient(store),
      channel: name => makeChannel(store, name),
    }),
  };
}

/* ---------- DOM-Stub mit Listener-Erfassung ---------- */
function makeEl(id) {
  const el = {
    id: id || "",
    innerHTML: "", textContent: "", hidden: false, value: "",
    dataset: {},
    style: {},
    classList: {
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      toggle(c, force) {
        const want = force === undefined ? !this._set.has(c) : !!force;
        if (want) this._set.add(c); else this._set.delete(c);
        return want;
      },
      contains(c) { return this._set.has(c); },
    },
    setAttribute() {}, getAttribute() { return null; },
    closest(sel) {
      if (sel === "[data-action]" && this.dataset.action) return this;
      if (sel === "[data-view]" && this.dataset.view) return this;
      return null;
    },
    click() { documentStub.dispatchClick(el); },
    remove() {},
  };
  return el;
}

const elements = {};
const listeners = {};
const documentStub = {
  readyState: "complete", // → init() läuft direkt beim Laden
  addEventListener(t, cb) { (listeners[t] = listeners[t] || []).push(cb); },
  documentElement: { dataset: {} },
  dispatchClick(target) {
    const ev = { target, preventDefault() {}, stopPropagation() {} };
    (listeners.click || []).forEach(h => h(ev));
  },
  getElementById(id) { if (!elements[id]) elements[id] = makeEl(id); return elements[id]; },
  createElement() { return makeEl("created"); },
  // stabiles Modal-Panel, damit wir prüfen können, was reingetragen wurde
  querySelector(sel) { if (sel === "#modal .modal-panel") return elements["__panel__"] || (elements["__panel__"] = makeEl("panel")); return makeEl(); },
  querySelectorAll() { return { forEach() {} }; },
  body: { appendChild() {} },
};

/* ---------- Sandbox + Laden ---------- */
const store = makeStore();
const sandbox = {
  document: documentStub,
  localStorage: makeLocalStorage(),
  SupabaseJS: makeSupabaseJS(store),
  confirm: () => true,
  console,
  crypto: typeof globalThis.crypto !== "undefined" ? globalThis.crypto : { randomUUID: () => "id-" + Math.random().toString(16).slice(2) },
  Blob,
  URL: { createObjectURL: () => "blob:export", revokeObjectURL() {} },
  HTMLFormElement: class {},
  fetch: async () => ({ blob: async () => ({ type: "image/jpeg", size: 42 }) }),
  setTimeout, clearTimeout,
  window: { scrollTo() {} },
  navigator: {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const exportLine = "\n;globalThis.__api = { state, sampleItems, applyFilters, loadItems };\n";
vm.runInContext(code + exportLine, sandbox);
const api = sandbox.__api;

/* ---------- Seed (spiegelt seed.sql) ---------- */
function itemToDbRow(it) {
  return {
    id: it.id, type: it.type, title: it.title,
    description: it.description, category: it.category, brand: it.brand,
    color: it.color, location: it.location, photo: it.photo, status: it.status,
    reporter: it.reporter, contact: it.contact,
    reported_at: new Date(it.date).toISOString(),
    created_at: new Date(it.createdAt).toISOString(),
    events: it.events,
  };
}
const seed = api.sampleItems();
for (const it of seed) store.fundsachen.push(itemToDbRow(it));
const pairSeen = new Set();
for (const it of seed) {
  if (!it.matchedWith) continue;
  const key = [it.id, it.matchedWith].sort().join("|");
  if (!pairSeen.has(key)) { pairSeen.add(key); store.zuordnungen.push({ item_a: it.id, item_b: it.matchedWith }); }
}

/* ---------- Dispatch-Helfer (simulierte Browser-Events) ---------- */
function click(dataset) {
  const target = makeEl("synth");
  Object.assign(target.dataset, dataset || {});
  documentStub.dispatchClick(target);
}
function inputEvt(target) { (listeners.input || []).forEach(h => h({ target, preventDefault() {} })); }
function changeEvt(target) { (listeners.change || []).forEach(h => h({ target, preventDefault() {} })); }
function keyEvt(e) { (listeners.keydown || []).forEach(h => h(e)); }
function submitEvt(form) { (listeners.submit || []).forEach(h => h({ target: form, preventDefault() {} })); }

function makeFakeForm(id, values, liveBox) {
  return {
    id,
    value: "",
    querySelector(sel) {
      if (sel.startsWith("#")) return liveBox;
      const m = sel.match(/\[name=([a-zA-Z]+)\]/);
      return { value: m ? (values[m[1]] || "") : "" };
    },
  };
}

async function main() {
  /* init() läuft asynchron beim Laden – warten, bis die Startansicht da ist */
  const mainEl = documentStub.getElementById("main");
  const t0 = Date.now();
  while (!mainEl.innerHTML && Date.now() - t0 < 5000) await sleep(20);
  check("init: Hilfeansicht mit Onboarding geladen (17 Einträge)", api.state.items.length === 17 && mainEl.innerHTML.includes("faq") && mainEl.innerHTML.includes("So funktioniert’s"));

  console.log("\n-- Topbar / Navigation (data-action=nav) --");
  const views = [
    ["liste", "item-card"],
    ["archiv", "count-pill"],
    ["form-lost", 'id="form-lost"'],
    ["form-found", 'id="form-found"'],
    ["statistik", "bar-fill"],
    ["hilfe", "faq"],
    ["start", "hero"],
  ];
  for (const [v, marker] of views) {
    click({ action: "nav", view: v });
    check("Nav-Button → " + v, api.state.view === v && elements["main"].innerHTML.includes(marker));
  }
  // Klick auf Element mit reinem data-view (ohne data-action)
  click({ view: "liste" });
  check("Nav-Element mit reinem data-view → liste", api.state.view === "liste");

  click({ action: "home" });
  check("Logo-Button (home) → Start", api.state.view === "start");

  console.log("\n-- Mobiles Menü (toggle-menu) --");
  const nav = documentStub.getElementById("nav-mobile");
  nav.hidden = true; // wie in index.html (hidden-Attribut)
  click({ action: "toggle-menu" });
  check("Menü öffnen", nav.hidden === false);
  click({ action: "toggle-menu" });
  check("Menü schließen", nav.hidden === true);
  click({ action: "toggle-menu" });
  click({ action: "nav", view: "hilfe" });
  check("Navigation schließt mobiles Menü automatisch", nav.hidden === true);

  console.log("\n-- Detail-Modal (open-item / close-modal / Escape / Enter) --");
  const ipF = api.state.items.find(i => /iphone/i.test(i.title) && i.type === "found");
  const ipL = api.state.items.find(i => /iphone/i.test(i.title) && i.type === "lost");
  click({ action: "open-item", id: ipF.id });
  check("Karte anklicken: Detail öffnet (Titel, Partner, Abholung-Button)",
    elements["modal"].hidden === false &&
    elements["__panel__"].innerHTML.includes(ipF.title) &&
    elements["__panel__"].innerHTML.includes("mark-retrieved"));
  click({ action: "close-modal" });
  check("„Schließen“-Button", elements["modal"].hidden === true);
  click({ action: "open-item", id: ipF.id });
  keyEvt({ key: "Escape", preventDefault() {}, target: elements["__panel__"] });
  check("Escape schließt Modal", elements["modal"].hidden === true);
  const puma = api.state.items.find(i => /puma/i.test(i.title));
  keyEvt({ key: "Enter", preventDefault() {}, target: { classList: { contains: c => c === "item-card" }, dataset: { id: puma.id } } });
  check("Enter auf Karte öffnet Detail", elements["modal"].hidden === false && elements["__panel__"].innerHTML.includes(puma.title));
  click({ action: "close-modal" });

  console.log("\n-- Formular: Live-Matches beim Tippen --");
  click({ action: "nav", view: "form-lost" });
  const liveBox = makeEl("live-matches");
  const fakeFormIn = makeFakeForm("form-lost", { title: "Casio Taschenrechner fx-991", brand: "Casio", color: "Schwarz", category: "rechner", location: "Kopierraum", description: "Taschenrechner, Casio, verloren im Kopierraum" }, liveBox);
  inputEvt({ id: "f-title", value: "x", closest: sel => (sel === "form" ? fakeFormIn : null) });
  await sleep(400);
  check("Live-Matches erscheinen (Casio-Fund)", liveBox.innerHTML.includes("match-box"), liveBox.innerHTML.slice(0, 120));

  console.log("\n-- Formular: Absenden (Submit) --");
  click({ action: "nav", view: "form-found" });
  const formBad = Object.assign(new sandbox.HTMLFormElement(), makeFakeForm("form-found", { title: "", category: "flasche", location: "Mensa / Cafeteria" }));
  const before = store.fundsachen.length;
  submitEvt(formBad);
  await sleep(100);
  check("Pflichtfeld-Validierung (nichts in DB)", store.fundsachen.length === before && elements["toast"].textContent.includes("Pflichtfelder"));
  const formOk = Object.assign(new sandbox.HTMLFormElement(), makeFakeForm("form-found", { title: "Klick-Flasche Mineralwasser", category: "flasche", location: "Mensa / Cafeteria", date: "2026-10-12", reporter: "Test K.", contact: "Abgabe: Sekretariat" }));
  submitEvt(formOk);
  await sleep(200);
  check("Absenden: Eintrag in DB", store.fundsachen.some(r => r.title === "Klick-Flasche Mineralwasser"));
  check("Absenden: Erfolgs-Modal, Save-Flag zurück", elements["modal"].hidden === false && elements["__panel__"].innerHTML.includes("success-ic") && api.state.saving === false);
  click({ action: "nav-close", view: "liste" });
  check("„Zur Liste“ (nav-close) schließt Modal + navigiert", elements["modal"].hidden === true && api.state.view === "liste");

  console.log("\n-- Aktions-Buttons (Zuordnen / Abholen / Archivieren / Löschen) --");
  const thermo = api.state.items.find(i => /thermos/i.test(i.title));
  const lunch = api.state.items.find(i => /lunchbox/i.test(i.title));
  check("Test-Paare gefunden (offen, gegensätzlich)", thermo && lunch && thermo.type === "lost" && lunch.type === "found" && thermo.status === "offen" && lunch.status === "offen");
  click({ action: "link-items", a: thermo.id, b: lunch.id });
  await sleep(150);
  check("„Zuordnen“: Link in DB + Status in_abwicklung",
    store.zuordnungen.some(l => (l.item_a === thermo.id && l.item_b === lunch.id) || (l.item_a === lunch.id && l.item_b === thermo.id)) &&
    api.state.items.find(i => i.id === thermo.id).status === "in_abwicklung");
  click({ action: "mark-retrieved", id: thermo.id });
  await sleep(150);
  check("„Abholung bestätigen“: beide abgeholt (DB)", store.fundsachen.find(r => r.id === thermo.id).status === "abgeholt" && store.fundsachen.find(r => r.id === lunch.id).status === "abgeholt");
  const book = api.state.items.find(i => /prinz/i.test(i.title) && i.status === "offen");
  check("Offenes Buch gefunden", !!book);
  click({ action: "claim-item", id: book.id });
  await sleep(150);
  check("„Direkt annehmen“ (claim-item): abgeholt (DB)", store.fundsachen.find(r => r.id === book.id).status === "abgeholt");

  const casio = api.state.items.find(i => /casio/i.test(i.title));
  click({ action: "archive-item", id: casio.id });
  await sleep(150);
  check("„Archivieren“ (DB)", store.fundsachen.find(r => r.id === casio.id).status === "archiviert");
  click({ action: "restore-item", id: casio.id });
  await sleep(150);
  check("„Aus Archiv wiederherstellen“ (DB)", store.fundsachen.find(r => r.id === casio.id).status === "offen");
  click({ action: "delete-item", id: lunch.id });
  await sleep(150);
  check("„Löschen“: Eintrag + Zuordnung aus DB", !store.fundsachen.some(r => r.id === lunch.id) && !store.zuordnungen.some(l => l.item_a === lunch.id || l.item_b === lunch.id));

  console.log("\n-- Filter (Live-Input + Change) --");
  inputEvt({ id: "f-q", value: "iphone", closest: () => null });
  await sleep(300);
  check("Suche „iphone“ (Debounce): 2 Treffer", elements["count-pill"].textContent === "2 Treffer" && elements["item-grid-wrap"].innerHTML.includes(ipF.title) && elements["item-grid-wrap"].innerHTML.includes(ipL.title), elements["count-pill"].textContent);
  changeEvt({ id: "f-type", value: "found" });
  const exp = api.applyFilters(api.state.items).length;
  check("Filter type=found (Change)", elements["count-pill"].textContent === exp + " Treffer");

  console.log("\n-- Daten-Buttons (Export / Import / Foto / Retry) --");
  click({ action: "export-data" });
  check("„Export“ (Toast + Blob-Download)", elements["toast"].textContent.includes("Export"));
  click({ action: "import-data" });
  check("„Import“ öffnet Dateiauswahl (ohne Fehler)", true);
  click({ action: "pick-photo" });
  check("„Foto wählen“ öffnet Dateiauswahl (ohne Fehler)", true);
  click({ action: "clear-photo" });
  check("„Bild entfernen“ setzt Dropzone zurück", elements["dropzone"].innerHTML.length > 0);
  const importFile = {
    id: "import-file",
    value: "x",
    files: [{ text: async () => JSON.stringify({ app: "kaethekiste", version: 1, items: [{ id: "imp-c", type: "found", title: "Klick-Import Kugelschreiber", category: "stifte", location: "Hof", contact: "Abgabe: Sekretariat" }] }) }],
  };
  changeEvt(importFile);
  await sleep(200);
  check("Import per Change-Event: Eintrag in DB + State", store.fundsachen.some(r => r.id === "imp-c") && api.state.items.some(i => i.id === "imp-c"));
  click({ action: "retry-load" });
  await sleep(100);
  check("„Erneut versuchen“ (retry-load)", api.state.loadError === false && api.state.items.length > 0);

  console.log("\n-- Design-Theme (toggle-theme) --");
  check("Default: helles Design (kein dunkles Attribut, State=light)",
    documentStub.documentElement.dataset.theme !== "dark" && api.state.theme === "light");
  click({ action: "toggle-theme" });
  check("Toggle → dunkel (data-theme am <html> + State)",
    documentStub.documentElement.dataset.theme === "dark" && api.state.theme === "dark");
  check("Wahl wird lokal gespeichert (kk-theme=dark)", sandbox.localStorage.getItem("kk-theme") === "dark");
  click({ action: "toggle-theme" });
  check("Toggle zurück → hell (data-theme + State + Speicherung)",
    documentStub.documentElement.dataset.theme === "light" && api.state.theme === "light" &&
    sandbox.localStorage.getItem("kk-theme") === "light");

  console.log("\n-- Zurücksetzen (letzte Aktion) --");
  click({ action: "reset-data" });
  await sleep(250);
  check("„Alle Daten löschen“: DB + State leer", store.fundsachen.length === 0 && store.zuordnungen.length === 0 && api.state.items.length === 0 && elements["toast"].textContent.includes("Alle Daten gelöscht"));

  console.log("\n----------------------------------------");
  console.log(passed + " OK, " + failed + " FAIL");
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error("Test fehlgeschlagen:", err);
  process.exit(1);
});
