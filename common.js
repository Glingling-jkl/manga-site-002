/* 漫画站 · 通用动效脚本
   1) 滚动入场：为 .reveal 元素在进入视口时加上 .in
   2) 无障碍：尊重 prefers-reduced-motion */
(function () {
    'use strict';

    // 减少动态效果时直接显示所有内容
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('reduce-motion');
        document.querySelectorAll('.reveal').forEach(function (el) {
            el.classList.add('in');
        });
        return;
    }

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
