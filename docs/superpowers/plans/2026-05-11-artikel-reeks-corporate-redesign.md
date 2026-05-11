# Cyberdyn Artikel-reeks + Corporate Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een markdown-gedreven INTEL-artikelreeks toe aan cyberdyn.nl, geef de site een corporate Professional Dark redesign, zet de Matrix-versie op demo.cyberdyn.nl, en activeer de Resend-waitlist funnel.

**Architecture:** Statische HTML-site (nginx op B1 via Coolify). Markdown-bronbestanden in `articles-src/` worden via `build-articles.mjs` omgezet naar HTML in `public/articles/` — dit gebeurt in een multi-stage Dockerfile (Node builder → nginx). De Matrix-versie leeft als aparte Coolify-app op poort 81 met eigen `Dockerfile.demo`. Een klein Express-endpoint (`api/`) op poort 3001 handelt waitlist-signups af (Supabase + Resend).

**Tech Stack:** Node 20, `marked` (markdown parser), Express 4, `@supabase/supabase-js`, `resend`, nginx:alpine, Coolify, CF Tunnel

---

## Bestandskaart

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `package.json` | Create | npm project, build-script definitie |
| `build-articles.mjs` | Create | Markdown → HTML pipeline |
| `build-articles.test.mjs` | Create | Test voor build pipeline |
| `public/assets/article.css` | Create | Gedeelde stijl artikelen + nav (Professional Dark) |
| `public/index.html` | Modify | Corporate redesign (vervangt Matrix-versie) |
| `public/articles/` | Generated | Output van build-script (niet handmatig bewerken) |
| `articles-src/*.md` | Create | Markdown bronbestanden per artikel |
| `public-demo/index.html` | Create | Kopie van huidige Matrix landing page |
| `Dockerfile` | Modify | Multi-stage: Node builder + nginx |
| `Dockerfile.demo` | Create | nginx serveert public-demo/ op poort 81 |
| `api/package.json` | Create | Waitlist API dependencies |
| `api/server.mjs` | Create | Express: POST /waitlist + GET /health |
| `api/Dockerfile` | Create | Node 20 alpine, port 3001 |

---

## Task 1: npm project + build-articles.mjs

**Files:**
- Create: `c:/Projecten/cyberdyn/package.json`
- Create: `c:/Projecten/cyberdyn/build-articles.mjs`
- Create: `c:/Projecten/cyberdyn/build-articles.test.mjs`

- [ ] **Stap 1: Schrijf falende test**

Maak `build-articles.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TMP_SRC = 'articles-src-test';
const TMP_OUT = 'public/articles-test';

test('build-articles genereert article HTML en index vanuit markdown', () => {
  mkdirSync(TMP_SRC, { recursive: true });
  mkdirSync('public', { recursive: true });

  writeFileSync(join(TMP_SRC, '2026-05-01-test-artikel.md'), [
    '---',
    'title: "Test Artikel"',
    'date: 2026-05-01',
    'summary: "Een test samenvatting voor het artikel."',
    'tag: RECON',
    'readtime: 3',
    '---',
    '',
    '## Introductie',
    '',
    'Dit is de **body** van het artikel.',
    '',
    '```bash',
    'echo hello',
    '```',
  ].join('\n'));

  execSync(`node build-articles.mjs`, {
    env: { ...process.env, ARTICLES_SRC_DIR: TMP_SRC, ARTICLES_OUT_DIR: TMP_OUT },
  });

  const article = readFileSync(join(TMP_OUT, 'test-artikel.html'), 'utf8');
  assert.ok(article.includes('Test Artikel'), 'titel aanwezig in artikel');
  assert.ok(article.includes('RECON'), 'tag aanwezig in artikel');
  assert.ok(article.includes('Introductie'), 'heading aanwezig in artikel');
  assert.ok(article.includes('<code>'), 'code block aanwezig');

  const index = readFileSync(join(TMP_OUT, 'index.html'), 'utf8');
  assert.ok(index.includes('Test Artikel'), 'titel aanwezig in index');
  assert.ok(index.includes('Een test samenvatting'), 'summary aanwezig in index');

  rmSync(TMP_SRC, { recursive: true, force: true });
  rmSync(TMP_OUT, { recursive: true, force: true });
});
```

- [ ] **Stap 2: Draai test — verwacht FAIL**

```bash
cd c:/Projecten/cyberdyn
node --test build-articles.test.mjs
```

Verwacht: `Error: Cannot find module` of `build-articles.mjs not found`

- [ ] **Stap 3: Maak package.json**

```json
{
  "name": "cyberdyn-site",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "node build-articles.mjs",
    "test": "node --test build-articles.test.mjs"
  },
  "dependencies": {
    "marked": "^12.0.0"
  }
}
```

Run: `npm install` in `c:/Projecten/cyberdyn/`

- [ ] **Stap 4: Schrijf build-articles.mjs**

```javascript
import { marked } from 'marked';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = process.env.ARTICLES_SRC_DIR ?? join(__dirname, 'articles-src');
const OUT_DIR = process.env.ARTICLES_OUT_DIR ?? join(__dirname, 'public/articles');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('Ontbrekende frontmatter');
  const meta = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    meta[key] = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: match[2] };
}

function slug(filename) {
  return basename(filename, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function articlePage(meta, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${meta.title} — Cyberdyn Intel</title>
<meta name="description" content="${meta.summary}">
<link rel="stylesheet" href="../assets/article.css">
</head>
<body>
<nav class="site-nav">
  <a class="nav-brand" href="/">CYBERDYN</a>
  <div class="nav-links">
    <a href="/#product">Product</a>
    <a href="/articles/" class="active">Intel</a>
  </div>
</nav>
<main class="article-main">
  <a class="back-link" href="/articles/">← Intel</a>
  <article>
    <div class="article-tag">${meta.tag}</div>
    <h1>${meta.title}</h1>
    <div class="article-byline">${meta.date} · ${meta.readtime} min leestijd</div>
    <div class="article-body">${bodyHtml}</div>
  </article>
</main>
</body>
</html>`;
}

function indexPage(articles) {
  const cards = articles.map(({ meta, slug }) => `
  <div class="article-card">
    <div class="article-meta">
      <span class="article-tag-sm">${meta.tag}</span>
      <span class="article-date">${meta.date}</span>
    </div>
    <h2 class="article-title"><a href="/articles/${slug}.html">${meta.title}</a></h2>
    <p class="article-summary">${meta.summary}</p>
    <span class="article-read">LEES ARTIKEL →</span>
  </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Intel — Cyberdyn Security</title>
<link rel="stylesheet" href="../assets/article.css">
</head>
<body>
<nav class="site-nav">
  <a class="nav-brand" href="/">CYBERDYN</a>
  <div class="nav-links">
    <a href="/#product">Product</a>
    <a href="/articles/" class="active">Intel</a>
  </div>
</nav>
<main class="index-main">
  <div class="index-header">
    <p class="index-eyebrow">INTEL</p>
    <h1>Deep Dives</h1>
    <p class="index-sub">Technische analyses van de tools en technieken die de Ductus-stack beveiligen.</p>
  </div>
  <hr class="index-divider">
  <div class="article-list">${cards}</div>
</main>
</body>
</html>`;
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SRC_DIR)
  .filter(f => f.endsWith('.md'))
  .sort()
  .reverse();

const articles = [];
for (const file of files) {
  const { meta, body } = parseFrontmatter(readFileSync(join(SRC_DIR, file), 'utf8'));
  const s = slug(file);
  writeFileSync(join(OUT_DIR, `${s}.html`), articlePage(meta, marked.parse(body)));
  articles.push({ meta, slug: s });
  console.log(`Built: ${s}.html`);
}

writeFileSync(join(OUT_DIR, 'index.html'), indexPage(articles));
console.log(`Built: articles/index.html (${articles.length} artikelen)`);
```

- [ ] **Stap 5: Draai test — verwacht PASS**

```bash
node --test build-articles.test.mjs
```

Verwacht:
```
✔ build-articles genereert article HTML en index vanuit markdown (XXms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

- [ ] **Stap 6: Commit**

```bash
git add package.json package-lock.json build-articles.mjs build-articles.test.mjs
git commit -m "feat: markdown→html build pipeline met tests"
```

---

## Task 2: Article styles (article.css)

**Files:**
- Create: `c:/Projecten/cyberdyn/public/assets/article.css`

- [ ] **Stap 1: Maak assets-map + schrijf article.css**

```bash
mkdir -p c:/Projecten/cyberdyn/public/assets
```

Schrijf `public/assets/article.css`:

```css
:root {
  --bg: #0f1117;
  --surface: #1a1e2e;
  --border: #1e2130;
  --accent: #e8472a;
  --text: #ffffff;
  --text-secondary: #8892a4;
  --text-subtle: #4a5568;
  --font-mono: 'Courier New', monospace;
  --font-sans: -apple-system, 'Inter', system-ui, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  min-height: 100vh;
}

.site-nav {
  border-bottom: 1px solid var(--border);
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-brand {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text);
  text-decoration: none;
}

.nav-links { display: flex; gap: 2rem; }
.nav-links a {
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}
.nav-links a:hover,
.nav-links a.active { color: var(--text); }

/* ── Index page ── */
.index-main {
  max-width: 800px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.index-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  color: var(--accent);
  margin-bottom: 0.5rem;
}

.index-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.index-sub {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.index-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2rem 0;
}

.article-list { display: flex; flex-direction: column; gap: 1.25rem; }

.article-card {
  border: 1px solid var(--border);
  padding: 1.5rem;
  background: var(--surface);
  transition: border-color 0.2s;
}
.article-card:hover { border-color: #2d3350; }

.article-meta { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.6rem; }

.article-tag-sm {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 0.1rem 0.4rem;
}

.article-date {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-subtle);
}

.article-title { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; }
.article-title a { color: var(--text); text-decoration: none; }
.article-title a:hover { color: var(--accent); }
.article-summary { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.65; margin-bottom: 0.75rem; }
.article-read { font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.1em; color: var(--accent); }

/* ── Single article ── */
.article-main {
  max-width: 720px;
  margin: 0 auto;
  padding: 3rem 2rem 6rem;
}

.back-link {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-decoration: none;
  margin-bottom: 2.5rem;
  transition: color 0.2s;
}
.back-link:hover { color: var(--text); }

.article-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.25em;
  color: var(--accent);
  margin-bottom: 0.75rem;
}

article h1 {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 0.5rem;
}

.article-byline {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-subtle);
  margin-bottom: 2.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border);
}

.article-body { font-size: 1rem; line-height: 1.75; color: var(--text-secondary); }
.article-body h2 {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  color: var(--accent);
  text-transform: uppercase;
  margin: 2.5rem 0 1rem;
}
.article-body h3 { font-size: 1.1rem; color: var(--text); margin: 1.75rem 0 0.75rem; }
.article-body p { margin-bottom: 1.25rem; }
.article-body strong { color: var(--text); font-weight: 600; }
.article-body a { color: var(--accent); text-decoration: none; }
.article-body a:hover { text-decoration: underline; }
.article-body code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: #0a0c10;
  padding: 0.15em 0.4em;
  color: #e2e8f0;
}
.article-body pre {
  background: #0a0c10;
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  padding: 1.25rem 1.5rem;
  overflow-x: auto;
  margin: 1.5rem 0;
}
.article-body pre code { background: transparent; padding: 0; font-size: 0.82rem; line-height: 1.6; }
.article-body ul, .article-body ol { padding-left: 1.5rem; margin-bottom: 1.25rem; }
.article-body li { margin-bottom: 0.4rem; }
.article-body blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1.25rem;
  color: var(--text-subtle);
  font-style: italic;
  margin: 1.5rem 0;
}

@media (max-width: 640px) {
  .article-main, .index-main { padding: 2rem 1.25rem; }
  article h1 { font-size: 1.5rem; }
  .index-header h1 { font-size: 1.75rem; }
}
```

- [ ] **Stap 2: Visuele verificatie — maak test-artikel aan en open in browser**

Maak `articles-src/2026-05-11-test.md` tijdelijk:
```markdown
---
title: "Test"
date: 2026-05-11
summary: "Tijdelijk testbestand"
tag: RECON
readtime: 2
---

## Heading

Paragraaf met **vet** en `code`.

\`\`\`bash
echo "test"
\`\`\`
```

Run: `npm run build` → open `public/articles/test.html` in browser. Verwijder het testbestand daarna.

- [ ] **Stap 3: Commit**

```bash
git add public/assets/article.css
git commit -m "feat: article.css Professional Dark stijl"
```

---

## Task 3: Corporate redesign — public/index.html

**Files:**
- Modify: `c:/Projecten/cyberdyn/public/index.html`

- [ ] **Stap 1: Vervang public/index.html met de corporate versie**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cyberdyn Security</title>
<meta name="description" content="AI-gedreven security tooling. Autonoom. Continu. Zonder security-team.">
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1e2e;
    --border: #1e2130;
    --accent: #e8472a;
    --text: #ffffff;
    --text-secondary: #8892a4;
    --text-subtle: #4a5568;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, 'Inter', system-ui, sans-serif; min-height: 100vh; }

  nav {
    border-bottom: 1px solid var(--border);
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky; top: 0;
    background: var(--bg);
    z-index: 10;
  }
  .nav-brand { font-family: 'Courier New', monospace; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.15em; color: var(--text); text-decoration: none; }
  .nav-links { display: flex; gap: 2rem; }
  .nav-links a { font-size: 0.8rem; letter-spacing: 0.05em; color: var(--text-secondary); text-decoration: none; transition: color 0.2s; }
  .nav-links a:hover { color: var(--text); }

  .container { max-width: 900px; margin: 0 auto; padding: 5rem 2rem 4rem; }

  .eyebrow { font-family: 'Courier New', monospace; font-size: 0.7rem; letter-spacing: 0.25em; color: var(--accent); margin-bottom: 1.25rem; text-transform: uppercase; }
  h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 700; color: var(--text); line-height: 1.15; margin-bottom: 1.25rem; letter-spacing: -0.02em; }
  .hero-sub { font-size: clamp(1rem, 2vw, 1.2rem); color: var(--text-secondary); line-height: 1.65; max-width: 560px; margin-bottom: 2.5rem; }

  .divider { border: none; border-top: 1px solid var(--border); margin: 3rem 0; }

  .modules { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1px; background: var(--border); margin-bottom: 3rem; }
  .module { background: var(--surface); padding: 1.5rem; border-top: 3px solid var(--accent); }
  .module-id { font-family: 'Courier New', monospace; font-size: 0.65rem; letter-spacing: 0.2em; color: var(--accent); margin-bottom: 0.6rem; }
  .module-name { font-size: 1.05rem; font-weight: 600; color: var(--text); margin-bottom: 0.5rem; }
  .module-desc { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; }

  .status-block { border: 1px solid var(--border); padding: 1.25rem 1.5rem; background: var(--surface); margin-bottom: 3rem; }
  .status-label { font-family: 'Courier New', monospace; font-size: 0.65rem; letter-spacing: 0.2em; color: var(--text-subtle); margin-bottom: 0.75rem; }
  .status-row { display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; color: var(--text-secondary); padding: 0.25rem 0; font-family: 'Courier New', monospace; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot.live { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.5); animation: pulse 2s ease-in-out infinite; }
  .dot.pending { background: var(--text-subtle); }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .signup-block { margin-bottom: 4rem; }
  .signup-label { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem; }
  .email-form { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .email-form input { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.75rem 1.25rem; font-family: inherit; font-size: 0.9rem; outline: none; width: 280px; transition: border-color 0.2s; }
  .email-form input:focus { border-color: #2d3350; }
  .email-form input::placeholder { color: var(--text-subtle); }
  .btn-primary { background: var(--accent); border: none; color: var(--text); padding: 0.75rem 1.5rem; font-family: inherit; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.05em; cursor: pointer; transition: background 0.2s; }
  .btn-primary:hover { background: #d13d22; }
  .confirm-msg { font-size: 0.85rem; color: #22c55e; display: none; margin-top: 0.75rem; font-family: 'Courier New', monospace; }

  footer { border-top: 1px solid var(--border); padding: 2rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; font-size: 0.75rem; color: var(--text-subtle); max-width: 900px; margin: 0 auto; }

  @media (max-width: 480px) {
    .container { padding: 3rem 1.25rem 2rem; }
    .email-form input { width: 100%; }
    .btn-primary { width: 100%; }
    .nav-links { gap: 1rem; }
  }
</style>
</head>
<body>
<nav>
  <a class="nav-brand" href="/">CYBERDYN</a>
  <div class="nav-links">
    <a href="#product">Product</a>
    <a href="/articles/">Intel</a>
    <a href="mailto:security@cyberdyn.nl">Contact</a>
  </div>
</nav>

<div class="container">
  <div class="eyebrow">AI Security Tooling</div>
  <h1>Security zonder<br>security-team</h1>
  <p class="hero-sub">Autonome tooling die uw aanvalsoppervlak continu bewaakt. Recon. Code-review. Runtime-detectie. Voor teams die niet stil staan.</p>
  <hr class="divider">

  <div class="modules" id="product">
    <div class="module">
      <div class="module-id">MODULE 01 — RECON</div>
      <div class="module-name">Attack Surface Monitor</div>
      <div class="module-desc">Continu scannen van FQDNs, SSL-certs, blootliggende services en secret-leaks in git-history.</div>
    </div>
    <div class="module">
      <div class="module-id">MODULE 02 — CODE</div>
      <div class="module-name">PR Security Review</div>
      <div class="module-desc">Automatische security-analyse op elke PR. CVE-detectie, SAST, dependency-audits — blocking vóór merge.</div>
    </div>
    <div class="module">
      <div class="module-id">MODULE 03 — SOC</div>
      <div class="module-name">AI Threat Correlator</div>
      <div class="module-desc">Cross-service log-correlatie. Detecteert anomalieën, config-drift en brute-force — zonder SIEM-overhead.</div>
    </div>
  </div>

  <div class="status-block">
    <div class="status-label">LIVE STATUS — DUCTUS STACK</div>
    <div class="status-row"><span class="dot live"></span>Lynis host-hardening — B1 idx 57 · B2 idx 62 · 0 warnings</div>
    <div class="status-row"><span class="dot live"></span>Nuclei FQDN-scan — 35 targets · laatste run: geen findings</div>
    <div class="status-row"><span class="dot live"></span>Gitleaks secret-scan — wekelijks · pilot actief op coductus.nl</div>
    <div class="status-row"><span class="dot pending"></span>Trivy dependency-scan — week 21</div>
    <div class="status-row"><span class="dot pending"></span>Semgrep SAST — week 23</div>
    <div class="status-row"><span class="dot pending"></span>Falco runtime-detectie — Q3 2026</div>
  </div>

  <div class="signup-block">
    <p class="signup-label">Vroege toegang — wij nemen contact op zodra het beschikbaar is.</p>
    <div class="email-form" id="emailForm">
      <input type="email" id="emailInput" placeholder="naam@bedrijf.nl" autocomplete="email">
      <button class="btn-primary" onclick="subscribe()">AANMELDEN →</button>
    </div>
    <div class="confirm-msg" id="confirmMsg">> Aanmelding ontvangen. We nemen contact op.</div>
  </div>
</div>

<footer>
  <span>© 2026 Cyberdyn Security · onderdeel van Ductus</span>
  <span>cyberdyn.nl</span>
</footer>

<script>
async function subscribe() {
  const email = document.getElementById('emailInput').value;
  if (!email || !email.includes('@')) { document.getElementById('emailInput').focus(); return; }
  try {
    await fetch('https://api.cyberdyn.nl/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'cyberdyn' })
    });
  } catch (e) { console.warn('waitlist api unavailable', e); }
  document.getElementById('emailForm').style.display = 'none';
  document.getElementById('confirmMsg').style.display = 'block';
}
document.getElementById('emailInput').addEventListener('keydown', e => { if (e.key === 'Enter') subscribe(); });
</script>
</body>
</html>
```

- [ ] **Stap 2: Visuele verificatie — open in browser**

Open `c:/Projecten/cyberdyn/public/index.html` in browser. Controleer:
- Nav zichtbaar met Product / Intel / Contact
- Hero met rode eyebrow "AI SECURITY TOOLING"
- Drie module-cards met rode top-border
- Status-feed met groene live-dots
- Aanmeld-formulier

- [ ] **Stap 3: Commit**

```bash
git add public/index.html
git commit -m "feat: corporate Professional Dark redesign landing page"
```

---

## Task 4: Dockerfile — multi-stage build

**Files:**
- Modify: `c:/Projecten/cyberdyn/Dockerfile`
- Create: `c:/Projecten/cyberdyn/Dockerfile.demo`
- Create: `c:/Projecten/cyberdyn/.dockerignore`

- [ ] **Stap 1: Update Dockerfile met Node builder stage**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY articles-src/ ./articles-src/
COPY build-articles.mjs ./
COPY public/ ./public/
RUN node build-articles.mjs

FROM nginx:alpine
COPY --from=builder /app/public/ /usr/share/nginx/html/
EXPOSE 80
```

- [ ] **Stap 2: Maak Dockerfile.demo**

```dockerfile
FROM nginx:alpine
COPY public-demo/ /usr/share/nginx/html/
EXPOSE 80
```

- [ ] **Stap 3: Maak .dockerignore**

```
node_modules/
.superpowers/
.git/
docs/
api/
articles-src-test/
public/articles-test/
```

- [ ] **Stap 4: Test de build lokaal**

```bash
cd c:/Projecten/cyberdyn
docker build -t cyberdyn-test .
```

Verwacht: build slaagt, beide stages voltooien. Als `articles-src/` leeg is: maak een dummy `.md` aan voor de test (verwijder daarna niet — echte artikelen komen in Task 7).

- [ ] **Stap 5: Commit**

```bash
git add Dockerfile Dockerfile.demo .dockerignore
git commit -m "feat: multi-stage Dockerfile met Node artikel-builder"
```

---

## Task 5: Demo site (public-demo/)

**Files:**
- Create: `c:/Projecten/cyberdyn/public-demo/index.html`

- [ ] **Stap 1: Kopieer de huidige Matrix-landing naar public-demo/**

```bash
mkdir -p c:/Projecten/cyberdyn/public-demo
cp c:/Projecten/cyberdyn/public/index.html c:/Projecten/cyberdyn/public-demo/index.html
```

**Let op:** Na Task 3 (corporate redesign) is `public/index.html` al overschreven. Als je dit plan in volgorde uitvoert: sla de Matrix-versie op vóór Task 3 of haal hem uit git:

```bash
git show HEAD~1:public/index.html > public-demo/index.html
```

Of haal hem direct uit de commit voordat de corporate versie werd geschreven:
```bash
git log --oneline public/index.html  # zoek de hash vóór corporate commit
git show <hash-voor-corporate>:public/index.html > public-demo/index.html
```

- [ ] **Stap 2: Voeg Matrix-demo link toe aan demo/index.html footer**

Voeg toe net voor `</footer>` in `public-demo/index.html`:
```html
<span>demo.cyberdyn.nl · <a href="https://cyberdyn.nl" style="color:#00cc33">→ cyberdyn.nl</a></span>
```

- [ ] **Stap 3: Commit**

```bash
git add public-demo/
git commit -m "feat: Matrix-demo versie in public-demo/"
```

---

## Task 6: Infra — demo.cyberdyn.nl (CF Tunnel + Coolify)

**Vereisten:** B1 SSH-toegang, CF API token (`CLOUDFLARE_API_TOKEN` in `c:/Projecten/.env`), Coolify API token

- [ ] **Stap 1: Maak Coolify-app aan voor demo (via SSH op B1)**

```powershell
# Lees tokens uit .env
$env = Get-Content c:/Projecten/.env | Where-Object { $_ -match "^[^#].+=." }
$tokens = @{}; $env | ForEach-Object { $p = $_ -split "=",2; $tokens[$p[0]] = $p[1] }
$coolifyToken = $tokens["COOLIFY_API_TOKEN"]

# Maak app aan
$body = @{
  name = "cyberdyn-demo"
  type = "dockerfile"
  git_repository = "https://github.com/ptrdbrbndr/cyberdyn"
  git_branch = "master"
  dockerfile_location = "Dockerfile.demo"
  ports_exposes = "80"
  server_uuid = "BEELINK1_SERVER_UUID"  # ophalen: GET /api/v1/servers
  destination_uuid = "STANDALONE_DOCKER_UUID"  # ophalen: GET /api/v1/destinations
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://coolify.cyberductus.nl/api/v1/applications/dockerfile" `
  -Method Post -Headers @{ Authorization = "Bearer $coolifyToken" } `
  -ContentType "application/json" -Body $body
```

Noteer de teruggegeven `uuid` — die heb je nodig voor de FQDN-update.

- [ ] **Stap 2: Stel FQDN in op demo.cyberdyn.nl**

```powershell
$appUuid = "UUID_UIT_STAP_1"
Invoke-RestMethod -Uri "https://coolify.cyberductus.nl/api/v1/applications/$appUuid" `
  -Method Patch -Headers @{ Authorization = "Bearer $coolifyToken" } `
  -ContentType "application/json" `
  -Body '{"domains":"https://demo.cyberdyn.nl"}'
```

- [ ] **Stap 3: Voeg demo.cyberdyn.nl toe aan CF Tunnel ingress**

Gebruik `c:/Projecten/cf-tunnel-add-hostname.mjs` (of direct via API). Tunnel ID: `4931da40-8b72-4cc3-8f7e-6802b5e948a5`

```bash
node c:/Projecten/cf-tunnel-add-hostname.mjs \
  --hostname demo.cyberdyn.nl \
  --service https://localhost:443 \
  --no-tls-verify
```

Als het script niet bestaat, voeg de regel handmatig toe via de CF Tunnel API (PUT configurations, zorg dat ALLE bestaande rules meegestuurd worden — zie ADR CF Tunnel PUT trap).

- [ ] **Stap 4: Voeg CF DNS CNAME toe**

```powershell
$cfToken = $tokens["CLOUDFLARE_API_TOKEN"]
$zoneId = "5ba6902bbd04404557c3b984fa8cb30c"

Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" `
  -Method Post -Headers @{ Authorization = "Bearer $cfToken" } `
  -ContentType "application/json" `
  -Body '{"type":"CNAME","name":"demo","content":"4931da40-8b72-4cc3-8f7e-6802b5e948a5.cfargotunnel.com","proxied":true}'
```

- [ ] **Stap 5: Deploy demo-app en verificeer**

```powershell
Invoke-RestMethod -Uri "https://coolify.cyberductus.nl/api/v1/deploy?uuid=$appUuid&force=true" `
  -Method Get -Headers @{ Authorization = "Bearer $coolifyToken" }
```

Wacht ~60s, open `https://demo.cyberdyn.nl` in browser. Verwacht: Matrix-landing zichtbaar.

---

## Task 7: Eerste drie Deep Dive artikelen

**Doel:** Drie markdown-bestanden klaar zodat de build-pipeline echte content heeft. Na deze task kun je parallel agents loslaten voor extra artikelen.

**Files:**
- Create: `c:/Projecten/cyberdyn/articles-src/2026-05-11-gitleaks-deep-dive.md`
- Create: `c:/Projecten/cyberdyn/articles-src/2026-04-28-nuclei-aanvalsoppervlak.md`
- Create: `c:/Projecten/cyberdyn/articles-src/2026-04-15-lynis-host-hardening.md`

- [ ] **Stap 1: Schrijf artikel 1 — Gitleaks**

```markdown
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
```

- [ ] **Stap 2: Schrijf artikel 2 — Nuclei**

Sla op als `articles-src/2026-04-28-nuclei-aanvalsoppervlak.md`:

```markdown
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
```

- [ ] **Stap 3: Schrijf artikel 3 — Lynis**

Sla op als `articles-src/2026-04-15-lynis-host-hardening.md`:

```markdown
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
```

- [ ] **Stap 4: Draai build en verificeer output**

```bash
cd c:/Projecten/cyberdyn
npm run build
```

Verwacht output:
```
Built: lynis-host-hardening.html
Built: nuclei-aanvalsoppervlak.html
Built: gitleaks-deep-dive.html
Built: articles/index.html (3 artikelen)
```

Open `public/articles/index.html` in browser. Drie artikelkaarten zichtbaar.

- [ ] **Stap 5: Commit**

```bash
git add articles-src/
git commit -m "feat: eerste drie Deep Dive artikelen (Gitleaks, Nuclei, Lynis)"
```

---

## Task 8: Waitlist API

**Files:**
- Create: `c:/Projecten/cyberdyn/api/package.json`
- Create: `c:/Projecten/cyberdyn/api/server.mjs`
- Create: `c:/Projecten/cyberdyn/api/Dockerfile`

- [ ] **Stap 1: Maak api/package.json**

```json
{
  "name": "cyberdyn-waitlist-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.mjs",
    "dev": "node --watch server.mjs"
  },
  "dependencies": {
    "express": "^4.19.2",
    "@supabase/supabase-js": "^2.43.0",
    "resend": "^3.2.0"
  }
}
```

- [ ] **Stap 2: Schrijf api/server.mjs**

```javascript
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://cyberdyn.nl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_AUDIENCE_ID } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
  console.error('Ontbrekende env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_AUDIENCE_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/waitlist', async (req, res) => {
  const { email, source = 'cyberdyn' } = req.body ?? {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }

  const { error: dbError } = await supabase
    .from('waitlist')
    .upsert({ email, source }, { onConflict: 'email', ignoreDuplicates: true });

  if (dbError) {
    console.error('supabase error', dbError.message);
    return res.status(500).json({ error: 'db error' });
  }

  await resend.contacts.create({
    email,
    audienceId: RESEND_AUDIENCE_ID,
    unsubscribed: false,
  }).catch(e => console.warn('resend fout (niet kritiek):', e.message));

  res.json({ ok: true });
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`waitlist api op :${PORT}`));
```

- [ ] **Stap 3: Schrijf api/Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
EXPOSE 3001
CMD ["node", "server.mjs"]
```

- [ ] **Stap 4: Maak Supabase-tabel aan op cyberductus-stack (B1 SSH)**

```bash
ssh pieter@192.168.68.71 "docker exec -i supabase-db-CYBERDUCTUS_UUID psql -U postgres -d postgres -c \"
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'cyberdyn',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE waitlist IS 'Retentie: zolang contact actief (verwijder op verzoek via DELETE /waitlist/{email})';
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_service_only ON waitlist USING (false);
\""
```

Vervang `CYBERDUCTUS_UUID` met de werkelijke container-naam (vind via `docker ps | grep db`).

- [ ] **Stap 5: Deploy API als Coolify-app op B1**

Via Coolify dashboard of API: nieuwe Dockerfile-app, repository `ptrdbrbndr/cyberdyn`, dockerfile `api/Dockerfile`, poort 3001, FQDN `api.cyberdyn.nl`.

Env vars instellen in Coolify:
```
SUPABASE_URL=https://supabase-cyberductus.cyberductus.nl
SUPABASE_SERVICE_ROLE_KEY=<service-role-key uit credentials.md>
RESEND_API_KEY=<resend-key uit credentials.md>
RESEND_AUDIENCE_ID=<maak aan via Resend dashboard, kopieer ID>
```

- [ ] **Stap 6: CF Tunnel + DNS voor api.cyberdyn.nl**

Zelfde werkwijze als Task 6 stap 3+4, maar met hostname `api.cyberdyn.nl` → `https://localhost:3001` (noTLSVerify).

CF DNS: `api CNAME → [tunnel-id].cfargotunnel.com` (proxied)

- [ ] **Stap 7: Smoke test**

```bash
curl -X POST https://api.cyberdyn.nl/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","source":"test"}'
```

Verwacht: `{"ok":true}`

Verifieer in Supabase Studio dat de row aangemaakt is, verwijder daarna de test-row.

- [ ] **Stap 8: Commit**

```bash
git add api/
git commit -m "feat: waitlist API (Express + Supabase + Resend)"
```

---

## Task 9: Parallelle artikel-agents

Na Task 7 (artikelen 1–3 klaar en build pipeline draait) kunnen meerdere agents tegelijk nieuwe artikelen schrijven.

**Werkwijze voor elke agent:**
1. Schrijf markdown naar `articles-src/YYYY-MM-DD-[slug].md` met correcte frontmatter
2. Run `npm run build` om te verifiëren dat het artikel zonder fouten bouwt
3. Commit: `git add articles-src/ public/articles/ && git commit -m "feat: artikel [titel]"`

**Frontmatter format (verplicht):**
```yaml
---
title: "Volledige artikeltitel"
date: YYYY-MM-DD
summary: "Één zin, max 150 tekens, gebruikt in artikel-cards."
tag: RECON   # RECON | CODE | SOC | HOST
readtime: N  # geschat aantal minuten
---
```

**Suggesties voor volgende artikelen (agents kunnen parallel werken):**

| Artikel | Tag | Focus |
|---|---|---|
| `testssl-sh-tls-audit` | RECON | TLS-versies, cipher suites, HSTS op 35 FQDNs |
| `trivy-dependency-scan` | CODE | Container-images en npm-packages scannen op CVEs |
| `semgrep-sast-next-js` | CODE | SAST-regels voor Next.js/TypeScript op de Ductus-stack |
| `falco-runtime-detectie` | SOC | Kernel-niveau anomalie-detectie in containers |
| `renovate-dependency-updates` | CODE | Automatisch afhouden van verouderde dependencies |

---

## Verificatie eindtoestand

Na alle tasks:

- [ ] `https://cyberdyn.nl` toont corporate Professional Dark landing
- [ ] `https://demo.cyberdyn.nl` toont Matrix-versie
- [ ] `https://cyberdyn.nl/articles/` toont 3+ artikelen
- [ ] Individuele artikelpagina's renderen correct (nav, back-link, code-blocks)
- [ ] Aanmeld-formulier POST naar `https://api.cyberdyn.nl/waitlist` → 200
- [ ] Email verschijnt in Supabase `waitlist` tabel én Resend audience
- [ ] `npm run build` produceert schone output zonder errors
- [ ] `npm test` groen
