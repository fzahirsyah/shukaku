const paths = {
  back: 'm14 6-6 6 6 6', arrow: 'M5 12h14m-6-6 6 6-6 6', chevron: 'm9 6 6 6-6 6',
  grid: 'M4 4h16v16H4zM4 10h16M10 10v10M16 4v6',
  leaf: 'M19 4C7 3 3 9 6 15s14 3 13-11ZM6 18 16 8M10 14v-4',
  settings: 'm10 3-.6 3-2 .9L5 6 3 9l2.2 2v2L3 15l2 3 2.4-.9 2 .9.6 3h4l.6-3 2-.9 2.4.9 2-3-2.2-2v-2L21 9l-2-3-2.4.9-2-.9L14 3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  undo: 'm8 5-5 5 5 5M3 10h10a7 7 0 0 1 7 7v2', redo: 'm16 5 5 5-5 5M21 10H11a7 7 0 0 0-7 7v2',
  hint: 'M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2',
  restart: 'M4 9a8 8 0 1 1 0 6M4 3v6h6', close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6', lock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',
  play: 'm9 5 10 7-10 7z', pause: 'M8 5v14M16 5v14', more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M5 12h14M12 5v14', minus: 'M5 12h14', pan: 'M12 3v18M3 12h18m-6-6-3-3-3 3m6 12-3 3-3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
  download: 'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5', upload: 'M12 15V3m-5 5 5-5 5 5M5 16v5h14v-5',
  chart: 'M5 20V13M12 20V4M19 20V9', help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01',
  fit: 'M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5', clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'
};
export default { props: { name: String }, computed: { path() { return paths[this.name] || paths.grid; } }, template: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path :d="path" /></svg>' };
