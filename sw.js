/* sw.js — オフライン対応のキャッシュ
 * HTML/JS はネット優先（常に最新を配信、オフライン時のみキャッシュ）。
 * それ以外(css/画像/manifest)はキャッシュ優先で高速表示。
 */
var CACHE = 'seikyu-ryosyo-v5';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './engine.js',
  './app.js',
  './lib/jspdf.umd.min.js',
  './lib/html2canvas.min.js',
  './privacy.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// ネット優先: 取得できたらキャッシュも更新。失敗時のみキャッシュ。
function networkFirst(req) {
  return fetch(req).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      return hit || caches.match('./index.html');
    });
  });
}

// キャッシュ優先: あれば即返し、無ければ取得してキャッシュ。
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var isDoc = req.mode === 'navigate' ||
    /\.(html|js)$/.test(url.pathname) ||
    url.pathname === '/' || url.pathname.endsWith('/');
  e.respondWith(isDoc ? networkFirst(req) : cacheFirst(req));
});
