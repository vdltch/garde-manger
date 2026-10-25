// Pure logic (no DOM): dates, freshness, barcodes, categories. Unit-tested with node --test.


/* ---------- Domain ---------- */
export const PLACES = [
  {id:"Frigo",c:"var(--frigo)"},{id:"Congélateur",c:"var(--congel)"},
  {id:"Placard",c:"var(--placard)"},{id:"Cave",c:"var(--cave)"}];
export const placeColor = (p) => (PLACES.find(x=>x.id===p)||PLACES[2]).c;
export const UNITS = ["pcs","g","kg","ml","L","boîte","sachet","pot"];
export const LS_KEY = "garde-manger-v1";
export const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
export const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const iso = (n) => { const d=today(); d.setDate(d.getDate()+n); return fmt(d); };
export const daysLeft = (s) => s ? Math.round((new Date(s+"T00:00:00") - today())/864e5) : null;
export const status = (it) => { const d=daysLeft(it.expiry); if(d===null) return "none"; if(d<0) return "bad"; if(d<=3) return "warn"; return "ok"; };
export const ringColor = { ok:"var(--ok)", warn:"var(--warn)", bad:"var(--bad)", none:"var(--muted)" };
export const ringPct = (it) => { const d=daysLeft(it.expiry); if(d===null) return 100; if(d<0) return 100; return Math.max(8,Math.min(100,Math.round(d/14*100))); };
export const expLabel = (it) => { const d=daysLeft(it.expiry); if(d===null) return null;
  if(d<0) return `PÉRIMÉ · ${-d} J`; if(d===0) return "AUJOURD'HUI"; if(d===1) return "DEMAIN";
  if(d<=30) return `J−${d}`; return new Date(it.expiry+"T00:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"2-digit"}).toUpperCase(); };
export const initials = (n) => { const w=(n||"?").replace(/[^\p{L}\p{N} ]/gu,"").trim().split(/\s+/); return ((w[0]||"?")[0]+((w[1]||w[0]||"")[w[1]?0:1]||"")).toUpperCase(); };
export const uid = () => { const a="abcdefghijklmnopqrstuvwxyz0123456789"; const r=crypto.getRandomValues(new Uint8Array(15)); let s=""; r.forEach(b=>{ s+=a[b%36]; }); return s; };
export const qtyText = (it) => it.unit==="pcs" ? "" : it.unit;


export const grade=(g)=> /^[a-e]$/.test(g||"") ? g : "";
// GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14): rejects misreads before they reach the product database
export const validGtin=(code)=>{ if(!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const d=code.split("").map(Number), chk=d.pop(); let sum=0;
  d.reverse().forEach((n,i)=>{ sum+=n*(i%2===0?3:1); }); return (10-sum%10)%10===chk; };
export const guessPlace=(tags)=>{ const t=(tags||[]).join(" ");
  if(/frozen|surgel/.test(t)) return "Congélateur";
  if(/wines|beers|ciders|spirits|alcoholic-beverages/.test(t)) return "Cave";
  if(/dairies|dairy|yogurts|cheeses|fresh-|meats|charcuteries|hams|sausages|fishes|seafood|butters|creams|dairy-desserts|ready-meals|refrigerated|tofu|fresh-pasta|salads|smoked-salmon|eggs/.test(t)) return "Frigo";
  return "Placard"; };
export const SHELF=[[/frozen|surgel/,180],[/fresh-fish|fishes|seafood|smoked-salmon|shellfish/,3],[/fresh-meats|poultr|ground-meat|minced|steaks/,3],
  [/ready-meals|fresh-salads|prepared-salads/,4],[/hams|charcuter|sausages|bacons/,7],[/fresh-pasta|fresh-filled-pasta/,14],
  [/yogurts|dairy-desserts|fermented-milk|creams/,21],[/cheeses/,21],[/uht/,90],[/milks/,7],[/butters/,60],[/eggs/,28],
  [/breads|viennoiseries/,4],[/fresh-fruits|fresh-vegetables|^en:fruits|^en:vegetables/,7],[/fruit-juices|fresh-juices/,10],
  [/wines|beers|ciders|spirits|alcoholic/,0],[/canned|conserves/,730],[/pastas|rices|cereals|flours|sugars|legumes|dried/,365],
  [/coffees|teas|herbal-teas/,365],[/chocolates|biscuits|cakes|confectioneries|snacks/,150],[/sauces|condiments|spreads|jams/,180],[/beverages|waters|sodas/,180]];
export const guessShelf=(tags)=>{ const t=(tags||[]).join(" "); for(const [re,d] of SHELF){ if(re.test(t)) return d; } return 0; };

export function classify(text){
  text=(text||"").trim();
  try{ const j=JSON.parse(text); if(j&&typeof j==="object") return {name:j.name||j.nom||"",brand:j.brand||j.marque||"",expiry:j.expiry||j.dlc||"",qty:j.qty||1,unit:j.unit||"pcs",location:j.location||j.lieu||"Placard",code:j.code||"",raw:text}; }catch(e){}
  const digits=text.replace(/\s/g,"");
  if(/^\d{8,14}$/.test(digits)) return {code:digits,raw:text};
  const url=text.match(/(?:^|\/)(?:01\/)?(\d{14})(?:\/|$)/);         // GS1 Digital Link QR codes
  if(url && validGtin(url[1])) return {code:url[1].replace(/^0+(?=\d{13}$)/,""),raw:text};
  return {name:text.slice(0,80),raw:text};
}

export const placeholderName=(code)=>`Produit ${code}`;
export const isRetail=(h)=>/^(ean_13|ean_8|upc_a)$/.test(h.format||"")||(!h.format&&/^\d{8,14}$/.test(h.rawValue||""));
export const NUTRI_C={a:"#038141",b:"#85bb2f",c:"#fecb02",d:"#ee8100",e:"#e63e11"};
