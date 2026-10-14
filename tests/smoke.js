/* ============================================================
   Smoke-Test für app.js (ohne Browser)
   Testet: Matching, Filter, Beispieldaten, Rendering
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

const sandbox = {
  document: documentStub,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  confirm: () => true,
  console,
  crypto: typeof globalThis.crypto !== "undefined" ? globalThis.crypto : { randomUUID: () => "id-" + Math.random().toString(16).slice(2) },
  URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  Blob: class {},
  Image: class {},
  HTMLFormElement: class {},
  setTimeout, clearTimeout,
  window: { scrollTo() {} },
  navigator: {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const exportLine = `
;globalThis.__api = { state, findMatches, sampleItems, matchScore, applyFilters,
  normalize, tokenize, jaccard, viewStart, viewList, viewForm, viewStats, viewHelp,
  itemCard, setView, STATUS, ACTIVE_STATUSES };
`;
vm.runInContext(code + exportLine, sandbox);
const api = sandbox.__api;

console.log("\n-- Matching-Algorithmus --");
check("normalize beseitigt Umlaute", api.normalize("Grüße & Größe") === "grusse grosse");
check("jaccard gleiche Texte = 1", api.jaccard("rote jacke puma", "rote jacke puma") === 1);
check("jaccard keine Übereinstimmung = 0", api.jaccard("rote jacke", "grüne flasche") === 0);

console.log("\n-- Beispieldaten --");
const samples = api.sampleItems();
check("11 Beispieldaten", samples.length === 11, "ergeben: " + samples.length);
api.state.items = samples;
const iphoneLost = samples.find(i => i.type === "lost" && /iphone/i.test(i.title));
const iphoneFound = samples.find(i => i.type === "found" && /iphone/i.test(i.title));
check("iPhone-Paare vorhanden", !!(iphoneLost && iphoneFound));
check("iPhone-Paar zugeordnet", iphoneLost.matchedWith === iphoneFound.id && iphoneFound.matchedWith === iphoneLost.id);
check("iPhone-Paar in Abwicklung", iphoneLost.status === "in_abwicklung" && iphoneFound.status === "in_abwicklung");
const jacketLost = samples.find(i => i.type === "lost" && /puma/i.test(i.title));
check("Puma-Paar abgeholt", jacketLost.status === "abgeholt" && jacketLost.matchedWith && samples.find(i => i.id === jacketLost.matchedWith).status === "abgeholt");

console.log("\n-- Smart Matching --");
// iPhone (in Abwicklung) zählt nicht als aktiv → Rechner-Fund testen
const calcFound = samples.find(i => i.type === "found" && /casio/i.test(i.title));
check("Casio-Fund ist offen", calcFound.status === "offen");
const probe = { id: "__t__", type: "lost", title: "Casio Taschenrechner fx-991", category: "rechner", brand: "Casio", color: "Schwarz", location: "Kopierraum", description: "Taschenrechner verloren, Casio fx-991" };
const matches = api.findMatches(probe, 3, 0.30);
check("Matching findet Casio-Fund", matches.length > 0 && matches[0].item.id === calcFound.id, "matches: " + JSON.stringify(matches.map(m => m.item.title + " " + m.score.toFixed(2))));
check("Score des Casio-Matches hoch", matches.length > 0 && matches[0].score > 0.6, matches[0] ? "score=" + matches[0].score : "");
const weakProbe = { id: "__t2__", type: "lost", title: "Bluesches Schulbuch Mathe", category: "buecher", location: "Flur 2. OG", description: "Mathematikbuch", brand: "", color: "", };
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
  statistik: api.viewStats(),
  hilfe: api.viewHelp(),
};
check("Startansicht rendert", htmls.start.includes("Das Fundsachen-System der Schule.") && htmls.start.includes("hero"));
check("Liste rendert mit Karten", htmls.liste.includes("item-card") && htmls.liste.includes("count-pill"));
check("Verlust-Formular rendert", htmls.formLost.includes('id="form-lost"'));
check("Fund-Formular rendert mit Pflichtfeld Kontakt", htmls.formFound.includes('id="form-found"') && htmls.formFound.includes("required"));
check("Statistik rendert (Balken)", htmls.statistik.includes("bar-fill"));
check("Hilfe rendert (FAQ)", htmls.hilfe.includes("faq"));

process.exit(failed ? 1 : 0);
