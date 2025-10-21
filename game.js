// 茶马古道 · 驮队经理 — 像素版（增强版 ES5 兼容）
// 说明：优化 UI、补充事件系统、完善音频与文本体验，适配单 Canvas 与微信小游戏 API

var sys = wx.getSystemInfoSync();
var W = sys.windowWidth, H = sys.windowHeight;
var canvas = wx.createCanvas();
var ctx = canvas.getContext('2d');

// -------- Audio --------
function makeAudio(src){ var a = wx.createInnerAudioContext(); a.src = src; a.onError(function(){}); return a; }
var sfx = {
  click: makeAudio('assets/click.wav'),
  bad:   makeAudio('assets/bad.wav'),
  buy:   makeAudio('assets/buy.wav'),
  sell:  makeAudio('assets/sell.wav'),
  move:  makeAudio('assets/move.wav'),
  flute: makeAudio('assets/flute.wav'),
  bgm: (function(){ var a=makeAudio('assets/bgm.wav'); a.loop=true; a.volume=0.18; a.play(); return a; })()
};
var muted=false;
function play(name){ if(muted && name!=='bgm'){ return; } try{ sfx[name].stop(); sfx[name].play(); }catch(e){} }
function applyMute(){ try{ sfx.bgm.volume = muted ? 0 : 0.18; }catch(e){} }
function toggleMute(){
  muted=!muted;
  if(!muted){ try{ sfx.bgm.play(); }catch(e){} }
  applyMute();
  save();
  render();
}

// -------- Images --------
var img = {};
var toLoad = [
  ['leader','assets/img/leader.png'],
  ['mule','assets/img/mule.png'],
  ['bandit','assets/img/bandit.png'],
  ['town','assets/img/town.png'],
  ['tile_mountain','assets/img/tile_mountain.png'],
  ['tile_river','assets/img/tile_river.png'],
  ['tile_grass','assets/img/tile_grass.png']
];
var loaded = 0;
for (var _i=0; _i<toLoad.length; _i++){
  (function(k,src){
    var im = wx.createImage();
    im.onload = function(){ img[k]=im; loaded++; };
    im.src = src;
  })(toLoad[_i][0], toLoad[_i][1]);
}

// -------- Data (towns & roads) --------
var towns = [
  {id:'puer', name:'普洱', x:80,  y:H-220, base:60, desc:'云南南部茶马古道起点，茶香盈路。'},
  {id:'dali', name:'大理', x:160, y:H-360, base:80, desc:'苍山洱海之间的贸易枢纽。'},
  {id:'lijiang', name:'丽江', x:240, y:H-460, base:90, desc:'纳西古城，旅人云集。'},
  {id:'xianggelila', name:'香格里拉', x:330, y:H-520, base:110, desc:'云端之城，气候多变需谨慎补给。'},
  {id:'deqin', name:'德钦', x:400, y:H-560, base:120, desc:'梅里雪山脚下，路险但利润可观。'},
  {id:'lasa', name:'拉萨', x:470, y:H-590, base:160, desc:'圣城终点，目标是凯旋而归。'}
];
var roads = [
  ['puer','dali', 3, 0.12],
  ['dali','lijiang', 2, 0.10],
  ['lijiang','xianggelila', 3, 0.15],
  ['xianggelila','deqin', 2, 0.12],
  ['deqin','lasa', 5, 0.18],
  ['lijiang','deqin', 4, 0.22]
];
var tips = [
  '合理安排体力，长途前做好补给。',
  '市场价格浮动，请留意近期行情。',
  '声望越高，路上相助越多。',
  '高风险道路或许收益更大，权衡再行。',
  '充分利用休整，体力与补给都重要。'
];

// -------- State --------
var scene='menu', previousScene='menu';
var day=1, daysLimit=30, stamina=10, maxStamina=12, horses=5, capacity=50, tea=10, gold=200, food=15, rep=0;
var locationId='puer', marketMode='buy', marketQty=1, priceNow=80;
var log=['普洱启程：30日内抵达拉萨并盈利'];
var buttons=[];
var currentEvent=null;
var priceHistory={};

// -------- Persistence --------
function pushLog(text){
  log.push(text);
  if(log.length>60){ log.shift(); }
}
function rememberPrice(id, price){
  if(!priceHistory[id]){ priceHistory[id]=[]; }
  var arr=priceHistory[id];
  arr.push(price);
  if(arr.length>8){ arr.shift(); }
}
function save(){
  try{
    wx.setStorageSync('thr_state_px',{
      day:day,daysLimit:daysLimit,stamina:stamina,maxStamina:maxStamina,horses:horses,
      capacity:capacity,tea:tea,gold:gold,food:food,rep:rep,locationId:locationId,
      marketMode:marketMode,marketQty:marketQty,priceNow:priceNow,log:log.slice(-40),
      muted:muted,priceHistory:priceHistory
    });
  }catch(e){}
}
function load(){
  try{
    var s=wx.getStorageSync('thr_state_px');
    if(s){
      day=s.day||day; daysLimit=s.daysLimit||daysLimit; stamina=s.stamina||stamina;
      maxStamina=s.maxStamina||maxStamina; horses=s.horses||horses; capacity=s.capacity||capacity;
      tea=s.tea||tea; gold=s.gold||gold; food=s.food||food; rep=s.rep||rep;
      locationId=s.locationId||locationId; marketMode=s.marketMode||marketMode;
      marketQty=s.marketQty||marketQty; priceNow=s.priceNow||priceNow;
      if(s.log){ log=s.log; }
      if(typeof s.muted!=='undefined'){ muted=!!s.muted; applyMute(); }
      if(s.priceHistory){ priceHistory=s.priceHistory; }
    }
  }catch(e){}
}
function reset(){
  day=1; stamina=10; horses=5; capacity=50; tea=10; gold=200; food=15; rep=0;
  locationId='puer'; marketMode='buy'; marketQty=1; log=['普洱启程：30日内抵达拉萨并盈利'];
  priceHistory={};
  priceNow=priceAt(locationId);
  save();
}

// -------- Helpers --------
function getTown(id){ for(var i=0;i<towns.length;i++){ if(towns[i].id===id){ return towns[i]; } } return null; }
function neighbors(id){
  var out=[], i, r;
  for(i=0;i<roads.length;i++){
    r=roads[i];
    if(r[0]===id){ out.push({to:r[1], days:r[2], risk:r[3]}); }
    else if(r[1]===id){ out.push({to:r[0], days:r[2], risk:r[3]}); }
  }
  return out;
}
function priceAt(id){
  var t=getTown(id);
  var demand=(t.base||80)+Math.floor(Math.random()*20)-10;
  var value=Math.max(20, demand + Math.floor(rep*0.5));
  rememberPrice(id,value);
  return value;
}
function clamp(v,min,max){ if(v<min){ return min; } if(v>max){ return max; } return v; }
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fill(); }
function btn(x,y,w,h,label){ ctx.fillStyle='rgba(255,255,255,0.95)'; rr(x,y,w,h,12); ctx.fillStyle='#111827'; ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.fillText(label, x+w/2, y+h/2+6); ctx.textAlign='left'; var b={x:x,y:y,w:w,h:h,label:label}; buttons.push(b); return b; }
function inRect(x,y,r){ return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h; }
function clearBtns(){ buttons.length=0; }
function wrapText(text,x,y,maxWidth,lineHeight){
  var line='', ch, i, rows=[];
  for(i=0;i<text.length;i++){
    ch=text.charAt(i);
    var test=line+ch;
    if(ctx.measureText(test).width>maxWidth && line!==''){
      rows.push(line);
      line=ch;
    }else{
      line=test;
    }
  }
  if(line!==''){ rows.push(line); }
  for(i=0;i<rows.length;i++){
    ctx.fillText(rows[i], x, y + i*lineHeight);
  }
}
function checkFail(){
  if(day>daysLimit){ day=daysLimit; }
  if(gold<0){ gold=0; }
  if(food<0){ food=0; }
  if(stamina<0){ stamina=0; }
  if(day>=daysLimit || gold<=0 || stamina<=0){ scene='over'; }
}

// -------- Events --------
var events={
  arrival:[
    function(){
      var town=getTown(locationId);
      var bonus=15+Math.floor(Math.random()*25);
      return {
        title:'茶道盛情',
        desc:'抵达'+town.name+'时，当地茶客共品新茶，赠予驮队 ¥'+bonus+' 以示感谢。',
        effect:function(){ gold+=bonus; pushLog(town.name+'茶客馈赠，金币+'+bonus); }
      };
    },
    function(){
      var town=getTown(locationId);
      var add=1+Math.floor(Math.random()*3);
      return {
        title:'同行协力',
        desc:town.name+'的同行驮队愿意暂借骡马，共同前行，驮队体力上限提高。',
        effect:function(){ var newMax=clamp(maxStamina+1,12,18); maxStamina=newMax; stamina=clamp(stamina+add,0,maxStamina); pushLog('与同行互助，体力提升'+add+'点，体力上限 '+maxStamina); }
      };
    },
    function(){
      var town=getTown(locationId);
      return {
        title:'声望渐起',
        desc:'关于驮队的佳话在'+town.name+'传开，后续交易更受信任。',
        effect:function(){ rep+=0.6; pushLog(town.name+'声望提高，当前声望 '+(Math.round(rep*10)/10)); }
      };
    }
  ],
  rest:[
    function(){
      var town=getTown(locationId);
      var recover=2+Math.floor(Math.random()*2);
      return {
        title:'山泉养身',
        desc:'在'+town.name+'附近寻得清泉，驮队精神振奋，额外恢复体力'+recover+'点。',
        effect:function(){ stamina=clamp(stamina+recover,0,maxStamina); pushLog('山泉滋养，体力+'+recover); }
      };
    },
    function(){
      var loss=Math.max(1,Math.floor(food*0.2));
      return {
        title:'潮湿霉变',
        desc:'夜间湿气重，部分口粮霉变丢失 '+loss+' 份。',
        effect:function(){ food=Math.max(0,food-loss); pushLog('口粮霉变，损失'+loss+'份'); }
      };
    },
    function(){
      var gain=2+Math.floor(Math.random()*3);
      return {
        title:'小市补给',
        desc:'附近小市好意赠送干粮 '+gain+' 份，旅途更稳妥。',
        effect:function(){ food+=gain; pushLog('获得干粮'+gain+'份'); }
      };
    }
  ],
  market:[
    function(){
      var cut=5+Math.floor(Math.random()*8);
      return {
        title:'老友议价',
        desc:'旧识茶商前来帮忙，将价格压低 ¥'+cut+'。',
        effect:function(){ priceNow=Math.max(20,priceNow-cut); pushLog('熟人议价成功，茶价下降'+cut); }
      };
    },
    function(){
      var reward=12+Math.floor(Math.random()*18);
      return {
        title:'贵客求茶',
        desc:'一位贵客慕名求茶，额外支付 ¥'+reward+' 作为酬谢。',
        effect:function(){ gold+=reward; pushLog('贵客赠礼，金币+'+reward); }
      };
    },
    function(){
      return {
        title:'口碑传播',
        desc:'市场中传出驮队诚信口碑，声望略有提升。',
        effect:function(){ rep+=0.4; pushLog('市场口碑提升，声望上涨'); }
      };
    }
  ],
  travel:[
    function(){
      var strain=1+Math.floor(Math.random()*2);
      return {
        title:'险路折损',
        desc:'山道陡峭，额外消耗体力 '+strain+' 点。',
        effect:function(){ stamina=Math.max(0,stamina-strain); pushLog('险路耗损，体力-'+strain); }
      };
    },
    function(){
      var find=1+Math.floor(Math.random()*3);
      return {
        title:'山林采集',
        desc:'路途间采集到野果干粮 '+find+' 份。',
        effect:function(){ food+=find; pushLog('采得野果，口粮+'+find); }
      };
    },
    function(){
      return {
        title:'星夜兼程',
        desc:'夜行提速，旅程节约了一天时光。',
        effect:function(){ day=Math.max(1,day-1); pushLog('星夜兼程，行期缩短一天'); }
      };
    }
  ]
};

// -------- Rendering Helpers --------
function drawTiles(){
  var g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#d9e6f3'); g.addColorStop(1,'#f3efe8');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  var x,y;
  for(y=80; y<H; y+=96){ for(x=0; x<W; x+=96){ if(img.tile_grass) ctx.drawImage(img.tile_grass, x, y, 96, 96); } }
  for(x=0; x<W; x+=96){ if(img.tile_mountain) ctx.drawImage(img.tile_mountain, x, 32, 96, 96); }
  for(x=0; x<W; x+=96){ var ry = 220 + ((x/96)%2)*48; if(img.tile_river) ctx.drawImage(img.tile_river, x, ry, 96, 96); }
}
function drawHeader(){
  ctx.fillStyle='rgba(17,24,39,0.75)'; rr(8,8,W-16,84,14);
  ctx.fillStyle='#F8FAFC'; ctx.font='700 24px sans-serif'; ctx.textAlign='left';
  ctx.fillText('茶马古道 · 驮队经理', 24, 36);
  ctx.font='13px sans-serif';
  ctx.fillText('日程 '+day+'/'+daysLimit, 24, 56);
  ctx.fillText('体力 '+stamina+'/'+maxStamina, 140, 56);
  ctx.fillText('金币 '+gold, 240, 56);
  ctx.fillText('茶叶 '+tea+'/'+capacity, 24, 76);
  ctx.fillText('口粮 '+food, 140, 76);
  ctx.fillText('声望 '+(Math.round(rep*10)/10), 240, 76);
  var barX=24, barY=84, barW=W-72, barH=6;
  ctx.fillStyle='rgba(148,163,184,0.4)'; ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle='#34d399'; ctx.fillRect(barX, barY, barW*clamp(day/daysLimit,0,1), barH);
  ctx.fillStyle='#cbd5f5'; ctx.fillText('旅程进度', barX+barW-80, 76);
}
function drawRoads(){
  var i,r,a,b,mx,my;
  ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=2;
  for(i=0;i<roads.length;i++){
    r=roads[i]; a=getTown(r[0]); b=getTown(r[1]);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    mx=(a.x+b.x)/2; my=(a.y+b.y)/2;
    ctx.font='12px sans-serif'; ctx.fillStyle='#475569'; ctx.fillText(r[2]+'天', mx-10, my-6);
  }
}
function drawTownNode(t){
  if(img.town) ctx.drawImage(img.town, t.x-18, t.y-18, 36, 36);
  ctx.font='12px sans-serif'; ctx.fillStyle='#0f172a'; ctx.fillText(t.name, t.x-16, t.y+26);
}
function caravanSprite(){
  var t = getTown(locationId);
  var x = t.x, y = t.y - 22;
  if(img.mule)   ctx.drawImage(img.mule,   x-22, y-10, 44, 44);
  if(img.leader) ctx.drawImage(img.leader, x+12, y-6,  36, 36);
}
function drawLocationCard(){
  var town=getTown(locationId);
  ctx.fillStyle='rgba(255,255,255,0.94)'; rr(14,96,W-28,92,12);
  ctx.fillStyle='#111827'; ctx.font='16px sans-serif'; ctx.fillText(town.name+' · '+town.desc, 24, 124);
  ctx.font='12px sans-serif'; ctx.fillStyle='#475569';
  var info='驮队载重 '+tea+'/'+capacity+' · 骡马 '+horses+' 匹';
  ctx.fillText(info, 24, 148);
  var tip=tips[(day+log.length)%tips.length];
  ctx.fillStyle='#6b7280'; ctx.fillText('提示：'+tip, 24, 170);
}
function logBox(){
  ctx.fillStyle='rgba(255,255,255,0.95)'; rr(12, H-180, W-24, 140, 12);
  ctx.fillStyle='#111827'; ctx.font='14px sans-serif'; ctx.fillText('行记', 24, H-150);
  ctx.fillStyle='#374151'; ctx.font='12px sans-serif';
  var view=log.slice(-6), i;
  for(i=0;i<view.length;i++){ ctx.fillText(view[i], 24, H-126 + i*20); }
}
function bottomBar(){
  var y=H-64; ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fillRect(0,y,W,64); clearBtns();
  var labels=['地图','移动','交易','休整', muted?'静音':'音乐','暂停'];
  var gap=8; var btnW=Math.min(92, (W-24 - gap*(labels.length-1))/labels.length);
  var x=12;
  for(var i=0;i<labels.length;i++){
    btn(x,y+10,btnW,44,labels[i]); x+=btnW+gap;
  }
}
function drawPricePanel(){
  var hist=priceHistory[locationId]||[];
  var recent=hist.slice(Math.max(0,hist.length-4));
  ctx.font='12px sans-serif'; ctx.fillStyle='#6b7280';
  if(recent.length>0){ ctx.fillText('近期价格：'+recent.join(' / '),24, 218); }
}

// -------- Scenes --------
function mainMenu(){
  drawTiles();
  ctx.fillStyle='rgba(15,23,42,0.75)'; rr(24,80,W-48,220,18);
  ctx.fillStyle='#F8FAFC'; ctx.font='700 30px sans-serif'; ctx.textAlign='center'; ctx.fillText('茶马古道 · 像素旅程', W/2, 140);
  ctx.font='16px sans-serif'; ctx.fillText('目标：30 日抵达拉萨并获得盈余', W/2, 176);
  ctx.font='13px sans-serif'; ctx.fillText('保留行记、市场行情与沉浸音效', W/2, 200);
  ctx.textAlign='left';
  clearBtns();
  btn(W/2-90,240,180,48,'开始旅程');
  btn(W/2-90,300,180,48,'继续上次');
  btn(W/2-90,360,180,48,'驮队手册');
}
function guideView(){
  drawTiles();
  ctx.fillStyle='rgba(15,23,42,0.78)'; rr(18,60,W-36,H-120,18);
  ctx.fillStyle='#F8FAFC'; ctx.font='20px sans-serif'; ctx.textAlign='center'; ctx.fillText('驮队手册', W/2, 110);
  ctx.textAlign='left'; ctx.font='13px sans-serif';
  var text=[
    '• 体力消耗随路程增加，体力耗尽旅程终止。',
    '• 口粮影响旅途中事件，维持库存避免额外开销。',
    '• 市场价格波动，可在行记中回顾旅途。',
    '• 声望越高，遇见友善事件的概率也越大。',
    '• 合理安排休整、移动与交易节奏，留意倒计时。'
  ];
  var baseY=150;
  for(var i=0;i<text.length;i++){
    wrapText(text[i], 36, baseY+i*40, W-72, 20);
  }
  clearBtns();
  btn(W/2-90, H-120, 180, 46, '返回菜单');
}
function playing(){ drawTiles(); drawHeader(); drawLocationCard(); drawRoads(); for(var i=0;i<towns.length;i++){ drawTownNode(towns[i]); } caravanSprite(); logBox(); bottomBar(); }
function mapView(){ drawTiles(); drawHeader(); drawLocationCard(); drawRoads(); var ns=neighbors(locationId), j, n, t; ctx.font='12px sans-serif'; for(j=0;j<ns.length;j++){ n=ns[j]; t=getTown(n.to); ctx.fillStyle='rgba(16,185,129,0.18)'; ctx.beginPath(); ctx.arc(t.x,t.y,20,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#065f46'; ctx.fillText(n.days+'天 · 风险'+Math.round(n.risk*100)+'%', t.x-26, t.y-28); } caravanSprite(); logBox(); bottomBar(); }
function marketView(){
  drawTiles(); drawHeader();
  ctx.font='18px sans-serif'; ctx.fillStyle='#111827'; ctx.fillText(getTown(locationId).name+' · 市集行情',14,110);
  ctx.font='12px sans-serif'; ctx.fillStyle='#6b7280'; ctx.fillText('茶叶单价（浮动）',14,134);
  ctx.font='700 26px sans-serif'; ctx.fillStyle='#1F3D2B'; ctx.fillText('¥'+priceNow,160,134);
  ctx.font='14px sans-serif'; ctx.fillStyle='#374151'; ctx.fillText('模式：'+(marketMode==='buy'?'买入补货':'卖出获利'),14,170);
  var baseY=196; ctx.fillStyle='rgba(255,255,255,0.95)'; rr(14,baseY,W-28,140,12);
  ctx.fillStyle='#374151'; ctx.font='14px sans-serif'; ctx.fillText('数量',24,baseY+32);
  btn(80, baseY+50, 40, 40, '-'); ctx.font='18px sans-serif'; ctx.fillStyle='#111827'; ctx.fillText(String(marketQty),132,baseY+78);
  btn(160, baseY+50, 40, 40, '+');
  var amt = marketQty*priceNow*(marketMode==='buy'?1:-1);
  ctx.fillStyle='#374151'; ctx.font='13px sans-serif';
  ctx.fillText('金额：'+(marketMode==='buy' ? '-' : '+')+'¥'+Math.abs(amt), 230, baseY+78);
  ctx.fillText('库存：'+tea+'/'+capacity+' · 口粮 '+food, 24, baseY+110);
  drawPricePanel();
  btn(14, H-90, 120, 44, '返回'); btn(W-140, H-90, 120, 44, marketMode==='buy'?'确认买入':'确认卖出');
  btn(W/2-120, baseY-44, 110, 32, '买入'); btn(W/2+10, baseY-44, 110, 32, '卖出');
  logBox();
}
function paused(){ playing(); ctx.fillStyle='rgba(17,24,39,0.6)'; ctx.fillRect(0,0,W,H); clearBtns(); btn(W/2-90, H/2-30, 180, 42, '继续'); btn(W/2-90, H/2+24, 180, 42, '返回菜单'); }
function eventView(){
  if(previousScene==='market'){ marketView(); }
  else if(previousScene==='map'){ mapView(); }
  else { playing(); }
  ctx.fillStyle='rgba(15,23,42,0.72)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,0.98)'; rr(32, H/2-160, W-64, 240, 16);
  ctx.fillStyle='#111827'; ctx.font='18px sans-serif'; ctx.textAlign='center';
  ctx.fillText(currentEvent?currentEvent.title:'旅途事件', W/2, H/2-110);
  ctx.textAlign='left'; ctx.font='14px sans-serif'; ctx.fillStyle='#374151';
  if(currentEvent){ wrapText(currentEvent.desc, 48, H/2-80, W-96, 22); }
  clearBtns();
  btn(W/2-90, H/2+40, 180, 44, '继续旅程');
}
function over(){
  playing();
  ctx.fillStyle='rgba(17,24,39,0.6)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,0.98)'; rr(W/2-160, H/2-140, 320, 240, 18);
  ctx.fillStyle='#111827'; ctx.font='20px sans-serif'; ctx.textAlign='center';
  var success=(locationId==='lasa' && gold>300);
  ctx.fillText(success?'抵达拉萨，盈利成功！':'旅途终止', W/2, H/2-90);
  ctx.font='14px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#374151';
  ctx.fillText('最终金币：¥'+gold, W/2-120, H/2-50);
  ctx.fillText('携带茶叶：'+tea, W/2-120, H/2-26);
  ctx.fillText('声望：'+(Math.round(rep*10)/10), W/2-120, H/2-2);
  ctx.fillText('行记条目：'+log.length, W/2-120, H/2+22);
  clearBtns();
  btn(W/2-120, H/2+48, 240, 44, '再来一局');
  btn(W/2-120, H/2+102, 240, 44, '返回菜单');
  ctx.textAlign='left';
}

// -------- Actions --------
function openMap(){ scene='map'; render(); }
function openMarket(){ scene='market'; marketMode='buy'; marketQty=1; priceNow=priceAt(locationId); save(); render(); }
function rest(){
  if(stamina>=maxStamina){ pushLog('体力充沛，无需休整'); play('click'); render(); return; }
  var cost=6; if(gold<cost){ pushLog('金币不足，无法休整'); play('bad'); render(); return; }
  stamina=Math.min(maxStamina,stamina+4); gold-=cost; food+=2; pushLog('在 '+getTown(locationId).name+' 休整，体力+4，金币-'+cost); play('click'); save();
  if(Math.random()<0.35){ if(triggerEvent('rest')){ return; } }
  render();
}
function tryMove(toId){
  var ns=neighbors(locationId), i, n=null;
  for(i=0;i<ns.length;i++){ if(ns[i].to===toId){ n=ns[i]; break; } }
  if(!n){ return; }
  if(stamina < n.days){ pushLog('体力不足，无法启程'); play('bad'); render(); return; }
  stamina-=n.days; day+=n.days; food-=Math.ceil(n.days*(1+horses*0.2));
  if(food<0){ gold += Math.floor(food*2); food=0; pushLog('口粮不足，被迫花钱补给'); }
  var weather=Math.random()<0.35?(Math.random()<0.5?'暴雨':'冰雹'):null;
  var risk=n.risk+(weather?0.1:0); var attacked=Math.random()<risk;
  if(attacked){
    var loss=Math.max(1,Math.floor(tea*0.25)); tea-=loss; rep=Math.max(0,rep-1);
    pushLog((weather?('遭遇'+weather+'与盗匪，'):'遭遇盗匪，')+'损失茶叶'+loss);
    play('bad');
  }else{
    pushLog(weather?('顶着'+weather+'艰难前行，平安抵达'):('一路顺利抵达'+getTown(toId).name));
    play('move'); if(Math.random()<0.2){ play('flute'); }
  }
  locationId=toId; priceNow=priceAt(locationId); day=Math.min(day,daysLimit); save();
  checkFail();
  if(scene==='over'){ render(); return; }
  if(!attacked && Math.random()<0.35){ if(triggerEvent('arrival')){ return; } }
  if(Math.random()<0.25){ if(triggerEvent('travel')){ return; } }
  render();
}
function trade(confirm){
  if(!confirm){ openMarket(); return; }
  var cost = marketQty*priceNow;
  if(marketMode==='buy'){
    var cap = capacity - tea; if(marketQty>cap){ pushLog('超出载重，无法买入更多'); play('bad'); render(); return; }
    if(cost>gold){ pushLog('金币不足'); play('bad'); render(); return; }
    tea+=marketQty; gold-=cost; pushLog('买入茶叶'+marketQty+'，花费¥'+cost); play('buy');
  }else{
    if(marketQty>tea){ pushLog('没有这么多茶叶可卖'); play('bad'); render(); return; }
    tea-=marketQty; gold+=cost; rep+=0.2; pushLog('卖出茶叶'+marketQty+'，获得¥'+cost); play('sell');
  }
  marketQty=1; save();
  if(Math.random()<0.25){ if(triggerEvent('market')){ return; } }
  render();
}
function triggerEvent(type){
  if(!events[type] || events[type].length===0){ return false; }
  var maker = events[type][Math.floor(Math.random()*events[type].length)];
  var ev = typeof maker==='function'?maker():maker;
  if(!ev){ return false; }
  ev.resolved=false;
  currentEvent=ev;
  if(scene!=='event'){ previousScene=scene; }
  scene='event';
  render();
  return true;
}
function closeEvent(){
  if(currentEvent && !currentEvent.resolved){ if(currentEvent.effect){ currentEvent.effect(); } currentEvent.resolved=true; save(); }
  currentEvent=null;
  checkFail();
  if(scene!=='over'){ scene=previousScene||'playing'; }
  render();
}

// -------- Input --------
wx.onTouchStart(function(e){
  var x=e.touches[0].clientX, y=e.touches[0].clientY, i, b;
  if(scene==='map'){
    var ns=neighbors(locationId);
    for(i=0;i<ns.length;i++){
      var t=getTown(ns[i].to); var dx=x-t.x, dy=y-t.y; if(Math.sqrt(dx*dx+dy*dy)<=20){ tryMove(ns[i].to); return; }
    }
  }
  for(i=0;i<buttons.length;i++){
    b=buttons[i];
    if(inRect(x,y,b)){
      play('click');
      if(scene==='menu'){
        if(b.label==='开始旅程'){ reset(); scene='playing'; render(); return; }
        if(b.label==='继续上次'){ load(); scene='playing'; render(); return; }
        if(b.label==='驮队手册'){ scene='guide'; render(); return; }
      }
      if(scene==='guide'){
        if(b.label==='返回菜单'){ scene='menu'; render(); return; }
      }
      if(scene==='playing' || scene==='map'){
        if(b.label==='地图'){ openMap(); return; }
        if(b.label==='移动'){ openMap(); return; }
        if(b.label==='交易'){ openMarket(); return; }
        if(b.label==='休整'){ rest(); return; }
        if(b.label==='暂停'){ scene='paused'; render(); return; }
        if(b.label==='音乐' || b.label==='静音'){ toggleMute(); return; }
      }
      if(scene==='paused'){
        if(b.label==='继续'){ scene='playing'; render(); return; }
        if(b.label==='返回菜单'){ scene='menu'; render(); return; }
      }
      if(scene==='market'){
        if(b.label==='返回'){ scene='playing'; render(); return; }
        if(b.label==='确认买入' || b.label==='确认卖出'){ trade(true); return; }
        if(b.label==='买入'){ marketMode='buy'; render(); return; }
        if(b.label==='卖出'){ marketMode='sell'; render(); return; }
        if(b.label==='+'){ marketQty=Math.min(99,marketQty+1); render(); return; }
        if(b.label==='-'){ marketQty=Math.max(1,marketQty-1); render(); return; }
        if(b.label==='音乐' || b.label==='静音'){ toggleMute(); return; }
      }
      if(scene==='event'){
        if(b.label==='继续旅程'){ closeEvent(); return; }
      }
      if(scene==='over'){
        if(b.label==='再来一局'){ reset(); scene='playing'; render(); return; }
        if(b.label==='返回菜单'){ scene='menu'; render(); return; }
      }
    }
  }
});

// -------- Render loop --------
function render(){
  ctx.clearRect(0,0,W,H);
  if(loaded < toLoad.length){ ctx.fillStyle='#0f172a'; ctx.font='16px sans-serif'; ctx.fillText('资源加载中…', 20, 40); return; }
  if(scene==='menu'){ mainMenu(); return; }
  if(scene==='guide'){ guideView(); return; }
  if(scene==='market'){ marketView(); return; }
  if(scene==='map'){ mapView(); return; }
  if(scene==='paused'){ paused(); return; }
  if(scene==='event'){ eventView(); return; }
  if(scene==='over'){ over(); return; }
  playing();
}
function loop(){ render(); requestAnimationFrame(loop); }
reset(); scene='menu'; applyMute(); loop();
