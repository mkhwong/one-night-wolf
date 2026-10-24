import * as esbuild from 'esbuild';
import fs from 'fs';
const opts = {
  entryPoints: ['src/main.tsx'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', legalComments: 'none',
  logLevel: 'warning',
};
const r = await esbuild.build({ ...opts, define: { __TEST__: 'false' } });
const rt = await esbuild.build({ ...opts, define: { __TEST__: 'true' } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const jsT = rt.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/styles.css', 'utf8');
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=LXGW+WenKai+TC:wght@400;700&family=Noto+Sans+TC:wght@400;500;700&display=swap';
const head = `<title>一夜狼人殺 One Night Wolf</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>
`;
const body = `<div id="root"></div>\n`;
const cdn = `<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/onuw.html', head + body + cdn + `<script>${js}</script>\n`);
const local = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head}</head><body>${body}<script src="react.js"></script><script src="react-dom.js"></script><script>${jsT}</script></body></html>`;
fs.writeFileSync('dist/test.html', local);
fs.copyFileSync('node_modules/react/umd/react.production.min.js', 'dist/react.js');
fs.copyFileSync('node_modules/peerjs/dist/peerjs.min.js', 'dist/peerjs.js');

// ---- standalone site for GitHub Pages (React + PeerJS from pinned CDNs)
const ICON = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0a1020"/><path d="M20 5a11 11 0 1 0 7 19A9 9 0 1 1 20 5z" fill="#f2d184"/></svg>');
const RESET = '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>';
const siteHead = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="One Night Wolf (一夜狼人殺): a one-night werewolf party game for 3–10 players. Create a room, share the code, play on phones or PCs.">
<meta name="theme-color" content="#0a1020"><link rel="icon" href="${ICON}">${RESET}
${head}`;
const siteScripts = `<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"></script>
`;
// GitHub Pages serves this file from the repository root
fs.writeFileSync('index.html', `<!doctype html><html lang="zh-Hant"><head>${siteHead}</head><body>${body}${siteScripts}<script>${js}</script></body></html>\n`);
// local peer-to-peer test page: same app, PeerJS served locally, pointed at a local PeerServer
const peerCfg = `<script>window.ONUW_PEER={host:'127.0.0.1',port:9000,path:'/',secure:false,debug:1,config:{iceServers:[]}};</script>`;
fs.writeFileSync('dist/test-peer.html', `<!doctype html><html lang="zh-Hant"><head>${siteHead}</head><body>${body}<script src="react.js"></script><script src="react-dom.js"></script><script src="peerjs.js"></script>${peerCfg}<script>${jsT}</script></body></html>`);
console.log('index.html (GitHub Pages)', (fs.statSync('index.html').size / 1024).toFixed(0) + ' KB');
fs.copyFileSync('node_modules/react-dom/umd/react-dom.production.min.js', 'dist/react-dom.js');
console.log('built', (fs.statSync('dist/onuw.html').size / 1024).toFixed(0) + ' KB');
