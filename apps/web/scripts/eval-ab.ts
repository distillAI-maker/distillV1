/**
 * The blind A/B for the companion's voice (build plan, section 7): today's (v1) against the
 * engine's shared voice (v2), on 40 things the golden people wrote notes about.
 *
 *   pnpm eval:ab --yes                       writes eval/ab/<date>.html (the pairs) and <date>-key.json
 *   pnpm eval:ab --dry                       the same page with stand-in lines, no Claude, to check it
 *   pnpm eval:ab --tally eval/ab/picks.json  counts the new voice's wins against the key
 *
 * Reviewers open the page, pick the better line of each pair (sides are random, labels hidden),
 * and download their picks. The new voice ships (COMPANION_VOICE=v2) when it wins 26 of the 40
 * pairs for each reviewer and passes every hard gate: 26 is where a coin flip falls short 5% of
 * the time, so a win means something.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { readRitual, type RitualReading, type Voice } from '../lib/ai/companion';
import type { PersonContext } from '../lib/ai/person';
import { itemByKey } from '../lib/catalog/server';
import { loadGolden, type GoldenPerson } from '../src/eval/golden';

export const PAIRS = 40;
export const TO_SHIP = 26;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = new URL('../../../eval/ab/', import.meta.url);
const date = new Date().toISOString().slice(0, 10);

const envFile = new URL('../.env.local', import.meta.url);
if (!process.env.ANTHROPIC_API_KEY && existsSync(envFile))
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^ANTHROPIC_API_KEY=(.+)$/.exec(line.trim());
    if (m) process.env.ANTHROPIC_API_KEY = m[1]!.replace(/^["']|["']$/g, '');
  }

const nameOf = (i: GoldenPerson['progress']['items'][number]) =>
  i.customName ?? i.label ?? (i.itemKey ? itemByKey(i.itemKey)?.name : undefined) ?? 'Something they do';

/** What the companion is told about them, from their saved progress. */
function contextOf(p: GoldenPerson): PersonContext {
  const yours = new Set(p.progress.dayOne.yours);
  return {
    name: p.progress.name,
    idealDay: p.progress.lifeText,
    goals: p.progress.goals,
    rituals: p.progress.items.map((i) => ({
      name: nameOf(i),
      itemKey: i.itemKey,
      theirs: i.status === 'kept' || yours.has(i.id),
      letGo: i.status === 'cut',
      notes: i.notes.map((n) => n.text),
    })),
    answers: p.progress.asks.map((a) => ({ q: a.q, a: a.a })),
    picture: [],
    removed: [],
  };
}

/** A seeded shuffle, so the same day gives the same pairs and sides. */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

interface Pair {
  readonly id: string;
  readonly person: string;
  readonly thing: string;
  readonly notes: string[];
  readonly idealDay: string;
  readonly left: RitualReading | null;
  readonly right: RitualReading | null;
}

/** 40 things with notes, at most two per person, in a seeded order. */
function choose(people: GoldenPerson[]) {
  const random = rng(`ab:${date}`);
  const all = people.flatMap((p) => p.progress.items.filter((i) => i.notes.length).map((i) => ({ p, i, r: random() })));
  all.sort((a, b) => a.r - b.r);
  const per = new Map<string, number>();
  const out: typeof all = [];
  for (const x of all) {
    if (out.length >= PAIRS) break;
    if ((per.get(x.p.id) ?? 0) >= 2) continue;
    per.set(x.p.id, (per.get(x.p.id) ?? 0) + 1);
    out.push(x);
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function page(pairs: Pair[], dry: boolean): string {
  const card = (r: RitualReading | null) =>
    r ? `<p class="line">${esc(r.line)}</p>${r.thought ? `<p class="thought">${esc(r.thought)}</p>` : ''}` : '<p class="none">(no line: it failed its checks)</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voice A/B ${date}</title>
<style>
:root{--ground:#f0ece2;--ink:#11191b;--ink2:#4b4f50;--rule:rgba(17,25,27,.16);--card:#f7f4ec;--accent:#f26342}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.5 'Source Sans 3',system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 96px}h1{font:300 36px/1.05 Newsreader,Georgia,serif;letter-spacing:-.03em;margin:8px 0}
.eyebrow{font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--ink2)}
.pair{border-top:1px solid var(--rule);padding:24px 0}.ctx{color:var(--ink2);font-size:14px}.notes{font-style:italic}
.sides{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}@media(max-width:560px){.sides{grid-template-columns:1fr}}
.side{background:var(--card);padding:16px;border:2px solid transparent;cursor:pointer;text-align:left;font:inherit;color:inherit}
.side[aria-pressed=true]{border-color:var(--ink)}.line{font:400 19px/1.4 Newsreader,Georgia,serif;margin:6px 0}.thought{font-size:14px;color:var(--ink2)}
.none{color:var(--ink2);font-style:italic}.same{margin-top:8px;background:none;border:0;color:var(--ink2);text-decoration:underline;cursor:pointer;font:inherit}
.same[aria-pressed=true]{color:var(--ink);font-weight:600}
footer{position:fixed;left:0;right:0;bottom:0;background:var(--ink);color:var(--ground);padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between}
footer input{font:inherit;padding:6px 8px;border:0;min-width:0}footer button{font:600 11px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;padding:12px 16px;border:0;background:var(--accent);color:var(--ink);cursor:pointer}
</style></head><body><main>
<p class="eyebrow">Distill · blind A/B · ${date}${dry ? ' · stand-in lines' : ''}</p>
<h1>Which line is better?</h1>
<p>Each pair is one thing someone wrote about, read two ways. Sides are random. Pick the line a friend who knows them and the research would say, or "about the same".</p>
${pairs
  .map(
    (p, i) => `<section class="pair" data-id="${p.id}">
<p class="eyebrow">${i + 1} of ${pairs.length} · ${esc(p.person)} · ${esc(p.thing)}</p>
<p class="ctx">Their ideal day: ${esc(p.idealDay.slice(0, 280))}</p>
<p class="ctx notes">Their notes: ${p.notes.map(esc).join(' / ')}</p>
<div class="sides"><button class="side" data-pick="A" aria-pressed="false"><span class="eyebrow">A</span>${card(p.left)}</button>
<button class="side" data-pick="B" aria-pressed="false"><span class="eyebrow">B</span>${card(p.right)}</button></div>
<button class="same" data-pick="same" aria-pressed="false">About the same</button></section>`,
  )
  .join('\n')}
</main><footer><span id="count">0 of ${pairs.length}</span><input id="who" placeholder="Your name" aria-label="Your name"><button id="save">Download my picks</button></footer>
<script>
const picks={};const count=document.getElementById('count');
document.querySelectorAll('.pair').forEach(s=>s.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>{
s.querySelectorAll('[data-pick]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));picks[s.dataset.id]=b.dataset.pick;
count.textContent=Object.keys(picks).length+' of ${pairs.length}';})));
document.getElementById('save').addEventListener('click',()=>{const who=document.getElementById('who').value.trim()||'reviewer';
const blob=new Blob([JSON.stringify({date:'${date}',who,picks},null,2)],{type:'application/json'});const a=document.createElement('a');
a.href=URL.createObjectURL(blob);a.download='picks-${date}-'+who.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json';a.click();});
</script></body></html>`;
}

async function generate(dry: boolean) {
  const people = loadGolden();
  const chosen = choose(people);
  const client = dry ? null : new Anthropic();
  const sides = rng(`sides:${date}`);
  const pairs: Pair[] = [];
  const key: Record<string, 'A' | 'B'> = {};
  for (const [n, x] of chosen.entries()) {
    const person = contextOf(x.p);
    const ritual = { name: nameOf(x.i), itemKey: x.i.itemKey, notes: x.i.notes.map((m) => m.text) };
    const read = async (v: Voice): Promise<RitualReading | null> =>
      dry
        ? { line: v === 'v1' ? `${ritual.name}. Yours.` : `${ritual.name} is the part of your week that's only yours, and it shows in how you write about it.` }
        : readRitual(client!, { person, ritual }, v);
    const [oldLine, newLine] = [await read('v1'), await read('v2')];
    const newOnLeft = sides() < 0.5;
    const id = `p${n + 1}`;
    key[id] = newOnLeft ? 'A' : 'B';
    pairs.push({
      id,
      person: `${x.p.progress.name}, ${x.p.id.split('-')[1]}`,
      thing: ritual.name,
      notes: ritual.notes,
      idealDay: x.p.progress.lifeText,
      left: newOnLeft ? newLine : oldLine,
      right: newOnLeft ? oldLine : newLine,
    });
    process.stdout.write('.');
  }
  mkdirSync(dir, { recursive: true });
  const html = new URL(`${date}${dry ? '-dry' : ''}.html`, dir);
  writeFileSync(html, page(pairs, dry));
  // The key stays out of the page: which side is the new voice, for the tally.
  writeFileSync(new URL(`${date}${dry ? '-dry' : ''}-key.json`, dir), JSON.stringify({ date, newSide: key }, null, 2));
  console.log(`\nPairs: ${html.pathname}`);
}

/** Wins for the new voice, per reviewer; it ships at 26 of 40 for each. */
export function tally(key: Record<string, 'A' | 'B'>, picks: Record<string, 'A' | 'B' | 'same'>) {
  let wins = 0;
  let losses = 0;
  let same = 0;
  for (const [id, newSide] of Object.entries(key)) {
    const pick = picks[id];
    if (pick === 'same') same++;
    else if (pick === newSide) wins++;
    else if (pick) losses++;
  }
  return { wins, losses, same, ships: wins >= TO_SHIP };
}

async function main() {
  const picksFile = value('--tally');
  if (picksFile) {
    const picks = JSON.parse(readFileSync(picksFile, 'utf8')) as { date: string; who: string; picks: Record<string, 'A' | 'B' | 'same'> };
    const key = JSON.parse(readFileSync(new URL(`${picks.date}-key.json`, dir), 'utf8')) as { newSide: Record<string, 'A' | 'B'> };
    const t = tally(key.newSide, picks.picks);
    console.log(`${picks.who}: the new voice won ${t.wins}, lost ${t.losses}, ${t.same} about the same. ${t.ships ? `Ships (${TO_SHIP} needed).` : `Doesn't ship yet (${TO_SHIP} needed).`}`);
    return;
  }
  if (flag('--dry')) return generate(true);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('This needs ANTHROPIC_API_KEY (in the environment or apps/web/.env.local), or --dry for stand-in lines.');
    process.exitCode = 1;
    return;
  }
  if (!flag('--yes')) {
    console.log(`This writes ${PAIRS * 2} lines with Claude: about $${(PAIRS * 2 * 0.02).toFixed(2)}. Add --yes to spend it.`);
    return;
  }
  return generate(false);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
