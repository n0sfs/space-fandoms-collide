// --- GLOBAL ERROR CATCHER ---
window.onerror = function(msg, url, line) {
    const c = document.getElementById("gameCanvas");
    if(c) {
        const ctx = c.getContext("2d");
        ctx.fillStyle = "black"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = "red"; ctx.font = "bold 20px Courier New";
        ctx.fillText("ENGINE FATAL ERROR:", 20, 50);
        ctx.fillStyle = "white"; ctx.font = "14px Courier New";
        ctx.fillText(msg, 20, 80); ctx.fillText("Line: " + line, 20, 100);
    }
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI Elements
const scoreEl = document.getElementById("scoreDisplay");
const levelEl = document.getElementById("levelDisplay");
const hpEl = document.getElementById("hpDisplay");
const shEl = document.getElementById("shDisplay");
const bombEl = document.getElementById("bombDisplay");
const heatEl = document.getElementById("heatDisplay");
const comboEl = document.getElementById("comboDisplay");
const scrapEl = document.getElementById("scrapDisplay");
const powerupEl = document.getElementById("powerupDisplay");

const menuOverlay = document.getElementById("menuOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const playerNameInput = document.getElementById("playerName");
const leaderboardList = document.getElementById("leaderboardList");
const menuScrapEl = document.getElementById("menuScrap");

const shipButtons = document.querySelectorAll(".ship-grid .ship-btn");
const diffButtons = document.querySelectorAll(".diff-btn");
const resumeBtn = document.getElementById("resumeBtn");
const restartGameBtn = document.getElementById("restartGameBtn");
const quitBtn = document.getElementById("quitBtn");

const upgBombBtn = document.getElementById("upgBombBtn");
const upgSpeedBtn = document.getElementById("upgSpeedBtn");
const upgShieldBtn = document.getElementById("upgShieldBtn");

// Persistent Data
let totalScrap = 0;
let upgrades = { bombs: 0, speed: 0, shield: 0 };
let highScores = [];

function loadSaveData() {
    try {
        let storedScores = localStorage.getItem("sfc_scores"); if (storedScores) highScores = JSON.parse(storedScores);
        let storedScrap = localStorage.getItem("sfc_scrap"); if (storedScrap) totalScrap = parseInt(storedScrap) || 0;
        let storedUpg = localStorage.getItem("sfc_upgrades");
        if (storedUpg) {
            let parsed = JSON.parse(storedUpg);
            upgrades.bombs = parsed.bombs || 0;
            upgrades.speed = parsed.speed || 0;
            upgrades.shield = parsed.shield || 0;
        }
        let storedMuted = localStorage.getItem("sfc_muted"); if (storedMuted !== null) muted = (storedMuted === "1");
    } catch(e) {
        localStorage.removeItem("sfc_scores"); localStorage.removeItem("sfc_scrap"); localStorage.removeItem("sfc_upgrades");
    }
    if (!highScores || highScores.length === 0) {
        highScores = [{name: "VDR", score: 10000}, {name: "LUK", score: 8000}, {name: "HAN", score: 6000}, {name: "BBA", score: 4000}, {name: "RD2", score: 2000}];
    }
    updateMuteUI();
    updateMenuUI();
}

function saveGameData() {
    try { localStorage.setItem("sfc_scores", JSON.stringify(highScores)); localStorage.setItem("sfc_scrap", totalScrap); localStorage.setItem("sfc_upgrades", JSON.stringify(upgrades)); } catch(e) {}
    updateMenuUI();
}

function checkAndSaveScore() {
    highScores.push({ name: currentPlayerName, score: score });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5);
    saveGameData();
}

function updateMenuUI() {
    if(menuScrapEl) menuScrapEl.innerText = totalScrap || 0;
    if(leaderboardList) { 
        leaderboardList.innerHTML = ""; 
        highScores.forEach((entry, i) => leaderboardList.innerHTML += `<div class="score-row"><span>${i+1}. ${entry.name}</span><span>${entry.score}</span></div>`); 
    }
    if(upgBombBtn) { upgBombBtn.innerText = `+1 BOMB (${upgrades.bombs}/3) - 500`; upgBombBtn.disabled = (totalScrap < 500 || upgrades.bombs >= 3); }
    if(upgSpeedBtn) { upgSpeedBtn.innerText = `+5% SPD (${upgrades.speed}/5) - 300`; upgSpeedBtn.disabled = (totalScrap < 300 || upgrades.speed >= 5); }
    if(upgShieldBtn) { upgShieldBtn.innerText = `+20 SHLD (${upgrades.shield}/5) - 400`; upgShieldBtn.disabled = (totalScrap < 400 || upgrades.shield >= 5); }
}

if(upgBombBtn) upgBombBtn.addEventListener("click", (e) => { e.preventDefault(); if(totalScrap>=500 && upgrades.bombs<3) { totalScrap-=500; upgrades.bombs++; saveGameData(); playSfx('powerup'); }});
if(upgSpeedBtn) upgSpeedBtn.addEventListener("click", (e) => { e.preventDefault(); if(totalScrap>=300 && upgrades.speed<5) { totalScrap-=300; upgrades.speed++; saveGameData(); playSfx('powerup'); }});
if(upgShieldBtn) upgShieldBtn.addEventListener("click", (e) => { e.preventDefault(); if(totalScrap>=400 && upgrades.shield<5) { totalScrap-=400; upgrades.shield++; saveGameData(); playSfx('powerup'); }});

// --- GLOBAL GAME STATE ---
let gameState = "MENU"; 
let gameDifficulty = "moderate"; 
let score = 0, level = 1, frames = 0;
let shake = 0, hyperspace = 0, nukeFlash = 0;
let playerHp = 100, playerMaxHp = 100, playerShield = 100, playerMaxShield = 100;
let bombs = 1, lives = 3, currentRunScrap = 0, combo = 1, comboTimer = 0, heat = 0, overheated = false;

let keys = {}; 
let mouse = { x: canvas.width/2, y: canvas.height/2, leftDown: false, rightDown: false };
let selectedShipType = "xwing", currentPlayerName = "AAA";
let bullets = [], enemyBullets = [], targets = [], powerups = [], particles = [], lightTrails = [], floatingTexts = [], scrapDrops = [];
let multishotTimer = 0, fireCooldown = 0, invulnTimer = 0, powerupSpawnedThisLevel = false;
let ship = { x: canvas.width / 2, y: canvas.height / 2, r: 15, angle: -Math.PI / 2, xv: 0, yv: 0, thrusting: false };

// --- 3D STATE VARIABLES ---
let is3DMode = false, levelTimer3D = 0;
const FOV = 400;
let camX = 0, camY = 0;
let targets3D = [], bullets3D = [], enemyBullets3D = [], stars3D = [];
for(let i=0; i<250; i++) stars3D.push({x: (Math.random()-0.5)*5000, y: (Math.random()-0.5)*5000, z: Math.random()*3000});

// --- AUDIO ---
let audioCtx;
let muted = false;
function initAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {} }
function playSfx(type) {
    if (!audioCtx || muted) return;
    try {
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), now = audioCtx.currentTime; osc.connect(gain); gain.connect(audioCtx.destination);
        if (type === 'shoot') { osc.type = 'square'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(110, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); } 
        else if (type === 'enemyShoot') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.15); gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15); osc.start(now); osc.stop(now + 0.15); }
        else if (type === 'boom') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(10, now + 0.3); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3); } 
        else if (type === 'powerup') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(now); osc.stop(now + 0.2); } 
        else if (type === 'hit') { osc.type = 'square'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(100, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
        else if (type === 'nuke') { osc.type = 'square'; osc.frequency.setValueAtTime(50, now); osc.frequency.linearRampToValueAtTime(20, now + 1.5); gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 1.5); osc.start(now); osc.stop(now + 1.5); }
        else if (type === 'scrap') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.05); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.05); osc.start(now); osc.stop(now + 0.05); }
        else if (type === 'glitch') { osc.type = 'square'; osc.frequency.setValueAtTime(60, now); osc.frequency.setValueAtTime(300, now + 0.03); osc.frequency.setValueAtTime(40, now + 0.06); osc.frequency.setValueAtTime(250, now + 0.09); gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12); osc.start(now); osc.stop(now + 0.12); }
    } catch (e) {}
}

function spawnParticles(x, y, color, count, speedMod = 1) { for(let i=0; i<count; i++) { let speed = (Math.random() * 6 + 2) * speedMod; let angle = Math.random() * Math.PI * 2; particles.push({ x: x || canvas.width/2, y: y || canvas.height/2, xv: Math.cos(angle) * speed, yv: Math.sin(angle) * speed, life: 1.0, color: color, size: Math.random() * 2 + 1 }); } }
function spawnText(x, y, text, color = "#fff", size = 16) { floatingTexts.push({ x: (x||canvas.width/2) + (Math.random()-0.5)*20, y: (y||canvas.height/2) + (Math.random()-0.5)*20, text: text, color: color, life: 1.0, size: size }); }
function spawnScrap(x, y, amount) { for(let i=0; i<amount; i++) scrapDrops.push({ x: x||canvas.width/2, y: y||canvas.height/2, xv: (Math.random()-0.5)*5, yv: (Math.random()-0.5)*5, life: 8.0 }); }

function updateDifficultyUI() { 
    diffButtons.forEach(b => b.classList.remove("active")); 
    let activeBtn = document.querySelector(`.diff-btn[data-diff="${gameDifficulty}"]`); 
    if (activeBtn) activeBtn.classList.add("active"); 
}

diffButtons.forEach(btn => { 
    const diffAction = (e) => { if(e) e.preventDefault(); initAudio(); gameDifficulty = btn.getAttribute("data-diff") || "moderate"; updateDifficultyUI(); }; 
    btn.addEventListener("click", diffAction); btn.addEventListener("touchstart", diffAction, { passive: false }); 
});

shipButtons.forEach(btn => { 
    const startAction = (e) => { 
        if(e) e.preventDefault(); 
        initAudio(); 
        try {
            const shipChoice = btn.getAttribute("data-ship") || "xwing"; 
            startGame(shipChoice); 
        } catch(err) {
            console.error("Start Game Error", err);
        }
    }; 
    btn.addEventListener("click", startAction); btn.addEventListener("touchstart", startAction, { passive: false }); 
});

function togglePause() {
    if (gameState === "PLAYING") { gameState = "PAUSED"; if (pauseOverlay) pauseOverlay.classList.remove("hidden"); }
    else if (gameState === "PAUSED") { gameState = "PLAYING"; if (pauseOverlay) pauseOverlay.classList.add("hidden"); lastTime = performance.now(); }
}

function toggleMute() {
    muted = !muted;
    try { localStorage.setItem("sfc_muted", muted ? "1" : "0"); } catch(e) {}
    updateMuteUI();
}
function updateMuteUI() { if (muteBtn) { muteBtn.textContent = muted ? "🔇" : "🔊"; muteBtn.classList.toggle("active", muted); } }

if (resumeBtn) { const resumeAction = (e) => { if(e) e.preventDefault(); initAudio(); if (gameState === "PAUSED") togglePause(); }; resumeBtn.addEventListener("click", resumeAction); resumeBtn.addEventListener("touchstart", resumeAction, { passive: false }); }
if (restartGameBtn) { const restartGameAction = (e) => { if(e) e.preventDefault(); initAudio(); if (pauseOverlay) pauseOverlay.classList.add("hidden"); startGame(selectedShipType); }; restartGameBtn.addEventListener("click", restartGameAction); restartGameBtn.addEventListener("touchstart", restartGameAction, { passive: false }); }
if (quitBtn) { const quitAction = (e) => { if(e) e.preventDefault(); initAudio(); if (pauseOverlay) pauseOverlay.classList.add("hidden"); if (menuOverlay) menuOverlay.classList.remove("hidden"); bullets = []; enemyBullets = []; particles = []; powerups = []; lightTrails = []; gameState = "MENU"; }; quitBtn.addEventListener("click", quitAction); quitBtn.addEventListener("touchstart", quitAction, { passive: false }); }

function triggerNuke() {
    if (bombs <= 0 || gameState !== "PLAYING") return;
    bombs--; playSfx('nuke'); nukeFlash = 1.0; shake = 30; 
    if (is3DMode) { enemyBullets3D = []; targets3D = []; }
    else {
        enemyBullets = [];
        targets.forEach(t => { if (t.hp !== undefined) { t.hp = Math.max(1, t.hp - 50); spawnText(t.x, t.y, "-50", "#ffcc00", 24); } else t.hp = -1; });
        targets = targets.filter(t => t.hp === undefined || t.hp > 0);
    }
    updateUI();
}

// --- INPUT ---
canvas.addEventListener("mousemove", (e) => { let rect = canvas.getBoundingClientRect(); mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width); mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height); });
canvas.addEventListener("mousedown", (e) => { if (e.button === 0) mouse.leftDown = true; if (e.button === 2) mouse.rightDown = true; initAudio(); });
canvas.addEventListener("mouseup", (e) => { if (e.button === 0) mouse.leftDown = false; if (e.button === 2) mouse.rightDown = false; });
canvas.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "Space") e.preventDefault(); if (e.code === "KeyP") togglePause(); if (e.code === "KeyB") triggerNuke(); if ((gameState === "GAMEOVER" || gameState === "VICTORY") && e.code === "KeyR") { if(menuOverlay) menuOverlay.classList.remove("hidden"); gameState = "MENU"; } });
window.addEventListener("keyup", (e) => keys[e.code] = false);

// --- TOUCH ---
const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add("touch-device");
const joystickZone = document.getElementById("joystickZone"); const joystickThumb = document.getElementById("joystickThumb");
const fireBtn = document.getElementById("fireBtn"); const pauseBtn = document.getElementById("pauseBtn"); const bombBtn = document.getElementById("bombBtn");
const muteBtn = document.getElementById("muteBtn");
const JOYSTICK_MAX = 45, JOYSTICK_DEADZONE = 10, JOYSTICK_AIM_DIST = 200;
let joystickTouchId = null, joystickCenter = { x: 0, y: 0 };

function handleJoystickMove(clientX, clientY) {
    let dx = clientX - joystickCenter.x, dy = clientY - joystickCenter.y; let dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_MAX) { dx = dx / dist * JOYSTICK_MAX; dy = dy / dist * JOYSTICK_MAX; dist = JOYSTICK_MAX; }
    if (joystickThumb) joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    if (dist > JOYSTICK_DEADZONE) { let angle = Math.atan2(dy, dx); mouse.x = ship.x + Math.cos(angle) * JOYSTICK_AIM_DIST; mouse.y = ship.y + Math.sin(angle) * JOYSTICK_AIM_DIST; mouse.rightDown = true; } else { mouse.rightDown = false; }
}
function resetJoystick() { joystickTouchId = null; mouse.rightDown = false; if (joystickThumb) joystickThumb.style.transform = "translate(0px, 0px)"; }
if (joystickZone) {
    joystickZone.addEventListener("touchstart", (e) => { e.preventDefault(); initAudio(); let t = e.changedTouches[0], rect = joystickZone.getBoundingClientRect(); joystickTouchId = t.identifier; joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; handleJoystickMove(t.clientX, t.clientY); }, { passive: false });
    joystickZone.addEventListener("touchmove", (e) => { e.preventDefault(); for (let t of e.changedTouches) if (t.identifier === joystickTouchId) handleJoystickMove(t.clientX, t.clientY); }, { passive: false });
    const endJoystickTouch = (e) => { for (let t of e.changedTouches) if (t.identifier === joystickTouchId) resetJoystick(); };
    joystickZone.addEventListener("touchend", endJoystickTouch); joystickZone.addEventListener("touchcancel", endJoystickTouch);
}
if (fireBtn) {
    fireBtn.addEventListener("touchstart", (e) => { e.preventDefault(); initAudio(); mouse.leftDown = true; fireBtn.classList.add("active"); }, { passive: false });
    const endFireTouch = (e) => { e.preventDefault(); mouse.leftDown = false; fireBtn.classList.remove("active"); };
    fireBtn.addEventListener("touchend", endFireTouch, { passive: false }); fireBtn.addEventListener("touchcancel", endFireTouch, { passive: false });
}
if (bombBtn) { bombBtn.addEventListener("touchstart", (e) => { e.preventDefault(); bombBtn.classList.add("active"); triggerNuke(); }, { passive: false }); bombBtn.addEventListener("touchend", () => bombBtn.classList.remove("active")); }
if (pauseBtn) { const pauseBtnAction = (e) => { if(e) e.preventDefault(); togglePause(); }; pauseBtn.addEventListener("touchstart", pauseBtnAction, { passive: false }); pauseBtn.addEventListener("mousedown", pauseBtnAction); }
if (muteBtn) { const muteBtnAction = (e) => { if(e) e.preventDefault(); initAudio(); toggleMute(); }; muteBtn.addEventListener("touchstart", muteBtnAction, { passive: false }); muteBtn.addEventListener("click", muteBtnAction); }

// Boot Game Settings
updateDifficultyUI();
loadSaveData();

function applyGlow(ctx, color, blur) { ctx.shadowBlur = blur; ctx.shadowColor = color; }
function clearGlow(ctx) { ctx.shadowBlur = 0; }
// Single cheap glow pass drawn behind a hull so it pops against the black backdrop, without
// paying shadowBlur's cost on every individual hull stroke/fill.
function popHalo(ctx, r, color, alpha = 0.55) {
    applyGlow(ctx, color, r * 1.1);
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0; clearGlow(ctx);
}
function createBolt(angOffset, spd = 12, isEnemy = false, customX = null, customY = null, customAng = null) {
    let sx = customX !== null ? customX : (ship.x || canvas.width/2); let sy = customY !== null ? customY : (ship.y || canvas.height/2);
    let ang = customAng !== null ? customAng : ship.angle + angOffset; let rOffset = isEnemy ? 0 : ship.r;
    return { x: sx + rOffset * Math.cos(ang), y: sy + rOffset * Math.sin(ang), xv: spd * Math.cos(ang), yv: spd * Math.sin(ang), range: canvas.width * 0.8, isEnemy: isEnemy };
}

// --- SHIPS ---
const ShipDesigns = {
    xwing: { name: "X-WING", laserColor: "#ff3333", stats: { thrust: 6, fric: 0.98, fireRate: 0.25, heat: 12 },
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ff3333");
            let hullGrad = ctx.createLinearGradient(-r, -r, r, r); hullGrad.addColorStop(0, "#e8e8ff"); hullGrad.addColorStop(1, "#576879");
            ctx.fillStyle = "#8a9ea8"; ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-r/2, 0); ctx.lineTo(-r, -r*1.3); ctx.lineTo(-r/4, -r*1.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r/2, 0); ctx.lineTo(-r, r*1.3); ctx.lineTo(-r/4, r*1.3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#222"; ctx.fillRect(-r*1.1, -r*0.6, r*0.3, r*0.2); ctx.fillRect(-r*1.1, r*0.4, r*0.3, r*0.2);
            ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r/4, -r*1.3); ctx.lineTo(r*0.9, -r*1.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r/4, r*1.3); ctx.lineTo(r*0.9, r*1.3); ctx.stroke();
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r*1.4, 0); ctx.lineTo(r/2, -r/4); ctx.lineTo(-r, -r/4); ctx.lineTo(-r, r/4); ctx.lineTo(r/2, r/4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#112233"; ctx.beginPath(); ctx.ellipse(r*0.2, 0, r*0.3, r*0.1, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#0055ff"; ctx.beginPath(); ctx.arc(-r*0.2, 0, r/6, 0, Math.PI*2); ctx.fill(); 
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r-2, -r/2, 4, 0, Math.PI*2); ctx.arc(-r-2, r/2, 4, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    falcon: { name: "FALCON", laserColor: "#ff3333", stats: { thrust: 5, fric: 0.97, fireRate: 0.35, heat: 18 },
        fire: () => { bullets.push(createBolt(0)); bullets.push(createBolt(Math.PI)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ff3333");
            let hullGrad = ctx.createRadialGradient(0, 0, r*0.1, 0, 0, r); hullGrad.addColorStop(0, "#f0f0f0"); hullGrad.addColorStop(1, "#666666");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
            ctx.fillRect(r*0.3, -r*0.4, r*0.9, r*0.25); ctx.strokeRect(r*0.3, -r*0.4, r*0.9, r*0.25); ctx.fillRect(r*0.3, r*0.15, r*0.9, r*0.25); ctx.strokeRect(r*0.3, r*0.15, r*0.9, r*0.25);
            ctx.beginPath(); ctx.arc(-r/5, 0, r*0.9, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(-r/5, 0, r*0.5, 0, Math.PI*2); ctx.stroke(); 
            ctx.fillStyle = "#777"; ctx.beginPath(); ctx.moveTo(-r/5, r*0.7); ctx.lineTo(r*0.5, r*0.8); ctx.lineTo(r*0.5, r*0.6); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(r*0.6, r*0.75, r*0.25, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(r*0.65, r*0.75, r*0.1, 0, Math.PI*2); ctx.fill(); 
            ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(-r*0.4, -r*0.4, r*0.2, 0, Math.PI); ctx.fill(); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#33ccff", 20); ctx.fillStyle = "#e6ffff"; ctx.fillRect(-r*1.1, -r*0.5, 6 + Math.random()*4, r); clearGlow(ctx); }
        }
    },
    tiefighter: { name: "TIE FIGHTER", laserColor: "#33ff33", stats: { thrust: 8, fric: 0.99, fireRate: 0.15, heat: 8 },
        fire: () => { bullets.push(createBolt(-0.1)); bullets.push(createBolt(0.1)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#33ff33");
            let ballGrad = ctx.createRadialGradient(-r/8, -r/8, r/10, 0, 0, r/2); ballGrad.addColorStop(0, "#aaa"); ballGrad.addColorStop(1, "#111");
            ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r/2); ctx.lineTo(0, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, r/2); ctx.lineTo(0, r*1.2); ctx.stroke();
            let panGrad = ctx.createLinearGradient(0, -r*1.2, 0, r*1.2); panGrad.addColorStop(0,"#050505"); panGrad.addColorStop(0.5,"#444"); panGrad.addColorStop(1,"#050505");
            ctx.lineWidth = 6; ctx.strokeStyle = panGrad; ctx.beginPath(); ctx.moveTo(-r*0.8, -r*1.2); ctx.lineTo(r*0.8, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.8, r*1.2); ctx.lineTo(r*0.8, r*1.2); ctx.stroke();
            ctx.fillStyle = ballGrad; ctx.beginPath(); ctx.arc(0, 0, r/2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, r/4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r/4, 0); ctx.lineTo(r/4, 0); ctx.moveTo(0, -r/4); ctx.lineTo(0, r/4); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#ff2222", 15); ctx.fillStyle = "#ffaaaa"; ctx.beginPath(); ctx.arc(-r/2, 0, 4, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    enterprise: { name: "ENTERPRISE", laserColor: "#33ccff", stats: { thrust: 4, fric: 0.95, fireRate: 0.55, heat: 25 },
        fire: () => { let b = createBolt(0, 15); b.r = 6; bullets.push(b); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#33ccff");
            let hullGrad = ctx.createRadialGradient(r*0.5, -r*0.2, 0, r*0.5, 0, r*0.8); hullGrad.addColorStop(0, "#ffffff"); hullGrad.addColorStop(1, "#8090a0");
            ctx.fillStyle = "#a0b0c0"; ctx.strokeStyle = "#445566"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-r*0.3, 0, r*0.7, r*0.25, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.ellipse(-r*0.9, 0, r*0.1, r*0.2, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#708090"; ctx.fillRect(-r*1.1, -r, r*1.4, r*0.3); ctx.strokeRect(-r*1.1, -r, r*1.4, r*0.3); ctx.fillRect(-r*1.1, r*0.7, r*1.4, r*0.3); ctx.strokeRect(-r*1.1, r*0.7, r*1.4, r*0.3);
            ctx.fillStyle = hullGrad; ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.8, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.4, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.2, 0, Math.PI*2); ctx.stroke(); 
            if (thrusting) { applyGlow(ctx, "#00d4ff", 20); ctx.fillStyle = "#e0f7fa"; ctx.fillRect(-r*0.9, -r*0.95, r*0.8, r*0.2); ctx.fillRect(-r*0.9, r*0.75, r*0.8, r*0.2); applyGlow(ctx, "#ff5500", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r*0.3, 0, 4, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    apollo: { name: "APOLLO", laserColor: "#ffaa00", stats: { thrust: 9, fric: 1.0, fireRate: 0.25, heat: 15 }, 
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ffaa00");
            let bodyGrad = ctx.createLinearGradient(-r, -r*0.4, r, r*0.4); bodyGrad.addColorStop(0, "#ccc"); bodyGrad.addColorStop(0.5, "#fff"); bodyGrad.addColorStop(1, "#777");
            ctx.fillStyle = bodyGrad; ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.fillRect(-r*1.2, -r*0.4, r*1.4, r*0.8); ctx.strokeRect(-r*1.2, -r*0.4, r*1.4, r*0.8);
            ctx.fillStyle = "#d32f2f"; ctx.fillRect(-r*0.4, -r*0.4, r*0.1, r*0.8); ctx.fillStyle = "#1976d2"; ctx.fillRect(r*0.2, -r*0.4, r*0.05, r*0.8);
            ctx.fillStyle = "#bbb"; ctx.beginPath(); ctx.moveTo(r*0.2, -r*0.4); ctx.lineTo(r*1.2, 0); ctx.lineTo(r*0.2, r*0.4); ctx.fill(); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#ff7700", 25); ctx.fillStyle = "#ffbb00"; ctx.beginPath(); ctx.moveTo(-r*1.2, -r*0.4); ctx.lineTo(-r*3.5, 0); ctx.lineTo(-r*1.2, r*0.4); ctx.fill(); clearGlow(ctx); }
        }
    },
    serenity: { name: "SERENITY", laserColor: "#ffaa00", stats: { thrust: 7, fric: 0.98, fireRate: 0.25, heat: 12 },
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ffaa00");
            let hullGrad = ctx.createLinearGradient(0, -r, 0, r); hullGrad.addColorStop(0, "#a5c2b8"); hullGrad.addColorStop(1, "#5e756c");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#222"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-r*0.2, 0, r*0.6, r*0.25, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillRect(r*0.4, -r*0.1, r*0.5, r*0.2); ctx.strokeRect(r*0.4, -r*0.1, r*0.5, r*0.2); ctx.beginPath(); ctx.arc(r*0.9, 0, r*0.18, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ffcc66"; ctx.fillRect(r*0.85, -r*0.05, r*0.1, r*0.1); ctx.fillStyle = "#445544"; ctx.fillRect(-r*0.1, -r*0.6, r*0.35, r*0.4); ctx.fillRect(-r*0.1, r*0.2, r*0.35, r*0.4);
            if (thrusting) { applyGlow(ctx, "#ffaa00", 25); ctx.fillStyle = "#ffffaa"; ctx.beginPath(); ctx.arc(-r*1.1, 0, r*0.2, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    borg: { name: "BORG CUBE", laserColor: "#00ff00", stats: { thrust: 3, fric: 0.90, fireRate: 1.5, heat: 40 }, 
        fire: () => { for(let i=0; i<Math.PI*2; i+=Math.PI*2/5) bullets.push(createBolt(i, 8)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#00ff00");
            let cubeGrad = ctx.createRadialGradient(-r*0.2, -r*0.2, 0, 0, 0, r); cubeGrad.addColorStop(0, "#333"); cubeGrad.addColorStop(1, "#050505");
            ctx.fillStyle = cubeGrad; ctx.strokeStyle = "#005500"; ctx.lineWidth = 1; ctx.fillRect(-r*0.8, -r*0.8, r*1.6, r*1.6); ctx.strokeRect(-r*0.8, -r*0.8, r*1.6, r*1.6);
            ctx.beginPath(); for(let i=-r*0.8; i<=r*0.8; i+=r*0.32) { ctx.moveTo(i, -r*0.8); ctx.lineTo(i, r*0.8); ctx.moveTo(-r*0.8, i); ctx.lineTo(r*0.8, i); } ctx.stroke();
            applyGlow(ctx, "#00ff00", 10); ctx.fillStyle = "#00ff00"; ctx.fillRect(-r*0.4, -r*0.4, 2, 2); ctx.fillRect(r*0.2, r*0.5, 2, 2); ctx.fillRect(r*0.6, -r*0.2, 2, 2); clearGlow(ctx);
            if (thrusting) { applyGlow(ctx, "#00ff00", 15); ctx.fillStyle = "#aaffaa"; ctx.fillRect(-r*0.8, -r*0.8, 4, r*1.6); clearGlow(ctx); }
        }
    },
    pelican: { name: "PELICAN", laserColor: "#00aaff", stats: { thrust: 5, fric: 0.96, fireRate: 0.65, heat: 22 },
        fire: () => { bullets.push(createBolt(0)); bullets.push(createBolt(-0.15)); bullets.push(createBolt(0.15)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#00aaff");
            let camoGrad = ctx.createLinearGradient(-r, -r, r, r); camoGrad.addColorStop(0, "#4a5225"); camoGrad.addColorStop(1, "#2b3012");
            ctx.fillStyle = camoGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.fillRect(-r*0.8, -r*0.3, r*1.6, r*0.6); ctx.strokeRect(-r*0.8, -r*0.3, r*1.6, r*0.6);
            ctx.beginPath(); ctx.moveTo(-r*0.4, -r*0.3); ctx.lineTo(-r*0.6, -r*0.9); ctx.lineTo(r*0.2, -r*0.9); ctx.lineTo(r*0.4, -r*0.3); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.4, r*0.3); ctx.lineTo(-r*0.6, r*0.9); ctx.lineTo(r*0.2, r*0.9); ctx.lineTo(r*0.4, r*0.3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#aaeeff"; ctx.beginPath(); ctx.arc(r*0.8, 0, r*0.15, 0, Math.PI*2); ctx.fill(); 
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.fillRect(-r*0.9, -r*0.2, 5, r*0.4); ctx.fillRect(-r*0.7, -r*0.8, 5, r*0.3); ctx.fillRect(-r*0.7, r*0.5, 5, r*0.3); clearGlow(ctx); }
        }
    },
    tardis: { name: "TARDIS", laserColor: "#ffffff", stats: { thrust: 6, fric: 0.99, fireRate: 1.0, heat: 25 },
        fire: () => { let b = createBolt(0, 8); b.r = 20; b.range = canvas.width*0.4; bullets.push(b); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#3399ff");
            let boxGrad = ctx.createLinearGradient(-r, 0, r, 0); boxGrad.addColorStop(0, "#002244"); boxGrad.addColorStop(0.5, "#004488"); boxGrad.addColorStop(1, "#002244");
            ctx.fillStyle = boxGrad; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.fillRect(-r*0.7, -r*0.7, r*1.4, r*1.4); ctx.strokeRect(-r*0.7, -r*0.7, r*1.4, r*1.4); ctx.strokeRect(-r*0.5, -r*0.5, r*1.0, r*1.0);
            ctx.fillStyle = "#dddddd"; ctx.fillRect(r*0.2, -r*0.5, r*0.3, r*0.3); ctx.fillRect(r*0.2, r*0.2, r*0.3, r*0.3); 
            applyGlow(ctx, "#ffffff", 15); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); clearGlow(ctx); 
            if (thrusting) { applyGlow(ctx, "#0088ff", 25); ctx.strokeStyle = "#00aaff"; ctx.lineWidth = 3; ctx.strokeRect(-r*0.8, -r*0.8, r*1.6, r*1.6); clearGlow(ctx); }
        }
    },
    viper: { name: "VIPER", laserColor: "#ff2200", stats: { thrust: 7, fric: 0.98, fireRate: 0.15, heat: 8 }, 
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ff2200");
            let hullGrad = ctx.createLinearGradient(-r, 0, r, 0); hullGrad.addColorStop(0, "#d0d0d0"); hullGrad.addColorStop(1, "#ffffff");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#222"; ctx.lineWidth = 1; ctx.fillRect(-r*1.2, -r*0.45, r*0.4, r*0.25); ctx.fillRect(-r*1.2, r*0.2, r*0.4, r*0.25); ctx.fillRect(-r*1.2, -r*0.12, r*0.4, r*0.24); 
            ctx.beginPath(); ctx.moveTo(-r*0.8, -r*0.3); ctx.lineTo(r*0.2, -r*0.2); ctx.lineTo(r*1.3, -r*0.05); ctx.lineTo(r*1.3, r*0.05); ctx.lineTo(r*0.2, r*0.2); ctx.lineTo(-r*0.8, r*0.3); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.6, -r*0.3); ctx.lineTo(-r*0.8, -r*0.9); ctx.lineTo(-r*0.1, -r*0.2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.6, r*0.3); ctx.lineTo(-r*0.8, r*0.9); ctx.lineTo(-r*0.1, r*0.2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#cc0000"; ctx.beginPath(); ctx.moveTo(r*0.2, -r*0.1); ctx.lineTo(r*0.9, -r*0.05); ctx.lineTo(r*0.9, 0); ctx.lineTo(r*0.2, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(r*0.2, r*0.1); ctx.lineTo(r*0.9, r*0.05); ctx.lineTo(r*0.9, 0); ctx.lineTo(r*0.2, 0); ctx.fill();
            ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.ellipse(-r*0.1, 0, r*0.35, r*0.12, 0, 0, Math.PI*2); ctx.fill(); 
            if (thrusting) { applyGlow(ctx, "#ffaa00", 20); ctx.fillStyle = "#fff"; ctx.fillRect(-r*1.3, -r*0.4, 4, r*0.15); ctx.fillRect(-r*1.3, r*0.25, 4, r*0.15); ctx.fillRect(-r*1.3, -r*0.07, 4, r*0.14); clearGlow(ctx); }
        }
    },
    nebuchadnezzar: { name: "NEBUCHADNEZZAR", laserColor: "#00ffff", stats: { thrust: 5, fric: 0.94, fireRate: 0.35, heat: 18 },
        fire: () => { let b = createBolt(0, 11); b.isEmpBolt = true; b.r = 6; bullets.push(b); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#00ffff");
            let hullGrad = ctx.createLinearGradient(-r, 0, r, 0); hullGrad.addColorStop(0, "#111519"); hullGrad.addColorStop(1, "#333b44");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.fillRect(-r, -r*0.3, r*1.5, r*0.6); ctx.strokeRect(-r, -r*0.3, r*1.5, r*0.6);
            ctx.beginPath(); ctx.moveTo(r*0.5, -r*0.3); ctx.lineTo(r*1.2, -r*0.1); ctx.lineTo(r*1.2, r*0.1); ctx.lineTo(r*0.5, r*0.3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-r*0.5, -r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.2, -r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(-r*0.5, r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.2, r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#88ddff"; ctx.beginPath(); ctx.arc(-r*0.5, -r*0.5, r*0.15, 0, Math.PI*2); ctx.arc(r*0.2, -r*0.5, r*0.15, 0, Math.PI*2); ctx.arc(-r*0.5, r*0.5, r*0.15, 0, Math.PI*2); ctx.arc(r*0.2, r*0.5, r*0.15, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    lightship: { name: "LIGHTSHIP", laserColor: "#00ffff", stats: { thrust: 8, fric: 0.99, fireRate: 0.3, heat: 12 },
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            let hullGrad = ctx.createLinearGradient(-r, 0, r, 0); hullGrad.addColorStop(0, "#000"); hullGrad.addColorStop(1, "#111");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, -r*0.8); ctx.lineTo(-r*0.5, 0); ctx.lineTo(-r, r*0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r*0.8, 0); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#00ffff", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r*0.6, 0, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); if (frames % 4 === 0) lightTrails.push({ x: ship.x, y: ship.y, life: 8.0, maxLife: 8.0 }); }
        }
    },
    milano: { name: "MILANO", laserColor: "#ff9900", stats: { thrust: 7, fric: 0.96, fireRate: 0.2, heat: 16 },
        fire: () => { bullets.push(createBolt(-0.1)); bullets.push(createBolt(0.1)); bullets.push(createBolt(-0.25)); bullets.push(createBolt(0.25)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ff9900");
            let hullGrad = ctx.createLinearGradient(0, -r, 0, r); hullGrad.addColorStop(0, "#1976d2"); hullGrad.addColorStop(1, "#115293");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-r*0.5, 0); ctx.lineTo(-r*0.2, -r*1.2); ctx.lineTo(r*0.2, -r*1.2); ctx.lineTo(r*0.5, 0); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.5, 0); ctx.lineTo(-r*0.2, r*1.2); ctx.lineTo(r*0.2, r*1.2); ctx.lineTo(r*0.5, 0); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ff8800"; ctx.beginPath(); ctx.moveTo(-r*0.8, -r*0.2); ctx.lineTo(r*1.2, 0); ctx.lineTo(-r*0.8, r*0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.arc(r*0.2, 0, r*0.15, 0, Math.PI*2); ctx.fill(); 
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.fillRect(-r*0.9, -r*0.1, 4, r*0.2); clearGlow(ctx); }
        }
    },
    fsociety: { name: "FSOCIETY", laserColor: "#00ff00", stats: { thrust: 6, fric: 0.97, fireRate: 0.18, heat: 9 },
        fire: () => { let b = createBolt(0, 13); b.isHack = true; b.r = 5; bullets.push(b); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            let gx = (Math.random()-0.5)*4; let gy = (Math.random()-0.5)*4; 
            ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 1;
            ctx.strokeRect(-r/2 + gx, -r/2 + gy, r, r); ctx.strokeRect(-r/4 - gx, -r/4 - gy, r*1.5, r*0.5);
            ctx.beginPath(); ctx.moveTo(-r, -r + gx); ctx.lineTo(r, gy); ctx.lineTo(-r, r - gx); ctx.stroke();
            if (thrusting) { ctx.fillStyle = "#00ff00"; ctx.fillRect(-r-5+gx, -2+gy, 5, 4); }
        }
    }
};

// --- TARGETS ---
const TargetDesigns = {
    boss_station: {
        draw: (ctx, r, t) => {
            if (t.hitFlash > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); return; }
            popHalo(ctx, r, "#00ff44", 0.5);
            let sphereGrad = ctx.createRadialGradient(-r*0.3, -r*0.3, r*0.1, 0, 0, r); sphereGrad.addColorStop(0, "#667788"); sphereGrad.addColorStop(0.7, "#2b3238"); sphereGrad.addColorStop(1, "#0a0c0d");
            ctx.fillStyle = sphereGrad; ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#111"; ctx.fillRect(-r, -6, r*2, 12); ctx.fillStyle = "#333"; ctx.fillRect(-r, -2, r*2, 4);
            let dishGrad = ctx.createRadialGradient(r*0.4, -r*0.4, 0, r*0.4, -r*0.4, r*0.3); dishGrad.addColorStop(0, "#112211"); dishGrad.addColorStop(1, "#445544");
            ctx.fillStyle = dishGrad; ctx.beginPath(); ctx.arc(r*0.4, -r*0.4, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            if (t.chargeTimer > 0) { applyGlow(ctx, "#0f0", 25); ctx.fillStyle = "#afa"; ctx.beginPath(); ctx.arc(r*0.4, -r*0.4, r*0.1 + (Math.random()*5), 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
            else { applyGlow(ctx, "#0f0", 15); ctx.fillStyle = "#afa"; ctx.beginPath(); ctx.arc(r*0.4, -r*0.4, r*0.05, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
            if (t.hp !== undefined) { ctx.save(); ctx.rotate(-t.angle); let hp = Math.max(0, t.hp/t.maxHp); ctx.fillStyle = "red"; ctx.fillRect(-r, -r-20, r*2*hp, 6); ctx.restore(); }
        }
    },
    boss_mothership: {
        draw: (ctx, r, t) => {
            if (t.hitFlash > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); return; }
            ctx.fillStyle = "#3a4a5a"; ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r*0.3, -r); ctx.lineTo(-r, -r*0.5); ctx.lineTo(-r, r*0.5); ctx.lineTo(r*0.3, r); ctx.closePath(); ctx.fill(); ctx.stroke();
            if (t.nodes) {
                let allDead = true;
                t.nodes.forEach(n => {
                    if (n.hp > 0) {
                        allDead = false; let nx = Math.cos(n.ang) * r * 1.2; let ny = Math.sin(n.ang) * r * 1.2;
                        applyGlow(ctx, "#00ffff", 15); ctx.fillStyle = "#00ffff"; ctx.beginPath(); ctx.arc(nx, ny, 12, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
                        ctx.strokeStyle = "rgba(0, 255, 255, 0.5)"; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(nx, ny); ctx.stroke();
                    }
                });
                if (!allDead) { applyGlow(ctx, "#00ffff", 20); ctx.strokeStyle = "rgba(0, 255, 255, 0.3)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, r*1.4, 0, Math.PI*2); ctx.stroke(); clearGlow(ctx); }
            }
            if (t.hp !== undefined) { ctx.save(); ctx.rotate(-t.angle); let hp = Math.max(0, t.hp/t.maxHp); ctx.fillStyle = "red"; ctx.fillRect(-r, -r-20, r*2*hp, 6); ctx.restore(); }
        }
    },
    sentinel: {
        draw: (ctx, r, t) => {
            popHalo(ctx, r, "#ff0000", 0.5);
            ctx.fillStyle = "#111"; ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r*0.6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ff0000"; ctx.beginPath(); ctx.arc(r*0.4, 0, 3, 0, Math.PI*2); ctx.fill(); 
            ctx.beginPath(); ctx.moveTo(-r*0.5, -r*0.3); ctx.lineTo(-r - Math.random()*r*0.5, -r*0.8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.6, 0); ctx.lineTo(-r*1.2 - Math.random()*r*0.5, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.5, r*0.3); ctx.lineTo(-r - Math.random()*r*0.5, r*0.8); ctx.stroke();
        }
    },
    tie_advanced: {
        draw: (ctx, r) => {
            popHalo(ctx, r, "#ff0000", 0.5);
            let ballGrad = ctx.createRadialGradient(-r/8, -r/8, r/10, 0, 0, r/2); ballGrad.addColorStop(0, "#888"); ballGrad.addColorStop(1, "#222");
            ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r/2); ctx.lineTo(0, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, r/2); ctx.lineTo(0, r*1.2); ctx.stroke();
            ctx.lineWidth = 6; ctx.strokeStyle = "#111"; ctx.beginPath(); ctx.moveTo(-r*0.5, -r*1.2); ctx.lineTo(r*0.8, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.5, r*1.2); ctx.lineTo(r*0.8, r*1.2); ctx.stroke();
            ctx.fillStyle = ballGrad; ctx.beginPath(); ctx.arc(0, 0, r/2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#f00"; ctx.beginPath(); ctx.arc(0, 0, r/4, 0, Math.PI*2); ctx.fill(); 
        }
    },
    star_destroyer: {
        draw: (ctx, r) => {
            popHalo(ctx, r, "#33aaff", 0.5);
            let sdGrad = ctx.createLinearGradient(r, 0, -r, 0); sdGrad.addColorStop(0, "#eceff1"); sdGrad.addColorStop(1, "#455a64");
            ctx.fillStyle = sdGrad; ctx.strokeStyle = "#263238"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, -r/1.5); ctx.lineTo(-r, r/1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, 0); ctx.stroke(); 
            ctx.fillStyle = "#78909c"; ctx.fillRect(-r*0.8, -r/4, r*0.4, r/2); ctx.strokeRect(-r*0.8, -r/4, r*0.4, r/2); 
            applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r, -r/3, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-r, 0, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-r, r/3, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
        }
    },
    tie_interceptor: {
        draw: (ctx, r) => {
            popHalo(ctx, r, "#ff0000", 0.5);
            ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r/3); ctx.lineTo(0, -r*0.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, r/3); ctx.lineTo(0, r*0.9); ctx.stroke();
            ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(-r/2, -r*1.2); ctx.lineTo(r*0.8, -r*0.9); ctx.lineTo(-r/4, -r*0.6); ctx.fill(); ctx.beginPath(); ctx.moveTo(-r/2, r*1.2); ctx.lineTo(r*0.8, r*0.9); ctx.lineTo(-r/4, r*0.6); ctx.fill();
            ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(0, 0, r/3, 0, Math.PI*2); ctx.fill(); 
        }
    },
    tie_fighter: { draw: (ctx, r) => { ShipDesigns.tiefighter.draw(ctx, r, false); } },
    satellite: {
        draw: (ctx, r) => {
            popHalo(ctx, r, "#00ffcc", 0.45);
            // solar arrays: gradient-shaded cells with a thin frame rail
            let panelGrad = ctx.createLinearGradient(0, -r*0.3, 0, r*0.3);
            panelGrad.addColorStop(0, "#8c9eea"); panelGrad.addColorStop(0.5, "#33429e"); panelGrad.addColorStop(1, "#5c6bc0");
            ctx.fillStyle = panelGrad; ctx.strokeStyle = "#0d1642"; ctx.lineWidth = 1.5;
            ctx.fillRect(-r*1.8, -r*0.3, r*1.2, r*0.6); ctx.strokeRect(-r*1.8, -r*0.3, r*1.2, r*0.6);
            ctx.fillRect(r*0.6, -r*0.3, r*1.2, r*0.6); ctx.strokeRect(r*0.6, -r*0.3, r*1.2, r*0.6);
            ctx.strokeStyle = "rgba(15, 20, 60, 0.7)"; ctx.lineWidth = 0.75; ctx.beginPath();
            for(let i=-r*1.6; i<-r*0.6; i+=r*0.3) { ctx.moveTo(i, -r*0.3); ctx.lineTo(i, r*0.3); }
            for(let i=r*0.8; i<r*1.8; i+=r*0.3) { ctx.moveTo(i, -r*0.3); ctx.lineTo(i, r*0.3); }
            ctx.moveTo(-r*1.8, 0); ctx.lineTo(-r*0.6, 0); ctx.moveTo(r*0.6, 0); ctx.lineTo(r*1.8, 0);
            ctx.stroke();
            // bus body wrapped in gold MLI thermal foil, the classic satellite tell
            let bodyGrad = ctx.createLinearGradient(-r*0.5, -r*0.5, r*0.5, r*0.5);
            bodyGrad.addColorStop(0, "#ffe27a"); bodyGrad.addColorStop(0.5, "#c9971f"); bodyGrad.addColorStop(1, "#7a5c14");
            ctx.fillStyle = bodyGrad; ctx.strokeStyle = "#3a2c08"; ctx.lineWidth = 1;
            ctx.fillRect(-r*0.5, -r*0.5, r, r); ctx.strokeRect(-r*0.5, -r*0.5, r, r);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.25)"; ctx.lineWidth = 0.75;
            ctx.beginPath(); ctx.moveTo(-r*0.3, -r*0.4); ctx.lineTo(-r*0.05, -r*0.1); ctx.lineTo(-r*0.35, r*0.15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r*0.1, -r*0.35); ctx.lineTo(r*0.3, -r*0.05); ctx.stroke();
            // antenna boom + dish
            ctx.strokeStyle = "#999"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r*0.5); ctx.lineTo(0, -r*0.95); ctx.stroke();
            let dishGrad = ctx.createRadialGradient(0, -r*1.0, 0, 0, -r*1.0, r*0.35);
            dishGrad.addColorStop(0, "#f5f5f5"); dishGrad.addColorStop(1, "#8a8a8a");
            ctx.fillStyle = dishGrad; ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(0, -r*1.0, r*0.32, r*0.2, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            applyGlow(ctx, "#00ffcc", 10); ctx.fillStyle = "#e0f7fa"; ctx.beginPath(); ctx.arc(0, 0, r*0.14, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
        }
    },
    asteroid: {
        draw: (ctx, r, t) => {
            if (!t || !t.vertices || t.vertices.length === 0) { Object.assign(t, generateJaggedAsteroid(r || 30)); }
            let pts = t.vertices;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) { ctx.lineTo(pts[i].x, pts[i].y); } 
            ctx.closePath();
            
            ctx.fillStyle = t.baseColor || "#444";
            ctx.fill();
            
            ctx.save(); ctx.clip(); 
            let safeR = Math.max(1, r * 1.2);
            let volGrad = ctx.createRadialGradient(-r*0.3, -r*0.3, 0, 0, 0, safeR);
            volGrad.addColorStop(0, "rgba(255, 255, 255, 0.28)");
            volGrad.addColorStop(0.5, "rgba(80, 80, 80, 0.4)");
            volGrad.addColorStop(1, t.shadowColor || "rgba(10, 10, 10, 0.95)");
            ctx.fillStyle = volGrad; ctx.fill();

            if (t.facets) {
                t.facets.forEach(f => {
                    ctx.beginPath(); ctx.moveTo(f.p1.x, f.p1.y); ctx.lineTo(f.p2.x, f.p2.y); ctx.lineTo(f.p3.x, f.p3.y); ctx.closePath();
                    ctx.fillStyle = f.color; ctx.fill();
                });
            }

            if (t.craters) {
                t.craters.forEach(c => {
                    let cr = Math.max(1, c.r);
                    let craterGrad = ctx.createRadialGradient(c.x - cr*0.2, c.y - cr*0.2, 0, c.x, c.y, cr);
                    craterGrad.addColorStop(0, "rgba(15, 15, 15, 0.85)"); craterGrad.addColorStop(0.75, "rgba(40, 40, 40, 0.55)"); craterGrad.addColorStop(1, "rgba(80, 80, 80, 0)");
                    ctx.beginPath(); ctx.arc(c.x, c.y, cr, 0, Math.PI * 2); ctx.fillStyle = craterGrad; ctx.fill();
                    // single soft rim highlight on the lit side, no radiating spokes
                    ctx.beginPath(); ctx.arc(c.x, c.y, cr * 0.92, Math.PI * 1.05, Math.PI * 1.75);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"; ctx.lineWidth = Math.max(0.5, cr * 0.12); ctx.stroke();
                });
            }
            ctx.restore();

            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) { ctx.lineTo(pts[i].x, pts[i].y); }
            ctx.closePath();
            let rimGrad = ctx.createLinearGradient(-r, -r, r, r);
            rimGrad.addColorStop(0, "rgba(210, 210, 210, 0.9)"); rimGrad.addColorStop(0.5, "#111"); rimGrad.addColorStop(1, "#000");
            ctx.strokeStyle = rimGrad; ctx.lineWidth = 2; ctx.stroke();
        }
    }
};

function generateJaggedAsteroid(r) {
    let vertices = [];
    let numPoints = 12 + Math.floor(Math.random() * 6);
    let phase = Math.random() * Math.PI * 2;
    let elongation = 0.8 + Math.random() * 0.2; 
    let stretchAngle = Math.random() * Math.PI;

    for (let i = 0; i < numPoints; i++) {
        let angle = (i / numPoints) * Math.PI * 2;
        let wave = Math.sin(angle * (2 + Math.random()*2) + phase) * 0.1;
        let dist = r * (0.85 + Math.random() * 0.15 + wave);
        let dx = Math.cos(angle) * dist; let dy = Math.sin(angle) * dist * elongation;
        let rx = dx * Math.cos(stretchAngle) - dy * Math.sin(stretchAngle);
        let ry = dx * Math.sin(stretchAngle) + dy * Math.cos(stretchAngle);
        vertices.push({ x: rx, y: ry });
    }

    let craters = [];
    let numCraters = Math.floor(Math.random() * 3) + (r > 30 ? 1 : 0);
    for(let i=0; i<numCraters; i++) { craters.push({ x: (Math.random()-0.5) * r * 1.2, y: (Math.random()-0.5) * r * 1.2, r: Math.max(2, r * (0.15 + Math.random() * 0.25)) }); }

    // Tint the rock like a real asteroid family: neutral C-type, rusty S-type, or icy blue-gray.
    let tint = Math.random();
    let rMul = 1, bMul = 1;
    if (tint >= 0.4 && tint < 0.7) { rMul = 1.15; bMul = 0.8; }
    else if (tint >= 0.7) { rMul = 0.82; bMul = 1.18; }
    const shade = (gray) => `rgb(${Math.min(255, Math.round(gray * rMul))}, ${gray}, ${Math.min(255, Math.round(gray * bMul))})`;

    let baseGray = 30 + Math.floor(Math.random() * 70);
    let baseColor = shade(baseGray);
    let darkGray = Math.max(5, baseGray - 25);
    let shadowColor = shade(darkGray);

    // A few broad, soft shading patches (not sharp shards) to suggest mineral variation.
    let facets = [];
    let numFacets = 2 + Math.floor(Math.random()*3);
    for(let i=0; i<numFacets; i++) {
        let cx = (Math.random()-0.5)*r*0.8; let cy = (Math.random()-0.5)*r*0.8;
        let size = Math.max(1, r * (0.7 + Math.random()*0.5));
        let p1 = {x: cx + (Math.random()-0.5)*size, y: cy + (Math.random()-0.5)*size}; let p2 = {x: cx + (Math.random()-0.5)*size, y: cy + (Math.random()-0.5)*size}; let p3 = {x: cx + (Math.random()-0.5)*size, y: cy + (Math.random()-0.5)*size};
        let fGray = baseGray + (Math.random() > 0.5 ? 10 : -10);
        let rgb = shade(Math.max(0, fGray));
        let color = rgb.replace('rgb', 'rgba').replace(')', ', 0.3)');
        facets.push({p1, p2, p3, color});
    }

    return { vertices, craters, facets, baseColor, shadowColor };
}

function spawnTarget(type, baseR, speedMod, specificX=null, specificY=null) {
    let x = specificX, y = specificY;
    if (x === null) { let safeCounter = 0; do { x = Math.random() * (canvas.width || 800); y = Math.random() * (canvas.height || 600); safeCounter++; } while (Math.hypot((ship.x || 400) - x, (ship.y || 300) - y) < 200 && safeCounter < 50); }
    if (type === "asteroid" && Math.random() < 0.1) { type = "satellite"; baseR = 25; }

    let spdMult = type === "asteroid" ? 0.3 : (type === "satellite" ? 0.2 : 1.0);
    let t = { type: type, x: x, y: y, r: baseR, xv: (Math.random() - 0.5) * spdMult * speedMod, yv: (Math.random() - 0.5) * spdMult * speedMod, angle: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 1.5, stunned: 0 };
    if (type === "boss_station" || type === "boss_mothership") t.rotSpeed = 0.2;
    if (type === "tie_advanced") t.fireTimer = Math.random() * 2 + 1;
    if (type === "sentinel") t.chaseSpeed = 3 * speedMod;
    if (type === "asteroid") Object.assign(t, generateJaggedAsteroid(baseR));
    targets.push(t);
}

function spawnTarget3D() {
    let rand = Math.random();
    let type = "asteroid"; let r = 40 + Math.random() * 40;
    if (rand < 0.1) { type = "satellite"; r = 25; } else if (rand < 0.4) { type = "tie_fighter"; r = 20; }
    
    let t = {
        type: type, x: camX + (Math.random() - 0.5) * 4000, y: camY + (Math.random() - 0.5) * 4000, z: 4000,
        r: r, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, vz: 800 + Math.random() * 400 + (level * 20),
        angle: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 2, hp: (type==="tie_fighter"||type==="satellite") ? 1 : 2
    };
    if (type === "asteroid") Object.assign(t, generateJaggedAsteroid(r));
    if (type === "tie_fighter") t.fireTimer = 1.0 + Math.random() * 2.0;
    targets3D.push(t);
}

function spawnPowerup() {
    let rand = Math.random(); let type = 'M'; if (rand > 0.4) type = 'S'; if (rand > 0.7) type = 'H'; if (rand > 0.9) type = 'B';
    powerups.push({ x: Math.random() * canvas.width, y: -20, xv: (Math.random() - 0.5) * 2, yv: 1 + Math.random(), r: 15, angle: 0, type: type });
    powerupSpawnedThisLevel = true;
}

function updateUI() {
    if(scoreEl) scoreEl.innerText = score; if(levelEl) levelEl.innerText = level; 
    if(hpEl) hpEl.innerText = Math.ceil(playerHp); if(shEl) shEl.innerText = Math.ceil(playerShield);
    if(bombEl) bombEl.innerText = bombs; if(comboEl) comboEl.innerText = combo + "x"; if(scrapEl) scrapEl.innerText = currentRunScrap;
    
    if(heatEl) {
        heatEl.innerText = Math.ceil(heat) + "%";
        if(overheated) heatEl.style.color = "#ff0000"; else if (heat > 75) heatEl.style.color = "#ff5500"; else heatEl.style.color = "#ffff00";
    }
    let pTxt = ""; if(multishotTimer > 0) pTxt += `[MULTI ${Math.ceil(multishotTimer)}s]`;
    if(powerupEl) { powerupEl.innerText = pTxt || "NONE"; powerupEl.style.color = (multishotTimer > 0 ? "#ff00ff" : "#33ccff"); }
}

function damagePlayer(amt) {
    if (invulnTimer > 0 || gameState !== "PLAYING") return;
    playSfx('hit'); shake += 5; spawnParticles(ship.x || canvas.width/2, ship.y || canvas.height/2, "#ffaa00", 10);
    spawnText(ship.x || canvas.width/2, ship.y || canvas.height/2, `-${amt}`, "#ff3333", 20);
    combo = 1; comboTimer = 0; 
    
    if (playerShield > 0) { 
        playerShield -= amt; 
        if (playerShield < 0) { playerHp += playerShield; playerShield = 0; playSfx('boom'); spawnText(ship.x || canvas.width/2, (ship.y || canvas.height/2)-20, "SHIELD BROKEN", "#00ffff", 14); } 
    } else { playerHp -= amt; }
    
    if (playerHp <= 0) {
        playSfx('boom'); shake = 20; spawnParticles(ship.x || canvas.width/2, ship.y || canvas.height/2, "#ff3300", 50); multishotTimer = 0;
        if (lives > 1) { lives--; ship.x = canvas.width/2; ship.y = canvas.height/2; ship.xv = 0; ship.yv = 0; invulnTimer = 3.0; playerHp = playerMaxHp; playerShield = playerMaxShield; updateUI(); } 
        else { lives = 0; playerHp = 0; playerShield = 0; updateUI(); totalScrap += currentRunScrap; checkAndSaveScore(); saveGameData(); gameState = "GAMEOVER"; }
    }
    updateUI();
}

function startGame(shipId) {
    let nameVal = "AAA"; if (playerNameInput && playerNameInput.value) { nameVal = playerNameInput.value.trim().toUpperCase(); } if(nameVal.length < 1) nameVal = "AAA"; 
    currentPlayerName = nameVal; selectedShipType = (ShipDesigns[shipId]) ? shipId : "xwing"; 
    
    if (menuOverlay) menuOverlay.classList.add("hidden");
    if (pauseOverlay) pauseOverlay.classList.add("hidden");
    
    score = 0; level = 1; currentRunScrap = 0;
    bombs = 1 + (upgrades.bombs || 0); playerMaxShield = 100 + ((upgrades.shield || 0) * 20); playerHp = playerMaxHp; playerShield = playerMaxShield; 
    combo = 1; comboTimer = 0; heat = 0; overheated = false; multishotTimer = 0; fireCooldown = 0; invulnTimer = 3.0; hyperspace = 0; nukeFlash = 0;
    ship.x = canvas.width / 2; ship.y = canvas.height / 2; ship.xv = 0; ship.yv = 0;
    
    bullets = []; enemyBullets = []; powerups = []; targets = []; particles = []; lightTrails = []; floatingTexts = []; scrapDrops = [];
    targets3D = []; bullets3D = []; enemyBullets3D = [];
    
    updateUI(); startLevel(); gameState = "PLAYING"; 
}

function startLevel() {
    targets = []; powerups = []; enemyBullets = []; lightTrails = []; floatingTexts = []; scrapDrops = []; powerupSpawnedThisLevel = false;
    ship.x = canvas.width / 2; ship.y = canvas.height / 2; ship.xv = 0; ship.yv = 0; invulnTimer = 2.0;
    
    is3DMode = (level % 7 === 0);

    if (is3DMode) {
        levelTimer3D = 30; targets3D = []; bullets3D = []; enemyBullets3D = []; camX = 0; camY = 0;
        spawnText(canvas.width/2, canvas.height/2, "HYPERSPACE ANOMALY!", "#ff00ff", 40); spawnText(canvas.width/2, canvas.height/2 + 40, "EVADE & SURVIVE 30s", "#00ffff", 20);
        return;
    }
    
    let diffMult = 1.0; let speedMult = 1.0;
    if (gameDifficulty === "easy") { diffMult = 0.6; speedMult = 0.7; } else if (gameDifficulty === "hard") { diffMult = 1.5; speedMult = 1.3; }
    let speedMod = speedMult + (level * 0.1 * speedMult);

    if (level % 5 === 0 && !is3DMode) {
        if (level % 15 === 0) {
            let numSentinels = Math.floor(40 * diffMult); for(let i=0; i<numSentinels; i++) spawnTarget("sentinel", 12, speedMod * 1.5);
        } else if (level % 10 === 0) {
            let bossR = 80 + (level * 1.2); spawnTarget("boss_mothership", bossR, speedMod * 0.2);
            let boss = targets[targets.length - 1]; 
            boss.maxHp = Math.floor((30 + (level * 5)) * diffMult); boss.hp = boss.maxHp; boss.hitFlash = 0; 
            boss.nodes = [{ang: 0, hp: 4}, {ang: Math.PI/2, hp: 4}, {ang: Math.PI, hp: 4}, {ang: Math.PI*1.5, hp: 4}];
        } else {
            let bossR = 70 + (level * 1.5); spawnTarget("boss_station", bossR, speedMod * 0.3); 
            let boss = targets[targets.length - 1]; 
            boss.maxHp = Math.floor((20 + (level * 4)) * diffMult); boss.hp = boss.maxHp; boss.hitFlash = 0; boss.spawnTimer = 2.0 / diffMult; boss.chargeTimer = 0;
            for (let i = 0; i < Math.floor(3 * diffMult); i++) spawnTarget("asteroid", 40 + Math.random()*20, speedMod);
        }
    } else {
        let numAsteroids = Math.floor((2 + Math.floor(level / 2)) * diffMult); if (numAsteroids < 1 && gameDifficulty !== 'easy') numAsteroids = 1;
        for (let i = 0; i < numAsteroids; i++) spawnTarget("asteroid", 30 + Math.random()*40, speedMod);
        
        let numShips = Math.floor(Math.floor(level / 3) * diffMult);
        for (let i = 0; i < numShips; i++) {
            let rand = Math.random();
            if (rand < 0.3) spawnTarget("tie_fighter", 15, speedMod * 1.2); else if (rand < 0.6) spawnTarget("tie_interceptor", 15, speedMod * 1.8);
            else if (rand < 0.8) spawnTarget("tie_advanced", 18, speedMod * 0.9); else spawnTarget("star_destroyer", 50, speedMod);
        }
        if (level > 4) {
            let numSentinels = Math.floor(Math.floor(level / 4) * diffMult); if (numSentinels < 1 && gameDifficulty !== 'easy') numSentinels = 1;
            for(let i=0; i<numSentinels; i++) spawnTarget("sentinel", 12, speedMod * 1.5);
        }
    }
}

for(let i=0; i<8; i++) spawnTarget("asteroid", 40, 2.0);

let lastTime = performance.now();
function loop(timestamp) {
    try {
        let dt = (timestamp - lastTime) / 1000; if (dt > 0.1 || isNaN(dt)) dt = 0.016; lastTime = timestamp; frames++;
        
        if (gameState === "PLAYING") { if (is3DMode) update3D(dt); else update(dt); } 
        else if (gameState === "LEVEL_TRANSITION") { hyperspace += dt; ship.x += 1000 * dt; if (hyperspace > 2.0) { hyperspace = 0; startLevel(); gameState = "PLAYING"; } } 
        else if (gameState === "MENU") {
            targets.forEach(t => { 
                t.x += t.xv * 0.5; t.y += t.yv * 0.5; t.angle += t.rotSpeed * dt * 0.5; 
                const wrap = (obj) => { if (obj.x < -obj.r) obj.x = canvas.width + obj.r; else if (obj.x > canvas.width + obj.r) obj.x = -obj.r; if (obj.y < -obj.r) obj.y = canvas.height + obj.r; else if (obj.y > canvas.height + obj.r) obj.y = -obj.r; };
                wrap(t); 
            });
        }
        if (is3DMode && gameState === "PLAYING") render3D(); else render(); 
    } catch (err) {
        if(ctx) { ctx.fillStyle = "red"; ctx.font = "bold 20px Courier New"; ctx.fillText("RUNTIME ERROR:", 20, 40); ctx.font = "14px Courier New"; ctx.fillText(err.message, 20, 70); }
    }
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop); 

function update3D(dt) {
    if (invulnTimer > 0) invulnTimer -= dt;
    if (nukeFlash > 0) nukeFlash -= dt * 2;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 1; updateUI(); }
    if (overheated) { heat -= 40 * dt; if (heat <= 0) { heat = 0; overheated = false; } } else { heat -= 20 * dt; if (heat < 0) heat = 0; }

    let stats = ShipDesigns[selectedShipType].stats;
    let speed = stats.thrust * 100 * (1 + (upgrades.speed * 0.05));
    if (keys["ArrowUp"] || keys["KeyW"]) camY -= speed * dt;
    if (keys["ArrowDown"] || keys["KeyS"]) camY += speed * dt;
    if (keys["ArrowLeft"] || keys["KeyA"]) camX -= speed * dt;
    if (keys["ArrowRight"] || keys["KeyD"]) camX += speed * dt;
    
    camX = Math.max(-3000, Math.min(3000, camX)); camY = Math.max(-3000, Math.min(3000, camY));

    if (fireCooldown > 0) fireCooldown -= dt;
    if ((keys["Space"] || mouse.leftDown) && fireCooldown <= 0 && !overheated) {
        playSfx('shoot');
        let vx = ((mouse.x - canvas.width/2) / FOV) * 3000;
        let vy = ((mouse.y - canvas.height/2) / FOV) * 3000;
        let c = ShipDesigns[selectedShipType].laserColor;
        bullets3D.push({ x: camX, y: camY, z: 0, vx: vx, vy: vy, vz: 3000, r: 5, color: c, isEmpBolt: selectedShipType==='nebuchadnezzar', isHack: selectedShipType==='fsociety' });
        if (multishotTimer>0) {
            bullets3D.push({ x: camX - 30, y: camY, z: 0, vx: vx, vy: vy, vz: 3000, r: 5, color: c, isEmpBolt: selectedShipType==='nebuchadnezzar', isHack: selectedShipType==='fsociety' });
            bullets3D.push({ x: camX + 30, y: camY, z: 0, vx: vx, vy: vy, vz: 3000, r: 5, color: c, isEmpBolt: selectedShipType==='nebuchadnezzar', isHack: selectedShipType==='fsociety' });
        }
        fireCooldown = stats.fireRate; heat += stats.heat; 
        if (heat >= 100) { heat = 100; overheated = true; playSfx('glitch'); spawnText(canvas.width/2, canvas.height/2+50, "OVERHEAT", "#ff0000", 18); }
        updateUI();
    }
    
    if (multishotTimer > 0) { multishotTimer -= dt; if (multishotTimer < 0) multishotTimer = 0; if (frames % 30 === 0) updateUI(); }

    levelTimer3D -= dt;
    if (levelTimer3D > 0) { let spawnRate = 0.03 + (level * 0.002); if (Math.random() < spawnRate) spawnTarget3D(); } 
    else if (targets3D.length === 0 && enemyBullets3D.length === 0) {
        level++; updateUI(); gameState = "LEVEL_TRANSITION"; hyperspace = 0; playSfx('powerup');
        bullets = []; enemyBullets = []; lightTrails = []; floatingTexts = []; return;
    }

    for(let i = floatingTexts.length-1; i>=0; i--) { let t = floatingTexts[i]; t.y -= 30 * dt; t.life -= dt * 1.5; if(t.life <= 0) floatingTexts.splice(i, 1); }
    for(let i=bullets3D.length-1; i>=0; i--) { let b = bullets3D[i]; b.x += b.vx*dt; b.y += b.vy*dt; b.z += b.vz*dt; if (b.z > 4000) bullets3D.splice(i, 1); }
    for(let i=enemyBullets3D.length-1; i>=0; i--) {
        let b = enemyBullets3D[i]; b.x += b.vx*dt; b.y += b.vy*dt; b.z += b.vz*dt;
        if (b.z < 10) { if (Math.hypot(b.x - camX, b.y - camY) < 50 && invulnTimer <= 0) { damagePlayer(15); } enemyBullets3D.splice(i, 1); }
    }

    for(let i=targets3D.length-1; i>=0; i--) {
        let t = targets3D[i];
        if (t.type === "tie_fighter") {
            let dx = camX - t.x; let dy = camY - t.y; t.vx += dx * dt * 0.5; t.vy += dy * dt * 0.5; 
            t.fireTimer -= dt;
            if (t.fireTimer <= 0 && t.z < 2500) { enemyBullets3D.push({ x: t.x, y: t.y, z: t.z, vx: (camX - t.x)*0.8, vy: (camY - t.y)*0.8, vz: -1200 }); t.fireTimer = 1.5; playSfx('enemyShoot'); }
        }

        t.x += t.vx*dt; t.y += t.vy*dt; t.z -= t.vz*dt; t.angle += t.rotSpeed*dt;
        if (t.hitFlash > 0) t.hitFlash -= dt;

        if (t.z < 50 && t.z > -50) { if (Math.hypot(t.x - camX, t.y - camY) < t.r + 30) { damagePlayer(30); playSfx('boom'); shake = 10; targets3D.splice(i, 1); continue; } }
        if (t.z < -100) { targets3D.splice(i, 1); continue; }

        let hit = false;
        for(let j=bullets3D.length-1; j>=0; j--) {
            let b = bullets3D[j];
            if (Math.abs(b.z - t.z) < 150 && Math.hypot(b.x - t.x, b.y - t.y) < t.r + 20) {
                let dmg = b.isEmpBolt ? 2 : (selectedShipType==='enterprise' ? 2 : 1);
                t.hp -= dmg; t.hitFlash = 0.1; playSfx('hit'); spawnText(canvas.width/2, canvas.height/2, `-${dmg}`, "#fff"); bullets3D.splice(j, 1);
                if (t.hp <= 0) {
                    playSfx('boom'); shake += 5; combo++; if(combo>10) combo=10; comboTimer = 4.0;
                    score += (t.type==="satellite" ? 75 : 50) * combo; currentRunScrap += (t.type==="satellite" ? 5 : 2); updateUI(); hit = true; break;
                }
            }
        }
        if (hit) targets3D.splice(i, 1);
    }
    stars3D.forEach(s => { s.z -= 1500 * dt; if (s.z < 10) { s.z = 3000; s.x = camX + (Math.random()-0.5)*4000; s.y = camY + (Math.random()-0.5)*4000; } });
}

function update(dt) {
    let stats = ShipDesigns[selectedShipType].stats;
    ship.angle = Math.atan2(mouse.y - ship.y, mouse.x - ship.x);
    ship.thrusting = keys["ArrowUp"] || keys["KeyW"] || mouse.rightDown;
    
    let activeThrust = stats.thrust * (1 + (upgrades.speed * 0.05));
    if (ship.thrusting) { ship.xv += activeThrust * Math.cos(ship.angle) * dt; ship.yv += activeThrust * Math.sin(ship.angle) * dt; }
    ship.xv *= stats.fric; ship.yv *= stats.fric; ship.x += ship.xv; ship.y += ship.yv;

    if (invulnTimer > 0) invulnTimer -= dt;
    if (nukeFlash > 0) nukeFlash -= dt * 2;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 1; updateUI(); }
    if (overheated) { heat -= 40 * dt; if (heat <= 0) { heat = 0; overheated = false; } } 
    else { heat -= 20 * dt; if (heat < 0) heat = 0; }

    const wrap = (obj) => { if (obj.x < -obj.r) obj.x = canvas.width + obj.r; else if (obj.x > canvas.width + obj.r) obj.x = -obj.r; if (obj.y < -obj.r) obj.y = canvas.height + obj.r; else if (obj.y > canvas.height + obj.r) obj.y = -obj.r; };
    wrap(ship);

    if (selectedShipType === "lightship" && invulnTimer <= 0) {
        for (let j = 0; j < lightTrails.length - 10; j++) { 
            let p = lightTrails[j];
            if (p.maxLife - p.life > 0.5 && Math.hypot(ship.x - p.x, ship.y - p.y) < ship.r) { playSfx('glitch'); shake += 8; damagePlayer(15); invulnTimer = 0.5; lightTrails.splice(j, 1); break; }
        }
    }

    if (fireCooldown > 0) fireCooldown -= dt;
    if ((keys["Space"] || mouse.leftDown) && fireCooldown <= 0 && !overheated) {
        if (multishotTimer > 0) {
            let b1 = createBolt(-0.15); let b2 = createBolt(0.15);
            if (selectedShipType === 'fsociety') { b1.isHack = true; b1.r = 5; b2.isHack = true; b2.r = 5; }
            if (selectedShipType === 'nebuchadnezzar') { b1.isEmpBolt = true; b1.r = 6; b2.isEmpBolt = true; b2.r = 6; }
            bullets.push(b1); bullets.push(b2);
        }
        ShipDesigns[selectedShipType].fire(); 
        fireCooldown = stats.fireRate; heat += stats.heat; 
        if (heat >= 100) { heat = 100; overheated = true; playSfx('glitch'); spawnText(ship.x, ship.y-20, "OVERHEAT", "#ff0000", 18); }
        updateUI();
    }

    if (multishotTimer > 0) { multishotTimer -= dt; if (multishotTimer < 0) multishotTimer = 0; if (frames % 30 === 0) updateUI(); }
    if (level > 2 && !powerupSpawnedThisLevel && targets.length < 5 && Math.random() < 0.005) spawnPowerup();

    for(let i = floatingTexts.length-1; i>=0; i--) { let t = floatingTexts[i]; t.y -= 30 * dt; t.life -= dt * 1.5; if(t.life <= 0) floatingTexts.splice(i, 1); }
    for(let i = scrapDrops.length-1; i>=0; i--) { 
        let s = scrapDrops[i]; s.x += s.xv; s.y += s.yv; s.life -= dt; 
        if(s.life <= 0) { scrapDrops.splice(i,1); continue; }
        let dist = Math.hypot(ship.x - s.x, ship.y - s.y);
        if(dist < 100) { s.x += (ship.x - s.x)*5*dt; s.y += (ship.y - s.y)*5*dt; }
        if(dist < ship.r + 10) { currentRunScrap += 10; playSfx('scrap'); spawnText(s.x, s.y, "+10", "#ff00ff", 12); scrapDrops.splice(i,1); updateUI(); }
    }

    for (let i = particles.length - 1; i >= 0; i--) { let p = particles[i]; p.x += p.xv; p.y += p.yv; p.life -= dt * 2.0; if (p.isEmp) p.size += dt * 800; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = lightTrails.length - 1; i >= 0; i--) { let p = lightTrails[i]; p.life -= dt; if (p.life <= 0) lightTrails.splice(i, 1); }

    for (let i = bullets.length - 1; i >= 0; i--) { bullets[i].x += bullets[i].xv; bullets[i].y += bullets[i].yv; wrap(bullets[i]); bullets[i].range -= Math.hypot(bullets[i].xv, bullets[i].yv); if (bullets[i].range < 0) bullets.splice(i, 1); }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        enemyBullets[i].x += enemyBullets[i].xv; enemyBullets[i].y += enemyBullets[i].yv; wrap(enemyBullets[i]); enemyBullets[i].range -= Math.hypot(enemyBullets[i].xv, enemyBullets[i].yv);
        if (Math.hypot(ship.x - enemyBullets[i].x, ship.y - enemyBullets[i].y) < ship.r + 2 && invulnTimer <= 0) { damagePlayer(15); enemyBullets.splice(i, 1); continue; }
        if (enemyBullets[i].range < 0) enemyBullets.splice(i, 1);
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
        let p = powerups[i]; p.x += p.xv; p.y += p.yv; p.angle += dt; wrap(p);
        if (Math.hypot(ship.x - p.x, ship.y - p.y) < ship.r + p.r) { 
            playSfx('powerup');
            if(p.type === 'M') { multishotTimer = 10.0; spawnText(ship.x, ship.y, "MULTI-SHOT", "#ff00ff"); }
            else if (p.type === 'S') { playerShield = playerMaxShield; spawnText(ship.x, ship.y, "SHIELD FULL", "#00ffff"); }
            else if (p.type === 'H') { playerHp = playerMaxHp; spawnText(ship.x, ship.y, "HULL REPAIRED", "#33ff33"); }
            else if (p.type === 'B') { bombs++; spawnText(ship.x, ship.y, "+1 BOMB", "#ffcc00"); }
            score += 150 * combo; updateUI(); powerups.splice(i, 1); 
        }
    }

    targets.forEach(t => { 
        if (t.stunned > 0) { t.stunned -= dt; return; }
        t.x += t.xv; t.y += t.yv; t.angle += t.rotSpeed * dt; 
        if (t.hitFlash > 0) t.hitFlash -= dt;

        if (t.type === "sentinel") { let angToPlayer = Math.atan2(ship.y - t.y, ship.x - t.x); t.angle = angToPlayer; let spd = t.chaseSpeed || 3; t.xv = Math.cos(angToPlayer) * spd; t.yv = Math.sin(angToPlayer) * spd; }
        if (t.type === "tie_advanced" && t.fireTimer !== undefined) { t.fireTimer -= dt; if (t.fireTimer <= 0) { let angToPlayer = Math.atan2(ship.y - t.y, ship.x - t.x); enemyBullets.push({ x: t.x, y: t.y, xv: 6 * Math.cos(angToPlayer), yv: 6 * Math.sin(angToPlayer), range: canvas.width * 0.8 }); playSfx('enemyShoot'); t.fireTimer = 2.0; } }
        if (t.type === "boss_station") {
            if (t.spawnTimer === undefined) t.spawnTimer = 2; t.spawnTimer -= dt;
            if (t.spawnTimer <= 0 && targets.length < 15) { spawnTarget("tie_fighter", 15, 1.5 + (level * 0.1), t.x, t.y); t.spawnTimer = 4; }
            t.chargeTimer += dt;
            if (t.chargeTimer > 5.0) { playSfx('boom'); shake += 10; t.chargeTimer = 0; let angToPlayer = Math.atan2(ship.y - t.y, ship.x - t.x); for(let i=0; i<5; i++) enemyBullets.push({ x: t.x, y: t.y, xv: 8 * Math.cos(angToPlayer+(i*0.1-0.2)), yv: 8 * Math.sin(angToPlayer+(i*0.1-0.2)), range: canvas.width }); }
        }
        if (t.type === "boss_mothership" && t.nodes) { t.nodes.forEach(n => n.ang += dt); }
        wrap(t); 
    });

    for (let i = targets.length - 1; i >= 0; i--) {
        let t1 = targets[i];
        if (t1.type !== "asteroid" && t1.type !== "satellite" && !t1.type.startsWith("boss")) {
            let smashed = false;
            for (let j = 0; j < targets.length; j++) {
                let t2 = targets[j];
                if (t2.type === "asteroid") {
                    let dist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
                    if (dist < t1.r + t2.r + 100) { t1.xv += (t1.x - t2.x) * 0.8 * dt; t1.yv += (t1.y - t2.y) * 0.8 * dt; }
                    if (dist < t1.r + t2.r * 0.8) {
                        smashed = true; spawnParticles(t1.x, t1.y, "#ff5500", 20); playSfx('boom');
                        spawnText(t1.x, t1.y, "CRUSHED", "#ff5500", 14);
                        score += 15 * combo; spawnScrap(t1.x, t1.y, 1); updateUI();
                        break;
                    }
                }
            }
            if (smashed) { targets.splice(i, 1); }
        }
    }

    for (let i = targets.length - 1; i >= 0; i--) {
        let hitByTrail = false;
        for (let j = 0; j < lightTrails.length; j++) { if (Math.hypot(targets[i].x - lightTrails[j].x, targets[i].y - lightTrails[j].y) < targets[i].r + 10) { hitByTrail = true; break; } }
        if (hitByTrail) { if (targets[i].hp !== undefined) { targets[i].hp -= 0.5; spawnText(targets[i].x, targets[i].y, "-1", "#0ff", 10); } else targets[i].hp = -1; targets[i].hitFlash = 0.1; }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let hit = false;
        for (let j = targets.length - 1; j >= 0; j--) {
            let t = targets[j]; 
            let dmg = bullets[i].isEmpBolt ? 2 : (selectedShipType === 'enterprise' ? 2 : 1);
            
            if (t.type === "boss_mothership") {
                let hitNode = false; let allDead = true;
                t.nodes.forEach(n => {
                    if (n.hp > 0) { allDead = false; let nx = t.x + Math.cos(n.ang) * t.r * 1.2; let ny = t.y + Math.sin(n.ang) * t.r * 1.2; if (Math.hypot(bullets[i].x - nx, bullets[i].y - ny) < 20) { n.hp-=dmg; hitNode = true; spawnParticles(nx, ny, "#0ff", 5); playSfx('hit'); spawnText(nx, ny, `-${dmg}`, "#fff"); } }
                });
                if (hitNode) { hit = true; break; }
                if (!allDead) { if (Math.hypot(bullets[i].x - t.x, bullets[i].y - t.y) < t.r * 1.4) { hit = true; playSfx('hit'); spawnParticles(bullets[i].x, bullets[i].y, "#0ff", 5); break; } } 
            }

            if (Math.hypot(bullets[i].x - t.x, bullets[i].y - t.y) < (t.r + (bullets[i].r || 2))) {
                if (bullets[i].isHack && t.type !== "asteroid" && t.type !== "satellite") { t.stunned = 3.0; spawnText(t.x, t.y, "HACKED", "#0f0", 14); }
                if (bullets[i].isEmpBolt) { spawnParticles(bullets[i].x, bullets[i].y, "#00ffff", 10); }
                
                playSfx('hit');
                if (t.hp !== undefined && t.hp > dmg) { 
                    t.hp -= dmg; t.hitFlash = 0.1; score += 25 * combo; spawnText(t.x, t.y, `-${dmg}`, "#fff"); updateUI(); hit = true; spawnParticles(bullets[i].x, bullets[i].y, "#fff", 5); break; 
                }
                
                playSfx('boom'); shake = t.r > 30 ? 10 : 3;
                spawnParticles(t.x, t.y, (t.type==="asteroid"||t.type==="satellite") ? "#aaa" : "#ff5500", t.r > 30 ? 30 : 15);
                spawnText(t.x, t.y, "DESTROYED", "#ff0000");
                combo++; if(combo>10) combo=10; comboTimer = 4.0;
                
                let diffMod = 1 + (level * 0.1);
                if (t.type === "boss_station" || t.type === "boss_mothership") { score += 1500*combo; shake = 25; spawnScrap(t.x, t.y, 10); for(let k=0; k<6; k++) spawnTarget("asteroid", 30, diffMod * 1.5, t.x, t.y); } 
                else if (t.type === "star_destroyer") { score += 100*combo; spawnScrap(t.x, t.y, 3); spawnTarget("tie_interceptor", 25, diffMod * 1.2, t.x, t.y); spawnTarget("tie_interceptor", 25, diffMod * 1.2, t.x, t.y); } 
                else if (t.type === "tie_interceptor" || t.type === "tie_advanced") { score += 50*combo; spawnScrap(t.x, t.y, 2); spawnTarget("tie_fighter", 15, diffMod * 1.5, t.x, t.y); spawnTarget("tie_fighter", 15, diffMod * 1.5, t.x, t.y); } 
                else if (t.type === "tie_fighter" || t.type === "sentinel") { score += 25*combo; spawnScrap(t.x, t.y, 1); } 
                else if (t.type === "satellite") { score += 75*combo; spawnScrap(t.x, t.y, 5); }
                else if (t.type === "asteroid") { score += ((t.r > 20) ? 20 : 50)*combo; if(Math.random()>0.5) spawnScrap(t.x, t.y, 1); if (t.r > 20) { spawnTarget("asteroid", t.r / 2, diffMod * 1.3, t.x, t.y); spawnTarget("asteroid", t.r / 2, diffMod * 1.3, t.x, t.y); } }
                
                targets.splice(j, 1); hit = true; break;
            }
        }
        if (hit && !bullets[i].isEmp) { bullets.splice(i, 1); updateUI(); }
    }

    if (invulnTimer <= 0) {
        for (let j = targets.length - 1; j >= 0; j--) {
            let t = targets[j];
            if (Math.hypot(ship.x - t.x, ship.y - t.y) < ship.r + t.r * 0.8) { 
                let isBoss = (t.type === "boss_station" || t.type === "boss_mothership");
                damagePlayer(isBoss ? 100 : 40); 
                if (!isBoss) { spawnParticles(t.x, t.y, "#ff5500", 15); targets.splice(j, 1); }
                break;
            } 
        }
    }

    if (targets.length === 0 && gameState === "PLAYING") { 
        if (level >= 25) { totalScrap += currentRunScrap; checkAndSaveScore(); saveGameData(); gameState = "VICTORY"; } 
        else { level++; updateUI(); gameState = "LEVEL_TRANSITION"; bullets = []; enemyBullets = []; lightTrails = []; floatingTexts = []; hyperspace = 0; playSfx('powerup'); } 
    }
}

function render3D() {
    ctx.fillStyle = "#020202"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.9; if(shake < 0.5) shake = 0; }

    let CX = canvas.width/2, CY = canvas.height/2;

    ctx.fillStyle = "#fff";
    stars3D.forEach(s => {
        if (s.z < 10) return;
        let scale = FOV / s.z; let sx = (s.x - camX) * scale + CX; let sy = (s.y - camY) * scale + CY;
        ctx.globalAlpha = Math.min(1, scale * 5); ctx.fillRect(sx, sy, scale*3, scale*3);
    });
    ctx.globalAlpha = 1.0;

    let renderList = [...targets3D].sort((a,b) => b.z - a.z);

    bullets3D.forEach(b => {
        if (b.z < 10) return;
        let scale = FOV / b.z; let sx = (b.x - camX) * scale + CX; let sy = (b.y - camY) * scale + CY;
        applyGlow(ctx, b.color, 15); ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(sx, sy, b.r * scale * 2, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
    });

    enemyBullets3D.forEach(b => {
        if (b.z < 10) return;
        let scale = FOV / b.z; let sx = (b.x - camX) * scale + CX; let sy = (b.y - camY) * scale + CY;
        applyGlow(ctx, "#f00", 15); ctx.fillStyle = "#f55";
        ctx.fillRect(sx - 3*scale, sy - 3*scale, 6*scale, 6*scale); clearGlow(ctx);
    });

    renderList.forEach(t => {
        if (t.z < 10) return;
        let scale = FOV / t.z; let sx = (t.x - camX) * scale + CX; let sy = (t.y - camY) * scale + CY;
        ctx.save(); ctx.translate(sx, sy); ctx.scale(scale, scale); ctx.rotate(t.angle);
        ctx.globalAlpha = Math.min(1, (3000 - t.z) / 1000);
        if (t.hitFlash > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0,0,t.r,0,Math.PI*2); ctx.fill(); }
        else { 
            if (t.type === "tie_fighter") ShipDesigns.tiefighter.draw(ctx, t.r, false); 
            else if (t.type === "satellite") TargetDesigns.satellite.draw(ctx, t.r);
            else TargetDesigns.asteroid.draw(ctx, t.r, t); 
        }
        ctx.restore();
    });

    ctx.fillStyle = "#111"; 
    ctx.beginPath(); 
    ctx.moveTo(0,0); ctx.lineTo(canvas.width, 0); ctx.lineTo(canvas.width, canvas.height*0.1);
    ctx.lineTo(canvas.width*0.8, canvas.height*0.2); ctx.lineTo(canvas.width*0.2, canvas.height*0.2); ctx.lineTo(0, canvas.height*0.1); ctx.fill();
    ctx.beginPath(); 
    ctx.moveTo(0, canvas.height); ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(canvas.width*0.9, canvas.height*0.8);
    ctx.lineTo(canvas.width*0.1, canvas.height*0.8); ctx.fill();
    ctx.beginPath(); 
    ctx.moveTo(0, canvas.height*0.1); ctx.lineTo(canvas.width*0.2, canvas.height*0.2); ctx.lineTo(canvas.width*0.1, canvas.height*0.8); ctx.lineTo(0, canvas.height); ctx.fill();
    ctx.beginPath(); 
    ctx.moveTo(canvas.width, canvas.height*0.1); ctx.lineTo(canvas.width*0.8, canvas.height*0.2); ctx.lineTo(canvas.width*0.9, canvas.height*0.8); ctx.lineTo(canvas.width, canvas.height); ctx.fill();

    ctx.strokeStyle = "#222"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(canvas.width*0.2, canvas.height*0.2); ctx.lineTo(canvas.width*0.8, canvas.height*0.2); ctx.lineTo(canvas.width*0.9, canvas.height*0.8); ctx.lineTo(canvas.width*0.1, canvas.height*0.8); ctx.closePath(); ctx.stroke();

    ctx.strokeStyle = "rgba(0, 255, 255, 0.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(CX - 100, CY); ctx.lineTo(CX - 20, CY); ctx.moveTo(CX + 100, CY); ctx.lineTo(CX + 20, CY);
    ctx.moveTo(CX, CY - 100); ctx.lineTo(CX, CY - 20); ctx.moveTo(CX, CY + 100); ctx.lineTo(CX, CY + 20);
    ctx.arc(CX, CY, 80, 0, Math.PI*2); ctx.stroke();
    
    ctx.fillStyle = "rgba(0, 255, 255, 0.8)"; ctx.font = "14px Courier";
    ctx.fillText(`HYPERSPACE ANOMALY - TIME: ${Math.max(0, Math.ceil(levelTimer3D))}s`, CX, canvas.height*0.15);
    
    if (playerShield > 0) { ctx.fillStyle = `rgba(0, 255, 255, ${0.05 + (playerShield/100)*0.1})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    
    ctx.textAlign = "center";
    floatingTexts.forEach(t => { ctx.globalAlpha = t.life; ctx.fillStyle = t.color; ctx.font = `bold ${t.size}px Courier New`; ctx.fillText(t.text, t.x, t.y); }); ctx.globalAlpha = 1.0;
    
    if (nukeFlash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${nukeFlash})`; ctx.fillRect(0,0,canvas.width, canvas.height); }

    if (!isTouchDevice) {
        ctx.save(); ctx.translate(mouse.x, mouse.y); ctx.rotate(frames * 0.05);
        ctx.strokeStyle = overheated ? "#f00" : (heat > 75 ? "#f50" : "#0f0"); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.moveTo(-15, 0); ctx.lineTo(-5, 0); ctx.moveTo(15, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -15); ctx.lineTo(0, -5); ctx.moveTo(0, 15); ctx.lineTo(0, 5); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
    drawMenuOverlays();
}

function render() {
    ctx.fillStyle = `hsl(${level * 15}, 30%, 5%)`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.9; if(shake < 0.5) shake = 0; }

    ctx.fillStyle = "white";
    for(let i=0; i<100; i++) { 
        let layer = (i%3) + 1; let spdMult = layer * 0.5;
        let sx = (Math.sin(i*74) * 10000 + frames * spdMult) % canvas.width; 
        let sy = (Math.cos(i*31) * 10000 + frames * spdMult * 0.5) % canvas.height; 
        if (gameState === "LEVEL_TRANSITION") { ctx.globalAlpha = layer*0.3; ctx.fillRect(Math.abs(sx), Math.abs(sy), hyperspace*50*layer, layer); } 
        else { ctx.globalAlpha = layer * 0.3; ctx.fillRect(Math.abs(sx), Math.abs(sy), layer, layer); ctx.globalAlpha = 1.0; }
    }

    if (gameState === "PLAYING") {
        targets.forEach(t => {
            if (t.type.startsWith("boss") || t.type === "tie_advanced" || t.type === "sentinel") {
                let dist = Math.hypot(ship.x - t.x, ship.y - t.y);
                if (dist > canvas.width/2) {
                    let ang = Math.atan2(t.y - ship.y, t.x - ship.x);
                    let edgeX = ship.x + Math.cos(ang) * (canvas.width/2 - 30); let edgeY = ship.y + Math.sin(ang) * (canvas.height/2 - 30);
                    ctx.save(); ctx.translate(edgeX, edgeY); ctx.rotate(ang);
                    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-10, -10); ctx.fill();
                    ctx.restore();
                }
            }
        });
    }

    lightTrails.forEach(t => { applyGlow(ctx, "#00ffff", 15); ctx.fillStyle = `rgba(0, 255, 255, ${t.life / 8.0})`; ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); });
    scrapDrops.forEach(s => { applyGlow(ctx, "#ff00ff", 10); ctx.fillStyle = `rgba(255, 0, 255, ${s.life/8})`; ctx.fillRect(s.x-3, s.y-3, 6, 6); clearGlow(ctx); });

    targets.forEach(t => { 
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); 
        if (t.stunned > 0) { ctx.translate((Math.random()-0.5)*5, (Math.random()-0.5)*5); } 
        if (t.type === "tie_fighter") ShipDesigns.tiefighter.draw(ctx, t.r, false); 
        else if (t.type === "satellite") TargetDesigns.satellite.draw(ctx, t.r);
        else TargetDesigns[t.type] ? TargetDesigns[t.type].draw(ctx, t.r, t) : TargetDesigns["asteroid"].draw(ctx, t.r, t); 
        ctx.restore(); 
    });

    powerups.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        let color = p.type === 'M' ? "#ff00ff" : (p.type === 'S' ? "#00ffff" : (p.type === 'B' ? "#ffcc00" : "#33ff33"));
        applyGlow(ctx, color, 15); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(-p.r/2, -p.r/2, p.r, p.r);
        ctx.fillStyle = color; ctx.font = "bold 16px Courier"; ctx.fillText(p.type, -5, 5); clearGlow(ctx); ctx.restore();
    });

    particles.forEach(p => { 
        ctx.globalAlpha = p.life; 
        if (p.isEmp) { ctx.strokeStyle = p.color; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.stroke(); }
        else { ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.xv * 2, p.y - p.yv * 2); ctx.stroke(); }
    }); ctx.globalAlpha = 1.0;

    applyGlow(ctx, "#ff0000", 15); ctx.fillStyle = "#ff5555";
    enemyBullets.forEach(b => { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.yv, b.xv)); ctx.fillRect(-6, -2, 12, 4); ctx.restore(); }); clearGlow(ctx);

    bullets.forEach(b => { 
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.yv, b.xv)); 
        if (b.isHack) { applyGlow(ctx, "#00ff00", 12); ctx.fillStyle = "#00ff00"; ctx.font = "bold 14px Courier New"; ctx.fillText(Math.random() > 0.5 ? "1" : "0", -4, 4); clearGlow(ctx); } 
        else if (b.isEmpBolt) { applyGlow(ctx, "#00ffff", 15); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, 0, b.r || 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#00aaff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, (b.r || 6) + 3, 0, Math.PI * 2); ctx.stroke(); clearGlow(ctx); } 
        else { ctx.fillStyle = ShipDesigns[selectedShipType].laserColor; applyGlow(ctx, ShipDesigns[selectedShipType].laserColor, 10); ctx.beginPath(); ctx.arc(0, 0, b.r || 2, 0, Math.PI * 2); ctx.fill(); clearGlow(ctx); }
        ctx.restore(); 
    });

    if (gameState === "PLAYING" || gameState === "LEVEL_TRANSITION" || gameState === "PAUSED") {
        if (invulnTimer <= 0 || frames % 10 < 5) {
            ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle); ShipDesigns[selectedShipType].draw(ctx, ship.r, ship.thrusting); ctx.restore();
            if (playerShield > 0) { applyGlow(ctx, "#00ffff", 10); ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + (playerShield/100)*0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ship.x, ship.y, ship.r * 1.6, 0, Math.PI*2); ctx.stroke(); clearGlow(ctx); }
            if (multishotTimer > 0) { applyGlow(ctx, "#ff00ff", 10); ctx.strokeStyle = `rgba(255, 0, 255, ${Math.abs(Math.sin(frames/10))})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ship.x, ship.y, ship.r * 1.3, 0, Math.PI*2); ctx.stroke(); clearGlow(ctx); }
        }
    }
    
    ctx.textAlign = "center";
    floatingTexts.forEach(t => { ctx.globalAlpha = t.life; ctx.fillStyle = t.color; ctx.font = `bold ${t.size}px Courier New`; ctx.fillText(t.text, t.x, t.y); }); ctx.globalAlpha = 1.0;
    
    if (nukeFlash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${nukeFlash})`; ctx.fillRect(0,0,canvas.width, canvas.height); }
    
    if (gameState === "PLAYING" && !isTouchDevice) {
        ctx.save(); ctx.translate(mouse.x, mouse.y); ctx.rotate(frames * 0.05);
        ctx.strokeStyle = overheated ? "#f00" : (heat > 75 ? "#f50" : "#0f0"); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.moveTo(-15, 0); ctx.lineTo(-5, 0); ctx.moveTo(15, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -15); ctx.lineTo(0, -5); ctx.moveTo(0, 15); ctx.lineTo(0, 5); ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
    drawMenuOverlays();
}

function drawMenuOverlays() {
    ctx.textAlign = "center";
    if (gameState === "PAUSED") { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0,0,canvas.width, canvas.height); ctx.fillStyle = "#fff"; ctx.font = "bold 40px Courier New"; ctx.fillText("PAUSED", canvas.width/2, canvas.height/2); }
    if (gameState === "LEVEL_TRANSITION") { ctx.fillStyle = `rgba(0,0,0,${1 - hyperspace/2})`; ctx.fillRect(0,0,canvas.width, canvas.height); ctx.fillStyle = "#33ccff"; ctx.font = "bold 40px Courier New"; ctx.fillText("JUMPING TO SECTOR " + level, canvas.width/2, canvas.height/2); }
    if (gameState === "GAMEOVER") { ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#ffcc00"; ctx.font = "bold 50px Courier New"; ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20); ctx.fillStyle = "white"; ctx.font = "20px Courier New"; ctx.fillText("Press 'R' to return", canvas.width / 2, canvas.height / 2 + 40); }
    if (gameState === "VICTORY") { ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#33ff33"; ctx.font = "bold 50px Courier New"; ctx.fillText("VICTORY!", canvas.width / 2, canvas.height / 2 - 40); ctx.fillStyle = "white"; ctx.font = "20px Courier New"; ctx.fillText(`All sectors cleared. Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10); }
}