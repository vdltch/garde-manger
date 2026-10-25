// React (UMD global) + htm: JSX-free templates, no build step.
export const { useState, useEffect, useMemo, useRef } = React;
export const html = htm.bind(React.createElement);
