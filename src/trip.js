// "Jour de courses": store choice, prices, the day's basket and its total.
import { lsGet, lsSet, pbReq, pbCfg } from "./storage.js";
import { uid } from "./domain.js";

export const TRIP_KEY = "gm-trip", PRICES_KEY = "gm-prices", TRIPS_KEY = "gm-trips", STORES_KEY = "gm-stores";

/* ---------- pure helpers (unit-tested) ---------- */
export const parsePrice = (s) => {
  const t = String(s ?? "").replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,3})?$/.test(t)) return null;
  const v = Math.round(parseFloat(t) * 100) / 100; return isFinite(v) ? v : null;
};
const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const euros = (v) => EUR.format(Number(v) || 0);
export const lineTotal = (l) => Math.round((Number(l.price) || 0) * (Number(l.qty) || 0) * 100) / 100;
export const tripTotal = (lines) => Math.round((lines || []).reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
export const missingPrices = (lines) => (lines || []).filter((l) => !(Number(l.price) > 0)).length;
export const distance = (a, b) => { // metres, haversine
  const R = 6371000, r = (x) => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};
export const storeKey = (s) => s.osmId ? `osm:${s.osmType || "node"}/${s.osmId}` : "name:" + String(s.name || "").trim().toLowerCase().replace(/\s+/g, " ");
export const lineKey = (l) => l.code ? "code:" + l.code : "name:" + String(l.name || "").trim().toLowerCase();
// Pick a price from Open Prices results: same store first, else the median of recent prices nearby/anywhere
export function pickOpenPrice(items, store) {
  const eur = (items || []).filter((p) => p.currency === "EUR" && Number(p.price) > 0 && (!p.price_per || p.price_per === "UNIT"));
  if (!eur.length) return null;
  if (store && store.osmId) {
    const here = eur.filter((p) => String(p.location_osm_id) === String(store.osmId) && String(p.location_osm_type || "").toLowerCase() === String(store.osmType || "node").toLowerCase());
    if (here.length) return { price: Number(here[0].price), source: "Open Prices · ce magasin", date: here[0].date };
  }
  const v = eur.slice(0, 15).map((p) => Number(p.price)).sort((a, b) => a - b);
  return { price: v[Math.floor(v.length / 2)], source: "Open Prices · prix indicatif", date: eur[0].date };
}
// Open Street Map shop elements → stores sorted by distance
export function storesFromOverpass(json, here) {
  const seen = new Set();
  return (json && json.elements || []).map((e) => {
    const t = e.tags || {}, lat = e.lat ?? (e.center && e.center.lat), lon = e.lon ?? (e.center && e.center.lon);
    const name = t.name || t.brand; if (!name || lat == null) return null;
    const city = t["addr:city"] || "", street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    return { name, brand: t.brand || "", osmId: e.id, osmType: e.type, lat, lon, address: [street, city].filter(Boolean).join(", "),
      kind: t.shop || "", dist: here ? distance(here, { lat, lon }) : null };
  }).filter((s) => s && !seen.has(storeKey(s)) && seen.add(storeKey(s))).sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
}

/* ---------- the day's trip (kept on this phone until it is finished) ---------- */
export const loadTrip = () => lsGet(TRIP_KEY, null);
export const saveTrip = (t) => lsSet(TRIP_KEY, t);
export const newTrip = (store, budget) => ({ id: uid(), store, budget: Number(budget) || 0, startedAt: Date.now(), lines: [] });
export const recentStores = () => lsGet(STORES_KEY, []);
export function rememberStore(store) {
  const list = recentStores().filter((s) => storeKey(s) !== storeKey(store));
  lsSet(STORES_KEY, [{ ...store, dist: null }, ...list].slice(0, 6));
}

/* ---------- finding stores around the phone ---------- */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const getPosition = () => new Promise((ok, ko) => {
  if (!navigator.geolocation) return ko(new Error("unsupported"));
  navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), ko, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
});
export async function storesAround(here, radius = 2500) {
  const q = `[out:json][timeout:15];nwr["shop"~"^(supermarket|hypermarket|convenience|greengrocer|butcher|bakery|frozen_food|wholesale|organic|deli|cheese|seafood)$"](around:${radius},${here.lat},${here.lon});out center tags 40;`;
  for (const url of OVERPASS) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
      const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ac.signal });
      clearTimeout(t);
      if (r.ok) return storesFromOverpass(await r.json(), here).slice(0, 15);
    } catch (e) {}
  }
  throw new Error("overpass");
}

/* ---------- prices: our own memory, the household's, then Open Prices ---------- */
export function rememberPrice(store, line) {
  if (!(Number(line.price) > 0)) return;
  const all = lsGet(PRICES_KEY, {}), k = storeKey(store);
  all[k] = { ...(all[k] || {}), [lineKey(line)]: { price: Number(line.price), date: Date.now() } };
  lsSet(PRICES_KEY, all);
}
export async function priceFor(store, line) {
  const mine = (lsGet(PRICES_KEY, {})[storeKey(store)] || {})[lineKey(line)];
  if (mine) return { price: mine.price, source: "Votre dernier prix ici", date: mine.date };
  const c = pbCfg();
  if (c) {
    try {
      const f = `storeKey="${storeKey(store).replace(/"/g, "")}" && ${line.code ? `code="${line.code}"` : `name="${String(line.name || "").replace(/"/g, "")}"`}`;
      const j = await pbReq(c, `/api/collections/prices/records?perPage=1&skipTotal=1&sort=-created&filter=${encodeURIComponent(f)}`);
      const r = j && j.items && j.items[0];
      if (r && Number(r.price) > 0) return { price: Number(r.price), source: "Dernier prix du foyer ici", date: r.created };
    } catch (e) {}
  }
  if (!line.code) return null;
  try {
    const params = new URLSearchParams({ product_code: line.code, currency: "EUR", order_by: "-date", size: "30" });
    if (store.lat != null) { params.set("lat", store.lat); params.set("lon", store.lon); params.set("radius_km", "30"); }
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 7000);
    let r = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?${params}`, { signal: ac.signal });
    let j = r.ok ? await r.json() : null;
    if (!(j && j.items && j.items.length) && store.lat != null) { // nothing nearby: anywhere
      params.delete("lat"); params.delete("lon"); params.delete("radius_km");
      r = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?${params}`, { signal: ac.signal }); j = r.ok ? await r.json() : null;
    }
    clearTimeout(t);
    return pickOpenPrice(j && j.items, store);
  } catch (e) { return null; }
}

/* ---------- end of the trip: history + prices for the household ---------- */
export async function archiveTrip(trip) {
  const total = tripTotal(trip.lines);
  const summary = { id: trip.id, storeName: trip.store.name, storeKey: storeKey(trip.store), total, count: trip.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0),
    startedAt: trip.startedAt, endedAt: Date.now(), lines: trip.lines.map(({ name, code, qty, price }) => ({ name, code, qty, price })) };
  lsSet(TRIPS_KEY, [summary, ...lsGet(TRIPS_KEY, []).filter((t) => t.id !== trip.id)].slice(0, 30));
  trip.lines.forEach((l) => rememberPrice(trip.store, l));
  const c = pbCfg(); if (!c) return summary;
  try {
    await pbReq(c, "/api/collections/trips/records", { method: "POST", body: JSON.stringify({ storeName: summary.storeName, storeKey: summary.storeKey, total, count: summary.count, lines: summary.lines, startedAt: new Date(trip.startedAt).toISOString() }) });
    for (const l of trip.lines) if (Number(l.price) > 0)
      await pbReq(c, "/api/collections/prices/records", { method: "POST", body: JSON.stringify({ code: l.code || "", name: l.name, storeKey: summary.storeKey, storeName: summary.storeName, price: Number(l.price) }) });
  } catch (e) {}
  return summary;
}
export async function recentTrips() {
  const local = lsGet(TRIPS_KEY, []); const c = pbCfg();
  if (!c) return local;
  try {
    const j = await pbReq(c, "/api/collections/trips/records?perPage=12&skipTotal=1&sort=-created");
    return (j.items || []).map((t) => ({ id: t.id, storeName: t.storeName, total: t.total, count: t.count, endedAt: Date.parse(t.created.replace(" ", "T")) }));
  } catch (e) { return local; }
}
