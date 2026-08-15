/**
 * Generates the Pokémon theme's character database.
 *
 *   npx tsx tools/generate-pokemon-theme.ts
 *
 * Sprite ids and generations are resolved from the PokéAPI data dumps cached in
 * tools/data/, so regenerating is deterministic and works offline. The curated
 * lists below are the actual design work - which Pokémon belong in a category,
 * what they cost, and what they are secretly worth.
 *
 * Rules that shaped the lists:
 *   - always the FINAL evolution of a line
 *   - the Mega category holds only mega forms (their own species ids)
 *   - the Shiny category holds shiny artwork, keyed under its own id so a
 *     Pokémon can appear once as itself and once as its shiny
 *   - no Pokémon may sit in two categories (the engine enforces this)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** identifier, starting bid in millions, hidden score, flavour. */
type Entry = [string, number, number, string];

const STARTER: Entry[] = [
  ['charizard', 145, 92, 'Das Gesicht einer ganzen Generation.'],
  ['greninja', 135, 90, 'Ninja-Frosch mit Protean und Kultstatus.'],
  ['blaziken', 125, 88, 'Erster Feuer/Kampf-Starter - und bis heute der stärkste.'],
  ['infernape', 115, 85, 'Schnell, wuchtig, kompromisslos offensiv.'],
  ['swampert', 110, 86, 'Nur eine einzige Schwäche. Bollwerk pur.'],
  ['venusaur', 105, 78, 'Der geduldige Klassiker mit Fluchtsamen.'],
  ['blastoise', 105, 76, 'Zwei Kanonen, eine Legende.'],
  ['typhlosion', 95, 74, 'Vulkanausbruch auf vier Beinen.'],
  ['sceptile', 95, 77, 'Der schnellste Grasstarter überhaupt.'],
  ['decidueye', 90, 75, 'Geisterbogen mit Präzisionsschuss.'],
  ['primarina', 90, 79, 'Operngesang, der Wellen zum Explodieren bringt.'],
  ['incineroar', 85, 72, 'Wrestler mit Attitüde - polarisiert bis heute.'],
  ['feraligatr', 85, 71, 'Beißt zu, bevor du blinzelst.'],
  ['empoleon', 80, 73, 'Kaiserpinguin mit einzigartigem Typenmix.'],
  ['torterra', 75, 66, 'Wandelnder Kontinent, leider zu langsam.'],
  ['serperior', 75, 74, 'Kontermagie macht die Schlange zur Falle.'],
  ['samurott', 70, 62, 'Seesamurai, der nie ganz durchstartete.'],
  ['chesnaught', 70, 64, 'Panzerritter mit Dornen.'],
  ['delphox', 70, 63, 'Zauberstab-Fuchs mit Stil.'],
  ['emboar', 65, 55, 'Viel Kraft, viel zu langsam.'],
  ['meganium', 55, 42, 'Das freundlichste Pokémon - und leider das schwächste Starter-Finale.'],
];

const FOSSIL: Entry[] = [
  ['aerodactyl', 125, 84, 'Urzeit-Raubvogel, schneller als alles in Kanto.'],
  ['tyrantrum', 120, 86, 'Ein T-Rex mit Kieferkraft-Fähigkeit.'],
  ['kabutops', 105, 78, 'Sensen statt Arme.'],
  ['omastar', 100, 76, 'Der Panzer, der ganze Teams aufstaute.'],
  ['archeops', 95, 72, 'Brutale Werte - mit einer katastrophalen Fähigkeit.'],
  ['rampardos', 90, 74, 'Höchster Angriffswert unter allen Fossilien.'],
  ['carracosta', 80, 68, 'Solide Schale, solider Schaden.'],
  ['armaldo', 75, 66, 'Uralter Krieger in Rüstung.'],
  ['aurorus', 70, 58, 'Wunderschön, riesig - und viel zu zerbrechlich.'],
  ['cradily', 65, 60, 'Klammert sich fest und lässt nicht mehr los.'],
  ['bastiodon', 55, 45, 'Eine Wand. Mehr aber auch nicht.'],
];

const PSEUDO: Entry[] = [
  ['garchomp', 150, 95, 'Der Landhai. Jahrelang das Maß aller Dinge.'],
  ['dragonite', 140, 90, 'Der erste Pseudo - und immer noch gefürchtet.'],
  ['tyranitar', 140, 92, 'Bringt seinen eigenen Sandsturm mit.'],
  ['metagross', 130, 89, 'Vier Gehirne, ein Ziel.'],
  ['salamence', 130, 88, 'Der Traum vom Fliegen, brutal umgesetzt.'],
  ['hydreigon', 120, 85, 'Drei Köpfe, kein Mitleid.'],
  ['kommo-o', 95, 76, 'Schuppenrüstung mit Trommelwirbel.'],
  ['goodra', 85, 70, 'Der freundlichste Drache - und der weichste.'],
];

const EEVEELUTION: Entry[] = [
  ['umbreon', 120, 88, 'Der Fan-Liebling schlechthin. Unkaputtbar.'],
  ['sylveon', 115, 86, 'Feen-Charme mit tödlichem Hyperstimme.'],
  ['espeon', 110, 84, 'Psycho-Eleganz mit Magieschild.'],
  ['vaporeon', 100, 80, 'Absurde Ausdauer, absurd beliebt.'],
  ['jolteon', 95, 78, 'Blitzschnell und stachelig.'],
  ['leafeon', 70, 60, 'Hübsch, aber im Kampf selten zu sehen.'],
  ['glaceon', 70, 62, 'Eiskalte Schönheit mit Spezialangriff.'],
  ['flareon', 55, 40, 'Riesiger Angriff - und fast keine physische Feuerattacke. Die Tragödie.'],
];

const PET: Entry[] = [
  ['arcanine', 120, 84, 'Das legendäre Hundepokémon. Schnell und loyal.'],
  ['togekiss', 110, 82, 'Engel mit Bodyguard und sehr fiesem Air Slash.'],
  ['ninetales', 100, 78, 'Neun Schweife, tausend Jahre Anmut.'],
  ['mimikyu-disguised', 95, 86, 'Will nur geliebt werden. Und hat einen Gratis-Schutzschild.'],
  ['raichu', 85, 68, 'Was aus dem Maskottchen wird, wenn man es lässt.'],
  ['luxray', 80, 66, 'Röntgenblick mit Löwenmähne.'],
  ['persian', 70, 58, 'Elegant, teuer, überheblich.'],
  ['bewear', 70, 65, 'Umarmt dich zu Tode. Aus Zuneigung.'],
  ['stoutland', 65, 62, 'Der treueste Begleiter im ganzen Spiel.'],
  ['wigglytuff', 60, 52, 'Singt dich in den Schlaf - und dann?'],
  ['furret', 55, 48, 'Läuft schneller als du denkst.'],
  ['liepard', 55, 46, 'Hübsch, schnell, komplett unzuverlässig.'],
  ['cinccino', 50, 55, 'Fünf Treffer pro Runde. Unterschätzt.'],
  ['granbull', 50, 44, 'Sieht furchteinflößend aus, ist ein Schoßhund.'],
  ['delcatty', 45, 30, 'Maximale Niedlichkeit, minimale Werte.'],
  ['furfrou', 45, 28, 'Ein Pudel mit Frisuren-Menü. Das war das Feature.'],
];

/** Shiny artwork - own ids so a Pokémon can also appear in its normal form. */
const SHINY: Entry[] = [
  ['gyarados', 150, 94, 'Das rote Garados aus dem See des Zorns. Die Ur-Legende.'],
  ['charizard', 140, 90, 'Schwarz statt orange. Der begehrteste Shiny überhaupt.'],
  ['rayquaza', 135, 92, 'Schwarzer Himmelsdrache. Ehrfurcht in Reinform.'],
  ['umbreon', 125, 88, 'Blaue Ringe statt gelb. Perfektion.'],
  ['tyranitar', 115, 84, 'Dunkelgrün wird zu leuchtendem Rostrot.'],
  ['metagross', 110, 82, 'Silber wird Gold. Turnier-Ikone.'],
  ['garchomp', 110, 83, 'Grau-blau statt blau. Subtil und teuer.'],
  ['lucario', 105, 80, 'Blau wird gelb-orange. Sehr auffällig.'],
  ['gengar', 100, 79, 'Weiß-blasser Schatten. Gruseliger als das Original.'],
  ['ninetales', 95, 74, 'Schneeweiß statt gold.'],
  ['volcarona', 90, 76, 'Aus Feuerrot wird tiefes Blau.'],
  ['haxorus', 85, 70, 'Schwarz-oranger Klingendrache.'],
  ['scizor', 85, 72, 'Rot wird knalliges Gelb. Geschmackssache.'],
  ['greninja', 80, 71, 'Schwarz-rote Variante des Ninja-Frosches.'],
  ['aegislash-shield', 75, 68, 'Goldenes Königsschwert.'],
  ['mimikyu-disguised', 70, 66, 'Der Lumpen wird golden. Immer noch traurig.'],
];

/** Kanto finals that are not already claimed by a more specific category. */
const KANTO: Entry[] = [
  ['gengar', 140, 90, 'Der Schatten, der hinter dir grinst.'],
  ['alakazam', 125, 84, 'IQ 5000 und Löffel als Waffe.'],
  ['machamp', 115, 82, 'Vier Arme, ein Ziel: dich.'],
  ['snorlax', 115, 86, 'Blockiert Wege und Angriffe gleichermaßen.'],
  ['lapras', 110, 80, 'Sanfter Riese mit Panzerung.'],
  ['gyarados', 110, 85, 'Aus dem nutzlosesten Fisch wird ein Monster.'],
  ['golem', 95, 72, 'Rollt bergab und nimmt alles mit.'],
  ['nidoking', 95, 76, 'Der vielseitigste Angreifer der ersten Generation.'],
  ['scyther', 90, 74, 'Sensen, die schneller sind als das Auge.'],
  ['cloyster', 85, 78, 'Fünf Eiszapfen pro Runde. Autsch.'],
  ['starmie', 85, 75, 'Der schnellste Allrounder von Kanto.'],
  ['exeggutor', 80, 68, 'Drei Köpfe, ein sehr großer Baum.'],
  ['rhydon', 80, 66, 'Das allererste jemals designte Pokémon.'],
  ['kangaskhan', 75, 64, 'Mutter und Kind als Doppelangriff.'],
  ['pinsir', 75, 62, 'Zangen, die Baumstämme knacken.'],
  ['tauros', 70, 70, 'Der heimliche König der ersten Turnier-Ära.'],
  ['victreebel', 70, 60, 'Verschlingt alles, was hineinfällt.'],
  ['tentacruel', 70, 65, 'Achtzig Tentakel voller Gift.'],
  ['dodrio', 65, 55, 'Drei Köpfe, drei Stimmungen, ein Tempo.'],
  ['poliwrath', 65, 58, 'Schwimmt schneller als die meisten Wasserpokémon.'],
  ['muk', 60, 54, 'Riecht man drei Kilometer gegen den Wind.'],
  ['magneton', 60, 56, 'Drei Magnete, die sich zusammengetan haben.'],
  ['primeape', 55, 48, 'Dauerhaft wütend. Wirklich dauerhaft.'],
  ['slowbro', 55, 52, 'Hat gar nicht gemerkt, dass er entwickelt wurde.'],
  ['farfetchd', 40, 12, 'Trägt eine Lauchstange. Das ist die Attacke. Die Falle.'],
];

const LEGENDARY: Entry[] = [
  ['mewtwo', 150, 96, 'Das genetisch erschaffene Monster. Der Maßstab.'],
  ['rayquaza', 145, 95, 'Herrscher des Himmels, Schiedsrichter der Urkräfte.'],
  ['arceus', 145, 94, 'Das Pokémon, das die Welt erschuf.'],
  ['kyogre', 135, 90, 'Lässt es regnen, bis der Ozean steigt.'],
  ['groudon', 135, 89, 'Verwandelt Meere in Kontinente.'],
  ['giratina-altered', 125, 86, 'Der Verbannte aus der Zerrwelt.'],
  ['dialga', 125, 87, 'Herr über die Zeit selbst.'],
  ['palkia', 120, 85, 'Faltet den Raum wie Papier.'],
  ['lugia', 120, 88, 'Wächter der Meere, sanft und unfassbar stark.'],
  ['ho-oh', 115, 84, 'Der Regenbogen-Phönix. Erweckt Tote.'],
  ['xerneas', 115, 86, 'Bringt ewiges Leben - und Geomantie.'],
  ['reshiram', 110, 83, 'Weiße Flamme der Wahrheit.'],
  ['zekrom', 110, 83, 'Schwarzer Blitz der Ideale.'],
  ['yveltal', 110, 82, 'Nimmt Leben, wenn es die Flügel ausbreitet.'],
  ['solgaleo', 105, 80, 'Das Sonnenlöwenherz von Alola.'],
  ['lunala', 105, 80, 'Der Mondflügel, der Sterne verschlingt.'],
  ['necrozma', 100, 84, 'Frisst Licht. Und hat es sehr eilig.'],
  ['suicune', 95, 74, 'Reinigt Wasser im Vorbeilaufen.'],
  ['articuno', 90, 66, 'Der eleganteste der drei Vögel - und der schwächste.'],
  ['zapdos', 90, 76, 'Der einzige Vogel, der Turniere prägte.'],
  ['moltres', 85, 68, 'Wiedergeburt in Flammen.'],
  ['tapu-koko', 85, 78, 'Elektrisches Feld ohne Vorwarnung.'],
  ['mew', 80, 72, 'Kann jede Attacke lernen. Wirklich jede.'],
  ['celebi', 70, 60, 'Reist durch die Zeit, kämpft aber ungern.'],
  ['jirachi', 70, 74, 'Erfüllt Wünsche - und flincht dich zu Tode.'],
  ['regigigas', 60, 20, 'Gewaltige Werte, gelähmt durch die eigene Fähigkeit. Die Falle.'],
];

const MEGA: Entry[] = [
  ['rayquaza-mega', 150, 97, 'Die stärkste Form, die je erlaubt war. Sofort verbannt.'],
  ['mewtwo-mega-y', 145, 94, 'Höchster Spezialangriff im ganzen Spiel.'],
  ['mewtwo-mega-x', 140, 92, 'Psycho/Kampf mit absurden Muskeln.'],
  ['garchomp-mega', 130, 84, 'Mehr Angriff, weniger Tempo. Umstritten.'],
  ['charizard-mega-x', 130, 90, 'Endlich der Drache, der er immer sein wollte.'],
  ['charizard-mega-y', 130, 91, 'Dürre plus Solarstrahl. Sonnenkönig.'],
  ['metagross-mega', 125, 89, 'Der Meister-Ball unter den Megas.'],
  ['salamence-mega', 125, 88, 'Aerilate-Doppelflügel. Wurde ebenfalls verbannt.'],
  ['lucario-mega', 120, 86, 'Anpassung plus Nahkampf. Räumt auf.'],
  ['gengar-mega', 120, 87, 'Schattentrick sperrt dich ein. Auch verbannt.'],
  ['kangaskhan-mega', 115, 88, 'Jede Attacke doppelt. Das kaputteste Mega der Generation.'],
  ['tyranitar-mega', 115, 85, 'Sandsturm plus Panzerung plus Wut.'],
  ['blaziken-mega', 110, 84, 'Temposchub war schon vorher zu stark.'],
  ['gardevoir-mega', 110, 85, 'Feenfeld-Hyperstimme trifft alles.'],
  ['scizor-mega', 105, 82, 'Kometenhieb mit Stahlhaut.'],
  ['swampert-mega', 100, 80, 'Im Regen der schnellste Panzer der Welt.'],
  ['diancie-mega', 100, 81, 'Diamantsturm mit Modelmaßen.'],
  ['gyarados-mega', 95, 79, 'Wird endlich zum Unlicht-Monster.'],
  ['aggron-mega', 90, 74, 'Filter macht aus Stahl eine Festung.'],
  ['heracross-mega', 90, 76, 'Techniker plus Sturzbach. Zerlegt Wände.'],
  ['medicham-mega', 85, 75, 'Reiner Fokus - Angriff mal zwei.'],
  ['alakazam-mega', 85, 77, 'Spurenkopie und noch mehr Tempo.'],
  ['blastoise-mega', 80, 70, 'Mega-Kanonier mit Aquahaubitze.'],
  ['venusaur-mega', 80, 73, 'Dickes Fell macht ihn fast unsterblich.'],
  ['absol-mega', 75, 72, 'Magiespiegel wirft alles zurück.'],
  ['houndoom-mega', 75, 68, 'Solarkraft-Flammenwurf.'],
  ['sableye-mega', 70, 74, 'Magiespiegel mit Priorität. Extrem nervig.'],
  ['mawile-mega', 70, 76, 'Huge Power verdoppelt einen ohnehin fiesen Angriff.'],
  ['manectric-mega', 65, 60, 'Blitzfänger und dann sehr schnell weg.'],
  ['pinsir-mega', 65, 71, 'Aerilate-Zerhacker aus dem Nichts.'],
  ['aerodactyl-mega', 60, 62, 'Noch schneller als vorher. Aber zerbrechlich.'],
  ['steelix-mega', 60, 64, 'Sandgewalt und eine Wand aus Stahl.'],
  ['abomasnow-mega', 55, 50, 'Bringt Hagel mit. Und viele Schwächen.'],
  ['ampharos-mega', 55, 58, 'Bekommt eine Perücke und den Drachentyp.'],
  ['camerupt-mega', 50, 46, 'Extrem langsam, extrem stark. Nur im Trickraum.'],
  ['glalie-mega', 50, 34, 'Refrigerate klingt gut - bis man die Werte sieht.'],
  ['banette-mega', 50, 52, 'Priorität-Fluch, wenn man Glück hat.'],
  ['lopunny-mega', 50, 70, 'Skill Link... nein: Nahkampf-Hase mit Tempo. Unterschätzt.'],
  ['audino-mega', 45, 24, 'Die Verkörperung eines mittelmäßigen Megas.'],
  ['beedrill-mega', 45, 66, 'Anpassung plus Käferbiss. Billiger Sniper.'],
];

const WAIFU: Entry[] = [
  ['gardevoir', 140, 90, 'Die Ikone. Beschützt ihren Trainer mit dem Leben.'],
  ['milotic', 125, 86, 'Das schönste Pokémon der Welt. Offiziell.'],
  ['lucario', 120, 88, 'Aura-Kämpfer und Dauergast in jedem Spiel.'],
  ['zoroark', 110, 82, 'Täuschung als Lebensstil.'],
  ['froslass', 100, 78, 'Eisige Schönheit mit Fluch.'],
  ['lopunny', 95, 74, 'Elegant - und mit Mega-Form ein Nahkämpfer.'],
  ['mismagius', 90, 76, 'Zaubert Unglück herbei. Charmant dabei.'],
  ['roserade', 90, 77, 'Blumenstrauß mit tödlichem Gift.'],
  ['salazzle', 85, 72, 'Giftgas und Kommandoton.'],
  ['tsareena', 80, 70, 'Königin mit sehr langen Beinen. Und Tritten.'],
  ['gothitelle', 75, 64, 'Sieht deine Zukunft. Sperrt dich vorher ein.'],
  ['lilligant', 70, 62, 'Blütentanz nach Schlafpuder.'],
  ['nidoqueen', 70, 66, 'Die Mutter aller Kampf-Königinnen.'],
  ['florges', 70, 68, 'Blumengarten mit gewaltiger Spezialverteidigung.'],
  ['bellossom', 60, 52, 'Tanzt fröhlich, während du verlierst.'],
  ['lurantis', 55, 48, 'Sichelblatt mit Klingentanz.'],
  ['miltank', 55, 64, 'Walzer. Ein ganzer Arenaleiter-Albtraum.'],
  ['jynx', 45, 30, 'Sehr eigenwilliges Design, sehr schwache Bilanz.'],
];

const CATEGORIES = [
  { id: 'starter', entries: STARTER },
  { id: 'legendary', entries: LEGENDARY },
  { id: 'mega', entries: MEGA },
  { id: 'pseudo', entries: PSEUDO },
  { id: 'kanto151', entries: KANTO },
  { id: 'eeveelution', entries: EEVEELUTION },
  { id: 'shiny', entries: SHINY, shiny: true },
  { id: 'fossil', entries: FOSSIL },
  { id: 'pet', entries: PET },
  { id: 'waifu', entries: WAIFU },
];

// ---------------------------------------------------------------------------

function parseCsv(path: string): Record<string, string>[] {
  const text = readFileSync(path, 'utf8').trim();
  const [header, ...rows] = text.split('\n');
  const cols = header.split(',');
  return rows.map((row) => {
    const cells = row.split(',');
    const record: Record<string, string> = {};
    cols.forEach((c, i) => (record[c] = cells[i] ?? ''));
    return record;
  });
}

const pokemon = parseCsv(join(HERE, 'data/pokemon.csv'));
const species = parseCsv(join(HERE, 'data/species.csv'));

const spriteIdOf = new Map<string, string>();
const speciesIdOf = new Map<string, string>();
for (const p of pokemon) {
  spriteIdOf.set(p.identifier, p.id);
  speciesIdOf.set(p.identifier, p.species_id);
}

const generationOfSpecies = new Map<string, number>();
for (const s of species) generationOfSpecies.set(s.id, Number(s.generation_id));

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

/** Pokémon whose only entry is a form identifier - show the species name. */
const NAME_OVERRIDES: Record<string, string> = {
  'aegislash-shield': 'Aegislash',
  'mimikyu-disguised': 'Mimikyu',
  'giratina-altered': 'Giratina',
};

/** Title-cases an identifier: charizard-mega-x -> Charizard Mega X */
function displayName(identifier: string): string {
  const override = NAME_OVERRIDES[identifier];
  if (override) return override;
  return identifier
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const MAX_GENERATION = 7;
const problems: string[] = [];
const lines: string[] = [];
const seenIds = new Set<string>();

for (const category of CATEGORIES) {
  lines.push(`\n  // ${'-'.repeat(70)} ${category.id}`);
  for (const [identifier, bid, score, flavor] of category.entries) {
    const spriteId = spriteIdOf.get(identifier);
    const speciesId = speciesIdOf.get(identifier);
    if (!spriteId || !speciesId) {
      problems.push(`unknown identifier: ${identifier}`);
      continue;
    }
    const generation = generationOfSpecies.get(speciesId);
    if (!generation) {
      problems.push(`no generation for ${identifier}`);
      continue;
    }
    if (generation > MAX_GENERATION) {
      problems.push(`${identifier} is generation ${generation}, above the supported ${MAX_GENERATION}`);
      continue;
    }
    if (bid < 40 || bid > 150 || bid % 5 !== 0) problems.push(`${identifier}: bid ${bid} out of range/grid`);
    if (score < 0 || score > 100) problems.push(`${identifier}: score ${score} out of range`);

    const id = category.shiny ? `shiny-${identifier}` : identifier;
    if (seenIds.has(id)) {
      problems.push(`duplicate id: ${id}`);
      continue;
    }
    seenIds.add(id);

    const name = category.shiny ? `Shiny ${displayName(identifier)}` : displayName(identifier);
    const image = category.shiny ? `${SPRITE_BASE}/shiny/${spriteId}.png` : `${SPRITE_BASE}/${spriteId}.png`;

    lines.push(
      `  p('${id}', '${name.replace(/'/g, "\\'")}', '${category.id}', ${generation}, ${bid}, ${score}, '${image}', '${flavor.replace(/'/g, "\\'")}'),`,
    );
  }
}

if (problems.length) {
  console.error('Generation failed:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

const counts = CATEGORIES.map((c) => `${c.id}: ${c.entries.length}`).join(', ');

const output = `import type { CharacterDef } from '../../types.js';
import { MILLION } from '../../constants.js';

/**
 * GENERATED FILE - do not edit by hand.
 * Run: npx tsx tools/generate-pokemon-theme.ts
 *
 * Sprite ids and generations come from the PokéAPI data dumps in tools/data/.
 * Artwork is referenced from the PokéAPI sprite CDN, which sends
 * Access-Control-Allow-Origin, so the pixelated reveal can read it off a canvas.
 * Any image that fails to load falls back to procedural art.
 *
 * ${counts}
 */

const M = MILLION;

function p(
  id: string,
  name: string,
  category: string,
  generation: number,
  bid: number,
  hiddenScore: number,
  image: string,
  flavor: string,
): CharacterDef {
  return { id, name, epithet: \`Gen \${generation}\`, category, generation, startingBid: bid * M, hiddenScore, image, flavor };
}

export const POKEMON_CHARACTERS: CharacterDef[] = [${lines.join('\n')}
];
`;

const target = join(ROOT, 'packages/shared/src/theme/pokemon/characters.ts');
writeFileSync(target, output);

console.log(`Wrote ${seenIds.size} characters to ${target}`);
for (const category of CATEGORIES) {
  const perGen: Record<number, number> = {};
  for (const [identifier] of category.entries) {
    const gen = generationOfSpecies.get(speciesIdOf.get(identifier)!)!;
    perGen[gen] = (perGen[gen] ?? 0) + 1;
  }
  // Cumulative count when playing "up to generation N".
  const cumulative: string[] = [];
  let running = 0;
  for (let gen = 1; gen <= MAX_GENERATION; gen++) {
    running += perGen[gen] ?? 0;
    cumulative.push(`${gen}:${running}`);
  }
  console.log(`  ${category.id.padEnd(12)} total ${String(category.entries.length).padStart(2)}  bis Gen ${cumulative.join(' ')}`);
}
