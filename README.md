# GAME.INC.RE

Static game collection, published at https://game.inc.re/.

- Repository: https://github.com/mumuhaha487/opus_game
- Production branch: `main` (the repository default branch)
- Cloudflare Pages project: `inc-games-git`
- Build command: `node build.mjs`
- Build output directory: `dist`
- Node.js: 22 or newer; no dependency installation is required.

## Updating the Site

Edit `index.html`, `hub/`, or `entropy-blade/`, then commit and push to `main`.
Cloudflare's GitHub integration builds and deploys each push automatically.
No ZIP upload or Cloudflare credential is needed for routine updates.

```powershell
node build.mjs
git add -- index.html hub entropy-blade functions server _routes.json tests _headers build.mjs deploy.ps1 README.md .gitignore
git commit -m "Update game"
git push origin main
```

The builder copies only the public site files into `dist`, versions asset URLs
using a content hash, and sets `window.BUILD` for dynamically loaded portraits.
Source JavaScript, images, and font license files stay editable in the repository.
Build output, archives, local app state, and credential files are ignored.

## Local Play

Open `index.html` directly for the collection or `entropy-blade/index.html`
for the game. Controls and game details are in `entropy-blade/README.md`.

## Optional Manual Deployment

`deploy.ps1` builds the same site and uploads it with Wrangler. It requires
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment.
Never put credential values into tracked files.

To add another game directory, add its name to `siteFiles` in `build.mjs`
and add its link to the collection page.

## 账号与云存档

熵刃的账号接口由同站点 Pages Functions 提供：`functions/` 是入口，
`server/` 实现认证、请求校验和存档清洗。R2 绑定名为 `ACCOUNTS`，
生产桶为 `game-inc-accounts`，预览桶为 `game-inc-accounts-preview`。
`_routes.json` 把 Functions 调用限定在 `/api/*`，静态资源由 Pages 直接提供。
进度与战绩存到私有 R2 桶，设置留在设备上。游客与每个账号的本机缓存分别保存。

从零搭建：

1. 在 Cloudflare 账号内创建上述两个 R2 桶，保持 r2.dev 访问关闭、自定义域名列表为空。
2. 给两个桶添加前缀为 `rl/` 的生命周期规则，`deleteObjectsTransition.condition`
   为 `{ "type": "Age", "maxAge": 86400 }`，启用后 GET 核对。
3. 在 Pages 项目 `inc-games-git` 的 production / preview 配置中分别添加对应的
   `ACCOUNTS` R2 绑定，保留现有 `NODE_VERSION`（`plain_text`，值为 `22`）及其它配置。
4. 每个环境各生成两个不同的 32 字节密码学随机数（base64url 编码），添加为
   `secret_text` 类型的 `AUTH_SECRET`、`PW_PEPPER`，PATCH 后 GET 核对变量类型和绑定。
   生产值备份到被忽略的 `.env.accounts`。`PW_PEPPER` 更换后所有已注册密码都会失效；
   `AUTH_SECRET` 更换后已有会话需重新登录。配置在下一次部署时生效。

本地联调在被忽略的 `.dev.vars` 中设置测试用的 `AUTH_SECRET`、`PW_PEPPER`。
使用 Node 22 执行：

```powershell
node --test tests/
node build.mjs
npx --yes wrangler@4 pages dev dist --r2 ACCOUNTS
```

Windows 上的 Node 把目录测试参数解析为模块路径时，使用显式文件列表：
`node --test tests/accounts.test.mjs tests/combat-skills.test.cjs tests/difficulty.test.cjs`。

接口通过同源 `/api/*` 访问；POST / PUT 请求带同源 `Origin` 与 JSON 媒体类型。
密码先经 `PW_PEPPER` 的 HMAC-SHA256，再进行带随机盐的 PBKDF2-SHA256
（目标迭代次数 100000，用户记录保存实际次数）。会话通过签名 Cookie 保存，
属性为 `__Host-gsid`、Secure、HttpOnly、SameSite=Lax、Path=/，有效期 30 天。
注册与存档使用 R2 条件写入，限流键经过 SHA256，`rl/` 临时计数一天后清理。
存档读写使用验证过的会话身份，上传数据按白名单清洗；桶保持私有。
第一阶段只进行本地联调；Workers 免费计划的密码哈希 CPU 验证在部署后执行。
