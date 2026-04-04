import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const DASHBOARD_DIR = join(process.cwd(), 'src/app/dashboard');
const PATTERN = 'const store = storeId ? { id: storeId } : null';

async function findClientFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findClientFiles(fullPath));
    } else if (entry.name.endsWith('-client.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const files = await findClientFiles(DASHBOARD_DIR);
  let fixedCount = 0;
  const details = [];

  for (const filePath of files) {
    const original = await readFile(filePath, 'utf8');
    if (!original.includes(PATTERN)) continue;

    let updated = original;
    const changes = [];

    // 1. Remove the wrapper line (with leading whitespace and trailing newline)
    const before1 = updated;
    updated = updated.replace(/^[ \t]*const store = storeId \? \{ id: storeId \} : null\n/gm, '');
    if (updated !== before1) changes.push('removed wrapper line');

    // 2. Replace store.id with storeId (word-boundary safe)
    const before2 = updated;
    updated = updated.replace(/\bstore\.id\b/g, 'storeId');
    if (updated !== before2) changes.push('store.id -> storeId');

    // 3. Replace if (!store) with if (!storeId) and if (store) with if (storeId)
    const before3 = updated;
    updated = updated.replace(/if\s*\(\s*!store\s*\)/g, 'if (!storeId)');
    updated = updated.replace(/if\s*\(\s*store\s*\)/g, 'if (storeId)');
    if (updated !== before3) changes.push('if (store) -> if (storeId)');

    if (updated !== original) {
      await writeFile(filePath, updated, 'utf8');
      const relPath = filePath.replace(process.cwd() + '/', '');
      details.push({ file: relPath, changes });
      fixedCount++;
    }
  }

  for (const d of details) {
    console.log(`Fixed: ${d.file} [${d.changes.join(', ')}]`);
  }
  console.log(`\nTotal files fixed: ${fixedCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });
