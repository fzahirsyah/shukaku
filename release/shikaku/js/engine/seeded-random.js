// Versioned generator input uses the whole seed, independent of platform randomness.
export function seededRandom(seed){
  let state=2166136261;
  for(const character of seed){state^=character.codePointAt(0);state=Math.imul(state,16777619);}
  return ()=>{state=(state+0x6D2B79F5)|0;let value=Math.imul(state^(state>>>15),1|state);value^=value+Math.imul(value^(value>>>7),61|value);return((value^(value>>>14))>>>0)/4294967296;};
}
