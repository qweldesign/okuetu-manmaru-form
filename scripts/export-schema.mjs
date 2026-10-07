// フォーム定義（src/form/schema.ts）を、PHP 側で読む api/schema.json に書き出す。
// TypeScript の読み込みには Vite を使う（追加の依存なし）。
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../api/schema.json', import.meta.url));

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { SCHEMA, ROUTES, ROUTE_RULES } = await server.ssrLoadModule('/src/form/schema.ts');
  const json = { steps: SCHEMA.steps, routes: ROUTES, routeRules: ROUTE_RULES };
  await mkdir(fileURLToPath(new URL('../api/', import.meta.url)), { recursive: true });
  await writeFile(out, JSON.stringify(json, null, 2) + '\n');
  console.log(`schema exported: ${out}`);
} finally {
  await server.close();
}
