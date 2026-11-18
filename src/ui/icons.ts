const PATHS: Record<string, string> = {
  coin: '<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.25"/><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 010 3.6h-3a1.8 1.8 0 000 3.6h4.5"/>',
  battle: '<path d="M4 4l9 9M20 4l-9 9M13 13l-2 2M11 13l2 2M3 17l4 4M21 17l-4 4M11 15l-3 3M13 15l3 3"/><path d="M4 4h4M20 4h-4"/>',
  party: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.6-4 3-6 6.5-6s5.9 2 6.5 6"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/>',
  daily: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16M9 14.5l2 2 4-4"/>',
  ascend: '<path d="M12 3c3 3.5 5 6 5 9.5a5 5 0 01-10 0C7 9 9 6.5 12 3z"/><path d="M12 12c1.5 1.5 2 2.7 2 3.7a2 2 0 01-4 0c0-1 .5-2.200 2-3.700z"/>',
  records: '<path d="M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1.500A3.500 3.500 0 007.500 11M17 6h3v1.500A3.500 3.500 0 0116.500 11M12 14v4M8 20h8"/>',
  weapon: '<path d="M6 18l9.500-9.500M14 5l5-1-1 5-3 .5-1.500-3.500zM5 15l4 4M4 20l2-2"/>',
  armor: '<path d="M12 3l7 2.500v6c0 4.500-3 7.500-7 9.500-4-2-7-5-7-9.500v-6L12 3z"/><path d="M12 8v8"/>',
  charm: '<path d="M12 3l5 4-2 4.500h-6L7 7l5-4zM9 11.500L12 21l3-9.500"/>',
  chest: '<path d="M4 10c0-3 2-5 8-5s8 2 8 5v9H4v-9z"/><path d="M4 12h16M12 12v3"/><rect x="10.500" y="13" width="3" height="3.500" rx="0.8"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2.500"/>',
  shard: '<path d="M12 2l6 8-6 12-6-12 6-8z"/><path d="M6 10h12"/>',
  skull: '<path d="M12 3c-4.500 0-7.500 3-7.500 7 0 2.500 1 4 2.500 5v4h2.500v-2h5v2H17v-4c1.500-1 2.500-2.500 2.500-5 0-4-3-7-7.500-7z"/><circle cx="9" cy="11" r="1.600"/><circle cx="15" cy="11" r="1.600"/>',
};

export function icon(name: string, size = 20): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = "icon";
  wrapper.style.width = `${size}px`;
  wrapper.style.height = `${size}px`;
  const body = PATHS[name] ?? "";
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  return wrapper;
}
