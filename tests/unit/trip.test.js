import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrice, euros, lineTotal, tripTotal, missingPrices, distance, storeKey, lineKey, pickOpenPrice, storesFromOverpass } from "../../src/trip.js";

test("prices typed the French way", () => {
  assert.equal(parsePrice("2,49"), 2.49); assert.equal(parsePrice(" 12.5 € "), 12.5); assert.equal(parsePrice("3"), 3);
  assert.equal(parsePrice(""), null); assert.equal(parsePrice("abc"), null); assert.equal(parsePrice("1,2,3"), null);
  assert.equal(euros(12.5).replace(/\s/g, " "), "12,50 €");
});

test("line and trip totals", () => {
  const lines = [{ qty: 2, price: 2.49 }, { qty: 1, price: 0.99 }, { qty: 3, price: 0 }];
  assert.equal(lineTotal(lines[0]), 4.98);
  assert.equal(tripTotal(lines), 5.97);
  assert.equal(missingPrices(lines), 1);
  assert.equal(tripTotal([]), 0);
});

test("keys and distance", () => {
  assert.equal(storeKey({ osmId: 123, osmType: "way", name: "x" }), "osm:way/123");
  assert.equal(storeKey({ name: "  Marché  de Montargis " }), "name:marché de montargis");
  assert.equal(lineKey({ code: "301", name: "x" }), "code:301");
  assert.equal(lineKey({ name: "Tomates " }), "name:tomates");
  const d = distance({ lat: 47.9973, lon: 2.7330 }, { lat: 48.0073, lon: 2.7330 });
  assert.ok(d > 1100 && d < 1120, String(d));
});

test("Open Prices: same store first, otherwise a median", () => {
  const items = [
    { price: 3.2, currency: "EUR", location_osm_id: 9, location_osm_type: "NODE", date: "2026-10-01" },
    { price: 2.9, currency: "EUR", location_osm_id: 42, location_osm_type: "NODE", date: "2026-09-20" },
    { price: 3.5, currency: "EUR", location_osm_id: 7, location_osm_type: "WAY", date: "2026-09-01" },
    { price: 1.0, currency: "USD", location_osm_id: 42, location_osm_type: "NODE" },
  ];
  assert.deepEqual(pickOpenPrice(items, { osmId: 42, osmType: "node" }).price, 2.9);
  assert.match(pickOpenPrice(items, { osmId: 42, osmType: "node" }).source, /ce magasin/);
  assert.equal(pickOpenPrice(items, { name: "Ailleurs" }).price, 3.2);
  assert.match(pickOpenPrice(items, { name: "Ailleurs" }).source, /indicatif/);
  assert.equal(pickOpenPrice([], {}), null);
});

test("stores from OpenStreetMap, nearest first, unnamed ignored", () => {
  const here = { lat: 47.99, lon: 2.73 };
  const list = storesFromOverpass({ elements: [
    { type: "way", id: 2, center: { lat: 48.0, lon: 2.73 }, tags: { shop: "supermarket", name: "E.Leclerc", "addr:city": "Amilly" } },
    { type: "node", id: 1, lat: 47.991, lon: 2.73, tags: { shop: "convenience", brand: "Carrefour City" } },
    { type: "node", id: 3, lat: 47.99, lon: 2.731, tags: { shop: "bakery" } },
  ] }, here);
  assert.deepEqual(list.map((s) => s.name), ["Carrefour City", "E.Leclerc"]);
  assert.equal(list[1].address, "Amilly");
  assert.equal(list[1].osmType, "way");
});
