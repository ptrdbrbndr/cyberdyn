---
title: "Semgrep: jouw eigen code bugs vinden met pattern-matching op de AST"
date: 2026-04-07
summary: "Hoe Semgrep met YAML-regels op de AST onveilige patronen in je eigen code vindt — daar waar Trivy stopt bij bekende CVEs in dependencies."
tag: CODE
readtime: 8
---

## SAST is niet hetzelfde als dependency-scanning

Trivy is uitstekend in één ding: kwetsbare versies van bestaande pakketten vinden. Hij vergelijkt `package-lock.json` met de NVD-database en zegt "axios 1.6.7 heeft CVE-2024-39338". Maar Trivy weet niets over de code die je zelf schrijft.

Static Application Security Testing — SAST — vult dat gat. Een SAST-tool leest jouw broncode, niet je dependencies, en zoekt naar onveilige patronen die niemand ooit als CVE zal publiceren omdat ze uniek zijn voor jouw applicatie: een `dangerouslySetInnerHTML` met user-input, een Supabase-query met string-interpolatie, een API-route zonder auth-check.

Semgrep is in dat veld de open-source-keuze. Eén binary, regels in YAML, snel genoeg om in pre-commit te draaien.

## Hoe Semgrep werkt onder de motorkap

Klassieke regex-scanners zoeken op tekst. Dat is een ramp voor code, omdat `eval("..." + userInput)` en `eval(\n  "..." + userInput\n)` syntactisch identiek zijn maar tekstueel verschillen. Semgrep parseert je code eerst naar een AST (Abstract Syntax Tree) en matcht patronen op die boom.

Een Semgrep-regel ziet er zo uit:

```yaml
rules:
  - id: react-dangerously-set-inner-html
    pattern: |
      <$EL dangerouslySetInnerHTML={{ __html: $X }} />
    pattern-not: |
      <$EL dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(...) }} />
    message: |
      dangerouslySetInnerHTML zonder DOMPurify.sanitize() — XSS-risico.
      Gebruik DOMPurify of vermijd HTML-injectie volledig.
    languages: [tsx, jsx]
    severity: ERROR
```

`$EL` en `$X` zijn metavariables — ze matchen elk JSX-element en elke expressie. `pattern-not` sluit de veilige variant met `DOMPurify.sanitize` uit. Geen false positive op de plek waar je het al goed doet.

De equivalent voor SQL-injection in een Supabase-flow:

```yaml
rules:
  - id: supabase-sql-string-interpolation
    pattern-either:
      - pattern: supabase.rpc(`...${$X}...`)
      - pattern: supabase.from($T).select(`...${$X}...`)
    message: |
      String-interpolatie in Supabase-call. Gebruik parameter-binding
      via .eq(), .filter() of een rpc-functie met named params.
    languages: [typescript]
    severity: ERROR
```

Dit vangt het patroon ongeacht witruimte, variabelennamen of import-aliassen — iets wat geen regex op een redelijke termijn lukt.

## De Semgrep Registry

Je hoeft niet alles zelf te schrijven. De [Semgrep Registry](https://semgrep.dev/r) bevat ruim 3000 community-onderhouden regels, verdeeld over:

- **security** — OWASP Top 10, CWE-mappings, framework-specifieke kwetsbaarheden
- **correctness** — bugs die geen security zijn maar wel kapot: vergeten `await`, unreachable code, type-mismatches
- **performance** — onnodige re-renders in React, N+1-queries, sync I/O in async context
- **best-practice** — stijl- en convention-checks

Een typische Next.js/TypeScript-stack activeert pakketten zoals `p/typescript`, `p/react`, `p/nextjs`, `p/owasp-top-ten` en `p/javascript`. Samen circa 400 actieve regels — genoeg voor de eerste laag, geen overload.

## Een scan op een echte Next.js-app

Het commando spreekt voor zich:

```bash
$ semgrep scan --config p/nextjs --config p/owasp-top-ten src/

┌──────────────────────────────────────────────────────────────────┐
│ Scanning 247 files                                               │
└──────────────────────────────────────────────────────────────────┘

src/app/api/users/[id]/route.ts
❯❯❯ javascript.express.security.audit.express-cookie-session-no-secure
    ERROR  Session cookie missing 'secure: true' flag
    42┆ res.cookie('session', token, { httpOnly: true })

src/components/ArticleBody.tsx
❯❯❯ typescript.react.security.audit.react-dangerouslysetinnerhtml
    ERROR  Untrusted input in dangerouslySetInnerHTML
    18┆ <div dangerouslySetInnerHTML={{ __html: article.body }} />

src/lib/search.ts
❯❯❯ typescript.supabase.security.sql-injection-rpc
    ERROR  String-interpolation in supabase.rpc()
    27┆ const { data } = await supabase.rpc(`search_${type}`, { q })

┌────────────────┐
│ Scan Summary   │
├────────────────┤
│ Findings:    3 │
│ Rules:     412 │
│ Time:    4.1s  │
└────────────────┘
```

Drie findings, vier seconden, geen build-stap nodig. Elk findings-blok bevat: bestand, regelnummer, rule-id (waarmee je naar de regel-definitie kunt), severity en de exacte regel die het probleem veroorzaakt.

## Integratie in Gitea Actions

Patroon voor de Ductus-stack: scan op elke push naar een feature-branch, blokkeer merge naar `staging` of `main` bij ERROR (≈ CRITICAL/HIGH).

```yaml
- name: Semgrep SAST
  uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/nextjs
      p/react
      p/typescript
      p/owasp-top-ten
      .semgrep/custom.yml
    severity: ERROR
    error: true
    sarif: semgrep-results.sarif

- name: Upload SARIF to Gitea Security
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: semgrep-sarif
    path: semgrep-results.sarif
```

`.semgrep/custom.yml` bevat de Ductus-specifieke regels: een check op `createClient` zonder `flowType: 'pkce'`, een check op API-routes zonder auth-guard, een check op `console.log` met user-data. Die staan los van de community-pakketten zodat updates van de registry de eigen regels niet overschrijven.

## Wat Semgrep niet vindt

Semgrep is een statische analyzer. Hij ziet de vorm van je code, niet wat er runtime gebeurt:

- **Authenticatie-logica** — of de check correct is bij de juiste resource (broken access control, OWASP A01) ziet hij niet
- **Business-logic-fouten** — een race condition tussen twee API-calls, of een bedrag dat negatief kan worden, vereist begrip van de bedoeling
- **Runtime-injecties** — een rule die op `eval` matcht zegt niets over wat er werkelijk door `eval` heen gaat in productie
- **State-machines** — workflows met tijdsafhankelijk gedrag (Conductus' Flowable-cases) zijn buiten scope

Voor die categorieën: handmatige code-review, threat-modeling, en runtime-tooling zoals Falco of OWASP ZAP. Semgrep is de eerste laag — goedkoop, snel, en hij vangt 60-70% van de patronen die in production-incidenten terechtkomen.

## Geplande uitrol op de Ductus-stack

Volgens het security-tooling-stappenplan: Semgrep gaat live in **week 23** van 2026 (eerste week juni). Eerst op de vier high-priority Beelink-projecten — Conductus, Iductus, Liefdevolle Blik, Omniductus — met `p/nextjs + p/owasp-top-ten + .semgrep/custom.yml`. Findings van de eerste run gaan naar `docs/audits/2026-W23-semgrep-baseline.md` per project. Daarna wekelijkse delta-scan via Gitea Actions, en pas zodra de baseline 0 ERROR-findings is, wordt de merge-blokkering geactiveerd. Dezelfde fasering die Trivy doorlopen heeft: rapporteren, opschonen, dán afdwingen.
