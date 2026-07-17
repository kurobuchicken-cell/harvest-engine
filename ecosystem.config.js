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
  ],
};
