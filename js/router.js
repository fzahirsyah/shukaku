export function readRoute() {
  const path = location.hash.slice(1) || '/';
  if (['/', '/classic', '/zen', '/settings', '/stats', '/how-to-play'].includes(path)) return { name: path === '/' ? 'home' : path.slice(1) };
  const game = path.match(/^\/play\/(classic|zen)\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/);
  if (game) return { name: 'game', mode: game[1], id: game[2], attempt: game[3] };
  return { name: 'home', unknown: true };
}
export function navigate(path) { location.hash = path; }
