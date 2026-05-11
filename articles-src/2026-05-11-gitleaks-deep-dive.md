---
title: "Gitleaks: secrets scannen voordat ze de repo in gaan"
date: 2026-05-11
summary: "Hoe pre-commit hooks en Gitea Actions samenwerken om API-keys en tokens te onderscheppen — vóórdat ze in git-history belanden en onverwijderbaar zijn."
tag: RECON
readtime: 7
---

## Het probleem met git-history

Een API-key die per ongeluk in een commit belandt is niet zomaar verwijderd. `git rm` verwijdert het bestand, maar de key staat nog steeds in de commit-history. Iedereen met leestoegang tot de repo — nu of in de toekomst — kan hem uitlezen.

Gitleaks onderschept dit vóór de commit plaatsvindt.

## Hoe Gitleaks werkt

Gitleaks scant op patronen: reguliere expressies voor bekende token-formaten (Anthropic, Cloudflare, Stripe, JWT, AWS, GitHub) én custom regels die je zelf definieert voor je eigen stack.

```bash
$ gitleaks protect --staged --redact
► Finding:     rule=anthropic-api-key
  File:        .env
  Line:        12
  Secret:      sk-ant-***REDACTED***
```

De pre-commit hook stopt de commit direct. De ontwikkelaar ziet de exacte locatie en kan corrigeren vóór push.

## Twee verdedigingslagen

**Laag 1 — Pre-commit hook (lokaal)**

Draait op de machine van de ontwikkelaar. Stopt de commit als er secrets gevonden worden. Vereist dat Gitleaks lokaal geïnstalleerd is.

```bash
#!/bin/sh
gitleaks protect --staged --redact --exit-code 1
```

Geplaatst in `.git/hooks/pre-commit` en `chmod +x`.

**Laag 2 — Gitea Actions (CI)**

Vangt gevallen op waarbij de hook ontbrak of omzeild werd. Draait op elke push.

```yaml
- name: Gitleaks scan
  run: |
    gitleaks detect \
      --source . \
      --config .gitleaks.toml \
      --redact \
      --exit-code 1
```

## Custom regels voor de Ductus-stack

De standaard Gitleaks-regels dekken bekende third-party tokens. Wij voegen regels toe voor onze eigen patronen:

```toml
[[rules]]
id = "cloudflare-tunnel-token"
description = "Cloudflare Tunnel token"
regex = '''cfut_[A-Za-z0-9\-_]{40,}'''
tags = ["cloudflare", "tunnel"]

[[rules]]
id = "anthropic-api-key"
description = "Anthropic API key"
regex = '''sk-ant-[A-Za-z0-9\-_]{40,}'''
tags = ["anthropic", "ai"]
```

## Resultaten op de Ductus-stack

Na de pilot op coductus.nl: 0 findings in de bestaande history. De pre-commit hook blokkeerde in de eerste week 2 commits waarbij `.env`-bestanden per ongeluk gestaged waren.

De wekelijkse Gitleaks-cron op B1 scant alle 85 repositories in de portfolio. Findings gaan naar `/var/log/gitleaks/` en triggeren een Slack-notificatie.

## Wanneer Gitleaks niet helpt

Gitleaks scant tekst. Het mist:
- Secrets die base64-geëncrypt zijn
- Credentials die via environment-variabelen komen maar nooit in code staan
- Secrets in binary bestanden

Voor die gevallen: Trivy (dependency-scan) en periodieke secret-rotatie als compenserende maatregelen.
