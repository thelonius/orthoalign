#!/usr/bin/env node
// Копирует backend/data/cases/* в frontend/public/cases/ и собирает index.json.
// Запускается перед vite build, чтобы продакшн-билд работал без backend.
import { readdir, readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "../../backend/data/cases");
const DST = path.resolve(__dirname, "../public/cases");

async function main() {
  if (!existsSync(SRC)) {
    console.error(`Нет директории кейсов: ${SRC}`);
    process.exit(1);
  }
  await rm(DST, { recursive: true, force: true });
  await mkdir(DST, { recursive: true });

  const dirs = (await readdir(SRC, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const index = [];
  for (const id of dirs) {
    const meta = JSON.parse(
      await readFile(path.join(SRC, id, "meta.json"), "utf8"),
    );
    const dataSrc = path.join(SRC, id, "data.json");
    const dataDst = path.join(DST, `${id}.json`);
    if (!existsSync(dataSrc)) {
      console.warn(`[skip] ${id}: нет data.json`);
      continue;
    }
    await copyFile(dataSrc, dataDst);
    index.push(meta);
    console.log(`[ok] ${id}`);
  }

  await writeFile(
    path.join(DST, "index.json"),
    JSON.stringify(index, null, 2),
  );
  console.log(`\nИндекс: ${index.length} кейсов записан в ${DST}/index.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
