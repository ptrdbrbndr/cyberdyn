---
title: "testssl.sh: TLS-configuratie auditen op 35 FQDNs"
date: 2026-05-01
summary: "Een 8.000-regel shell-script dat elke TLS-misconfiguratie blootlegt — van zwakke ciphers tot ontbrekende HSTS. Hoe we het kwartaal-breed inzetten."
tag: RECON
readtime: 6
---

## Waarom TLS-audits geen luxe zijn

Een geldig certificaat in de browser-balk zegt niets over de onderliggende configuratie. TLS 1.0 kan nog aan staan, RC4-ciphers kunnen nog onderhandeld worden, HSTS kan ontbreken, en je certificaat-chain kan een tussenliggende CA missen die op oudere clients faalt.

Browsers verbergen die details. `testssl.sh` legt ze blootscherp op tafel.

Voor compliance-audits (PCI-DSS 4.0 vereist TLS 1.2+, geen zwakke ciphers) is dit niet optioneel. En voor onze eigen ISO 27001-baseline is een gedocumenteerde TLS-scan per kwartaal de minimum-norm.

## Wat testssl.sh is

`testssl.sh` is een single-file Bash-script van ongeveer 8.000 regels, geschreven door Dirk Wetter. Het roept onder water `openssl` aan met handgemaakte client-hello's en interpreteert de responses. Geen dependencies behalve een recente OpenSSL en `bash 3.2+`.

Je draait het tegen één hostname:

```bash
./testssl.sh --jsonfile out.json --logfile out.log iductus.nl
```

Output verschijnt tegelijk in de terminal (gekleurd, leesbaar) en in een JSON-bestand dat we machine-leesbaar kunnen aggregeren over alle 35 FQDNs.

Geen package-manager nodig, geen container, geen Go-binary om te bouwen. `git clone` en draaien. Die portability is het hele punt: je kunt het overal neerzetten waar bash en openssl staan, inclusief op de Beelink-hosts zelf.

## Wat het toetst

In één run loopt testssl.sh door zeven testblokken:

1. **Protocol-versies** — wordt TLS 1.0/1.1 nog geaccepteerd? SSLv3? Is TLS 1.3 aanwezig?
2. **Cipher suites** — per protocol een volledige enumeratie. Welke ciphers staan aan, in welke volgorde, en is forward secrecy gegarandeerd?
3. **Server preferences** — respecteert de server zijn eigen cipher-volgorde of laat hij de client kiezen?
4. **Certificate** — chain compleet? Hostname-match? OCSP-stapling actief? Key-strength? Algoritme (RSA-2048 minimaal, liefst ECDSA P-256)?
5. **HTTP security-headers** — HSTS, CSP, X-Frame-Options, Referrer-Policy.
6. **Bekende kwetsbaarheden** — Heartbleed, POODLE, BEAST, FREAK, LOGJAM, ROBOT, Sweet32, Lucky13.
7. **Renegotiation, compression, downgrade-bescherming** — TLS_FALLBACK_SCSV, secure renegotiation.

Een fragment uit de terminal-output:

```text
 Testing protocols via sockets except NPN+ALPN

 SSLv2      not offered (OK)
 SSLv3      not offered (OK)
 TLS 1      not offered
 TLS 1.1    not offered
 TLS 1.2    offered (OK)
 TLS 1.3    offered (OK): final
 NPN/SPDY   not offered
 ALPN/HTTP2 h2, http/1.1 (offered)

 Testing server's cipher preferences

 Has server cipher order?     yes (OK)
 Negotiated protocol          TLSv1.3
 Negotiated cipher            TLS_AES_256_GCM_SHA384, 253 bit ECDH (X25519)
```

## Resultaten op de Ductus-stack

35 FQDNs, eerste audit-ronde Q2 2026:

- **0 kritieke findings** — geen Heartbleed-gevoelige servers, geen TLS 1.0/1.1 nog aan, geen RC4 of 3DES in de cipher-lijst.
- **2 medium** — ontbrekende HSTS op twee subdomeinen die alleen API-traffic afhandelen. Toegevoegd via Traefik-middleware.
- **4 low** — certificate-chain compleet maar OCSP-stapling stond uit op vier Beelink-2-FQDNs (Coolify-default). Aangezet via `traefik.toml`.
- **7 informational** — server-version disclosure in `Server:`-header. Backlog-item voor de volgende infra-iteratie.

De Vercel-deployments scoren standaard A+ omdat Vercel hun edge-TLS strak houdt. De Beelink-stacks via Cloudflare Tunnel scoren A — Cloudflare termineert TLS, dus de keten Cloudflare→Beelink is intern en niet via testssl.sh meetbaar.

## Integratie: kwartaal-cron op B1

TLS-configuratie verandert zelden. Een wekelijkse run is overkill; een kwartaal-run is genoeg om certificate-rotaties en upstream-defaults te vangen.

```bash
# /etc/cron.d/testssl-quarterly
0 3 1 */3 * security  /opt/security-audits/testssl/run-all.sh
```

`run-all.sh` itereert over `targets.txt` (dezelfde lijst als Nuclei), schrijft JSON per host naar `/var/log/testssl/$(date +%Y-Q%q)/` en stelt een aggregaat-rapport samen. Findings met severity `HIGH` of `CRITICAL` triggeren een Slack-alert; lagere severities komen in het reguliere kwartaal-rapport.

## Wat testssl.sh niet doet

Het is een TLS-auditor, niet een volledige web-scanner. Het zegt niets over:

- **Applicatie-laag** — auth-bypass, IDOR, SQL-injection. Dat is ZAP/Semgrep-werk.
- **Certificate-transparency** — vergeten subdomeinen met geldige certs vind je via `crt.sh`, niet via testssl.
- **TLS achter een CDN** — Cloudflare termineert, dus je meet Cloudflare's config, niet die van je origin.
- **mTLS-flows** — testssl ondersteunt client-certs (`--ssl-client-cert`), maar de meeste van onze interne mTLS-koppelingen toetsen we via dedicated integratietests.

Voor die lagen draaien Nuclei (wekelijks), Lynis (maandelijks) en — gepland Q3 — ZAP authenticated scans. testssl.sh is het kwartaal-anker voor de TLS-laag specifiek: één tool, één verantwoordelijkheid, beton-betrouwbaar.
