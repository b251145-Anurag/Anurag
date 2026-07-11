/* =========================================================
   FRUIT CLICK CHALLENGE — GAME LOGIC
   Vanilla JS. No frameworks. Organized into small modules:
   Utils, Storage, Audio, Background FX, Navigation,
   Settings, Game Engine, Results, Leaderboard, Achievements.
   ========================================================= */

(function(){
'use strict';

/* ============================================================
   UTILITIES
   ============================================================ */
const qs  = (sel, ctx=document) => ctx.querySelector(sel);
const qsa = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
function formatTime(sec){
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `${s}`;
}

/* ============================================================
   STORAGE
   ============================================================ */
const STORE_KEYS = {
  settings: 'fcc_settings_v1',
  leaderboard: 'fcc_leaderboard_v1',
  highscore: 'fcc_highscore_v1',
  achievements: 'fcc_achievements_v1'
};

const DEFAULT_SETTINGS = {
  timer: 60,
  customTimer: 45,
  difficulty: 'medium',
  theme: 'dark',
  music: true,
  sfx: true,
  fullscreen: false
};

function loadSettings(){
  try{
    const raw = localStorage.getItem(STORE_KEYS.settings);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  }catch(e){ return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s){
  try{ localStorage.setItem(STORE_KEYS.settings, JSON.stringify(s)); }catch(e){}
}
function loadLeaderboard(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEYS.leaderboard)) || []; }catch(e){ return []; }
}
function saveLeaderboard(list){
  try{ localStorage.setItem(STORE_KEYS.leaderboard, JSON.stringify(list)); }catch(e){}
}
function loadHighScore(){
  try{ return parseInt(localStorage.getItem(STORE_KEYS.highscore)) || 0; }catch(e){ return 0; }
}
function saveHighScore(v){
  try{ localStorage.setItem(STORE_KEYS.highscore, String(v)); }catch(e){}
}
function loadAchievements(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEYS.achievements)) || []; }catch(e){ return []; }
}
function saveAchievements(list){
  try{ localStorage.setItem(STORE_KEYS.achievements, JSON.stringify(list)); }catch(e){}
}

let settings = loadSettings();
let highScore = loadHighScore();
let unlockedAchievements = new Set(loadAchievements());

/* ============================================================
   AUDIO ENGINE (WebAudio — no external files)
   ============================================================ */
const AudioEngine = (function(){
  let ctx = null;
  let musicNodes = null;
  let musicTimer = null;

  function ensureCtx(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) ctx = new AC();
    }
    if(ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type='sine', gain=0.18, delay=0){
    if(!settings.sfx) return;
    const c = ensureCtx();
    if(!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock(){ ensureCtx(); },
    click(){ tone(520, 0.09, 'triangle', 0.12); },
    hit(){ tone(760, 0.12, 'sine', 0.16); tone(1020, 0.1, 'sine', 0.1, 0.04); },
    golden(){ tone(880,0.1,'triangle',0.18); tone(1180,0.12,'triangle',0.16,0.06); tone(1480,0.14,'triangle',0.14,0.12); },
    bomb(){ tone(140,0.35,'sawtooth',0.22); tone(90,0.4,'square',0.16,0.05); },
    miss(){ tone(220,0.2,'sine',0.12); },
    combo(level){ [0,0.07,0.14].forEach((d,i)=> tone(660+level*80+i*140, 0.12,'triangle',0.14,d)); },
    powerup(){ tone(500,0.09,'square',0.12); tone(760,0.09,'square',0.12,0.08); tone(1020,0.14,'square',0.12,0.16); },
    button(){ tone(400,0.06,'triangle',0.1); },
    gameover(){ [420,360,300,220].forEach((f,i)=> tone(f,0.3,'sawtooth',0.14,i*0.16)); },
    victory(){ [520,660,780,1040].forEach((f,i)=> tone(f,0.22,'triangle',0.16,i*0.13)); },

    startMusic(){
      if(!settings.music) return;
      const c = ensureCtx();
      if(!c) return;
      this.stopMusic();
      const notes = [261.6,329.6,392.0,329.6,392.0,466.2,392.0,329.6];
      let i = 0;
      musicTimer = setInterval(()=>{
        if(!settings.music) return;
        const f = notes[i % notes.length];
        tone(f, 0.5, 'sine', 0.045);
        tone(f*2, 0.3, 'sine', 0.02, 0.05);
        i++;
      }, 480);
    },
    stopMusic(){
      if(musicTimer){ clearInterval(musicTimer); musicTimer = null; }
    }
  };
})();

/* ============================================================
   RIPPLE EFFECT (delegated)
   ============================================================ */
document.addEventListener('pointerdown', (e)=>{
  const target = e.target.closest('.ripple');
  if(!target) return;
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const circle = document.createElement('span');
  circle.className = 'ripple-circle';
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (e.clientX - rect.left - size/2) + 'px';
  circle.style.top = (e.clientY - rect.top - size/2) + 'px';
  const prevPos = getComputedStyle(target).position;
  if(prevPos === 'static') target.style.position = 'relative';
  target.style.overflow = 'hidden';
  target.appendChild(circle);
  setTimeout(()=> circle.remove(), 650);
});

document.addEventListener('pointerdown', (e)=>{
  if(e.target.closest('button')) AudioEngine.button();
  AudioEngine.unlock();
}, { once:false });

/* ============================================================
   BACKGROUND DECORATION
   ============================================================ */
const FRUIT_EMOJIS = ['🍎','🍌','🍊','🍇','🍓','🍍','🍉','🥝'];

function spawnBgFruit(){
  const layer = qs('#bgFruits');
  const span = document.createElement('span');
  span.textContent = pick(FRUIT_EMOJIS);
  span.style.left = rand(0,100) + 'vw';
  span.style.fontSize = rand(1.2, 2.6) + 'rem';
  const dur = rand(14, 26);
  span.style.animationDuration = dur + 's';
  layer.appendChild(span);
  setTimeout(()=> span.remove(), dur * 1000 + 200);
}
function spawnBgParticle(){
  const layer = qs('#bgParticles');
  const i = document.createElement('i');
  i.style.left = rand(0,100) + 'vw';
  i.style.top = rand(0,100) + 'vh';
  i.style.animationDuration = rand(6,12) + 's';
  layer.appendChild(i);
  setTimeout(()=> i.remove(), 12000);
}
function spawnHomeFloatingFruit(){
  const layer = qs('#homeFloatingFruits');
  if(!layer) return;
  const span = document.createElement('span');
  span.textContent = pick(FRUIT_EMOJIS);
  span.style.left = rand(4,92) + 'vw';
  span.style.top = rand(8,80) + 'vh';
  span.style.animationDelay = rand(0,2) + 's';
  span.style.fontSize = rand(1.4,2.4) + 'rem';
  layer.appendChild(span);
  setTimeout(()=> span.remove(), 6000);
}

setInterval(spawnBgFruit, 900);
for(let i=0;i<10;i++) setTimeout(spawnBgFruit, i*180);
setInterval(spawnBgParticle, 700);
setInterval(spawnHomeFloatingFruit, 1400);
for(let i=0;i<8;i++) setTimeout(spawnHomeFloatingFruit, i*260);

/* ============================================================
   NAVIGATION
   ============================================================ */
let currentScreenId = 'splash';

function showScreen(id){
  const next = qs('#screen-' + id);
  if(!next || currentScreenId === id) return;
  const current = qs('.screen.active');
  if(current){
    current.classList.add('leaving');
    current.classList.remove('active');
    setTimeout(()=> current.classList.remove('leaving'), 460);
  }
  next.classList.add('active');
  currentScreenId = id;

  if(id === 'leaderboard') renderLeaderboard();
  if(id === 'home'){ updateHomeStats(); }
}

document.addEventListener('click', (e)=>{
  const navBtn = e.target.closest('[data-nav]');
  if(navBtn){
    const target = navBtn.dataset.nav;
    if(target === 'game' && navBtn.dataset.action === 'play'){
      startGame();
      return;
    }
    showScreen(target);
    return;
  }
  const actionBtn = e.target.closest('[data-action="retry"]');
  if(actionBtn){ startGame(); }
});

/* ============================================================
   SPLASH SEQUENCE
   ============================================================ */
window.addEventListener('load', ()=>{
  applyTheme(settings.theme);
  const bar = qs('#loaderBar');
  const label = qs('#loaderLabel');
  const msgs = ['Loading juicy goodness…','Slicing apples…','Peeling bananas…','Polishing gold fruit…','Almost ready…'];
  let p = 0;
  const iv = setInterval(()=>{
    p += rand(8, 18);
    if(p >= 100){ p = 100; clearInterval(iv); }
    bar.style.width = p + '%';
    label.textContent = msgs[Math.min(msgs.length-1, Math.floor(p/22))];
    if(p >= 100){
      setTimeout(()=>{ showScreen('home'); }, 350);
    }
  }, 220);
});

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(theme){
  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('theme-dark', theme !== 'light');
}

/* ============================================================
   SETTINGS SCREEN WIRING
   ============================================================ */
function refreshSettingsUI(){
  qsa('#timerOptions .option-pill').forEach(btn=>{
    btn.classList.toggle('selected', btn.dataset.timer == String(settings.timer) ||
      (btn.dataset.timer === 'custom' && settings.timer === 'custom'));
  });
  qs('#customTimerWrap').classList.toggle('hidden', settings.timer !== 'custom');
  qs('#customTimerRange').value = settings.customTimer;
  qs('#customTimerVal').textContent = settings.customTimer + 's';

  qsa('#difficultyOptions .option-pill').forEach(btn=>{
    btn.classList.toggle('selected', btn.dataset.difficulty === settings.difficulty);
  });
  qsa('#themeOptions .option-pill').forEach(btn=>{
    btn.classList.toggle('selected', btn.dataset.theme === settings.theme);
  });
  qs('#musicToggle').checked = settings.music;
  qs('#sfxToggle').checked = settings.sfx;
  qs('#fullscreenToggle').checked = settings.fullscreen;
}

qs('#timerOptions').addEventListener('click', (e)=>{
  const btn = e.target.closest('.option-pill'); if(!btn) return;
  settings.timer = btn.dataset.timer === 'custom' ? 'custom' : parseInt(btn.dataset.timer);
  refreshSettingsUI();
});
qs('#customTimerRange').addEventListener('input', (e)=>{
  settings.customTimer = parseInt(e.target.value);
  qs('#customTimerVal').textContent = settings.customTimer + 's';
});
qs('#difficultyOptions').addEventListener('click', (e)=>{
  const btn = e.target.closest('.option-pill'); if(!btn) return;
  settings.difficulty = btn.dataset.difficulty;
  refreshSettingsUI();
});
qs('#themeOptions').addEventListener('click', (e)=>{
  const btn = e.target.closest('.option-pill'); if(!btn) return;
  settings.theme = btn.dataset.theme;
  applyTheme(settings.theme);
  refreshSettingsUI();
});
qs('#musicToggle').addEventListener('change', (e)=>{
  settings.music = e.target.checked;
  if(settings.music && currentScreenId === 'game' && !gameState.paused) AudioEngine.startMusic();
  else AudioEngine.stopMusic();
});
qs('#sfxToggle').addEventListener('change', (e)=>{ settings.sfx = e.target.checked; });
qs('#fullscreenToggle').addEventListener('change', (e)=>{
  settings.fullscreen = e.target.checked;
  toggleFullscreen(settings.fullscreen);
});
qs('#saveSettingsBtn').addEventListener('click', ()=>{
  saveSettings(settings);
  showScreen('home');
});

function toggleFullscreen(on){
  try{
    if(on){
      if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
    }else{
      if(document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    }
  }catch(e){}
}

qs('#homeMuteBtn').addEventListener('click', ()=>{
  const muted = !(settings.music || settings.sfx) ;
  const nowOn = muted; // toggle: if currently both off -> turn on, else turn off
  settings.music = nowOn; settings.sfx = nowOn;
  qs('#homeMuteBtn').textContent = nowOn ? '🔊' : '🔇';
  saveSettings(settings);
});

/* ============================================================
   LEADERBOARD
   ============================================================ */
function renderLeaderboard(){
  const list = loadLeaderboard();
  const ol = qs('#leaderboardList');
  ol.innerHTML = '';
  if(list.length === 0){
    ol.innerHTML = '<div class="leaderboard-empty">No scores yet — be the first! 🍓</div>';
    return;
  }
  list.slice(0,10).forEach((entry, i)=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rank">${i+1}</span>
      <div class="lb-info">
        <span class="lb-score">${entry.score} pts</span>
        <span class="lb-meta">${entry.difficulty} · ${entry.date}</span>
      </div>
      <span>${i===0?'🥇':i===1?'🥈':i===2?'🥉':'🍒'}</span>
    `;
    ol.appendChild(li);
  });
}
function addToLeaderboard(score, difficulty){
  const list = loadLeaderboard();
  list.push({ score, difficulty, date: new Date().toLocaleDateString() });
  list.sort((a,b)=> b.score - a.score);
  saveLeaderboard(list.slice(0,10));
}
qs('#clearLeaderboardBtn').addEventListener('click', ()=>{
  saveLeaderboard([]);
  renderLeaderboard();
});

function updateHomeStats(){
  qs('#homeHighScore').textContent = highScore;
  const labels = { easy:'🎯 Easy', medium:'🎯 Medium', hard:'🎯 Hard', insane:'🎯 Insane' };
  qs('#homeDifficultyChip').textContent = labels[settings.difficulty] || '🎯 Medium';
}

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
const ACHIEVEMENTS = [
  { id:'apple_king',    name:'Apple King',      icon:'🍎', desc:'Click 50 apples in one run',        check: s => s.appleCount >= 50 },
  { id:'banana_master', name:'Banana Master',   icon:'🍌', desc:'Click 50 bananas in one run',       check: s => s.bananaCount >= 50 },
  { id:'golden_hunter', name:'Golden Hunter',   icon:'✨', desc:'Collect 10 golden fruits',          check: s => s.goldenCount >= 10 },
  { id:'combo_hero',    name:'Combo Hero',      icon:'🔥', desc:'Reach a 15x combo streak',          check: s => s.highestCombo >= 15 },
  { id:'click_club',    name:'100 Click Club',  icon:'👆', desc:'Land 100 clicks in one run',        check: s => s.totalClicks >= 100 },
  { id:'bomb_dodger',   name:'Bomb Dodger',     icon:'🛡',  desc:'Finish a run without hitting a bomb', check: s => s.finished && s.bombClicks === 0 && s.totalClicks > 10 },
];

function checkAchievements(stats){
  ACHIEVEMENTS.forEach(a=>{
    if(unlockedAchievements.has(a.id)) return;
    if(a.check(stats)){
      unlockedAchievements.add(a.id);
      saveAchievements(Array.from(unlockedAchievements));
      showAchievementToast(a);
    }
  });
}
function showAchievementToast(a){
  const toast = qs('#achievementToast');
  toast.innerHTML = `<span style="font-size:1.4rem">${a.icon}</span><span>Achievement Unlocked<br><strong>${a.name}</strong></span>`;
  toast.classList.add('show');
  AudioEngine.powerup();
  setTimeout(()=> toast.classList.remove('show'), 2600);
}

/* ============================================================
   GAME ENGINE
   ============================================================ */
const DIFFICULTY_CONFIG = {
  easy:    { spawnInterval: 1150, lifetime: 1900, bombChance: 0.07, powerupChance: 0.06, goldenChance: 0.13, maxConcurrent: 3 },
  medium:  { spawnInterval: 900,  lifetime: 1550, bombChance: 0.11, powerupChance: 0.06, goldenChance: 0.13, maxConcurrent: 4 },
  hard:    { spawnInterval: 700,  lifetime: 1250, bombChance: 0.15, powerupChance: 0.055,goldenChance: 0.11, maxConcurrent: 5 },
  insane:  { spawnInterval: 520,  lifetime: 980,  bombChance: 0.20, powerupChance: 0.05, goldenChance: 0.09, maxConcurrent: 6 },
};

const POWERUP_TYPES = [
  { id:'double',  icon:'⭐', color:'#ffd23f', label:'Double Score!' },
  { id:'slow',    icon:'⏳', color:'#3ee6d0', label:'Slow Time!' },
  { id:'freeze',  icon:'❄️', color:'#8fd9ff', label:'Timer Frozen!' },
  { id:'magnet',  icon:'🧲', color:'#ff9f1c', label:'Magnet!' },
  { id:'life',    icon:'💖', color:'#ff477e', label:'Extra Life!' },
];

let gameState = null;
let field = null;

function freshGameState(){
  const cfg = DIFFICULTY_CONFIG[settings.difficulty];
  const totalTime = settings.timer === 'custom' ? settings.customTimer : settings.timer;
  return {
    running:false, paused:false,
    difficulty: settings.difficulty,
    cfg: { ...cfg },
    baseSpawnInterval: cfg.spawnInterval,
    baseLifetime: cfg.lifetime,
    spawnInterval: cfg.spawnInterval,
    lifetime: cfg.lifetime,
    totalTime, timeLeft: totalTime,
    elapsed: 0,
    score:0, apples:0, bananas:0, goldenCount:0,
    lives:3, maxLives:5,
    combo:0, comboMultiplier:1, highestCombo:0,
    bombClicks:0, totalClicks:0, hits:0, misses:0,
    doubleScoreUntil:0, slowUntil:0, freezeUntil:0, magnetUntil:0,
    activeTargets: new Map(),
    targetSeq:0,
    spawnTimeoutId:null, timerIntervalId:null, magnetIntervalId:null, speedRampIntervalId:null,
    startedAt:0,
    finished:false
  };
}

function startGame(){
  field = qs('#playField');
  field.innerHTML = '';
  gameState = freshGameState();
  showScreen('game');
  AudioEngine.unlock();
  updateHUD();
  renderHearts();
  runCountdown(()=>{
    gameState.running = true;
    gameState.startedAt = Date.now();
    AudioEngine.startMusic();
    scheduleSpawn();
    startTimerLoop();
    startSpeedRamp();
  });
}

function runCountdown(onDone){
  const overlay = qs('#countdownOverlay');
  const numEl = qs('#countdownNumber');
  overlay.classList.remove('hidden');
  const seq = ['3','2','1','GO!'];
  let i = 0;
  function step(){
    numEl.textContent = seq[i];
    numEl.style.animation = 'none';
    void numEl.offsetWidth;
    numEl.style.animation = '';
    if(seq[i] !== 'GO!') AudioEngine.click(); else AudioEngine.powerup();
    i++;
    if(i < seq.length){
      setTimeout(step, 700);
    }else{
      setTimeout(()=>{ overlay.classList.add('hidden'); onDone(); }, 500);
    }
  }
  step();
}

/* ---------- Spawning ---------- */
function scheduleSpawn(){
  if(!gameState || !gameState.running) return;
  clearTimeout(gameState.spawnTimeoutId);
  gameState.spawnTimeoutId = setTimeout(()=>{
    if(gameState.running && !gameState.paused){
      if(gameState.activeTargets.size < gameState.cfg.maxConcurrent){
        spawnTarget();
      }
    }
    scheduleSpawn();
  }, gameState.spawnInterval);
}

function pickTargetType(){
  const r = Math.random();
  const cfg = gameState.cfg;
  if(r < cfg.bombChance) return { kind:'bomb' };
  if(r < cfg.bombChance + cfg.powerupChance) return { kind:'powerup', powerup: pick(POWERUP_TYPES) };
  if(r < cfg.bombChance + cfg.powerupChance + cfg.goldenChance){
    return { kind:'golden', fruit: Math.random() < 0.5 ? 'apple' : 'banana' };
  }
  return { kind:'fruit', fruit: Math.random() < 0.5 ? 'apple' : 'banana' };
}

function emojiFor(def){
  if(def.kind === 'bomb') return '💣';
  if(def.kind === 'powerup') return def.powerup.icon;
  if(def.kind === 'golden') return def.fruit === 'apple' ? '🍏' : '🍌';
  return def.fruit === 'apple' ? '🍎' : '🍌';
}

function spawnTarget(){
  const def = pickTargetType();
  const id = ++gameState.targetSeq;
  const el = document.createElement('div');
  el.className = 'target pulse';
  if(def.kind === 'golden') el.classList.add('golden');
  if(def.kind === 'bomb') el.classList.add('bomb');
  if(def.kind === 'powerup'){ el.classList.add('powerup'); el.style.color = def.powerup.color; }
  el.textContent = emojiFor(def);

  const rect = field.getBoundingClientRect();
  const size = 64;
  const topReserve = 150;
  const maxX = Math.max(10, rect.width - size - 10);
  const maxY = Math.max(topReserve, rect.height - size - 16);
  const x = clamp(rand(8, maxX), 8, maxX);
  const y = clamp(rand(topReserve, maxY), topReserve, maxY);
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  const lifetime = (def.kind === 'bomb') ? gameState.lifetime * 1.15 : gameState.lifetime;
  const expireId = setTimeout(()=> expireTarget(id), lifetime);

  el.addEventListener('pointerdown', (e)=>{
    e.stopPropagation();
    handleTargetClick(id, def, el);
  }, { passive:true });

  field.appendChild(el);
  gameState.activeTargets.set(id, { el, def, expireId });
}

function removeTargetImmediate(id){
  const entry = gameState.activeTargets.get(id);
  if(!entry) return null;
  clearTimeout(entry.expireId);
  gameState.activeTargets.delete(id);
  return entry;
}

function expireTarget(id){
  const entry = gameState.activeTargets.get(id);
  if(!entry) return;
  gameState.activeTargets.delete(id);
  const { el, def } = entry;
  el.classList.add('expiring');
  setTimeout(()=> el.remove(), 320);
  if(def.kind === 'fruit' || def.kind === 'golden'){
    missTarget();
  }
}

/* ---------- Interaction ---------- */
function handleTargetClick(id, def, el){
  if(!gameState.running || gameState.paused) return;
  const entry = removeTargetImmediate(id);
  if(!entry) return;
  el.classList.add('hit');
  setTimeout(()=> el.remove(), 320);

  gameState.totalClicks++;

  const rect = el.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const cx = rect.left - fieldRect.left + rect.width/2;
  const cy = rect.top - fieldRect.top + rect.height/2;

  if(def.kind === 'bomb'){
    onBombHit(cx, cy);
  }else if(def.kind === 'powerup'){
    onPowerupHit(def.powerup, cx, cy);
  }else{
    onFruitHit(def, cx, cy);
  }

  // instantly spawn a replacement so the field stays lively
  if(gameState.activeTargets.size < gameState.cfg.maxConcurrent + 1){
    setTimeout(()=>{ if(gameState.running && !gameState.paused) spawnTarget(); }, 60);
  }

  refreshStatsSnapshotAndCheckAchievements();
}

function onFruitHit(def, x, y){
  gameState.hits++;
  const isGolden = def.kind === 'golden';
  const base = isGolden ? 10 : 1;
  const multiplier = gameState.comboMultiplier * (Date.now() < gameState.doubleScoreUntil ? 2 : 1);
  const gained = Math.round(base * multiplier);
  gameState.score += gained;

  if(def.fruit === 'apple') gameState.apples++; else gameState.bananas++;
  if(isGolden) gameState.goldenCount++;

  bumpCombo();
  spawnFloatingScore(x, y, '+' + gained, false);
  spawnParticles(x, y, isGolden ? '#ffd23f' : (def.fruit === 'apple' ? '#ff6b6b' : '#ffe066'));
  isGolden ? AudioEngine.golden() : AudioEngine.hit();
  updateHUD();
}

function onBombHit(x, y){
  gameState.bombClicks++;
  gameState.score = Math.max(0, gameState.score - 5);
  resetCombo();
  spawnFloatingScore(x, y, '-5', true);
  spawnExplosion(x, y);
  shakeScreen();
  AudioEngine.bomb();
  updateHUD();
}

function onPowerupHit(pu, x, y){
  const now = Date.now();
  switch(pu.id){
    case 'double': gameState.doubleScoreUntil = now + 8000; break;
    case 'slow':
      gameState.slowUntil = now + 8000;
      gameState.spawnInterval = gameState.baseSpawnInterval * 1.6;
      gameState.lifetime = gameState.baseLifetime * 1.6;
      setTimeout(applySpeedForElapsed, 8000);
      break;
    case 'freeze': gameState.freezeUntil = now + 5000; break;
    case 'magnet': activateMagnet(6000); break;
    case 'life':
      gameState.lives = Math.min(gameState.maxLives, gameState.lives + 1);
      renderHearts();
      break;
  }
  spawnFloatingScore(x, y, pu.label, false);
  spawnParticles(x, y, pu.color);
  AudioEngine.powerup();
  showPowerupToast(pu);
}

function showPowerupToast(pu){
  const toast = qs('#comboToast');
  toast.textContent = `${pu.icon} ${pu.label}`;
  toast.style.color = pu.color;
  toast.classList.remove('show'); void toast.offsetWidth;
  toast.classList.add('show');
}

function activateMagnet(duration){
  gameState.magnetUntil = Date.now() + duration;
  clearInterval(gameState.magnetIntervalId);
  gameState.magnetIntervalId = setInterval(()=>{
    if(!gameState.running || gameState.paused || Date.now() > gameState.magnetUntil){
      clearInterval(gameState.magnetIntervalId);
      return;
    }
    // auto-collect one nearby fruit/golden target
    const entries = Array.from(gameState.activeTargets.entries())
      .filter(([,v]) => v.def.kind === 'fruit' || v.def.kind === 'golden');
    if(entries.length){
      const [id, entry] = entries[0];
      handleTargetClick(id, entry.def, entry.el);
    }
  }, 450);
}

function missTarget(){
  gameState.misses++;
  resetCombo();
  loseLife();
}

function loseLife(){
  gameState.lives--;
  renderHearts(true);
  AudioEngine.miss();
  if(gameState.lives <= 0){
    endGame(false);
  }
}

/* ---------- Combo ---------- */
function bumpCombo(){
  gameState.combo++;
  gameState.highestCombo = Math.max(gameState.highestCombo, gameState.combo);
  let newMultiplier = 1;
  if(gameState.combo >= 15) newMultiplier = 4;
  else if(gameState.combo >= 10) newMultiplier = 3;
  else if(gameState.combo >= 5) newMultiplier = 2;

  if(newMultiplier !== gameState.comboMultiplier){
    gameState.comboMultiplier = newMultiplier;
    triggerComboToast(newMultiplier);
    AudioEngine.combo(newMultiplier);
  }
  updateComboRing();
}
function resetCombo(){
  gameState.combo = 0;
  gameState.comboMultiplier = 1;
  updateComboRing();
}
function triggerComboToast(mult){
  const toast = qs('#comboToast');
  toast.textContent = `🔥 COMBO x${mult}!`;
  toast.style.color = 'var(--gold)';
  toast.classList.remove('show'); void toast.offsetWidth;
  toast.classList.add('show');
  const ring = qs('#comboRingWrap');
  ring.classList.add('glow');
  setTimeout(()=> ring.classList.remove('glow'), 900);
}
function updateComboRing(){
  const thresholds = [0,5,10,15];
  const mIndex = gameState.comboMultiplier - 1;
  const floor = thresholds[mIndex] ?? 15;
  const nextThresh = thresholds[mIndex+1] ?? (floor + 5);
  const span = nextThresh - floor;
  const progress = span > 0 ? clamp((gameState.combo - floor) / span, 0, 1) : 1;
  const circumference = 176;
  qs('#comboRingFg').style.strokeDashoffset = circumference - progress * circumference;
  qs('#comboRingLabel').textContent = 'x' + gameState.comboMultiplier;
}

/* ---------- Timer / speed ramp ---------- */
function startTimerLoop(){
  clearInterval(gameState.timerIntervalId);
  gameState.timerIntervalId = setInterval(()=>{
    if(!gameState.running || gameState.paused) return;
    const frozen = Date.now() < gameState.freezeUntil;
    qs('#freezeIcon').classList.toggle('hidden', !frozen);
    if(frozen) return;
    gameState.timeLeft--;
    gameState.elapsed++;
    updateHUD();
    if(gameState.timeLeft <= 0){
      endGame(true);
    }
  }, 1000);
}

function startSpeedRamp(){
  clearInterval(gameState.speedRampIntervalId);
  gameState.speedRampIntervalId = setInterval(()=>{
    if(!gameState.running || gameState.paused) return;
    if(Date.now() < gameState.slowUntil) return; // don't ramp while slowed
    gameState.baseSpawnInterval = Math.max(260, gameState.baseSpawnInterval * 0.9);
    gameState.baseLifetime = Math.max(650, gameState.baseLifetime * 0.93);
    applySpeedForElapsed();
  }, 10000);
}
function applySpeedForElapsed(){
  if(Date.now() < gameState.slowUntil) return;
  gameState.spawnInterval = gameState.baseSpawnInterval;
  gameState.lifetime = gameState.baseLifetime;
}

/* ---------- HUD ---------- */
function updateHUD(){
  qs('#hudTimer').textContent = formatTime(gameState.timeLeft);
  qs('.timer-item').classList.toggle('low-time', gameState.timeLeft <= 10 && gameState.timeLeft > 0);
  qs('#hudDifficulty').textContent = capitalize(gameState.difficulty);
  qs('#hudScore').textContent = gameState.score;
  qs('#hudApples').textContent = gameState.apples;
  qs('#hudBananas').textContent = gameState.bananas;
  qs('#hudHighScore').textContent = Math.max(highScore, gameState.score);
}
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function renderHearts(animateLoss){
  const row = qs('#heartsRow');
  const prevCount = row.children.length;
  row.innerHTML = '';
  for(let i=0;i<gameState.maxLives;i++){
    const span = document.createElement('span');
    span.className = 'heart';
    if(i < gameState.lives){
      span.textContent = '❤️';
    }else{
      span.textContent = '🤍';
      span.style.opacity = '.35';
    }
    if(animateLoss && i === gameState.lives){
      span.textContent = '❤️';
      span.classList.add('broken');
    }
    row.appendChild(span);
  }
}

/* ---------- Visual FX ---------- */
function spawnFloatingScore(x, y, text, negative){
  const el = document.createElement('div');
  el.className = 'floating-score' + (negative ? ' negative' : '');
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  field.appendChild(el);
  setTimeout(()=> el.remove(), 820);
}
function spawnParticles(x, y, color){
  for(let i=0;i<10;i++){
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = color;
    const angle = rand(0, Math.PI*2);
    const dist = rand(20,60);
    p.style.setProperty('--dx', Math.cos(angle)*dist + 'px');
    p.style.setProperty('--dy', Math.sin(angle)*dist + 'px');
    field.appendChild(p);
    setTimeout(()=> p.remove(), 520);
  }
}
function spawnExplosion(x,y){
  const ring = document.createElement('div');
  ring.className = 'explosion-ring';
  ring.style.left = x + 'px';
  ring.style.top = y + 'px';
  field.appendChild(ring);
  setTimeout(()=> ring.remove(), 520);
  spawnParticles(x, y, '#ff6b3d');
}
function shakeScreen(){
  const gs = qs('#screen-game');
  gs.classList.remove('screen-shake'); void gs.offsetWidth;
  gs.classList.add('screen-shake');
  setTimeout(()=> gs.classList.remove('screen-shake'), 360);
}

/* ---------- Stats / Achievements live check ---------- */
function refreshStatsSnapshotAndCheckAchievements(){
  checkAchievements({
    appleCount: gameState.apples,
    bananaCount: gameState.bananas,
    goldenCount: gameState.goldenCount,
    highestCombo: gameState.highestCombo,
    totalClicks: gameState.totalClicks,
    bombClicks: gameState.bombClicks,
    finished: false
  });
}

/* ---------- Pause / Resume ---------- */
qs('#pauseBtn').addEventListener('click', pauseGame);
qs('#resumeBtn').addEventListener('click', resumeGame);
qs('#restartFromPauseBtn').addEventListener('click', ()=>{
  qs('#overlay-pause').classList.add('hidden');
  startGame();
});
qs('#settingsFromPauseBtn').addEventListener('click', ()=>{
  qs('#overlay-pause').classList.add('hidden');
  stopAllLoops();
  showScreen('settings');
});
qs('#quitFromPauseBtn').addEventListener('click', ()=>{
  qs('#overlay-pause').classList.add('hidden');
  stopAllLoops();
  AudioEngine.stopMusic();
  showScreen('home');
});

function pauseGame(){
  if(!gameState || !gameState.running) return;
  gameState.paused = true;
  AudioEngine.stopMusic();
  qs('#overlay-pause').classList.remove('hidden');
}
function resumeGame(){
  if(!gameState) return;
  gameState.paused = false;
  AudioEngine.startMusic();
  qs('#overlay-pause').classList.add('hidden');
}

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && gameState && gameState.running){
    gameState.paused ? resumeGame() : pauseGame();
  }
});

function stopAllLoops(){
  if(!gameState) return;
  gameState.running = false;
  clearTimeout(gameState.spawnTimeoutId);
  clearInterval(gameState.timerIntervalId);
  clearInterval(gameState.magnetIntervalId);
  clearInterval(gameState.speedRampIntervalId);
  gameState.activeTargets.forEach(({el, expireId})=>{ clearTimeout(expireId); el.remove(); });
  gameState.activeTargets.clear();
}

/* ---------- End game ---------- */
function endGame(completedByTimer){
  if(!gameState || gameState.finished) return;
  gameState.finished = true;
  stopAllLoops();
  AudioEngine.stopMusic();

  const playTime = Math.round((Date.now() - gameState.startedAt)/1000);
  const accuracy = gameState.totalClicks > 0
    ? Math.round((gameState.hits / gameState.totalClicks) * 100)
    : 0;

  if(gameState.score > highScore){
    highScore = gameState.score;
    saveHighScore(highScore);
  }
  addToLeaderboard(gameState.score, capitalize(gameState.difficulty));

  checkAchievements({
    appleCount: gameState.apples,
    bananaCount: gameState.bananas,
    goldenCount: gameState.goldenCount,
    highestCombo: gameState.highestCombo,
    totalClicks: gameState.totalClicks,
    bombClicks: gameState.bombClicks,
    finished: true
  });

  const statsData = [
    ['Final Score', gameState.score],
    ['Apples', gameState.apples],
    ['Bananas', gameState.bananas],
    ['Golden Fruits', gameState.goldenCount],
    ['Bombs Clicked', gameState.bombClicks],
    ['Accuracy', accuracy + '%'],
    ['Highest Combo', gameState.highestCombo + 'x'],
    ['Play Time', playTime + 's'],
    ['Best Score', Math.max(highScore, gameState.score)],
  ];

  const won = completedByTimer && gameState.lives > 0;

  setTimeout(()=>{
    if(won){
      qs('#vFinalScore').textContent = gameState.score;
      fillStatsGrid('#vStatsGrid', statsData);
      showScreen('victory');
      launchConfetti();
      AudioEngine.victory();
    }else{
      qs('#goFinalScore').textContent = gameState.score;
      fillStatsGrid('#goStatsGrid', statsData);
      showScreen('gameover');
      AudioEngine.gameover();
    }
  }, 250);
}

function fillStatsGrid(selector, data){
  const grid = qs(selector);
  grid.innerHTML = '';
  data.forEach(([label, value])=>{
    const box = document.createElement('div');
    box.className = 'stat-box';
    box.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value">${value}</span>`;
    grid.appendChild(box);
  });
}

function launchConfetti(){
  const layer = qs('#confettiLayer');
  layer.innerHTML = '';
  const colors = ['#baff29','#ff9f1c','#ff477e','#ffd23f','#3ee6d0'];
  for(let i=0;i<70;i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = rand(0,100) + 'vw';
    p.style.background = pick(colors);
    p.style.animationDuration = rand(2.5,4.5) + 's';
    p.style.animationDelay = rand(0,1.2) + 's';
    p.style.transform = `rotate(${rand(0,360)}deg)`;
    layer.appendChild(p);
  }
  setTimeout(()=>{ layer.innerHTML=''; }, 6000);
}

/* ============================================================
   INIT
   ============================================================ */
refreshSettingsUI();
updateHomeStats();
qs('#homeMuteBtn').textContent = (settings.music || settings.sfx) ? '🔊' : '🔇';

window.addEventListener('beforeunload', ()=>{ saveSettings(settings); });

})();
