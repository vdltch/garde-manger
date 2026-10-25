// Barcode reading: native BarcodeDetector, ZXing-C++ WebAssembly, ZXing JS.
import { validGtin, isRetail } from "./domain.js";

/* ---------- Barcode detection ----------
   1. native BarcodeDetector (Android Chrome), 2. ZXing-C++ in WebAssembly (iPhone & the rest),
   3. ZXing JS as last resort. */
export const SCAN_FORMATS=["ean_13","ean_8","upc_a","upc_e","qr_code","code_128","data_matrix"];
export let detectorP=null, zx=null;
export const loadScript=(src)=>new Promise((ok,ko)=>{ const el=document.createElement("script"); el.src=src; el.onload=ok; el.onerror=ko; document.head.appendChild(el); });
export async function wasmDetectorClass(){
  // 1. copy hosted with the app (script + .wasm), 2. jsDelivr
  try{
    if(!window.BarcodeDetectionAPI) await loadScript("vendor/barcode-detector.iife.js");
    const api=window.BarcodeDetectionAPI;
    if(api && api.BarcodeDetector){
      const wasm=new URL("vendor/zxing_reader.wasm",location.href).href;
      const ok=await fetch(wasm,{method:"HEAD"}).then(r=>r.ok&&/wasm/.test(r.headers.get("content-type")||"")).catch(()=>false);
      if(ok && api.prepareZXingModule) api.prepareZXingModule({overrides:{locateFile:(path,prefix)=>path.endsWith(".wasm")?wasm:prefix+path}});
      return api.BarcodeDetector;
    }
  }catch(e){}
  const m=await import("https://fastly.jsdelivr.net/npm/barcode-detector@3.1.3/dist/es/ponyfill.min.js");
  return m.BarcodeDetector;
}
export function getDetector(){
  if(detectorP) return detectorP;
  detectorP=(async()=>{
    if("BarcodeDetector" in window){
      try{ const sup=await BarcodeDetector.getSupportedFormats(); const f=SCAN_FORMATS.filter(x=>sup.includes(x));
        if(f.includes("ean_13")) return new BarcodeDetector({formats:f}); }catch(e){}
    }
    try{
      const BD=await wasmDetectorClass();
      const d=new BD({formats:SCAN_FORMATS});
      try{ const c=document.createElement("canvas"); c.width=c.height=16; await d.detect(c); }catch(e){} // loads the wasm now
      return d;
    }catch(e){ return null; }
  })();
  return detectorP;
}
export function zxingDecode(canvas){
  if(!window.ZXing||!ZXing.HTMLCanvasElementLuminanceSource) return null;
  if(!zx){ const F=ZXing.BarcodeFormat, hints=new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.QR_CODE,F.CODE_128,F.DATA_MATRIX]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER,true); zx=new ZXing.MultiFormatReader(); zx.setHints(hints); }
  try{ const r=zx.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(canvas))));
    return {rawValue:r.getText(),format:String(ZXing.BarcodeFormat[r.getBarcodeFormat()]||"").toLowerCase()}; }
  catch(e){ return null; }
}
export async function detectIn(canvas){
  const d=await getDetector();
  if(d){ try{ const r=await d.detect(canvas); if(r&&r.length) return r; }catch(e){} return []; }
  const z=zxingDecode(canvas); return z?[z]:[];
}
// A retail barcode must pass its check digit; anything else must be read twice in a row
export async function decodeImageFile(file){
  let bmp;
  try{ bmp=await createImageBitmap(file,{imageOrientation:"from-image"}); }
  catch(e){ bmp=await new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src=URL.createObjectURL(file); }); }
  const w=bmp.width,h=bmp.height;
  for(const max of [1600,1000,2400]){
    const k=Math.min(1,max/Math.max(w,h)); const c=document.createElement("canvas");
    c.width=Math.round(w*k); c.height=Math.round(h*k); c.getContext("2d",{willReadFrequently:true}).drawImage(bmp,0,0,c.width,c.height);
    const hits=(await detectIn(c)).filter(x=>x.rawValue&&(!isRetail(x)||validGtin(x.rawValue.trim())));
    if(hits.length) return hits[0].rawValue.trim();
  }
  throw new Error("notfound");
}
if("requestIdleCallback" in window) requestIdleCallback(()=>getDetector()); else setTimeout(getDetector,1500);
