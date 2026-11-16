// Meshtastic: status noda i raporty odbioru z API lorastats.pl -> data/mesh.history.json + data/mesh.latest.js.
// API oddaje tylko ostatnie 24 h, więc każdy przebieg dopisuje nowe raporty do historii (bez duplikatów).
// Pliki są zapisywane tylko wtedy, gdy coś się zmieniło — dzięki temu workflow nie commituje co pół godziny.
// Do grafu ścieżek zapisujemy też bajt przekaźnika z raportu (ostatni bajt ID noda, który podał pakiet bramce)
// i ścieżki z pakietów traceroute (same ID nodów).
// Pozycji noda ani treści wiadomości (payload pakietów) celowo nie zapisujemy.
import fs from "node:fs/promises";
import path from "node:path";

const API = process.env.MESH_API || "https://lorastats.pl/API/Zach%C3%B3d";
const NODE_ID = (process.env.MESH_NODE_ID || "9254eab8").toLowerCase();
const AGENT = process.env.MESH_AGENT || "static-site-mesh-sync/1.0";
const LATEST_DAYS = 30;

const HISTORY = path.join("data", "mesh.history.json");
const LATEST = path.join("data", "mesh.latest.js");

const PACKET_TYPES = { 1: "text", 3: "position", 4: "nodeinfo", 67: "telemetry", 70: "traceroute", 71: "neighbors" };
const TRACEROUTE = 70;
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
// Czasem (np. LastSeen) dokleja już strefę ("…+01:00") — wtedy wystarczy ją odczytać.
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

// Payload traceroute: ścieżki do kolejnych bramek, "a,b,c|a,b,d". Bierzemy tylko te, które zaczynają się od nas.
export function parsePaths(payload) {
  return String(payload || "").split("|")
    .map(s => s.split(",").map(x => x.trim().toLowerCase()))
    .filter(p => p.length >= 2 && p[0] === NODE_ID && p.every(x => NODE_RE.test(x)));
}

async function readHistory() {
  let h;
  try {
    h = JSON.parse(await fs.readFile(HISTORY, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    h = { node: { id: NODE_ID }, reports: [] };
  }
  // Dawniej mapa nazw obejmowała tylko bramki ("gateways"); teraz trzyma też przekaźniki.
  h.names = h.names || h.gateways || {};
  delete h.gateways;
  h.routes = h.routes || [];
  return h;
}

const snapshot = h => JSON.stringify({ node: h.node, names: h.names, reports: h.reports, routes: h.routes });

async function main() {
  const history = await readHistory();
  const before = snapshot(history);

  const [nodes, reports, packets] = await Promise.all([
    get(`Nodes/JSON?node=${NODE_ID}`),
    get(`PacketReports/JSON?fromNode=${NODE_ID}`),
    get(`PacketsParsed/JSON?fromNode=${NODE_ID}`)
  ]);

  // Node znika z API po dobie ciszy — wtedy zostają ostatnie znane dane.
  const me = nodes.find(n => String(n.NodeId).toLowerCase() === NODE_ID);
  if (me) {
    history.node = {
      id: NODE_ID,
      shortName: me.ShortName || history.node.shortName || "",
      longName: me.LongName || history.node.longName || "",
      lastSeen: warsawToUtc(me.LastSeen) || history.node.lastSeen || null
    };
  }

  const packetInfo = new Map(packets.map(p => [p.PacketId, p]));
  const known = new Map(history.reports.map(r => [`${r.id}|${r.gw}`, r]));
  for (const r of reports) {
    const t = warsawToUtc(r.Time);
    if (!t || !r.Gateway || !r.PacketId) continue;
    const key = `${r.PacketId}|${r.Gateway}`;
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
  history.reports.sort((a, b) => a.t.localeCompare(b.t));

  // Ścieżki traceroute — ten sam pakiet wraca w kolejnych przebiegach, czasem z nowymi bramkami, więc łączymy.
  const routes = new Map(history.routes.map(r => [r.id, r]));
  for (const p of packets) {
    if (p.PortNum !== TRACEROUTE) continue;
    const t = warsawToUtc(p.Time);
    const paths = parsePaths(p.Payload);
    if (!t || !p.PacketId || !paths.length) continue;
    const route = routes.get(p.PacketId) || { t, id: p.PacketId, to: String(p.ToNode || "").toLowerCase() || null, paths: [] };
    const seen = new Set(route.paths.map(x => x.join(",")));
    for (const trail of paths) if (!seen.has(trail.join(","))) { seen.add(trail.join(",")); route.paths.push(trail); }
    routes.set(p.PacketId, route);
  }
  history.routes = [...routes.values()].sort((a, b) => a.t.localeCompare(b.t));

  // Nazwy bramek i przekaźników pobieramy raz — tylko dla tych, których jeszcze nie znamy.
  const ids = new Set(history.reports.map(r => r.gw));
  for (const r of history.routes) for (const trail of r.paths) for (const id of trail) ids.add(id);
  ids.delete(NODE_ID);
  ids.delete(UNKNOWN_HOP);
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
  const latest = {
    updated: history.updated,
    node: history.node,
    names: history.names,
    reports: history.reports.filter(r => r.t >= since),
    routes: history.routes.filter(r => r.t >= since)
  };

  const { updated, node, names, reports: all, routes: allRoutes } = history;
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(HISTORY, `${JSON.stringify({ node, updated, names, reports: all, routes: allRoutes }, null, 1)}\n`);
  await fs.writeFile(LATEST, `window.MESH_DATA = ${JSON.stringify(latest)};\n`);
  console.log(`Saved ${all.length} reports and ${allRoutes.length} traceroutes (${latest.reports.length} reports in the last ${LATEST_DAYS} days), last seen ${node.lastSeen}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
