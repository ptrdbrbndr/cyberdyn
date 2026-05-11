# Cyberdyn Security — Architectuur

**Versie**: 0.1 (2026-05-11)

---

## Lagen

```
[ Internet ]
     │
[ Cloudflare WAF / Bot / DDoS / TLS ]     ← perimeter (niet Cyberdyn)
     │
[ Cyberdyn Security — interior-laag ]     ← dit project
     │
  ┌──┴─────────────────────────────────┐
  │ Recon-agent      Code-review       │
  │ (Nuclei/testssl) (Trivy/Semgrep/   │
  │                   ZAP/Gitleaks)    │
  │                                    │
  │ SOC-assistent (fase 2)             │
  │ (Falco/RLS-drift/CF-config-drift)  │
  └──────────────────────────────────┬─┘
     │                               │
[ Beelink 1+2 ]            [ GitHub / Gitea ]
[ Coolify-apps ]           [ ~85 repos ]
[ 14 Supabase-stacks ]
```

---

## Infrastructuur

### Scan-platform
- **Host**: Beelink 1 (192.168.68.71 / cyberductus) — primaire scan-host
- **Supp**: Beelink 2 (192.168.68.72) — Lynis mirror
- **Cron-beheer**: `/etc/cron.d/cyberdyn-*` per tool
- **Output**: `/opt/security-audits/<tool>/YYYY-MM-DD/` (12-weeks retention)

### CI/CD-laag
- **Gitea Actions** op Beelink-hosted Gitea (git.cyberductus.nl)
- Template: `c:/Projecten/.gitea-templates/` — rollout-script plaatst config + workflow per repo
- GitHub mirror-repos krijgen dezelfde workflows via push

### Alerting
- **Slack webhook** (T0AN03M1KFD/B0AN053E9BM) — alle tools sturen hier naar
- Severity-policy: critical/high = directe ping; medium = batch-rapport; 0 findings = checkmark

### Findings-tracking
- **Jira**: debrabander.atlassian.net — project "Cyberductus-security" voor high/critical
- Medium/low: wekelijks batch-rapport

---

## Tooling-beslissingen

| Tool | Beslissing | Reden |
|---|---|---|
| Gitleaks install | Binary (niet APT-repo) | Supply-chain risico vermijden |
| Renovate auto-merge | Patch-only op staging | Minor/major = breaking-change-risico |
| Gitleaks rollout | Gitea-template org-breed | 85 repos × handmatig = onbeheersbaar |
| Falco | Na B1 Lynis-baseline (≥75/100) | 3-5% kernel-overhead pas acceptabel bij voldoende headroom |
| Wazuh/SIEM | Uitgesloten | Overkill voor 2 hosts, meer onderhoud dan detectie |

Zie [ADR-0001](adr/0001-geen-siem.md) voor Wazuh/SIEM-afweging.

---

## Toekomstige AI-laag (fase 2)

Legioductus-agent-orchestratie als motor voor:
- Automatische triage van Nuclei-findings (LLM beoordeelt false-positive kans)
- PR-commentaar met uitleg bij Semgrep/Trivy-hits
- Wekelijks security-digest via Slack (AI-samenvatting van alle tool-output)

Stack: Legioductus-agents + Ollama 70B (Beelink-LLM) of Claude API voor hogere kwaliteit.
