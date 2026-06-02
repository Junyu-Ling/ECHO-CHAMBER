
  # Echo Chamber

  This is a code bundle for Echo Chamber. The original project is available at https://www.figma.com/design/x5t2U2lnLFfaGIYyQAVh9j/Echo-Chamber.

  ## Running the code

  Run `pnpm i` to install the dependencies.

  Run `pnpm dev` to start the development server.

  ## GitHub（分支 `ECHO-CHAMBER`）

  本地已初始化 Git，当前分支为 **`ECHO-CHAMBER`**；大体积 `.mp4` 使用 **Git LFS**。

  ### 首次推送到 GitHub（需登录一次）

  1. 登录 GitHub CLI：`gh auth login`（按提示在浏览器完成授权）
  2. 在 GitHub 上新建空仓库（例如 `ECHO-CHAMBER`），或记下已有仓库地址
  3. 在项目根目录执行：

  ```powershell
  powershell -File scripts/setup-github-remote.ps1 -RepoUrl https://github.com/你的用户名/仓库名.git
  node scripts/git-sync.mjs
  ```

  也可在登录后由 CLI 创建仓库并推送：

  ```powershell
  gh repo create ECHO-CHAMBER --private --source=. --remote=origin --push
  git push -u origin ECHO-CHAMBER
  ```

  ### 之后每次改动自动同步

  - **Cursor 对话结束**：`.cursor/hooks.json` 会在 Agent 结束时运行 `node scripts/git-sync.mjs`
  - **手动同步**：`pnpm sync:github`
  - **每次 git commit 后自动 push**（可选，执行一次）：

  ```powershell
  powershell -File scripts/enable-githooks.ps1
  ```

  