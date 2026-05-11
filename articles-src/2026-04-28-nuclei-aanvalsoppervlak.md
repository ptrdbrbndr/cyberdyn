---
title: "Nuclei: aanvalsoppervlak in kaart brengen over 35 FQDNs"
date: 2026-04-28
summary: "Nuclei scant op bekende kwetsbaarheden, misconfiguraties en blootgestelde endpoints. Hoe we het wekelijks inzetten op de volledige Ductus-portfolio en wat het oplevert."
tag: RECON
readtime: 6
---

## Wat is een aanvalsoppervlak?

Elke FQDN die je in productie hebt is een potentieel aanvalspad. Een vergeten test-endpoint, een misconfigureerde CORS-header, een verouderde TLS-versie — dit zijn de dingen die Nuclei vindt.

De Ductus-stack heeft 35 actieve FQDNs, verspreid over twee Beelinks en Vercel. Handmatig bijhouden is niet schaalbaar.

## Hoe Nuclei werkt

Nuclei werkt met templates: YAML-bestanden die beschrijven wat er gescand moet worden. De community onderhoudt meer dan 7.000 templates. Je kiest welke je draait op basis van severity en categorie.

```bash
nuclei -l targets.txt \
  -severity medium,high,critical \
  -tags exposure,misconfig,cve \
  -o /var/log/nuclei/$(date +%Y%m%d).txt
```

Elke template test één specifiek patroon. Dat maakt false positives zeldzaam en de output actionable.

## Onze targets.txt

```
portal.conductus.nl
iductus.nl
liefdevolleblik.nl
coolify.cyberductus.nl
supabase-conductus.cyberductus.nl
[... 30 meer ...]
```

De lijst wordt beheerd in `/opt/security-audits/nuclei/targets.txt` op B1 en bijgewerkt wanneer een nieuw project live gaat.

## Wat Nuclei vindt — en wat niet

**Vindt wel:**
- Exposed admin panels (`/admin`, `/_next/`, `/swagger-ui`)
- Verouderde TLS-versies (TLS 1.0/1.1)
- Misconfigureerde security-headers (ontbrekende CSP, X-Frame-Options)
- Bekende CVEs in web-software

**Vindt niet:**
- Logische kwetsbaarheden in je eigen code
- Auth-bypass die authenticatie vereist om te testen
- Business logic fouten

Voor die laag: Semgrep (SAST) en ZAP (authenticated scan) — gepland voor Q3 2026.

## Resultaten: eerste maand

35 targets, wekelijkse run, eerste maand:

- 0 critical findings
- 3 medium findings: ontbrekende `X-Content-Type-Options` headers op twee Vercel-deployments en één Beelink-app
- 12 informational: server-version disclosure in nginx headers

De headers zijn gecorrigeerd. Server-version disclosure staat op de backlog voor de volgende Lynis-ronde.

## Integratie met de Ductus-workflow

Nuclei draait elke vrijdag 02:00 UTC via cron op B1. Output naar `/var/log/nuclei/`. Een simpel script stelt een Slack-notificatie samen als er findings zijn met severity ≥ medium.

Bij 0 findings: stille run. Bij findings: directe Slack-alert met target, template-id en severity.
