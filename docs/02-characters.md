# 02 — Categories & Character Database (Draft)

## 1. How the categories were chosen

Requirements: 10 categories that (a) each contain **12+ viable characters** so 6-player
games never strain the pool, (b) don't overlap (every character belongs to **exactly one**
category), (c) mix "power" categories with charm/comedy categories, and (d) each support
sleepers and traps for the hidden-score game.

The obvious candidate list (Captains, Swordsmen, Cooks, Doctors, Navigators, Snipers,
Marines, Warlords, Revolutionaries) has two structural problems the brief anticipates:

- **Warlords/Emperors/Supernovas overlap massively with Captains and Swordsmen**
  (Mihawk, Law, Hancock, Buggy, Crocodile, Doflamingo would each fit 2–3 categories).
  → Solved by dissolving "Warlords" and assigning each such character to their most
  iconic *role* (Mihawk → Schwertkämpfer, Hancock → Kapitäne, Doflamingo → Schurken…).
- **Navigators, Snipers and Musicians are individually far too thin** (Nami + Bepo is not
  a category). → Merged into one deep, beloved category: **Crew-Spezialisten**
  (navigators, snipers, scholars, shipwrights, musicians — the "nakama" roles).

### The 10 categories

| # | Category (DE) | English | Flavor | Pool |
| --- | --- | --- | --- | --- |
| 1 | **Legendäre Kapitäne** | Captains | The crown of every team. Always played first. | 16 |
| 2 | **Rechte Hände & Kommandanten** | First mates & commanders | The loyal monsters beside the throne | 15 |
| 3 | **Schwertkämpfer** | Swordsmen | Blade duels, biggest fan-favorite fights | 13 |
| 4 | **Marines** | Marines | Admirals, heroes and one very useless lieutenant | 15 |
| 5 | **Crew-Spezialisten** | Crew specialists | Navigators, snipers, scholars, shipwrights, musicians | 15 |
| 6 | **Köche** | Cooks | One superstar, lots of comedy — pure auction drama | 12 |
| 7 | **Ärzte & Heiler** | Doctors & healers | Surgeon of Death vs. a tiny reindeer | 12 |
| 8 | **Agenten & Attentäter** | Agents & assassins | CP9/CP0/Baroque Works — betrayal energy | 14 |
| 9 | **Revolutionäre** | Revolutionaries | Dragon's shadow army | 12 |
| 10 | **Königshäuser & Adel** | Royals & nobles | Princesses, kings — and two Ancient Weapons hiding in plain sight | 14 |

Total pool: **138 characters** — enough that two games rarely feel alike.

## 2. Score design rules

- Starting bid (40M–150M, steps of 5M) = *perceived* value → drives auction heat.
- Hidden score (0–100) = *actual* value **within the category** (a top cook scores like a
  top captain — categories are worth equal points).
- Bid↔score correlation ≈ 0.8 overall, but every category ships **2–3 sleepers** 💎
  (cheap, surprisingly high score — justified by lore: loyalty, potential, hidden power)
  and **1–3 traps** 💀 (famous or flashy, terrible score — justified by lore: fraud,
  incompetence, all bark).
- Scores are balanced so a full-sleeper bargain team can genuinely beat a full-star team
  that overpaid — but knowledge + economy should win more often than pure luck.
- All numbers below are a **researched draft**; final tuning happens against the
  simulation harness (doc 01 §7). Perfect-play total ceiling ≈ 950; a realistic winning
  team lands around 780–850.

## 3. Database draft

Legend: 💎 sleeper · 💀 trap · bids in millions of Berry.

### 1. Legendäre Kapitäne

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Gol D. Roger | 150 | 97 | The Pirate King. The benchmark. |
| Edward Newgate (Whitebeard) | 145 | 95 | Strongest man in the world |
| Monkey D. Luffy | 140 | 96 | Sun God Nika, Emperor |
| Shanks | 140 | 93 | Emperor, ultimate Haki |
| Rocks D. Xebec | 135 | 90 | Legendary, but barely documented |
| Marshall D. Teach (Blackbeard) | 125 | 89 | Two Devil Fruits |
| Kaido | 130 | 91 | "Strongest creature" |
| Charlotte Linlin (Big Mom) | 120 | 86 | Emperor |
| Boa Hancock | 90 | 79 | Pirate Empress |
| Trafalgar Law → *see Ärzte* | — | — | Assigned to Ärzte & Heiler (Surgeon of Death) |
| Eustass Kid | 60 | 68 | Awakened, but keeps losing |
| Jewelry Bonney | 50 | 58 | 💎 Age fruit + Vegapunk connection |
| Buggy | 45 | 62 | 💎 Emperor by pure accident — lore-accurate comedy value |
| Capone Bege | 50 | 55 | Castle body, tactician |
| Bartolomeo | 45 | 48 | Barrier fandom |
| Cavendish | 45 | 46 | Hakuba is scary, Cavendish is not |
| Alvida | 40 | 18 | 💀 Iron mace, zero relevance |

### 2. Rechte Hände & Kommandanten

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Silvers Rayleigh | 135 | 94 | The Dark King |
| Charlotte Katakuri | 120 | 90 | Future sight, unbeaten aura |
| Ben Beckman | 110 | 85 | Made Kizaru flinch |
| Portgas D. Ace | 110 | 87 | Beloved, Flame fruit |
| King | 100 | 83 | Lunarian |
| Yamato | 100 | 84 | Oden's heir |
| Marco → *see Ärzte* | — | — | Assigned to Ärzte & Heiler (Phoenix healer) |
| Queen | 80 | 70 | Cyborg plague scientist |
| Charlotte Cracker | 70 | 66 | Biscuit army |
| Jozu | 65 | 64 | Diamond defense |
| Killer | 60 | 63 | 💎 Underrated duelist |
| Charlotte Smoothie | 65 | 52 | 💀 Sweet Commander who never fights |
| Charlotte Perospero | 60 | 61 | Candy utility |
| Jack | 60 | 45 | 💀 Loses every fight he starts |
| Lucky Roux | 55 | 65 | 💎 Yonko crew mystery power |
| Jesus Burgess | 50 | 42 | Champion of nothing |

### 3. Schwertkämpfer

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Dracule Mihawk | 145 | 96 | World's strongest swordsman |
| Roronoa Zoro | 140 | 94 | King of Hell |
| Ryuma | 105 | 84 | Legendary dragon-slayer |
| Shiryu | 95 | 78 | Invisible blade |
| Vista | 80 | 72 | Traded blows with Mihawk |
| Denjiro | 80 | 73 | Oden's finest student |
| Ashura Doji | 75 | 70 | Kuri's demon |
| Kin'emon | 65 | 60 | Foxfire style + comedy |
| O-Kiku | 55 | 54 | Graceful blade |
| Hyogoro | 50 | 66 | 💎 Tiny old man, master of Ryuo |
| Koushirou | 50 | 58 | 💎 Taught Zoro; "blade that cuts nothing" |
| Tashigi | 50 | 46 | Always one step behind |
| Cabaji | 40 | 12 | 💀 Circus acrobat with a sword |

### 4. Marines

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Monkey D. Garp | 140 | 95 | The Hero. Fist of Love. |
| Sakazuki (Akainu) | 135 | 91 | Fleet Admiral, magma |
| Sengoku | 125 | 88 | The Buddha |
| Kuzan (Aokiji) | 125 | 89 | Ice age |
| Borsalino (Kizaru) | 120 | 86 | Light speed |
| Issho (Fujitora) | 110 | 84 | Blind gravity admiral |
| Aramaki (Ryokugyu) | 105 | 78 | Forest admiral |
| Kong | 95 | 74 | Commander-in-chief, past prime |
| Smoker | 70 | 66 | Eternal rival |
| Tsuru | 65 | 68 | 💎 The strategist who "cleans up" |
| X Drake | 60 | 58 | Dino double agent |
| Koby | 45 | 70 | 💎 Future hero of the Marines |
| Sentomaru | 55 | 50 | Axe + Pacifista command |
| Hina | 50 | 48 | Black Cage |
| Helmeppo | 40 | 15 | 💀 Kept for the memes |

### 5. Crew-Spezialisten

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Nico Robin | 100 | 88 | Only reader of the Poneglyphs |
| Jinbe | 105 | 86 | First Son of the Sea, helmsman |
| Nami | 90 | 85 | Best navigator alive |
| Yasopp | 85 | 78 | Yonko crew sniper |
| Franky | 75 | 76 | Shipwright of the Sunny |
| Usopp | 65 | 74 | 💎 Observation Haki awakened, God Usopp |
| Brook | 70 | 70 | Soul King, musician-swordsman |
| Van Augur | 70 | 66 | Teleport sniper |
| Uta | 65 | 64 | World's diva |
| Tom | 60 | 65 | Built the Oro Jackson |
| Izo | 55 | 56 | Whitebeard's gunslinger |
| Iceburg | 55 | 54 | Water 7 mayor & shipwright |
| Pedro | 50 | 52 | The torch of Zou |
| Bepo | 45 | 44 | Navigator. Bear. Sorry. |
| Scratchmen Apoo | 50 | 38 | 💀 Sells everyone out |

### 6. Köche

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Vinsmoke Sanji | 135 | 95 | The prize. Every game's bidding war. |
| Zeff | 90 | 80 | Red Foot, feeds the ocean |
| Streusen | 70 | 68 | Made a castle edible |
| Charlotte Pudding | 65 | 62 | Three eyes, memory chef |
| Cosette | 45 | 52 | 💎 Germa's honest cook |
| Terracotta | 45 | 44 | Alabasta's head chef |
| Patty | 40 | 32 | Baratie muscle |
| Carne | 40 | 30 | Baratie muscle #2 |
| Charlotte Chiffon | 50 | 55 | 💎 Cake savior of Totto Land |
| Buchi | 40 | 20 | Black Cat "cook" |
| Wanze | 40 | 8 | 💀 Ramen Kenpo. Legendarily gross. |
| Charlotte Opera | 40 | 25 | Cream, misplaced confidence |

### 7. Ärzte & Heiler

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Trafalgar Law | 125 | 92 | Surgeon of Death — the category king |
| Marco | 115 | 89 | Phoenix flames heal a whole crew |
| Tony Tony Chopper | 85 | 87 | 💎 Cures the incurable; monster point |
| Kureha | 70 | 76 | 140 years of medicine |
| Crocus | 60 | 70 | Roger's doctor, kept him alive |
| Mansherry | 50 | 72 | 💎 Heal-heal fruit, literal miracle |
| Hogback | 55 | 48 | Genius, but evil and useless |
| Doc Q | 45 | 40 | The sick doctor |
| Aladine | 50 | 54 | Sun Pirates' doctor |
| Muret | 40 | 35 | Sphinx village medic |
| Nako | 40 | 26 | Grumpy island doctor |
| Fishbonen | 40 | 18 | 💀 Thriller Bark quack |

### 8. Agenten & Attentäter

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Rob Lucci | 120 | 88 | CP0's killing machine |
| Stussy | 80 | 74 | Vegapunk clone, double agent |
| Kaku | 80 | 72 | Giraffe. Still deadly. |
| Corazon | 70 | 76 | 💎 Silent hero, saved Law |
| Vergo | 65 | 60 | Bamboo demon |
| Jabra | 65 | 58 | Wolf CP9 |
| Bon Clay | 55 | 70 | 💎 Loyalty beyond death — Okama Kenpo |
| Daz Bones (Mr. 1) | 60 | 56 | Full-body blade |
| Blueno | 55 | 50 | Door fruit utility |
| Kalifa | 50 | 46 | Bubble assassin |
| Mr. 3 (Galdino) | 45 | 52 | 💎 Clutch wax saves at Marineford |
| Miss Doublefinger | 45 | 40 | Spike spike |
| Miss Goldenweek | 40 | 28 | Paint psychology |
| Spandam | 40 | 3 | 💀 The ultimate trap. Elephant sword. |

### 9. Revolutionäre

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Monkey D. Dragon | 145 | 93 | World's most wanted man |
| Sabo | 115 | 88 | No. 2, Flame fruit heir |
| Bartholomew Kuma | 90 | 80 | Paw-paw tragedy cyborg |
| Emporio Ivankov | 80 | 74 | Miracle hormones |
| Belo Betty | 60 | 64 | Buffs an entire army |
| Karasu | 60 | 60 | Crow commander |
| Morley | 55 | 56 | Giant tunneler |
| Lindbergh | 50 | 54 | Inventor commander |
| Koala | 50 | 58 | 💎 Fishman Karate instructor |
| Hack | 45 | 44 | Solid fishman fighter |
| Inazuma | 50 | 48 | Scissors for terrain control |
| Bunny Joe | 40 | 22 | 💀 Name recognition: zero |

### 10. Königshäuser & Adel

| Character | Bid | Score | Note |
| --- | --- | --- | --- |
| Nefertari Vivi | 75 | 78 | Princess, secret D., nakama |
| Shirahoshi | 65 | 85 | 💎 She *is* the Ancient Weapon Poseidon |
| Momonosuke | 55 | 72 | 💎 Shogun + dragon + Voice of All Things |
| Neptune | 60 | 60 | Great Knight of the Sea |
| Riku Doldo III | 50 | 54 | The king worth bleeding for |
| Dalton | 50 | 52 | Bison loyalty |
| Elizabello II | 50 | 62 | 💎 The King Punch is real |
| Cobra | 45 | 48 | Died for the truth |
| Viola | 50 | 50 | All-seeing eyes |
| Hiyori | 45 | 46 | Wano's moon princess |
| Rebecca | 45 | 42 | Undefeated by dodging |
| Kinderella | 40 | 24 | Married into it |
| Wapol → *see note* | 45 | 20 | 💀 Ex-king, tin tyrant (assigned here, not Schurken) |
| Sterry | 40 | 5 | 💀 Goa's pathetic king — pure comedy |

## 4. Assignment rules (no duplicates)

Each character exists exactly once. Cross-category celebrities are pinned to their most
iconic role and the pool notes it, e.g.: Mihawk/Zoro → Schwertkämpfer (not
Warlords/Commanders), Law & Marco → Ärzte (their category-defining draft picks),
Hancock/Buggy → Kapitäne, Sanji → Köche, Jinbe/Robin/Nami → Crew-Spezialisten,
Kuma/Sabo → Revolutionäre, Lucci → Agenten. A `category` field on the character record
enforces this; the build fails on duplicate IDs.

Deliberately cut from v1 to avoid overlap headaches: a separate Schurken/Villains
category (Doflamingo, Crocodile, Enel, Magellan …). It's the strongest candidate for the
**11th-category variant** or a future "villains draft" game mode — noted in the roadmap
as an easy content patch, since dropping them in requires only data.

## 5. Data shape

```jsonc
// packages/shared/src/themes/one-piece/characters.json (server-only scores split out)
{
  "id": "gol-d-roger",
  "name": "Gol D. Roger",
  "epithet": "König der Piraten",
  "category": "captains",
  "startingBid": 150_000_000,
  "hiddenScore": 97,            // stripped from every client payload until final reveal
  "image": { "url": "<remote-url>", "local": "assets/characters/gol-d-roger.webp" },
  "flavor": "Der einzige Mann, der die Grand Line bezwang."
}
```

Image handling per the brief (§22): the `image` field separates a remote URL from an
optional local override; a build-time script can bulk-download and rewrite to local
assets. Game logic never touches image data. Missing/broken images fall back to a styled
silhouette card with the character's initial — the game must never look broken because a
hotlink died.
