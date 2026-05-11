---
title: "Lynis: van verse Ubuntu naar hardening score 80+"
date: 2026-04-15
summary: "Lynis auditeert 300+ controls op host-niveau. Wat de scores betekenen, welke bevindingen écht tellen, en hoe je systematisch verbetert zonder de server te destabiliseren."
tag: HOST
readtime: 8
---

## Waarom host-hardening?

Een applicatie die perfect beveiligd is draait op een server. Als die server slecht geconfigureerd is — world-readable SSH-keys, te permissieve sudo-rechten, verouderde kernel — maakt de applicatiebeveiliging weinig uit.

Lynis auditeert de host zelf: het OS, de kernel, authenticatie, netwerk-configuratie, bestands-permissies.

## De score begrijpen

Lynis geeft een "hardening index" van 0–100. Een verse Ubuntu-installatie scoort typisch 55–65. Onze Beelinks starten op 57 (B1) en 62 (B2).

De score is een richtlijn, geen doel op zich. Een score van 80 met één kritieke misconfiguratie is slechter dan een score van 70 zonder kritieke issues.

Wat Lynis rapporteert:

```
[+] System Tools
------------------------------------
  - Checking system tools                              [ DONE ]
  - Checking for automation tools                      [ FOUND ]

[!] SUGGESTION
  * Consider hardening SSH configuration
    - Details  : AllowTcpForwarding (set YES, but could be NO)
    - Solution : Change AllowTcpForwarding to NO in /etc/ssh/sshd_config
```

## Prioritering van bevindingen

Lynis geeft drie niveaus: WARNING, SUGGESTION, en INFO.

**WARNINGs** zijn actionable en urgent. Voorbeelden:
- `PKGS-7392` — verouderde packages met bekende CVEs
- `AUTH-9328` — root login via SSH toegestaan
- `FIRE-4512` — geen firewall actief

**SUGGESTIONs** zijn verbeteringen zonder direct risico. Wij pakken deze aan in batches van 5–10 per sprint.

**INFO** is documentatie. Negeer dit grotendeels.

## Fixes die het meeste opleveren

Na de eerste Lynis-run op de Beelinks, deze fixes gaven de grootste score-sprong:

**1. SSH-hardening** (+4 punten)
```bash
# /etc/ssh/sshd_config
AllowTcpForwarding no
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 30
```

**2. Kernel-parameters** (+3 punten)
```bash
# /etc/sysctl.d/99-hardening.conf
net.ipv4.conf.all.rp_filter = 1
net.ipv4.tcp_syncookies = 1
kernel.dmesg_restrict = 1
```

**3. Fail2ban installeren** (+2 punten)
```bash
apt install fail2ban
systemctl enable --now fail2ban
```

## Automatisering

Lynis draait elke woensdag 02:00 UTC via cron. Output naar `/var/log/lynis/`. Bij WARNING-niveau alerts: Slack-notificatie.

```bash
lynis audit system --quiet \
  --log-file /var/log/lynis/$(hostname)-$(date +%Y%m%d).log \
  --report-file /var/log/lynis/$(hostname)-$(date +%Y%m%d).dat
```

De score-ontwikkeling wordt bijgehouden in een simpel CSV: datum, hostname, score. Zo zien we drift — een score die daalt zonder wijzigingen is een signaal.

## Wat Lynis niet dekt

Lynis kijkt niet naar:
- Applicatie-kwetsbaarheden (Nuclei, SAST)
- Container-runtime (Falco — Q3 2026)
- Secrets in code (Gitleaks)
- Network-niveau (Nuclei)

Het is één laag in een gelaagde aanpak.
