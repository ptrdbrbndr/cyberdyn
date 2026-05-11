# Cyberdyn Security — Product Vision

**Versie**: 0.1 (2026-05-11)
**Eigenaar**: Pieter de Brabander / Ductus
**Domein**: cyberdyn.nl
**Privacy-niveau**: Hoog (verwerkt security-findings van klantinfra)

---

## Wat is Cyberdyn?

Cyberdyn Security is een AI-gedreven security-tooling platform, primair gericht op de Ductus-stack en haar klanten. Het biedt geautomatiseerde detectie, analyse en rapportage van security-risico's — niet als consultancy-dienst, maar als product dat autonoom werkt.

De naam is bewust gekozen: "Cyberdyn" (zonder de `e` van Cyberdyne Systems) signaleert een AI-gedreven, systeem-denk benadering van security. Defense-AI, niet aanvaller-AI.

---

## Probleemstelling

Een single-operator setup (1 persoon, 30+ projecten, 2 servers, 60 domeinen, 14 Supabase-stacks) heeft een aanvals-oppervlak dat vergelijkbaar is met een klein bedrijf — maar zonder een security-team. De risico's zijn real:

- Secrets die per ongeluk in git belanden
- RLS-policies die stiekem van elkaar afwijken tussen stacks
- Verlaten subdomeinen die wijzen naar dode origins
- Dependencies met bekende CVEs die maanden onopgemerkt blijven
- Brute-force op login-endpoints zonder detectie

Cloudflare dekt de perimeter. Cyberdyn dekt de **interior**: alles tussen CF en de applicatie-code.

---

## Visie

> Cyberdyn is de autonome security-co-pilot van de Ductus-stack: hij signaleert, prioriteert en helpt fixen — zonder dat er een security-engineer nodig is.

Op termijn: productiseerbaar voor vergelijkbare multi-project setups (solo-developers, kleine bureaus, managed-service providers).

---

## Drie kernmodules

### 1. Recon-agent
Continu scannen van eigen FQDNs en repositories op:
- SSL-certificaat-expiry en TLS-zwakheden
- Verlaten subdomeinen / dode origins
- Exposed admin-panels en default-credentials
- Secrets in git-history

**Tooling**: Nuclei, testssl.sh, Gitleaks

### 2. Code/PR-security-review
Automatische security-review op elke PR in alle ~85 Ductus-repos:
- Dependency-CVEs (Trivy)
- SAST-issues (Semgrep: dangerouslySetInnerHTML, RLS-bypass, auth-missing)
- Secret-leaks voor commit (Gitleaks pre-commit + CI)
- DAST op staging (OWASP ZAP baseline)

**Tooling**: Trivy, Semgrep, Gitleaks, OWASP ZAP, Renovate

### 3. SOC-assistent (fase 2)
Correlatie van logs over alle Coolify/Supabase/Cloudflare-services:
- Brute-force detectie op login-endpoints
- Container-runtime anomalieën (Falco)
- CF-config-drift detectie
- RLS-baseline-drift over alle 14 Supabase-stacks

**Tooling**: Falco, RLS-baseline-vibe-test, Cloudflare Logpush, AI-correlatie

---

## Rollout-kalender (per 2026-05-11)

| Stap | Tool | Status | Week |
|---|---|---|---|
| 1 | Lynis (host-hardening baseline) | ✅ Live | 19 |
| 2 | Nuclei (FQDN-scan) | ✅ Live | 19 |
| 3 | Gitleaks (secret-scan) | ✅ Live | 20 |
| 9 | testssl.sh (TLS-audit kwartaal) | ✅ Live | 20 |
| 4 | Trivy (deps + Docker-images) | Gepland | 21 |
| 5 | Renovate (dependency-PRs) | Gepland | 22 |
| 6 | Semgrep (SAST) | Gepland | 23-24 |
| 7 | OWASP ZAP baseline | Gepland | 25 |
| 8 | Falco (container-runtime) | Gepland | 26-27 |

Lynis Tier-1 hardening-fixes (fail2ban, auditd, SSH-hardening) volgen na Q3-2026 als doel ≥75/100.

---

## Doelgroep (initieel)

**Intern**: Ductus-stack (Pieter de Brabander). Dogfooding-fase.

**Later**: Solo-developers en kleine bureaus met vergelijkbare multi-project Beelink/Coolify/Supabase-setups die geen security-engineer kunnen inhuren.

---

## Differentiatie

- **Niet** een SIEM (te zwaar, te veel onderhoud voor 1 operator)
- **Niet** een managed pentest-dienst
- **Wel**: lichtgewicht, autonoom, Slack-first, AI-gestuurde triage

Het onderscheidende: AI-laag boven de tooling die vindt prioriteert en uitlegt, niet alleen signaleert.

---

## Aanpalende Ductus-projecten (geen overlap)

- **Veriductus**: verificatie/audit (bedrijfsprocessen, niet security-tooling)
- **Legioductus**: agent-army framework (motor voor toekomstige Cyberdyn-agents)
- **Logiductus**: logica/beslissingsondersteuning
- **Cyberductus**: infra-cockpit + hardware-laag (eigenaar van de doos)
