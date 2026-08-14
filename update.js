// ===== PWA / 手动更新 =====
const APP_VERSION = '1.0.1';
const VERSION_KEY = 'wux_app_version';

let swRegistration = null;
let swRefreshing = false;

function compareVersions(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

async function fetchRemoteVersion() {
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return String(data.version || '');
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
        swRegistration = await navigator.serviceWorker.register('./sw.js', {
            updateViaCache: 'none'
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (swRefreshing) return;
            swRefreshing = true;
            location.reload();
        });
    } catch (e) {
        console.warn('Service Worker 注册失败:', e);
    }
}

async function clearWuxCaches() {
    if (!('caches' in window)) return;

    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter(k => k.startsWith('wux-iot-'))
            .map(k => caches.delete(k))
    );
}

async function manualUpdate() {
    showToast('正在检查更新...');

    try {
        const remoteVersion = await fetchRemoteVersion();
        if (!remoteVersion) {
            showToast('获取版本信息失败', true);
            return;
        }

        const storedVersion = localStorage.getItem(VERSION_KEY);
        if (storedVersion && compareVersions(remoteVersion, storedVersion) <= 0) {
            showToast('已是最新版本 v' + storedVersion);
            return;
        }

        showToast('发现新版本 v' + remoteVersion + '，正在更新...');
        localStorage.setItem(VERSION_KEY, remoteVersion);

        await clearWuxCaches();

        if (!('serviceWorker' in navigator)) {
            showToast('缓存已清理，正在刷新...');
            setTimeout(() => location.reload(), 500);
            return;
        }

        let reg = swRegistration || await navigator.serviceWorker.getRegistration();

        if (!reg) {
            reg = await navigator.serviceWorker.register('./sw.js', {
                updateViaCache: 'none'
            });
        }

        await reg.update();

        if (reg.waiting) {
            showToast('发现新版本 v' + remoteVersion + '，正在重启...');
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });

            setTimeout(() => {
                location.reload();
            }, 1000);

            return;
        }

        if (reg.installing) {
            showToast('新版本安装中...');

            reg.installing.addEventListener('statechange', e => {
                if (e.target.state === 'installed') {
                    if (reg.waiting) {
                        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    setTimeout(() => {
                        location.reload();
                    }, 800);
                }
            });

            return;
        }

        showToast('已清空缓存，正在重新加载...');
        setTimeout(() => {
            location.reload();
        }, 500);

    } catch (e) {
        console.error(e);
        showToast('更新失败', true);
    }
}

function confirmManualUpdate(btnEl) {
    if (btnEl.dataset.confirming === 'true') {
        btnEl.dataset.confirming = 'false';
        btnEl.textContent = '更新';
        btnEl.style.borderColor = '';
        btnEl.style.color = '';
        manualUpdate();
        return;
    }

    btnEl.dataset.confirming = 'true';
    btnEl.textContent = '确认更新?';
    btnEl.style.borderColor = '#f44336';
    btnEl.style.color = '#f44336';

    setTimeout(() => {
        if (btnEl.dataset.confirming === 'true') {
            btnEl.dataset.confirming = 'false';
            btnEl.textContent = '更新';
            btnEl.style.borderColor = '';
            btnEl.style.color = '';
        }
    }, 3000);
}

registerServiceWorker();
