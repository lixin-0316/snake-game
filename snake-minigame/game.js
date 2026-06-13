const canvas=wx.createCanvas(),ctx=canvas.getContext('2d');
const sys=wx.getSystemInfoSync();
const SW=sys.windowWidth,SH=sys.windowHeight;
canvas.width=SW;canvas.height=SH;

const GRID=20;
const PAD=16;
const maxSize=Math.min(SW,SH)-PAD*2;
let cellSize=Math.floor(maxSize/GRID);
if(cellSize<14)cellSize=14;
const GS=cellSize*GRID;
const OX=Math.floor((SW-GS)/2),OY=Math.floor((SH-GS)/2);

let state='menu',score=0,highScore=0;
let headX,headY,dirX,dirY,targetDirX,targetDirY,trail,segCount,foodX,foodY,boostSpeed,gameOver;
let jTouchId=-1,sTouchId=-1,joystickX=0,joystickY=0,joystickActive=false;
let animId;

const J_R=80,J_KNOB_R=28;
const JL_CX=OX+GS/2-120,JL_CY=OY+GS-60;
const SR_CX=Math.min(SW-60,OX+GS/2+120),SR_CY=OY+GS-60,SR_R=60;

try{highScore=parseInt(wx.getStorageSync('snakeHighScore')||'0')}catch(e){}

function init(){
  headX=10*cellSize+OX;headY=10*cellSize+OY;
  dirX=cellSize;dirY=0;targetDirX=cellSize;targetDirY=0;
  trail=[];segCount=5;score=0;boostSpeed=false;gameOver=false;
  jTouchId=-1;sTouchId=-1;joystickActive=false;
  spawnFood();
}

function spawnFood(){
  let valid=false;
  while(!valid){
    foodX=Math.floor(Math.random()*GRID)*cellSize+OX+cellSize/2;
    foodY=Math.floor(Math.random()*GRID)*cellSize+OY+cellSize/2;
    valid=true;
    for(let i=0;i<trail.length;i++){
      const dx=trail[i].x-foodX,dy=trail[i].y-foodY;
      if(dx*dx+dy*dy<cellSize*cellSize){valid=false;break;}
    }
  }
}

function setDir(x,y){
  if(x===-dirX&&y===-dirY)return;
  targetDirX=x;targetDirY=y;
}

function getSegs(){
  const segs=[],step=Math.floor(cellSize*0.55);
  for(let i=trail.length-1;i>=0;i-=step){
    segs.push(trail[i]);
    if(segs.length>=segCount)break;
  }
  return segs;
}

function update(){
  if(gameOver||state!=='playing')return;
  dirX=targetDirX;dirY=targetDirY;
  const spd=boostSpeed?cellSize*0.14:cellSize*0.06;
  headX+=dirX*spd;headY+=dirY*spd;
  trail.push({x:headX,y:headY});
  if(trail.length>segCount*20+20)trail.shift();
  if(headX<OX||headX>OX+GS||headY<OY||headY>OY+GS){
    endGame();return;
  }
  const segs=getSegs();
  for(let s=3;s<segs.length;s++){
    const dx=headX-segs[s].x,dy=headY-segs[s].y;
    if(dx*dx+dy*dy<cellSize*cellSize*0.2){endGame();return;}
  }
  const dxF=foodX-headX,dyF=foodY-headY;
  if(dxF*dxF+dyF*dyF<cellSize*cellSize*0.2){
    score++;segCount++;spawnFood();
  }
}

function endGame(){
  gameOver=true;boostSpeed=false;
  jTouchId=-1;sTouchId=-1;joystickActive=false;
  if(score>highScore){
    highScore=score;
    try{wx.setStorageSync('snakeHighScore',highScore)}catch(e){}
  }
}

function render(){
  ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,SW,SH);

  if(state==='menu'){
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#e94560';ctx.font='bold 48px sans-serif';
    ctx.fillText('🐍 贪吃蛇',SW/2,SH/2-80);
    ctx.fillStyle='#fff';ctx.font='20px sans-serif';
    ctx.fillText('最高分: '+highScore,SW/2,SH/2-20);
    ctx.fillStyle='rgba(255,255,255,.8)';ctx.font='16px sans-serif';
    ctx.fillText('横屏体验更佳',SW/2,SH/2+20);
    const bw=200,bh=56,bx=SW/2-100,by=SH/2+60;
    ctx.fillStyle='#e94560';roundRect(ctx,bx,by,bw,bh,12);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 22px sans-serif';
    ctx.fillText('开始游戏',SW/2,by+bh/2);
    return;
  }

  // Background grid
  ctx.fillStyle='#2d5a1e';ctx.fillRect(OX,OY,GS,GS);
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  for(let i=0;i<=GRID;i++){
    ctx.beginPath();ctx.moveTo(OX+i*cellSize,OY);ctx.lineTo(OX+i*cellSize,OY+GS);ctx.stroke();
    ctx.beginPath();ctx.moveTo(OX,OY+i*cellSize);ctx.lineTo(OX+GS,OY+i*cellSize);ctx.stroke();
  }

  // Food
  ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font='24px serif';
  ctx.fillText('💩',foodX,foodY);

  // Snake body
  const segs=getSegs();
  for(let s=0;s<segs.length;s++){
    const x=segs[s].x,y=segs[s].y;
    const scale=1-s/segs.length*0.3;
    const r=cellSize*0.38*scale;
    ctx.shadowBlur=10;ctx.shadowColor='rgba(200,200,200,0.15)';
    ctx.fillStyle='#f5f5f5';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(200,200,200,0.3)';
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2;
      ctx.beginPath();ctx.arc(x+Math.cos(a)*r*0.6,y+Math.sin(a)*r*0.6,r*0.4,0,Math.PI*2);ctx.fill();
    }
    if(s===0){
      ctx.strokeStyle='rgba(100,100,100,0.2)';ctx.lineWidth=1.5;
      for(let i=0;i<4;i++){
        const a=i/4*Math.PI*2+0.3;
        ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
        ctx.lineTo(x+Math.cos(a)*(r+4),y+Math.sin(a)*(r+4));ctx.stroke();
      }
    }
    ctx.shadowBlur=0;
  }

  // Head
  const hx=headX,hy=headY,hr=cellSize*0.42;
  ctx.shadowBlur=15;ctx.shadowColor='rgba(200,200,200,0.2)';
  ctx.fillStyle='#f5f5f5';ctx.beginPath();ctx.arc(hx,hy,hr,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(200,200,200,0.25)';
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    ctx.beginPath();ctx.arc(hx+Math.cos(a)*hr*0.55,hy+Math.sin(a)*hr*0.55,hr*0.35,0,Math.PI*2);ctx.fill();
  }
  const eoF=0.7;
  ctx.fillStyle='#ddd';
  ctx.beginPath();ctx.ellipse(hx+dirX*hr*eoF-dirY*hr*eoF*0.5,hy+dirY*hr*eoF+dirX*hr*eoF*0.5,hr*0.4,hr*0.25,-0.3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(hx+dirX*hr*eoF+dirY*hr*eoF*0.5,hy+dirY*hr*eoF-dirX*hr*eoF*0.5,hr*0.4,hr*0.25,0.3,0,Math.PI*2);ctx.fill();
  const faceR=hr*0.55;
  ctx.fillStyle='#2a2a2a';
  ctx.beginPath();ctx.arc(hx+dirX*faceR*0.3,hy+dirY*faceR*0.3,faceR,0.2,Math.PI-0.2);ctx.fill();
  const eo=hr*0.3,es=hr*0.18;
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(hx+dirX*eo-dirY*eo,hy+dirY*eo+dirX*eo,es,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(hx+dirX*eo+dirY*eo,hy+dirY*eo-dirX*eo,es,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';
  ctx.beginPath();ctx.arc(hx+dirX*eo-dirY*eo+dirX*1.5,hy+dirY*eo+dirX*eo+dirY*1.5,es*0.5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(hx+dirX*eo+dirY*eo+dirX*1.5,hy+dirY*eo-dirX*eo+dirY*1.5,es*0.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e8a0a0';
  ctx.beginPath();ctx.arc(hx+dirX*hr*0.5+dirY*hr*0.15,hy+dirY*hr*0.5-dirX*hr*0.15,hr*0.12,0,Math.PI);ctx.fill();

  // Score (top center)
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(0,0,0,.4)';
  roundRect(ctx,OX+4,OY+4,100,28,8);ctx.fill();
  ctx.fillStyle='#e94560';ctx.font='bold 16px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText('💩 '+score,OX+14,OY+9);

  // Joystick (left)
  ctx.fillStyle='rgba(255,255,255,.06)';ctx.lineWidth=2;ctx.strokeStyle='rgba(255,255,255,.1)';
  ctx.beginPath();ctx.arc(JL_CX,JL_CY,J_R,0,Math.PI*2);ctx.fill();ctx.stroke();
  const jkX=joystickActive?joystickX:0,jkY=joystickActive?joystickY:0;
  ctx.fillStyle=joystickActive?'rgba(233,69,96,.7)':'rgba(233,69,96,.4)';
  ctx.beginPath();ctx.arc(JL_CX+jkX,JL_CY+jkY,J_KNOB_R,0,Math.PI*2);ctx.fill();

  // Speed button (right)
  ctx.fillStyle=boostSpeed?'rgba(83,215,105,.25)':'rgba(83,215,105,.1)';
  ctx.lineWidth=2;ctx.strokeStyle=boostSpeed?'rgba(83,215,105,.5)':'rgba(83,215,105,.2)';
  ctx.beginPath();ctx.arc(SR_CX,SR_CY,SR_R,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=boostSpeed?'rgba(83,215,105,.9)':'rgba(83,215,105,.4)';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='28px sans-serif';
  ctx.fillText('⚡',SR_CX,SR_CY+1);

  // Game over
  if(gameOver){
    ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(OX,OY,GS,GS);
    ctx.fillStyle='#e94560';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('游戏结束',SW/2,OY+GS/2-30);
    ctx.fillStyle='#fff';ctx.font='20px sans-serif';
    ctx.fillText('得分: '+score,SW/2,OY+GS/2+20);
    ctx.fillStyle='#888';ctx.font='16px sans-serif';
    ctx.fillText('点击重新开始',SW/2,OY+GS/2+60);
    const bx=SW/2-80,by=OY+GS/2+85,bw=160,bh=46;
    ctx.fillStyle='#e94560';roundRect(ctx,bx,by,bw,bh,10);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';
    ctx.fillText('重新开始',SW/2,by+bh/2);
  }
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// Touch
function dist(x1,y1,x2,y2){return Math.sqrt((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2))}

wx.onTouchStart(e=>{
  const t=e.touches[0];
  if(state==='menu'){
    const bx=SW/2-100,by=SH/2+60,bw=200,bh=56;
    if(t.x>=bx&&t.x<=bx+bw&&t.y>=by&&t.y<=by+bh){
      state='playing';init();
    }
    return;
  }
  if(gameOver){
    const bx=SW/2-80,by=OY+GS/2+85,bw=160,bh=46;
    if(t.x>=bx&&t.x<=bx+bw&&t.y>=by&&t.y<=by+bh){
      state='playing';init();
    }
    return;
  }
  for(let t of e.touches){
    if(dist(t.x,t.y,JL_CX,JL_CY)<J_R+20&&jTouchId<0){
      jTouchId=t.identifier;joystickActive=true;
      const dx=t.x-JL_CX,dy=t.y-JL_CY,d=Math.min(dist(t.x,t.y,JL_CX,JL_CY),J_R);
      const a=Math.atan2(dy,dx);
      joystickX=Math.cos(a)*d;joystickY=Math.sin(a)*d;
      if(d>15){if(Math.abs(dx)>Math.abs(dy))setDir(dx>0?cellSize:-cellSize,0);else setDir(0,dy>0?cellSize:-cellSize);}
    }else if(dist(t.x,t.y,SR_CX,SR_CY)<SR_R+20&&sTouchId<0){
      sTouchId=t.identifier;boostSpeed=true;
    }
  }
});

wx.onTouchMove(e=>{
  if(state!=='playing'||gameOver)return;
  for(let t of e.touches){
    if(t.identifier===jTouchId){
      const dx=t.x-JL_CX,dy=t.y-JL_CY,d=Math.min(dist(t.x,t.y,JL_CX,JL_CY),J_R);
      const a=Math.atan2(dy,dx);
      joystickX=Math.cos(a)*d;joystickY=Math.sin(a)*d;
      if(d>15){if(Math.abs(dx)>Math.abs(dy))setDir(dx>0?cellSize:-cellSize,0);else setDir(0,dy>0?cellSize:-cellSize);}
    }
  }
});

wx.onTouchEnd(e=>{
  for(let t of e.touches){
    if(t.identifier===jTouchId){jTouchId=-1;joystickActive=false;joystickX=0;joystickY=0;}
    if(t.identifier===sTouchId){sTouchId=-1;boostSpeed=false;}
  }
  if(e.touches.length===0){
    jTouchId=-1;joystickActive=false;joystickX=0;joystickY=0;
    sTouchId=-1;boostSpeed=false;
  }
});

function loop(){
  update();
  render();
  canvas.requestAnimationFrame(loop);
}

// Handle canvas resize
wx.onWindowResize && wx.onWindowResize(res=>{
  // Mini game handles this automatically
});

loop();
