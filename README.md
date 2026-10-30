# LeaLand FargePop v2

Lag egne fargeleggingsbilder med AI, og bruk dem på fire måter: fargelegg på skjerm, tegn av på
lysbord (iPad/nettbrett), projiser ned på papir eller vegg, eller skriv ut. Laget for barn 6–12 år.

Dette er en full ombygging av [v1](https://github.com/readymedia/LeaLandColorPop). Ingen kode er gjenbrukt,
men alle funksjonene er med, og flere er kommet til.

## Stack

| Del | Valg | Hvorfor |
|---|---|---|
| Rammeverk | **Next.js 16** (App Router) + **React 19** + TypeScript | Førsteklasses på Vercel, server-ruter for API-nøkler, statisk forside |
| Design | **Designsystemet** (`@digdir/designsystemet-react` 1.23) med eget tema (`designsystemet.config.json`) | Tilgjengelige komponenter, tokens, lys modus; eget barnevennlig tema |
| Fonter | Baloo 2 (overskrifter) + Nunito (tekst), selvhostet via Fontsource | Ingen kall til Google Fonts (personvern for barn) |
| Bildemodell | **Nano Banana 2.1** (`gemini-nano-banana-2.1`, GA okt. 2026) med fallback til `gemini-3.1-flash-lite-image` | Nyeste Google-modell, bedre strektegninger og redigering, 2K-oppløsning |
| Tilstand | Zustand (innstillinger i localStorage) | Lett, enkel |
| Lokale bilder | IndexedDB (`idb-keyval`) | «Mine bilder» og fargelegging overlever oppdatering og omstart |
| Kunstveggen | Vercel Blob (bilder) + Upstash Redis (metadata, stemmer, sortering) | Atomiske tellere, skalerer, ingen race conditions |
| Rate limiting | `@upstash/ratelimit` | Beskytter API-kvoten |
| Analyse | Vercel Analytics (cookiefri) | |

## Hva er nytt og rettet i forhold til v1

**Sikkerhet og drift**
- Gemini-nøkkelen lå i JavaScript-bunten i v1 (Vite `define`), så alle kunne lese den. Nå brukes den bare på serveren (`/api/generate`).
- Innholdssjekk i tre lag: ordliste (klient og server), valgfri klassifisering med Gemini, og Googles sikkerhetsfiltre.
- Brukerens tekst legges i prompten som en beskrivelse, ikke som instruksjoner (vern mot prompt injection).
- Rate limiting per enhet, validering av alle API-kall (zod) og kontroll av «magic bytes» på opplastede bilder.
- Kunstveggen modereres: delte bilder vises først når en voksen har godkjent dem i `/admin`. Bilder deles ikke lenger automatisk ved generering.
- `node_modules` og `dist` er ikke lenger sjekket inn.

**Fargelegging** (ny motor: `src/features/coloring/engine/`)
- Strekene ligger i et eget lag øverst, så farge kan aldri dekke dem.
- Malingsbøtta bruker scanline-fyll (mye raskere), lukker små hull i strekene så fargen ikke lekker, og gir ikke hvite kanter.
- Bøtta fyller etter strekene, ikke etter det som allerede er malt, så man kan male om et område med ett trykk.
- Angre/gjør om lagrer bare det som endret seg (60 steg, ingen flimring). Tastatur: Ctrl/Cmd+Z, Ctrl+Y.
- Zoom og flytt med to fingre, med hjul + Ctrl eller med mellomrom + dra. Innstillingen «Kun pennen tegner» lar hånden hvile på skjermen.
- Trykkfølsomhet for Apple Pencil, jevne kurver og coalesced events.
- Nye verktøy: fargestift med papirkorn, glitter, regnbuepensel og emoji-stempler. Mønstre virker både med pensel og bøtte.
- Fargelaben blander som ekte maling (gult + blått = grønt), har hvit og svart, og gir fargen et navn. Egne farger huskes.
- Autolagring til enheten, så man kan fortsette senere.

**Lysbord og projektor**
- Skjermen holdes våken (Wake Lock), og det finnes fullskjerm.
- Låsen krever langt trykk for å låses opp, så en hånd på arket ikke låser opp ved et uhell.
- Speilvending, rutenett, tykkere streker (gjennom tykt papir) og lyse streker på mørk bakgrunn.
- **Projektor:** rett opp et skjevt bilde ved å dra de fire hjørnene (perspektivkorrigering). Justeringen huskes.
- **Egen projektorskjerm:** åpner et rent vindu som dras over til projektoren og styres fra hovedvinduet. Dette erstatter Chromecast-planen, og krever ingen Cast-konto.

**Annet**
- Valg av vanskelighetsgrad (enkel / middels / mye detaljer) og stil (tegneserie, eventyrbok, kawaii, mønster).
- Opplasting av egen tegning eller foto av en malebok, som renses til svart/hvit strek.
- Historiebyggeren («hvem / gjør hva / hvor / ekstra»).
- Utskrift av bare tegningen, tilpasset arket.
- Visningen ligger i URL-en, så tilbake-knappen, oppdatering og lenker fungerer.
- Kan installeres på iPad (Legg til på Hjem-skjerm) og kjører da i fullskjerm.
- Norsk og engelsk.

## Kom i gang lokalt

```bash
npm install
cp .env.example .env.local   # legg inn GEMINI_API_KEY
npm run dev
```

`npm test` kjører enhetstester for fyll-algoritmen, fargemiksing og perspektivkorrigering.

## Publisering på Vercel

1. Importer `readymedia/LeaLandColorPopV2` som nytt prosjekt i Vercel. Framework preset: **Next.js**, ingen andre innstillinger.
2. **Environment Variables:** legg inn `GEMINI_API_KEY` (påkrevd). Se `.env.example` for valgfrie variabler.
3. **Kunstveggen (valgfritt, men anbefalt):**
   - Storage → Create → **Blob**. Koble til prosjektet, så settes `BLOB_READ_WRITE_TOKEN`.
   - Storage / Marketplace → **Upstash for Redis**. Koble til prosjektet, så settes `KV_REST_API_URL` og `KV_REST_API_TOKEN`. Dette slår også på rate limiting.
   - Sett `ADMIN_TOKEN` til en lang tilfeldig streng (minst 12 tegn). Godkjenn bilder på `/admin`.
4. Deploy. Uten Blob/Redis fungerer alt unntatt Kunstveggen, som da viser en melding om at den ikke er slått på.

Genereringsruten har `maxDuration = 60` sekunder, som er innenfor Vercels standardgrenser.

## Struktur

```
src/
  app/                 sider og API-ruter (generate, gallery, admin, projector)
  components/          app-skall, header, logo
  features/
    create/            prompt, historiebygger, venteskjerm, forhåndsvisning
    coloring/          fargeleggingsskjerm + engine/ (fyll, historikk, pensler, mønstre)
    trace/             lysbord, projektor, keystone, projektor-vindu
    mixer/             fargelab (RYB-miksing)
    library/           Mine bilder (IndexedDB)
    gallery/           Kunstveggen
  lib/                 AI, sikkerhet, Redis, galleri-lager, i18n, bildeverktøy
  styles/              globale stiler + generert Designsystemet-tema
```

Temaet endres i `designsystemet.config.json`, og bygges på nytt med `npm run theme`.
