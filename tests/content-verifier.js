// Test-only independent verifier. Runtime solving and hints are P3.
export function countSolutions(puzzle, limit=2) {
  const candidates=puzzle.clues.map((clue,index)=>{
    const options=[];
    for(let height=1;height<=puzzle.rows;height++){
      if(clue.value%height)continue;
      const width=clue.value/height;
      for(let row=Math.max(0,clue.row-height+1);row<=Math.min(clue.row,puzzle.rows-height);row++){
        for(let col=Math.max(0,clue.col-width+1);col<=Math.min(clue.col,puzzle.cols-width);col++){
          if(puzzle.clues.some((other,i)=>i!==index&&other.row>=row&&other.row<row+height&&other.col>=col&&other.col<col+width))continue;
          let mask=0n;
          for(let r=row;r<row+height;r++)for(let c=col;c<col+width;c++)mask|=1n<<BigInt(r*puzzle.cols+c);
          options.push(mask);
        }
      }
    }
    return options;
  });
  const complete=(1n<<BigInt(puzzle.rows*puzzle.cols))-1n;
  function search(indices,used){
    if(!indices.length)return used===complete?1:0;
    let best=null,clueIndex=-1;
    for(const i of indices){const compatible=candidates[i].filter(mask=>!(mask&used));if(!compatible.length)return 0;if(!best||compatible.length<best.length){best=compatible;clueIndex=i;}}
    let count=0;
    for(const mask of best){count+=search(indices.filter(i=>i!==clueIndex),used|mask);if(count>=limit)return limit;}
    return count;
  }
  return search(candidates.map((_,index)=>index),0n);
}
