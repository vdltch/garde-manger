import { placeColor, status, ringColor, ringPct, expLabel, initials, qtyText, NUTRI_C } from "../domain.js";
import { I } from "./icons.js";
import { html } from "../lib.js";

/* ---------- Rows ---------- */
export const Face=({it})=> it.image
  ? html`<b class="photo"><img src=${it.image} alt="" loading="lazy" referrerpolicy="no-referrer" onError=${e=>{ e.currentTarget.parentNode.classList.remove("photo"); e.currentTarget.replaceWith(document.createTextNode(initials(it.name))); }}/></b>`
  : html`<b>${initials(it.name)}</b>`;
export function StockCard({it,i,onOpen,onStep,lots}){
  const st=status(it), lab=expLabel(it);
  return html`<div class="card" style=${{"--i":Math.min(i,10),"--c":placeColor(it.location),"--rc":ringColor[st],viewTransitionName:"c-"+it.id}}>
    <div class="ring" style=${{"--p":ringPct(it)}} aria-hidden="true"><${Face} it=${it}/></div>
    <button class="info" onClick=${()=>onOpen(it)}>
      <div class="name">${it.name}</div>
      <div class="sub">${lab && html`<span class="exp">${lab}</span>`}${lots>1 && html`<span class="lot">${lots} lots</span>`}${it.nutri && html`<span class="ns" style=${{"--sc":NUTRI_C[it.nutri]}}>${it.nutri.toUpperCase()}</span>`}${it.brand && html`<span>${it.brand}</span>`}</div>
    </button>
    <div class="step">
      <button class="press" aria-label=${"Retirer un "+it.name} onClick=${()=>onStep(it,-1)}>${I.minus}</button>
      <div class="num"><output key=${it.qty}>${it.qty}</output>${qtyText(it) && html`<small>${qtyText(it)}</small>`}</div>
      <button class="press" aria-label=${"Ajouter un "+it.name} onClick=${()=>onStep(it,1)}>${I.plus}</button>
    </div>
  </div>`;
}
export function CourseCard({it,i,onToggle,onQty,onRemove,onOpen}){
  const n=Math.max(1,Number(it.toBuy)||1);
  return html`<div class=${"card course"+(it.inCart?" done":"")} style=${{"--i":Math.min(i,10),"--c":placeColor(it.location),viewTransitionName:"c-"+it.id}}>
    <button class="check press" role="checkbox" aria-checked=${!!it.inCart} aria-label=${(it.inCart?"Sortir du panier : ":"Mettre dans le panier : ")+it.name} onClick=${()=>onToggle(it)}>${it.inCart && I.check}</button>
    <button class="info" onClick=${()=>onOpen(it)}>
      <div class="name">${it.name}</div>
      <div class="sub"><span>${it.location}</span>${it.brand && html`<span>${it.brand}</span>`}</div>
    </button>
    <div class="step sm">
      <button class="press" aria-label=${"Un de moins : "+it.name} onClick=${()=>onQty(it,-1)} disabled=${n<=1}>${I.minus}</button>
      <div class="num"><output key=${n}>×${n}</output></div>
      <button class="press" aria-label=${"Un de plus : "+it.name} onClick=${()=>onQty(it,1)}>${I.plus}</button>
    </div>
    <button class="x-sm press" aria-label=${"Retirer de la liste : "+it.name} onClick=${()=>onRemove(it)}>${I.close}</button>
  </div>`;
}
