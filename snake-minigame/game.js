const canvas=wx.createCanvas(),ctx=canvas.getContext('2d');
const sys=wx.getSystemInfoSync();
const SW=sys.windowWidth,SH=sys.windowHeight;
canvas.width=SW;canvas.height=SH;

const CELL=Math.max(24,Math.floor(Math.min(SW,SH)/10));
const VIS_COLS=Math.ceil(SW/CELL)+2;
const VIS_ROWS=Math.ceil(SH/CELL)+2;
const WORLD_COLS=VIS_COLS*4;
const WORLD_ROWS=VIS_ROWS*4;
const WORLD_W=WORLD_COLS*CELL;
const WORLD_H=WORLD_ROWS*CELL;

let state='menu',score=0,highScore=0;
let headX,headY,dirX,dirY,targetDirX,targetDirY,trail,segCount,boostSpeed,gameOver;
let foods=[],aiSnakes=[],foodTimer=0;
let camX=0,camY=0;
let jTouchId=-1,sTouchId=-1,joystickX=0,joystickY=0,joystickActive=false;
let deathReason='',shieldTimer=0,magnetTimer=0,deathBurst=0,growPulse=0,speedBoostTimer=0;

const J_R=70,J_KNOB_R=24;
const JL_CX=105+CELL/2,JL_CY=SH-93;
const SR_CX=SW-92,SR_CY=SH-83,SR_R=55;

try{highScore=parseInt(wx.getStorageSync('snakeHighScore')||'0')}catch(e){}

function init(){
  headX=WORLD_W/2;headY=WORLD_H/2;
  dirX=1;dirY=0;targetDirX=1;targetDirY=0;
  trail=[];segCount=5;score=0;boostSpeed=false;gameOver=false;
  camX=headX-SW/2;camY=headY-SH/2;
  jTouchId=-1;sTouchId=-1;joystickActive=false;
  foods=[];aiSnakes=[];foodTimer=0;
  deathReason='';shieldTimer=0;magnetTimer=0;deathBurst=0;growPulse=0;speedBoostTimer=0;
  spawnFood(15);
  for(var i=0;i<5;i++)aiSnakes.push(createAI());
}

function spawnFood(count){
  for(var n=0;n<(count||1);n++){
    var valid=false,fx,fy;
    for(var att=0;att<50;att++){
      fx=Math.floor(Math.random()*WORLD_COLS)*CELL+CELL/2;
      fy=Math.floor(Math.random()*WORLD_ROWS)*CELL+CELL/2;
      valid=true;
      for(var i=0;i<trail.length;i++){
        var dx=trail[i].x-fx,dy=trail[i].y-fy;
        if(dx*dx+dy*dy<CELL*CELL){valid=false;break;}
      }
      if(valid){
        for(var i=0;i<foods.length;i++){
          var dx=foods[i].x-fx,dy=foods[i].y-fy;
          if(dx*dx+dy*dy<CELL*CELL){valid=false;break;}
        }
      }
      if(valid)break;
    }
    if(valid){
      var r=Math.random();
      var type=r<0.02?'shield':r<0.04?'magnet':r<0.07?'speed':r<0.14?'gold':'normal';
      foods.push({x:fx,y:fy,type:type});
    }
  }
}

var aiNames=['小明','小红','小刚','小丽','阿强','阿花','大壮','小美','铁柱','翠花'];
function createAI(){
  var x,y,valid;
  for(var att=0;att<30;att++){
    x=Math.floor(Math.random()*(WORLD_COLS-4)+2)*CELL+CELL/2;
    y=Math.floor(Math.random()*(WORLD_ROWS-4)+2)*CELL+CELL/2;
    valid=true;
    if((x-headX)*(x-headX)+(y-headY)*(y-headY)<50*CELL*CELL)valid=false;
    if(valid)break;
  }
  var dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  var d=dirs[Math.floor(Math.random()*4)];
  var colors=['#4ecdc4','#45b7d1','#96ceb4','#dda0dd','#ff6b6b'];
  return {
    headX:x,headY:y,dirX:d[0],dirY:d[1],targetDirX:d[0],targetDirY:d[1],
    trail:[],segCount:4+Math.floor(Math.random()*3),alive:true,
    color:colors[Math.floor(Math.random()*colors.length)],timer:0,
    name:aiNames[Math.floor(Math.random()*aiNames.length)]
  };
}

function dieAI(ai){
  ai.alive=false;
  var step=Math.max(5,Math.floor(ai.trail.length/4));
  for(var i=0;i<ai.trail.length;i+=step){
    if(foods.length<80)foods.push({x:ai.trail[i].x,y:ai.trail[i].y});
  }
}

function updateAI(ai){
  if(!ai.alive){
    ai.timer++;
    if(ai.timer>300){
      var n=createAI();for(var k in n)ai[k]=n[k];
    }
    return;
  }
  ai.dirX=ai.targetDirX;ai.dirY=ai.targetDirY;
  var spd=CELL*0.045;
  ai.headX+=ai.dirX*spd;ai.headY+=ai.dirY*spd;
  ai.trail.push({x:ai.headX,y:ai.headY});
  if(ai.trail.length>ai.segCount*25+25)ai.trail.shift();
  if(ai.headX<0||ai.headX>WORLD_W||ai.headY<0||ai.headY>WORLD_H){dieAI(ai);return;}
  ai.timer++;
  if(ai.timer>15){
    ai.timer=0;
    var near=null,minD=Infinity;
    for(var i=0;i<foods.length;i++){
      var d=(foods[i].x-ai.headX)*(foods[i].x-ai.headX)+(foods[i].y-ai.headY)*(foods[i].y-ai.headY);
      if(d<minD){minD=d;near=foods[i];}
    }
    var dx=near?near.x-ai.headX:1,dy=near?near.y-ai.headY:1;
    var margin=CELL*4;
    if(ai.headX<margin)dx=Math.max(dx,1);
    if(ai.headX>WORLD_W-margin)dx=Math.min(dx,-1);
    if(ai.headY<margin)dy=Math.max(dy,1);
    if(ai.headY>WORLD_H-margin)dy=Math.min(dy,-1);
    var pdx=headX-ai.headX,pdy=headY-ai.headY;
    if(pdx*pdx+pdy*pdy<CELL*CELL*12){dx-=pdx*0.5;dy-=pdy*0.5;}
    if(Math.abs(dx)>Math.abs(dy)){ai.targetDirX=dx>0?1:-1;ai.targetDirY=0;}
    else{ai.targetDirX=0;ai.targetDirY=dy>0?1:-1;}
    if(ai.targetDirX===-ai.dirX&&ai.targetDirY===-ai.dirY){
      ai.targetDirX=ai.dirX;ai.targetDirY=ai.dirY;
    }
  }
  for(var i=foods.length-1;i>=0;i--){
    var f=foods[i];
    if((f.x-ai.headX)*(f.x-ai.headX)+(f.y-ai.headY)*(f.y-ai.headY)<CELL*CELL*0.2){
      foods.splice(i,1);ai.segCount++;
    }
  }
  var segs=getSegs();
  for(var s=8;s<segs.length;s++){
    if((ai.headX-segs[s].x)*(ai.headX-segs[s].x)+(ai.headY-segs[s].y)*(ai.headY-segs[s].y)<CELL*CELL*0.2){dieAI(ai);return;}
  }
  if((ai.headX-headX)*(ai.headX-headX)+(ai.headY-headY)*(ai.headY-headY)<CELL*CELL*0.2){dieAI(ai);return;}
  for(var j=0;j<aiSnakes.length;j++){
    var other=aiSnakes[j];
    if(other===ai||!other.alive)continue;
    for(var s=8;s<other.trail.length;s++){
      if((ai.headX-other.trail[s].x)*(ai.headX-other.trail[s].x)+(ai.headY-other.trail[s].y)*(ai.headY-other.trail[s].y)<CELL*CELL*0.2){dieAI(ai);return;}
    }
  }
}

function setDir(x,y){
  if(x===-dirX&&y===-dirY)return;
  targetDirX=x;targetDirY=y;
}

function getSegs(){
  var segs=[],step=Math.max(4,Math.floor(CELL*0.22));
  for(var i=trail.length-1;i>=0;i-=step){
    segs.push(trail[i]);
    if(segs.length>=segCount)break;
  }
  return segs;
}

function update(){
  if(gameOver||state!=='playing')return;
  dirX=targetDirX;dirY=targetDirY;
  var spd=speedBoostTimer>0?CELL*0.13:(boostSpeed?CELL*0.16:CELL*0.06);
  headX+=dirX*spd;headY+=dirY*spd;
  trail.push({x:headX,y:headY});
  if(trail.length>segCount*25+25)trail.shift();
  if(headX<0||headX>WORLD_W||headY<0||headY>WORLD_H){endGame('撞墙了');return;}
  var segs=getSegs();
  for(var s=8;s<segs.length;s++){
    var dx=headX-segs[s].x,dy=headY-segs[s].y;
    if(dx*dx+dy*dy<CELL*CELL*0.2){endGame('撞到自己了');return;}
  }
  // Eat food with special effects
  for(var i=foods.length-1;i>=0;i--){
    var f=foods[i];
    if((f.x-headX)*(f.x-headX)+(f.y-headY)*(f.y-headY)<CELL*CELL*0.2){
      foods.splice(i,1);
      if(f.type==='gold'){score+=3;segCount+=3;growPulse=20;}
      else if(f.type==='speed'){score++;segCount++;growPulse=10;speedBoostTimer=300;}
      else if(f.type==='shield'){shieldTimer=300;}
      else if(f.type==='magnet'){magnetTimer=180;}
      else{score++;segCount++;growPulse=10;}
      try{wx.vibrateShort({type:'light'})}catch(e){}
    }
  }
  // Timers
  if(shieldTimer>0)shieldTimer--;
  if(magnetTimer>0)magnetTimer--;
  if(speedBoostTimer>0)speedBoostTimer--;
  if(growPulse>0)growPulse--;
  if(deathBurst>0)deathBurst--;
  // Magnet effect
  if(magnetTimer>0){
    for(var i=0;i<foods.length;i++){
      var f=foods[i];
      var dx=f.x-headX,dy=f.y-headY;
      var d=Math.sqrt(dx*dx+dy*dy);
      if(d<CELL*6&&d>CELL*0.5){
        var pull=0.1;f.x+=dx/d*pull;f.y+=dy/d*pull;
      }
    }
  }
  // AI collision
  for(var i=0;i<aiSnakes.length;i++){
    var ai=aiSnakes[i];
    if(!ai.alive)continue;
    if(shieldTimer<=0){
      for(var s=8;s<ai.trail.length;s++){
        if((headX-ai.trail[s].x)*(headX-ai.trail[s].x)+(headY-ai.trail[s].y)*(headY-ai.trail[s].y)<CELL*CELL*0.2){endGame('被AI撞了');return;}
      }
    }
    if((headX-ai.headX)*(headX-ai.headX)+(headY-ai.headY)*(headY-ai.headY)<CELL*CELL*0.2)dieAI(ai);
  }
  for(var i=0;i<aiSnakes.length;i++)updateAI(aiSnakes[i]);
  // Spawn food
  foodTimer++;
  if(foodTimer>=300){foodTimer=0;if(foods.length<80)spawnFood(10);}
  while(foods.length>100)foods.pop();
  // Scale AI with score
  var targetAI=5+Math.floor(score/10);
  while(aiSnakes.length<targetAI&&aiSnakes.length<12)aiSnakes.push(createAI());
  // Camera
  camX=headX-SW/2;camY=headY-SH/2;
  camX=Math.max(0,Math.min(WORLD_W-SW,camX));
  camY=Math.max(0,Math.min(WORLD_H-SH,camY));
}

function endGame(reason){
  gameOver=true;boostSpeed=false;
  jTouchId=-1;sTouchId=-1;joystickActive=false;
  deathReason=reason||'';deathBurst=30;
  try{wx.vibrateShort({type:'medium'})}catch(e){}
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

  // Background grid (full screen, camera offset)
  ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,SW,SH);
  var startCol=Math.floor(camX/CELL),endCol=Math.ceil((camX+SW)/CELL);
  var startRow=Math.floor(camY/CELL),endRow=Math.ceil((camY+SH)/CELL);
  startCol=Math.max(0,startCol);endCol=Math.min(WORLD_COLS,endCol);
  startRow=Math.max(0,startRow);endRow=Math.min(WORLD_ROWS,endRow);
  ctx.strokeStyle='rgba(0,0,0,0.06)';ctx.lineWidth=1;
  for(var c=startCol;c<endCol;c++){
    var gx=c*CELL-camX;
    ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,SH);ctx.stroke();
  }
  for(var r=startRow;r<endRow;r++){
    var gy=r*CELL-camY;
    ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(SW,gy);ctx.stroke();
  }

  // Gray walls at world boundaries
  ctx.shadowBlur=0;
  var wt=CELL;
  ctx.fillStyle='#999';
  ctx.strokeStyle='#777';ctx.lineWidth=2;
  if(camX<wt){
    ctx.fillRect(0-camX,0,wt,SH);
    ctx.strokeRect(0-camX,0,wt,SH);
  }
  if(camX+SW>WORLD_W-wt){
    ctx.fillRect(WORLD_W-camX-wt,0,wt,SH);
    ctx.strokeRect(WORLD_W-camX-wt,0,wt,SH);
  }
  if(camY<wt){
    ctx.fillRect(0,0-camY,SW,wt);
    ctx.strokeRect(0,0-camY,SW,wt);
  }
  if(camY+SH>WORLD_H-wt){
    ctx.fillRect(0,WORLD_H-camY-wt,SW,wt);
    ctx.strokeRect(0,WORLD_H-camY-wt,SW,wt);
  }

  // Foods
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(var i=0;i<foods.length;i++){
    var fx=foods[i].x-camX,fy=foods[i].y-camY;
    if(fx>-CELL&&fx<SW+CELL&&fy>-CELL&&fy<SH+CELL){
      if(foods[i].type==='gold'){
        ctx.shadowBlur=12;ctx.shadowColor='rgba(255,215,0,0.6)';
        ctx.fillStyle='rgba(255,215,0,0.9)';ctx.font='28px serif';ctx.fillText('🌟',fx,fy);
      }else if(foods[i].type==='speed'){
        ctx.shadowBlur=12;ctx.shadowColor='rgba(83,215,255,0.6)';
        ctx.fillStyle='rgba(83,215,255,0.9)';ctx.font='28px serif';ctx.fillText('⚡',fx,fy);
      }else if(foods[i].type==='shield'){
        ctx.shadowBlur=12;ctx.shadowColor='rgba(83,215,255,0.6)';
        ctx.fillStyle='rgba(83,215,255,0.9)';ctx.font='32px serif';ctx.fillText('🛡️',fx,fy);
      }else if(foods[i].type==='magnet'){
        ctx.shadowBlur=12;ctx.shadowColor='rgba(255,215,0,0.6)';
        ctx.fillStyle='rgba(255,215,0,0.9)';ctx.font='32px serif';ctx.fillText('🧲',fx,fy);
      }else{
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font='24px serif';ctx.fillText('💩',fx,fy);
      }
    }
  }
  ctx.shadowBlur=0;

  // AI snakes (same style as player)
  ctx.shadowBlur=0;
  for(var i=0;i<aiSnakes.length;i++){
    var ai=aiSnakes[i];if(!ai.alive)continue;
    var aiSegs=[],step=Math.max(4,Math.floor(CELL*0.22));
    for(var j=ai.trail.length-1;j>=0;j-=step){
      aiSegs.push(ai.trail[j]);
      if(aiSegs.length>=ai.segCount)break;
    }
    for(var s=0;s<aiSegs.length;s++){
      var sx=aiSegs[s].x-camX,sy=aiSegs[s].y-camY;
      if(sx<-CELL||sx>SW+CELL||sy<-CELL||sy>SH+CELL)continue;
      var scale=1-s/aiSegs.length*0.3;
      var r=CELL*0.38*scale;
      ctx.fillStyle=ai.color;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.08)';
      for(var k=0;k<6;k++){
        var a=k/6*Math.PI*2;
        ctx.beginPath();ctx.arc(sx+Math.cos(a)*r*0.6,sy+Math.sin(a)*r*0.6,r*0.4,0,Math.PI*2);ctx.fill();
      }
    }
    var aix=ai.headX-camX,aiy=ai.headY-camY;
    if(aix>-CELL&&aix<SW+CELL&&aiy>-CELL&&aiy<SH+CELL){
      var hr=CELL*0.42;
      ctx.fillStyle=ai.color;ctx.beginPath();ctx.arc(aix,aiy,hr,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.08)';
      for(var k=0;k<8;k++){
        var a=k/8*Math.PI*2;
        ctx.beginPath();ctx.arc(aix+Math.cos(a)*hr*0.55,aiy+Math.sin(a)*hr*0.55,hr*0.35,0,Math.PI*2);ctx.fill();
      }
      var eo=hr*0.3,es=hr*0.18;
      ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(aix+ai.dirX*eo-ai.dirY*eo,aiy+ai.dirY*eo+ai.dirX*eo,es,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(aix+ai.dirX*eo+ai.dirY*eo,aiy+ai.dirY*eo-ai.dirX*eo,es,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000';
      ctx.beginPath();ctx.arc(aix+ai.dirX*eo-ai.dirY*eo+ai.dirX*1.5,aiy+ai.dirY*eo+ai.dirX*eo+ai.dirY*1.5,es*0.5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(aix+ai.dirX*eo+ai.dirY*eo+ai.dirX*1.5,aiy+ai.dirY*eo-ai.dirX*eo+ai.dirY*1.5,es*0.5,0,Math.PI*2);ctx.fill();
    }
  }

  // AI name tags
  ctx.textAlign='center';ctx.textBaseline='bottom';ctx.font='10px sans-serif';
  for(var i=0;i<aiSnakes.length;i++){
    var ai=aiSnakes[i];if(!ai.alive)continue;
    var aix=ai.headX-camX,aiy=ai.headY-camY;
    if(aix>-CELL&&aix<SW+CELL&&aiy>-CELL&&aiy<SH+CELL){
      ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fillText(ai.name,aix,aiy-CELL*0.55);
    }
  }

  // Snake body
  var segs=getSegs();
  for(var s=0;s<segs.length;s++){
    var sx=segs[s].x-camX,sy=segs[s].y-camY;
    if(sx<-CELL||sx>SW+CELL||sy<-CELL||sy>SH+CELL)continue;
    var scale=1-s/segs.length*0.3;
    var r=CELL*0.38*scale;
    ctx.shadowBlur=0;
    ctx.fillStyle='#555';ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.1)';
    for(var k=0;k<6;k++){
      var a=k/6*Math.PI*2;
      ctx.beginPath();ctx.arc(sx+Math.cos(a)*r*0.6,sy+Math.sin(a)*r*0.6,r*0.4,0,Math.PI*2);ctx.fill();
    }
    if(s===0){
      ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1;
      for(var k=0;k<4;k++){
        var a=k/4*Math.PI*2+0.3;
        ctx.beginPath();ctx.moveTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r);
        ctx.lineTo(sx+Math.cos(a)*(r+3),sy+Math.sin(a)*(r+3));ctx.stroke();
      }
    }
    ctx.shadowBlur=0;
  }

  // Growth pulse
  if(growPulse>0&&segs.length>0){
    var tail=segs[segs.length-1];
    var tx=tail.x-camX,ty=tail.y-camY;
    if(tx>-CELL&&tx<SW+CELL&&ty>-CELL&&ty<SH+CELL){
      ctx.shadowBlur=15;ctx.shadowColor='rgba(233,69,96,0.6)';
      ctx.fillStyle='rgba(233,69,96,'+(growPulse/20*0.3)+')';
      ctx.beginPath();ctx.arc(tx,ty,CELL*0.5*(1+growPulse/20),0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    }
  }

  // Boost wind trail
  if(boostSpeed){
    ctx.shadowBlur=0;
    for(var s=0;s<segs.length;s++){
      var sx=segs[s].x-camX,sy=segs[s].y-camY;
      if(sx<-CELL||sx>SW+CELL||sy<-CELL||sy>SH+CELL)continue;
      var a=0.3-s/segs.length*0.25;
      ctx.fillStyle='rgba(180,210,255,'+a+')';
      var r=CELL*0.12;
      ctx.beginPath();ctx.arc(sx-dirX*4-dirY*r,sy-dirY*4+dirX*r,r,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(sx-dirX*4+dirY*r,sy-dirY*4-dirX*r,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(200,230,255,'+(a*0.6)+')';
      ctx.beginPath();ctx.arc(sx-dirX*8,sy-dirY*8,r*0.7,0,Math.PI*2);ctx.fill();
    }
  }

  // Shield visual
  if(shieldTimer>0){
    ctx.strokeStyle='rgba(83,215,255,'+(0.3+0.2*Math.sin(Date.now()*0.01))+')';
    ctx.lineWidth=2;ctx.shadowBlur=10;ctx.shadowColor='rgba(83,215,255,0.5)';
    ctx.beginPath();ctx.arc(headX-camX,headY-camY,CELL*0.65,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;
  }

  // Head
  var hx=headX-camX,hy=headY-camY;
  var hr=CELL*0.42;
  ctx.shadowBlur=0;
  ctx.fillStyle='#444';ctx.beginPath();ctx.arc(hx,hy,hr,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(0,0,0,0.1)';
  for(var k=0;k<8;k++){
    var a=k/8*Math.PI*2;
    ctx.beginPath();ctx.arc(hx+Math.cos(a)*hr*0.55,hy+Math.sin(a)*hr*0.55,hr*0.35,0,Math.PI*2);ctx.fill();
  }
  var eoF=0.7;
  ctx.fillStyle='#888';
  ctx.save();ctx.translate(hx+dirX*hr*eoF-dirY*hr*eoF*0.5,hy+dirY*hr*eoF+dirX*hr*eoF*0.5);ctx.rotate(-0.3);ctx.scale(hr*0.4,hr*0.25);ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(hx+dirX*hr*eoF+dirY*hr*eoF*0.5,hy+dirY*hr*eoF-dirX*hr*eoF*0.5);ctx.rotate(0.3);ctx.scale(hr*0.4,hr*0.25);ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
  var faceR=hr*0.55;
  ctx.fillStyle='#333';
  ctx.beginPath();ctx.arc(hx+dirX*faceR*0.3,hy+dirY*faceR*0.3,faceR,0.2,Math.PI-0.2);ctx.fill();
  var eo=hr*0.3,es=hr*0.18;
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(hx+dirX*eo-dirY*eo,hy+dirY*eo+dirX*eo,es,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(hx+dirX*eo+dirY*eo,hy+dirY*eo-dirX*eo,es,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#000';
  ctx.beginPath();ctx.arc(hx+dirX*eo-dirY*eo+dirX*1.5,hy+dirY*eo+dirX*eo+dirY*1.5,es*0.5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(hx+dirX*eo+dirY*eo+dirX*1.5,hy+dirY*eo-dirX*eo+dirY*1.5,es*0.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#c0392b';
  ctx.beginPath();ctx.arc(hx+dirX*hr*0.5+dirY*hr*0.15,hy+dirY*hr*0.5-dirX*hr*0.15,hr*0.12,0,Math.PI);ctx.fill();

  // Score (screen-fixed top left)
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(0,0,0,.4)';
  roundRect(ctx,6+CELL/4,6+CELL,100,28,8);ctx.fill();
  ctx.fillStyle='#e94560';ctx.font='bold 16px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText('💩 '+score+(shieldTimer>0?' 🛡️':'')+(magnetTimer>0?' 🧲':'')+(speedBoostTimer>0?' ⚡':''),14+CELL/4,11+CELL);

  // Mini-map (top-right circle, player-centered)
  var mmPad=8,mmR=55;
  var mmCX=SW-mmPad-mmR-CELL,mmCY=mmPad+mmR+CELL;
  var mmScale=mmR*2/Math.max(WORLD_W,WORLD_H);
  var mmOx=mmCX-headX*mmScale,mmOy=mmCY-headY*mmScale;
  ctx.save();
  ctx.beginPath();ctx.arc(mmCX,mmCY,mmR,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(mmCX-mmR,mmCY-mmR,mmR*2,mmR*2);
  ctx.strokeStyle='rgba(233,69,96,0.5)';ctx.lineWidth=1;
  ctx.strokeRect(camX*mmScale+mmOx,camY*mmScale+mmOy,SW*mmScale,SH*mmScale);
  ctx.fillStyle='#e94560';ctx.beginPath();ctx.arc(mmCX,mmCY,3,0,Math.PI*2);ctx.fill();
  for(var i=0;i<aiSnakes.length;i++){
    var ai=aiSnakes[i];if(!ai.alive)continue;
    for(var s=0;s<ai.trail.length;s+=Math.max(1,Math.floor(ai.trail.length/6))){
      var sc=1-s/ai.trail.length;
      ctx.fillStyle=ai.color;ctx.globalAlpha=0.4+0.6*sc;
      ctx.beginPath();ctx.arc(ai.trail[s].x*mmScale+mmOx,ai.trail[s].y*mmScale+mmOy,1+sc,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.fillStyle=ai.color;ctx.beginPath();ctx.arc(ai.headX*mmScale+mmOx,ai.headY*mmScale+mmOy,2.5,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='#ffdd44';
  for(var i=0;i<foods.length;i++){
    ctx.beginPath();ctx.arc(foods[i].x*mmScale+mmOx,foods[i].y*mmScale+mmOy,1.5,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(mmCX,mmCY,mmR,0,Math.PI*2);ctx.stroke();

  // Joystick (screen-fixed)
  ctx.fillStyle='rgba(255,255,255,.06)';ctx.lineWidth=2;ctx.strokeStyle='rgba(255,255,255,.1)';
  ctx.beginPath();ctx.arc(JL_CX,JL_CY,J_R,0,Math.PI*2);ctx.fill();ctx.stroke();
  var jkX=joystickActive?joystickX:0,jkY=joystickActive?joystickY:0;
  ctx.fillStyle=joystickActive?'rgba(233,69,96,.7)':'rgba(233,69,96,.4)';
  ctx.beginPath();ctx.arc(JL_CX+jkX,JL_CY+jkY,J_KNOB_R,0,Math.PI*2);ctx.fill();

  // Speed button (screen-fixed)
  ctx.fillStyle=boostSpeed?'rgba(83,215,105,.25)':'rgba(83,215,105,.1)';
  ctx.lineWidth=2;ctx.strokeStyle=boostSpeed?'rgba(83,215,105,.5)':'rgba(83,215,105,.2)';
  ctx.beginPath();ctx.arc(SR_CX,SR_CY,SR_R,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=boostSpeed?'rgba(83,215,105,.9)':'rgba(83,215,105,.4)';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='26px sans-serif';
  ctx.fillText('⚡',SR_CX,SR_CY+1);

  // Death burst
  if(deathBurst>0){
    ctx.shadowBlur=20;ctx.shadowColor='#e94560';
    var da=deathBurst/30;
    ctx.strokeStyle='rgba(233,69,96,'+(da*0.5)+')';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(hx,hy,CELL*(1-da)*0.5+CELL*da*2,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,'+(da*0.3)+')';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(hx,hy,CELL*(1-da)*0.5+CELL*da*1.5,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;
  }

  // Game over (screen-fixed)
  if(gameOver){
    ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,SW,SH);
    ctx.fillStyle='#e94560';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('游戏结束',SW/2,SH/2-40);
    if(deathReason){
      ctx.fillStyle='#ff6b6b';ctx.font='18px sans-serif';
      ctx.fillText(deathReason,SW/2,SH/2+5);
    }
    ctx.fillStyle='#fff';ctx.font='20px sans-serif';
    ctx.fillText('得分: '+score,SW/2,SH/2+35);
    ctx.fillStyle='#888';ctx.font='16px sans-serif';
    ctx.fillText('点击重新开始',SW/2,SH/2+70);
    var bx=SW/2-80,by=SH/2+95,bw=160,bh=46;
    ctx.fillStyle='#e94560';roundRect(ctx,bx,by,bw,bh,10);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';
    ctx.fillText('重新开始',SW/2,by+bh/2);
  }
}

function ellipse(ctx,cx,cy,rx,ry,rot){
  ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(rx,ry);
  ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.restore();
  ctx.fill();
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

wx.onTouchStart(function(e){
  if(!e)return;
  var touches=e.touches||e.changedTouches||[];
  if(!touches.length)return;
  var t=touches[0];
  if(state==='menu'){
    state='playing';init();
    return;
  }
  if(gameOver){
    state='playing';init();
    return;
  }
  for(var i=0;i<touches.length;i++){
    var touch=touches[i];
    if(dist(touch.x||touch.clientX||0,touch.y||touch.clientY||0,JL_CX,JL_CY)<J_R+20&&jTouchId<0){
      jTouchId=touch.identifier;
      joystickActive=true;
      var dx=(touch.x||touch.clientX||0)-JL_CX,dy=(touch.y||touch.clientY||0)-JL_CY;
      var d=Math.min(Math.sqrt(dx*dx+dy*dy),J_R);
      var a=Math.atan2(dy,dx);
      joystickX=Math.cos(a)*d;joystickY=Math.sin(a)*d;
      if(d>15){if(Math.abs(dx)>Math.abs(dy))setDir(dx>0?1:-1,0);else setDir(0,dy>0?1:-1);}
    }else if(dist(touch.x||touch.clientX||0,touch.y||touch.clientY||0,SR_CX,SR_CY)<SR_R+20&&sTouchId<0){
      sTouchId=touch.identifier;boostSpeed=true;
    }
  }
});

wx.onTouchMove(function(e){
  if(state!=='playing'||gameOver)return;
  if(!e)return;
  var touches=e.touches||e.changedTouches||[];
  for(var i=0;i<touches.length;i++){
    var t=touches[i];
    if(t.identifier===jTouchId){
      var dx=(t.x||t.clientX||0)-JL_CX,dy=(t.y||t.clientY||0)-JL_CY;
      var d=Math.min(Math.sqrt(dx*dx+dy*dy),J_R);
      var a=Math.atan2(dy,dx);
      joystickX=Math.cos(a)*d;joystickY=Math.sin(a)*d;
      if(d>15){if(Math.abs(dx)>Math.abs(dy))setDir(dx>0?1:-1,0);else setDir(0,dy>0?1:-1);}
    }
  }
});

wx.onTouchEnd(function(e){
  if(!e)return;
  var touches=e.changedTouches||e.touches||[];
  for(var i=0;i<touches.length;i++){
    var t=touches[i];
    if(t.identifier===jTouchId){jTouchId=-1;joystickActive=false;joystickX=0;joystickY=0;}
    if(t.identifier===sTouchId){sTouchId=-1;boostSpeed=false;}
  }
  if(!e.touches||e.touches.length===0){
    jTouchId=-1;joystickActive=false;joystickX=0;joystickY=0;
    sTouchId=-1;boostSpeed=false;
  }
});

function loop(){
  update();
  render();
  requestAnimationFrame(loop);
}

// Handle canvas resize
wx.onWindowResize && wx.onWindowResize(res=>{
  // Mini game handles this automatically
});

loop();
