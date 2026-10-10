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
git add -- index.html hub entropy-blade functions server _routes.json tests tools _headers build.mjs deploy.ps1 README.md .gitignore
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

GAME.INC.RE 的账号在所有游戏通用。在汇总页的账号对话框或熵刃标题菜单
「账号战绩」里注册、登录和退出。`hub/account-core.js` 提供共享的认证请求、
账号指针、缓存键、旧键迁移和退出流程；`hub/account-ui.js` 显示账号与游戏存档。
未登录时各游戏使用浏览器本地存档，登录后各游戏通过同一账号访问各自的云存档。

账号接口由同站点 Pages Functions 提供：`functions/` 是入口，
`server/` 实现认证和请求校验，`server/games/` 的 `GAMES` 注册表按游戏选择
白名单清洗函数。`GET /api/saves` 逐个读取已注册游戏，返回当前用户已有的云端存档。
R2 绑定名为 `ACCOUNTS`，
生产桶为 `game-inc-accounts`，预览桶为 `game-inc-accounts-preview`。
`_routes.json` 把 Functions 调用限定在 `/api/*`，静态资源由 Pages 直接提供。
进度与战绩存到私有 R2 桶，设置留在设备上。游客与每个账号的本机缓存分别保存。
全站账号指针是 `gameinc_profile_v1`，游戏缓存使用
`gameinc_save_<game>_<小写用户名>_v1`。其它标签页登录或退出时通过 `storage`
事件同步账号状态。退出会尝试上传脏缓存，仍未同步的进度留在这台设备上，
下次登录同一账号后由对应游戏合并上传。

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
node --test "tests/*.test.*"
node build.mjs
npx --yes wrangler@4 pages dev dist --r2 ACCOUNTS
```

接口通过同源 `/api/*` 访问；POST / PUT 请求带同源 `Origin` 与 JSON 媒体类型。
密码先经 `PW_PEPPER` 的 HMAC-SHA256，再进行带随机盐的 PBKDF2-SHA256
（目标迭代次数 100000，用户记录保存实际次数）。会话通过签名 Cookie 保存，
属性为 `__Host-gsid`、Secure、HttpOnly、SameSite=Lax、Path=/，有效期 30 天。
注册与存档使用 R2 条件写入，限流键经过 SHA256，`rl/` 临时计数一天后清理。
存档读写使用验证过的会话身份，上传数据按白名单清洗；桶保持私有。
第一阶段只进行本地联调；Workers 免费计划的密码哈希 CPU 验证在部署后执行。

### 接入新游戏

1. 在 `server/games/` 添加导出 `clean` 的清洗模块，在 `index.js` 的 `GAMES` 中登记游戏 id。
2. 游戏页面加载 `../hub/account-core.js`，使用 `GameAccount.cacheKey(game, name)`
   和 `GameAccount.resetKey(game, name)` 保存本机账号缓存，按游戏实现同步与冲突合并。
3. 在 `hub/account-ui.js` 的 `HUB_GAMES` 中添加游戏名、链接、游客存档键和进度摘要函数。

### 汇总页字体

修改汇总页或 `hub/*.js` 的文字后，重新生成像素字体子集并运行回归测试。
工具会比较源字体和当前子集的 family、subfamily、version、unitsPerEm 与共同字形步进宽度，
版本一致时使用熵刃内嵌的 `fp12`；其它版本可以传入同版本的源 WOFF2 路径。
字符收集覆盖 `index.html`、`hub/*.js` 的可显示字符和全部可打印 ASCII。
生成工具的依赖只安装在被忽略的 `tools/.deps/`，站点构建保持零依赖。

```powershell
npm install --no-save --prefix tools/.deps subset-font
node tools/hub-font.mjs
node --test "tests/*.test.*"
node build.mjs
```

`tests/hub-font.test.mjs` 使用 Node Brotli 解压 WOFF2 表数据，解析 cmap 格式 4/12
检查字符覆盖。`tools/` 与工具依赖留在源码工作区，`dist` 只包含站点文件。
