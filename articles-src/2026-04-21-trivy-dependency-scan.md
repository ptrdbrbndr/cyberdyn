---
title: "Trivy: kwetsbare dependencies vinden voor ze in productie staan"
date: 2026-04-21
summary: "Hoe Trivy container-images, lockfiles en IaC-configs scant tegen NVD, OSV en GitHub Advisory — en wat dat oplevert op de Ductus-stack."
tag: CODE
readtime: 7
---

## Wat Trivy scant

Een moderne Next.js-app sleept honderden transitive dependencies mee. Een Docker-image bovenop `node:20-slim` brengt daar nog eens een paar honderd OS-packages bij. Elk pakket is een potentiële ingang.

Trivy — van Aqua Security, inmiddels de industriestandaard voor container-scanning — scant drie lagen tegelijk:

1. **Container-images** — OS-packages (apk, apt, rpm) én language-deps die in de image zijn geïnstalleerd
2. **Lockfiles** — `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `go.sum`, `Cargo.lock`
3. **IaC-configs** — Dockerfile, docker-compose.yml, Terraform, Kubernetes-manifests, GitHub Actions

Eén tool, drie scope-niveaus. Dat is waarom hij in elk Ductus-project in de CI staat.

## Hoe Trivy weet wat kwetsbaar is

Trivy onderhoudt geen eigen kwetsbaarheidsdatabase — hij aggregeert bestaande bronnen:

- **NVD** (National Vulnerability Database, NIST) — de canonieke CVE-bron
- **OSV** (Open Source Vulnerabilities, Google) — gestructureerde data voor language-ecosystems
- **GitHub Advisory Database** — community-gerapporteerde issues, vaak vóór NVD
- **Distro-trackers** — Debian Security Tracker, Red Hat OVAL, Alpine secdb

Bij de eerste run downloadt Trivy een ~500 MB DB-bundle naar `~/.cache/trivy/`. Daarna alleen incrementele updates (~5 MB per dag). De DB wordt elke 6 uur gepubliceerd door Aqua.

## Een Docker-image scannen

De simpele variant: één commando, complete image.

```bash
$ trivy image ghcr.io/ductus/conductus:latest

2026-04-21T09:14:22Z  INFO  Vulnerability scanning is enabled
2026-04-21T09:14:25Z  INFO  Number of language-specific files: 3

ghcr.io/ductus/conductus:latest (debian 12.5)

Total: 14 (HIGH: 9, CRITICAL: 5)

┌──────────────┬────────────────┬──────────┬──────────────────┬───────────────┐
│   Library    │ Vulnerability  │ Severity │ Installed Version│ Fixed Version │
├──────────────┼────────────────┼──────────┼──────────────────┼───────────────┤
│ libssl3      │ CVE-2024-2511  │ HIGH     │ 3.0.11-1~deb12u1 │ 3.0.13-1~deb12│
│ libxml2      │ CVE-2024-25062 │ CRITICAL │ 2.9.14+dfsg-1.3  │ 2.9.14+dfsg-1.│
│ zlib1g       │ CVE-2023-45853 │ CRITICAL │ 1:1.2.13.dfsg-1  │ (won't fix)   │
└──────────────┴────────────────┴──────────┴──────────────────┴───────────────┘

node-app (yarn)
Total: 6 (HIGH: 4, CRITICAL: 2)

┌──────────────┬────────────────┬──────────┬──────────────────┬───────────────┐
│ next         │ CVE-2024-34351 │ HIGH     │ 14.1.0           │ 14.1.1        │
│ ws           │ CVE-2024-37890 │ CRITICAL │ 8.13.0           │ 8.17.1        │
└──────────────┴────────────────┴──────────┴──────────────────┴───────────────┘
```

Elke finding heeft: package, CVE-ID, severity (CRITICAL / HIGH / MEDIUM / LOW / UNKNOWN), geïnstalleerde versie, fix-versie. Severity-classificatie volgt CVSS v3.1: CRITICAL ≥9.0, HIGH 7.0–8.9, MEDIUM 4.0–6.9, LOW <4.0.

De `(won't fix)` op zlib1g is informatief — Debian heeft besloten deze CVE niet te backporten. Dan is het aan jou om de impact in te schatten of een andere base-image te kiezen.

## Een lockfile scannen zonder image te bouwen

Belangrijker in CI: je wil weten of een PR een kwetsbare dep introduceert *voordat* de image gebouwd wordt.

```bash
$ trivy fs --scanners vuln package-lock.json

Total: 3 (HIGH: 2, CRITICAL: 1)

┌─────────────┬────────────────┬──────────┬──────────┬───────────────┐
│   Library   │ Vulnerability  │ Severity │ Installed│ Fixed Version │
├─────────────┼────────────────┼──────────┼──────────┼───────────────┤
│ axios       │ CVE-2024-39338 │ HIGH     │ 1.6.7    │ 1.7.4         │
│ tar         │ CVE-2024-28863 │ HIGH     │ 6.2.0    │ 6.2.1         │
│ ws          │ CVE-2024-37890 │ CRITICAL │ 8.13.0   │ 8.17.1        │
└─────────────┴────────────────┴──────────┴──────────┴───────────────┘
```

Geen build nodig, geen Docker daemon. Dit draait in seconden op een runner.

## Integratie in Gitea Actions

Onze CI-job blokkeert merges met CRITICAL of HIGH findings — MEDIUM en LOW worden gerapporteerd maar laten de build slagen.

```yaml
- name: Trivy filesystem scan
  uses: aquasecurity/trivy-action@0.20.0
  with:
    scan-type: fs
    scan-ref: .
    severity: CRITICAL,HIGH
    exit-code: 1
    ignore-unfixed: true
    format: sarif
    output: trivy-results.sarif

- name: Trivy image scan
  if: github.ref == 'refs/heads/main'
  run: |
    trivy image \
      --severity CRITICAL,HIGH \
      --exit-code 1 \
      --ignore-unfixed \
      ghcr.io/ductus/${{ github.event.repository.name }}:${{ github.sha }}
```

`--ignore-unfixed` is cruciaal: kwetsbaarheden zonder fix-versie kunnen we toch niet patchen, dus die mogen de build niet breken. Ze komen wel in het SARIF-rapport voor manual review.

## Resultaten op de Ductus-stack

Eerste run over de 85 projecten gaf 312 unieke findings — waarvan 28 CRITICAL. De top-5 oorzaken:

- Verouderde `next` (3 projecten op 14.0.x met bekende SSRF-CVE)
- `ws` <8.17 over 11 projecten (DoS via unsafe buffer-allocatie)
- `tar` <6.2.1 (path-traversal)
- Base-image `node:18-slim` met openssl-CVEs (oplossing: upgrade naar `node:20-slim`)
- `@supabase/ssr` <0.9.0 (PKCE-bug, geen CVE maar wel security-impact)

Na twee weken automated PR-bumps via Renovate + Trivy-validatie: 28 CRITICAL → 0, 84 HIGH → 11 (allemaal `won't fix` met geaccepteerd risico).

## Wat Trivy niet dekt

Trivy is een SCA-tool (Software Composition Analysis). Hij vergelijkt versies tegen een database. Hij weet niet:

- Of je een kwetsbare functie daadwerkelijk aanroept (reachability)
- Of je eigen code bugs bevat (dat is SAST — Semgrep, CodeQL)
- Hoe je app zich runtime gedraagt (Falco voor container-runtime)
- Of je secrets lekken (Gitleaks)

Voor een complete pijplijn: Trivy + Gitleaks + Semgrep + Falco. Trivy is de eerste laag — de meest kosteneffectieve, omdat 80% van de CVEs eenvoudig oplosbaar is met een `npm update`.
