# ADR-0001 — Geen volledige SIEM (Wazuh / OpenSCAP)

**Datum**: 2026-05-11
**Status**: Geaccepteerd

## Context

Bij de inrichting van Cyberdyn Security is Wazuh als SIEM-kandidaat besproken. Wazuh biedt centralized log-aggregatie, file-integrity monitoring, intrusion detection en SIEM-dashboards.

## Beslissing

Wazuh (en vergelijkbare full-SIEM-oplossingen zoals OpenSCAP + Elastic) worden **niet** ingezet voor de Ductus-stack.

## Overwegingen

**Vóór Wazuh**:
- Centrale plek voor alle security-events
- SIEM-functionaliteit die later nodig kan zijn
- File-integrity monitoring (AIDE-alternatief)

**Tegen Wazuh**:
- Setup-overhead: 4-8 uur voor 2 hosts
- Hoge RAM-footprint: Wazuh manager + Elasticsearch kost 8-12 GB extra op B1 (reeds RAM-beperkt)
- Onderhoudslast overtreft detectie-waarde voor 1 operator
- Lynis dekt 80% van de host-hardening die Wazuh/OpenSCAP zou bieden, met 10% van het werk
- Falco (stap 8) dekt de container-runtime-laag die Wazuh toevoegt

## Alternatief

Lichtgewicht per-tool aanpak: Lynis (host) + Nuclei (netwerk) + Gitleaks (secrets) + Trivy (deps) + Falco (runtime) + Semgrep (code). Elke tool doet één ding goed, geen centrale daemon nodig.

Als de stack groeit naar 5+ operators of externe klanten, heroverwegen.
