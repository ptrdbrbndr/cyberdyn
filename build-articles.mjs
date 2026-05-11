import { marked } from 'marked';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = process.env.ARTICLES_SRC_DIR ?? join(__dirname, 'articles-src');
const OUT_DIR = process.env.ARTICLES_OUT_DIR ?? join(__dirname, 'public/articles');

const REQUIRED = ['title', 'date', 'summary', 'tag', 'readtime'];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
<title>${esc(meta.title)} — Cyberdyn Intel</title>
<meta name="description" content="${esc(meta.summary)}">
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
    <div class="article-tag">${esc(meta.tag)}</div>
    <h1>${esc(meta.title)}</h1>
    <div class="article-byline">${esc(meta.date)} · ${esc(meta.readtime)} min leestijd</div>
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
      <span class="article-tag-sm">${esc(meta.tag)}</span>
      <span class="article-date">${esc(meta.date)}</span>
    </div>
    <h2 class="article-title"><a href="/articles/${esc(slug)}.html">${esc(meta.title)}</a></h2>
    <p class="article-summary">${esc(meta.summary)}</p>
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(SRC_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();

  const articles = [];
  for (const file of files) {
    const { meta, body } = parseFrontmatter(readFileSync(join(SRC_DIR, file), 'utf8'));
    const missing = REQUIRED.filter(k => !meta[k]);
    if (missing.length) throw new Error(`${file}: ontbrekende frontmatter velden: ${missing.join(', ')}`);
    const s = slug(file);
    writeFileSync(join(OUT_DIR, `${s}.html`), articlePage(meta, marked.parse(body)));
    articles.push({ meta, slug: s });
    console.log(`Built: ${s}.html`);
  }

  writeFileSync(join(OUT_DIR, 'index.html'), indexPage(articles));
  console.log(`Built: articles/index.html (${articles.length} artikelen)`);
}
