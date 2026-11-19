// 우리가족 캘린더 — 앱 화면 파일과 글꼴만 저장해 두는 서비스워커 (일정·가족 정보는 저장하지 않음)
const CACHE = 'famcal-1.9.1';
const FONTS = 'famcal-fonts-1';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function save(req, res) { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;

  // 구글 글꼴: 한 번 받으면 휴대폰에 두고 바로 사용
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // 앱 화면: 인터넷에서 새로 받되 1.5초 넘게 걸리면 저장해 둔 화면을 먼저 보여 줌 (뒤에서 계속 받아 다음에 반영)
  const net = fetch(req).then((res) => save(req, res));
  const wait = new Promise((ok) => setTimeout(ok, 1500)).then(() => caches.match(req));
  e.respondWith(
    Promise.race([net.catch(() => null), wait]).then((r) => r || net.catch(() => null)).then((r) => r || caches.match(req)).then((r) => r || caches.match('./index.html'))
  );
  e.waitUntil(net.catch(() => {}));
});
