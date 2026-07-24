import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// VM側(Oracle VM、council-scheduler/audit-schedulerが記帳する台帳)をSSH経由で取得し、
// ローカルにキャッシュする。このファイル自体はVMの実データのコピー(参照用)であり
// git管理はしない(.gitignore参照)。台帳の正本はローカル/VMそれぞれのdata/ledger.jsonのまま。
const VM_HOST = "ubuntu@161.33.148.155";
const VM_KEY_PATH = path.resolve(process.cwd(), "tokens", "harvest_engine_vm_key");
const VM_LEDGER_PATH = "/home/ubuntu/apps/harvest-engine/data/ledger.json";
const CACHE_PATH = path.resolve(process.cwd(), "data", "ledger.vm.json");

async function main(): Promise<void> {
  const result = spawnSync(
    "ssh",
    ["-i", VM_KEY_PATH, "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", VM_HOST, "cat", VM_LEDGER_PATH],
    { encoding: "utf-8" },
  );

  if (result.error || result.status !== 0) {
    console.error("VM側ledger.jsonの取得に失敗しました。");
    console.error(result.stderr || result.error?.message || `exit code ${result.status}`);
    process.exitCode = 1;
    return;
  }

  // 取得内容が壊れたキャッシュとして残らないよう、書き込み前にJSONとして検証する
  JSON.parse(result.stdout);

  await writeFile(CACHE_PATH, result.stdout, "utf-8");
  console.log(`VM側ledger.jsonを取得しました: ${CACHE_PATH}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
