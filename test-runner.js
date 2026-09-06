// Self-test harness for Space Fandoms Collide.
//
// Usage: open index.html?test=1 in a browser (locally or on the live site).
// This script only loads when that query flag is present -- it has zero
// effect on normal play and ships as an ordinary static file like game.js.
//
// All destructive checks run under a disposable "__SELFTEST__" pilot profile,
// which is deleted when the run finishes, so this never touches real save
// data (scrap, achievements, stats) sitting under the player's real profiles.
(function () {
    const results = [];
    function test(name, fn) {
        // mouse/keys are persistent globals the real game never resets between runs (only startGame
        // resets ship/level state, not input state) -- without this, a leftover mouse.rightDown=true
        // from an earlier test keeps the ship thrusting and drifting off the fixed spot a later test
        // positions it at, throwing off aim for anything that depends on a clean point-blank shot.
        mouse.rightDown = false; mouse.leftDown = false; keys = {};
        try { fn(); results.push({ name, pass: true }); }
        catch (e) { results.push({ name, pass: false, error: e.message || String(e) }); }
    }

    // Places the ship a short, fixed distance from a target, always offsetting toward canvas
    // center. A fixed "target.y - 60" style offset can push the ship off-canvas when a target
    // spawns near an edge, which triggers the game's real screen-wrap and teleports the ship to
    // the opposite side -- offsetting inward instead guarantees it stays on-screen regardless of
    // where the target is, while still aiming at the target's real (tracked) position each frame.
    function positionShipNear(target, dist) {
        let dx = (canvas.width / 2) - target.x, dy = (canvas.height / 2) - target.y;
        let norm = Math.hypot(dx, dy) || 1;
        ship.x = target.x + (dx / norm) * dist;
        ship.y = target.y + (dy / norm) * dist;
    }

    const ALL_SHIPS = ['xwing', 'falcon', 'tiefighter', 'enterprise', 'apollo', 'serenity', 'borg', 'pelican', 'tardis', 'viper', 'nebuchadnezzar', 'lightship', 'milano', 'fsociety'];
    const originalProfile = activeProfileId;
    createProfile('SELFTEST');
    // createProfile() switches to the new profile synchronously, so activeProfileId is now its id.
    // Capture it directly rather than searching by name -- createProfile sanitizes names and
    // strips characters like underscores, so a name-based lookup would silently miss.
    const selftestProfileId = activeProfileId;

    test('all 14 stock ships are defined', () => {
        ALL_SHIPS.forEach(id => { if (!ShipDesigns[id]) throw new Error('missing ship: ' + id); });
    });

    test('12 achievements are defined', () => {
        if (ACHIEVEMENTS.length !== 12) throw new Error('expected 12, got ' + ACHIEVEMENTS.length);
    });

    test('5 unlockable trail colors are defined', () => {
        if (TRAIL_COLORS.length !== 5) throw new Error('expected 5, got ' + TRAIL_COLORS.length);
    });

    test('every ship draws without throwing, thrusting and idle', () => {
        ALL_SHIPS.forEach(id => {
            ShipDesigns[id].draw(document.createElement('canvas').getContext('2d'), 20, true);
            ShipDesigns[id].draw(document.createElement('canvas').getContext('2d'), 20, false);
        });
    });

    test('every enemy/asteroid/satellite design draws without throwing', () => {
        ['tie_advanced', 'star_destroyer', 'tie_interceptor', 'tie_fighter', 'satellite', 'asteroid'].forEach(id => {
            TargetDesigns[id].draw(document.createElement('canvas').getContext('2d'), 20, { vertices: [], craters: [], facets: [], baseColor: '#444', shadowColor: '#111' });
        });
    });

    ['easy', 'moderate', 'hard', 'insane'].forEach(diff => {
        [1, 5, 7, 10, 14, 15, 20, 21, 25, 26, 30, 35, 40].forEach(lvl => {
            test(`gameplay: ${diff} / level ${lvl}`, () => {
                gameDifficulty = diff;
                startGame('xwing'); level = lvl; startLevel();
                mouse.leftDown = true; mouse.rightDown = true;
                for (let f = 0; f < 25; f++) {
                    mouse.x = 500 + Math.sin(f * 0.13 + lvl) * 400; mouse.y = 375 + Math.cos(f * 0.11 + lvl) * 300;
                    if (is3DMode) update3D(0.016); else update(0.016);
                }
                render();
            });
        });
    });

    test('all 14 ships fly for a few frames without throwing', () => {
        gameDifficulty = 'easy';
        ALL_SHIPS.forEach(id => {
            startGame(id); level = 1; startLevel();
            for (let f = 0; f < 10; f++) update(0.016);
        });
    });

    test('boss kill increments lifetime bossKills', () => {
        gameDifficulty = 'easy'; // deterministic spawn counts -- these scenario tests care about a clean 1v1, not difficulty scaling
        startGame('xwing'); level = 30; startLevel(); // level 30: boss_carrier, no shield nodes to fight through
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        if (!boss) throw new Error('no boss spawned at level 30');
        boss.hp = 1;
        // Escort asteroids/fighters can spawn alongside a boss -- isolate it so one can't drift
        // into the firing line and eat the shot meant for it.
        targets = [boss];
        mouse.leftDown = true; fireCooldown = 0;
        let before = lifetimeStats.bossKills;
        for (let f = 0; f < 20 && targets.includes(boss); f++) { mouse.x = boss.x; mouse.y = boss.y; positionShipNear(boss, 60); update(0.016); }
        if (lifetimeStats.bossKills <= before) throw new Error('bossKills did not increment');
    });

    test('hive queen kill unlocks hive_breaker', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 25; startLevel();
        let queen = targets.find(t => t.isQueen);
        if (!queen) throw new Error('no queen spawned at level 25');
        queen.hp = 1;
        // Isolate the queen from the rest of the swarm -- with dozens of other minions also
        // orbiting toward the ship, one can randomly drift into the firing line and intercept
        // the shot meant for the queen. This test is about the unlock, not swarm dodging.
        targets = [queen];
        mouse.leftDown = true; fireCooldown = 0;
        // The queen actively retreats from anything inside her preferred orbit distance, so aiming
        // once at a snapshot position and holding it would miss as she flees -- track her every frame.
        for (let f = 0; f < 20 && targets.includes(queen); f++) { mouse.x = queen.x; mouse.y = queen.y; positionShipNear(queen, 60); update(0.016); }
        if (!unlockedAch['hive_breaker']) throw new Error('hive_breaker not unlocked');
    });

    test('boss carrier spawns at level 30 and launches interceptors', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 30; startLevel();
        let boss = targets.find(t => t.type === 'boss_carrier');
        if (!boss) throw new Error('boss_carrier did not spawn');
        boss.launchTimer = 0.001;
        let before = targets.length;
        for (let f = 0; f < 10; f++) update(0.016);
        if (targets.length <= before) throw new Error('carrier did not launch fighters');
    });

    test('boss worm spawns at level 40, grows a trail, and can be killed', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 40; startLevel();
        let worm = targets.find(t => t.type === 'boss_worm');
        if (!worm) throw new Error('boss_worm did not spawn at level 40');
        for (let f = 0; f < 20; f++) update(0.016);
        if (!worm.trail || worm.trail.length === 0) throw new Error('worm never grew a body trail');
        worm.hp = 1;
        let before = lifetimeStats.bossKills;
        mouse.leftDown = true; fireCooldown = 0;
        for (let f = 0; f < 20 && targets.includes(worm); f++) { mouse.x = worm.x; mouse.y = worm.y; positionShipNear(worm, 60); update(0.016); }
        if (lifetimeStats.bossKills <= before) throw new Error('worm kill did not register as a boss kill');
    });

    test('boss rotation keeps the classic campaign and starves no boss', () => {
        let expected = { 5:'boss_station', 10:'boss_mothership', 15:'sentinel_swarm', 20:'boss_dreadnought', 25:'hive_swarm', 30:'boss_carrier', 40:'boss_worm' };
        Object.keys(expected).forEach(l => {
            let got = bossForLevel(+l);
            if (got !== expected[l]) throw new Error('level ' + l + ' should be ' + expected[l] + ', got ' + got);
        });
        if (bossForLevel(35) !== null) throw new Error('level 35 is a hyperspace level and should have no boss');
        // The old modulus chain let earlier rules starve later ones -- the worm got 2 appearances
        // per 1000 levels and the carrier 4. Every boss should now land in the same ballpark.
        let counts = {};
        for (let l = 1; l <= 1000; l++) { let b = bossForLevel(l); if (b) counts[b] = (counts[b] || 0) + 1; }
        if (Object.keys(counts).length !== 7) throw new Error('expected all 7 bosses, saw ' + Object.keys(counts).length);
        if (Math.min(...Object.values(counts)) < 20) throw new Error('a boss is starved: ' + JSON.stringify(counts));
    });

    test('a Sentinel Swarm cannot end early or leak its queue into the next level', () => {
        gameDifficulty = 'moderate';
        startGame('viper'); level = 15; startLevel();
        if (sentinelSpawnQueue <= 0) throw new Error('swarm queued no reinforcements');
        targets = []; update(0.016);
        if (gameState !== 'PLAYING') throw new Error('level ended while reinforcements were still inbound');
        let guard = 0;
        while (sentinelSpawnQueue > 0 && guard++ < 8000) { targets = []; update(0.016); }
        targets = []; update(0.016);
        // A Sentinel Swarm is a boss level, so clearing it lands on the perk choice first.
        if (gameState !== 'UPGRADE_CHOICE') throw new Error('level did not end once the queue drained (state: ' + gameState + ')');
        chooseRunPerk(0);
        if (gameState !== 'LEVEL_TRANSITION') throw new Error('choosing a perk did not resume the run');
        gameState = 'PLAYING'; startLevel();
        if (sentinelSpawnQueue !== 0) throw new Error('leftover sentinels leaked into the next level');
    });

    test('sentinels never outrun the hull the player picked', () => {
        ['borg', 'enterprise', 'xwing', 'tiefighter'].forEach(id => {
            startGame(id);
            let sentinelPxs = sentinelChaseSpeed(2.5) * 60;   // roughly a level-15 speedMod
            let playerPxs = playerTopSpeed();
            if (sentinelPxs > Math.max(60, playerPxs)) throw new Error(id + ': sentinel ' + Math.round(sentinelPxs) + ' px/s outruns player ' + Math.round(playerPxs) + ' px/s');
        });
    });

    test('a hacked boss keeps fighting instead of being frozen forever', () => {
        gameDifficulty = 'easy';
        startGame('fsociety'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        if (!boss) throw new Error('no boss at level 20');
        targets = [boss]; boss.hp = 999999;
        ship.x = boss.x - 150; ship.y = boss.y; mouse.x = boss.x; mouse.y = boss.y;
        mouse.leftDown = true; fireCooldown = 0;
        let sawEnemyFire = false;
        for (let f = 0; f < 900 && !sawEnemyFire; f++) { update(0.016); if (enemyBullets.length > 0) sawEnemyFire = true; }
        mouse.leftDown = false;
        if (!sawEnemyFire) throw new Error('boss never got a shot off -- the hack stun-lock is back');
    });

    test('the worm is untouchable while burrowed and its body is solid when surfaced', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 40; startLevel();
        let worm = targets.find(t => t.type === 'boss_worm');
        if (!worm) throw new Error('boss_worm did not spawn');
        targets = [worm];

        worm.wormPhase = 'down'; worm.wormTimer = 99; worm.burrow = 1; worm.submerged = true;
        let hpBefore = worm.hp;
        ship.x = worm.x - 40; ship.y = worm.y; mouse.x = worm.x; mouse.y = worm.y;
        mouse.leftDown = true; fireCooldown = 0;
        for (let f = 0; f < 60; f++) update(0.016);
        mouse.leftDown = false;
        if (worm.hp < hpBefore) throw new Error('a burrowed worm still took damage');

        // Surfaced, the trailing body has to hurt on contact even though only the head is shootable.
        worm.wormPhase = 'up'; worm.wormTimer = 99; worm.burrow = 0; worm.submerged = false;
        worm.x = 950; worm.y = 700;                       // park the head far from the ship
        worm.trail = [{ x: 300, y: 300 }, { x: 340, y: 300 }];
        ship.x = 300; ship.y = 300; ship.xv = 0; ship.yv = 0;
        invulnTimer = 0; playerHp = playerMaxHp; playerShield = playerMaxShield;
        update(0.016);
        if (playerShield === playerMaxShield && playerHp === playerMaxHp) throw new Error('worm body segment dealt no contact damage');
    });

    test('a near miss scores a close call without damaging the player', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 3; startLevel();
        // One far-off asteroid so the level does not complete mid-test.
        targets = [{ type: 'asteroid', x: 60, y: 60, r: 20, xv: 0, yv: 0, angle: 0, rotSpeed: 0, stunned: 0 }];
        enemyBullets = []; invulnTimer = 0;
        ship.x = 500; ship.y = 400; ship.xv = 0; ship.yv = 0;
        playerHp = playerMaxHp; playerShield = playerMaxShield;
        let grazeBefore = runGrazes, scoreBefore = score;
        // Passes ~30px off the hull: inside the graze band, well outside the hit radius.
        enemyBullets.push({ x: 560, y: 400 + ship.r + 15, xv: -6, yv: 0, range: 400 });
        for (let f = 0; f < 30 && runGrazes === grazeBefore; f++) update(0.016);
        if (runGrazes <= grazeBefore) throw new Error('near miss did not register as a close call');
        if (score <= scoreBefore) throw new Error('close call awarded no score');
        if (playerHp < playerMaxHp || playerShield < playerMaxShield) throw new Error('a graze must not damage the player');
    });

    test('clearing a hyperspace anomaly untouched unlocks "untouchable"', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 7; startLevel();
        targets3D = []; enemyBullets3D = []; levelTimer3D = 0.001;
        for (let f = 0; f < 5; f++) update3D(0.016);
        if (!unlockedAch['untouchable']) throw new Error('untouchable not unlocked');
    });

    test('nuke damages a boss but never destroys it outright', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 10; startLevel(); bombs = 2;
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        if (!boss) throw new Error('no boss spawned at level 10');
        let hpBefore = boss.hp;
        triggerNuke();
        if (boss.hp !== Math.max(1, hpBefore - 50)) throw new Error('unexpected boss hp after nuke: ' + boss.hp);
    });

    test('Party Mode powerup activates chaos + a rapid-fire bonus', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 3; startLevel();
        powerups.push({ x: ship.x, y: ship.y, xv: 0, yv: 0, r: 15, angle: 0, type: 'C' });
        for (let f = 0; f < 3; f++) update(0.016);
        if (chaosTimer <= 0) throw new Error('chaosTimer did not activate');
        if (rapidFireTimer <= 0) throw new Error('rapidFireTimer bonus did not apply');
    });

    test('Ship Builder save registers and persists a custom ship', () => {
        builderSaveBtn.click();
        if (!ShipDesigns.custom) throw new Error('custom ship not registered in ShipDesigns');
        if (!localStorage.getItem(pKey('sfc_customShip'))) throw new Error('custom ship not persisted to storage');
        if (!unlockedAch['shipwright']) throw new Error('shipwright achievement not unlocked');
    });

    test('profile isolation: a new profile starts clean, switching back restores progress', () => {
        totalScrap = 777; unlockedAch['first_blood'] = true; saveGameData();
        let selftestId = activeProfileId;
        createProfile('ISOTEST');
        if (totalScrap !== 0) throw new Error('new profile inherited scrap: ' + totalScrap);
        if (Object.keys(unlockedAch).length !== 0) throw new Error('new profile inherited achievements');
        let isoId = activeProfileId;
        switchProfile(selftestId);
        if (totalScrap !== 777) throw new Error('original scrap not restored after switching back');
        if (!unlockedAch['first_blood']) throw new Error('original achievement not restored after switching back');
        deleteProfile(isoId);
    });

    test('Reset Progress wipes the active pilot without deleting the profile', () => {
        totalScrap = 500; unlockedAch['first_blood'] = true;
        let countBefore = profiles.length;
        resetActiveProfileProgress();
        if (totalScrap !== 0) throw new Error('scrap not cleared by reset');
        if (Object.keys(unlockedAch).length !== 0) throw new Error('achievements not cleared by reset');
        if (profiles.length !== countBefore) throw new Error('reset should not remove the profile itself');
    });

    test('volume slider routes through the shared master gain node', () => {
        initAudio();
        setMasterVolume(0.37);
        if (!masterGain || Math.abs(masterGain.gain.value - 0.37) > 0.01) throw new Error('masterGain.gain.value did not update');
        setMasterVolume(1);
    });

    test('locked trail colors refuse to equip, unlocked ones equip fine', () => {
        equipTrail('rainbow');
        if (equippedTrail === 'rainbow') throw new Error('a locked trail color was equipped');
        unlockedAch['ace'] = true;
        equipTrail('rainbow');
        if (equippedTrail !== 'rainbow') throw new Error('an unlocked trail color failed to equip');
        equipTrail('classic');
    });

    test('a wounded boss breaks into a 3D cockpit pursuit carrying its HP across', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();     // dreadnought: a single-entity boss
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        if (!boss) throw new Error('no boss at level 20');
        targets = [boss];
        if (is3DMode || bossPursuit) throw new Error('the fight should start in 2D');

        // Wound it just past the threshold with a single shot.
        boss.hp = Math.ceil(boss.maxHp * 0.5) + 1;
        ship.x = boss.x - 120; ship.y = boss.y; mouse.x = boss.x; mouse.y = boss.y;
        mouse.leftDown = true; fireCooldown = 0;
        for (let f = 0; f < 200 && !bossPursuit; f++) update(0.016);
        mouse.leftDown = false;
        if (!bossPursuit) throw new Error('boss never broke away into a pursuit');
        if (!is3DMode) throw new Error('pursuit did not switch to the cockpit view');

        let boss3D = targets3D.find(t => t.isBoss);
        if (!boss3D) throw new Error('no boss entity in the pursuit');
        if (boss3D.maxHp !== boss.maxHp) throw new Error('boss max HP did not carry across');
        if (boss3D.hp > boss.maxHp * 0.5) throw new Error('boss should arrive already wounded');
        if (targets3D.length < 2) throw new Error('pursuit spawned no asteroid field');
        if (targets.length !== 0) throw new Error('the 2D field should be handed off, not left running');
    });

    test('the pursuit boss holds a firing distance and shoots back', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        targets = [boss]; boss.hp = 2;
        beginBossPursuit(boss);
        let b3 = targets3D.find(t => t.isBoss);
        let sawFire = false, minZ = Infinity, maxZ = -Infinity;
        for (let f = 0; f < 600; f++) {
            update3D(0.016);
            if (enemyBullets3D.length > 0) sawFire = true;
            if (targets3D.includes(b3)) { minZ = Math.min(minZ, b3.z); maxZ = Math.max(maxZ, b3.z); }
        }
        if (!sawFire) throw new Error('pursuit boss never fired');
        if (minZ < 300) throw new Error('pursuit boss closed to ramming range instead of holding a duel distance');
        if (maxZ > 3400) throw new Error('pursuit boss drifted out of the arena');
        if (!targets3D.includes(b3)) throw new Error('pursuit boss was culled by the depth logic');
    });

    test('a wounded pursuit boss trails smoke and embers, and they clear when the pursuit ends', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        targets = [boss]; beginBossPursuit(boss);
        let b3 = targets3D.find(t => t.isBoss);
        b3.hp = Math.round(b3.maxHp * 0.1);   // heavily wounded: effects should spawn quickly
        for (let f = 0; f < 120; f++) update3D(0.016);
        if (bossEffects3D.length === 0) throw new Error('a heavily wounded pursuit boss produced no smoke/embers');
        if (!bossEffects3D.every(e => e.kind === 'smoke' || e.kind === 'ember')) throw new Error('unexpected effect kind');
        endBossPursuit(false);
        if (bossEffects3D.length !== 0) throw new Error('boss effects leaked past the end of the pursuit');
    });

    test('the 3D scene stays dark -- no bright colour wash from the nebula backdrop', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 7; startLevel(); gameState = 'PLAYING';
        render3D();
        // Sample a patch of open sky (upper-left quadrant, away from the cockpit airframe and HUD).
        let sample = ctx.getImageData(Math.round(canvas.width * 0.15), Math.round(canvas.height * 0.12), 1, 1).data;
        let brightness = (sample[0] + sample[1] + sample[2]) / 3;
        if (brightness > 40) throw new Error('background is too bright for deep space: rgb(' + sample[0] + ',' + sample[1] + ',' + sample[2] + ')');
    });

    test('a nuke cannot delete the pursuit boss or hand a free win', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        targets = [boss];
        beginBossPursuit(boss);
        let b3 = targets3D.find(t => t.isBoss);
        let hpBefore = b3.hp;
        bombs = 3; triggerNuke();
        if (!targets3D.some(t => t.isBoss)) throw new Error('nuke deleted the pursuit boss outright');
        if (b3.hp >= hpBefore) throw new Error('nuke did no damage to the pursuit boss');
        if (b3.hp < 1) throw new Error('nuke should floor the boss at 1 HP, not kill it');
    });

    test('killing the pursuit boss ends the level and offers a perk', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        targets = [boss];
        beginBossPursuit(boss);
        let b3 = targets3D.find(t => t.isBoss);
        let kills = lifetimeStats.bossKills, lvl = level;
        b3.hp = 1;
        // Put a bullet right on it rather than relying on aim through a moving asteroid field.
        bullets3D.push({ x: b3.x, y: b3.y, z: b3.z, vx: 0, vy: 0, vz: 0, r: 5, color: '#fff' });
        for (let f = 0; f < 10 && bossPursuit; f++) update3D(0.016);
        if (lifetimeStats.bossKills <= kills) throw new Error('pursuit kill did not count as a boss kill');
        if (bossPursuit) throw new Error('pursuit did not end when the boss died');
        if (is3DMode) throw new Error('pursuit left the game stuck in the cockpit view');
        if (level !== lvl + 1) throw new Error('level did not advance after the pursuit');
        if (gameState !== 'UPGRADE_CHOICE') throw new Error('pursuit win did not offer a perk');
        chooseRunPerk(0);
    });

    test('swarm bosses stay a 2D fight and never trigger a pursuit', () => {
        gameDifficulty = 'easy';
        [15, 25].forEach(lvl => {                          // sentinel swarm, hive swarm
            startGame('xwing'); level = lvl; startLevel();
            for (let f = 0; f < 240; f++) update(0.016);
            if (bossPursuit) throw new Error('level ' + lvl + ' swarm wrongly triggered a cockpit pursuit');
            if (is3DMode) throw new Error('level ' + lvl + ' swarm switched to the cockpit view');
        });
    });

    test('clearing a boss level offers three distinct perks that actually apply', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 5; startLevel();
        targets = []; sentinelSpawnQueue = 0;
        update(0.016);
        if (gameState !== 'UPGRADE_CHOICE') throw new Error('clearing a boss level did not offer perks');
        if (perkChoices.length !== 3) throw new Error('expected 3 perk choices, got ' + perkChoices.length);
        if (new Set(perkChoices.map(p => p.id)).size !== 3) throw new Error('the same perk was dealt twice in one hand');
        // Pick a perk with an effect we can assert on, rather than whatever chance dealt.
        perkChoices[0] = RUN_PERKS.find(p => p.id === 'emitter');
        let dmgBefore = runBonusDamage;
        chooseRunPerk(0);
        if (runBonusDamage !== dmgBefore + 1) throw new Error('perk did not apply its effect');
        if (runPerksTaken.length !== 1) throw new Error('perk was not recorded on the run');
        if (gameState !== 'LEVEL_TRANSITION') throw new Error('choosing a perk did not resume the run');
        if (perkOverlay && !perkOverlay.classList.contains('hidden')) throw new Error('perk overlay stayed open');
    });

    test('a non-boss level does not offer perks', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 3; startLevel();
        targets = []; sentinelSpawnQueue = 0;
        update(0.016);
        if (gameState === 'UPGRADE_CHOICE') throw new Error('an ordinary level offered a perk choice');
    });

    test('run perk modifiers are scoped to the run and reset on the next one', () => {
        startGame('xwing');
        RUN_PERKS.forEach(p => p.apply());          // take everything at once
        if (runBonusDamage === 0 || runFireRateMult === 1 || runShieldRegen === 0) throw new Error('perks did not modify run state');
        startGame('xwing');
        if (runBonusDamage !== 0 || runFireRateMult !== 1 || runHeatMult !== 1) throw new Error('perk modifiers leaked into the next run');
        if (runScrapMult !== 1 || runShieldRegen !== 0 || runComboHold !== 1) throw new Error('perk modifiers leaked into the next run');
        if (runPerksTaken.length !== 0) throw new Error('perk list leaked into the next run');
        if (playerMaxHp !== 100) throw new Error('max hull leaked into the next run');
    });

    test('boss rush stages a boss every wave with no filler or hyperspace', () => {
        gameDifficulty = 'easy';
        startGame('xwing', 'rush');
        if (gameMode !== 'rush') throw new Error('rush mode did not engage');
        let seen = new Set();
        for (let wave = 1; wave <= 7; wave++) {
            level = wave; startLevel();
            if (is3DMode) throw new Error('wave ' + wave + ' fell into hyperspace');
            let hasEncounter = targets.length > 0 || sentinelSpawnQueue > 0;
            if (!hasEncounter) throw new Error('wave ' + wave + ' spawned no encounter');
            seen.add(BOSS_ROTATION[(wave - 1) % BOSS_ROTATION.length]);
        }
        if (seen.size !== 7) throw new Error('the first 7 waves should cover all 7 bosses, saw ' + seen.size);
    });

    test('the daily challenge lays out the same levels for the same seed', () => {
        gameDifficulty = 'moderate';
        const layout = () => {
            startGame('xwing', 'daily');
            level = 6; startLevel();
            return targets.map(t => `${t.type}@${Math.round(t.x)},${Math.round(t.y)},${Math.round(t.r)}`).join('|');
        };
        let a = layout(), b = layout();
        if (a !== b) throw new Error('two daily runs on the same seed produced different layouts');
        if (!a) throw new Error('daily run spawned nothing to compare');
        // A different seed must actually produce a different layout, or the seeding is a no-op.
        startGame('xwing', 'daily'); dailySeed = dailySeed + 12345;
        level = 6; startLevel();
        let c = targets.map(t => `${t.type}@${Math.round(t.x)},${Math.round(t.y)},${Math.round(t.r)}`).join('|');
        if (c === a) throw new Error('changing the seed did not change the layout');
        // Math.random must be handed back after the layout, not left seeded for the whole run.
        let r1 = Math.random(), r2 = Math.random();
        if (r1 === r2) throw new Error('Math.random was left seeded after level layout');
    });

    test('campaign mode is unaffected by the daily seeding path', () => {
        gameDifficulty = 'moderate';
        startGame('xwing', 'campaign');
        if (gameMode !== 'campaign') throw new Error('campaign mode did not engage');
        let native = Math.random;
        level = 6; startLevel();
        if (Math.random !== native) throw new Error('campaign level layout replaced Math.random');
    });

    test('ship select dropdown renders all 14 ships, with an armour row only on slow hulls', () => {
        rebuildShipDropdown();
        let rows = document.querySelectorAll('.ship-option');
        if (rows.length !== 14) throw new Error('expected 14 ship options, found ' + rows.length);
        rows.forEach(r => {
            let id = r.getAttribute('data-ship');
            let dots = r.querySelectorAll('.ship-stat-dot').length;
            let hasArmour = !!r.querySelector('.ship-stat-label.armr');
            let wantArmour = Math.round((1 - hullResilience(id).damageMult) * 100) >= 5;
            if (dots !== (wantArmour ? 15 : 10)) throw new Error(id + ': expected ' + (wantArmour ? 15 : 10) + ' stat dots, found ' + dots);
            if (hasArmour !== wantArmour) throw new Error(id + ': armour row presence disagrees with its resilience');
        });
    });

    test('speed rating tracks real terminal velocity, not raw thrust', () => {
        // The Borg has thrust 3 / fric 0.90 and the Enterprise thrust 4 / fric 0.95 -- close on
        // paper, 3x apart in practice. Friction, not thrust, is what the rating has to reflect.
        if (!(shipTopSpeed('borg') < shipTopSpeed('enterprise'))) throw new Error('borg should be the slower hull');
        if (!(shipTopSpeed('tiefighter') > shipTopSpeed('xwing'))) throw new Error('TIE should outrun the X-Wing');
        if (!isFinite(shipTopSpeed('apollo'))) throw new Error('apollo top speed must be bounded (fric < 1.0)');
        // Slow hulls must actually receive the compensation, fast ones must not.
        if (!(hullResilience('borg').damageMult < 0.7)) throw new Error('borg should get substantial damage resistance');
        if (hullResilience('tiefighter').damageMult !== 1) throw new Error('fast hulls should get no damage resistance');
        if (!(hullResilience('borg').shieldRegen > 0)) throw new Error('borg should regenerate shields');
        if (hullResilience('tiefighter').shieldRegen !== 0) throw new Error('fast hulls should not regenerate shields');
    });

    // Clean up: leave the throwaway profile and go back to whatever was active before the run.
    switchProfile(originalProfile);
    deleteProfile(selftestProfileId);
    gameState = 'MENU';
    if (typeof menuOverlay !== 'undefined' && menuOverlay) menuOverlay.classList.remove('hidden');

    renderResultsPanel(results);

    function renderResultsPanel(results) {
        let passed = results.filter(r => r.pass).length;
        let panel = document.createElement('div');
        panel.style.cssText = 'position:fixed; inset:0; background:rgba(5,5,8,0.97); color:#eee; ' +
            'font-family:"Courier New",monospace; font-size:13px; z-index:99999; overflow-y:auto; padding:24px; box-sizing:border-box;';

        let header = document.createElement('div');
        header.style.cssText = `font-size:22px; font-weight:bold; margin-bottom:4px; color:${passed === results.length ? '#33ff33' : '#ff5555'};`;
        header.textContent = `SELF-TEST: ${passed}/${results.length} PASSED`;
        panel.appendChild(header);

        let sub = document.createElement('div');
        sub.style.cssText = 'color:#888; margin-bottom:16px; font-size:11px;';
        sub.textContent = 'Space Fandoms Collide -- automated regression sweep (see test-runner.js)';
        panel.appendChild(sub);

        results.forEach(r => {
            let row = document.createElement('div');
            row.style.cssText = `padding:7px 12px; margin-bottom:4px; border-radius:4px; ` +
                `background:${r.pass ? 'rgba(51,255,51,0.06)' : 'rgba(255,51,51,0.15)'}; ` +
                `border-left:3px solid ${r.pass ? '#33ff33' : '#ff3333'};`;
            row.innerHTML = `<b style="color:${r.pass ? '#33ff33' : '#ff5555'}">${r.pass ? 'PASS' : 'FAIL'}</b> &mdash; ${r.name}` +
                (r.error ? `<div style="color:#ff9999; margin-top:4px; padding-left:14px;">${r.error}</div>` : '');
            panel.appendChild(row);
        });

        let closeBtn = document.createElement('button');
        closeBtn.textContent = 'CLOSE (return to game)';
        closeBtn.style.cssText = 'margin-top:16px; padding:10px 20px; background:#1a1a1a; color:#fff; ' +
            'border:1px solid #555; border-radius:4px; cursor:pointer; font-family:inherit; font-size:13px;';
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);

        document.body.appendChild(panel);

        console.log(`SELF-TEST: ${passed}/${results.length} passed`);
        results.filter(r => !r.pass).forEach(r => console.error(`FAIL: ${r.name} -- ${r.error}`));
    }
})();
