import type {World} from './types.ts';

export const HOME_WIDTH=36, HOME_HEIGHT=24, TILE=48;
export const mapWidth=(w:World)=>w.version===5?HOME_WIDTH:12;
export const mapHeight=(w:World)=>w.version===5?HOME_HEIGHT:12;
export const cell=(w:World,x:number,y:number)=>y*mapWidth(w)+x;
export const inside=(w:World,x:number,y:number)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<mapWidth(w)&&y<mapHeight(w);
export const biomeAt=(w:World,x:number,y:number)=>w.version===5?(w.map?.terrain[cell(w,Math.floor(x),Math.floor(y))]??0):0;
export const neighbours=(w:World,n:number)=>{
 const width=mapWidth(w),x=n%width,y=Math.floor(n/width);
 return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([x,y])=>inside(w,x,y)).map(([x,y])=>cell(w,x,y));
};
export const originalPoint=(zone:number,x:number,y:number)=>({x:x+(zone%3)*12,y:y+Math.floor(zone/3)*12});
/* 开垦地块：地图按 6×6 格分成 6 列 4 行。新家园只开放中间四块（x 12–23，y 6–17），其余是待开垦的密林。 */
export const PLOT=6,PLOT_COLUMNS=HOME_WIDTH/PLOT,PLOT_ROWS=HOME_HEIGHT/PLOT,PLOT_COUNT=PLOT_COLUMNS*PLOT_ROWS;
export const START_PLOTS=[8,9,14,15];
export const plotAt=(x:number,y:number)=>Math.floor(y/PLOT)*PLOT_COLUMNS+Math.floor(x/PLOT);
export const plotOrigin=(n:number):[number,number]=>[n%PLOT_COLUMNS*PLOT,Math.floor(n/PLOT_COLUMNS)*PLOT];
export const plotNeighbours=(n:number)=>{const x=n%PLOT_COLUMNS,y=Math.floor(n/PLOT_COLUMNS);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<PLOT_COLUMNS&&b<PLOT_ROWS).map(([a,b])=>b*PLOT_COLUMNS+a);};
export const createMap=()=>({width:HOME_WIDTH,height:HOME_HEIGHT,terrain:Array.from({length:HOME_WIDTH*HOME_HEIGHT},(_,n)=>Math.floor(n%HOME_WIDTH/12)+Math.floor(n/HOME_WIDTH/12)*3)});

export interface Camera {x:number;y:number;zoom:number;ready:boolean;}
export interface CameraFrame {left:number;top:number;right:number;bottom:number;}
// Trees and roofs extend above their tiles. Keep room to bring that art below the HUD.
export const MAP_MARGIN=TILE*3;
export function constrainCamera(camera:Camera,width:number,height:number,frame:CameraFrame={left:0,top:0,right:width,bottom:height}):void {
 const minimum=Math.max((frame.right-frame.left)/(HOME_WIDTH*TILE+MAP_MARGIN*2),(frame.bottom-frame.top)/(HOME_HEIGHT*TILE+MAP_MARGIN*2));
 camera.zoom=Math.max(minimum,Math.min(Math.max(3,minimum*2),camera.zoom));
 camera.x=Math.max(-MAP_MARGIN-frame.left/camera.zoom,Math.min(HOME_WIDTH*TILE+MAP_MARGIN-frame.right/camera.zoom,camera.x));
 camera.y=Math.max(-MAP_MARGIN-frame.top/camera.zoom,Math.min(HOME_HEIGHT*TILE+MAP_MARGIN-frame.bottom/camera.zoom,camera.y));
}
export const screenToCell=(camera:Camera,x:number,y:number):[number,number]=>[Math.floor((camera.x+x/camera.zoom)/TILE),Math.floor((camera.y+y/camera.zoom)/TILE)];
