/* 漫画站 · 通用脚本
   1) 新站宣传弹窗：window.showSiteModal()
   2) 滚动入场：为 .reveal 元素在进入视口时加上 .in
   3) 无障碍：尊重 prefers-reduced-motion */
(function () {
    'use strict';

    // ===== 新站宣传弹窗（登录后 / 文档中心侧边栏可再次打开） =====
    function showSiteModal() {
        var overlay = document.getElementById('siteModalOverlay');
        if (overlay) {
            overlay.classList.add('open');
            return;
        }

        overlay = document.createElement('div');
        overlay.className = 'site-modal-overlay';
        overlay.id = 'siteModalOverlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', '新站上线通知');
        overlay.innerHTML =
            '<div class="site-modal">' +
                '<button type="button" class="site-modal-close" aria-label="关闭">✕</button>' +
                '<div class="site-modal-icon">🌱</div>' +
                '<h3>新站上线啦！</h3>' +
                '<p>嗨，欢迎回来～<br>我的另一个小站 <b>2026seeds.ccwu.cc</b> 已经上线了，<br>有空的话来串串门吧！</p>' +
                '<div class="site-modal-actions">' +
                    '<a class="btn btn-shine" href="https://2026seeds.ccwu.cc" target="_blank" rel="noopener noreferrer">👉 去参观 2026seeds.ccwu.cc</a>' +
                    '<button type="button" class="site-modal-later">下次再说</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        function close() {
            overlay.classList.remove('open');
            document.removeEventListener('keydown', onKeydown);
        }
        function onKeydown(e) {
            if (e.key === 'Escape') close();
        }

        overlay.querySelector('.site-modal-close').addEventListener('click', close);
        overlay.querySelector('.site-modal-later').addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        document.addEventListener('keydown', onKeydown);

        // 下一帧再显示，保证过渡动画生效
        requestAnimationFrame(function () {
            overlay.classList.add('open');
        });
    }

    window.showSiteModal = showSiteModal;

    // ===== 减少动态效果时直接显示所有内容 =====
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('reduce-motion');
        document.querySelectorAll('.reveal').forEach(function (el) {
            el.classList.add('in');
        });
        return;
    }

    // ===== 滚动入场 =====
    var els = document.querySelectorAll('.reveal');
    if (els.length === 0) return;

    if (!('IntersectionObserver' in window)) {
        els.forEach(function (el) { el.classList.add('in'); });
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

    els.forEach(function (el) { observer.observe(el); });
})();
