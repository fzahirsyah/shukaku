import {classicLevels} from './classic-levels.js';
export const zenFallbackLevels=classicLevels.map((puzzle,index)=>({...puzzle,id:`zen-fallback-5-${String(index+1).padStart(3,'0')}`,modeSource:'zen-fallback'}));
