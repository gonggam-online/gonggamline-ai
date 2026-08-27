import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/market/page.tsx", "utf8");
const panel = readFileSync("components/market/external-import-panel.tsx", "utf8");

test("normal discovery workflow appears ahead of the Codex-assisted import tool", () => {
  assert.ok(page.indexOf("discovery-command__hero") < page.indexOf("<ExternalImportPanel />"));
  assert.match(panel, /사용자는 로그인만 · 수집·검증·반영은 Codex가 수행/);
  assert.match(panel, /사용자가 직접 복사하거나 붙여넣을 필요가 없습니다/);
});

test("authenticated browser handoff and official-source boundary are explicit", () => {
  assert.match(panel, /Tenbi 로그인·쇼핑 트렌드/);
  assert.match(panel, /TikTok Creative Center/);
  assert.match(panel, /세션 복제/);
  assert.match(panel, /비공식 스크래핑/);
  assert.match(panel, /검증 후 전체 데이터에 반영/);
});
