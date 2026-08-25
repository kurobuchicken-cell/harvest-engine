import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// 週次評議会パイプラインの結果(data/ledger.json・council-output/)を自動でGitHubへ反映する。
// 2026-08-25、VM側にpush用の認証情報が無いため3週間分の実行結果がGitHubに反映されずGMが
// 気づけなかった事故を受けて導入(HANDOFF.md参照)。GITHUB_PATはログ・エラーメッセージに
// 絶対に含めない(execの引数配列にもコマンド文字列にも埋め込まず、-c http.extraHeaderのみに使う)
const TRACKED_PATHS = ["data/ledger.json", "council-output/"];

async function run(command: string): Promise<string> {
  const { stdout } = await execAsync(command, { cwd: process.cwd() });
  return stdout.trim();
}

export async function autoCommitAndPushCouncilResults(summary: string): Promise<void> {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    console.log("[gitSync] GITHUB_PAT未設定のためスキップ(手動でのcommit・pushが必要)");
    return;
  }

  try {
    await run(`git add ${TRACKED_PATHS.join(" ")}`);
    const status = await run("git status --porcelain -- " + TRACKED_PATHS.join(" "));
    if (!status) {
      console.log("[gitSync] 変更なし(commit不要)");
      return;
    }

    const message = `evaluate: 週次評議会自動実行の記録(${summary})`;
    await run(`git commit -m ${JSON.stringify(message)}`);

    // トークンはコマンド文字列に含めず、この実行だけの一時ヘッダーとして渡す(git configにも残らない)
    const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
    await execAsync(`git -c http.extraHeader="${authHeader}" push origin main`, { cwd: process.cwd() });

    console.log("[gitSync] commit・push完了");
  } catch (err) {
    // 失敗してもパイプライン自体は継続する(黙って握りつぶさずログに残す)
    console.error("[gitSync] commit/push失敗:", err instanceof Error ? err.message : String(err));
  }
}
