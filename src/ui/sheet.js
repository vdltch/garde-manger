import { REDUCED } from "../device.js";
import { useState, useRef, html } from "../lib.js";
import { useDialogFocus } from "./focus.js";

/* ---------- Bottom sheet with drag-to-dismiss ---------- */
export function Sheet({label,children,onClose,top}){
  const ref=useRef(null), drag=useRef(null);
  const [closing,setClosing]=useState(false);
  const close=()=>{ setClosing(c=>{ if(!c) setTimeout(onClose,REDUCED?0:230); return true; }); };
  useDialogFocus(ref, close);
  const down=e=>{ drag.current={y:e.clientY,dy:0}; e.currentTarget.setPointerCapture(e.pointerId); ref.current.style.transition="none"; };
  const move=e=>{ if(!drag.current) return; const dy=Math.max(0,e.clientY-drag.current.y); drag.current.dy=dy; ref.current.style.transform=`translateY(${dy}px)`; };
  const up=()=>{ if(!drag.current) return; const dy=drag.current.dy; drag.current=null;
    ref.current.style.transition="transform .45s var(--spring)";
    if(dy>110){ close(); } else { ref.current.style.transform=""; } };
  return html`<div class=${"scrim"+(top?" over":"")+(closing?" out":"")} onClick=${e=>e.target===e.currentTarget&&close()}>
    <div class=${"sheet"+(closing?" out":"")} ref=${ref} role="dialog" aria-modal="true" aria-label=${label}>
      <div class="grab" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}><span></span></div>
      ${children(close)}
    </div></div>`;
}
