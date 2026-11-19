// 우리가족 캘린더 — 앱 화면 파일과 글꼴만 저장해 두는 서비스워커 (일정·가족 정보는 저장하지 않음)
const CACHE = 'famcal-2.1.3';
const FONTS = 'famcal-fonts-1';
const BADGE = 'famcal-badge';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS && k !== BADGE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function save(req, res) { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;

  // 구글 글꼴·Firebase 프로그램 파일: 한 번 받으면 휴대폰에 두고 바로 사용 (버전이 붙은 파일이라 바뀌지 않음)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0)) {
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

/* ── 휴대폰 알림: 앱이 꺼져 있어도 알림을 띄우고 아이콘 숫자를 올림 ── */
function badgeGet() { return caches.open(BADGE).then((c) => c.match('count')).then((r) => (r ? r.text() : '0')).then((t) => Number(t) || 0); }
function badgeSet(n) { return caches.open(BADGE).then((c) => c.put('count', new Response(String(n)))); }

self.addEventListener('push', (e) => {
  let j = {};
  try { j = e.data ? e.data.json() : {}; } catch (err) { j = {}; }
  const d = j.data || (j.notification) || j || {};
  e.waitUntil(badgeGet().then((n) => {
    n += 1;
    return Promise.all([
      badgeSet(n),
      self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge(n).catch(() => {}) : null,
      self.registration.showNotification(d.title || '우리가족 캘린더', {
        body: d.body || '새 소식이 있어요', icon: './icon-192.png', badge: './icon-192.png',
        tag: 'famcal-' + (d.id || Date.now()), renotify: true, data: { url: './' }
      })
    ]);
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});

// 앱이 열려 있을 때 앱이 계산한 '안 읽은 소식' 숫자로 맞춤
self.addEventListener('message', (e) => {
  if (e.data && typeof e.data.badge === 'number') e.waitUntil(badgeSet(e.data.badge));
});
