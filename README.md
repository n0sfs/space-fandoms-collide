# Space Fandoms Collide 🌌

A zero-dependency, pure HTML5 Canvas space survival shooter. Dodge asteroids, battle multi-stage bosses, and pilot 14 iconic ships from your favorite sci-fi universes in an endless arcade-style wave survival game.

Play the live demo here: **https://n0sfs.github.io/space-fandoms-collide/**

## 🚀 Features
* **14 Unique Ships:** Pilot everything from an X-Wing and the Millennium Falcon to the TARDIS, the Nebuchadnezzar, and a glitching fsociety terminal.
* **Custom Flight & Weapon Physics:** Every ship has unique stats (Thrust, Friction, Fire Rate) and weapons (e.g., EMP blasts, shotgun lasers, light ribbons, and quad-blasters).
* **Four Difficulty Tiers:** Easy, Moderate, Hard, and Insane dynamically scale enemy speed, spawn rates, and boss health — Insane also boosts your score multiplier for the extra risk.
* **Hostile AI & Multi-Stage Bosses:** Dodge hostile tracking fire from TIE Advanced fighters, survive the Level 15 Sentinel Swarm, take down shielded Motherships and Superlasers, break a coordinated Hive Swarm (a boss made of dozens of linked minions orbiting a queen who enrages the survivors when she falls), and outrun a Boss Carrier that launches wings of interceptors instead of fighting directly.
* **Hyperspace Anomalies:** Every 7th level drops you into a first-person cockpit rail-shooter — full-canvas view, a physical instrument dash with live shield/heat/hull/combo gauges and an anomaly-countdown ring, evade-and-survive against the clock.
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

**Mobile/Tablet:**
* Use the on-screen left joystick to aim and thrust.
* Tap the right-side buttons to fire and deploy logic bombs.

## 🛠️ Local Development
No build tools, package managers, or local servers are required. Simply clone the repository and open `index.html` in any modern web browser.

## ✅ Testing
An opt-in self-test harness ships alongside the game: open `index.html?test=1` in a browser to run ~62 automated checks (rendering, the full difficulty/level sweep, boss and achievement unlock paths, profile isolation, and more) and see a visual pass/fail report. It only loads with that query flag, so it has zero effect on normal play, and every destructive check runs under a disposable pilot profile that's deleted when the run finishes.

## ⚖️ Disclaimer & Copyright
**Space Fandoms Collide** is a free, non-commercial fan tribute built for educational and portfolio purposes. 

All trademarks, franchise names, character names, and ship likenesses belong to their respective owners (including but not limited to Lucasfilm/Disney, Paramount Global, BBC, Warner Bros. Discovery, and Marvel). No copyright or trademark infringement is intended. 

The underlying gameplay code and engine logic are open-sourced under the MIT License.