// Renders every screen once with a stand-in React, so a typo or a missing import in a template
// fails here instead of on a phone. The stand-in evaluates all template expressions and calls
// child components it meets, with the props from the template.
import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
const g = globalThis;
g.window = g; g.self = g;
g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
g.sessionStorage = g.localStorage;
g.matchMedia = () => ({ matches: false, addEventListener() {} });
g.location = { protocol: "https:", hostname: "stock.example.org", origin: "https://stock.example.org", hash: "", pathname: "/", search: "", href: "https://stock.example.org/" };
try { g.navigator = { onLine: true, userAgent: "node", vibrate() {} }; } catch (e) {}
g.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {}, createElement: () => ({ getContext: () => ({}), setAttribute() {} }), head: { appendChild() {} }, activeElement: null };
g.addEventListener = () => {}; g.removeEventListener = () => {};
g.requestIdleCallback = () => 0;
g.EventSource = class { addEventListener() {} close() {} };
g.fetch = async () => ({ ok: false, status: 0, json: async () => ({}) });
g.history = { replaceState() {} };

// Stand-in React: hooks return their initial values; createElement calls function components.
const hooks = {
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useRef: (v) => ({ current: v ?? null }),
  useEffect: () => {}, useMemo: (f) => f(),
};
const rendered = [];
const createElement = (type, props, ...children) => {
  if (typeof type === "function") {
    rendered.push(type.name);
    return type(children.length ? { ...(props || {}), children: children.length === 1 ? children[0] : children } : { ...(props || {}) });
  }
  return { type, props, children };
};
g.React = { ...hooks, createElement };
g.ReactDOM = { createRoot: () => ({ render() {} }), flushSync: (f) => f() };
// Stand-in htm: a tiny parser for <${Component} a=${x} b="c">…<//> enough to pass props to components
g.htm = { bind: (h) => (strings, ...values) => {
  const out = [];
  strings.forEach((s, i) => {
    if (i === 0) return;
    const before = strings[i - 1]; const v = values[i - 1];
    if (typeof v === "function" && /<$/.test(before)) {           // <${Component} … >
      const props = {}; let j = i; let tail = strings[j];
      const take = (txt) => { for (const m of txt.matchAll(/([\w-]+)="([^"]*)"/g)) props[m[1]] = m[2]; };
      while (true) {
        const attr = tail.match(/(?:^|\s)([\w-]+)=$/);
        take(tail);
        if (attr && j < values.length) { props[attr[1]] = values[j]; j++; tail = strings[j]; continue; }
        break;
      }
      // children function: <${Sheet} …>${(close)=>…}<//>
      const next = values[j]; if (/>\s*$/.test(tail) && typeof next === "function" && !/\/>\s*$/.test(tail)) props.children = next;
      out.push(h(v, props));
    }
  });
  return out;
} };

test("all screens render without errors", async () => {
  const { App } = await import("../../src/app.js");
  const { Editor } = await import("../../src/ui/editor.js");
  const { Scanner } = await import("../../src/ui/scanner.js");
  const { SyncSheet, ResetSheet } = await import("../../src/ui/sync.js");
  const { StockCard, CourseCard } = await import("../../src/ui/cards.js");
  const { Ticket } = await import("../../src/ui/ticket.js");
  const { iso } = await import("../../src/domain.js");

  App();
  const it = { id: "abcdefghijklmno", name: "Yaourt nature", brand: "Les 2 Vaches", code: "3017620422003", qty: 2, unit: "pot", location: "Frigo", expiry: iso(2), image: "", nutri: "a", nova: 1, eco: "b", toBuy: 2, inCart: true };
  const noop = () => {};
  StockCard({ it, i: 0, onOpen: noop, onStep: noop, lots: 2 });
  CourseCard({ it, i: 0, onToggle: noop, onQty: noop, onRemove: noop, onOpen: noop });
  Ticket({ p: { ...it, found: true, source: "OPEN FOOD FACTS", hint: "4 x 125 g" }, count: 12 });
  Ticket({ p: { code: "3017620422003", loading: true }, count: 1 });
  for (const initial of [{}, { ...it }, { code: "3017620422003", scanned: true, loading: false, offline: true }, { ...it, id: undefined, newLot: true, shelfDays: 21 }])
    Editor({ initial, scanCount: 3, onSave: noop, onDelete: noop, onClose: noop });
  Scanner({ onResult: noop, onBurst: () => "+1", onClose: noop });
  const sync = { pb: null, sync: "local", pending: 0, login: noop, logout: noop, resync: noop };
  SyncSheet({ store: sync, onClose: noop });
  SyncSheet({ store: { ...sync, pb: { url: "https://stock.example.org", token: "t", email: "a@b.fr" }, sync: "live", pending: 2 }, onClose: noop });
  ResetSheet({ token: "abc", onDone: noop });
  const { StorePicker, TripLineSheet, TripBar, BasketSheet } = await import("../../src/ui/trip.js");
  const trip = { id: "t1", store: { name: "E.Leclerc", address: "Amilly", osmId: 2, osmType: "way" }, budget: 50, startedAt: Date.now(),
    lines: [{ id: "l1", code: "3017620422003", name: "Nutella", qty: 2, price: 3.49, priceSource: "Open Prices · ce magasin" }, { id: "l2", name: "Tomates", qty: 1, price: 0 }] };
  StorePicker({ onStart: noop, onClose: noop });
  TripLineSheet({ line: { ...trip.lines[0], loading: false, pricing: false }, onSave: noop, onClose: noop });
  TripLineSheet({ line: { id: "l3", code: "1", name: "Produit 1", qty: 1, price: 0, loading: true, pricing: true }, onSave: noop, onClose: noop });
  TripBar({ trip, onOpen: noop });
  BasketSheet({ trip, onChange: noop, onFinish: noop, onCancel: noop, onClose: noop });
  Scanner({ onResult: noop, onBurst: noop, onTrip: noop, trip: "E.Leclerc", paused: true, onClose: noop });

  for (const name of ["Sheet", "Ticket", "Barcode"]) assert.ok(rendered.includes(name), `${name} was not rendered`);
});
