// Meshtastic: status noda i raporty odbioru z API lorastats.pl -> data/mesh.history.json + data/mesh.latest.js.
// API oddaje tylko ostatnie 24 h, więc każdy przebieg dopisuje nowe raporty do historii (bez duplikatów).
// Pliki są zapisywane tylko wtedy, gdy coś się zmieniło — dzięki temu workflow nie commituje co pół godziny.
// Pozycji noda (payload pakietów) celowo nie zapisujemy.
import fs from "node:fs/promises";
import path from "node:path";

const API = process.env.MESH_API || "https://lorastats.pl/API/Zach%C3%B3d";
const NODE_ID = (process.env.MESH_NODE_ID || "9254eab8").toLowerCase();
const AGENT = process.env.MESH_AGENT || "static-site-mesh-sync/1.0";
const LATEST_DAYS = 30;

const HISTORY = path.join("data", "mesh.history.json");
const LATEST = path.join("data", "mesh.latest.js");

const PACKET_TYPES = { 1: "text", 3: "position", 4: "nodeinfo", 67: "telemetry", 70: "traceroute", 71: "neighbors" };

async function get(pathAndQuery) {
  const res = await fetch(`${API}/${pathAndQuery}`, { headers: { "User-Agent": AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${pathAndQuery}: HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`${pathAndQuery}: expected a JSON array`);
  return data;
}

// lorastats podaje czas polski bez strefy ("2026-11-12T15:06:39") — zamieniamy na UTC.
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
  const naive = Date.parse(`${local}Z`);
  if (Number.isNaN(naive)) return null;
  let utc = naive - warsawOffset(naive);
  utc = naive - warsawOffset(utc); // drugi krok poprawia godziny tuż przy zmianie czasu
  return new Date(utc).toISOString().replace(".000Z", "Z");
}

async function readHistory() {
  try {
    return JSON.parse(await fs.readFile(HISTORY, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return { node: { id: NODE_ID }, gateways: {}, reports: [] };
  }
}

async function main() {
  const history = await readHistory();
  const before = JSON.stringify({ node: history.node, gateways: history.gateways, reports: history.reports });

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
  const known = new Set(history.reports.map(r => `${r.id}|${r.gw}`));
  for (const r of reports) {
    const t = warsawToUtc(r.Time);
    if (!t || !r.Gateway || !r.PacketId || known.has(`${r.PacketId}|${r.Gateway}`)) continue;
    known.add(`${r.PacketId}|${r.Gateway}`);
    const p = packetInfo.get(r.PacketId);
    const hops = p && Number.isFinite(p.HopStart) && Number.isFinite(r.HopLimit) ? Math.max(0, p.HopStart - r.HopLimit) : null;
    history.reports.push({
      t,
      gw: r.Gateway,
      id: r.PacketId,
      snr: Number.isFinite(r.SNR) ? r.SNR : null,
      hops,
      type: p ? PACKET_TYPES[p.PortNum] || String(p.PortNum) : null
    });
  }
  history.reports.sort((a, b) => a.t.localeCompare(b.t));

  // Nazwy bramek pobieramy raz — tylko dla tych, których jeszcze nie znamy.
  for (const gw of new Set(history.reports.map(r => r.gw))) {
    if (history.gateways[gw]) continue;
    try {
      const [g] = await get(`Nodes/JSON?node=${gw}`);
      if (g) history.gateways[gw] = { shortName: g.ShortName || "", longName: g.LongName || "" };
    } catch (e) {
      console.warn(`Gateway ${gw}: ${e.message}`);
    }
  }

  const after = JSON.stringify({ node: history.node, gateways: history.gateways, reports: history.reports });
  if (after === before) {
    console.log("No changes in mesh data");
    return;
  }

  history.updated = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const since = new Date(Date.now() - LATEST_DAYS * 864e5).toISOString();
  const latest = {
    updated: history.updated,
    node: history.node,
    gateways: history.gateways,
    reports: history.reports.filter(r => r.t >= since)
  };

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(HISTORY, `${JSON.stringify(history, null, 1)}\n`);
  await fs.writeFile(LATEST, `window.MESH_DATA = ${JSON.stringify(latest)};\n`);
  console.log(`Saved ${history.reports.length} reports (${latest.reports.length} in the last ${LATEST_DAYS} days), last seen ${history.node.lastSeen}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
