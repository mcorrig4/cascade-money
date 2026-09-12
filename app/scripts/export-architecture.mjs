import { mkdtemp, readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sections } from '../src/architecture/data.ts';

// Compile the actual React SVG components, then render their fully revealed state.
// Keep the temporary module beneath app/ so React resolves from its installed dependencies.
const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = await mkdtemp(new URL('.architecture-export-', import.meta.url));
try {
  const source = (await readFile(new URL('../src/architecture/Diagrams.tsx', import.meta.url), 'utf8'))
    .replace("'./data.ts'", JSON.stringify(new URL('../src/architecture/data.ts', import.meta.url).href));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
  const modulePath = join(temp, 'diagrams.mjs');
  await writeFile(modulePath, outputText);
  const { diagrams } = await import(pathToFileURL(modulePath).href);
  const output = join(root, 'docs/architecture');
  await mkdir(output, { recursive: true });
  for (const [i, Diagram] of diagrams.entries()) {
    const name = `${i + 1}-${sections[i].slug}.svg`;
    await writeFile(join(output, name), '<?xml version="1.0" encoding="UTF-8"?>\n' + renderToStaticMarkup(createElement(Diagram)) + '\n');
    console.log(`docs/architecture/${name}`);
  }
  await copyFile(join(root, 'docs/architecture.svg'), join(output, '7-component-inventory.svg'));
  console.log('docs/architecture/7-component-inventory.svg');
} finally { await rm(temp, { recursive: true, force: true }); }
