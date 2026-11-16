import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULTS, parseDefaults, menuFor } from "./agents.js";

function fixture(run) {
  const home = mkdtempSync(join(tmpdir(), "shepherdr-codex-models-"));
  try {
    const codex = join(home, ".codex");
    mkdirSync(codex);
    const catalog = (path, slug) => writeFileSync(path, JSON.stringify({ models: [
      { slug, display_name: "Provider model", visibility: "list",
        supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }] },
      { slug: "hidden", visibility: "hide" },
    ] }));
    const read = (codexHome = "") => {
      const result = spawnSync("sh", ["-c", DEFAULTS, "defaults", "codex"], {
        env: { ...process.env, HOME: home, CODEX_HOME: codexHome }, encoding: "utf8",
      });
      expect(result.status).toBe(0);
      return parseDefaults("codex", result.stdout);
    };
    run({ home, codex, catalog, read });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("Codex uses model_catalog_json before a stale default model cache", () => fixture(({ codex, catalog, read }) => {
  const file = join(codex, "provider models.json");
  catalog(file, "provider/custom");
  catalog(join(codex, "models_cache.json"), "stale");
  writeFileSync(join(codex, "config.toml"), `model = "provider/custom"\nmodel_reasoning_effort = "xhigh"\nmodel_catalog_json = "${file}"\n`);
  const defaults = read();
  expect(defaults.model).toBe("provider/custom");
  expect(defaults.effort).toBe("xhigh");
  expect(menuFor("codex", defaults).models).toMatchObject([
    { id: "provider/custom", name: "Provider model", efforts: ["high", "xhigh"] },
  ]);
  expect(defaults.models).toHaveLength(1);
}));

test("Codex still reads its cache when no catalog is configured", () => fixture(({ codex, catalog, read }) => {
  catalog(join(codex, "models_cache.json"), "cached");
  expect(read().models.map((m) => m.id)).toEqual(["cached"]);
}));

test("Codex home and relative literal catalog paths are respected", () => fixture(({ home, catalog, read }) => {
  const alternate = join(home, "alternate codex");
  mkdirSync(alternate);
  catalog(join(alternate, "models.json"), "alternate");
  writeFileSync(join(alternate, "config.toml"), "  model = 'alternate' # default\nmodel_catalog_json = 'models.json'\n[profiles.other]\nmodel = 'wrong'\n");
  const defaults = read(alternate);
  expect(defaults.model).toBe("alternate");
  expect(defaults.models.map((m) => m.id)).toEqual(["alternate"]);
}));

test("Codex does not mistake profile settings for user defaults", () => fixture(({ codex, catalog, read }) => {
  catalog(join(codex, "models_cache.json"), "cached");
  writeFileSync(join(codex, "config.toml"), '[profiles.other]\nmodel = "wrong"\nmodel_catalog_json = "/missing.json"\n');
  expect(read()).toMatchObject({ model: null, models: [{ id: "cached" }] });
}));
