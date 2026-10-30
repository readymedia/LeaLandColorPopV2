/**
 * Innholdssjekk for barn (6–12 år).
 *
 * Lag 1 (alltid): rask ordliste på normalisert tekst, NO + EN. Kjører både i nettleseren
 * (umiddelbar tilbakemelding) og på serveren (kan ikke omgås).
 * Lag 2 (server, valgfritt): klassifisering med en liten Gemini-tekstmodell – se lib/ai/gemini.ts.
 * Lag 3: Googles egne sikkerhetsfiltre på bildemodellen.
 */

/** Blokkeres hvor som helst i teksten (også som del av sammensatte ord). */
const BLOCKED_STEMS = [
  // norsk
  'faen', 'helvete', 'jævl', 'jaevl', 'kukk', 'fitte', 'pikk', 'drepe', 'drept', 'mord',
  'kniv', 'pistol', 'gevær', 'gevaer', 'våpen', 'vaapen', 'skyte', 'terror', 'bombe',
  'naken', 'nakne', 'sex', 'pupp', 'narkotika', 'sigarett', 'alkohol', 'selvmord',
  'nazi', 'hakekors', 'rasist', 'blodig',
  // engelsk
  'fuck', 'shit', 'bitch', 'pussy', 'murder', 'weapon', 'naked', 'porn', 'cocaine', 'alcohol',
  'suicide', 'corpse', 'swastika', 'bloody',
];

/** Blokkeres bare som hele ord (korte ord som ellers gir falske treff, f.eks. «Gunnar»). */
const BLOCKED_WORDS = [
  'hore', 'drep', 'dritt', 'blod', 'lik', 'liket', 'fyll', 'full', 'øl', 'vin', 'sprit', 'død', 'dod',
  'kill', 'gun', 'guns', 'rifle', 'knife', 'shoot', 'blood', 'nude', 'drug', 'drugs', 'beer', 'wine',
  'gore', 'dick', 'cock', 'dead', 'die',
];

// Uskyldige ord som inneholder et blokkert stamme-ord.
const ALLOWED_WORDS = ['blodappelsin', 'kniplinger', 'skytestjerne', 'stjerneskudd'];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPromptAllowed(text: string): boolean {
  let t = normalize(text);
  for (const ok of ALLOWED_WORDS) t = t.split(normalize(ok)).join(' ');
  if (BLOCKED_STEMS.some((stem) => t.includes(normalize(stem)))) return false;
  const words = new Set(t.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  return !BLOCKED_WORDS.some((w) => words.has(normalize(w)));
}

export const MAX_PROMPT_LENGTH = 240;

/** Rydder brukertekst før den brukes i prompt eller lagres. */
export function sanitizePrompt(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f<>`{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
}

/** Kallenavn for galleri: kun fornavn/kallenavn, ingen kontaktinfo. */
export function sanitizeNickname(name: string): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N} \-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  if (!cleaned || !isPromptAllowed(cleaned)) return 'Anonym kunstner';
  return cleaned;
}
