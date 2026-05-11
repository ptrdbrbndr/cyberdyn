# Cyberdyn Security — Security Baseline

**Versie**: 0.1 (2026-05-11)
**Privacy-niveau**: Hoog
**OWASP ASVS**: Level 1 (doelstelling)

---

## Scope

Cyberdyn verwerkt security-findings van de Ductus-stack. Dit zijn geen persoonsgegevens in de AVG-zin, maar wel bedrijfsgevoelige data (kwetsbaarheden, config-details, secrets-metadata). Privacy-niveau Hoog is van toepassing.

---

## Gegevensstromen

| Datastroom | Inhoud | Opslag | Retention |
|---|---|---|---|
| Scan-rapporten | FQDN-findings, CVE-refs, redacted secrets | `/opt/security-audits/*/YYYY-MM-DD/` op B1 | 12 weken |
| Jira-issues | High/critical findings (titel + beschrijving) | Atlassian cloud | Projectlevensduur |
| Slack-pings | Aantallen + paden (geen ruwe secrets) | Slack workspace | Slack-retentie |
| Git-repo-scan output | Redacted secret-patterns | Lokale scan-output | 12 weken |

---

## Wat nooit in scan-output mag

- Ruwe secret-waarden (Gitleaks `--redact` is verplicht)
- Volledige JWT-tokens in logs
- Wachtwoorden in Slack-berichten
- Stack-traces met interne paden in Jira-issues (beschrijving op hoog niveau)

---

## Toegangsbeheer

- B1 SSH: alleen ptrdbrbndr-key (ed25519), geen wachtwoord-auth
- Scan-scripts draaien als `root` (noodzakelijk voor `/data/gitea/` en `/data/coolify/`)
- Jira API-token in `c:/Projecten/.env` (nooit in code/repo)
- Slack-webhook in `/etc/cron.d/cyberdyn-*` (B1-only, niet in git)

---

## AVG

Cyberdyn verwerkt geen persoonsgegevens in normale werking. Uitzondering: als een secret-scan een naam of e-mailadres vindt in een gecommit bestand — dit wordt gelogd als finding (redacted) en vervolgens uit git-history verwijderd. Geen verwerkersovereenkomst vereist voor interne use.

---

## Bekende risico's

| Risico | Mitigatie |
|---|---|
| Scan-output bevat gevoelige config-info | 12-weeks retention + B1-only opslag |
| Gitleaks-cron draait als root | Beperkt tot scan-taken; geen write-acties |
| Jira-cloud (Atlassian) ontvangt finding-titels | Geen ruwe secrets in issues |
| CF WAF kan ZAP-scans blokkeren (stap 7) | B1 egress-IP whitelisten in CF Custom Rule |

---

## Audit-log

- Alle scan-runs hebben een tijdstempel in `/opt/security-audits/*/cron.log`
- Agent-log van Cyberdyn-sessies: `cyberductus.nl/docs/agent-log/`
