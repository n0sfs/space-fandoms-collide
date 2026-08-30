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
const statusEl = document.getElementById("statusDisplay");
const swarmBarEl = document.getElementById("swarmBar");
const swarmCountEl = document.getElementById("swarmCount");
const swarmTotalEl = document.getElementById("swarmTotal");

const menuOverlay = document.getElementById("menuOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const playerNameInput = document.getElementById("playerName");
const leaderboardList = document.getElementById("leaderboardList");
const menuScrapEl = document.getElementById("menuScrap");

const diffButtons = document.querySelectorAll(".diff-btn");
const moreToggleBtn = document.getElementById("moreToggleBtn");
const menuExtras = document.getElementById("menuExtras");
const resumeBtn = document.getElementById("resumeBtn");
const restartGameBtn = document.getElementById("restartGameBtn");
const quitBtn = document.getElementById("quitBtn");

const upgBombBtn = document.getElementById("upgBombBtn");
const upgSpeedBtn = document.getElementById("upgSpeedBtn");
const upgShieldBtn = document.getElementById("upgShieldBtn");
const upgPowerBtn = document.getElementById("upgPowerBtn");

const achievementsBtn = document.getElementById("achievementsBtn");
const achievementsBackBtn = document.getElementById("achievementsBackBtn");
const achievementsOverlay = document.getElementById("achievementsOverlay");
const achievementsListEl = document.getElementById("achievementsList");

const pilotRecordBtn = document.getElementById("pilotRecordBtn");
const pilotRecordBackBtn = document.getElementById("pilotRecordBackBtn");
const pilotRecordOverlay = document.getElementById("pilotRecordOverlay");
const pilotRecordListEl = document.getElementById("pilotRecordList");
const trailPickerEl = document.getElementById("trailPicker");

const profileSwitchBtn = document.getElementById("profileSwitchBtn");
const activeProfileLabel = document.getElementById("activeProfileLabel");
const profilesOverlay = document.getElementById("profilesOverlay");
const profilesListEl = document.getElementById("profilesList");
const newProfileName = document.getElementById("newProfileName");
const newProfileBtn = document.getElementById("newProfileBtn");
const profilesBackBtn = document.getElementById("profilesBackBtn");
const resetProgressBtn = document.getElementById("resetProgressBtn");
const volumeSlider = document.getElementById("volumeSlider");

// --- PILOT PROFILES ---
// Each profile's save data lives under keys suffixed with its id, except the original
// "default" profile, which keeps the original unsuffixed keys so existing players don't
// lose progress now that this feature exists.
let profiles = [{ id: "default", name: "PILOT 1" }];
let activeProfileId = "default";
function pKey(base) { return activeProfileId === "default" ? base : `${base}_${activeProfileId}`; }

function loadProfileList() {
    try {
        let stored = localStorage.getItem("sfc_profiles");
        if (stored) profiles = JSON.parse(stored);
        let storedActive = localStorage.getItem("sfc_activeProfile");
        if (storedActive && profiles.some(p => p.id === storedActive)) activeProfileId = storedActive;
    } catch(e) {}
    if (!profiles || profiles.length === 0) profiles = [{ id: "default", name: "PILOT 1" }];
}
function saveProfileList() {
    try { localStorage.setItem("sfc_profiles", JSON.stringify(profiles)); localStorage.setItem("sfc_activeProfile", activeProfileId); } catch(e) {}
}

// Wipes in-memory save state back to defaults before a different profile's data loads in,
// so nothing from the previous pilot leaks into the next one.
function resetRuntimeSaveState() {
    highScores = [];
    totalScrap = 0;
    upgrades = { bombs: 0, speed: 0, shield: 0, power: 0 };
    lastShipId = null;
    shipBuilderUnlocked = false;
    lifetimeStats = { kills: 0, bossKills: 0, bombsUsed: 0, scrapEarned: 0, gamesPlayed: 0, highestLevel: 0, hyperspaceCleared: 0 };
    unlockedAch = {};
    equippedTrail = "classic";
    customShipConfig = null;
    delete ShipDesigns.custom;
    let idx = ShipMenuOrder.findIndex(s => s.id === "custom");
    if (idx !== -1) ShipMenuOrder.splice(idx, 1);
    selectedShipType = "xwing";
    if (typeof rebuildShipDropdown === "function") rebuildShipDropdown();
    if (typeof setMenuShip === "function") setMenuShip("xwing");
}

// A reasonable 3-letter arcade-tag guess from a profile name, so a new/switched-to
// pilot doesn't inherit the previous pilot's leftover initials in the input box.
function initialsFromName(name) {
    let letters = (name || "").toUpperCase().replace(/[^A-Z]/g, "");
    return letters.slice(0, 3) || "AAA";
}

function switchProfile(id) {
    if (!profiles.some(p => p.id === id) || id === activeProfileId) { renderProfilesList(); return; }
    activeProfileId = id;
    saveProfileList();
    resetRuntimeSaveState();
    loadSaveData();
    if (playerNameInput) playerNameInput.value = initialsFromName((profiles.find(p => p.id === id) || {}).name);
    renderProfilesList();
}

function createProfile(name) {
    name = (name || "").trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 14) || `PILOT ${profiles.length + 1}`;
    let id = "p" + Date.now();
    profiles.push({ id, name });
    switchProfile(id);
}

function deleteProfile(id) {
    if (profiles.length <= 1 || id === activeProfileId) return;
    profiles = profiles.filter(p => p.id !== id);
    ["sfc_scores", "sfc_scrap", "sfc_upgrades", "sfc_lastShip", "sfc_shipBuilderUnlocked", "sfc_customShip", "sfc_lifetime", "sfc_achievements", "sfc_trailColor", "sfc_seenHint"]
        .forEach(base => { try { localStorage.removeItem(id === "default" ? base : `${base}_${id}`); } catch(e) {} });
    saveProfileList();
    renderProfilesList();
}

function renderProfilesList() {
    if (activeProfileLabel) activeProfileLabel.textContent = (profiles.find(p => p.id === activeProfileId) || profiles[0]).name;
    if (!profilesListEl) return;
    profilesListEl.innerHTML = profiles.map(p => {
        let isActive = p.id === activeProfileId;
        return `<div class="profile-row ${isActive ? 'active' : ''}">
            <span class="profile-name">${p.name}${isActive ? ' (ACTIVE)' : ''}</span>
            <span class="profile-actions">
                ${isActive ? '' : `<button type="button" class="profile-switch-action" data-id="${p.id}">SWITCH</button>`}
                ${!isActive && profiles.length > 1 ? `<button type="button" class="profile-delete-action" data-id="${p.id}">✕</button>` : ''}
            </span>
        </div>`;
    }).join('');
    profilesListEl.querySelectorAll('.profile-switch-action').forEach(btn => {
        const act = (e) => { if(e) e.preventDefault(); initAudio(); switchProfile(btn.getAttribute('data-id')); };
        btn.addEventListener('click', act); btn.addEventListener('touchstart', act, { passive: false });
    });
    profilesListEl.querySelectorAll('.profile-delete-action').forEach(btn => {
        const act = (e) => { if(e) e.preventDefault(); initAudio(); if (confirm('Delete this pilot and all their progress? This cannot be undone.')) deleteProfile(btn.getAttribute('data-id')); };
        btn.addEventListener('click', act); btn.addEventListener('touchstart', act, { passive: false });
    });
}

function resetActiveProfileProgress() {
    resetRuntimeSaveState();
    saveGameData();
    try {
        localStorage.removeItem(pKey("sfc_lastShip"));
        localStorage.removeItem(pKey("sfc_shipBuilderUnlocked"));
        localStorage.removeItem(pKey("sfc_customShip"));
        localStorage.removeItem(pKey("sfc_trailColor"));
        localStorage.removeItem(pKey("sfc_seenHint"));
    } catch(e) {}
    loadSaveData();
}

// Persistent Data
let totalScrap = 0;
let upgrades = { bombs: 0, speed: 0, shield: 0, power: 0 };
let highScores = [];
let lastShipId = null;
let lifetimeStats = { kills: 0, bossKills: 0, bombsUsed: 0, scrapEarned: 0, gamesPlayed: 0, highestLevel: 0, hyperspaceCleared: 0 };
let unlockedAch = {};
let achievementToasts = [];
let tookDamageThisHyperspace = false;
let runKills = 0, runBestCombo = 1;
let gameOverMessage = "";
let equippedTrail = "classic";

const ENCOURAGEMENTS = [
    "NICE FLYING, PILOT!", "SO CLOSE! TRY AGAIN!", "THE GALAXY NEEDS YOU!",
    "SHAKE IT OFF, ACE!", "ONE MORE RUN?", "YOU'LL GET 'EM NEXT TIME!",
    "NOT BAD FOR A ROOKIE!", "THAT WAS EPIC!"
];

const TRAIL_COLORS = [
    { id: "classic", color: "#00ffff", label: "Classic", requires: null },
    { id: "gold", color: "#ffcc00", label: "Gold Rush", requires: "level_20" },
    { id: "violet", color: "#ff33ff", label: "Hive Violet", requires: "hive_breaker" },
    { id: "inferno", color: "#ff3300", label: "Inferno", requires: "boss_slayer" },
    { id: "rainbow", color: null, label: "Rainbow", requires: "ace" },
];

const ACHIEVEMENTS = [
    { id: "first_blood", icon: "\u{1F4A5}", title: "First Contact", desc: "Destroy your first target" },
    { id: "level_10", icon: "\u{1FA90}", title: "Deep Space", desc: "Reach level 10" },
    { id: "level_20", icon: "\u{1F680}", title: "Veteran Pilot", desc: "Reach level 20" },
    { id: "level_26", icon: "\u{1F3C6}", title: "Campaign Complete", desc: "Beat level 26" },
    { id: "boss_slayer", icon: "\u{2620}", title: "Boss Slayer", desc: "Defeat 10 bosses (lifetime)" },
    { id: "hive_breaker", icon: "\u{1F41D}", title: "Hive Breaker", desc: "Defeat a Hive Swarm queen" },
    { id: "combo_master", icon: "\u{1F525}", title: "Combo Master", desc: "Reach a 10x combo" },
    { id: "demolitions", icon: "\u{1F4A3}", title: "Demolitions Expert", desc: "Use 25 bombs (lifetime)" },
    { id: "scrapper", icon: "\u{1F527}", title: "Master Scrapper", desc: "Earn 5,000 lifetime scrap" },
    { id: "ace", icon: "\u{1F396}", title: "Ace Pilot", desc: "Score 50,000 in a single run" },
    { id: "shipwright", icon: "\u{1F6E0}", title: "Shipwright", desc: "Build and fly a custom ship" },
    { id: "untouchable", icon: "\u{1F6E1}", title: "Untouchable", desc: "Clear a hyperspace anomaly without taking damage" },
];

function unlockAchievement(id) {
    if (unlockedAch[id]) return;
    let ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;
    unlockedAch[id] = true;
    saveGameData();
    renderAchievementsList();
    renderTrailPicker();
    achievementToasts.push({ icon: ach.icon, title: ach.title, life: 4.0 });
    playSfx('achievement');
}

function checkAchievements() {
    if (lifetimeStats.kills >= 1) unlockAchievement('first_blood');
    if (combo >= 10) unlockAchievement('combo_master');
    if (score >= 50000) unlockAchievement('ace');
    if (lifetimeStats.bossKills >= 10) unlockAchievement('boss_slayer');
    if (lifetimeStats.bombsUsed >= 25) unlockAchievement('demolitions');
    if (lifetimeStats.scrapEarned >= 5000) unlockAchievement('scrapper');
}

function renderAchievementsList() {
    if (achievementsBtn) achievementsBtn.innerText = `\u{1F3C6} ACHIEVEMENTS (${Object.keys(unlockedAch).length}/${ACHIEVEMENTS.length})`;
    if (!achievementsListEl) return;
    achievementsListEl.innerHTML = ACHIEVEMENTS.map(a => {
        let unlocked = !!unlockedAch[a.id];
        return `<div class="ach-row ${unlocked ? 'unlocked' : ''}"><span class="ach-icon">${a.icon}</span><span class="ach-text"><span class="ach-title">${a.title}</span><br><span class="ach-desc">${a.desc}</span></span></div>`;
    }).join('');
}

function renderPilotRecord() {
    if (!pilotRecordListEl) return;
    let bestScore = (highScores && highScores.length) ? highScores[0].score : 0;
    let rows = [
        ["Games Played", lifetimeStats.gamesPlayed || 0],
        ["Best Score", bestScore],
        ["Highest Level Reached", lifetimeStats.highestLevel || 0],
        ["Total Kills", lifetimeStats.kills || 0],
        ["Bosses Defeated", lifetimeStats.bossKills || 0],
        ["Hyperspace Anomalies Cleared", lifetimeStats.hyperspaceCleared || 0],
        ["Bombs Used", lifetimeStats.bombsUsed || 0],
        ["Lifetime Scrap Earned", lifetimeStats.scrapEarned || 0],
        ["Achievements Unlocked", `${Object.keys(unlockedAch).length}/${ACHIEVEMENTS.length}`],
    ];
    pilotRecordListEl.innerHTML = rows.map(([label, val]) => `<div class="record-row"><span>${label}</span><span>${val}</span></div>`).join('');
}

function equipTrail(id) {
    let tc = TRAIL_COLORS.find(t => t.id === id);
    if (!tc || (tc.requires && !unlockedAch[tc.requires])) return;
    equippedTrail = id;
    try { localStorage.setItem(pKey("sfc_trailColor"), id); } catch(e) {}
    renderTrailPicker();
}

function renderTrailPicker() {
    if (!trailPickerEl) return;
    trailPickerEl.innerHTML = TRAIL_COLORS.map(tc => {
        let unlocked = !tc.requires || unlockedAch[tc.requires];
        let swatchColor = tc.id === "rainbow" ? "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" : tc.color;
        return `<button type="button" class="trail-swatch ${equippedTrail === tc.id ? 'equipped' : ''} ${unlocked ? '' : 'locked'}" data-trail="${tc.id}" title="${unlocked ? tc.label : tc.label + ' (locked)'}" style="background:${swatchColor}">${unlocked ? '' : '\u{1F512}'}</button>`;
    }).join('');
    trailPickerEl.querySelectorAll('.trail-swatch').forEach(btn => {
        const equipAction = (e) => { if(e) e.preventDefault(); initAudio(); equipTrail(btn.getAttribute('data-trail')); };
        btn.addEventListener('click', equipAction);
        btn.addEventListener('touchstart', equipAction, { passive: false });
    });
}

function updateAchievementToasts(dt) {
    for (let i = achievementToasts.length - 1; i >= 0; i--) {
        achievementToasts[i].life -= dt;
        if (achievementToasts[i].life <= 0) achievementToasts.splice(i, 1);
    }
}

function drawAchievementToasts() {
    achievementToasts.forEach((t, i) => {
        let alpha = t.life > 3.7 ? (4.0 - t.life) / 0.3 : Math.min(1, t.life);
        alpha = Math.max(0, Math.min(1, alpha));
        let w = 260, h = 56, x = canvas.width - w - 16, y = 16 + i * (h + 10);
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(10, 10, 12, 0.9)"; ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.stroke();
        ctx.textAlign = "left"; ctx.font = "26px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText(t.icon, x + 12, y + 38);
        ctx.font = "bold 10px Courier New"; ctx.fillStyle = "#ffcc00"; ctx.fillText("ACHIEVEMENT UNLOCKED", x + 52, y + 20);
        ctx.font = "bold 14px Courier New"; ctx.fillStyle = "#fff"; ctx.fillText(t.title, x + 52, y + 38);
        ctx.restore();
    });
    ctx.textAlign = "center";
}

function loadSaveData() {
    try {
        let storedScores = localStorage.getItem(pKey("sfc_scores")); if (storedScores) highScores = JSON.parse(storedScores);
        let storedScrap = localStorage.getItem(pKey("sfc_scrap")); if (storedScrap) totalScrap = parseInt(storedScrap) || 0;
        let storedUpg = localStorage.getItem(pKey("sfc_upgrades"));
        if (storedUpg) {
            let parsed = JSON.parse(storedUpg);
            upgrades.bombs = parsed.bombs || 0;
            upgrades.speed = parsed.speed || 0;
            upgrades.shield = parsed.shield || 0;
            upgrades.power = parsed.power || 0;
        }
        let storedMuted = localStorage.getItem("sfc_muted"); if (storedMuted !== null) muted = (storedMuted === "1");
        let storedVolume = localStorage.getItem("sfc_volume"); if (storedVolume !== null) masterVolume = parseFloat(storedVolume) || 0;
        lastShipId = localStorage.getItem(pKey("sfc_lastShip"));
        if (typeof shipBuilderUnlocked !== "undefined") shipBuilderUnlocked = localStorage.getItem(pKey("sfc_shipBuilderUnlocked")) === "1";
        let storedCustomShip = localStorage.getItem(pKey("sfc_customShip"));
        if (storedCustomShip && typeof registerCustomShip === "function") registerCustomShip(JSON.parse(storedCustomShip));
        let storedLifetime = localStorage.getItem(pKey("sfc_lifetime"));
        if (storedLifetime) {
            let p = JSON.parse(storedLifetime);
            lifetimeStats.kills = p.kills || 0; lifetimeStats.bossKills = p.bossKills || 0; lifetimeStats.bombsUsed = p.bombsUsed || 0; lifetimeStats.scrapEarned = p.scrapEarned || 0;
            lifetimeStats.gamesPlayed = p.gamesPlayed || 0; lifetimeStats.highestLevel = p.highestLevel || 0; lifetimeStats.hyperspaceCleared = p.hyperspaceCleared || 0;
        }
        let storedAch = localStorage.getItem(pKey("sfc_achievements")); if (storedAch) unlockedAch = JSON.parse(storedAch);
        let storedTrail = localStorage.getItem(pKey("sfc_trailColor")); if (storedTrail && TRAIL_COLORS.some(t => t.id === storedTrail)) equippedTrail = storedTrail;
    } catch(e) {
        localStorage.removeItem(pKey("sfc_scores")); localStorage.removeItem(pKey("sfc_scrap")); localStorage.removeItem(pKey("sfc_upgrades"));
    }
    if (!highScores || highScores.length === 0) {
        highScores = [{name: "VDR", score: 10000}, {name: "LUK", score: 8000}, {name: "HAN", score: 6000}, {name: "BBA", score: 4000}, {name: "RD2", score: 2000}];
    }
    updateMuteUI();
    updateVolumeUI();
    updateMenuUI();
    renderAchievementsList();
    renderTrailPicker();
    renderProfilesList();
    if (typeof updateBuilderUnlockUI === "function") updateBuilderUnlockUI();
    if (lastShipId && typeof setMenuShip === "function") setMenuShip(lastShipId);
    maybeShowFirstRunHint();
}

function saveGameData() {
    try {
        localStorage.setItem(pKey("sfc_scores"), JSON.stringify(highScores)); localStorage.setItem(pKey("sfc_scrap"), totalScrap); localStorage.setItem(pKey("sfc_upgrades"), JSON.stringify(upgrades));
        localStorage.setItem(pKey("sfc_lifetime"), JSON.stringify(lifetimeStats)); localStorage.setItem(pKey("sfc_achievements"), JSON.stringify(unlockedAch));
    } catch(e) {}
    updateMenuUI();
}

function checkAndSaveScore() {
    highScores.push({ name: currentPlayerName, score: Math.round(score) });
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
    if(upgPowerBtn) { upgPowerBtn.innerText = `+1 DMG (${upgrades.power}/3) - 450`; upgPowerBtn.disabled = (totalScrap < 450 || upgrades.power >= 3); }
}

if(upgBombBtn) upgBombBtn.addEventListener("click", (e) => { e.preventDefault(); if(totalScrap>=500 && upgrades.bombs<3) { totalScrap-=500; upgrades.bombs++; saveGameData(); playSfx('powerup'); }});
if(upgSpeedBtn) upgSpeedBtn.addEventListener("click", (e) => { e.preventDefault(); if(totalScrap>=300 && upgrades.speed<5) { totalScrap-=300; upgrades.speed++; saveGameData(); playSfx('powerup'); }});
if(upgShieldBtn) upgShieldBtn.addEventListener("click", (e) => { e.preventDefault(); if(totalScrap>=400 && upgrades.shield<5) { totalScrap-=400; upgrades.shield++; saveGameData(); playSfx('powerup'); }});
if(upgPowerBtn) upgPowerBtn.addEventListener("click", (e) => { e.preventDefault(); if(totalScrap>=450 && upgrades.power<3) { totalScrap-=450; upgrades.power++; saveGameData(); playSfx('powerup'); }});

// --- GLOBAL GAME STATE ---
let gameState = "MENU"; 
let gameDifficulty = "moderate";
let diffScoreMult = 1;
let score = 0, level = 1, frames = 0;
let shake = 0, hyperspace = 0, nukeFlash = 0;
let playerHp = 100, playerMaxHp = 100, playerShield = 100, playerMaxShield = 100;
let bombs = 1, lives = 3, currentRunScrap = 0, combo = 1, comboTimer = 0, heat = 0, overheated = false;

let keys = {}; 
let mouse = { x: canvas.width/2, y: canvas.height/2, leftDown: false, rightDown: false };
let selectedShipType = "xwing", currentPlayerName = "AAA";
let bullets = [], enemyBullets = [], targets = [], powerups = [], particles = [], lightTrails = [], floatingTexts = [], scrapDrops = [];
let multishotTimer = 0, fireCooldown = 0, invulnTimer = 0, powerupSpawnedThisLevel = false;
let rapidFireTimer = 0, slowmoTimer = 0, chaosTimer = 0;
let ship = { x: canvas.width / 2, y: canvas.height / 2, r: 15, angle: -Math.PI / 2, xv: 0, yv: 0, thrusting: false };

// --- 3D STATE VARIABLES ---
let is3DMode = false, levelTimer3D = 0;
let hiveSwarmActive = false, hiveSwarmTotal = 0, hiveFireTimer = 0, hiveEnraged = false;
const FOV = 500;
let camX = 0, camY = 0;
let targets3D = [], bullets3D = [], enemyBullets3D = [], stars3D = [];
for(let i=0; i<250; i++) stars3D.push({x: (Math.random()-0.5)*5000, y: (Math.random()-0.5)*5000, z: Math.random()*3000});

// --- AUDIO ---
let audioCtx;
let muted = false;
let masterGain = null;
let masterVolume = 1;
function initAudio() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = masterVolume;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) {}
}
function setMasterVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = masterVolume;
    try { localStorage.setItem("sfc_volume", masterVolume); } catch(e) {}
}
function updateVolumeUI() { if (volumeSlider) volumeSlider.value = Math.round(masterVolume * 100); }
function playSfx(type) {
    if (!audioCtx || muted) return;
    try {
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), now = audioCtx.currentTime; osc.connect(gain); gain.connect(masterGain);
        if (type === 'shoot') { osc.type = 'square'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(110, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); } 
        else if (type === 'enemyShoot') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.15); gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15); osc.start(now); osc.stop(now + 0.15); }
        else if (type === 'boom') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(10, now + 0.3); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3); } 
        else if (type === 'powerup') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(now); osc.stop(now + 0.2); } 
        else if (type === 'hit') { osc.type = 'square'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(100, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
        else if (type === 'nuke') { osc.type = 'square'; osc.frequency.setValueAtTime(50, now); osc.frequency.linearRampToValueAtTime(20, now + 1.5); gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 1.5); osc.start(now); osc.stop(now + 1.5); }
        else if (type === 'scrap') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.05); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.05); osc.start(now); osc.stop(now + 0.05); }
        else if (type === 'glitch') { osc.type = 'square'; osc.frequency.setValueAtTime(60, now); osc.frequency.setValueAtTime(300, now + 0.03); osc.frequency.setValueAtTime(40, now + 0.06); osc.frequency.setValueAtTime(250, now + 0.09); gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12); osc.start(now); osc.stop(now + 0.12); }
        else if (type === 'achievement') {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                let o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = now + i * 0.09;
                o.type = 'triangle'; o.frequency.setValueAtTime(freq, t0);
                g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
                o.connect(g); g.connect(masterGain); o.start(t0); o.stop(t0 + 0.26);
            });
        }
        else if (type === 'chaos') {
            [392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
                let o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = now + i * 0.05;
                o.type = 'square'; o.frequency.setValueAtTime(freq, t0);
                g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.08, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
                o.connect(g); g.connect(masterGain); o.start(t0); o.stop(t0 + 0.16);
            });
        }
    } catch (e) {}
}

// A short looping synth arpeggio that only plays while a run is active, gated by the same
// mute flag as the sfx so it never needs its own on/off wiring beyond starting once at boot.
// Switches to a faster, harsher, lower pattern during boss levels and hyperspace for tension.
const musicScaleCalm = [130.81, 155.56, 196.00, 130.81, 174.61, 196.00, 246.94, 196.00];
const musicScaleTense = [65.41, 65.41, 61.74, 65.41, 65.41, 69.30, 65.41, 58.27];
let musicStep = 0;
function isTenseContext() { return is3DMode || (level % 5 === 0); }
function playMusicNote(freq, tense) {
    if (!audioCtx || muted) return;
    try {
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), now = audioCtx.currentTime;
        osc.type = tense ? 'sawtooth' : 'triangle'; osc.frequency.setValueAtTime(freq, now);
        let peak = tense ? 0.07 : 0.045, dur = tense ? 0.28 : 0.5;
        gain.gain.setValueAtTime(0.0, now); gain.gain.linearRampToValueAtTime(peak, now + 0.04); gain.gain.linearRampToValueAtTime(0.0, now + dur);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(now); osc.stop(now + dur);
    } catch(e) {}
}
function scheduleMusic() {
    if (gameState === "PLAYING" && !muted) {
        let tense = isTenseContext();
        let scale = tense ? musicScaleTense : musicScaleCalm;
        playMusicNote(scale[musicStep % scale.length], tense);
        musicStep++;
        setTimeout(scheduleMusic, tense ? 240 : 450);
    } else {
        setTimeout(scheduleMusic, 450);
    }
}
scheduleMusic();

// --- HAPTICS / WAKE LOCK ---
function vibrate(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {} }
let wakeLock = null;
async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && gameState === 'PLAYING') requestWakeLock(); });

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

if (volumeSlider) {
    volumeSlider.addEventListener("input", () => { initAudio(); setMasterVolume(volumeSlider.value / 100); });
    volumeSlider.addEventListener("touchstart", () => initAudio(), { passive: true });
}

if (resumeBtn) { const resumeAction = (e) => { if(e) e.preventDefault(); initAudio(); if (gameState === "PAUSED") togglePause(); }; resumeBtn.addEventListener("click", resumeAction); resumeBtn.addEventListener("touchstart", resumeAction, { passive: false }); }
if (restartGameBtn) { const restartGameAction = (e) => { if(e) e.preventDefault(); initAudio(); if (pauseOverlay) pauseOverlay.classList.add("hidden"); startGame(selectedShipType); }; restartGameBtn.addEventListener("click", restartGameAction); restartGameBtn.addEventListener("touchstart", restartGameAction, { passive: false }); }
if (quitBtn) { const quitAction = (e) => { if(e) e.preventDefault(); initAudio(); if (pauseOverlay) pauseOverlay.classList.add("hidden"); if (menuOverlay) menuOverlay.classList.remove("hidden"); bullets = []; enemyBullets = []; particles = []; powerups = []; lightTrails = []; gameState = "MENU"; hiveSwarmActive = false; if (swarmBarEl) swarmBarEl.classList.add("hidden"); }; quitBtn.addEventListener("click", quitAction); quitBtn.addEventListener("touchstart", quitAction, { passive: false }); }

function triggerNuke() {
    if (bombs <= 0 || gameState !== "PLAYING") return;
    bombs--; lifetimeStats.bombsUsed++; playSfx('nuke'); nukeFlash = 1.0; shake = 30; vibrate([30, 40, 30]);
    if (is3DMode) { enemyBullets3D = []; targets3D = []; }
    else {
        enemyBullets = [];
        targets.forEach(t => {
            let isTrueBoss = t.type.startsWith("boss") || t.isQueen;
            if (t.hp !== undefined && isTrueBoss) { t.hp = Math.max(1, t.hp - 50); spawnText(t.x, t.y, "-50", "#ffcc00", 24); }
            else t.hp = -1;
        });
        targets = targets.filter(t => t.hp === undefined || t.hp > 0);
    }
    updateUI();
}

// --- INPUT ---
canvas.addEventListener("mousemove", (e) => { usingMouse = true; let rect = canvas.getBoundingClientRect(); mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width); mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height); });
canvas.addEventListener("mousedown", (e) => { if (e.button === 0) mouse.leftDown = true; if (e.button === 2) mouse.rightDown = true; initAudio(); });
canvas.addEventListener("mouseup", (e) => { if (e.button === 0) mouse.leftDown = false; if (e.button === 2) mouse.rightDown = false; });
canvas.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "Space") e.preventDefault(); if (e.code === "KeyP") togglePause(); if (e.code === "KeyB") triggerNuke(); if (gameState === "GAMEOVER" && e.code === "KeyR") { if(menuOverlay) menuOverlay.classList.remove("hidden"); gameState = "MENU"; } });
window.addEventListener("keyup", (e) => keys[e.code] = false);

// --- TOUCH ---
const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.body.classList.add("touch-device");
// Some laptops (2-in-1s, touch-enabled Windows machines) report touch support even when the
// player is using a mouse. Track whichever input actually moves the aim, so the crosshair
// doesn't stay hidden just because the hardware happens to support touch.
let usingMouse = !isTouchDevice;
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
    joystickZone.addEventListener("touchstart", (e) => { e.preventDefault(); initAudio(); usingMouse = false; let t = e.changedTouches[0], rect = joystickZone.getBoundingClientRect(); joystickTouchId = t.identifier; joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; handleJoystickMove(t.clientX, t.clientY); }, { passive: false });
    joystickZone.addEventListener("touchmove", (e) => { e.preventDefault(); for (let t of e.changedTouches) if (t.identifier === joystickTouchId) handleJoystickMove(t.clientX, t.clientY); }, { passive: false });
    const endJoystickTouch = (e) => { for (let t of e.changedTouches) if (t.identifier === joystickTouchId) resetJoystick(); };
    joystickZone.addEventListener("touchend", endJoystickTouch); joystickZone.addEventListener("touchcancel", endJoystickTouch);
}
if (fireBtn) {
    fireBtn.addEventListener("touchstart", (e) => { e.preventDefault(); initAudio(); usingMouse = false; mouse.leftDown = true; fireBtn.classList.add("active"); }, { passive: false });
    const endFireTouch = (e) => { e.preventDefault(); mouse.leftDown = false; fireBtn.classList.remove("active"); };
    fireBtn.addEventListener("touchend", endFireTouch, { passive: false }); fireBtn.addEventListener("touchcancel", endFireTouch, { passive: false });
}
if (bombBtn) { bombBtn.addEventListener("touchstart", (e) => { e.preventDefault(); bombBtn.classList.add("active"); triggerNuke(); }, { passive: false }); bombBtn.addEventListener("touchend", () => bombBtn.classList.remove("active")); }
if (pauseBtn) { const pauseBtnAction = (e) => { if(e) e.preventDefault(); togglePause(); }; pauseBtn.addEventListener("touchstart", pauseBtnAction, { passive: false }); pauseBtn.addEventListener("mousedown", pauseBtnAction); }
if (muteBtn) { const muteBtnAction = (e) => { if(e) e.preventDefault(); initAudio(); toggleMute(); }; muteBtn.addEventListener("touchstart", muteBtnAction, { passive: false }); muteBtn.addEventListener("click", muteBtnAction); }

updateDifficultyUI();

function applyGlow(ctx, color, blur) { ctx.shadowBlur = blur; ctx.shadowColor = color; }
function clearGlow(ctx) { ctx.shadowBlur = 0; }
// Single cheap glow pass drawn behind a hull so it pops against the black backdrop, without
// paying shadowBlur's cost on every individual hull stroke/fill.
function popHalo(ctx, r, color, alpha = 0.55) {
    applyGlow(ctx, color, r * 1.1);
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
    // small white-hot core inside the colored glow for more energy/depth
    ctx.globalAlpha = alpha * 0.7; ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
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
            let hullGrad = ctx.createLinearGradient(-r, -r, r, r); hullGrad.addColorStop(0, "#f4f4ff"); hullGrad.addColorStop(0.45, "#c2ccd6"); hullGrad.addColorStop(1, "#4a5866");
            let wingGrad = ctx.createLinearGradient(-r, -r*1.3, -r, 0); wingGrad.addColorStop(0, "#a8bac4"); wingGrad.addColorStop(1, "#5c6d78");
            ctx.fillStyle = wingGrad; ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-r/2, 0); ctx.lineTo(-r, -r*1.3); ctx.lineTo(-r/4, -r*1.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r/2, 0); ctx.lineTo(-r, r*1.3); ctx.lineTo(-r/4, r*1.3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#222"; ctx.fillRect(-r*1.1, -r*0.6, r*0.3, r*0.2); ctx.fillRect(-r*1.1, r*0.4, r*0.3, r*0.2);
            ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r/4, -r*1.3); ctx.lineTo(r*0.9, -r*1.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r/4, r*1.3); ctx.lineTo(r*0.9, r*1.3); ctx.stroke();
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r*1.4, 0); ctx.lineTo(r/2, -r/4); ctx.lineTo(-r, -r/4); ctx.lineTo(-r, r/4); ctx.lineTo(r/2, r/4); ctx.fill(); ctx.stroke();
            // thin rim-light catching the top edge of the fuselage, and a soft belly shadow
            ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r*1.35, -r*0.03); ctx.lineTo(r/2, -r/4+1); ctx.lineTo(-r, -r/4+1); ctx.stroke();
            ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r*1.2, r*0.15); ctx.lineTo(-r, r/4); ctx.stroke();
            ctx.fillStyle = "#112233"; ctx.beginPath(); ctx.ellipse(r*0.2, 0, r*0.3, r*0.1, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#0055ff"; ctx.beginPath(); ctx.arc(-r*0.2, 0, r/6, 0, Math.PI*2); ctx.fill();
            applyGlow(ctx, "#fff", 3); ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(-r*0.25, -r*0.04, r*0.05, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r-2, -r/2, 4, 0, Math.PI*2); ctx.arc(-r-2, r/2, 4, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    falcon: { name: "FALCON", laserColor: "#ff3333", stats: { thrust: 5, fric: 0.97, fireRate: 0.35, heat: 18 },
        fire: () => { bullets.push(createBolt(0)); bullets.push(createBolt(Math.PI)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ff3333");
            let hullGrad = ctx.createRadialGradient(-r*0.3, -r*0.3, r*0.1, 0, 0, r); hullGrad.addColorStop(0, "#ffffff"); hullGrad.addColorStop(0.6, "#b8bcc0"); hullGrad.addColorStop(1, "#4a4d50");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
            ctx.fillRect(r*0.3, -r*0.4, r*0.9, r*0.25); ctx.strokeRect(r*0.3, -r*0.4, r*0.9, r*0.25); ctx.fillRect(r*0.3, r*0.15, r*0.9, r*0.25); ctx.strokeRect(r*0.3, r*0.15, r*0.9, r*0.25);
            ctx.beginPath(); ctx.arc(-r/5, 0, r*0.9, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(-r/5, 0, r*0.5, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-r/5, 0, r*0.87, Math.PI*1.15, Math.PI*1.7); ctx.stroke();
            ctx.fillStyle = "#777"; ctx.beginPath(); ctx.moveTo(-r/5, r*0.7); ctx.lineTo(r*0.5, r*0.8); ctx.lineTo(r*0.5, r*0.6); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(r*0.6, r*0.75, r*0.25, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(r*0.65, r*0.75, r*0.1, 0, Math.PI*2); ctx.fill(); 
            ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(-r*0.4, -r*0.4, r*0.2, 0, Math.PI); ctx.fill(); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#33ccff", 20); ctx.fillStyle = "#e6ffff"; ctx.fillRect(-r*1.1, -r*0.5, 6 + Math.random()*4, r); clearGlow(ctx); }
        }
    },
    tiefighter: { name: "TIE FIGHTER", laserColor: "#33ff33", stats: { thrust: 8, fric: 0.99, fireRate: 0.2, heat: 10 },
        fire: () => { bullets.push(createBolt(-0.1)); bullets.push(createBolt(0.1)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#33ff33");
            let ballGrad = ctx.createRadialGradient(-r/8, -r/8, r/10, 0, 0, r/2); ballGrad.addColorStop(0, "#ccc"); ballGrad.addColorStop(0.6, "#777"); ballGrad.addColorStop(1, "#0a0a0a");
            ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r/2); ctx.lineTo(0, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, r/2); ctx.lineTo(0, r*1.2); ctx.stroke();
            let panGrad = ctx.createLinearGradient(0, -r*1.2, 0, r*1.2); panGrad.addColorStop(0,"#050505"); panGrad.addColorStop(0.5,"#555"); panGrad.addColorStop(1,"#050505");
            ctx.lineWidth = 6; ctx.strokeStyle = panGrad; ctx.beginPath(); ctx.moveTo(-r*0.8, -r*1.2); ctx.lineTo(r*0.8, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.8, r*1.2); ctx.lineTo(r*0.8, r*1.2); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r*0.8, -r*1.2-3); ctx.lineTo(r*0.8, -r*1.2-3); ctx.stroke();
            ctx.fillStyle = ballGrad; ctx.beginPath(); ctx.arc(0, 0, r/2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, r/4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r/4, 0); ctx.lineTo(r/4, 0); ctx.moveTo(0, -r/4); ctx.lineTo(0, r/4); ctx.stroke();
            applyGlow(ctx, "#fff", 3); ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(-r*0.15, -r*0.15, r*0.06, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
            if (thrusting) { applyGlow(ctx, "#ff2222", 15); ctx.fillStyle = "#ffaaaa"; ctx.beginPath(); ctx.arc(-r/2, 0, 4, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    enterprise: { name: "ENTERPRISE", laserColor: "#33ccff", stats: { thrust: 4, fric: 0.95, fireRate: 0.55, heat: 25 },
        fire: () => { let b = createBolt(0, 15); b.r = 6; bullets.push(b); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#33ccff");
            let hullGrad = ctx.createRadialGradient(r*0.5, -r*0.2, 0, r*0.5, 0, r*0.8); hullGrad.addColorStop(0, "#ffffff"); hullGrad.addColorStop(0.7, "#c0ccd6"); hullGrad.addColorStop(1, "#6a7a8a");
            let neckGrad = ctx.createLinearGradient(0, -r*0.25, 0, r*0.25); neckGrad.addColorStop(0, "#c8d2dc"); neckGrad.addColorStop(1, "#6a7684");
            let nacelleGrad = ctx.createLinearGradient(0, -r, 0, -r*0.7); nacelleGrad.addColorStop(0, "#98a4ae"); nacelleGrad.addColorStop(1, "#4a545c");
            let nacelleGrad2 = ctx.createLinearGradient(0, r*0.7, 0, r); nacelleGrad2.addColorStop(0, "#4a545c"); nacelleGrad2.addColorStop(1, "#98a4ae");
            ctx.fillStyle = neckGrad; ctx.strokeStyle = "#445566"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-r*0.3, 0, r*0.7, r*0.25, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.ellipse(-r*0.9, 0, r*0.1, r*0.2, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = nacelleGrad; ctx.fillRect(-r*1.1, -r, r*1.4, r*0.3); ctx.strokeRect(-r*1.1, -r, r*1.4, r*0.3); ctx.fillStyle = nacelleGrad2; ctx.fillRect(-r*1.1, r*0.7, r*1.4, r*0.3); ctx.strokeRect(-r*1.1, r*0.7, r*1.4, r*0.3);
            ctx.fillStyle = hullGrad; ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.8, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.4, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.2, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.79, Math.PI*1.2, Math.PI*1.7); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#00d4ff", 20); ctx.fillStyle = "#e0f7fa"; ctx.fillRect(-r*0.9, -r*0.95, r*0.8, r*0.2); ctx.fillRect(-r*0.9, r*0.75, r*0.8, r*0.2); applyGlow(ctx, "#ff5500", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r*0.3, 0, 4, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    apollo: { name: "APOLLO", laserColor: "#ffaa00", stats: { thrust: 9, fric: 1.0, fireRate: 0.25, heat: 15 }, 
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ffaa00");
            let bodyGrad = ctx.createLinearGradient(-r, -r*0.4, r, r*0.4); bodyGrad.addColorStop(0, "#ddd"); bodyGrad.addColorStop(0.5, "#fff"); bodyGrad.addColorStop(1, "#666");
            let noseGrad = ctx.createLinearGradient(r*0.2, -r*0.4, r*0.2, r*0.4); noseGrad.addColorStop(0, "#eee"); noseGrad.addColorStop(0.5, "#ccc"); noseGrad.addColorStop(1, "#777");
            ctx.fillStyle = bodyGrad; ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.fillRect(-r*1.2, -r*0.4, r*1.4, r*0.8); ctx.strokeRect(-r*1.2, -r*0.4, r*1.4, r*0.8);
            ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r*1.2, -r*0.38); ctx.lineTo(r*0.2, -r*0.38); ctx.stroke();
            ctx.fillStyle = "#d32f2f"; ctx.fillRect(-r*0.4, -r*0.4, r*0.1, r*0.8); ctx.fillStyle = "#1976d2"; ctx.fillRect(r*0.2, -r*0.4, r*0.05, r*0.8);
            ctx.fillStyle = noseGrad; ctx.strokeStyle = "#333"; ctx.beginPath(); ctx.moveTo(r*0.2, -r*0.4); ctx.lineTo(r*1.2, 0); ctx.lineTo(r*0.2, r*0.4); ctx.fill(); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#ff7700", 25); ctx.fillStyle = "#ffbb00"; ctx.beginPath(); ctx.moveTo(-r*1.2, -r*0.4); ctx.lineTo(-r*3.5, 0); ctx.lineTo(-r*1.2, r*0.4); ctx.fill(); clearGlow(ctx); }
        }
    },
    serenity: { name: "SERENITY", laserColor: "#ffaa00", stats: { thrust: 7, fric: 0.98, fireRate: 0.25, heat: 12 },
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ffaa00");
            let hullGrad = ctx.createLinearGradient(0, -r, 0, r); hullGrad.addColorStop(0, "#bfdcd0"); hullGrad.addColorStop(0.5, "#8ba89c"); hullGrad.addColorStop(1, "#4a5f58");
            let finGrad = ctx.createLinearGradient(-r*0.1, 0, r*0.25, 0); finGrad.addColorStop(0, "#5c7268"); finGrad.addColorStop(1, "#2c362f");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#222"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-r*0.2, 0, r*0.6, r*0.25, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-r*0.2, 0, r*0.58, Math.PI*1.15, Math.PI*1.7); ctx.stroke();
            ctx.fillStyle = hullGrad; ctx.fillRect(r*0.4, -r*0.1, r*0.5, r*0.2); ctx.strokeRect(r*0.4, -r*0.1, r*0.5, r*0.2); ctx.beginPath(); ctx.arc(r*0.9, 0, r*0.18, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ffcc66"; ctx.fillRect(r*0.85, -r*0.05, r*0.1, r*0.1); ctx.fillStyle = finGrad; ctx.fillRect(-r*0.1, -r*0.6, r*0.35, r*0.4); ctx.fillRect(-r*0.1, r*0.2, r*0.35, r*0.4);
            if (thrusting) { applyGlow(ctx, "#ffaa00", 25); ctx.fillStyle = "#ffffaa"; ctx.beginPath(); ctx.arc(-r*1.1, 0, r*0.2, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    borg: { name: "BORG CUBE", laserColor: "#00ff00", stats: { thrust: 3, fric: 0.90, fireRate: 1.5, heat: 40 }, 
        fire: () => { for(let i=0; i<Math.PI*2; i+=Math.PI*2/5) bullets.push(createBolt(i, 8)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#00ff00");
            let cubeGrad = ctx.createRadialGradient(-r*0.3, -r*0.3, 0, 0, 0, r*1.2); cubeGrad.addColorStop(0, "#484848"); cubeGrad.addColorStop(0.6, "#222"); cubeGrad.addColorStop(1, "#020202");
            ctx.fillStyle = cubeGrad; ctx.strokeStyle = "#005500"; ctx.lineWidth = 1; ctx.fillRect(-r*0.8, -r*0.8, r*1.6, r*1.6); ctx.strokeRect(-r*0.8, -r*0.8, r*1.6, r*1.6);
            ctx.beginPath(); for(let i=-r*0.8; i<=r*0.8; i+=r*0.32) { ctx.moveTo(i, -r*0.8); ctx.lineTo(i, r*0.8); ctx.moveTo(-r*0.8, i); ctx.lineTo(r*0.8, i); } ctx.stroke();
            // bevel: a lit top-left edge and a dark bottom-right AO corner sell the block as a solid cube
            ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r*0.8, r*0.8); ctx.lineTo(-r*0.8, -r*0.8); ctx.lineTo(r*0.8, -r*0.8); ctx.stroke();
            let aoGrad = ctx.createRadialGradient(r*0.7, r*0.7, 0, r*0.7, r*0.7, r*0.9); aoGrad.addColorStop(0, "rgba(0,0,0,0.5)"); aoGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = aoGrad; ctx.fillRect(-r*0.8, -r*0.8, r*1.6, r*1.6);
            applyGlow(ctx, "#00ff00", 10); ctx.fillStyle = "#00ff00"; ctx.fillRect(-r*0.4, -r*0.4, 2, 2); ctx.fillRect(r*0.2, r*0.5, 2, 2); ctx.fillRect(r*0.6, -r*0.2, 2, 2); clearGlow(ctx);
            if (thrusting) { applyGlow(ctx, "#00ff00", 15); ctx.fillStyle = "#aaffaa"; ctx.fillRect(-r*0.8, -r*0.8, 4, r*1.6); clearGlow(ctx); }
        }
    },
    pelican: { name: "PELICAN", laserColor: "#00aaff", stats: { thrust: 5, fric: 0.96, fireRate: 0.65, heat: 22 },
        fire: () => { bullets.push(createBolt(0)); bullets.push(createBolt(-0.15)); bullets.push(createBolt(0.15)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#00aaff");
            let camoGrad = ctx.createLinearGradient(-r, -r, r, r); camoGrad.addColorStop(0, "#616b30"); camoGrad.addColorStop(0.5, "#4a5225"); camoGrad.addColorStop(1, "#20240e");
            let domeGrad = ctx.createRadialGradient(r*0.75, -r*0.05, 0, r*0.8, 0, r*0.18); domeGrad.addColorStop(0, "#e0ffff"); domeGrad.addColorStop(1, "#5599aa");
            ctx.fillStyle = camoGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.fillRect(-r*0.8, -r*0.3, r*1.6, r*0.6); ctx.strokeRect(-r*0.8, -r*0.3, r*1.6, r*0.6);
            ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r*0.8, -r*0.28); ctx.lineTo(r*0.8, -r*0.28); ctx.stroke();
            ctx.fillStyle = camoGrad; ctx.beginPath(); ctx.moveTo(-r*0.4, -r*0.3); ctx.lineTo(-r*0.6, -r*0.9); ctx.lineTo(r*0.2, -r*0.9); ctx.lineTo(r*0.4, -r*0.3); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.4, r*0.3); ctx.lineTo(-r*0.6, r*0.9); ctx.lineTo(r*0.2, r*0.9); ctx.lineTo(r*0.4, r*0.3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = domeGrad; ctx.beginPath(); ctx.arc(r*0.8, 0, r*0.15, 0, Math.PI*2); ctx.fill();
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.fillRect(-r*0.9, -r*0.2, 5, r*0.4); ctx.fillRect(-r*0.7, -r*0.8, 5, r*0.3); ctx.fillRect(-r*0.7, r*0.5, 5, r*0.3); clearGlow(ctx); }
        }
    },
    tardis: { name: "TARDIS", laserColor: "#ffffff", stats: { thrust: 6, fric: 0.99, fireRate: 0.7, heat: 25 },
        fire: () => { let b = createBolt(0, 8); b.r = 20; b.range = canvas.width*0.4; bullets.push(b); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#3399ff");
            let boxGrad = ctx.createLinearGradient(-r, 0, r, 0); boxGrad.addColorStop(0, "#002244"); boxGrad.addColorStop(0.4, "#0066bb"); boxGrad.addColorStop(0.55, "#004488"); boxGrad.addColorStop(1, "#001830");
            ctx.fillStyle = boxGrad; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.fillRect(-r*0.7, -r*0.7, r*1.4, r*1.4); ctx.strokeRect(-r*0.7, -r*0.7, r*1.4, r*1.4); ctx.strokeRect(-r*0.5, -r*0.5, r*1.0, r*1.0);
            ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r*0.7, -r*0.68); ctx.lineTo(r*0.7, -r*0.68); ctx.stroke();
            ctx.fillStyle = "#dddddd"; ctx.fillRect(r*0.2, -r*0.5, r*0.3, r*0.3); ctx.fillRect(r*0.2, r*0.2, r*0.3, r*0.3); 
            applyGlow(ctx, "#ffffff", 15); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(r*0.5, 0, r*0.2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); clearGlow(ctx); 
            if (thrusting) { applyGlow(ctx, "#0088ff", 25); ctx.strokeStyle = "#00aaff"; ctx.lineWidth = 3; ctx.strokeRect(-r*0.8, -r*0.8, r*1.6, r*1.6); clearGlow(ctx); }
        }
    },
    viper: { name: "VIPER", laserColor: "#ff2200", stats: { thrust: 7, fric: 0.98, fireRate: 0.15, heat: 8 }, 
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ff2200");
            let hullGrad = ctx.createLinearGradient(-r, -r*0.3, r, r*0.3); hullGrad.addColorStop(0, "#e8e8e8"); hullGrad.addColorStop(0.5, "#ffffff"); hullGrad.addColorStop(1, "#9a9a9a");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#222"; ctx.lineWidth = 1; ctx.fillRect(-r*1.2, -r*0.45, r*0.4, r*0.25); ctx.fillRect(-r*1.2, r*0.2, r*0.4, r*0.25); ctx.fillRect(-r*1.2, -r*0.12, r*0.4, r*0.24);
            ctx.beginPath(); ctx.moveTo(-r*0.8, -r*0.3); ctx.lineTo(r*0.2, -r*0.2); ctx.lineTo(r*1.3, -r*0.05); ctx.lineTo(r*1.3, r*0.05); ctx.lineTo(r*0.2, r*0.2); ctx.lineTo(-r*0.8, r*0.3); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r*0.8, -r*0.29); ctx.lineTo(r*0.2, -r*0.19); ctx.lineTo(r*1.28, -r*0.05); ctx.stroke();
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
            let hullGrad = ctx.createLinearGradient(-r, -r*0.3, r, r*0.3); hullGrad.addColorStop(0, "#22282f"); hullGrad.addColorStop(0.5, "#454f5a"); hullGrad.addColorStop(1, "#14171b");
            let portGrad = ctx.createRadialGradient(-r*0.06, -r*0.36, 0, 0, 0, r*0.3); portGrad.addColorStop(0, "#3a3a3a"); portGrad.addColorStop(1, "#000");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.fillRect(-r, -r*0.3, r*1.5, r*0.6); ctx.strokeRect(-r, -r*0.3, r*1.5, r*0.6);
            ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r, -r*0.29); ctx.lineTo(r*0.5, -r*0.29); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r*0.5, -r*0.3); ctx.lineTo(r*1.2, -r*0.1); ctx.lineTo(r*1.2, r*0.1); ctx.lineTo(r*0.5, r*0.3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = portGrad; ctx.strokeStyle = "#111"; ctx.beginPath(); ctx.arc(-r*0.5, -r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.2, -r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(-r*0.5, r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(r*0.2, r*0.5, r*0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#88ddff"; ctx.beginPath(); ctx.arc(-r*0.5, -r*0.5, r*0.15, 0, Math.PI*2); ctx.arc(r*0.2, -r*0.5, r*0.15, 0, Math.PI*2); ctx.arc(-r*0.5, r*0.5, r*0.15, 0, Math.PI*2); ctx.arc(r*0.2, r*0.5, r*0.15, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
        }
    },
    lightship: { name: "LIGHTSHIP", laserColor: "#00ffff", stats: { thrust: 8, fric: 0.99, fireRate: 0.3, heat: 12 },
        fire: () => { bullets.push(createBolt(0)); playSfx('shoot'); },
        draw: (ctx, r, thrusting) => {
            let hullGrad = ctx.createRadialGradient(r*0.2, 0, 0, 0, 0, r*1.3); hullGrad.addColorStop(0, "#0a2530"); hullGrad.addColorStop(0.6, "#041018"); hullGrad.addColorStop(1, "#000");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, -r*0.8); ctx.lineTo(-r*0.5, 0); ctx.lineTo(-r, r*0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r*0.8, 0); ctx.stroke();
            ctx.strokeStyle = "rgba(0,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r*0.9, -r*0.06); ctx.lineTo(-r*0.6, -r*0.55); ctx.stroke();
            if (thrusting) { applyGlow(ctx, "#00ffff", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r*0.6, 0, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); if (frames % 4 === 0) lightTrails.push({ x: ship.x, y: ship.y, life: 8.0, maxLife: 8.0 }); }
        }
    },
    milano: { name: "MILANO", laserColor: "#ff9900", stats: { thrust: 7, fric: 0.96, fireRate: 0.45, heat: 22 },
        fire: () => { bullets.push(createBolt(-0.1)); bullets.push(createBolt(0.1)); bullets.push(createBolt(-0.25)); bullets.push(createBolt(0.25)); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            popHalo(ctx, r, "#ff9900");
            let hullGrad = ctx.createLinearGradient(-r*0.3, -r, r*0.1, r); hullGrad.addColorStop(0, "#4a9fee"); hullGrad.addColorStop(0.5, "#1976d2"); hullGrad.addColorStop(1, "#0a3866");
            let noseGrad = ctx.createLinearGradient(-r*0.8, -r*0.2, r*1.2, r*0.2); noseGrad.addColorStop(0, "#cc5500"); noseGrad.addColorStop(0.5, "#ffaa33"); noseGrad.addColorStop(1, "#ff8800");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-r*0.5, 0); ctx.lineTo(-r*0.2, -r*1.2); ctx.lineTo(r*0.2, -r*1.2); ctx.lineTo(r*0.5, 0); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r*0.5, 0); ctx.lineTo(-r*0.2, r*1.2); ctx.lineTo(r*0.2, r*1.2); ctx.lineTo(r*0.5, 0); ctx.fill(); ctx.stroke();
            ctx.fillStyle = noseGrad; ctx.beginPath(); ctx.moveTo(-r*0.8, -r*0.2); ctx.lineTo(r*1.2, 0); ctx.lineTo(-r*0.8, r*0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.arc(r*0.2, 0, r*0.15, 0, Math.PI*2); ctx.fill();
            if (thrusting) { applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.fillRect(-r*0.9, -r*0.1, 4, r*0.2); clearGlow(ctx); }
        }
    },
    fsociety: { name: "FSOCIETY", laserColor: "#00ff00", stats: { thrust: 6, fric: 0.97, fireRate: 0.18, heat: 9 },
        fire: () => { let b = createBolt(0, 13); b.isHack = true; b.r = 5; bullets.push(b); playSfx('shoot'); }, 
        draw: (ctx, r, thrusting) => {
            let gx = (Math.random()-0.5)*4; let gy = (Math.random()-0.5)*4;
            let glitchGrad = ctx.createRadialGradient(-r*0.15, -r*0.15, 0, 0, 0, r*0.9); glitchGrad.addColorStop(0, "rgba(0,255,0,0.12)"); glitchGrad.addColorStop(1, "rgba(0,255,0,0)");
            ctx.fillStyle = glitchGrad; ctx.fillRect(-r, -r, r*2, r*2);
            ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 1;
            ctx.strokeRect(-r/2 + gx, -r/2 + gy, r, r); ctx.strokeRect(-r/4 - gx, -r/4 - gy, r*1.5, r*0.5);
            ctx.beginPath(); ctx.moveTo(-r, -r + gx); ctx.lineTo(r, gy); ctx.lineTo(-r, r - gx); ctx.stroke();
            if (thrusting) { ctx.fillStyle = "#00ff00"; ctx.fillRect(-r-5+gx, -2+gy, 5, 4); }
        }
    }
};

// --- SHIP SELECT DROPDOWN ---
const ShipMenuOrder = [
    { id: "xwing", label: "X-Wing (Balanced)" },
    { id: "falcon", label: "Falcon (Turret)" },
    { id: "tiefighter", label: "TIE (Fast/Weak)" },
    { id: "enterprise", label: "Enterprise (Heavy)" },
    { id: "apollo", label: "Apollo (Drift)" },
    { id: "serenity", label: "Serenity (Agile)" },
    { id: "borg", label: "Borg Cube (360)" },
    { id: "pelican", label: "Pelican (Shotgun)" },
    { id: "tardis", label: "TARDIS (Sonic Wave)" },
    { id: "viper", label: "Viper (Rapid)" },
    { id: "nebuchadnezzar", label: "Nebuchadnezzar (EMP)" },
    { id: "lightship", label: "Lightship (Trail)" },
    { id: "milano", label: "Milano (Quad Blaster)" },
    { id: "fsociety", label: "fsociety (Glitch Hack)" }
];

function renderShipIcon(shipId, size = 32) {
    let c = document.createElement("canvas"); c.width = size; c.height = size;
    let ictx = c.getContext("2d");
    ictx.translate(size / 2, size / 2);
    ShipDesigns[shipId].draw(ictx, size * 0.32, false);
    return c.toDataURL();
}

const shipSelectCurrent = document.getElementById("shipSelectCurrent");
const shipSelectList = document.getElementById("shipSelectList");
const shipSelectIcon = document.getElementById("shipSelectIcon");
const shipSelectLabel = document.getElementById("shipSelectLabel");
const launchBtn = document.getElementById("launchBtn");

function setMenuShip(shipId) {
    selectedShipType = ShipDesigns[shipId] ? shipId : "xwing";
    let entry = ShipMenuOrder.find(s => s.id === selectedShipType) || ShipMenuOrder[0];
    if (shipSelectIcon) shipSelectIcon.src = renderShipIcon(selectedShipType);
    if (shipSelectLabel) shipSelectLabel.textContent = entry.label;
}

function shipStatBars(shipId) {
    let s = ShipDesigns[shipId] && ShipDesigns[shipId].stats;
    if (!s) return "";
    let all = Object.values(ShipDesigns).filter(d => d.stats).map(d => d.stats);
    let minT = Math.min(...all.map(a => a.thrust)), maxT = Math.max(...all.map(a => a.thrust));
    let minR = Math.min(...all.map(a => a.fireRate)), maxR = Math.max(...all.map(a => a.fireRate));
    let spd = maxT > minT ? Math.round(1 + ((s.thrust - minT) / (maxT - minT)) * 4) : 3;
    let rate = maxR > minR ? Math.round(1 + ((maxR - s.fireRate) / (maxR - minR)) * 4) : 3;
    let dots = (n) => Array.from({length: 5}, (_, i) => `<span class="ship-stat-dot ${i < n ? 'filled' : ''}"></span>`).join('');
    return `<span class="ship-stat-bars">
        <span class="ship-stat-row"><span class="ship-stat-label spd">SPD</span><span class="ship-stat-dots">${dots(spd)}</span></span>
        <span class="ship-stat-row"><span class="ship-stat-label rate">RATE</span><span class="ship-stat-dots">${dots(rate)}</span></span>
    </span>`;
}

function rebuildShipDropdown() {
    if (!shipSelectList) return;
    shipSelectList.innerHTML = "";
    ShipMenuOrder.forEach(s => {
        let opt = document.createElement("div");
        opt.className = "ship-option"; opt.setAttribute("data-ship", s.id);
        let img = document.createElement("img"); img.src = renderShipIcon(s.id); img.alt = "";
        let span = document.createElement("span"); span.className = "ship-option-label"; span.textContent = s.label;
        let bars = document.createElement("span"); bars.innerHTML = shipStatBars(s.id);
        opt.appendChild(img); opt.appendChild(span); opt.appendChild(bars);
        const chooseAction = (e) => { if(e) e.preventDefault(); initAudio(); setMenuShip(s.id); shipSelectList.classList.add("hidden"); };
        opt.addEventListener("click", chooseAction); opt.addEventListener("touchstart", chooseAction, { passive: false });
        shipSelectList.appendChild(opt);
    });
}
rebuildShipDropdown();

if (shipSelectCurrent) {
    const toggleAction = (e) => { if(e) e.preventDefault(); initAudio(); if (shipSelectList) shipSelectList.classList.toggle("hidden"); };
    shipSelectCurrent.addEventListener("click", toggleAction); shipSelectCurrent.addEventListener("touchstart", toggleAction, { passive: false });
}

document.addEventListener("click", (e) => {
    if (shipSelectList && shipSelectCurrent && !shipSelectList.classList.contains("hidden")) {
        if (!shipSelectList.contains(e.target) && !shipSelectCurrent.contains(e.target)) shipSelectList.classList.add("hidden");
    }
});

if (launchBtn) {
    const launchAction = (e) => {
        if(e) e.preventDefault();
        initAudio();
        try { startGame(selectedShipType); } catch(err) { console.error("Start Game Error", err); }
    };
    launchBtn.addEventListener("click", launchAction); launchBtn.addEventListener("touchstart", launchAction, { passive: false });
}

setMenuShip(selectedShipType);

function maybeShowFirstRunHint() {
    try { if (localStorage.getItem(pKey("sfc_seenHint"))) return; } catch(e) {}
    const hint = document.getElementById("firstRunHint");
    if (!hint) return;
    hint.classList.remove("hidden");
    const dismiss = () => { hint.classList.add("hidden"); try { localStorage.setItem(pKey("sfc_seenHint"), "1"); } catch(e) {} };
    const closeBtn = document.getElementById("firstRunHintClose");
    if (closeBtn) closeBtn.addEventListener("click", dismiss);
    if (launchBtn) launchBtn.addEventListener("click", dismiss, { once: true });
}

// --- SHIP BUILDER (unlocked after beating level 25) ---
function shadeColor(hex, amt) {
    let num = parseInt((hex || "#888888").replace("#", ""), 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + amt));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
    let b = Math.min(255, Math.max(0, (num & 0xff) + amt));
    return `rgb(${r}, ${g}, ${b})`;
}

const BuilderShapes = {
    dart: { label: "Dart", draw: (ctx, r, hull, accent, thrusting) => {
        popHalo(ctx, r, accent);
        let grad = ctx.createLinearGradient(-r, 0, r, 0); grad.addColorStop(0, shadeColor(hull, -50)); grad.addColorStop(1, shadeColor(hull, 40));
        ctx.fillStyle = grad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r*1.4, 0); ctx.lineTo(-r*0.3, -r*0.25); ctx.lineTo(-r*1.1, -r*0.7); ctx.lineTo(-r*0.55, -r*0.15);
        ctx.lineTo(-r*0.55, r*0.15); ctx.lineTo(-r*1.1, r*0.7); ctx.lineTo(-r*0.3, r*0.25); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(r*0.35, 0, r*0.15, 0, Math.PI*2); ctx.fill();
        if (thrusting) { applyGlow(ctx, accent, 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r*1.0, -r*0.4, 3, 0, Math.PI*2); ctx.arc(-r*1.0, r*0.4, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
    } },
    wing: { label: "Wing", draw: (ctx, r, hull, accent, thrusting) => {
        popHalo(ctx, r, accent);
        let grad = ctx.createLinearGradient(-r, -r, r, r); grad.addColorStop(0, shadeColor(hull, 40)); grad.addColorStop(1, shadeColor(hull, -40));
        ctx.fillStyle = grad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r*1.3, 0); ctx.lineTo(-r*0.2, -r*1.1); ctx.lineTo(-r*0.9, -r*0.9); ctx.lineTo(-r*0.4, -r*0.15);
        ctx.lineTo(-r*0.9, r*0.9); ctx.lineTo(-r*0.2, r*1.1); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#112233"; ctx.beginPath(); ctx.ellipse(r*0.2, 0, r*0.3, r*0.12, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(-r*0.1, 0, r*0.13, 0, Math.PI*2); ctx.fill();
        if (thrusting) { applyGlow(ctx, accent, 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r*0.85, -r*0.85, 3, 0, Math.PI*2); ctx.arc(-r*0.85, r*0.85, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
    } },
    saucer: { label: "Saucer", draw: (ctx, r, hull, accent, thrusting) => {
        popHalo(ctx, r, accent);
        let grad = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r); grad.addColorStop(0, shadeColor(hull, 50)); grad.addColorStop(1, shadeColor(hull, -40));
        ctx.fillStyle = grad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, r*1.1, r*0.55, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shadeColor(hull, 20); ctx.beginPath(); ctx.ellipse(0, -r*0.15, r*0.5, r*0.35, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0, -r*0.15, r*0.15, 0, Math.PI*2); ctx.fill();
        if (thrusting) { applyGlow(ctx, accent, 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r*1.0, 0, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx); }
    } },
    block: { label: "Block", draw: (ctx, r, hull, accent, thrusting) => {
        popHalo(ctx, r, accent);
        let grad = ctx.createLinearGradient(-r, 0, r, 0); grad.addColorStop(0, shadeColor(hull, -30)); grad.addColorStop(1, shadeColor(hull, 30));
        ctx.fillStyle = grad; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
        ctx.fillRect(-r*1.1, -r*0.5, r*1.9, r*1.0); ctx.strokeRect(-r*1.1, -r*0.5, r*1.9, r*1.0);
        ctx.fillStyle = shadeColor(hull, -10); ctx.beginPath(); ctx.moveTo(r*0.8, -r*0.5); ctx.lineTo(r*1.3, 0); ctx.lineTo(r*0.8, r*0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0, 0, r*0.16, 0, Math.PI*2); ctx.fill();
        if (thrusting) { applyGlow(ctx, accent, 15); ctx.fillStyle = "#fff"; ctx.fillRect(-r*1.15, -r*0.4, 4, r*0.3); ctx.fillRect(-r*1.15, r*0.1, 4, r*0.3); clearGlow(ctx); }
    } }
};

function computeCustomStats(speedLv, rateLv, powerLv) {
    let thrust = 4 + speedLv;
    let fireRate = Math.max(0.15, 0.75 - rateLv * 0.11);
    let heat = 10 + powerLv * 4;
    let bulletCount = powerLv >= 5 ? 3 : (powerLv >= 3 ? 2 : 1);
    return { thrust, fireRate, heat, bulletCount };
}

function buildCustomShipDesign(cfg) {
    const shape = BuilderShapes[cfg.shape] || BuilderShapes.dart;
    const s = computeCustomStats(cfg.speedLv, cfg.rateLv, cfg.powerLv);
    return {
        name: cfg.name || "CUSTOM",
        laserColor: cfg.laserColor,
        stats: { thrust: s.thrust, fric: 0.97, fireRate: s.fireRate, heat: s.heat },
        fire: () => {
            if (s.bulletCount === 1) bullets.push(createBolt(0));
            else if (s.bulletCount === 2) { bullets.push(createBolt(-0.12)); bullets.push(createBolt(0.12)); }
            else { bullets.push(createBolt(-0.2)); bullets.push(createBolt(0)); bullets.push(createBolt(0.2)); }
            playSfx('shoot');
        },
        draw: (ctx, r, thrusting) => shape.draw(ctx, r, cfg.hullColor, cfg.laserColor, thrusting)
    };
}

let customShipConfig = null;
let shipBuilderUnlocked = false;

function registerCustomShip(cfg) {
    customShipConfig = cfg;
    ShipDesigns.custom = buildCustomShipDesign(cfg);
    let entry = ShipMenuOrder.find(s => s.id === "custom");
    let label = `${cfg.name || "CUSTOM"} (Custom)`;
    if (entry) entry.label = label; else ShipMenuOrder.push({ id: "custom", label });
    rebuildShipDropdown();
    if (selectedShipType === "custom") setMenuShip("custom");
}

function updateBuilderUnlockUI() {
    if (!shipBuilderBtn) return;
    shipBuilderBtn.disabled = !shipBuilderUnlocked;
    shipBuilderBtn.textContent = shipBuilderUnlocked ? "🛠️ SHIP BUILDER" : "🛠️ SHIP BUILDER (LOCKED)";
    shipBuilderBtn.title = shipBuilderUnlocked ? "" : "Reach Level 20 to unlock";
}

const shipBuilderBtn = document.getElementById("shipBuilderBtn");
const builderOverlay = document.getElementById("builderOverlay");
const builderPreview = document.getElementById("builderPreview");
const builderPreviewCtx = builderPreview ? builderPreview.getContext("2d") : null;
const builderNameInput = document.getElementById("builderName");
const builderShapesEl = document.getElementById("builderShapes");
const builderHullColor = document.getElementById("builderHullColor");
const builderLaserColor = document.getElementById("builderLaserColor");
const builderSpeed = document.getElementById("builderSpeed");
const builderRate = document.getElementById("builderRate");
const builderPower = document.getElementById("builderPower");
const builderSpeedVal = document.getElementById("builderSpeedVal");
const builderRateVal = document.getElementById("builderRateVal");
const builderPowerVal = document.getElementById("builderPowerVal");
const builderPointsEl = document.getElementById("builderPoints");
const builderSaveBtn = document.getElementById("builderSaveBtn");
const builderDeleteBtn = document.getElementById("builderDeleteBtn");
const builderBackBtn = document.getElementById("builderBackBtn");

const BUILDER_BUDGET = 9;
let builderShape = "dart";

function defaultBuilderConfig() {
    return { name: "CUSTOM", shape: "dart", hullColor: "#8899aa", laserColor: "#33ccff", speedLv: 3, rateLv: 3, powerLv: 3 };
}

function getBuilderConfig() {
    return {
        name: (builderNameInput && builderNameInput.value.trim()) || "CUSTOM",
        shape: builderShape,
        hullColor: builderHullColor ? builderHullColor.value : "#8899aa",
        laserColor: builderLaserColor ? builderLaserColor.value : "#33ccff",
        speedLv: builderSpeed ? parseInt(builderSpeed.value) : 3,
        rateLv: builderRate ? parseInt(builderRate.value) : 3,
        powerLv: builderPower ? parseInt(builderPower.value) : 3
    };
}

function applyBuilderConfig(cfg) {
    if (builderNameInput) builderNameInput.value = cfg.name;
    builderShape = cfg.shape;
    if (builderHullColor) builderHullColor.value = cfg.hullColor;
    if (builderLaserColor) builderLaserColor.value = cfg.laserColor;
    if (builderSpeed) builderSpeed.value = cfg.speedLv;
    if (builderRate) builderRate.value = cfg.rateLv;
    if (builderPower) builderPower.value = cfg.powerLv;
    refreshBuilderUI();
}

function clampBuilderPoints(changed) {
    let s = parseInt(builderSpeed.value), r = parseInt(builderRate.value), p = parseInt(builderPower.value);
    let total = s + r + p;
    if (total > BUILDER_BUDGET) {
        let over = total - BUILDER_BUDGET;
        if (changed === 'speed') s = Math.max(1, s - over);
        else if (changed === 'rate') r = Math.max(1, r - over);
        else if (changed === 'power') p = Math.max(1, p - over);
        builderSpeed.value = s; builderRate.value = r; builderPower.value = p;
    }
}

function renderBuilderPreview() {
    if (!builderPreviewCtx) return;
    builderPreviewCtx.clearRect(0, 0, builderPreview.width, builderPreview.height);
    let cfg = getBuilderConfig();
    let shape = BuilderShapes[cfg.shape] || BuilderShapes.dart;
    builderPreviewCtx.save();
    builderPreviewCtx.translate(builderPreview.width / 2, builderPreview.height / 2);
    shape.draw(builderPreviewCtx, 35, cfg.hullColor, cfg.laserColor, true);
    builderPreviewCtx.restore();
}

function refreshBuilderUI() {
    if (!builderSpeed || !builderRate || !builderPower) return;
    let s = parseInt(builderSpeed.value), r = parseInt(builderRate.value), p = parseInt(builderPower.value);
    if (builderSpeedVal) builderSpeedVal.textContent = s;
    if (builderRateVal) builderRateVal.textContent = r;
    if (builderPowerVal) builderPowerVal.textContent = p;
    if (builderPointsEl) builderPointsEl.textContent = `POINTS LEFT: ${BUILDER_BUDGET - (s + r + p)}/${BUILDER_BUDGET}`;
    if (builderShapesEl) Array.from(builderShapesEl.children).forEach(btn => btn.classList.toggle("active", btn.getAttribute("data-shape") === builderShape));
    renderBuilderPreview();
}

if (builderShapesEl) {
    Object.keys(BuilderShapes).forEach(id => {
        let btn = document.createElement("div");
        btn.className = "builder-shape-btn"; btn.setAttribute("data-shape", id);
        let img = document.createElement("img");
        let c = document.createElement("canvas"); c.width = 32; c.height = 32;
        let ic = c.getContext("2d"); ic.translate(16, 16); BuilderShapes[id].draw(ic, 10, "#8899aa", "#33ccff", false);
        img.src = c.toDataURL();
        let span = document.createElement("span"); span.textContent = BuilderShapes[id].label;
        btn.appendChild(img); btn.appendChild(span);
        const chooseShape = (e) => { if(e) e.preventDefault(); initAudio(); builderShape = id; refreshBuilderUI(); };
        btn.addEventListener("click", chooseShape); btn.addEventListener("touchstart", chooseShape, { passive: false });
        builderShapesEl.appendChild(btn);
    });
}

[builderHullColor, builderLaserColor].forEach(el => { if (el) el.addEventListener("input", renderBuilderPreview); });
if (builderSpeed) builderSpeed.addEventListener("input", () => { clampBuilderPoints('speed'); refreshBuilderUI(); });
if (builderRate) builderRate.addEventListener("input", () => { clampBuilderPoints('rate'); refreshBuilderUI(); });
if (builderPower) builderPower.addEventListener("input", () => { clampBuilderPoints('power'); refreshBuilderUI(); });
if (builderNameInput) builderNameInput.addEventListener("input", renderBuilderPreview);

function openBuilder() {
    if (!shipBuilderUnlocked) return;
    applyBuilderConfig(customShipConfig || defaultBuilderConfig());
    if (builderDeleteBtn) builderDeleteBtn.classList.toggle("hidden", !customShipConfig);
    if (menuOverlay) menuOverlay.classList.add("hidden");
    if (builderOverlay) builderOverlay.classList.remove("hidden");
}
function closeBuilder() {
    if (builderOverlay) builderOverlay.classList.add("hidden");
    if (menuOverlay) menuOverlay.classList.remove("hidden");
}

if (moreToggleBtn) {
    const toggleMoreAction = (e) => {
        if(e) e.preventDefault(); initAudio();
        let willShow = menuExtras.classList.contains("hidden");
        menuExtras.classList.toggle("hidden");
        moreToggleBtn.innerText = willShow ? "▴ FEWER OPTIONS" : "▾ MORE OPTIONS";
    };
    moreToggleBtn.addEventListener("click", toggleMoreAction); moreToggleBtn.addEventListener("touchstart", toggleMoreAction, { passive: false });
}
if (profileSwitchBtn) { const openProfAction = (e) => { if(e) e.preventDefault(); initAudio(); renderProfilesList(); if(menuOverlay) menuOverlay.classList.add("hidden"); if(profilesOverlay) profilesOverlay.classList.remove("hidden"); }; profileSwitchBtn.addEventListener("click", openProfAction); profileSwitchBtn.addEventListener("touchstart", openProfAction, { passive: false }); }
if (profilesBackBtn) { const closeProfAction = (e) => { if(e) e.preventDefault(); initAudio(); if(profilesOverlay) profilesOverlay.classList.add("hidden"); if(menuOverlay) menuOverlay.classList.remove("hidden"); }; profilesBackBtn.addEventListener("click", closeProfAction); profilesBackBtn.addEventListener("touchstart", closeProfAction, { passive: false }); }
if (newProfileBtn) { const addProfAction = (e) => { if(e) e.preventDefault(); initAudio(); createProfile(newProfileName ? newProfileName.value : ""); if(newProfileName) newProfileName.value = ""; }; newProfileBtn.addEventListener("click", addProfAction); newProfileBtn.addEventListener("touchstart", addProfAction, { passive: false }); }
if (resetProgressBtn) {
    const resetAction = (e) => {
        if(e) e.preventDefault(); initAudio();
        if (!confirm("Reset ALL progress for this pilot (scrap, upgrades, achievements, custom ship, stats)? This cannot be undone.")) return;
        resetActiveProfileProgress();
    };
    resetProgressBtn.addEventListener("click", resetAction); resetProgressBtn.addEventListener("touchstart", resetAction, { passive: false });
}
if (shipBuilderBtn) { const openAction = (e) => { if(e) e.preventDefault(); initAudio(); openBuilder(); }; shipBuilderBtn.addEventListener("click", openAction); shipBuilderBtn.addEventListener("touchstart", openAction, { passive: false }); }
if (achievementsBtn) { const openAchAction = (e) => { if(e) e.preventDefault(); initAudio(); renderAchievementsList(); if(menuOverlay) menuOverlay.classList.add("hidden"); if(achievementsOverlay) achievementsOverlay.classList.remove("hidden"); }; achievementsBtn.addEventListener("click", openAchAction); achievementsBtn.addEventListener("touchstart", openAchAction, { passive: false }); }
if (achievementsBackBtn) { const closeAchAction = (e) => { if(e) e.preventDefault(); initAudio(); if(achievementsOverlay) achievementsOverlay.classList.add("hidden"); if(menuOverlay) menuOverlay.classList.remove("hidden"); }; achievementsBackBtn.addEventListener("click", closeAchAction); achievementsBackBtn.addEventListener("touchstart", closeAchAction, { passive: false }); }
if (pilotRecordBtn) { const openRecAction = (e) => { if(e) e.preventDefault(); initAudio(); renderPilotRecord(); if(menuOverlay) menuOverlay.classList.add("hidden"); if(pilotRecordOverlay) pilotRecordOverlay.classList.remove("hidden"); }; pilotRecordBtn.addEventListener("click", openRecAction); pilotRecordBtn.addEventListener("touchstart", openRecAction, { passive: false }); }
if (pilotRecordBackBtn) { const closeRecAction = (e) => { if(e) e.preventDefault(); initAudio(); if(pilotRecordOverlay) pilotRecordOverlay.classList.add("hidden"); if(menuOverlay) menuOverlay.classList.remove("hidden"); }; pilotRecordBackBtn.addEventListener("click", closeRecAction); pilotRecordBackBtn.addEventListener("touchstart", closeRecAction, { passive: false }); }
if (builderBackBtn) { const backAction = (e) => { if(e) e.preventDefault(); initAudio(); closeBuilder(); }; builderBackBtn.addEventListener("click", backAction); builderBackBtn.addEventListener("touchstart", backAction, { passive: false }); }
if (builderSaveBtn) {
    const saveAction = (e) => {
        if(e) e.preventDefault(); initAudio();
        let cfg = getBuilderConfig();
        try { localStorage.setItem(pKey("sfc_customShip"), JSON.stringify(cfg)); } catch(err) {}
        registerCustomShip(cfg);
        unlockAchievement('shipwright');
        setMenuShip("custom");
        closeBuilder();
    };
    builderSaveBtn.addEventListener("click", saveAction); builderSaveBtn.addEventListener("touchstart", saveAction, { passive: false });
}
if (builderDeleteBtn) {
    const deleteAction = (e) => {
        if(e) e.preventDefault(); initAudio();
        customShipConfig = null;
        try { localStorage.removeItem(pKey("sfc_customShip")); } catch(err) {}
        delete ShipDesigns.custom;
        let idx = ShipMenuOrder.findIndex(s => s.id === "custom");
        if (idx !== -1) ShipMenuOrder.splice(idx, 1);
        rebuildShipDropdown();
        if (selectedShipType === "custom") setMenuShip("xwing");
        closeBuilder();
    };
    builderDeleteBtn.addEventListener("click", deleteAction); builderDeleteBtn.addEventListener("touchstart", deleteAction, { passive: false });
}

// Boot Game Settings
loadProfileList();
loadSaveData();

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
    boss_dreadnought: {
        draw: (ctx, r, t) => {
            if (t.hitFlash > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); return; }
            popHalo(ctx, r, "#ff9900", 0.4);
            let hullGrad = ctx.createLinearGradient(-r, 0, r, 0);
            hullGrad.addColorStop(0, "#2c2f36"); hullGrad.addColorStop(0.5, "#565c68"); hullGrad.addColorStop(1, "#8a919e");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(r*1.3, 0); ctx.lineTo(r*0.3, -r*0.45); ctx.lineTo(-r*0.6, -r*0.4); ctx.lineTo(-r*1.1, -r*0.15);
            ctx.lineTo(-r*1.1, r*0.15); ctx.lineTo(-r*0.6, r*0.4); ctx.lineTo(r*0.3, r*0.45); ctx.closePath();
            ctx.fill(); ctx.stroke();
            applyGlow(ctx, "#ffaa33", 8); ctx.fillStyle = "#ffcc66";
            for (let i=-0.9; i<0.2; i+=0.28) ctx.fillRect(r*i, -2, 6, 4);
            clearGlow(ctx);
            applyGlow(ctx, "#ff6600", 20); ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.ellipse(-r*1.1, 0, r*0.12, r*0.18, 0, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
            if (t.hp !== undefined) { ctx.save(); ctx.rotate(-t.angle); let hp = Math.max(0, t.hp/t.maxHp); ctx.fillStyle = "red"; ctx.fillRect(-r, -r-20, r*2*hp, 6); ctx.restore(); }
        }
    },
    boss_carrier: {
        draw: (ctx, r, t) => {
            if (t.hitFlash > 0) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); return; }
            popHalo(ctx, r, "#ffcc00", 0.4);
            let hullGrad = ctx.createLinearGradient(0, -r*0.35, 0, r*0.35);
            hullGrad.addColorStop(0, "#4a4e58"); hullGrad.addColorStop(0.5, "#23262c"); hullGrad.addColorStop(1, "#4a4e58");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(r*1.4, 0); ctx.lineTo(r*0.9, -r*0.35); ctx.lineTo(-r*1.1, -r*0.35); ctx.lineTo(-r*1.4, 0);
            ctx.lineTo(-r*1.1, r*0.35); ctx.lineTo(r*0.9, r*0.35); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ffcc00"; ctx.globalAlpha = 0.6; ctx.fillRect(-r*1.0, -r*0.04, r*2.2, r*0.08); ctx.globalAlpha = 1.0;
            let doorOpen = (t.launchTimer !== undefined && t.launchTimer < 0.6);
            applyGlow(ctx, doorOpen ? "#ffee88" : "#664400", doorOpen ? 20 : 6);
            ctx.fillStyle = doorOpen ? "#ffee88" : "#443300"; ctx.fillRect(-r*1.3, -r*0.18, r*0.3, r*0.36);
            clearGlow(ctx);
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
    hive_minion: {
        draw: (ctx, r, t) => {
            let isQueen = t && t.isQueen;
            popHalo(ctx, r, isQueen ? "#ff33ff" : "#cc33ff", isQueen ? 0.6 : 0.4);
            let hullGrad = ctx.createLinearGradient(-r, 0, r, 0);
            hullGrad.addColorStop(0, isQueen ? "#4a0a55" : "#2a0a30"); hullGrad.addColorStop(1, isQueen ? "#cc33ff" : "#7a2a8a");
            ctx.fillStyle = hullGrad; ctx.strokeStyle = "#1a0020"; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(r*1.1, 0); ctx.lineTo(-r*0.4, -r*0.8); ctx.lineTo(-r*0.7, 0); ctx.lineTo(-r*0.4, r*0.8); ctx.closePath();
            ctx.fill(); ctx.stroke();
            applyGlow(ctx, isQueen ? "#ff66ff" : "#cc33ff", isQueen ? 12 : 6);
            ctx.fillStyle = isQueen ? "#ffccff" : "#ee99ff"; ctx.beginPath(); ctx.arc(0, 0, isQueen ? r*0.28 : r*0.18, 0, Math.PI*2); ctx.fill();
            clearGlow(ctx);
            if (isQueen) { ctx.strokeStyle = "rgba(255, 102, 255, 0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r*1.3, 0, Math.PI*2); ctx.stroke(); }
        }
    },
    tie_advanced: {
        draw: (ctx, r) => {
            popHalo(ctx, r, "#ff0000", 0.5);
            let ballGrad = ctx.createRadialGradient(-r/8, -r/8, r/10, 0, 0, r/2); ballGrad.addColorStop(0, "#aaa"); ballGrad.addColorStop(0.6, "#666"); ballGrad.addColorStop(1, "#1a1a1a");
            let wingGrad = ctx.createLinearGradient(0, -r*1.2, 0, -r*0.5); wingGrad.addColorStop(0, "#333"); wingGrad.addColorStop(0.5, "#111"); wingGrad.addColorStop(1, "#050505");
            ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r/2); ctx.lineTo(0, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, r/2); ctx.lineTo(0, r*1.2); ctx.stroke();
            ctx.lineWidth = 6; ctx.strokeStyle = wingGrad; ctx.beginPath(); ctx.moveTo(-r*0.5, -r*1.2); ctx.lineTo(r*0.8, -r*1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.5, r*1.2); ctx.lineTo(r*0.8, r*1.2); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r*0.5, -r*1.2-3); ctx.lineTo(r*0.8, -r*1.2-3); ctx.stroke();
            ctx.fillStyle = ballGrad; ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r/2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#f00"; ctx.beginPath(); ctx.arc(0, 0, r/4, 0, Math.PI*2); ctx.fill();
        }
    },
    star_destroyer: {
        draw: (ctx, r) => {
            popHalo(ctx, r, "#33aaff", 0.5);
            let sdGrad = ctx.createLinearGradient(r, -r/1.5, -r, r/1.5); sdGrad.addColorStop(0, "#f5f7f8"); sdGrad.addColorStop(0.5, "#cfd8dc"); sdGrad.addColorStop(1, "#37474f");
            ctx.fillStyle = sdGrad; ctx.strokeStyle = "#263238"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, -r/1.5); ctx.lineTo(-r, r/1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
            // AO seam where the dorsal and ventral hull halves meet
            ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, 0); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r*0.9, -r*0.08); ctx.lineTo(-r*0.9, -r*0.4); ctx.stroke();
            ctx.fillStyle = "#78909c"; ctx.fillRect(-r*0.8, -r/4, r*0.4, r/2); ctx.strokeRect(-r*0.8, -r/4, r*0.4, r/2);
            applyGlow(ctx, "#00aaff", 15); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r, -r/3, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-r, 0, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-r, r/3, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
        }
    },
    tie_interceptor: {
        draw: (ctx, r) => {
            popHalo(ctx, r, "#ff0000", 0.5);
            let wingGrad = ctx.createLinearGradient(-r/2, -r*1.2, r*0.8, -r*0.6); wingGrad.addColorStop(0, "#2a2a2a"); wingGrad.addColorStop(1, "#050505");
            let wingGrad2 = ctx.createLinearGradient(-r/2, r*1.2, r*0.8, r*0.6); wingGrad2.addColorStop(0, "#2a2a2a"); wingGrad2.addColorStop(1, "#050505");
            let ballGrad = ctx.createRadialGradient(-r/8, -r/8, r/10, 0, 0, r/3); ballGrad.addColorStop(0, "#777"); ballGrad.addColorStop(1, "#1a1a1a");
            ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r/3); ctx.lineTo(0, -r*0.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, r/3); ctx.lineTo(0, r*0.9); ctx.stroke();
            ctx.fillStyle = wingGrad; ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-r/2, -r*1.2); ctx.lineTo(r*0.8, -r*0.9); ctx.lineTo(-r/4, -r*0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = wingGrad2; ctx.beginPath(); ctx.moveTo(-r/2, r*1.2); ctx.lineTo(r*0.8, r*0.9); ctx.lineTo(-r/4, r*0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = ballGrad; ctx.beginPath(); ctx.arc(0, 0, r/3, 0, Math.PI*2); ctx.fill();
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
            // glossy diagonal glint across each panel, like light catching photovoltaic glass
            ctx.save(); ctx.beginPath(); ctx.rect(-r*1.8, -r*0.3, r*1.2, r*0.6); ctx.rect(r*0.6, -r*0.3, r*1.2, r*0.6); ctx.clip();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = r*0.12;
            ctx.beginPath(); ctx.moveTo(-r*2.2, -r*0.5); ctx.lineTo(-r*1.4, r*0.5); ctx.moveTo(r*0.2, -r*0.5); ctx.lineTo(r*1.0, r*0.5); ctx.stroke();
            ctx.restore();
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

            // A small mineral glint on the sunlit shoulder sells a rocky, faceted surface
            // rather than a flat painted circle.
            applyGlow(ctx, "rgba(255, 255, 255, 0.6)", 4);
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.38, Math.max(1, r * 0.07), 0, Math.PI * 2); ctx.fill();
            clearGlow(ctx);
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
    if (x === null) { let safeCounter = 0; do { x = Math.random() * (canvas.width || 1000); y = Math.random() * (canvas.height || 750); safeCounter++; } while (Math.hypot((ship.x || 500) - x, (ship.y || 375) - y) < 200 && safeCounter < 50); }
    if (type === "asteroid" && Math.random() < 0.1) { type = "satellite"; baseR = 25; }

    let spdMult = type === "asteroid" ? 0.3 : (type === "satellite" ? 0.2 : 1.0);
    let t = { type: type, x: x, y: y, r: baseR, xv: (Math.random() - 0.5) * spdMult * speedMod, yv: (Math.random() - 0.5) * spdMult * speedMod, angle: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 1.5, stunned: 0 };
    if (type.startsWith("boss")) t.rotSpeed = 0.2;
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

const PowerupColors = { M: "#ff00ff", S: "#00ffff", H: "#33ff33", B: "#ffcc00", R: "#ff8800", T: "#66ccff", C: "#ff33ff" };
function spawnPowerup() {
    let rand = Math.random(); let type = 'M';
    if (rand > 0.30) type = 'S';
    if (rand > 0.55) type = 'H';
    if (rand > 0.70) type = 'B';
    if (rand > 0.80) type = 'R';
    if (rand > 0.92) type = 'T';
    if (rand > 0.97) type = 'C';
    powerups.push({ x: Math.random() * canvas.width, y: -20, xv: (Math.random() - 0.5) * 2, yv: 1 + Math.random(), r: 15, angle: 0, type: type });
    powerupSpawnedThisLevel = true;
}

function updateUI() {
    if(scoreEl) scoreEl.innerText = Math.round(score); if(levelEl) levelEl.innerText = level; 
    if(hpEl) hpEl.innerText = Math.ceil(playerHp); if(shEl) shEl.innerText = Math.ceil(playerShield);
    if(bombEl) bombEl.innerText = bombs; if(comboEl) comboEl.innerText = combo + "x"; if(scrapEl) scrapEl.innerText = currentRunScrap;
    
    if(heatEl) {
        heatEl.innerText = Math.ceil(heat) + "%";
        if(overheated) heatEl.style.color = "#ff0000"; else if (heat > 75) heatEl.style.color = "#ff5500"; else heatEl.style.color = "#ffff00";
    }
    let pTxt = [];
    if (multishotTimer > 0) pTxt.push(`MULTI ${Math.ceil(multishotTimer)}s`);
    if (rapidFireTimer > 0) pTxt.push(`RAPID ${Math.ceil(rapidFireTimer)}s`);
    if (slowmoTimer > 0) pTxt.push(`SLOW ${Math.ceil(slowmoTimer)}s`);
    if (chaosTimer > 0) pTxt.push(`PARTY ${Math.ceil(chaosTimer)}s`);
    if (statusEl) { statusEl.innerText = pTxt.length ? pTxt.join(" ") : "—"; statusEl.style.color = pTxt.length ? "#ff00ff" : "#555"; }

    if (swarmBarEl) {
        if (hiveSwarmActive) {
            let remaining = targets.filter(t => t.type === "hive_minion").length;
            swarmBarEl.classList.remove("hidden");
            if (swarmCountEl) swarmCountEl.innerText = remaining;
            if (swarmTotalEl) swarmTotalEl.innerText = hiveSwarmTotal;
        } else {
            swarmBarEl.classList.add("hidden");
        }
    }
    if (combo > runBestCombo) runBestCombo = combo;
    checkAchievements();
}

function damagePlayer(amt) {
    if (invulnTimer > 0 || gameState !== "PLAYING") return;
    tookDamageThisHyperspace = true;
    playSfx('hit'); shake += 5; vibrate(40); spawnParticles(ship.x || canvas.width/2, ship.y || canvas.height/2, "#ffaa00", 10);
    spawnText(ship.x || canvas.width/2, ship.y || canvas.height/2, `-${amt}`, "#ff3333", 20);
    combo = 1; comboTimer = 0;
    
    if (playerShield > 0) { 
        playerShield -= amt; 
        if (playerShield < 0) { playerHp += playerShield; playerShield = 0; playSfx('boom'); spawnText(ship.x || canvas.width/2, (ship.y || canvas.height/2)-20, "SHIELD BROKEN", "#00ffff", 14); } 
    } else { playerHp -= amt; }
    
    if (playerHp <= 0) {
        playSfx('boom'); shake = 20; spawnParticles(ship.x || canvas.width/2, ship.y || canvas.height/2, "#ff3300", 50); multishotTimer = 0;
        if (lives > 1) { lives--; ship.x = canvas.width/2; ship.y = canvas.height/2; ship.xv = 0; ship.yv = 0; invulnTimer = 3.0; playerHp = playerMaxHp; playerShield = playerMaxShield; updateUI(); } 
        else { lives = 0; playerHp = 0; playerShield = 0; updateUI(); vibrate([100, 50, 100]); totalScrap += currentRunScrap; lifetimeStats.scrapEarned += currentRunScrap; checkAndSaveScore(); saveGameData(); gameOverMessage = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]; gameState = "GAMEOVER"; }
    }
    updateUI();
}

function startGame(shipId) {
    let nameVal = "AAA"; if (playerNameInput && playerNameInput.value) { nameVal = playerNameInput.value.trim().toUpperCase(); } if(nameVal.length < 1) nameVal = "AAA";
    currentPlayerName = nameVal; selectedShipType = (ShipDesigns[shipId]) ? shipId : "xwing";
    try { localStorage.setItem(pKey("sfc_lastShip"), selectedShipType); } catch(e) {}
    requestWakeLock();

    if (menuOverlay) menuOverlay.classList.add("hidden");
    if (pauseOverlay) pauseOverlay.classList.add("hidden");

    score = 0; level = 1; currentRunScrap = 0; lives = 3;
    diffScoreMult = gameDifficulty === "easy" ? 0.75 : gameDifficulty === "hard" ? 1.35 : gameDifficulty === "insane" ? 1.75 : 1.0;
    lifetimeStats.gamesPlayed = (lifetimeStats.gamesPlayed || 0) + 1; saveGameData();
    bombs = 1 + (upgrades.bombs || 0); playerMaxShield = 100 + ((upgrades.shield || 0) * 20); playerHp = playerMaxHp; playerShield = playerMaxShield;
    combo = 1; comboTimer = 0; heat = 0; overheated = false; multishotTimer = 0; rapidFireTimer = 0; slowmoTimer = 0; chaosTimer = 0; fireCooldown = 0; invulnTimer = 3.0; hyperspace = 0; nukeFlash = 0;
    runKills = 0; runBestCombo = 1;
    ship.x = canvas.width / 2; ship.y = canvas.height / 2; ship.xv = 0; ship.yv = 0;
    
    bullets = []; enemyBullets = []; powerups = []; targets = []; particles = []; lightTrails = []; floatingTexts = []; scrapDrops = [];
    targets3D = []; bullets3D = []; enemyBullets3D = [];
    
    updateUI(); startLevel(); gameState = "PLAYING"; 
}

function startLevel() {
    targets = []; powerups = []; enemyBullets = []; lightTrails = []; floatingTexts = []; scrapDrops = []; powerupSpawnedThisLevel = false;
    ship.x = canvas.width / 2; ship.y = canvas.height / 2; ship.xv = 0; ship.yv = 0; invulnTimer = 2.0;

    if (level > lifetimeStats.highestLevel) lifetimeStats.highestLevel = level;
    if (level === 10) unlockAchievement('level_10');
    if (level === 26) { spawnText(canvas.width/2, canvas.height/2 - 20, "CAMPAIGN COMPLETE!", "#33ff33", 26); spawnText(canvas.width/2, canvas.height/2 + 20, "SURVIVING FOR SCORE...", "#ffcc00", 16); unlockAchievement('level_26'); }

    if (level === 20 && !shipBuilderUnlocked) {
        shipBuilderUnlocked = true;
        try { localStorage.setItem(pKey("sfc_shipBuilderUnlocked"), "1"); } catch(e) {}
        updateBuilderUnlockUI();
        spawnText(canvas.width/2, canvas.height/2 - 20, "SHIP BUILDER UNLOCKED!", "#00ffc8", 24);
        unlockAchievement('level_20');
    }

    is3DMode = (level % 7 === 0);
    hiveSwarmActive = false;

    if (is3DMode) {
        levelTimer3D = 30; targets3D = []; bullets3D = []; enemyBullets3D = []; camX = 0; camY = 0; tookDamageThisHyperspace = false;
        spawnText(canvas.width/2, canvas.height/2, "HYPERSPACE ANOMALY!", "#ff00ff", 40); spawnText(canvas.width/2, canvas.height/2 + 40, "EVADE & SURVIVE 30s", "#00ffff", 20);
        updateUI();
        return;
    }

    let diffMult = 1.0; let speedMult = 1.0;
    if (gameDifficulty === "easy") { diffMult = 0.6; speedMult = 0.7; }
    else if (gameDifficulty === "hard") { diffMult = 1.5; speedMult = 1.3; }
    else if (gameDifficulty === "insane") { diffMult = 2.0; speedMult = 1.6; }
    let speedMod = speedMult + (level * 0.1 * speedMult);

    if (level % 5 === 0 && !is3DMode) {
        if (level % 15 === 0) {
            let numSentinels = Math.floor(40 * diffMult); for(let i=0; i<numSentinels; i++) spawnTarget("sentinel", 12, speedMod * 1.5);
        } else if (level % 25 === 0) {
            let numMinions = Math.floor((12 + level * 0.3) * diffMult);
            let queenIndex = Math.floor(Math.random() * numMinions);
            for (let i = 0; i < numMinions; i++) {
                let ang = (i / numMinions) * Math.PI * 2;
                let dist = 250 + Math.random() * 60;
                let sx = canvas.width/2 + Math.cos(ang) * dist;
                let sy = canvas.height/2 + Math.sin(ang) * dist;
                spawnTarget("hive_minion", i === queenIndex ? 20 : 13, speedMod * 1.1, sx, sy);
                let m = targets[targets.length - 1];
                if (i === queenIndex) { m.isQueen = true; m.hp = Math.floor((10 + level * 0.5) * diffMult); m.maxHp = m.hp; }
                else { m.hp = 1; m.maxHp = 1; }
            }
            hiveSwarmActive = true; hiveSwarmTotal = numMinions; hiveFireTimer = 2.5; hiveEnraged = false;
            spawnText(canvas.width/2, canvas.height/2 - 20, "THE SWARM IS THE BOSS", "#ff33ff", 26);
        } else if (level % 20 === 0) {
            let bossR = 90 + (level * 1.0); spawnTarget("boss_dreadnought", bossR, speedMod * 0.15);
            let boss = targets[targets.length - 1];
            boss.maxHp = Math.floor((40 + (level * 6)) * diffMult); boss.hp = boss.maxHp; boss.hitFlash = 0; boss.spawnTimer = 2.5 / diffMult; boss.broadsideTimer = 3.0;
        } else if (level % 10 === 0) {
            let bossR = 80 + (level * 1.2); spawnTarget("boss_mothership", bossR, speedMod * 0.2);
            let boss = targets[targets.length - 1];
            boss.maxHp = Math.floor((30 + (level * 5)) * diffMult); boss.hp = boss.maxHp; boss.hitFlash = 0;
            boss.nodes = [{ang: 0, hp: 4}, {ang: Math.PI/2, hp: 4}, {ang: Math.PI, hp: 4}, {ang: Math.PI*1.5, hp: 4}];
        } else if (level % 55 === 0) {
            let bossR = 85 + (level * 1.1); spawnTarget("boss_carrier", bossR, speedMod * 0.15);
            let boss = targets[targets.length - 1];
            boss.maxHp = Math.floor((50 + (level * 6)) * diffMult); boss.hp = boss.maxHp; boss.hitFlash = 0; boss.launchTimer = 3.0;
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
    updateUI();
}

for(let i=0; i<8; i++) spawnTarget("asteroid", 40, 2.0);

let lastTime = performance.now();
function loop(timestamp) {
    try {
        let dt = (timestamp - lastTime) / 1000; if (dt > 0.1 || isNaN(dt)) dt = 0.016; lastTime = timestamp; frames++;
        updateAchievementToasts(dt);

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

    // Primary control: the ship eases toward wherever the reticle points, same "aim = fly there"
    // feel as the 2D mode's mouse-thrust, and it works on mobile through the same joystick input
    // that already drives mouse.x/y (WASD panning alone left touch players unable to dodge at all).
    let strafeRange = 900 + stats.thrust * 40;
    let targetX = ((mouse.x - canvas.width / 2) / (canvas.width / 2)) * strafeRange;
    let targetY = ((mouse.y - canvas.height / 2) / (canvas.height / 2)) * strafeRange;
    let followRate = Math.min(1, dt * 5);
    camX += (targetX - camX) * followRate;
    camY += (targetY - camY) * followRate;

    // Secondary: optional keyboard nudge for desktop players who like fine WASD control on top.
    if (keys["ArrowUp"] || keys["KeyW"]) camY -= speed * dt;
    if (keys["ArrowDown"] || keys["KeyS"]) camY += speed * dt;
    if (keys["ArrowLeft"] || keys["KeyA"]) camX -= speed * dt;
    if (keys["ArrowRight"] || keys["KeyD"]) camX += speed * dt;

    let strafeLimit = strafeRange * 1.3;
    camX = Math.max(-strafeLimit, Math.min(strafeLimit, camX)); camY = Math.max(-strafeLimit, Math.min(strafeLimit, camY));

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
    if (chaosTimer > 0) { chaosTimer -= dt; if (chaosTimer < 0) chaosTimer = 0; }

    levelTimer3D -= dt;
    if (levelTimer3D > 0) { let spawnRate = 0.026 + (level * 0.0012); if (Math.random() < spawnRate) spawnTarget3D(); } 
    else if (targets3D.length === 0 && enemyBullets3D.length === 0) {
        lifetimeStats.hyperspaceCleared++;
        if (!tookDamageThisHyperspace) unlockAchievement('untouchable');
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
                let dmg = (b.isEmpBolt ? 2 : (selectedShipType==='enterprise' ? 2 : 1)) + (upgrades.power || 0);
                t.hp -= dmg; t.hitFlash = 0.1; playSfx('hit'); spawnText(canvas.width/2, canvas.height/2, `-${dmg}`, "#fff"); bullets3D.splice(j, 1);
                if (t.hp <= 0) {
                    playSfx('boom'); shake += 5; combo++; if(combo>10) combo=10; comboTimer = 4.0; lifetimeStats.kills++; runKills++;
                    score += diffScoreMult *(t.type==="satellite" ? 75 : 50) * combo; currentRunScrap += (t.type==="satellite" ? 5 : 2); updateUI(); hit = true; break;
                }
            }
        }
        if (hit) targets3D.splice(i, 1);
    }
    stars3D.forEach(s => { s.z -= 1500 * dt; if (s.z < 10) { s.z = 3000; s.x = camX + (Math.random()-0.5)*4000; s.y = camY + (Math.random()-0.5)*4000; } });
}

function update(dt) {
    let slowFactor = slowmoTimer > 0 ? 0.4 : 1.0;
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
        fireCooldown = stats.fireRate * (rapidFireTimer > 0 ? 0.5 : 1); heat += stats.heat;
        if (heat >= 100) { heat = 100; overheated = true; playSfx('glitch'); spawnText(ship.x, ship.y-20, "OVERHEAT", "#ff0000", 18); }
        updateUI();
    }

    if (multishotTimer > 0) { multishotTimer -= dt; if (multishotTimer < 0) multishotTimer = 0; if (frames % 30 === 0) updateUI(); }
    if (rapidFireTimer > 0) { rapidFireTimer -= dt; if (rapidFireTimer < 0) rapidFireTimer = 0; if (frames % 30 === 0) updateUI(); }
    if (slowmoTimer > 0) { slowmoTimer -= dt; if (slowmoTimer < 0) slowmoTimer = 0; if (frames % 30 === 0) updateUI(); }
    if (chaosTimer > 0) { chaosTimer -= dt; if (chaosTimer < 0) chaosTimer = 0; if (frames % 30 === 0) updateUI(); }
    if (level > 2 && !powerupSpawnedThisLevel && targets.length < 5 && Math.random() < 0.005) spawnPowerup();

    // Cosmetic engine trail, unlocked via achievements and equipped from the main menu -- purely
    // decorative, spawned as ordinary particles so it rides the existing fade/cleanup logic.
    if (ship.thrusting && equippedTrail !== "classic" && frames % 3 === 0) {
        let tc = TRAIL_COLORS.find(t => t.id === equippedTrail);
        if (tc) {
            let col = tc.id === "rainbow" ? `hsl(${(frames*6)%360},100%,60%)` : tc.color;
            particles.push({ x: ship.x - Math.cos(ship.angle)*ship.r*0.6, y: ship.y - Math.sin(ship.angle)*ship.r*0.6, xv: -ship.xv*0.3, yv: -ship.yv*0.3, life: 1.0, color: col, size: 4 });
        }
    }

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
        enemyBullets[i].x += enemyBullets[i].xv * slowFactor; enemyBullets[i].y += enemyBullets[i].yv * slowFactor; wrap(enemyBullets[i]); enemyBullets[i].range -= Math.hypot(enemyBullets[i].xv, enemyBullets[i].yv) * slowFactor;
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
            else if (p.type === 'R') { rapidFireTimer = 8.0; spawnText(ship.x, ship.y, "RAPID FIRE", "#ff8800"); }
            else if (p.type === 'T') { slowmoTimer = 6.0; spawnText(ship.x, ship.y, "TIME SLOW", "#66ccff"); }
            else if (p.type === 'C') { chaosTimer = 7.0; rapidFireTimer = Math.max(rapidFireTimer, 7.0); playSfx('chaos'); shake += 6; spawnText(ship.x, ship.y, "PARTY MODE!", "#ff33ff", 22); }
            score += diffScoreMult *150 * combo; updateUI(); powerups.splice(i, 1);
        }
    }

    targets.forEach(t => {
        if (t.stunned > 0) { t.stunned -= dt; return; }
        t.x += t.xv * slowFactor; t.y += t.yv * slowFactor; t.angle += t.rotSpeed * dt;
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
        if (t.type === "boss_dreadnought") {
            if (t.broadsideTimer === undefined) t.broadsideTimer = 3.0; t.broadsideTimer -= dt;
            if (t.broadsideTimer <= 0) {
                playSfx('boom'); shake += 8; t.broadsideTimer = 3.0;
                let angToPlayer = Math.atan2(ship.y - t.y, ship.x - t.x);
                [-0.6, -0.3, 0, 0.3, 0.6].forEach(off => enemyBullets.push({ x: t.x, y: t.y, xv: 7*Math.cos(angToPlayer+off), yv: 7*Math.sin(angToPlayer+off), range: canvas.width }));
            }
        }
        if (t.type === "boss_carrier") {
            // Unarmed itself -- it overwhelms by launching wings of fast interceptors instead
            if (t.launchTimer === undefined) t.launchTimer = 3.0; t.launchTimer -= dt;
            if (t.launchTimer <= 0 && targets.length < 18) {
                playSfx('enemyShoot'); shake += 4;
                for (let k = 0; k < 3; k++) spawnTarget("tie_interceptor", 15, 1.8 + (level * 0.1), t.x - t.r*1.3, t.y + (k-1)*20);
                t.launchTimer = 6.0;
            }
        }
        if (t.type === "hive_minion") {
            // Orbit the player rather than rush straight in, so the swarm reads as a coordinated
            // ring rather than a mob piling into melee range.
            let dx = ship.x - t.x, dy = ship.y - t.y;
            let distToPlayer = Math.hypot(dx, dy) || 1;
            let angToPlayer = Math.atan2(dy, dx);
            let preferredDist = t.isQueen ? 220 : 160;
            let approachAng = distToPlayer > preferredDist ? angToPlayer : angToPlayer + Math.PI;
            let tangentAng = angToPlayer + Math.PI / 2;
            let vx = Math.cos(approachAng) * 0.45 + Math.cos(tangentAng) * 0.55;
            let vy = Math.sin(approachAng) * 0.45 + Math.sin(tangentAng) * 0.55;
            let norm = Math.hypot(vx, vy) || 1;
            let spd = (t.isQueen ? 1.7 : 2.1) * (hiveEnraged ? 1.6 : 1.0);
            t.xv = (vx / norm) * spd; t.yv = (vy / norm) * spd; t.angle = angToPlayer;
        }
        wrap(t);
    });

    if (hiveSwarmActive) {
        hiveFireTimer -= dt;
        if (hiveFireTimer <= 0) {
            let minions = targets.filter(m => m.type === "hive_minion");
            if (minions.length > 0) {
                playSfx('enemyShoot'); shake += 4;
                minions.forEach(m => { let ang = Math.atan2(ship.y - m.y, ship.x - m.x); enemyBullets.push({ x: m.x, y: m.y, xv: 6 * Math.cos(ang), yv: 6 * Math.sin(ang), range: canvas.width * 0.8 }); });
            }
            hiveFireTimer = hiveEnraged ? 1.6 : 2.6;
        }
        if (!hiveEnraged && targets.some(m => m.type === "hive_minion") && !targets.some(m => m.type === "hive_minion" && m.isQueen)) {
            hiveEnraged = true; shake += 15; spawnText(ship.x, ship.y - 40, "HIVE ENRAGED!", "#ff0000", 20); playSfx('glitch');
        }
    }

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
                        score += diffScoreMult *15 * combo; spawnScrap(t1.x, t1.y, 1); updateUI();
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
            let dmg = (bullets[i].isEmpBolt ? 2 : (selectedShipType === 'enterprise' ? 2 : 1)) + (upgrades.power || 0);

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
                    t.hp -= dmg; t.hitFlash = 0.1; score += diffScoreMult *25 * combo; spawnText(t.x, t.y, `-${dmg}`, "#fff"); updateUI(); hit = true; spawnParticles(bullets[i].x, bullets[i].y, "#fff", 5); break; 
                }
                
                playSfx('boom'); shake = t.r > 30 ? 10 : 3;
                spawnParticles(t.x, t.y, (t.type==="asteroid"||t.type==="satellite") ? "#aaa" : "#ff5500", t.r > 30 ? 30 : 15);
                spawnText(t.x, t.y, "DESTROYED", "#ff0000");
                combo++; if(combo>10) combo=10; comboTimer = 4.0; lifetimeStats.kills++; runKills++;

                let diffMod = 1 + (level * 0.1);
                if (t.type.startsWith("boss")) { score += diffScoreMult *1500*combo; shake = 25; spawnScrap(t.x, t.y, 10); lifetimeStats.bossKills++; for(let k=0; k<6; k++) spawnTarget("asteroid", 30, diffMod * 1.5, t.x, t.y); }
                else if (t.type === "star_destroyer") { score += diffScoreMult *100*combo; spawnScrap(t.x, t.y, 3); spawnTarget("tie_interceptor", 25, diffMod * 1.2, t.x, t.y); spawnTarget("tie_interceptor", 25, diffMod * 1.2, t.x, t.y); }
                else if (t.type === "tie_interceptor" || t.type === "tie_advanced") { score += diffScoreMult *50*combo; spawnScrap(t.x, t.y, 2); spawnTarget("tie_fighter", 15, diffMod * 1.5, t.x, t.y); spawnTarget("tie_fighter", 15, diffMod * 1.5, t.x, t.y); }
                else if (t.type === "tie_fighter" || t.type === "sentinel") { score += diffScoreMult *25*combo; spawnScrap(t.x, t.y, 1); }
                else if (t.type === "satellite") { score += diffScoreMult *75*combo; spawnScrap(t.x, t.y, 5); }
                else if (t.type === "hive_minion") {
                    if (t.isQueen) { score += diffScoreMult *300*combo; spawnScrap(t.x, t.y, 4); shake = 15; unlockAchievement('hive_breaker'); }
                    else { score += diffScoreMult *20*combo; spawnScrap(t.x, t.y, 1); }
                    if (targets.length === 1) { score += diffScoreMult *1200*combo; shake = 25; spawnText(t.x, t.y - 20, "SWARM DEFEATED!", "#ff33ff", 20); }
                }
                else if (t.type === "asteroid") { score += diffScoreMult *((t.r > 20) ? 20 : 50)*combo; if(Math.random()>0.5) spawnScrap(t.x, t.y, 1); if (t.r > 20) { spawnTarget("asteroid", t.r / 2, diffMod * 1.3, t.x, t.y); spawnTarget("asteroid", t.r / 2, diffMod * 1.3, t.x, t.y); } }
                
                targets.splice(j, 1); hit = true; break;
            }
        }
        if (hit && !bullets[i].isEmp) { bullets.splice(i, 1); updateUI(); }
    }

    if (invulnTimer <= 0) {
        for (let j = targets.length - 1; j >= 0; j--) {
            let t = targets[j];
            if (Math.hypot(ship.x - t.x, ship.y - t.y) < ship.r + t.r * 0.8) { 
                let isBoss = t.type.startsWith("boss");
                damagePlayer(isBoss ? 100 : 40); 
                if (!isBoss) { spawnParticles(t.x, t.y, "#ff5500", 15); targets.splice(j, 1); }
                break;
            } 
        }
    }

    if (targets.length === 0 && gameState === "PLAYING") {
        level++; updateUI(); gameState = "LEVEL_TRANSITION"; bullets = []; enemyBullets = []; lightTrails = []; floatingTexts = []; hyperspace = 0; playSfx('powerup');
    }
}

function render3D() {
    ctx.fillStyle = `hsl(${level * 15}, 35%, 4%)`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.9; if(shake < 0.5) shake = 0; }

    let CX = canvas.width/2, CY = canvas.height/2;

    // Soft nebula backdrop, drifting slowly opposite the camera for a hint of parallax depth
    let nebulaHue = (level * 15) % 360;
    [[0.28, 0.32, nebulaHue + 20, 0.55], [0.68, 0.45, nebulaHue - 40, 0.5], [0.5, 0.7, nebulaHue + 190, 0.45]].forEach(([fx, fy, hue, size]) => {
        let nx = canvas.width * fx - camX * 0.02; let ny = canvas.height * fy - camY * 0.02;
        let ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, canvas.width * size);
        ng.addColorStop(0, `hsla(${hue}, 70%, 45%, 0.16)`);
        ng.addColorStop(1, `hsla(${hue}, 70%, 45%, 0)`);
        ctx.fillStyle = ng; ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

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

    // Cockpit window: the whole canvas is the view -- nothing about the play field is hidden
    // behind cockpit dressing. A thin metal frame borders it, with a slim instrument dash
    // along the very bottom instead of the old trapezoid that cropped half the screen away.
    let winL = 0.015, winR = 0.985, winT = 0.02, dashTop = 0.85;
    let fx0 = canvas.width*winL, fx1 = canvas.width*winR, fy0 = canvas.height*winT, fy1 = canvas.height*dashTop;

    // Slim instrument dash across the bottom
    let dashGrad = ctx.createLinearGradient(0, canvas.height, 0, fy1);
    dashGrad.addColorStop(0, "#141519"); dashGrad.addColorStop(1, "#34363e");
    ctx.fillStyle = dashGrad; ctx.fillRect(0, fy1, canvas.width, canvas.height - fy1);

    let dashY = canvas.height * (dashTop + (1 - dashTop) * 0.55), dashCX = canvas.width / 2;

    // Vent slits along the dash's top ridge
    ctx.fillStyle = "#0a0a0c";
    for (let i = -4; i <= 4; i++) {
        let vx = dashCX + i * canvas.width * 0.03;
        ctx.fillRect(vx - 2, fy1 + 3, 4, 8);
    }

    // Central hub: a thick beveled ring, like a control-yoke mount
    ctx.save(); ctx.translate(dashCX, dashY);
    let hubR = canvas.height * 0.06;
    let ringGrad = ctx.createRadialGradient(-hubR*0.3, -hubR*0.3, hubR*0.2, 0, 0, hubR);
    ringGrad.addColorStop(0, "#5a5e68"); ringGrad.addColorStop(0.55, "#2c2e34"); ringGrad.addColorStop(1, "#141519");
    ctx.fillStyle = ringGrad; ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#0a0a0c"; ctx.beginPath(); ctx.arc(0, 0, hubR*0.62, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "rgba(220, 230, 240, 0.25)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, hubR*0.8, Math.PI*1.1, Math.PI*1.7); ctx.stroke();
    ctx.strokeStyle = "rgba(0, 220, 255, 0.4)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, hubR*0.62, 0, Math.PI*2); ctx.stroke();
    let hubPulse = 0.5 + Math.sin(frames*0.05)*0.2;
    applyGlow(ctx, "#00ccff", 8); ctx.fillStyle = `rgba(0, 220, 255, ${hubPulse})`; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill(); clearGlow(ctx);
    // Countdown ring around the hub, draining as the anomaly timer runs out
    let timeFrac = Math.max(0, Math.min(1, levelTimer3D / 30));
    ctx.strokeStyle = "#0a0a0c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, hubR*1.12, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = timeFrac < 0.2 ? "#ff3333" : "#00e0ff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, hubR*1.12, -Math.PI/2, -Math.PI/2 + Math.PI*2*timeFrac); ctx.stroke();
    ctx.restore();

    [-1, 1].forEach(side => {
        let panelW = canvas.width * 0.15, panelH = canvas.height * 0.095;
        let px = dashCX + side * canvas.width * 0.23 - (side < 0 ? panelW : 0);
        let py = dashY - panelH * 0.4;

        // secondary gauge between the hub and this screen: a 5-segment LED meter for
        // hull integrity (left) and combo multiplier (right)
        let bx0 = dashCX + side * canvas.width * 0.115;
        let segVal = side < 0 ? (playerHp / playerMaxHp) : (combo / 10);
        let segColor = side < 0 ? (playerHp / playerMaxHp < 0.3 ? "#ff3333" : "#33ff77") : "#ffaa00";
        let segBase = dashY + panelH * 0.32;
        for (let s = 0; s < 5; s++) {
            let by = segBase - s * 9;
            let lit = segVal * 5 > s;
            ctx.fillStyle = lit ? segColor : "#1a1d22";
            if (lit) applyGlow(ctx, segColor, 4);
            ctx.fillRect(bx0 - 4, by - 4, 8, 8);
            if (lit) clearGlow(ctx);
            ctx.strokeStyle = "#0a0a0c"; ctx.lineWidth = 1; ctx.strokeRect(bx0 - 4, by - 4, 8, 8);
        }
        ctx.textAlign = "center"; ctx.font = "7px Courier New"; ctx.fillStyle = "rgba(180, 220, 230, 0.5)";
        ctx.fillText(side < 0 ? "HULL" : "COMBO", bx0, segBase + 12);

        // readout strip: small blinking lights above the screen
        for (let c = 0; c < 5; c++) {
            let lx = px + 8 + c * (panelW - 16) / 4, ly = py - 9;
            let on = Math.sin(frames*0.04 + c*1.3 + side*3) > 0.1;
            ctx.fillStyle = on ? "#33ccff" : "#123044";
            applyGlow(ctx, on ? "#33ccff" : "transparent", on ? 4 : 0);
            ctx.fillRect(lx - 3, ly - 3, 6, 6); clearGlow(ctx);
        }

        // main screen: dark glass panel with a lit bezel
        let scrGrad = ctx.createLinearGradient(px, py, px, py + panelH);
        scrGrad.addColorStop(0, "#14181e"); scrGrad.addColorStop(1, "#050608");
        ctx.fillStyle = scrGrad;
        ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 5); ctx.fill();
        ctx.strokeStyle = "rgba(0, 200, 220, 0.4)"; ctx.lineWidth = 1.5; ctx.stroke();

        // gauge dial embedded in the screen: shield on the left, heat on the right
        let gx = px + panelW/2, gy = py + panelH*0.6, gr = panelH * 0.33;
        let val = side < 0 ? (playerShield / playerMaxShield) : (heat / 100);
        let startAng = Math.PI*0.75, sweep = Math.PI*1.5;
        ctx.strokeStyle = "#232830"; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(gx, gy, gr, startAng, startAng + sweep); ctx.stroke();
        let arcColor = side < 0 ? "#00e0ff" : (overheated ? "#ff2222" : "#ffaa00");
        ctx.strokeStyle = arcColor; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(gx, gy, gr, startAng, startAng + sweep * Math.max(0, Math.min(1, val))); ctx.stroke();
        let needleAng = startAng + sweep * Math.max(0, Math.min(1, val));
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(needleAng)*(gr-5), gy + Math.sin(needleAng)*(gr-5)); ctx.stroke();
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(gx, gy, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.textAlign = "center"; ctx.font = "8px Courier New"; ctx.fillStyle = "rgba(180, 220, 230, 0.6)";
        ctx.fillText(side < 0 ? "SHIELD" : "HEAT", gx, py + panelH - 5);
    });

    // Thin metal window frame around the whole box, with small corner mounts
    ctx.strokeStyle = "#4a4d56"; ctx.lineWidth = 6;
    ctx.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    ctx.strokeStyle = "rgba(0, 200, 220, 0.3)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);

    [[fx0, fy0], [fx1, fy0], [fx0, fy1], [fx1, fy1]].forEach(([x, y]) => {
        ctx.fillStyle = "#22242a"; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#0a0a0c"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#5a2020"; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fill();
    });

    ctx.strokeStyle = "rgba(0, 255, 255, 0.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(CX - 100, CY); ctx.lineTo(CX - 20, CY); ctx.moveTo(CX + 100, CY); ctx.lineTo(CX + 20, CY);
    ctx.moveTo(CX, CY - 100); ctx.lineTo(CX, CY - 20); ctx.moveTo(CX, CY + 100); ctx.lineTo(CX, CY + 20);
    ctx.arc(CX, CY, 80, 0, Math.PI*2); ctx.stroke();

    // Targeting-frame corner brackets, a common cockpit-HUD tell
    ctx.strokeStyle = "rgba(0, 255, 255, 0.55)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    [[fx0, fy0, 1, 1], [fx1, fy0, -1, 1], [fx0, fy1, 1, -1], [fx1, fy1, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + dy*22); ctx.lineTo(x, y); ctx.lineTo(x + dx*22, y); ctx.stroke();
    });
    ctx.lineCap = "butt";

    // Soft diagonal canopy-glass glare, clipped to the window opening
    ctx.save();
    ctx.beginPath(); ctx.rect(fx0, fy0, fx1 - fx0, fy1 - fy0); ctx.clip();
    let reflGrad = ctx.createLinearGradient(canvas.width*0.1, canvas.height*0.1, canvas.width*0.55, canvas.height*0.55);
    reflGrad.addColorStop(0, "rgba(255, 255, 255, 0.09)");
    reflGrad.addColorStop(0.18, "rgba(255, 255, 255, 0.02)");
    reflGrad.addColorStop(0.32, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = reflGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.textAlign = "center";
    let hudLabel = `HYPERSPACE ANOMALY - TIME: ${Math.max(0, Math.ceil(levelTimer3D))}s`;
    ctx.font = "bold 15px Courier New";
    let hudW = ctx.measureText(hudLabel).width;
    ctx.fillStyle = "rgba(0, 20, 20, 0.5)"; ctx.fillRect(CX - hudW/2 - 10, canvas.height*0.15 - 16, hudW + 20, 22);
    ctx.fillStyle = "rgba(0, 255, 255, 0.9)"; ctx.fillText(hudLabel, CX, canvas.height*0.15);
    
    if (playerShield > 0) {
        // Edge-only vignette so the shield reads as a cue without washing out the whole scene.
        let vign = ctx.createRadialGradient(CX, CY, canvas.height * 0.35, CX, CY, canvas.height * 0.8);
        vign.addColorStop(0, "rgba(0, 255, 255, 0)");
        vign.addColorStop(1, `rgba(0, 255, 255, ${0.08 + (playerShield / 100) * 0.14})`);
        ctx.fillStyle = vign; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.textAlign = "center";
    floatingTexts.forEach(t => { ctx.globalAlpha = t.life; ctx.fillStyle = t.color; ctx.font = `bold ${t.size}px Courier New`; ctx.fillText(t.text, t.x, t.y); }); ctx.globalAlpha = 1.0;
    
    if (nukeFlash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${nukeFlash})`; ctx.fillRect(0,0,canvas.width, canvas.height); }

    if (usingMouse) {
        ctx.save(); ctx.translate(mouse.x, mouse.y); ctx.rotate(frames * 0.05);
        ctx.strokeStyle = overheated ? "#f00" : (heat > 75 ? "#f50" : "#0f0"); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.moveTo(-15, 0); ctx.lineTo(-5, 0); ctx.moveTo(15, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -15); ctx.lineTo(0, -5); ctx.moveTo(0, 15); ctx.lineTo(0, 5); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
    drawAchievementToasts();
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
            if (t.type.startsWith("boss") || t.type === "tie_advanced" || t.type === "sentinel" || t.isQueen) {
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
        let color = p.type === 'C' ? `hsl(${(frames*4)%360},100%,60%)` : (PowerupColors[p.type] || "#33ff33");
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

    bullets.forEach((b, bi) => {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.yv, b.xv));
        if (b.isHack) { applyGlow(ctx, "#00ff00", 12); ctx.fillStyle = "#00ff00"; ctx.font = "bold 14px Courier New"; ctx.fillText(Math.random() > 0.5 ? "1" : "0", -4, 4); clearGlow(ctx); }
        else if (b.isEmpBolt) { applyGlow(ctx, "#00ffff", 15); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, 0, b.r || 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#00aaff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, (b.r || 6) + 3, 0, Math.PI * 2); ctx.stroke(); clearGlow(ctx); }
        else {
            let laserColor = chaosTimer > 0 ? `hsl(${(frames*8 + bi*40)%360},100%,60%)` : ShipDesigns[selectedShipType].laserColor;
            ctx.fillStyle = laserColor; applyGlow(ctx, laserColor, 10); ctx.beginPath(); ctx.arc(0, 0, b.r || 2, 0, Math.PI * 2); ctx.fill(); clearGlow(ctx);
        }
        ctx.restore();
    });

    if (gameState === "PLAYING" || gameState === "LEVEL_TRANSITION" || gameState === "PAUSED") {
        if (invulnTimer <= 0 || frames % 10 < 5) {
            let chaosScale = chaosTimer > 0 ? 1 + Math.sin(frames * 0.3) * 0.25 : 1;
            ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.angle); ctx.scale(chaosScale, chaosScale); ShipDesigns[selectedShipType].draw(ctx, ship.r, ship.thrusting); ctx.restore();
            if (playerShield > 0) { applyGlow(ctx, "#00ffff", 10); ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + (playerShield/100)*0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ship.x, ship.y, ship.r * 1.6, 0, Math.PI*2); ctx.stroke(); clearGlow(ctx); }
            if (multishotTimer > 0) { applyGlow(ctx, "#ff00ff", 10); ctx.strokeStyle = `rgba(255, 0, 255, ${Math.abs(Math.sin(frames/10))})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ship.x, ship.y, ship.r * 1.3, 0, Math.PI*2); ctx.stroke(); clearGlow(ctx); }
            if (chaosTimer > 0) { let hue = (frames*8)%360; applyGlow(ctx, `hsl(${hue},100%,60%)`, 14); ctx.strokeStyle = `hsl(${hue},100%,60%)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ship.x, ship.y, ship.r * 2.0, 0, Math.PI*2); ctx.stroke(); clearGlow(ctx); }
        }
    }

    ctx.textAlign = "center";
    floatingTexts.forEach(t => { ctx.globalAlpha = t.life; ctx.fillStyle = t.color; ctx.font = `bold ${t.size}px Courier New`; ctx.fillText(t.text, t.x, t.y); }); ctx.globalAlpha = 1.0;

    if (chaosTimer > 0) {
        // Edge-only rainbow vignette so PARTY MODE reads as a fun cue without washing out play
        let vign = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height*0.35, canvas.width/2, canvas.height/2, canvas.height*0.75);
        let hue = (frames*8)%360;
        vign.addColorStop(0, `hsla(${hue},100%,60%,0)`); vign.addColorStop(1, `hsla(${hue},100%,60%,0.22)`);
        ctx.fillStyle = vign; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (nukeFlash > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${nukeFlash})`; ctx.fillRect(0,0,canvas.width, canvas.height); }
    
    if (gameState === "PLAYING" && usingMouse) {
        ctx.save(); ctx.translate(mouse.x, mouse.y); ctx.rotate(frames * 0.05);
        ctx.strokeStyle = overheated ? "#f00" : (heat > 75 ? "#f50" : "#0f0"); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.moveTo(-15, 0); ctx.lineTo(-5, 0); ctx.moveTo(15, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -15); ctx.lineTo(0, -5); ctx.moveTo(0, 15); ctx.lineTo(0, 5); ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
    drawAchievementToasts();
    drawMenuOverlays();
}

function drawMenuOverlays() {
    ctx.textAlign = "center";
    if (gameState === "PAUSED") { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0,0,canvas.width, canvas.height); ctx.fillStyle = "#fff"; ctx.font = "bold 40px Courier New"; ctx.fillText("PAUSED", canvas.width/2, canvas.height/2); }
    if (gameState === "LEVEL_TRANSITION") { ctx.fillStyle = `rgba(0,0,0,${1 - hyperspace/2})`; ctx.fillRect(0,0,canvas.width, canvas.height); ctx.fillStyle = "#33ccff"; ctx.font = "bold 40px Courier New"; ctx.fillText("JUMPING TO SECTOR " + level, canvas.width/2, canvas.height/2); }
    if (gameState === "GAMEOVER") {
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        let cx = canvas.width / 2, cy = canvas.height / 2;
        ctx.fillStyle = "#ffcc00"; ctx.font = "bold 44px Courier New"; ctx.fillText("GAME OVER", cx, cy - 130);
        ctx.fillStyle = "#33ccff"; ctx.font = "bold 18px Courier New"; ctx.fillText(gameOverMessage || "NICE FLYING, PILOT!", cx, cy - 95);

        let panelW = 320, panelH = 150, px = cx - panelW/2, py = cy - 65;
        ctx.fillStyle = "rgba(20, 20, 24, 0.9)"; ctx.strokeStyle = "#444"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 8); ctx.fill(); ctx.stroke();
        let rows = [
            ["LEVEL REACHED", level], ["ENEMIES DESTROYED", runKills], ["BEST COMBO", runBestCombo + "x"],
            ["SCRAP EARNED", currentRunScrap], ["FINAL SCORE", Math.round(score)],
        ];
        ctx.font = "14px Courier New";
        rows.forEach(([label, val], i) => {
            let ry = py + 26 + i * 24;
            ctx.textAlign = "left"; ctx.fillStyle = "#999"; ctx.fillText(label, px + 16, ry);
            ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.fillText(String(val), px + panelW - 16, ry);
        });
        ctx.textAlign = "center";

        ctx.fillStyle = "white"; ctx.font = "16px Courier New"; ctx.fillText("Press 'R' to return", cx, cy + 115);
    }
}