// "Jour de courses" screens: store choice, price at each scan, the day's basket and the final receipt.
import { useState, useEffect, useRef, html } from "../lib.js";
import { buzz } from "../device.js";
import { Sheet } from "./sheet.js";
import { I } from "./icons.js";
import { parsePrice, euros, lineTotal, tripTotal, missingPrices, getPosition, storesAround, recentStores, recentTrips } from "../trip.js";

const km = (m) => m == null ? "" : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
const priceText = (v) => (Number(v) > 0 ? String(Number(v).toFixed(2)).replace(".", ",") : "");

/* Choose where we shop: nearby stores (location), recent ones, or a name */
export function StorePicker({ onStart, onClose }) {
  const [state, setState] = useState("locating"); // locating | ready | denied | error
  const [stores, setStores] = useState([]); const [pick, setPick] = useState(null);
  const [manual, setManual] = useState(""); const [budget, setBudget] = useState("");
  const [trips, setTrips] = useState([]); const recent = recentStores();
  const locate = async () => {
    setState("locating");
    try { const here = await getPosition(); const list = await storesAround(here); setStores(list); setState("ready"); if (list[0]) setPick(list[0]); }
    catch (e) { setState(e && e.code === 1 ? "denied" : "error"); if (recent[0]) setPick(recent[0]); }
  };
  useEffect(() => { locate(); recentTrips().then(setTrips).catch(() => {}); }, []);
  const chosen = manual.trim() ? { name: manual.trim() } : pick;
  const start = (close) => { if (!chosen) return; buzz(20); onStart(chosen, parsePrice(budget) || 0); close(); };
  const row = (s, i) => html`<button type="button" key=${(s.osmId || s.name) + i} class=${"store press" + (pick && !manual && (pick.osmId ? pick.osmId === s.osmId : pick.name === s.name) ? " on" : "")}
      aria-pressed=${!!(pick && !manual && (pick.osmId ? pick.osmId === s.osmId : pick.name === s.name))} onClick=${() => { setManual(""); setPick(s); buzz(6); }}>
      <b>${s.name}</b><span>${[s.address, km(s.dist)].filter(Boolean).join(" · ")}</span></button>`;
  return html`<${Sheet} label="Jour de courses" onClose=${onClose}>${(close) => html`
    <h2>Jour de courses</h2>
    <p class="hint" style=${{ marginTop: "-8px", marginBottom: "14px" }}>Scannez en remplissant le chariot : chaque article va dans le panier du jour avec son prix, le total se calcule tout seul.</p>
    <div class="field">Magasin</div>
    <div class="stores">
      ${state === "locating" && html`<p class="hint locating">${I.pin} Recherche des magasins autour de vous…</p>`}
      ${state === "denied" && html`<p class="hint">Localisation refusée : choisissez un magasin récent ou tapez son nom.</p>`}
      ${state === "error" && html`<p class="hint">Impossible de trouver les magasins autour. <button type="button" class="link-btn" onClick=${locate}>Réessayer</button></p>`}
      ${state === "ready" && !stores.length && html`<p class="hint">Aucun magasin trouvé à moins de 2,5 km.</p>`}
      ${stores.map(row)}
      ${recent.filter((r) => !stores.some((s) => s.osmId && s.osmId === r.osmId)).length > 0 && html`<p class="mini-h">Récents</p>`}
      ${recent.filter((r) => !stores.some((s) => s.osmId && s.osmId === r.osmId)).map(row)}
    </div>
    <form class="form" onSubmit=${(e) => { e.preventDefault(); start(close); }}>
      <label class="field">Ou un autre magasin<input id="trip-store" placeholder="Ex. Marché de Montargis" autocomplete="off" value=${manual} onChange=${(e) => setManual(e.target.value)} /></label>
      <label class="field">Budget (facultatif)<input id="trip-budget" inputmode="decimal" placeholder="Ex. 80" autocomplete="off" value=${budget} onChange=${(e) => setBudget(e.target.value)} /></label>
      <div class="actions"><button class="btn main press" type="submit" disabled=${!chosen}>${I.basket}${chosen ? `Commencer chez ${chosen.name}` : "Choisissez un magasin"}</button></div>
    </form>
    ${trips.length > 0 && html`<div class="history"><p class="mini-h">Dernières courses</p>
      ${trips.slice(0, 5).map((t) => html`<div class="r" key=${t.id}><span>${new Date(t.endedAt || t.startedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · ${t.storeName}</span><b>${euros(t.total)}</b></div>`)}</div>`}
  `}<//>`;
}

/* Shown over the camera after each scan: quantity and price, then back to scanning */
export function TripLineSheet({ line, onSave, onClose }) {
  const [qty, setQty] = useState(line.qty || 1);
  const [price, setPrice] = useState(priceText(line.price));
  const touched = useRef(false);
  useEffect(() => { if (!touched.current && line.price > 0) setPrice(priceText(line.price)); }, [line.price]);
  const p = parsePrice(price);
  const save = (close) => { buzz(15); onSave({ ...line, qty, price: p || 0, priceSource: touched.current ? "Saisi" : line.priceSource }); close(); };
  return html`<${Sheet} top=${true} label="Ajouter au panier" onClose=${onClose}>${(close) => html`
    <div class="tl-head">
      ${line.image ? html`<img class="tl-img" src=${line.image} alt="" referrerpolicy="no-referrer"/>` : html`<span class="tl-img ph">${I.basket}</span>`}
      <div><h2 class="tl-name">${line.loading ? "Recherche du produit…" : line.name}</h2>
        <span class="hint">${[line.brand, line.code].filter(Boolean).join(" · ")}</span></div>
    </div>
    <form class="form" onSubmit=${(e) => { e.preventDefault(); save(close); }}>
      <div class="two">
        <div class="field">Quantité
          <div class="step big">
            <button type="button" class="press" aria-label="Un de moins" disabled=${qty <= 1} onClick=${() => { setQty(Math.max(1, qty - 1)); buzz(6); }}>${I.minus}</button>
            <div class="num"><output key=${qty}>${qty}</output></div>
            <button type="button" class="press" aria-label="Un de plus" onClick=${() => { setQty(qty + 1); buzz(6); }}>${I.plus}</button>
          </div></div>
        <label class="field">Prix unitaire (€)<input id="tl-price" inputmode="decimal" autocomplete="off" placeholder=${line.pricing ? "Recherche…" : "0,00"} value=${price}
          onChange=${(e) => { touched.current = true; setPrice(e.target.value); }} /></label>
      </div>
      <p class="hint">${price && p == null ? "Prix invalide : utilisez par exemple 2,49."
        : line.pricing ? "Recherche du prix…"
        : line.priceSource && !touched.current && line.price > 0 ? `${line.priceSource} · vérifiez l'étiquette`
        : "Prix introuvable : saisissez celui de l'étiquette (ou laissez vide)."}</p>
      <div class="tl-total"><span>Total de la ligne</span><b>${euros((p || 0) * qty)}</b></div>
      <div class="actions">
        <button type="button" class="btn del press" onClick=${close}>Ignorer</button>
        <button class="btn main press" type="submit" disabled=${!!(price && p == null) || line.loading}>Ajouter au panier</button>
      </div>
    </form>`}<//>`;
}

/* Floating total while shopping */
export function TripBar({ trip, onOpen }) {
  const total = tripTotal(trip.lines), n = trip.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const over = trip.budget > 0 && total > trip.budget;
  return html`<button class=${"tripbar press" + (over ? " over" : "")} onClick=${onOpen} aria-label=${`Panier du jour : ${n} articles, ${euros(total)}`}>
    ${I.basket}<span class="tb-store">${trip.store.name}<small>${n} article${n > 1 ? "s" : ""}${trip.budget > 0 ? ` · budget ${euros(trip.budget)}` : ""}</small></span>
    <b class="tb-total" key=${total}>${euros(total)}</b>
    ${trip.budget > 0 && html`<i class="tb-gauge" style=${{ width: Math.min(100, total / trip.budget * 100) + "%" }}></i>`}
  </button>`;
}

/* The day's basket, then the receipt */
export function BasketSheet({ trip, onChange, onFinish, onCancel, onClose }) {
  const [step, setStep] = useState("basket");
  const [name, setName] = useState(""), [price, setPrice] = useState("");
  const total = tripTotal(trip.lines), miss = missingPrices(trip.lines);
  const setLine = (id, patch) => onChange({ ...trip, lines: trip.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const drop = (id) => { buzz(10); onChange({ ...trip, lines: trip.lines.filter((l) => l.id !== id) }); };
  const addFree = (e) => { e.preventDefault(); const n = name.trim(); if (!n) return;
    onChange({ ...trip, lines: [...trip.lines, { id: "l" + Date.now(), name: n, qty: 1, price: parsePrice(price) || 0, priceSource: "Saisi" }] });
    setName(""); setPrice(""); buzz(10); };
  const date = new Date();
  return html`<${Sheet} label="Panier du jour" onClose=${onClose}>${(close) => step === "basket" ? html`
    <h2>Panier · ${trip.store.name}</h2>
    ${trip.lines.length === 0 && html`<p class="hint">Le panier est vide. Touchez le bouton de scan et scannez les articles en les mettant dans le chariot.</p>`}
    <div class="basket">${trip.lines.map((l) => html`<div class="bl" key=${l.id}>
      <div class="bl-name"><b>${l.name}</b><span>${l.priceSource || ""}</span></div>
      <div class="step sm">
        <button class="press" aria-label=${"Un de moins : " + l.name} disabled=${l.qty <= 1} onClick=${() => setLine(l.id, { qty: l.qty - 1 })}>${I.minus}</button>
        <div class="num"><output key=${l.qty}>×${l.qty}</output></div>
        <button class="press" aria-label=${"Un de plus : " + l.name} onClick=${() => setLine(l.id, { qty: l.qty + 1 })}>${I.plus}</button>
      </div>
      <input class="bl-price" inputmode="decimal" aria-label=${"Prix unitaire : " + l.name} placeholder="Prix" defaultValue=${priceText(l.price)}
        onBlur=${(e) => { const v = parsePrice(e.target.value); setLine(l.id, { price: v || 0, priceSource: "Saisi" }); }} />
      <b class="bl-total">${l.price > 0 ? euros(lineTotal(l)) : "—"}</b>
      <button class="x-sm press" aria-label=${"Retirer du panier : " + l.name} onClick=${() => drop(l.id)}>${I.close}</button>
    </div>`)}</div>
    <form class="bl-add" onSubmit=${addFree}>
      <input id="bl-name" placeholder="Sans code-barres : tomates, pain…" autocomplete="off" value=${name} onChange=${(e) => setName(e.target.value)} aria-label="Article sans code-barres" />
      <input id="bl-price" inputmode="decimal" placeholder="Prix" autocomplete="off" value=${price} onChange=${(e) => setPrice(e.target.value)} aria-label="Prix de l'article" />
      <button class="press" type="submit" aria-label="Ajouter au panier">${I.plus}</button>
    </form>
    <div class="tl-total big"><span>Total${miss ? ` (${miss} sans prix)` : ""}</span><b>${euros(total)}</b></div>
    ${trip.budget > 0 && html`<p class=${"hint" + (total > trip.budget ? " form-err" : "")}>${total > trip.budget ? `Budget dépassé de ${euros(total - trip.budget)}` : `Reste ${euros(trip.budget - total)} sur ${euros(trip.budget)}`}</p>`}
    <div class="actions">
      <button type="button" class="btn del press" onClick=${() => { onCancel(); close(); }}>Annuler les courses</button>
      <button type="button" class="btn main press" onClick=${() => { setStep("receipt"); buzz(15); }}>Terminer</button>
    </div>` : html`
    <div class="ticket receipt" aria-label="Ticket de caisse">
      <div class="t-head">${trip.store.name.toUpperCase()}</div>
      ${trip.store.address && html`<div class="t-sub">${trip.store.address}</div>`}
      <div class="r"><span>${date.toLocaleDateString("fr-FR")}</span><span>${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
      <hr/>
      ${trip.lines.map((l) => html`<div class="t-line" key=${l.id}><span>${l.name.toUpperCase()}${l.qty > 1 ? html`<small>${l.qty} x ${euros(l.price)}</small>` : ""}</span><span>${l.price > 0 ? euros(lineTotal(l)) : "—"}</span></div>`)}
      <hr/>
      <div class="r t-total"><span>TOTAL</span><span>${euros(total)}</span></div>
      <div class="r"><span>ARTICLES</span><span>${trip.lines.reduce((s, l) => s + l.qty, 0)}</span></div>
      ${trip.budget > 0 && html`<div class="r"><span>BUDGET</span><span>${euros(trip.budget)}</span></div>`}
      <div class="t-sub">MERCI DE VOTRE VISITE</div>
    </div>
    <div class="actions" style=${{ flexDirection: "column" }}>
      <button type="button" class="btn main press" onClick=${() => { onFinish(true); close(); }}>${I.check} Ranger dans le stock et terminer</button>
      <button type="button" class="btn soft press" onClick=${() => { onFinish(false); close(); }}>Terminer sans ranger</button>
      <button type="button" class="link-btn" onClick=${() => setStep("basket")}>Revenir au panier</button>
    </div>`}<//>`;
}
