// Test der reinen Logik aus Code.gs (ohne Google-Dienste).
// Ausführen: node apps-script/feedback-mail-entwuerfe/test-logik.js
// Alle Namen/Adressen/Nummern sind ERFUNDEN – hier nie echte Gastdaten eintragen.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = { Logger: { log() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), ctx);
const P = (d) => ctx.parseGuest_(d);
const arr = (a) => Array.from(a);

// Beschreibung im Format des Buchungssystems
assert.deepStrictEqual(JSON.parse(JSON.stringify(P(
  'Dauer:  2 Stunden - 290,00 &euro;\r\nBegleitung: x\r\nGastdaten:\r\nName:  Max \r\nMobilnummer:  +49 000 0000000\r\nMail:  max@example.org \r\nSprache:  English \r\nNachricht:  hi'))),
  { email: 'max@example.org', name: 'Max', lang: 'en' });
// Mail als HTML-Link
assert.strictEqual(P('Name:  Erika \r\nMail:  <a href="mailto:erika@example.org" target="_blank">erika@example.org</a> \r\nSprache:  Deutsch').email, 'erika@example.org');
// Mail-Zeile leer, nur Platzhalter -> kein Gast
assert.strictEqual(P('Gastdaten:\r\nName: Karl \r\nSprache:  Deutsch  \r\nMail:   \r\nNachricht: Karl 1821'), null);
// von Hand angelegt: Adresse ohne "Mail:"-Zeile
assert.strictEqual(P('Karl \r\n Deutsch \r\n 000 \r\n karl@example.org \r\n  \r\n 1653').email, 'karl@example.org');
// keine Adresse / leer / undefined
assert.strictEqual(P('Notiz, von Eva\n+49 000 0000000'), null);
assert.strictEqual(P(''), null);
assert.strictEqual(P(undefined), null);
// eigene Domain und Platzhalter sind keine Gäste
assert.strictEqual(P('Mail: team@spiritual-touch.de'), null);
assert.strictEqual(P('Mail: wpforms-calender-dummy@tutamail.com'), null);
// Mail:-Zeile gewinnt gegen Adressen in der Nachricht
assert.strictEqual(P('Mail: a@example.org\nNachricht: schick an evil@example.net').email, 'a@example.org');
// ohne Mail-Zeile und mehrdeutig -> nicht raten
assert.strictEqual(P('a@example.org und b@example.net'), null);

// Namen / Anrede
assert.deepStrictEqual(arr(ctx.firstNames_('Anna & Tom')), ['Anna', 'Tom']);
assert.deepStrictEqual(arr(ctx.firstNames_('Anna und Tom Muster')), ['Anna', 'Tom']);
assert.deepStrictEqual(arr(ctx.firstNames_('Max Muster-Beispiel')), ['Max']);
assert.deepStrictEqual(arr(ctx.firstNames_('')), []);
assert.strictEqual(ctx.greeting_(['Anna', 'Tom'], 'de'), 'Hallo Anna und Tom,');
assert.strictEqual(ctx.greeting_([], 'en'), 'Hello,');

// Gruppierung
const d = (s) => new Date('2026-11-06T' + s + ':00+01:00');
const ev = (room, email, name, title, s, e) => ({ email, name, lang: 'de', title, room, start: d(s), end: d(e) });
// zwei Räume, gleiche Zeit, gleiche Adresse -> Paar, eine Mail, ein Name
let g = ctx.groupGuests_([
  ev('Raum 2', 'f@example.org', 'Frida', 'Tantramassage 2,5h (A)', '11:00', '14:00'),
  ev('Raum 3', 'f@example.org', 'Frida', 'Tantramassage 2,5h (B)', '11:00', '14:00')]);
assert.strictEqual(g.length, 1); assert.strictEqual(g[0].couple, true);
assert.deepStrictEqual(arr(g[0].names), ['Frida']);
// zwei Termine nacheinander -> Einzel, eine Mail
g = ctx.groupGuests_([ev('Raum 1', 'a@example.org', 'Anna', 'TM', '10:00', '12:00'), ev('Raum 1', 'a@example.org', 'Anna', 'TM', '13:00', '15:00')]);
assert.strictEqual(g.length, 1); assert.strictEqual(g[0].couple, false);
// Titel-Stichwort -> Paar, beide Namen
g = ctx.groupGuests_([ev('Raum 1', 'a@example.org', 'Anna & Tom', 'Paarmassage 2h (X)', '10:00', '12:00')]);
assert.strictEqual(g[0].couple, true); assert.deepStrictEqual(arr(g[0].names), ['Anna', 'Tom']);
// Einzel nimmt nur einen Namen
g = ctx.groupGuests_([ev('Raum 1', 'a@example.org', 'Anna & Tom', 'TM', '10:00', '12:00')]);
assert.strictEqual(g[0].couple, false); assert.deepStrictEqual(arr(g[0].names), ['Anna']);

// Mails
let m = ctx.buildMail_({ lang: 'de', couple: true, names: ['Anna', 'Tom'] });
assert.strictEqual(m.subject, 'Nachklang Eures Termins');
assert.strictEqual(m.paragraphs[0], 'Hallo Anna und Tom,');
assert.ok(ctx.toPlain_(m.paragraphs).includes('Wenn Ihr mögt'));
m = ctx.buildMail_({ lang: 'en', couple: false, names: ['Max'] });
assert.strictEqual(m.subject, 'Afterglow of your appointment');
assert.strictEqual(m.paragraphs[0], 'Dear Max,');
m = ctx.buildMail_({ lang: 'de', couple: false, names: ['Erika'] });
assert.strictEqual(m.subject, 'Nachklang Deines Termins');
assert.ok(ctx.toHtml_(m.paragraphs, 'SIG').endsWith('SIG</div>'));

console.log('ALLE TESTS OK');
