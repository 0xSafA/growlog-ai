import fs from 'node:fs';
import path from 'node:path';

import { messagesByLocale } from '../lib/i18n/messages';
import { LOCALES, type Locale } from '../lib/i18n/locales';

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueKind(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function getByDotKey(obj: unknown, dotKey: string): unknown {
  const parts = dotKey.split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (!isPlainObject(cur) || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function flattenShape(
  obj: unknown,
  prefix = '',
  out = new Map<string, string>()
): Map<string, string> {
  if (!isPlainObject(obj)) return out;

  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const kind = valueKind(v);
    out.set(key, kind);
    if (kind === 'object') flattenShape(v, key, out);
  }
  return out;
}

function walkFiles(dir: string, exts = new Set(['.ts', '.tsx'])): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue;
      out.push(...walkFiles(full, exts));
      continue;
    }
    if (e.isFile() && exts.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function extractTKeysFromFile(filePath: string): string[] {
  const src = fs.readFileSync(filePath, 'utf8');
  const keys: string[] = [];
  const re = /\bt\(\s*(['"`])([^'"`]+)\1/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src)) !== null) {
    const key = match[2]?.trim();
    if (key) keys.push(key);
  }
  return keys;
}

function main() {
  const base = messagesByLocale.en as unknown as JsonLike;
  const baseShape = flattenShape(base);

  let hasErrors = false;

  for (const locale of LOCALES) {
    if (locale === 'en') continue;
    const tObj = messagesByLocale[locale] as unknown as JsonLike;
    const shape = flattenShape(tObj);

    const missing: string[] = [];
    const kindMismatches: Array<{ key: string; expected: string; actual: string }> = [];

    baseShape.forEach((expectedKind, k) => {
      const actualKind = shape.get(k);
      if (!actualKind) {
        missing.push(k);
        return;
      }
      if (expectedKind !== actualKind) {
        kindMismatches.push({ key: k, expected: expectedKind, actual: actualKind });
      }
    });

    if (missing.length || kindMismatches.length) {
      hasErrors = true;
      console.error(`\n[${locale}] Missing or mismatched translation keys:`);
      for (const k of missing.slice(0, 200)) console.error(`  - missing: ${k}`);
      for (const m of kindMismatches.slice(0, 50)) {
        console.error(`  - kind ${m.key}: expected ${m.expected}, got ${m.actual}`);
      }
    }
  }

  const repoRoot = path.resolve(__dirname, '..');
  const scanDirs = ['pages', 'components'].map((d) => path.join(repoRoot, d));
  const files = scanDirs.flatMap((d) => (fs.existsSync(d) ? walkFiles(d) : []));

  const used = new Set<string>();
  for (const f of files) {
    for (const k of extractTKeysFromFile(f)) used.add(k);
  }

  const missingInEn: string[] = [];
  used.forEach((key) => {
    const v = getByDotKey(base, key);
    if (typeof v === 'undefined') missingInEn.push(key);
  });

  if (missingInEn.length) {
    hasErrors = true;
    console.error(`\n[en] Missing keys referenced in code (${missingInEn.length}):`);
    for (const k of missingInEn.slice(0, 250)) console.error(`- ${k}`);
  }

  if (hasErrors) {
    console.error('\n❌ i18n check failed.');
    process.exit(1);
  }

  console.log('✅ i18n check passed.');
}

main();
