/* ============================================================
   Smoke-Test für app.js (ohne Browser)
   Testet: Matching, Filter, Rendering + Supabase-Persistenz
   (Persistenz läuft gegen eine In-Memory-Mock von SupabaseJS)
   Aufruf: node tests/smoke.js
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

/* ---------- In-Memory-DB + Supabase-Mock ---------- */
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

/* ---------- Sandbox (Document-/Fetch-Stubs) ---------- */
function makeEl() {
  return {
    innerHTML: "", textContent: "", hidden: false, value: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; },
    style: {}, dataset: {},
  };
}

const elements = {};
const documentStub = {
  readyState: "loading",
  addEventListener() {},
  getElementById(id) { if (!elements[id]) elements[id] = makeEl(); return elements[id]; },
  createElement() { return makeEl(); },
  querySelector() { return makeEl(); },
  querySelectorAll() { return []; },
  body: { appendChild() {} },
};

const store = makeStore();
const sandbox = {
  document: documentStub,
  SupabaseJS: makeSupabaseJS(store),
  confirm: () => true,
  console,
  crypto: typeof globalThis.crypto !== "undefined" ? globalThis.crypto : { randomUUID: () => "id-" + Math.random().toString(16).slice(2) },
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  Blob: class {},
  Image: class {},
  HTMLFormElement: class {},
  fetch: async () => ({ blob: async () => ({ type: "image/jpeg", size: 42 }) }),
  setTimeout, clearTimeout,
  window: { scrollTo() {} },
  navigator: {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const exportLine = `
;globalThis.__api = { state, findMatches, sampleItems, matchScore, applyFilters,
  normalize, tokenize, jaccard, viewStart, viewList, viewArchive, viewForm, viewStats, viewHelp,
  itemCard, setView, STATUS, ACTIVE_STATUSES,
  loadItems, subscribeRealtime, retryLoad, uploadPhoto, removePhoto,
  handleFormSubmit, handleImport, linkItems, markRetrieved,
  archiveItem, restoreItem, deleteItem, resetData, rowToItem, itemToRow,
  TBL_ITEMS, TBL_LINKS, BUCKET_FOTOS };
`;
vm.runInContext(code + exportLine, sandbox);
const api = sandbox.__api;

/* ---------- Mock-Store befüllen (spiegelt seed.sql) ---------- */
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

console.log("\n-- Matching-Algorithmus --");
check("normalize beseitigt Umlaute", api.normalize("Grüße & Größe") === "grusse grosse");
check("jaccard gleiche Texte = 1", api.jaccard("rote jacke puma", "rote jacke puma") === 1);
check("jaccard keine Übereinstimmung = 0", api.jaccard("rote jacke", "grüne flasche") === 0);

console.log("\n-- Beispieldaten --");
const samples = api.sampleItems();
check("17 Beispieldaten", samples.length === 17, "ergeben: " + samples.length);
api.state.items = samples;
const iphoneLost = samples.find(i => i.type === "lost" && /iphone/i.test(i.title));
const iphoneFound = samples.find(i => i.type === "found" && /iphone/i.test(i.title));
check("iPhone-Paare vorhanden", !!(iphoneLost && iphoneFound));
check("iPhone-Paar zugeordnet", iphoneLost.matchedWith === iphoneFound.id && iphoneFound.matchedWith === iphoneLost.id);
check("iPhone-Paar in Abwicklung", iphoneLost.status === "in_abwicklung" && iphoneFound.status === "in_abwicklung");
const jacketLost = samples.find(i => i.type === "lost" && /puma/i.test(i.title));
check("Puma-Paar abgeholt", jacketLost.status === "abgeholt" && jacketLost.matchedWith && samples.find(i => i.id === jacketLost.matchedWith).status === "abgeholt");

console.log("\n-- Smart Matching --");
const calcFound = samples.find(i => i.type === "found" && /casio/i.test(i.title));
check("Casio-Fund ist offen", calcFound.status === "offen");
const probe = { id: "__t__", type: "lost", title: "Casio Taschenrechner fx-991", category: "rechner", brand: "Casio", color: "Schwarz", location: "Kopierraum", description: "Taschenrechner verloren, Casio fx-991" };
const matches = api.findMatches(probe, 3, 0.30);
check("Matching findet Casio-Fund", matches.length > 0 && matches[0].item.id === calcFound.id, "matches: " + JSON.stringify(matches.map(m => m.item.title + " " + m.score.toFixed(2))));
check("Score des Casio-Matches hoch", matches.length > 0 && matches[0].score > 0.6, matches[0] ? "score=" + matches[0].score : "");
const weakProbe = { id: "__t2__", type: "lost", title: "Bluesches Schulbuch Mathe", category: "buecher", location: "Flur 2. OG", description: "Mathematikbuch", brand: "", color: "" };
const weakMatches = api.findMatches(weakProbe, 3, 0.5);
check("Unpassender Verlust liefert (fast) keinen Match", weakMatches.length === 0, weakMatches.map(m => m.item.title).join(", "));

console.log("\n-- Filter --");
api.state.filters = { q: "", type: "found", status: "aktiv", cat: "alle", loc: "alle" };
check("Filter type=found", api.applyFilters(api.state.items).every(i => i.type === "found"));
api.state.filters = { q: "iphone", type: "alle", status: "alle", cat: "alle", loc: "alle" };
check("Suche 'iphone' findet beide iPhone-Einträge", api.applyFilters(api.state.items).length === 2, "ergeben: " + api.applyFilters(api.state.items).length);
api.state.filters = { q: "", type: "alle", status: "abgeholt", cat: "alle", loc: "alle" };
check("Status-Filter abgeholt", api.applyFilters(api.state.items).every(i => i.status === "abgeholt"));

console.log("\n-- Rendering (HTML wird ohne Fehler erzeugt) --");
api.state.filters = { q: "", type: "alle", status: "aktiv", cat: "alle", loc: "alle" };
const htmls = {
  start: api.viewStart(),
  liste: api.viewList(),
  formLost: api.viewForm("lost"),
  formFound: api.viewForm("found"),
  archiv: api.viewArchive(),
  statistik: api.viewStats(),
  hilfe: api.viewHelp(),
};
check("Startansicht rendert (ohne Onboarding-Panel)", htmls.start.includes("Das Fundsachen-System der Schule.") && htmls.start.includes("hero") && !htmls.start.includes("So funktioniert’s"));
check("Liste rendert mit Karten", htmls.liste.includes("item-card") && htmls.liste.includes("count-pill"));
check("Archiv rendert mit Karten", htmls.archiv.includes("Archivierte Fundsachen") && htmls.archiv.includes("count-pill"));
check("Verlust-Formular rendert", htmls.formLost.includes('id="form-lost"'));
check("Fund-Formular rendert mit Pflichtfeld Kontakt", htmls.formFound.includes('id="form-found"') && htmls.formFound.includes("required"));
check("Statistik rendert (Balken)", htmls.statistik.includes("bar-fill"));
check("Hilfe rendert (Onboarding + FAQ)", htmls.hilfe.includes("faq") && htmls.hilfe.includes("So funktioniert’s"));

/* ---------- Persistenz gegen Supabase-Mock ---------- */
function makeFakeForm(values) {
  return {
    id: "form-found",
    querySelector(sel) {
      const m = sel.match(/\[name=([a-zA-Z]+)\]/);
      return { value: m ? (values[m[1]] || "") : "" };
    },
  };
}

async function main() {
  console.log("\n-- Persistenz (Supabase-Mock) --");
  const okLoad = await api.loadItems();
  check("loadItems liefert 17 Einträge", okLoad === true && api.state.items.length === 17, "count=" + api.state.items.length);
  const ipL = api.state.items.find(i => /iphone/i.test(i.title) && i.type === "lost");
  const ipF = api.state.items.find(i => /iphone/i.test(i.title) && i.type === "found");
  check("matchedWith aus Zuordnungen", ipL.matchedWith === ipF.id && ipF.matchedWith === ipL.id);
  check("events rekonstruiert (Match-Event)", ipL.events.length >= 2 && ipL.events.some(e => /Zuordnung/i.test(e.text)));
  check("date aus reported_at", Number.isFinite(ipL.date) && ipL.date > 0);
  check("footer-count aktualisiert", elements["footer-count"].textContent.includes("17"));

  console.log("\n-- Foto-Upload --");
  const photoUrl = await api.uploadPhoto("data:image/jpeg;base64,QUJD", "foto-test-1");
  check("uploadPhoto liefert Public-URL", typeof photoUrl === "string" && photoUrl.includes("/object/public/fotos/foto-test-1.jpg"), photoUrl);
  check("Foto im Storage gespeichert", store.storage.has("fotos/foto-test-1.jpg"));

  console.log("\n-- Formular-Submit (neuer Eintrag) --");
  const fakeForm = makeFakeForm({ title: "Test-Flasche Wasser", category: "flasche", location: "Mensa / Cafeteria", date: "2026-10-10", reporter: "Test T. (9c)", contact: "Abgabe: Sekretariat" });
  await api.handleFormSubmit(fakeForm);
  check("neuer Eintrag in DB", store.fundsachen.length === 18, "rows=" + store.fundsachen.length);
  check("neuer Eintrag im State", api.state.items.some(i => i.title === "Test-Flasche Wasser"));
  const newRow = store.fundsachen.find(r => r.title === "Test-Flasche Wasser");
  check("reported_at aus Formular-Datum", newRow && Date.parse(newRow.reported_at) === Date.parse("2026-10-10T12:00:00"), newRow ? newRow.reported_at : "");
  check("Start-Event gesetzt", newRow && newRow.events.length === 1 && /Fund gemeldet/.test(newRow.events[0].text));

  console.log("\n-- Zuordnung & Abholung --");
  const thermo = api.state.items.find(i => /thermos/i.test(i.title));
  const lunch = api.state.items.find(i => /lunchbox/i.test(i.title));
  check("Test-Paar gefunden (offen, gegensätzlich)", thermo && lunch && thermo.type === "lost" && lunch.type === "found");
  await api.linkItems(thermo.id, lunch.id);
  check("Zuordnung in DB", store.zuordnungen.some(l => (l.item_a === thermo.id && l.item_b === lunch.id) || (l.item_a === lunch.id && l.item_b === thermo.id)));
  check("beide in Abwicklung (State)", thermo.status === "in_abwicklung" && lunch.status === "in_abwicklung");
  check("DB-Status aktualisiert", store.fundsachen.find(r => r.id === thermo.id).status === "in_abwicklung");
  await api.markRetrieved(thermo.id);
  check("beide abgeholt (State)", thermo.status === "abgeholt" && lunch.status === "abgeholt");
  check("Abholung in DB + Event", store.fundsachen.find(r => r.id === lunch.id).status === "abgeholt" && store.fundsachen.find(r => r.id === lunch.id).events.some(e => /Abholung/i.test(e.text)));

  console.log("\n-- Archivieren & Wiederherstellen --");
  const muetze = api.state.items.find(i => /mütze|muetze/i.test(i.title) && i.status === "archiviert");
  check("Archivierter Eintrag in Beispieldaten", !!muetze);
  await api.restoreItem(muetze.id);
  check("Wiederherstellen setzt Status auf offen (State)", muetze.status === "offen");
  check("Wiederherstellen setzt Status auf offen (DB)", store.fundsachen.find(r => r.id === muetze.id).status === "offen");
  await api.archiveItem(muetze.id);
  check("Archivieren setzt Status auf archiviert (State)", muetze.status === "archiviert");
  check("Archivieren setzt Status auf archiviert (DB)", store.fundsachen.find(r => r.id === muetze.id).status === "archiviert");

  console.log("\n-- Löschen --");
  await api.deleteItem(lunch.id);
  check("Eintrag aus DB entfernt", !store.fundsachen.some(r => r.id === lunch.id));
  check("Zuordnung per Cascade entfernt", !store.zuordnungen.some(l => l.item_a === lunch.id || l.item_b === lunch.id));
  check("abgeholter Partner bleibt abgeholt", thermo.matchedWith === null && thermo.status === "abgeholt");
  const casio = api.state.items.find(i => /casio/i.test(i.title));
  const ausweis = api.state.items.find(i => /ausweis/i.test(i.title));
  check("zweites Test-Paar offen", casio && ausweis && casio.type === "found" && ausweis.type === "lost" && casio.status === "offen");
  await api.linkItems(casio.id, ausweis.id);
  check("zweites Paar in Abwicklung", casio.status === "in_abwicklung" && ausweis.status === "in_abwicklung");
  await api.deleteItem(ausweis.id);
  check("offener Partner wird wieder offen", casio.matchedWith === null && casio.status === "offen");
  check("DB-Status des Partners korrigiert", store.fundsachen.find(r => r.id === casio.id).status === "offen");

  console.log("\n-- Import --");
  const importInput = {
    value: "x",
    files: [{ text: async () => JSON.stringify({ app: "kaethekiste", version: 1, items: [{ id: "imp-1", type: "lost", title: "Import-Test Rucksack", category: "nichting", location: "Pausenhof", reporter: "T" }] }) }],
  };
  await api.handleImport(importInput);
  check("importierter Eintrag in DB", store.fundsachen.some(r => r.id === "imp-1"));
  check("State nach Import geladen", api.state.items.some(i => i.id === "imp-1"));

  console.log("\n-- Realtime (Remote-Änderung) --");
  api.subscribeRealtime();
  check("Realtime-Kanal abonniert", store.channels.length === 1 && store.channels[0].handlers.length === 2);
  store.fundsachen.push({
    id: "rt-1", type: "found", title: "Remote-Marker", description: "",
    category: "stifte", brand: "", color: "Gelb", location: "Kopierraum",
    photo: "", status: "offen", reporter: "Remote R.", contact: "Abgabe: Sekretariat",
    reported_at: new Date().toISOString(), created_at: new Date().toISOString(),
    events: [{ ts: Date.now(), text: "Fund gemeldet" }],
  });
  const before = api.state.items.length;
  for (const h of store.channels[0].handlers) h.cb();
  await new Promise(r => setTimeout(r, 650));
  check("Remote-Änderung synchronisiert", api.state.items.length === before + 1 && api.state.items.some(i => i.id === "rt-1"), "vorher=" + before + " nachher=" + api.state.items.length);

  console.log("\n-- Zurücksetzen (gemeinsame DB) --");
  await api.resetData();
  check("alle Einträge + Zuordnungen gelöscht", store.fundsachen.length === 0 && store.zuordnungen.length === 0 && api.state.items.length === 0);
  check("loadError nach allem sauber", api.state.loadError === false);

  console.log("\n----------------------------------------");
  console.log(passed + " OK, " + failed + " FAIL");
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error("Test fehlgeschlagen:", err);
  process.exit(1);
});
