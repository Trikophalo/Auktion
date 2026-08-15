import type { CharacterDef } from '../../types.js';
import { MILLION } from '../../constants.js';

/**
 * The character database.
 *
 * Two independent numbers per character:
 *   startingBid  - the PERCEIVED value (40M-150M). Public. Drives the auction.
 *   hiddenScore  - the ACTUAL value within its category (0-100). Secret until
 *                  the final reveal.
 *
 * They correlate (~0.8) but every category ships deliberate sleepers (cheap,
 * high score) and traps (famous or flashy, low score). Overpaying for Spandam
 * is a memory the game is designed to produce.
 *
 * Scores are balanced WITHIN a category: a top cook is worth as much as a top
 * captain, so no category is a throwaway.
 */

const M = MILLION;

function c(
  id: string,
  name: string,
  epithet: string,
  category: string,
  bid: number,
  hiddenScore: number,
  flavor: string,
): CharacterDef {
  return { id, name, epithet, category, startingBid: bid * M, hiddenScore, flavor };
}

export const CHARACTERS: CharacterDef[] = [
  // ---------------------------------------------------------------- captains
  c('gol-d-roger', 'Gol D. Roger', 'König der Piraten', 'captains', 150, 97, 'Der einzige Mann, der die Grand Line bezwungen hat.'),
  c('whitebeard', 'Edward Newgate', 'Whitebeard', 'captains', 145, 95, 'Der stärkste Mann der Welt. Ein Beben pro Faustschlag.'),
  c('luffy', 'Monkey D. Ruffy', 'Sonnengott Nika', 'captains', 140, 96, 'Gum-Gum, Gear 5 und ein Lachen, das die Welt verändert.'),
  c('shanks', 'Shanks', 'Der Rothaarige', 'captains', 140, 93, 'Hebt nur die Augenbraue - und ein halber Ozean gibt auf.'),
  c('rocks-d-xebec', 'Rocks D. Xebec', 'Der Ausgelöschte', 'captains', 135, 90, 'Die Legende, die die Weltregierung aus den Büchern strich.'),
  c('kaido', 'Kaido', 'Stärkstes Wesen der Welt', 'captains', 130, 91, 'Neunmal hingerichtet, neunmal aufgestanden.'),
  c('blackbeard', 'Marshall D. Teach', 'Blackbeard', 'captains', 125, 89, 'Der einzige Mann mit zwei Teufelsfrüchten.'),
  c('big-mom', 'Charlotte Linlin', 'Big Mom', 'captains', 120, 86, 'Kaiserin von Totto Land. Bring Kuchen mit.'),
  c('boa-hancock', 'Boa Hancock', 'Piratenkaiserin', 'captains', 90, 79, 'Schönheit als Waffe - im wörtlichsten Sinn.'),
  c('eustass-kid', 'Eustass Kid', 'Captain Kid', 'captains', 60, 68, 'Erweckte Magnetkräfte. Verliert trotzdem beeindruckend oft.'),
  c('bonney', 'Jewelry Bonney', 'Die Gefräßige', 'captains', 50, 58, 'Spielt mit dem Alter selbst - und mit Vegapunks Geheimnissen.'),
  c('buggy', 'Buggy', 'Der Sternenclown', 'captains', 45, 62, 'Kaiser der Meere. Durch ein Missverständnis. Zählt trotzdem.'),
  c('capone-bege', 'Capone Bege', 'Gang Bege', 'captains', 50, 55, 'Eine wandelnde Festung mit Mafia-Manieren.'),
  c('bartolomeo', 'Bartolomeo', 'Der Kannibale', 'captains', 45, 48, 'Barrieren, Fanboy-Energie und ein sehr großer Mund.'),
  c('cavendish', 'Cavendish', 'Weißes Pferd', 'captains', 45, 46, 'Hakuba ist furchteinflößend. Cavendish leider nicht.'),
  c('alvida', 'Lady Alvida', 'Eisenkeule', 'captains', 40, 18, 'Glatt wie Schmierseife, relevant wie ein Ruderboot.'),

  // -------------------------------------------------------------- commanders
  c('rayleigh', 'Silvers Rayleigh', 'Der dunkle König', 'commanders', 135, 94, 'Rogers rechte Hand. Halbiert Seekönige aus Langeweile.'),
  c('katakuri', 'Charlotte Katakuri', 'Mochi', 'commanders', 120, 90, 'Sieht die Zukunft. Wirft sich nie rückwärts zu Boden.'),
  c('ace', 'Portgas D. Ace', 'Feuerfaust', 'commanders', 110, 87, 'Zweiter Divisionskommandant. Legende auf und nach Marineford.'),
  c('ben-beckman', 'Ben Beckman', 'Erster Maat', 'commanders', 110, 85, 'Brachte Kizaru mit einem Blick zum Innehalten.'),
  c('yamato', 'Yamato', 'Odens Erbe', 'commanders', 100, 84, 'Der Wächter von Wano mit dem Eishund-Zoan.'),
  c('king', 'King', 'Der Brand', 'commanders', 100, 83, 'Lunarier. Brennt von selbst. Sehr unhöflich.'),
  c('queen', 'Queen', 'Die Seuche', 'commanders', 80, 70, 'Cyborg, Wissenschaftler, Funkytown-Enthusiast.'),
  c('cracker', 'Charlotte Cracker', 'Tausend Arme', 'commanders', 70, 66, 'Eine Keksarmee, die einfach nicht aufhört.'),
  c('jozu', 'Jozu', 'Diamant', 'commanders', 65, 64, 'Die härteste Verteidigung der Whitebeard-Piraten.'),
  c('lucky-roux', 'Lucky Roux', 'Fleischkeule', 'commanders', 55, 65, 'Isst ununterbrochen. Zieht schneller als jeder Marine.'),
  c('killer', 'Killer', 'Massaker-Soldat', 'commanders', 60, 63, 'Der unterschätzteste Duellant der Schlimmen Generation.'),
  c('perospero', 'Charlotte Perospero', 'Der Süßholzraspler', 'commanders', 60, 61, 'Bonbon-Manipulation - überraschend nützlich.'),
  c('smoothie', 'Charlotte Smoothie', 'Süße Kommandantin', 'commanders', 65, 52, 'Presst alles aus. Kämpft dafür fast nie.'),
  c('jack', 'Jack', 'Die Dürre', 'commanders', 60, 45, 'Startet jeden Kampf. Verliert jeden Kampf. Jeden.'),
  c('burgess', 'Jesus Burgess', 'Champion', 'commanders', 50, 42, 'Champion von exakt gar nichts.'),

  // --------------------------------------------------------------- swordsmen
  c('mihawk', 'Dracule Mihawk', 'Falkenauge', 'swordsmen', 145, 96, 'Der stärkste Schwertkämpfer der Welt. Punkt.'),
  c('zoro', 'Lorenor Zorro', 'König der Hölle', 'swordsmen', 140, 94, 'Drei Schwerter, kein Orientierungssinn, unendlicher Wille.'),
  c('ryuma', 'Ryuma', 'Der Drachentöter', 'swordsmen', 105, 84, 'Die Legende von Wano - erschlug einen Drachen.'),
  c('shiryu', 'Shiryu', 'Der Regen', 'swordsmen', 95, 78, 'Unsichtbar. Und das ist erst sein zweitschlimmster Zug.'),
  c('denjiro', 'Denjiro', 'Kyoshiro', 'swordsmen', 80, 73, 'Odens bester Schüler - zwanzig Jahre in Verkleidung.'),
  c('vista', 'Vista', 'Blumenschwert', 'swordsmen', 80, 72, 'Focht mit Mihawk auf Augenhöhe. Sehr guter Schnurrbart.'),
  c('ashura-doji', 'Ashura Doji', 'Dämon von Kuri', 'swordsmen', 75, 70, 'Ein Berg von einem Mann mit einem noch größeren Schwert.'),
  c('hyogoro', 'Hyogoro', 'Die Blume', 'swordsmen', 50, 66, 'Winziger alter Mann, absoluter Meister des Ryuo.'),
  c('kinemon', 'Kin’emon', 'Fuchsfeuer', 'swordsmen', 65, 60, 'Schneidet Feuer. Und näht ganz nebenbei Kostüme.'),
  c('koushirou', 'Koushirou', 'Der Lehrmeister', 'swordsmen', 50, 58, 'Brachte Zorro alles bei. Sein Schwert schneidet nichts - freiwillig.'),
  c('okiku', 'O-Kiku', 'Kikunojo vom Schnee', 'swordsmen', 55, 54, 'Anmut vorne, tödliche Klinge hinten.'),
  c('tashigi', 'Tashigi', 'Die Sammlerin', 'swordsmen', 50, 46, 'Kennt jedes legendäre Schwert. Verliert gegen die meisten.'),
  c('cabaji', 'Cabaji', 'Der Akrobat', 'swordsmen', 40, 12, 'Zirkusnummer auf einem Einrad. Mit Schwert. Leider.'),

  // ----------------------------------------------------------------- marines
  c('garp', 'Monkey D. Garp', 'Der Held der Marine', 'marines', 140, 95, 'Trieb Roger in die Enge. Faust der Liebe inklusive.'),
  c('akainu', 'Sakazuki', 'Akainu', 'marines', 135, 91, 'Großadmiral aus Magma. Absolute Gerechtigkeit.'),
  c('aokiji', 'Kuzan', 'Aokiji', 'marines', 125, 89, 'Zehn Tage Eis. Und trotzdem der netteste Admiral.'),
  c('sengoku', 'Sengoku', 'Der Buddha', 'marines', 125, 88, 'Stratege des Jahrhunderts, Schockwellen aus Gold.'),
  c('kizaru', 'Borsalino', 'Kizaru', 'marines', 120, 86, 'Bewegt sich mit Lichtgeschwindigkeit. Denkt langsamer.'),
  c('fujitora', 'Issho', 'Fujitora', 'marines', 110, 84, 'Blind, aber lässt Meteoriten vom Himmel fallen.'),
  c('ryokugyu', 'Aramaki', 'Ryokugyu', 'marines', 105, 78, 'Der Waldadmiral. Saugt Inseln trocken.'),
  c('kong', 'Kong', 'Oberbefehlshaber', 'marines', 95, 74, 'Garps Kapitän von damals. Heute der mächtigste Schreibtisch.'),
  c('koby', 'Koby', 'Der Held von Rocky Port', 'marines', 45, 70, 'Vom Kabinenjungen zum kommenden Helden der Marine.'),
  c('tsuru', 'Tsuru', 'Die große Strategin', 'marines', 65, 68, 'Wäscht Piraten. Buchstäblich. Dann faltet sie sie.'),
  c('smoker', 'Smoker', 'Der weiße Jäger', 'marines', 70, 66, 'Gibt niemals auf, holt Ruffy trotzdem nie ein.'),
  c('x-drake', 'X Drake', 'Der Rote Fluch', 'marines', 60, 58, 'Dino-Zoan und Doppelagent von SWORD.'),
  c('sentomaru', 'Sentomaru', 'Wache der Wissenschaft', 'marines', 55, 50, 'Kommandiert Pacifistas und schweigt über den Rest.'),
  c('hina', 'Hina', 'Der schwarze Käfig', 'marines', 50, 48, 'Sperrt dich ein, bevor du das Verb gefunden hast.'),
  c('helmeppo', 'Helmeppo', 'Sohn des Axthand', 'marines', 40, 15, 'Ist dabei. Das war’s auch schon.'),

  // ------------------------------------------------------------- specialists
  c('jinbe', 'Jinbe', 'Ritter der Meere', 'specialists', 105, 86, 'Der Steuermann, auf den die ganze Crew wartete.'),
  c('robin', 'Nico Robin', 'Teufelskind', 'specialists', 100, 88, 'Die Einzige, die die Poneglyphen lesen kann.'),
  c('nami', 'Nami', 'Die Katzendiebin', 'specialists', 90, 85, 'Die beste Navigatorin der Welt. Und sie weiß es.'),
  c('yasopp', 'Yasopp', 'Der Scharfschütze', 'specialists', 85, 78, 'Trifft die Antennen einer Ameise. Aus großer Entfernung.'),
  c('franky', 'Franky', 'Cyborg', 'specialists', 75, 76, 'Baute die Thousand Sunny. SUUUPER.'),
  c('brook', 'Brook', 'Soul King', 'specialists', 70, 70, 'Musiker, Schwertkämpfer, Skelett. Yohohoho.'),
  c('van-augur', 'Van Augur', 'Der Zauberer', 'specialists', 70, 66, 'Teleportiert. Und trifft trotzdem alles.'),
  c('usopp', 'Lysop', 'Gott Usopp', 'specialists', 65, 74, 'Erwecktes Beobachtungs-Haki hinter einer sehr langen Nase.'),
  c('uta', 'Uta', 'Die Diva der Welt', 'specialists', 65, 64, 'Ihre Stimme bewegt ganze Kontinente.'),
  c('tom', 'Tom', 'Der Schiffszimmerer', 'specialists', 60, 65, 'Baute die Oro Jackson. Mehr muss man nicht sagen.'),
  c('izo', 'Izo', 'Der Revolverheld', 'specialists', 55, 56, 'Whitebeards 16. Kommandant mit zwei Pistolen.'),
  c('iceburg', 'Iceburg', 'Bürgermeister von Water 7', 'specialists', 55, 54, 'Der beste Schiffsbauer seiner Generation.'),
  c('pedro', 'Pedro', 'Die Fackel', 'specialists', 50, 52, 'Opferte alles für die Morgendämmerung.'),
  c('apoo', 'Scratchmen Apoo', 'Der Klang', 'specialists', 50, 38, 'Verrät alle. Immer. Wirklich alle.'),
  c('bepo', 'Bepo', 'Der Navigator', 'specialists', 45, 44, 'Navigator. Bär. Entschuldigt sich zu viel.'),

  // ------------------------------------------------------------------- cooks
  c('sanji', 'Sanji', 'Schwarzfuß', 'cooks', 135, 95, 'Der Preis dieser Kategorie. Jedes Spiel ein Bieterkrieg.'),
  c('zeff', 'Zeff', 'Rotfuß', 'cooks', 90, 80, 'Gab sein Bein für einen Jungen und ein Restaurant.'),
  c('streusen', 'Streusen', 'Küchenchef von Totto Land', 'cooks', 70, 68, 'Machte eine ganze Insel essbar.'),
  c('pudding', 'Charlotte Pudding', 'Dreiäugige', 'cooks', 65, 62, 'Backt Erinnerungen. Und weint dabei.'),
  c('chiffon', 'Charlotte Chiffon', 'Die Retterin', 'cooks', 50, 55, 'Rettete die Hochzeitstorte - und damit alle.'),
  c('cosette', 'Cosette', 'Die ehrliche Köchin', 'cooks', 45, 52, 'Germas Küche hat nur ein gutes Herz: ihres.'),
  c('terracotta', 'Terracotta', 'Küchenmeisterin', 'cooks', 45, 44, 'Alabastas Palastküche läuft wie ein Uhrwerk.'),
  c('patty', 'Patty', 'Der Kellner', 'cooks', 40, 32, 'Baratie-Muskeln mit mäßigem Talent.'),
  c('carne', 'Carne', 'Der Grillmeister', 'cooks', 40, 30, 'Baratie-Muskeln, Teil zwei.'),
  c('opera', 'Charlotte Opera', 'Sahne', 'cooks', 40, 25, 'Selbstbewusstsein: enorm. Kampfbilanz: fatal.'),
  c('buchi', 'Buchi', 'Die Katze', 'cooks', 40, 20, 'Kocht angeblich. Beweise fehlen.'),
  c('wanze', 'Wanze', 'Ramen-Kenpo', 'cooks', 40, 8, 'Nudeln aus dem Mund. Legendär eklig, legendär nutzlos.'),

  // ----------------------------------------------------------------- doctors
  c('law', 'Trafalgar D. Water Law', 'Chirurg des Todes', 'doctors', 125, 92, 'ROOM. Und dein Herz liegt in seiner Hand.'),
  c('marco', 'Marco', 'Der Phönix', 'doctors', 115, 89, 'Blaue Flammen, die eine ganze Crew heilen.'),
  c('chopper', 'Tony Tony Chopper', 'Baumwollsüßigkeiten-Liebhaber', 'doctors', 85, 87, 'Heilt das Unheilbare. Und ist dabei viel zu süß.'),
  c('kureha', 'Dr. Kureha', 'Die Hexe', 'doctors', 70, 76, '140 Jahre Medizin und null Geduld.'),
  c('mansherry', 'Mansherry', 'Prinzessin der Tontatta', 'doctors', 50, 72, 'Ihre Tränen heilen buchstäblich alles.'),
  c('crocus', 'Crocus', 'Der Leuchtturmwärter', 'doctors', 60, 70, 'Hielt Roger drei Jahre länger am Leben.'),
  c('aladine', 'Aladin', 'Schiffsarzt der Sonnenpiraten', 'doctors', 50, 54, 'Ruhig, kompetent, mit Hai-Instinkt.'),
  c('hogback', 'Dr. Hogback', 'Der Genie-Chirurg', 'doctors', 55, 48, 'Genial, aber komplett verschwendet an Untote.'),
  c('doc-q', 'Doc Q', 'Der Todesbote', 'doctors', 45, 40, 'Ein Arzt, der selbst kaum stehen kann.'),
  c('muret', 'Muret', 'Dorfärztin von Sphinx', 'doctors', 40, 35, 'Versorgt Whitebeards Heimatinsel.'),
  c('nako', 'Nako', 'Der Inselarzt', 'doctors', 40, 26, 'Mürrisch, aber immerhin anwesend.'),
  c('fishbonen', 'Fishbonen', 'Der Assistent', 'doctors', 40, 18, 'Thriller-Bark-Quacksalber ohne Approbation.'),

  // ------------------------------------------------------------------ agents
  c('lucci', 'Rob Lucci', 'CP0', 'agents', 120, 88, 'Die perfekte Tötungsmaschine der Weltregierung.'),
  c('stussy', 'Stussy', 'Die Königin des Rotlichtviertels', 'agents', 80, 74, 'Doppelagentin, Klon, und immer einen Schritt voraus.'),
  c('kaku', 'Kaku', 'Der Giraffen-Agent', 'agents', 80, 72, 'Absurde Form, absolut tödliche Technik.'),
  c('corazon', 'Donquixote Rosinante', 'Corazon', 'agents', 70, 76, 'Der stille Held, der Law das Leben rettete.'),
  c('bon-clay', 'Bentham', 'Mr. 2 Bon Clay', 'agents', 55, 70, 'Loyalität über den Tod hinaus. Okama Kenpo!'),
  c('vergo', 'Vergo', 'Der Bambus', 'agents', 65, 60, 'Haki so hart, dass Bambus zur Waffe wird.'),
  c('jabra', 'Jabra', 'Der Wolf', 'agents', 65, 58, 'CP9 mit großer Klappe und echtem Biss.'),
  c('daz-bones', 'Daz Bones', 'Mr. 1', 'agents', 60, 56, 'Ein Körper aus Klingen, von Kopf bis Fuß.'),
  c('blueno', 'Blueno', 'Der Türsteher', 'agents', 55, 50, 'Türen überall. Fluchtwege inklusive.'),
  c('mr-3', 'Galdino', 'Mr. 3', 'agents', 45, 52, 'Wachs. Klingt lächerlich, rettete Marineford-Legenden.'),
  c('kalifa', 'Kalifa', 'Die Sekretärin', 'agents', 50, 46, 'Sexuelle Belästigung! (Es ist Seife.)'),
  c('doublefinger', 'Zala', 'Miss Doublefinger', 'agents', 45, 40, 'Stachel aus jedem Körperteil.'),
  c('goldenweek', 'Marianne', 'Miss Goldenweek', 'agents', 40, 28, 'Malt deine Gefühle um. Sehr entspannt dabei.'),
  c('spandam', 'Spandam', 'Chef von CP9', 'agents', 40, 3, 'Zerbrach sein Schwert an einer Wand. Die Falle schlechthin.'),

  // --------------------------------------------------------- revolutionaries
  c('dragon', 'Monkey D. Dragon', 'Der Revolutionär', 'revolutionaries', 145, 93, 'Der meistgesuchte Verbrecher der Welt.'),
  c('sabo', 'Sabo', 'Die Klaue der Revolution', 'revolutionaries', 115, 88, 'Nummer zwei der Armee, Erbe der Flammenfrucht.'),
  c('kuma', 'Bartholomäus Bär', 'Der Tyrann', 'revolutionaries', 90, 80, 'Schlug Schmerz mit der Pfote weg - für andere.'),
  c('ivankov', 'Emporio Ivankov', 'Königin der Okama', 'revolutionaries', 80, 74, 'Hormone, die Wunder wirken. Vwoohoho!'),
  c('belo-betty', 'Belo Betty', 'Der Kommandant Ost', 'revolutionaries', 60, 64, 'Ihre Fahne verwandelt Bauern in Kämpfer.'),
  c('karasu', 'Karasu', 'Der Kommandant Nord', 'revolutionaries', 60, 60, 'Ein Schwarm Krähen mit Schrotflinten.'),
  c('koala', 'Koala', 'Ausbilderin', 'revolutionaries', 50, 58, 'Fischmenschen-Karate-Meisterin mit Vergangenheit.'),
  c('morley', 'Morley', 'Der Kommandant West', 'revolutionaries', 55, 56, 'Riesin, die Landschaften umgräbt.'),
  c('lindbergh', 'Lindbergh', 'Der Kommandant Süd', 'revolutionaries', 50, 54, 'Erfinder mit Katzenohren und Laserwaffen.'),
  c('inazuma', 'Inazuma', 'Die Schere', 'revolutionaries', 50, 48, 'Schneidet den Boden selbst in Form.'),
  c('hack', 'Hack', 'Der Fischmensch', 'revolutionaries', 45, 44, 'Solider Kämpfer, ehrlicher Lehrer.'),
  c('bunny-joe', 'Bunny Joe', 'Der Unbekannte', 'revolutionaries', 40, 22, 'Bekanntheitsgrad: null. Wirklich.'),

  // ------------------------------------------------------------------ royals
  c('shirahoshi', 'Shirahoshi', 'Prinzessin von Fishman Island', 'royals', 65, 85, 'Sie IST Poseidon. Eine der drei antiken Waffen.'),
  c('vivi', 'Nefeltari Vivi', 'Prinzessin von Alabasta', 'royals', 75, 78, 'Rettete ein Königreich. Für immer eine Strohhut-Nakama.'),
  c('momonosuke', 'Momonosuke', 'Shogun von Wano', 'royals', 55, 72, 'Drache, Shogun und die Stimme aller Dinge.'),
  c('elizabello', 'Elizabello II.', 'König von Prodence', 'royals', 50, 62, 'Der King Punch ist echt. Und er ist gewaltig.'),
  c('neptune', 'Neptune', 'König der Meere', 'royals', 60, 60, 'Ritter des Meeres mit einem sehr großen Dreizack.'),
  c('riku-doldo', 'Riku Doldo III.', 'König von Dressrosa', 'royals', 50, 54, 'Der König, für den ein ganzes Land blutete.'),
  c('dalton', 'Dalton', 'König von Sakura', 'royals', 50, 52, 'Bison-Zoan mit dem Rückgrat eines Bergs.'),
  c('viola', 'Viola', 'Violet', 'royals', 50, 50, 'Sieht alles auf 4000 Kilometer. Auch deine Gedanken.'),
  c('cobra', 'Nefeltari Cobra', 'König von Alabasta', 'royals', 45, 48, 'Starb für eine Frage, die niemand stellen durfte.'),
  c('hiyori', 'Kozuki Hiyori', 'Komurasaki', 'royals', 45, 46, 'Wanos Mondprinzessin hinter der Maske der Oiran.'),
  c('rebecca', 'Rebecca', 'Die unbesiegte Gladiatorin', 'royals', 45, 42, 'Gewann jeden Kampf, ohne einmal zuzuschlagen.'),
  c('kinderella', 'Kinderella', 'Die Ehefrau', 'royals', 40, 24, 'Hat sehr gut geheiratet. Das war die Leistung.'),
  c('wapol', 'Wapol', 'Der Blechtyrann', 'royals', 45, 20, 'Frisst alles, kann alles - taugt zu nichts.'),
  c('sterry', 'Sterry', 'König von Goa', 'royals', 40, 5, 'Adoptiert, verzogen, komplett wertlos. Reine Comedy.'),
];

/**
 * Optional artwork. Kept deliberately separate from game logic (and from the
 * records above) so URLs or locally hosted files can be swapped in without
 * touching the database: just map characterId -> url.
 *
 * Anything not listed here renders as procedurally generated card art, which
 * is also the fallback whenever a listed image fails to load.
 */
export const CHARACTER_IMAGES: Record<string, string> = {};
