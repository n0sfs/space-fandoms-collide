# Space Fandoms Collide 🌌

A zero-dependency, pure HTML5 Canvas space survival shooter. Dodge asteroids, battle multi-stage bosses, and pilot 14 iconic ships from your favorite sci-fi universes in an endless arcade-style wave survival game.

Play the live demo here: **https://n0sfs.github.io/space-fandoms-collide/**

## 🚀 Features
* **14 Unique Ships:** Pilot everything from an X-Wing and the Millennium Falcon to the TARDIS, the Nebuchadnezzar, and a glitching fsociety terminal.
* **Custom Flight & Weapon Physics:** Every ship has unique stats (Thrust, Friction, Fire Rate) and weapons (e.g., EMP blasts, shotgun lasers, light ribbons, and quad-blasters).
* **Four Difficulty Tiers:** Easy, Moderate, Hard, and Insane dynamically scale enemy speed, spawn rates, and boss health — Insane also boosts your score multiplier for the extra risk.
* **Seven Bosses on a Fair Rotation:** Every 5th level is a boss, drawn from an explicit rotation so no encounter gets starved — the Superlaser Station (L5), the shielded Mothership (L10), the Sentinel Swarm (L15, arriving in waves rather than all at once), the Dreadnought (L20), the Hive Swarm (L25 — dozens of linked minions orbiting a queen who enrages the survivors when she falls), the Boss Carrier (L30, which launches wings of interceptors instead of fighting directly), and the Space Worm (L40).
* **The Space Worm:** A massive segmented boss that burrows on a cycle — submerged it is untouchable and harmless, but the disturbance it drags along the surface telegraphs exactly where it will erupt. Its whole body is solid, so the fight is threading the gaps in a moving wall; only the head can be damaged.
* **Mid-Run Upgrades:** Clearing a boss deals you three upgrade cards — extra hull, faster coils, focused emitters, a scrap magnet, a spare airframe and more. Pick with `1`/`2`/`3` or a tap. They stack across a run and reset with it, so no two runs build the same way.
* **Boss Rush:** Unlocked by beating level 26 — every boss, back to back, no filler levels and no hyperspace, at a 1.3× score premium. Your best score and deepest wave are tracked on the Pilot Record.
* **Daily Challenge:** A date-seeded run, so every pilot in the world gets the same level layouts today. Your best result for the day is saved per pilot.
* **Close Calls:** Threading an enemy shot scores and extends your combo, so dodging is worth as much as shooting. Counted on the game-over summary.
* **Hulls That Trade, Not Just Differ:** Ship speed is rated on real terminal velocity rather than raw thrust (friction dominates the flight model), and slow hulls like the Borg Cube get proportional damage resistance and shield regeneration in exchange — low speed is a playstyle, not a trap.
* **Hostile AI:** Dodge tracking fire from TIE Advanced fighters and homing Sentinels, whose chase speed is capped against whatever hull you picked so disengaging is always possible.
* **Two-Phase Boss Fights:** Wound a boss past half health and it breaks for a nearby asteroid field. You follow it into the cockpit and finish the fight in 3D, its damage carried across — dodging rocks and escort fighters while it holds a firing distance and weaves, trailing smoke and embers the closer it gets to dying. It's lit from a fixed direction with a hard rim light and a contact-shadow halo, rather than the flat self-lit look every other hull gets, so it reads as an actual mass rather than a sprite. The swarm bosses have no single thing to chase, so they stay a 2D fight start to finish.
* **The Cockpit:** A real canopy rather than a border — the airframe is filled in around a shaped opening with chamfered A-pillars, a centre spine, an arched glass rail and a wraparound instrument coaming, so the wraparound only eats the corners and the middle of the view stays clear. Roof panels carry status lamps and toggle switches; the dash has live shield/heat gauges, hull and combo LED meters, and a hub ring that shows the anomaly countdown or the boss's remaining health. The HUD — boresight, pitch ladder, drift indicator, target banner — is projected on the glass.
* **Hyperspace Anomalies:** Every 7th level drops you into that cockpit for a rail-shooter round: evade and survive against the clock.
* **Retro 8-Bit Audio:** A custom JavaScript audio synthesizer dynamically generates all sound effects (lasers, explosions, powerups, achievement fanfares) without needing external audio files.
* **Responsive Touch Controls:** Automatically detects mobile devices and renders an on-screen joystick, fire button, and nuke detonator.
* **Ship Builder (unlocked at Level 20):** Design your own ship — pick a hull silhouette, hull and laser colors, and allocate a 9-point budget across Speed, Fire Rate, and Power. It's saved locally and flies alongside the 14 stock ships in the selector.
* **Achievements & Pilot Record:** 12 unlockable milestones spanning progression, combat, and skill, each popping a toast with its own fanfare. A Pilot Record panel tracks lifetime stats — games played, kills, bosses defeated, hyperspace anomalies cleared, and more.
* **Cosmetic Engine Trails:** Unlock and equip colored engine trails (Gold Rush, Hive Violet, Inferno, and a Rainbow trail for the toughest achievement) as a visible reward for your progress.
* **Party Mode:** A rare powerup turns your bullets rainbow, pulses your ship, washes the screen in color, and grants a temporary rapid-fire bonus — pure chaos, on purpose.
* **Pilot Profiles:** Separate save slots for separate pilots — scrap, upgrades, achievements, custom ships, and stats never mix between siblings sharing a computer. Switch, create, or delete profiles from the main menu; your original save becomes "Pilot 1" automatically.
* **Dimensional Shading:** Every ship, enemy, asteroid, and satellite carries richer gradient shading, rim lighting, and specular highlights for a more three-dimensional look, and the ship selector shows at-a-glance Speed/Fire Rate bars for every ship.
* **Settings:** A volume slider (separate from mute) and a one-click "Reset Progress" for a fresh start.

## 🕹️ Flight Manual
**Desktop:**
* **Aim:** Mouse 
* **Thrust:** Right-Click or `W` / `ArrowUp`
* **Fire:** Left-Click or `Space`
* **Screen Nuke:** `B`
* **Pause:** `P`
* **Pick an upgrade (after a boss):** `1` / `2` / `3`

**Mobile/Tablet:**
* Use the on-screen left joystick to aim and thrust.
* Tap the right-side buttons to fire and deploy logic bombs.

## 🛠️ Local Development
No build tools, package managers, or local servers are required. Simply clone the repository and open `index.html` in any modern web browser.

## ✅ Testing
An opt-in self-test harness ships alongside the game: open `index.html?test=1` in a browser to run ~91 automated checks (rendering, the full difficulty/level sweep, boss rotation fairness, the perk system, Boss Rush and Daily Challenge determinism, achievement unlock paths, profile isolation, and more) and see a visual pass/fail report. It only loads with that query flag, so it has zero effect on normal play, and every destructive check runs under a disposable pilot profile that's deleted when the run finishes.

## ⚖️ Disclaimer & Copyright
**Space Fandoms Collide** is a free, non-commercial fan tribute built for educational and portfolio purposes. 

All trademarks, franchise names, character names, and ship likenesses belong to their respective owners (including but not limited to Lucasfilm/Disney, Paramount Global, BBC, Warner Bros. Discovery, and Marvel). No copyright or trademark infringement is intended. 

The underlying gameplay code and engine logic are open-sourced under the MIT License.