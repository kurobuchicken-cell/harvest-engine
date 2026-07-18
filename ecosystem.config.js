module.exports = {
  apps: [
    {
      name: "harvest-engine-scheduler",
      // Windows対策: npm.cmd/npx.cmd経由だとPM2のspawnがEINVALで失敗するため、
      // tsxのCLI(.mjs)をnodeで直接実行してnpm/cmdラッパーを完全に回避する
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/scheduler.ts",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      out_file: "logs/scheduler-out.log",
      error_file: "logs/scheduler-error.log",
      time: true,
    },
    {
      name: "harvest-engine-web",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/web/server.ts",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      out_file: "logs/web-out.log",
      error_file: "logs/web-error.log",
      time: true,
    },
    {
      name: "harvest-engine-council-scheduler",
      // 毎週月曜09:00 JST(=00:00 UTC)にsrc/council/run.tsのrunCouncilPipeline()を実行する。
      // ANTHROPIC_API_KEY/SLACK_WEBHOOK_URL/SLACK_MENTION_USER_IDが.envに未設定の間は
      // 実行のたびにエラーで終了するだけで課金は発生しない(オーナーが.env設定後に自動で動き出す)
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/councilScheduler.ts",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      out_file: "logs/council-scheduler-out.log",
      error_file: "logs/council-scheduler-error.log",
      time: true,
    },
  ],
};
