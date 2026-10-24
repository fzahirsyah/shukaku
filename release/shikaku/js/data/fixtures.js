// The PRD's canonical, uniquely solvable 4×4 tutorial.
export const tutorial = {
  size: 4,
  clues: [{ row: 0, col: 1, value: 4 }, { row: 1, col: 0, value: 2 }, { row: 1, col: 2, value: 6 }, { row: 3, col: 1, value: 3 }, { row: 3, col: 3, value: 1 }],
  regions: [{ row: 0, col: 0, height: 1, width: 4 }, { row: 1, col: 0, height: 2, width: 1 }, { row: 1, col: 1, height: 2, width: 3 }, { row: 3, col: 0, height: 1, width: 3 }, { row: 3, col: 3, height: 1, width: 1 }]
};
export const tiers = [
  { id: 'beginner', label: 'Beginner', size: 5, count: 10 },
  { id: 'easy', label: 'Easy', size: 6, count: 8 },
  { id: 'medium', label: 'Medium', size: 7, count: 6 },
  { id: 'hard', label: 'Hard', size: 10, count: 4 },
  { id: 'expert', label: 'Expert', size: 12, count: 2 }
];
export const tutorialBeats = [
  ['Every number has a home.', 'Every number belongs to one rectangle. Cover the whole board to finish.'],
  ['Four cells. One rectangle.', 'The rectangle around 4 covers exactly four cells. Each rectangle contains just one number.'],
  ['Choose two corners.', 'Drag between two corners, or tap one corner and then the opposite corner. Double-tap an empty cell to cancel; double-tap a placed rectangle to remove it.'],
  ['Give each shape its space.', 'Rectangles cannot overlap or include another number.'],
  ['Find the remaining shapes.', 'Keep going until every cell belongs to a rectangle.'],
  ["You’re ready.", 'Choose a puzzle and find your own rhythm. You can revisit these rules anytime.']
];

export const tutorialPuzzle = { id: 'tutorial-4x4', contentVersion: 1, rows: 4, cols: 4, difficulty: 'tutorial', modeSource: 'curated', uniqueVerified: true, clues: tutorial.clues.map((clue,index)=>({...clue,id:`t4-${index}`})), solution: tutorial.regions.map((rect,index)=>({...rect,clueId:`t4-${index}`})) };
