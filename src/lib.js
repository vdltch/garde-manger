// React (UMD global) + htm: JSX-free templates, no build step.
// Guarded so the pure modules can also be loaded by node for tests (no React there).
const R = globalThis.React || {};
export const { useState, useEffect, useMemo, useRef } = R;
export const html = globalThis.htm && R.createElement ? globalThis.htm.bind(R.createElement) : () => null;
