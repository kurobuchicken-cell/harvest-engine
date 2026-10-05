import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// 週次評議会パイプラインの結果(data/ledger.json・council-output/)を自動でGitHubへ反映する。
// 2026-08-25、VM側にpush用の認証情報が無いため3週間分の実行結果がGitHubに反映されずGMが
// 気づけなかった事故を受けて導入(HANDOFF.md参照)。GITHUB_PATはログ・エラーメッセージに
// 絶対に含めない(コマンド文字列に埋め込まず、GIT_CONFIG_*環境変数経由でのみ渡す)
const TRACKED_PATHS = ["data/ledger.json", "council-output/"];

async function run(command: string, env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execAsync(command, { cwd: process.cwd(), env });
  return stdout.trim();
}

// 2026-10-05、push失敗時のerr.messageに-c http.extraHeaderのコマンド文字列(=base64化したトークン)が
// そのまま含まれ、pm2ログに6週間平文で残っていた事故を受け、ヘッダーはGIT_CONFIG_*環境変数経由で渡し
// コマンド文字列から完全に排除した。加えてエラーメッセージも念のためマスクする
function buildAuthEnv(token: string): NodeJS.ProcessEnv {
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
  return { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.extraHeader", GIT_CONFIG_VALUE_0: authHeader };
}

function maskSecrets(text: string, token: string): string {
  const encoded = Buffer.from(`x-access-token:${token}`).toString("base64");
  return text.split(token).join("***").split(encoded).join("***").replace(/AUTHORIZATION: basic \S+/gi, "AUTHORIZATION: basic ***");
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

    const authEnv = buildAuthEnv(token);
    // ローカルPCから先にpushされていると non-fast-forward で拒否される(8/31〜10/5に毎週失敗していた)。
    // push前に必ずrebaseで取り込む。競合時はabortして元の状態に戻し、手動解消に委ねる
    try {
      await run("git pull --rebase origin main", authEnv);
    } catch (err) {
      await run("git rebase --abort").catch(() => undefined);
      throw err;
    }
    await run("git push origin main", authEnv);

    console.log("[gitSync] commit・push完了");
  } catch (err) {
    // 失敗してもパイプライン自体は継続する(黙って握りつぶさずログに残す)
    console.error("[gitSync] commit/push失敗:", maskSecrets(err instanceof Error ? err.message : String(err), token));
  }
}
