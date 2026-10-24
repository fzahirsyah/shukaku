import { contains, rectangleFromCorners, validateRectangle } from '../engine/validator.js';
const colors = ['mint','sky','lilac','peach','rose'];
export default {
  props: { puzzle: Object, rectangles: {type:Array,default:()=>[]}, locked:Boolean, replacing:String, selected:String, zoom:{type:Number,default:1}, panMode:Boolean, selectionStyle:String, highlightedClue:String, hintError:Boolean },
  emits:['place','select','remove','cancel','status'],
  data() { return {anchor:null, endpoint:null, pointer:null, focused:0, suppressClick:false}; },
  computed: {
    preview() { return this.anchor && this.endpoint ? rectangleFromCorners(this.anchor,this.endpoint) : null; },
    validity() { return this.preview ? validateRectangle(this.puzzle,this.rectangles,this.preview,this.replacing) : null; },
    focusedLabel() { return this.anchor ? 'Choose the opposite corner.' : 'Draw a rectangle around one number.'; }
  },
  watch: {
    locked(value) { if(value)this.clearGesture(); },
    puzzle() { this.clearGesture();this.focused=0; },
    replacing() { this.clearGesture();this.$nextTick(()=>this.focusCell(this.focused)); },
    panMode() { this.clearPointer(); },
    zoom() { this.clearPointer(); }
  },
  mounted() { window.addEventListener('resize',this.onResize); },
  beforeUnmount() { window.removeEventListener('resize',this.onResize); },
  methods: {
    position(rect) { return {top:`${rect.row/this.puzzle.rows*100}%`,left:`${rect.col/this.puzzle.cols*100}%`,height:`${rect.height/this.puzzle.rows*100}%`,width:`${rect.width/this.puzzle.cols*100}%`}; },
    regionStyle(rect) { const index=this.puzzle.clues.findIndex(c=>c.id===rect.clueId);return {...this.position(rect),background:`var(--${colors[index%colors.length]})`}; },
    clueAt(row,col) {return this.puzzle.clues.find(c=>c.row===row&&c.col===col);},
    cellLabel(row,col) {const clue=this.clueAt(row,col),region=this.rectangles.find(r=>contains(r,row,col));return `Row ${row+1}, column ${col+1}${clue?', clue '+clue.value:', empty'}${region?', placed rectangle':''}${clue?.id===this.highlightedClue?', hint highlighted':''}`;},
    focusClue(id){const clue=this.puzzle.clues.find(c=>c.id===id);if(clue)this.focusCell(clue.row*this.puzzle.cols+clue.col);},
    focusCell(index) {this.focused=Math.max(0,Math.min(this.puzzle.rows*this.puzzle.cols-1,index));this.$nextTick(()=>{const cell=this.$el.querySelector(`[data-cell="${this.focused}"]`);if(!cell)return;cell.focus({preventScroll:true});const bounds=cell.getBoundingClientRect(),view=this.$refs.viewport.getBoundingClientRect();if(bounds.left<view.left)this.$refs.viewport.scrollLeft-=view.left-bounds.left;else if(bounds.right>view.right)this.$refs.viewport.scrollLeft+=bounds.right-view.right;if(bounds.top<view.top)this.$refs.viewport.scrollTop-=view.top-bounds.top;else if(bounds.bottom>view.bottom)this.$refs.viewport.scrollTop+=bounds.bottom-view.bottom;});},
    cellAt(event) {const bounds=this.$refs.board.getBoundingClientRect();const col=Math.floor((event.clientX-bounds.left)/bounds.width*this.puzzle.cols),row=Math.floor((event.clientY-bounds.top)/bounds.height*this.puzzle.rows);return row>=0&&col>=0&&row<this.puzzle.rows&&col<this.puzzle.cols?{row,col}:null;},
    clearPointer() {const current=this.pointer;this.pointer=null;if(current&&this.$refs.board?.hasPointerCapture(current.id))this.$refs.board.releasePointerCapture(current.id);},
    clearGesture() {this.clearPointer();this.anchor=null;this.endpoint=null;},
    onResize() {this.clearGesture();this.$emit('cancel');},
    down(event) {
      if(this.locked||!event.isPrimary||event.button!==0||this.pointer)return;
      const cell=this.cellAt(event);if(!cell)return;
      event.preventDefault();this.focusCell(cell.row*this.puzzle.cols+cell.col);
      this.pointer={id:event.pointerId,start:cell,x:event.clientX,y:event.clientY,dragging:false,scrollLeft:this.$refs.viewport.scrollLeft,scrollTop:this.$refs.viewport.scrollTop};
      this.$refs.board.setPointerCapture(event.pointerId);
    },
    move(event) {
      const pointer=this.pointer;if(!pointer||pointer.id!==event.pointerId)return;
      if(this.panMode){this.$refs.viewport.scrollLeft=pointer.scrollLeft+pointer.x-event.clientX;this.$refs.viewport.scrollTop=pointer.scrollTop+pointer.y-event.clientY;return;}
      if(this.selectionStyle==='tap')return;
      const distance=Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y);
      if(!pointer.dragging&&distance<7)return;
      if(!pointer.dragging){pointer.dragging=true;this.anchor=pointer.start;}
      this.endpoint=this.cellAt(event);
      if(this.validity)this.$emit('status',this.validity.ok?`${this.preview.height} × ${this.preview.width} = ${this.preview.height*this.preview.width}`:this.validity.message);
    },
    up(event) {
      const pointer=this.pointer;if(!pointer||pointer.id!==event.pointerId)return;
      const cell=this.cellAt(event);this.clearPointer();
      if(this.panMode)return;
      if(!cell){this.anchor=null;this.endpoint=null;this.$emit('status','Keep the rectangle inside the board.');return;}
      if(pointer.dragging){this.finish(rectangleFromCorners(pointer.start,cell));return;}
      this.activate(cell);
    },
    cancelPointer(event) {if(this.pointer&&(!event||this.pointer.id===event.pointerId)){this.clearGesture();this.$emit('status','Selection cancelled.');}},
    activate(cell) {
      if(this.locked||this.panMode)return;
      if(this.anchor){this.finish(rectangleFromCorners(this.anchor,cell));return;}
      if(!this.replacing){const region=this.rectangles.find(r=>contains(r,cell.row,cell.col));if(region){this.$emit('select',region.clueId);return;}}
      this.anchor=cell;this.endpoint=cell;this.$emit('status','Choose the opposite corner.');
    },
    finish(rectangle) {this.anchor=null;this.endpoint=null;this.$emit('place',rectangle);},
    key(event) {
      if(this.locked)return;
      const row=Math.floor(this.focused/this.puzzle.cols),col=this.focused%this.puzzle.cols;
      const keys={ArrowLeft:[row,Math.max(0,col-1)],ArrowRight:[row,Math.min(this.puzzle.cols-1,col+1)],ArrowUp:[Math.max(0,row-1),col],ArrowDown:[Math.min(this.puzzle.rows-1,row+1),col]};
      if(keys[event.key]){event.preventDefault();const [r,c]=keys[event.key];this.focusCell(r*this.puzzle.cols+c);if(this.anchor)this.endpoint={row:r,col:c};return;}
      if(['Enter',' '].includes(event.key)){event.preventDefault();if(!event.repeat)this.activate({row,col});}
      if(event.key==='Escape'){event.preventDefault();this.clearGesture();this.$emit('cancel');this.$emit('status','Selection cancelled.');}
      if(['Delete','Backspace'].includes(event.key)){event.preventDefault();const region=this.rectangles.find(r=>contains(r,row,col));if(region)this.$emit('remove',region.clueId);}
    }
  },
  template:`
  <div ref="viewport" class="board-viewport" :class="{'pan-mode':panMode}">
    <div ref="board" :data-puzzle-id="puzzle.id" class="puzzle-board playable-board" :class="{'board-locked':locked}" :style="{'--size':puzzle.cols,width:(zoom*100)+'%',aspectRatio:puzzle.cols+'/'+puzzle.rows}" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancelPointer" @lostpointercapture="cancelPointer" @contextmenu.prevent @keydown="key">
      <div v-for="region in rectangles" :key="region.clueId" class="board-region" :class="{'selected-region':region.clueId===selected,'hint-region':region.clueId===highlightedClue,'contradiction-region':hintError&&region.clueId===highlightedClue}" :style="regionStyle(region)"></div>
      <div class="board-grid" role="grid" :aria-label="puzzle.rows+' by '+puzzle.cols+' Shikaku puzzle. Use arrow keys, then Enter to choose two corners.'" :aria-rowcount="puzzle.rows" :aria-colcount="puzzle.cols" :aria-disabled="locked" :style="{gridTemplateRows:'repeat('+puzzle.rows+',minmax(0,1fr))'}">
        <div v-for="row in puzzle.rows" :key="row" role="row" class="board-row"><button v-for="col in puzzle.cols" :key="col" role="gridcell" class="board-cell" :class="{'right-edge':col===puzzle.cols,'bottom-edge':row===puzzle.rows,'hint-clue':clueAt(row-1,col-1)?.id===highlightedClue,'contradiction-clue':hintError&&clueAt(row-1,col-1)?.id===highlightedClue}" :data-cell="(row-1)*puzzle.cols+col-1" :tabindex="!locked && focused===(row-1)*puzzle.cols+col-1 ? 0 : -1" :aria-label="cellLabel(row-1,col-1)" :aria-selected="!!(selected && rectangles.some(r=>r.clueId===selected&&r.row<=row-1&&r.row+r.height>row-1&&r.col<=col-1&&r.col+r.width>col-1))" @focus="focused=(row-1)*puzzle.cols+col-1">{{ clueAt(row-1,col-1)?.value }}</button></div>
      </div>
      <div v-if="preview" class="board-preview" :class="{invalid:!validity.ok}" :style="position(preview)"></div>
      <span v-if="anchor" class="board-anchor" :style="{top:(anchor.row+.12)/puzzle.rows*100+'%',left:(anchor.col+.12)/puzzle.cols*100+'%'}"></span>
    </div>
  </div>`
};
