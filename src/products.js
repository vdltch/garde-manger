// Product sheets: household catalog on PocketBase, then Open Food Facts.
import { iso, grade, guessPlace, guessShelf, placeholderName } from "./domain.js";
import { lsGet, lsSet, pbReq, pbCfg } from "./storage.js";

/* ---------- Product database: Open Food Facts (+ Open Products / Beauty Facts) ---------- */
export const OFF_FIELDS="code,product_name_fr,product_name,generic_name_fr,brands,quantity,image_front_small_url,image_small_url,nutriscore_grade,nova_group,ecoscore_grade,environmental_score_grade,categories_tags";
export const OFF_HOSTS=[["world.openfoodfacts.org","OPEN FOOD FACTS"],["world.openproductsfacts.org","OPEN PRODUCTS FACTS"],["world.openbeautyfacts.org","OPEN BEAUTY FACTS"]];
export const OFF_CACHE="gm-products";
export async function fetchJSON(url,ms){
  const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),ms);
  try{ const r=await fetch(url,{signal:ac.signal,headers:{Accept:"application/json"}}); return r.ok ? await r.json() : {status:0}; }
  finally{ clearTimeout(t); }
}
// Typical shelf life after purchase, by Open Food Facts category (first match wins). 0 = no suggestion.
export const CATALOG_KEYS=["name","brand","hint","location","image","nutri","nova","eco","shelfDays","source"];
export async function catalogFind(code){
  const c=pbCfg(); if(!c||!/^[\w-]{4,32}$/.test(code)) return null;
  const j=await pbReq(c,`/api/collections/products/records?perPage=1&skipTotal=1&filter=${encodeURIComponent(`code="${code}"`)}`);
  return (j&&j.items&&j.items[0])||null;
}
export async function catalogGet(code){
  try{ const r=await catalogFind(code); if(!r||!r.name) return null;
    return {found:true,source:"CATALOGUE DU FOYER",name:r.name,brand:r.brand||"",hint:r.hint||"",image:r.image||"",nutri:r.nutri||"",eco:r.eco||"",
      nova:Number(r.nova)||0,location:r.location||"",shelfDays:Number(r.shelfDays)||0}; }
  catch(e){ return null; }
}
export async function catalogSave(code,data){
  if(!code) return;
  const body={code}; CATALOG_KEYS.forEach(k=>{ if(data[k]!=null&&data[k]!=="") body[k]=data[k]; });
  const cache=lsGet(OFF_CACHE,{}); cache[code]={...(cache[code]||{}),...body,found:true,source:cache[code]&&cache[code].source||"CATALOGUE DU FOYER"}; lsSet(OFF_CACHE,cache);
  const c=pbCfg(); if(!c) return;
  try{ const r=await catalogFind(code);
    if(r) await pbReq(c,`/api/collections/products/records/${r.id}`,{method:"PATCH",body:JSON.stringify(body)});
    else await pbReq(c,`/api/collections/products/records`,{method:"POST",body:JSON.stringify(body)}); }
  catch(e){}
}
export async function lookup(code){
  const local=lsGet(OFF_CACHE,{})[code]; if(local&&local.name) return local;
  const fromHome=await catalogGet(code); if(fromHome){ const cache=lsGet(OFF_CACHE,{}); cache[code]=fromHome; lsSet(OFF_CACHE,cache); return fromHome; }
  const r=await lookupOFF(code);
  if(r.found) catalogSave(code,r);
  return r;
}
export async function lookupOFF(code){
  const cache=lsGet(OFF_CACHE,{});
  const codes=[code]; if(code.length===12) codes.push("0"+code); if(code.length===13&&code[0]==="0") codes.push(code.slice(1));
  for(const [host,source] of OFF_HOSTS){
    for(const c of codes){
      let j; try{ j=await fetchJSON(`https://${host}/api/v2/product/${c}.json?fields=${OFF_FIELDS}`, host.includes("food")?8000:5000); }
      catch(e){ if(host.includes("food")) return {found:false,offline:true}; continue; }
      const p=j&&j.status===1&&j.product; if(!p) continue;
      const name=(p.product_name_fr||p.product_name||p.generic_name_fr||"").trim(), brand=(p.brands||"").split(",")[0].trim();
      if(!name&&!brand) continue;
      const out={found:true,source,name,brand,hint:p.quantity||"",image:p.image_front_small_url||p.image_small_url||"",
        nutri:grade(p.nutriscore_grade),eco:grade(p.environmental_score_grade||p.ecoscore_grade),nova:Number(p.nova_group)||0,location:guessPlace(p.categories_tags),shelfDays:guessShelf(p.categories_tags)};
      const keys=Object.keys(cache); if(keys.length>400) delete cache[keys[0]];
      cache[code]=out; lsSet(OFF_CACHE,cache); return out;
    }
  }
  return {found:false};
}
// What a scanned/typed text is: a product barcode, a JSON label, or free text
export const MISS_KEY="gm-lookup-miss";
// Items scanned without network (or before a product existed in the database): retry quietly later
export async function completeMissing(items,put){
  if(!navigator.onLine) return 0;
  const miss=lsGet(MISS_KEY,{}), now=Date.now(); let done=0;
  const todo=items.filter(i=>i.code && /^\d{8,14}$/.test(i.code) && !i.image && !i.brand && !(miss[i.code]>now-7*864e5)).slice(0,12);
  for(const it of todo){
    const r=await lookup(it.code);
    if(r.offline) break;
    if(!r.found){ miss[it.code]=now; continue; }
    put({...it, name: (!it.name||it.name===placeholderName(it.code)) ? (r.name||it.name) : it.name,
      brand:it.brand||r.brand, image:r.image||"", nutri:it.nutri||r.nutri, nova:it.nova||r.nova, eco:it.eco||r.eco,
      expiry:it.expiry||(r.shelfDays&&(Number(it.qty)||0)>0?iso(r.shelfDays):"")});
    done++;
  }
  lsSet(MISS_KEY,miss); return done;
}
