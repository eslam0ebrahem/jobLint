import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(process.cwd());

function sourceFiles(relativeDirectory: string): string[] {
  const root = resolve(projectRoot, relativeDirectory);
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(path);
    }
  };
  visit(root);
  return files;
}

function relative(path: string): string {
  return path.slice(projectRoot.length + 1).replaceAll('\\', '/');
}

describe('architecture boundaries', () => {
  it('keeps domain, application, and evaluator code free from browser and network APIs', () => {
    const forbidden = /\b(?:browser|chrome|indexedDB)\s*\.|\bfetch\s*\(/;
    const violations: string[] = [];
    for (const directory of ['src/domain', 'src/application', 'src/lib/evaluation']) {
      for (const path of sourceFiles(directory)) {
        const source = readFileSync(path, 'utf8');
        if (forbidden.test(source)) violations.push(relative(path));
        if (source.includes("@/src/infrastructure/")) violations.push(`${relative(path)} imports infrastructure`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps React surfaces behind the gateway and pure domain helpers', () => {
    const forbidden = /from\s+['"](?:@\/src\/infrastructure\/|@\/src\/lib\/(?:ai|backup|db|evaluation|identity|settings)(?:\/|['"]))/;
    const violations: string[] = [];
    for (const surface of ['entrypoints/popup', 'entrypoints/dashboard', 'entrypoints/profile', 'entrypoints/options']) {
      for (const path of sourceFiles(surface)) {
        if (forbidden.test(readFileSync(path, 'utf8'))) violations.push(relative(path));
      }
    }
    expect(violations).toEqual([]);
  });

  it('removes obsolete compatibility modules after direct imports migrate', () => {
    for (const path of ['src/lib/ai.ts', 'src/lib/backup.ts', 'src/lib/db.ts', 'src/lib/identity.ts', 'src/lib/settings.ts']) {
      expect(existsSync(resolve(projectRoot, path)), path).toBe(false);
    }
  });
});
