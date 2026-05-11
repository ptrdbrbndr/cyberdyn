# Design — Cyberdyn artikel-reeks + corporate redesign

**Datum**: 2026-05-11
**Status**: Goedgekeurd

---

## Scope

Dit document beschrijft drie samenhangende onderdelen:

1. **Corporate redesign** van cyberdyn.nl (Professional Dark)
2. **demo.cyberdyn.nl** — Matrix-versie als living demo
3. **INTEL-artikelreeks** — Deep Dives (publiek) + Security Logboek (intern) + State of Security (e-mail)
4. **Resend-integratie** — werkende waitlist-funnel richting Circumductus

---

## 1. Corporate redesign — cyberdyn.nl

### Palette

| Token | Waarde |
|---|---|
| Achtergrond | `#0f1117` |
| Surface | `#1a1e2e` |
| Border | `#1e2130` |
| Accent (rood) | `#e8472a` |
| Tekst primair | `#ffffff` |
| Tekst secundair | `#8892a4` |
| Tekst subtiel | `#4a5568` |

Referentie-stijl: CrowdStrike / SentinelOne — gezaghebbend, donker, geen terminal-gimmicks.

### Structuur

```
public/
├── index.html          ← corporate landing (vervangt huidige)
├── articles/
│   ├── index.html      ← INTEL-overzicht (gegenereerd)
│   └── [slug].html     ← individuele artikelen (gegenereerd)
└── assets/
    ├── article.css     ← gedeelde stijl artikelen
    └── main.css        ← gedeelde stijl site (optioneel extract)
```

### Navigatie

```
CYBERDYN  [logo/wordmark]          Product · Intel · Contact
```

### Paginastructuur index.html

1. Nav
2. Hero — tagline + subkop + CTA "Vroege toegang →"
3. Drie module-cards (RECON · CODE · SOC) in `#1a1e2e`, rode top-border
4. Status-blok (live scan-feed, identiek aan huidige maar in corporate stijl)
5. Email-signup — POST naar `/api/waitlist`
6. Footer — zakelijk, geen terminal-prompt

---

## 2. demo.cyberdyn.nl

De huidige Matrix/hacker-versie blijft beschikbaar als demo en referentie.

```
public-demo/
└── index.html          ← huidige index.html (ongewijzigd)
```

**Infra:**
- Aparte Coolify-app op B1, serveert `public-demo/`, poort 81
- CF Tunnel extra ingress: `demo.cyberdyn.nl → https://localhost:81` (noTLSVerify)
- CF DNS: `demo.cyberdyn.nl CNAME → [tunnel-id].cfargotunnel.com` (proxied)

---

## 3. INTEL-artikelreeks

### Drie lagen

| Laag | Publiek | Distributie | Locatie |
|---|---|---|---|
| Deep Dives | Iedereen | cyberdyn.nl/articles/ | `articles-src/*.md` → `public/articles/` |
| State of Security | Klanten + inner circle | Resend e-mail (kwartaal) | `state-of-security-src/*.md` → HTML-mail |
| Security Logboek | Intern | Markdown in docs | `cyberductus.nl/docs/agent-log/` (bestaand) |

### Build pipeline — Markdown → HTML

```
articles-src/
├── 2026-05-11-gitleaks-deep-dive.md
└── 2026-04-28-nuclei-aanpak.md
```

**Frontmatter per artikel:**
```yaml
---
title: "Gitleaks: secrets scannen voordat ze de repo in gaan"
date: 2026-05-11
summary: "Hoe pre-commit hooks en Gitea Actions samenwerken..."
tag: RECON        # RECON | CODE | SOC | HOST
readtime: 8       # minuten
---
```

**Build-script:** `build-articles.mjs`
- Dependency: `marked` (markdown parser)
- Leest alle `.md` in `articles-src/`, parseert frontmatter
- Genereert `public/articles/[slug].html` via inline HTML-template
- Genereert `public/articles/index.html` (overzicht, gesorteerd op datum)
- Run: `npm run build` (pre-deploy stap)

**package.json scripts:**
```json
{
  "build": "node build-articles.mjs",
  "watch": "node --watch build-articles.mjs"
}
```

### Artikel-template (Professional Dark)

- Zelfde palette als corporate site
- Brede leestekst (`max-width: 720px`), ruime regelafstand
- Code-blokken in `#0a0c10` met rode rand links
- Tag-badge in rood bovenaan
- Terug-link naar `/articles/`

---

## 4. Resend-integratie + Circumductus-funnel

### API-endpoint

Klein Express-endpoint op B1, apart Coolify-service:

```
POST /api/waitlist
Body: { email: string, source: "cyberdyn" | "demo" }

Response 200: { ok: true }
Response 400: { error: "invalid email" }
```

**Acties bij subscribe:**
1. INSERT in Supabase `waitlist` tabel: `(email, source, created_at)`
2. Resend: voeg toe aan audience `cyberdyn-waitlist`
3. (Fase 2) Circumductus-webhook voor CRM-pipeline

### Supabase tabel

Gebruikt de bestaande **cyberductus** Supabase-stack op B1 (intern — geen klantdata, geen AVG-bezwaar). Eigen stack pas bij productisering.

```sql
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'cyberdyn',
  created_at timestamptz not null default now()
);
-- Retentie: zolang contact actief blijft; verwijderbaar via account-delete flow
```

### State of Security e-mail (kwartaal)

- Geschreven als markdown in `state-of-security-src/`
- Omgezet naar HTML via `build-articles.mjs` (zelfde pipeline, andere template)
- Verzonden via Resend naar audience `cyberdyn-waitlist`
- Cadans: 1e van elk kwartaal (maart, juni, september, december)

---

## 5. Buiten scope

- CMS of admin-interface
- RSS-feed (toevoegen zodra er 5+ artikelen zijn)
- Authenticatie op articles (Deep Dives zijn publiek)
- Circumductus-integratie (Fase 2, apart design-doc)

---

## Afhankelijkheden

- B1 Supabase-stack voor `waitlist` tabel
- Resend account + `cyberdyn-waitlist` audience
- CF DNS: `demo.cyberdyn.nl` CNAME
- CF Tunnel: extra ingress-regel voor demo.cyberdyn.nl
- Coolify: aparte app voor demo + aparte app voor waitlist-API
