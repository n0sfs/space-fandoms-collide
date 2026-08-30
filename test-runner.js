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
        [1, 5, 7, 10, 14, 15, 20, 21, 25, 26, 55].forEach(lvl => {
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
        startGame('xwing'); level = 55; startLevel(); // level 55: boss_carrier, no shield nodes to fight through
        let boss = targets.find(t => t.type && t.type.startsWith('boss'));
        if (!boss) throw new Error('no boss spawned at level 55');
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

    test('boss carrier spawns at level 55 and launches interceptors', () => {
        gameDifficulty = 'easy';
        startGame('xwing'); level = 55; startLevel();
        let boss = targets.find(t => t.type === 'boss_carrier');
        if (!boss) throw new Error('boss_carrier did not spawn');
        boss.launchTimer = 0.001;
        let before = targets.length;
        for (let f = 0; f < 10; f++) update(0.016);
        if (targets.length <= before) throw new Error('carrier did not launch fighters');
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

    test('ship select dropdown renders all 14 ships with stat bars', () => {
        rebuildShipDropdown();
        let rows = document.querySelectorAll('.ship-option');
        if (rows.length !== 14) throw new Error('expected 14 ship options, found ' + rows.length);
        let missingBars = Array.from(rows).some(r => r.querySelectorAll('.ship-stat-dot').length !== 10);
        if (missingBars) throw new Error('one or more ship options is missing its stat bars');
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
