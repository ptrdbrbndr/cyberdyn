# Cyberdyn Security — Stappenplan

**Gestart**: 2026-05-11
**Eigenaar**: Pieter de Brabander

---

## Fase 0 — Fundament (week 19-20) ✅

- [x] **Stap 1** — Lynis host-hardening baseline op B1+B2 (idx 57/62, 0 warnings)
- [x] **Stap 2** — Nuclei FQDN-scan live (35 targets, vr 02:00 UTC)
- [x] **Stap 3** — Gitleaks secret-scan (binary v8.30.1, cron wo 03:00, pilot op coductus.nl)
- [x] **Stap 9** — testssl.sh TLS-audit kwartaal (1e mrt/jun/sep/dec 04:00 UTC)

## Fase 1 — Supply chain + code (week 21-24) 📋

- [ ] **Stap 4** — Trivy (binary install B1+B2, nightly Docker-image scan, CI Gitea Actions)
  - [ ] Trivy binary installeren op B1+B2
  - [ ] Baseline: `trivy image $(docker ps --format '{{.Image}}' | sort -u)` per host
  - [ ] Gitea Actions template `trivy-scan.yml`
  - [ ] Nightly cron: critical CVEs → Slack
- [ ] **Stap 5** — Renovate self-host op B2 (Coolify-app, Gitea + GitHub, patch auto-merge)
  - [ ] Coolify-app `renovate-bot` op B2 (server `ey9yvftuzi5egeqybqannl4i`)
  - [ ] `config.js` met Gitea-token + GitHub-token
  - [ ] Pilot: iductus — 1 week PR's laten openen
  - [ ] Rollout naar alle Ductus-repos
- [ ] **Stap 6** — Semgrep SAST (p/typescript + p/nextjs + custom CLAUDE.md-rules)
  - [ ] Custom rules: dangerouslySetInnerHTML, service-role-key in client, missing auth-check
  - [ ] Pilot: iductus
  - [ ] Workflow-template `semgrep-scan.yml`

## Fase 2 — Runtime + DAST (week 25-27) 📋

- [ ] **Stap 7** — OWASP ZAP baseline op staging-FQDNs (B1 egress-IP whitelisten in CF eerst)
- [ ] **Stap 8** — Falco container-runtime (na Lynis-baseline ≥75/100 op B1)

## Fase 3 — Hardening + AI-laag (Q3 2026) 📋

- [ ] Lynis Tier-1 fixes: fail2ban, auditd, SSH-hardening, debsums → doel ≥75/100
- [ ] RLS-baseline-drift-detector over alle 14 Supabase-stacks (uitbreiden van iductus-patroon)
- [ ] CF-config-drift-detector (WAF-rules, Bot-Fight-Mode-toggle, Tunnel-ingress)
- [ ] AI-triage-laag (Legioductus-agents + LLM) voor wekelijkse security-digest

## Fase 4 — Productisering (2027) 💡

- [ ] Cyberdyn.nl marketing-site live (coming soon → early access)
- [ ] Multi-tenant: eerste externe klant onboarden
- [ ] SaaS-model: security-dashboard + Slack-bot per workspace

---

## Cron-overzicht (actueel)

| Dag | Tijd UTC | Tool | Cron-file |
|---|---|---|---|
| Woensdag | 03:00 | Gitleaks full-repo-scan | `/etc/cron.d/cyberdyn-gitleaks` |
| Donderdag | 02:00 | Lynis host-hardening | `/etc/cron.d/cyberdyn-lynis` |
| Vrijdag | 02:00 | Nuclei FQDN-scan | `/etc/cron.d/cyberdyn-nuclei` |
| 1 mrt/jun/sep/dec | 04:00 | testssl.sh TLS-audit | `/etc/cron.d/cyberdyn-testssl` |
