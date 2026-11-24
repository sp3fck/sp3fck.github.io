// Meshtastic: status moich nodów i raporty odbioru z API lorastats.pl -> data/mesh.history.json + data/mesh.latest.js.
// API oddaje tylko ostatnie 24 h, więc każdy przebieg dopisuje nowe raporty do historii (bez duplikatów).
// Pliki są zapisywane tylko wtedy, gdy coś się zmieniło — dzięki temu workflow nie commituje co pół godziny.
// Do grafu ścieżek zapisujemy też bajt przekaźnika z raportu (ostatni bajt ID noda, który podał pakiet bramce)
// i ścieżki z pakietów traceroute (same ID nodów). Z pakietów telemetrii zapisujemy same liczby (temperatura, bateria itd.).
// Pozycji nodów ani treści wiadomości celowo nie zapisujemy.
import fs from "node:fs/promises";
import path from "node:path";

const API = process.env.MESH_API || "https://lorastats.pl/API/Zach%C3%B3d";
// Moje nody, w kolejności wyświetlania na stronie (companion, baza).
const NODE_IDS = (process.env.MESH_NODE_IDS || process.env.MESH_NODE_ID || "9254eab8,e0a76739")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const AGENT = process.env.MESH_AGENT || "static-site-mesh-sync/1.0";
const LATEST_DAYS = 30;

const HISTORY = path.join("data", "mesh.history.json");
const LATEST = path.join("data", "mesh.latest.js");

const PACKET_TYPES = { 1: "text", 3: "position", 4: "nodeinfo", 67: "telemetry", 70: "traceroute", 71: "neighbors" };
const TRACEROUTE = 70;
const TELEMETRY_PORT = 67;
const UNKNOWN_HOP = "ffffffff"; // firmware wpisuje to w ścieżkę, gdy przekaźnik się nie przedstawił
const NODE_RE = /^[0-9a-f]{8}$/;

async function get(pathAndQuery) {
  const res = await fetch(`${API}/${pathAndQuery}`, { headers: { "User-Agent": AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${pathAndQuery}: HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`${pathAndQuery}: expected a JSON array`);
  return data;
}

const iso = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

// lorastats podaje zwykle czas polski bez strefy ("2026-11-12T15:06:39") — zamieniamy na UTC.
// Czasem dokleja już strefę ("…+01:00") — wtedy wystarczy ją odczytać.
const warsaw = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Warsaw", hourCycle: "h23",
  year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"
});
function warsawOffset(ms) {
  const p = Object.fromEntries(warsaw.formatToParts(new Date(ms)).map(x => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
export function warsawToUtc(local) {
  if (!local) return null;
  if (/(Z|[+-]\d\d:?\d\d)$/i.test(local)) {
    const ms = Date.parse(local);
    return Number.isNaN(ms) ? null : iso(ms);
  }
  const naive = Date.parse(`${local}Z`);
  if (Number.isNaN(naive)) return null;
  let utc = naive - warsawOffset(naive);
  utc = naive - warsawOffset(utc); // drugi krok poprawia godziny tuż przy zmianie czasu
  return iso(utc);
}

// RelayNode to ostatni bajt ID przekaźnika (0 = firmware go nie podał).
export function relayByte(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 256 ? n.toString(16).padStart(2, "0") : null;
}

// Payload traceroute: ścieżki do kolejnych bramek, "a,b,c|a,b,d". Bierzemy tylko te, które zaczynają się od nadawcy.
export function parsePaths(payload, from) {
  return String(payload || "").split("|")
    .map(s => s.split(",").map(x => x.trim().toLowerCase()))
    .filter(p => p.length >= 2 && p[0] === from && p.every(x => NODE_RE.test(x)));
}

// Payload telemetrii lorastats podaje jako tekst, np. "3.6 °C, 1007 hPa" albo "0.32% ChUtil, 0.26% AirUtilTx, 64% Bat".
// Wyciągamy same liczby; bateria > 100% to w Meshtastic zasilanie zewnętrzne — zapisujemy ją tak, jak przyszła.
const TELEMETRY = {
  temp: /(-?\d+(?:\.\d+)?) ?°C/,
  pres: /(\d+(?:\.\d+)?) ?hPa/,
  bat: /(\d+(?:\.\d+)?)% ?Bat/,
  ch: /(\d+(?:\.\d+)?)% ?ChUtil/,
  air: /(\d+(?:\.\d+)?)% ?AirUtilTx/,
  v: /(-?\d+(?:\.\d+)?) ?V\b/,
  ma: /(-?\d+(?:\.\d+)?) ?mA\b/
};
export function parseTelemetry(payload) {
  const text = String(payload ?? "");
  const out = {};
  for (const [k, re] of Object.entries(TELEMETRY)) {
    const m = text.match(re);
    if (m) out[k] = Number(m[1]);
  }
  return Object.keys(out).length ? out : null;
}

async function readHistory() {
  let h;
  try {
    h = JSON.parse(await fs.readFile(HISTORY, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    h = {};
  }
  // Starsze formaty: jeden node ("node") i mapa nazw tylko bramek ("gateways").
  // Raporty i ścieżki bez pola "from" należą do tamtego jedynego noda.
  const legacy = h.node && h.node.id;
  if (!h.nodes) {
    h.nodes = {};
    if (legacy) {
      const { id, ...rest } = h.node;
      h.nodes[id] = rest;
    }
  }
  delete h.node;
  h.names = h.names || h.gateways || {};
  delete h.gateways;
  h.reports = (h.reports || []).map(r => ({ t: r.t, from: r.from || legacy, ...r }));
  h.routes = (h.routes || []).map(r => ({ t: r.t, from: r.from || legacy, ...r }));
  h.telemetry = h.telemetry || [];
  return h;
}

const snapshot = h => JSON.stringify({ nodes: h.nodes, names: h.names, reports: h.reports, routes: h.routes, telemetry: h.telemetry });

async function syncNode(history, nodeId, known, routes, tele) {
  const [nodes, reports, packets] = await Promise.all([
    get(`Nodes/JSON?node=${nodeId}`),
    get(`PacketReports/JSON?fromNode=${nodeId}`),
    get(`PacketsParsed/JSON?fromNode=${nodeId}`)
  ]);

  // Node znika z API po dobie ciszy — wtedy zostają ostatnie znane dane.
  const prev = history.nodes[nodeId] || {};
  const me = nodes.find(n => String(n.NodeId).toLowerCase() === nodeId);
  history.nodes[nodeId] = me ? {
    shortName: me.ShortName || prev.shortName || "",
    longName: me.LongName || prev.longName || "",
    role: Number.isInteger(me.Role) ? me.Role : prev.role ?? null,
    lastSeen: warsawToUtc(me.LastSeen) || prev.lastSeen || null
  } : prev;

  const packetInfo = new Map(packets.map(p => [p.PacketId, p]));
  for (const r of reports) {
    const t = warsawToUtc(r.Time);
    if (!t || !r.Gateway || !r.PacketId) continue;
    const key = `${nodeId}|${r.PacketId}|${r.Gateway}`;
    const relay = relayByte(r.RelayNode);
    const old = known.get(key);
    if (old) {
      // Raporty sprzed zapisu przekaźników uzupełniamy, póki API jeszcze je oddaje (24 h).
      if (!("relay" in old)) old.relay = relay;
      continue;
    }
    const p = packetInfo.get(r.PacketId);
    const hops = p && Number.isFinite(p.HopStart) && Number.isFinite(r.HopLimit) ? Math.max(0, p.HopStart - r.HopLimit) : null;
    const report = {
      t,
      from: nodeId,
      gw: r.Gateway,
      id: r.PacketId,
      snr: Number.isFinite(r.SNR) ? r.SNR : null,
      hops,
      relay,
      type: p ? PACKET_TYPES[p.PortNum] || String(p.PortNum) : null
    };
    known.set(key, report);
    history.reports.push(report);
  }

  // Ścieżki traceroute — ten sam pakiet wraca w kolejnych przebiegach, czasem z nowymi bramkami, więc łączymy.
  for (const p of packets) {
    if (p.PortNum !== TRACEROUTE) continue;
    const t = warsawToUtc(p.Time);
    const paths = parsePaths(p.Payload, nodeId);
    if (!t || !p.PacketId || !paths.length) continue;
    const key = `${nodeId}|${p.PacketId}`;
    const route = routes.get(key) || { t, from: nodeId, id: p.PacketId, to: String(p.ToNode || "").toLowerCase() || null, paths: [] };
    const seen = new Set(route.paths.map(x => x.join(",")));
    for (const trail of paths) if (!seen.has(trail.join(","))) { seen.add(trail.join(",")); route.paths.push(trail); }
    routes.set(key, route);
  }

  // Telemetria: jeden pakiet = jeden pomiar (środowisko, urządzenie albo zasilanie — każdy ma inne pola).
  for (const p of packets) {
    if (p.PortNum !== TELEMETRY_PORT) continue;
    const t = warsawToUtc(p.Time);
    const vals = parseTelemetry(p.Payload);
    const key = `${nodeId}|${p.PacketId}`;
    if (!t || !p.PacketId || !vals || tele.has(key)) continue;
    const rec = { t, from: nodeId, id: p.PacketId, ...vals };
    tele.set(key, rec);
    history.telemetry.push(rec);
  }
}

async function main() {
  const history = await readHistory();
  const before = snapshot(history);

  const known = new Map(history.reports.map(r => [`${r.from}|${r.id}|${r.gw}`, r]));
  const routes = new Map(history.routes.map(r => [`${r.from}|${r.id}`, r]));
  const tele = new Map(history.telemetry.map(r => [`${r.from}|${r.id}`, r]));
  for (const id of NODE_IDS) await syncNode(history, id, known, routes, tele);
  history.reports.sort((a, b) => a.t.localeCompare(b.t));
  history.telemetry.sort((a, b) => a.t.localeCompare(b.t));
  history.routes = [...routes.values()].sort((a, b) => a.t.localeCompare(b.t));

  // Nazwy bramek i przekaźników pobieramy raz — tylko dla tych, których jeszcze nie znamy.
  // Moich nodów tu nie ma: ich nazwy są w "nodes".
  const ids = new Set(history.reports.map(r => r.gw));
  for (const r of history.routes) for (const trail of r.paths) for (const id of trail) ids.add(id);
  for (const id of [...Object.keys(history.nodes), UNKNOWN_HOP]) ids.delete(id);
  for (const id of ids) {
    if (history.names[id]) continue;
    try {
      const [n] = await get(`Nodes/JSON?node=${id}`);
      // Pusty wpis też zapisujemy, żeby nie pytać co pół godziny o noda, którego API nie zna.
      history.names[id] = n ? { shortName: n.ShortName || "", longName: n.LongName || "", role: Number.isInteger(n.Role) ? n.Role : null } : {};
    } catch (e) {
      console.warn(`Node ${id}: ${e.message}`);
    }
  }

  if (snapshot(history) === before) {
    console.log("No changes in mesh data");
    return;
  }

  history.updated = iso(Date.now());
  const since = new Date(Date.now() - LATEST_DAYS * 864e5).toISOString();
  const mine = new Set(NODE_IDS);
  const latest = {
    updated: history.updated,
    nodes: Object.fromEntries(NODE_IDS.filter(id => history.nodes[id]).map(id => [id, history.nodes[id]])),
    names: history.names,
    reports: history.reports.filter(r => r.t >= since && mine.has(r.from)),
    routes: history.routes.filter(r => r.t >= since && mine.has(r.from)),
    // ID pakietu potrzebne jest tylko w historii (do pomijania duplikatów).
    telemetry: history.telemetry.filter(r => r.t >= since && mine.has(r.from)).map(({ id, ...r }) => r)
  };

  const { updated, nodes, names, reports: all, routes: allRoutes, telemetry } = history;
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(HISTORY, `${JSON.stringify({ nodes, updated, names, reports: all, routes: allRoutes, telemetry }, null, 1)}\n`);
  await fs.writeFile(LATEST, `window.MESH_DATA = ${JSON.stringify(latest)};\n`);
  for (const id of NODE_IDS) {
    const n = latest.reports.filter(r => r.from === id).length;
    const tm = latest.telemetry.filter(r => r.from === id).length;
    console.log(`${id} ${nodes[id]?.longName || ""}: ${n} reports and ${tm} telemetry readings in the last ${LATEST_DAYS} days, last seen ${nodes[id]?.lastSeen}`);
  }
  console.log(`Saved ${all.length} reports, ${allRoutes.length} traceroutes and ${telemetry.length} telemetry readings`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
