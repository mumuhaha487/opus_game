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
git add -- index.html hub entropy-blade _headers build.mjs deploy.ps1 README.md .gitignore
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
