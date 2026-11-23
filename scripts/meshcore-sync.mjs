// MeshCore: dane moich nodów z oficjalnej mapy (map.meshcore.io) -> data/meshcore.latest.js.
// API zwraca bieżący stan noda (nazwa, typ, parametry radia, czas ostatniego advertu na mapie), bez historii i raportów odbioru.
// Plik jest zapisywany tylko wtedy, gdy coś się zmieniło — dzięki temu workflow nie commituje co pół godziny.
// Pozycji noda ani linku meshcore:// celowo nie zapisujemy.
import fs from "node:fs/promises";
import path from "node:path";

const API = process.env.MESHCORE_API || "https://map.meshcore.io/api/v1/nodes";
// Pełne klucze publiczne (64 znaki hex), w kolejności wyświetlania na stronie.
const NODE_KEYS = (process.env.MESHCORE_NODE_KEYS || "a27b781d69ca7c969683f16145cbd685d36287fe268ef069aef8f671cfd36d13")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const AGENT = process.env.MESH_AGENT || "static-site-mesh-sync/1.0";
const LATEST = path.join("data", "meshcore.latest.js");
const KEY_RE = /^[0-9a-f]{64}$/;
const PREFIX = "window.MESHCORE_DATA = ";

const iso = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const isoOrNull = s => { const ms = Date.parse(s); return Number.isNaN(ms) ? null : iso(ms); };

async function readLatest() {
  try {
    const txt = await fs.readFile(LATEST, "utf8");
    return JSON.parse(txt.slice(PREFIX.length).trim().replace(/;$/, ""));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return { nodes: {} };
  }
}

// null = mapa nie zna noda (404) — wtedy zostają ostatnie znane dane.
async function fetchNode(key) {
  const res = await fetch(`${API}/${key}`, { headers: { "User-Agent": AGENT, Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${key.slice(0, 8)}: HTTP ${res.status}`);
  return res.json();
}

// Czas ostatniej aktywności bierzemy z "updated_date" (zegar serwera mapy). "last_advert" pochodzi z advertu i na mapie bywa
// przesunięty o strefę czasową (zwykle 1–2 h wstecz), więc go nie używamy.
export function pick(n, prev = {}) {
  const p = n.params || {};
  const num = v => Number.isFinite(v) ? v : null;
  return {
    name: n.adv_name || prev.name || "",
    type: Number.isInteger(n.type) ? n.type : prev.type ?? null,
    lastSeen: isoOrNull(n.updated_date) || prev.lastSeen || null,
    firstSeen: isoOrNull(n.inserted_date) || prev.firstSeen || null,
    source: n.source || prev.source || null,
    radio: { freq: num(p.freq), bw: num(p.bw), sf: num(p.sf), cr: num(p.cr) }
  };
}

async function main() {
  const bad = NODE_KEYS.filter(k => !KEY_RE.test(k));
  if (bad.length) throw new Error(`Not a 64-hex public key: ${bad.join(", ")}`);

  const old = await readLatest();
  const nodes = {};
  for (const key of NODE_KEYS) {
    const prev = old.nodes?.[key];
    const n = await fetchNode(key);
    if (n) nodes[key] = pick(n, prev);
    else if (prev) { nodes[key] = prev; console.warn(`${key.slice(0, 8)}: not on the map, keeping last known data`); }
    else console.warn(`${key.slice(0, 8)}: not on the map`);
  }

  if (JSON.stringify(nodes) === JSON.stringify(old.nodes || {})) {
    console.log("No changes in MeshCore data");
    return;
  }

  const latest = { updated: iso(Date.now()), nodes };
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(LATEST, `${PREFIX}${JSON.stringify(latest)};\n`);
  for (const [key, n] of Object.entries(nodes)) console.log(`${key.slice(0, 8)} ${n.name}: last seen on the map ${n.lastSeen}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
