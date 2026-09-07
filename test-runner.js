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
        ['tie_advanced', 'star_destroyer', 'tie_interceptor', 'tie_fighter', 'satellite', 'asteroid', 'sentinel'].forEach(id => {
            TargetDesigns[id].draw(document.createElement('canvas').getContext('2d'), 20, { vertices: [], craters: [], facets: [], baseColor: '#444', shadowColor: '#111' });
        });
    });

    test('a boulder asteroid and an ore asteroid draw without throwing in every damage state', () => {
        const ctx2 = document.createElement('canvas').getContext('2d');
        let boulder = { ...generateJaggedAsteroid(60), r: 60, maxHp: 2, hp: 2 };
        TargetDesigns.asteroid.draw(ctx2, 60, boulder);
        boulder.hp = 1;   // chipped once -- exercises the crack-line branch
        TargetDesigns.asteroid.draw(ctx2, 60, boulder);
        if (!boulder.crackLine) throw new Error('a damaged boulder never generated a crack line');
        let ore = { ...generateJaggedAsteroid(35), r: 35, isOre: true };
        TargetDesigns.asteroid.draw(ctx2, 35, ore);
        if (!ore.veins || ore.veins.length === 0) throw new Error('an ore asteroid never generated its vein geometry');
    });

    test('boulders take two hits to crack open; ore veins pay a guaranteed scrap bonus', () => {
        gameDifficulty = 'easy';
        startGame('xwing');
        // A boulder: big enough (r>=50) to get 2 HP, and must survive exactly one hit.
        let boulder = { type: 'asteroid', x: 500, y: 375, r: 55, xv: 0, yv: 0, angle: 0, rotSpeed: 0, stunned: 0 };
        Object.assign(boulder, generateJaggedAsteroid(55));
        boulder.maxHp = 2; boulder.hp = 2;
        targets = [boulder];
        ship.x = 500; ship.y = 300; mouse.x = 500; mouse.y = 375; mouse.leftDown = true; fireCooldown = 0; invulnTimer = 0;
        update(0.016);
        if (!targets.includes(boulder)) throw new Error('a boulder was destroyed by a single hit');
        if (boulder.hp !== 1) throw new Error('boulder hp did not decrement on the first hit');
        fireCooldown = 0;   // simulate firing again rather than waiting out the real fire-rate timer
        update(0.016);
        if (targets.includes(boulder)) throw new Error('a boulder survived a second hit');
        mouse.leftDown = false;

        // An ore asteroid: guaranteed scrap on destroy, regardless of the normal 50/50 roll.
        startGame('xwing');
        let ore = { type: 'asteroid', x: 500, y: 375, r: 20, xv: 0, yv: 0, angle: 0, rotSpeed: 0, stunned: 0 };
        Object.assign(ore, generateJaggedAsteroid(20));
        ore.isOre = true;
        targets = [ore]; scrapDrops = [];
        ship.x = 500; ship.y = 300; mouse.x = 500; mouse.y = 375; mouse.leftDown = true; fireCooldown = 0; invulnTimer = 0;
        // Ore's small radius means the bullet needs a few frames to actually cross the gap,
        // unlike the point-blank boulder above -- loop until it lands rather than assuming frame 1.
        for (let f = 0; f < 30 && targets.includes(ore); f++) update(0.016);
        mouse.leftDown = false;
        if (targets.includes(ore)) throw new Error('test setup problem: the shot never reached the ore asteroid');
        if (scrapDrops.length === 0) throw new Error('an ore asteroid did not guarantee a scrap drop');
    });

    test('an elite enemy takes two hits and pays out more than the same ship normally would', () => {
        gameDifficulty = 'easy';
        startGame('xwing');
        // Point-blank: ship.r(15) + travel puts the first shot on target within frame 1, so the
        // hp/alive assertions below don't have to guess how many frames a shot takes to arrive.
        let elite = { type: 'tie_fighter', x: 500, y: 340, r: 17.25, xv: 0, yv: 0, angle: 0, rotSpeed: 0, stunned: 0, isElite: true, maxHp: 2, hp: 2 };
        targets = [elite];
        ship.x = 500; ship.y = 300; mouse.x = 500; mouse.y = 340; mouse.leftDown = true; fireCooldown = 0; invulnTimer = 0;
        let scoreBefore = score;
        update(0.016);
        if (!targets.includes(elite)) throw new Error('an elite was destroyed by a single hit');
        if (elite.hp !== 1) throw new Error('elite hp did not decrement on the first hit');
        fireCooldown = 0;
        update(0.016);
        mouse.leftDown = false;
        if (targets.includes(elite)) throw new Error('an elite survived a second hit');
        let eliteGain = score - scoreBefore;
        // A normal tie_fighter of the same difficulty/combo state, for comparison.
        startGame('xwing');
        let normal = { type: 'tie_fighter', x: 500, y: 340, r: 15, xv: 0, yv: 0, angle: 0, rotSpeed: 0, stunned: 0 };
        targets = [normal];
        ship.x = 500; ship.y = 300; mouse.x = 500; mouse.y = 340; mouse.leftDown = true; fireCooldown = 0; invulnTimer = 0;
        scoreBefore = score;
        update(0.016);
        mouse.leftDown = false;
        let normalGain = score - scoreBefore;
        if (eliteGain <= normalGain) throw new Error('elite kill (' + eliteGain + ') did not pay more than a normal kill (' + normalGain + ')');
    });

    test('elites spawn rarely among eligible ship types, sized up and marked in gold', () => {
        gameDifficulty = 'moderate';
        startGame('xwing');
        targets = [];
        for (let i = 0; i < 400; i++) spawnTarget('tie_fighter', 15, 1.0);
        let elites = targets.filter(t => t.isElite);
        if (elites.length === 0) throw new Error('no elites spawned across 400 rolls -- the chance may be broken');
        if (elites.length > 60) throw new Error('elites spawned far too often (' + elites.length + '/400) for a rare variant');
        elites.forEach(e => {
            if (e.hp !== 2 || e.maxHp !== 2) throw new Error('an elite did not get the tougher HP pool');
            if (e.r <= 15) throw new Error('an elite was not sized up from its base radius');
        });
    });

    test('a wounded 2D boss trails escalating sparks and smoke before it ever breaks away', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        targets = [boss];
        // 60% HP: wounded enough to clear both the spark (>12%) and smoke (>30%) thresholds,
        // but safely above the 50% pursuit line so the fight stays in 2D for this assertion.
        boss.hp = Math.ceil(boss.maxHp * 0.6);
        particles = [];
        // Both effects are probabilistic per frame (a few percent chance each), so running a
        // fixed number of frames and hoping is a real, if rare, flake -- confirmed by hand: this
        // exact test failed maybe 1 run in several hundred. Forcing Math.random() to 0 makes
        // every `Math.random() < chance` check trip deterministically instead of leaving it to
        // luck, as long as the underlying chance is genuinely > 0 (which is what's actually being
        // tested here -- that a wounded boss's spawn chance is nonzero, not the exact odds).
        const nativeRandom = Math.random;
        Math.random = () => 0;
        try { for (let f = 0; f < 5; f++) update(0.016); }
        finally { Math.random = nativeRandom; }
        if (bossPursuit) throw new Error('test setup problem: the boss broke away before the assertion ran');
        if (particles.length === 0) throw new Error('a visibly wounded boss produced no damage particles');
        if (!particles.some(p => p.isSmoke)) throw new Error('a heavily-enough-wounded boss never trailed smoke');
    });

    test('Fleet Battle triggers every 6th filler level and never on a boss or hyperspace level', () => {
        gameDifficulty = 'easy';
        startGame('xwing');
        [6, 12, 18, 24, 36, 48].forEach(lvl => {
            level = lvl; startLevel();
            if (!fleetBattleActive) throw new Error('level ' + lvl + ' should have been a Fleet Battle');
        });
        // 30 and 42 are both %6===0 but collide with a boss level (30) or hyperspace (42) --
        // those must win, not the Fleet Battle check.
        [5, 7, 10, 14, 20, 30, 42].forEach(lvl => {
            level = lvl; startLevel();
            if (fleetBattleActive) throw new Error('level ' + lvl + ' should not have been a Fleet Battle');
        });
    });

    test('a Fleet Battle spawns wingmen, background capital ships, and a denser enemy wave', () => {
        gameDifficulty = 'moderate';
        startGame('xwing'); level = 12; startLevel();
        if (allies.length !== 2) throw new Error('expected 2 wingmen, got ' + allies.length);
        if (capitalShips.length !== 2) throw new Error('expected 2 background capital ships, got ' + capitalShips.length);
        if (!capitalShips.some(c => c.side === 'ally') || !capitalShips.some(c => c.side === 'enemy')) throw new Error('capital ships should be one per side');
        if (targets.length < 4) throw new Error('a Fleet Battle should field a real wave, got only ' + targets.length + ' targets');
    });

    test('wingmen engage the nearest enemy and their kills count for the player', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 12; startLevel();
        // Isolate one enemy, park a wingman right next to it, and let it fire without any other
        // targets competing for "nearest enemy."
        let enemy = { type: 'tie_fighter', x: 500, y: 375, r: 15, xv: 0, yv: 0, angle: 0, rotSpeed: 0, stunned: 0 };
        targets = [enemy];
        allies[0].x = 470; allies[0].y = 375; allies[0].fireTimer = 0;
        let scoreBefore = score;
        for (let f = 0; f < 90 && targets.includes(enemy); f++) update(0.016);
        if (targets.includes(enemy)) throw new Error('the wingman never landed a shot on the isolated enemy in 90 frames');
        if (score <= scoreBefore) throw new Error("a wingman's kill did not score for the player");
    });

    test('wingmen take damage from enemy fire and can be lost', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 12; startLevel();
        let ally = allies[0];
        let hpBefore = ally.hp;
        enemyBullets = [{ x: ally.x, y: ally.y, xv: 0, yv: 0, range: 100 }];
        update(0.016);
        if (ally.hp !== hpBefore - 1) throw new Error('a wingman did not take damage from an enemy bullet');
        ally.hp = 1;
        enemyBullets = [{ x: ally.x, y: ally.y, xv: 0, yv: 0, range: 100 }];
        update(0.016);
        if (allies.includes(ally)) throw new Error('a wingman at 0 hp was not removed from the fleet');
    });

    test('Fleet Battle state clears between levels and on quit', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 12; startLevel();
        if (!fleetBattleActive || allies.length === 0) throw new Error('test setup problem: the Fleet Battle never engaged');
        level = 13; startLevel();   // an ordinary filler level
        if (fleetBattleActive) throw new Error('fleetBattleActive leaked into a non-Fleet-Battle level');
        if (allies.length !== 0 || capitalShips.length !== 0) throw new Error('wingmen/capital ships leaked into the next level');
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
        // Point-blank and invulnerable: this test is about the hit -> threshold -> pursuit
        // pipeline, not about realistic aim under fire (covered elsewhere). A shot fired from
        // 120px away still needs several frames to travel there, and re-aiming every frame only
        // fixes the *angle* -- the bullet's own trajectory is still fixed at the moment it's
        // fired, so it can still miss a boss that drifts (even at the dreadnought's own slow
        // velocity) during that flight window. That's what was still flaking here. Firing from
        // point-blank range removes the multi-frame-travel dependency entirely instead of
        // continuing to patch around it, and invulnTimer keeps contact-ram damage at this range
        // from interfering with the outcome.
        ship.x = boss.x - 40; ship.y = boss.y; mouse.x = boss.x; mouse.y = boss.y;
        mouse.leftDown = true; fireCooldown = 0; invulnTimer = 999;
        for (let f = 0; f < 30 && !bossPursuit; f++) { mouse.x = boss.x; mouse.y = boss.y; update(0.016); }
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
        // Average brightness over a patch of open sky rather than trusting a single pixel -- by
        // this point in the suite the starfield has been advanced by every earlier test that
        // called update3D, so a 1x1 sample can land squarely on one bright star by pure chance
        // and fail a scene that is, on the whole, exactly as dark as it should be. Averaging a
        // region is robust to any one star while still catching a genuine backdrop-wide wash.
        // Centered horizontally and sitting between the HUD banner and the reticle -- clear of
        // the cockpit's corner status-lamp panels and canopy rail, which are legitimately a
        // lighter metal grey and previously dragged a corner sample's average up.
        let block = ctx.getImageData(Math.round(canvas.width * 0.42), Math.round(canvas.height * 0.22), Math.round(canvas.width * 0.16), Math.round(canvas.height * 0.12)).data;
        let total = 0, pixelCount = block.length / 4;
        for (let i = 0; i < block.length; i += 4) total += (block[i] + block[i+1] + block[i+2]) / 3;
        let avgBrightness = total / pixelCount;
        if (avgBrightness > 25) throw new Error('background is too bright for deep space: avg ' + avgBrightness.toFixed(1));
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

    test('a non-lethal hit on the pursuit boss spawns a small impact burst', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        targets = [boss]; beginBossPursuit(boss);
        let b3 = targets3D.find(t => t.isBoss);
        b3.hp = 999;   // stays alive so this is unambiguously the non-lethal path
        bossEffects3D = [];
        bullets3D.push({ x: b3.x, y: b3.y, z: b3.z, vx: 0, vy: 0, vz: 0, r: 5, color: '#fff' });
        update3D(0.016);
        if (b3.hp === 999) throw new Error('the test bullet never actually hit the boss');
        let kinds = new Set(bossEffects3D.map(e => e.kind));
        if (!kinds.has('spark')) throw new Error('a hit produced no impact sparks');
        if (!kinds.has('flash')) throw new Error('a hit produced no impact flash');
        if (kinds.has('smoke')) throw new Error('a non-lethal hit should not leave a smoke cloud -- that is reserved for the kill');
    });

    test('killing the pursuit boss produces a bigger, staggered explosion than a normal hit', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 20; startLevel();
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        targets = [boss]; beginBossPursuit(boss);
        let b3 = targets3D.find(t => t.isBoss);
        b3.hp = 1;
        bossEffects3D = [];
        bullets3D.push({ x: b3.x, y: b3.y, z: b3.z, vx: 0, vy: 0, vz: 0, r: 5, color: '#fff' });
        update3D(0.016);
        let kinds = new Set(bossEffects3D.map(e => e.kind));
        if (!kinds.has('spark') || !kinds.has('flash') || !kinds.has('smoke')) throw new Error('the kill explosion is missing a stage: ' + [...kinds].join(','));
        let flashes = bossEffects3D.filter(e => e.kind === 'flash');
        if (flashes.length < 2) throw new Error('expected multiple staggered flashes for a chained explosion, got ' + flashes.length);
        if (new Set(flashes.map(f => f.delay || 0)).size < 2) throw new Error('flashes are not actually staggered -- they all ignite at once');
        if (bossEffects3D.filter(e => e.kind === 'spark').length < 15) throw new Error('the kill spark burst should be much larger than a routine hit');
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
        // The kill lands within a few frames, but bossPursuit stays true through a ~1.3s death
        // timer so the explosion has time to play before the level advances -- see bossDeathTimer.
        for (let f = 0; f < 10; f++) update3D(0.016);
        if (lifetimeStats.bossKills <= kills) throw new Error('pursuit kill did not count as a boss kill');
        if (!bossPursuit) throw new Error('pursuit ended before the death-timer delay elapsed');
        for (let f = 0; f < 150 && bossPursuit; f++) update3D(0.016);
        if (bossPursuit) throw new Error('pursuit did not end once the death timer ran out');
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

    test('a thrown error mid-layout does not leave the Daily Challenge seed stuck on Math.random', () => {
        gameDifficulty = 'moderate';
        startGame('xwing', 'daily');
        const nativeRandom = Math.random;
        const realSpawnTarget = spawnTarget;
        let capturedDuringSeededWindow = null;
        spawnTarget = () => {
            capturedDuringSeededWindow = Math.random;   // confirm this really runs inside the swap
            throw new Error('forced failure to test RNG restoration');
        };
        let threw = false;
        try { level = 3; startLevel(); } catch (e) { threw = true; }
        finally { spawnTarget = realSpawnTarget; }
        if (!threw) throw new Error('test setup problem: the forced failure never happened');
        if (capturedDuringSeededWindow === nativeRandom) throw new Error('test did not exercise the seeded path -- spawnTarget ran before the RNG swap');
        // The real assertion: even though a spawn call threw partway through, Math.random must
        // still get restored (via startLevel's try/finally) rather than staying pinned to the
        // seeded generator for every random draw for the rest of the session.
        if (Math.random !== nativeRandom) throw new Error('Math.random was left pinned to the seeded generator after a thrown error');
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
