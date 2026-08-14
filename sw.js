const CACHE_NAME = 'wux-iot-v3';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './mqtt.min.js',
    './update.js'
];

// 安装
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// 激活
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // 版本检查文件：始终走网络，不缓存
    if (url.pathname.endsWith('/version.json')) {
        event.respondWith(fetch(request));
        return;
    }

    // 页面导航：网络优先，保证拿到最新版本
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // 静态资源：缓存优先，缓存没有再走网络
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});

self.addEventListener('message', event => {
    const data = event.data || {};

    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(keys =>
                Promise.all(
                    keys
                        .filter(k => k.startsWith('wux-iot-'))
                        .map(k => caches.delete(k))
                )
            )
        );
    }
});
