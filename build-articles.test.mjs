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
  assert.ok(article.includes('<code'), 'code block aanwezig');

  const index = readFileSync(join(TMP_OUT, 'index.html'), 'utf8');
  assert.ok(index.includes('Test Artikel'), 'titel aanwezig in index');
  assert.ok(index.includes('Een test samenvatting'), 'summary aanwezig in index');

  rmSync(TMP_SRC, { recursive: true, force: true });
  rmSync(TMP_OUT, { recursive: true, force: true });
});
