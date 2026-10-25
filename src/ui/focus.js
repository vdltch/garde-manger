import { useEffect } from "../lib.js";

// Dialog focus: move focus inside on open, keep Tab inside, give it back on close.
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function useDialogFocus(ref, onEscape){
  useEffect(()=>{
    const box = ref.current; if(!box) return;
    const before = document.activeElement;
    const items = () => Array.from(box.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
    const first = box.querySelector("[autofocus]") || items()[0] || box;
    if(first === box && !box.hasAttribute("tabindex")) box.setAttribute("tabindex","-1");
    try{ first.focus({ preventScroll: true }); }catch(e){}
    const onKey = (e) => {
      if(e.key === "Escape"){ e.stopPropagation(); onEscape && onEscape(); return; }
      if(e.key !== "Tab") return;
      const list = items(); if(!list.length){ e.preventDefault(); return; }
      const a = list[0], z = list[list.length - 1];
      if(e.shiftKey && document.activeElement === a){ e.preventDefault(); z.focus(); }
      else if(!e.shiftKey && document.activeElement === z){ e.preventDefault(); a.focus(); }
    };
    // on the document, not the dialog: focus can fall back to <body> when the content changes
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if(before && before.focus) try{ before.focus({ preventScroll: true }); }catch(e){} };
  }, []);
}
