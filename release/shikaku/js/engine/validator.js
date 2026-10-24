export const messages = {
  OK: 'Rectangle placed.', OUT_OF_BOUNDS: 'Keep the rectangle inside the board.',
  BAD_DIMENSIONS: 'Choose whole cells with a positive width and height.', NO_CLUE: 'Include exactly one number.',
  MULTIPLE_CLUES: 'Each rectangle can contain only one number.', WRONG_AREA: "The rectangle’s area must match its number.",
  OVERLAP: 'Rectangles cannot overlap.', SESSION_LOCKED: 'This puzzle is not accepting moves.'
};
export function contains(rect, row, col) {
  return row >= rect.row && row < rect.row + rect.height && col >= rect.col && col < rect.col + rect.width;
}
export function overlap(a, b) {
  return a.row < b.row + b.height && b.row < a.row + a.height && a.col < b.col + b.width && b.col < a.col + a.width;
}
export function validatePuzzle(puzzle) {
  if (!puzzle || !Number.isInteger(puzzle.rows) || !Number.isInteger(puzzle.cols) || puzzle.rows < 1 || puzzle.cols < 1 || puzzle.rows > 30 || puzzle.cols > 30 || !Array.isArray(puzzle.clues) || !puzzle.clues.length) return false;
  const ids = new Set(), cells = new Set();
  let sum = 0;
  for (const clue of puzzle.clues) {
    if (!clue || typeof clue.id !== 'string' || ids.has(clue.id) || !Number.isInteger(clue.row) || !Number.isInteger(clue.col) || clue.row < 0 || clue.col < 0 || clue.row >= puzzle.rows || clue.col >= puzzle.cols || !Number.isInteger(clue.value) || clue.value < 1 || clue.value > puzzle.rows * puzzle.cols || cells.has(`${clue.row}:${clue.col}`)) return false;
    ids.add(clue.id); cells.add(`${clue.row}:${clue.col}`); sum += clue.value;
  }
  return sum === puzzle.rows * puzzle.cols;
}
export function rectangleFromCorners(a, b) {
  return { row: Math.min(a.row,b.row), col: Math.min(a.col,b.col), height: Math.abs(a.row-b.row)+1, width: Math.abs(a.col-b.col)+1 };
}
export function validateRectangle(puzzle, rectangles, proposed, replacingClueId = null, status = 'PLAYING') {
  const fail = code => ({ ok: false, code, message: messages[code] });
  if (status !== 'PLAYING') return fail('SESSION_LOCKED');
  if (!proposed || !['row','col','height','width'].every(key => Number.isInteger(proposed[key])) || proposed.height <= 0 || proposed.width <= 0) return fail('BAD_DIMENSIONS');
  const {row,col,height,width} = proposed;
  if (row < 0 || col < 0 || row + height > puzzle.rows || col + width > puzzle.cols) return fail('OUT_OF_BOUNDS');
  const clues = puzzle.clues.filter(clue => contains(proposed,clue.row,clue.col));
  if (!clues.length) return fail('NO_CLUE');
  if (clues.length > 1) return fail('MULTIPLE_CLUES');
  if (height * width !== clues[0].value) return fail('WRONG_AREA');
  if (replacingClueId && clues[0].id !== replacingClueId) return fail('OVERLAP');
  if (rectangles.some(rect => rect.clueId !== replacingClueId && overlap(rect,proposed))) return fail('OVERLAP');
  return { ok: true, code: 'OK', message: messages.OK, rectangle: { clueId: clues[0].id,row,col,height,width } };
}
export function isComplete(puzzle, rectangles) {
  if (!validatePuzzle(puzzle) || rectangles.length !== puzzle.clues.length) return false;
  const clues = new Set();
  for (let index=0;index<rectangles.length;index++) {
    const rect=rectangles[index];
    const result=validateRectangle(puzzle,rectangles.filter((_,i)=>i!==index),rect);
    if (!result.ok || result.rectangle.clueId !== rect.clueId || clues.has(rect.clueId)) return false;
    clues.add(rect.clueId);
  }
  return rectangles.reduce((sum,rect)=>sum+rect.height*rect.width,0) === puzzle.rows*puzzle.cols;
}
