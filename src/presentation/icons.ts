/**
 * Line icons as inline SVG, drawn in the UI's own colour (currentColor), so the
 * interface has no emoji and no icon files to download.
 */
const svg = (body: string, size = 20): SVGSVGElement => {
  const template = document.createElement('template');
  template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  return template.content.firstElementChild as SVGSVGElement;
};

export const ICONS = {
  lock: (size?: number) => svg('<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', size),
  retry: (size?: number) => svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>', size),
  menu: (size?: number) => svg('<path d="M4 7h16M4 12h16M4 17h16"/>', size),
  share: (size?: number) =>
    svg('<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>', size),
  undo: (size?: number) => svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', size),
  back: (size?: number) => svg('<path d="M15 5l-7 7 7 7"/>', size),
  /** A plunger detonator. */
  detonator: (size?: number) =>
    svg('<rect x="4" y="12" width="16" height="8" rx="1"/><path d="M12 12V5"/><path d="M8 5h8"/><path d="M8 16h2"/>', size),
  phone: (size?: number) => svg('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M17 12h.01"/>', size),
  check: (size?: number) => svg('<path d="M5 12l5 5 9-10"/>', size),
  cross: (size?: number) => svg('<path d="M6 6l12 12M18 6L6 18"/>', size),
};
