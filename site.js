/* Theme toggle, shoot-pack carousel, active tab in the phone tab bar */
(function () {
  'use strict';
  var root = document.documentElement;

  // ---- theme ----
  var btn = document.getElementById('themeToggle');
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function label() { if (btn) btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); }
  if (btn) {
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('gm-bs-theme', next); } catch (e) {}
      label();
    });
    label();
  }

  // ---- carousel ----
  var track = document.querySelector('[data-track]');
  if (track) {
    var items = Array.prototype.slice.call(track.children);
    var now = document.querySelector('[data-car-now]');
    var prev = document.querySelector('[data-car="prev"]');
    var next = document.querySelector('[data-car="next"]');
    var current = 0;
    function step() { return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth; }
    function update() {
      var i = Math.round(track.scrollLeft / step());
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) i = items.length - 1;
      current = Math.max(0, Math.min(items.length - 1, i));
      if (now) now.textContent = current + 1;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }
    function go(i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      track.scrollTo({ left: items[i].offsetLeft - items[0].offsetLeft, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { go(current - 1); });
    if (next) next.addEventListener('click', function () { go(current + 1); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    });
    window.addEventListener('resize', update);
    update();

    // links that point at an artefact scroll the page to the carousel, then the track to the card
    Array.prototype.forEach.call(document.querySelectorAll('[data-goto-artefact]'), function (a) {
      a.addEventListener('click', function (e) {
        var n = +a.getAttribute('data-goto-artefact') - 1;
        e.preventDefault();
        document.getElementById('process').scrollIntoView({ behavior: 'smooth' });
        go(n);
        items[n].classList.add('is-flash');
        try { history.replaceState(null, '', '#artefact-' + (n + 1)); } catch (err) {}
      });
    });
  }

  // ---- phone tab bar: highlight the section in view ----
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabbar a'));
  if (tabs.length && 'IntersectionObserver' in window) {
    var map = {};
    tabs.forEach(function (t) { map[t.getAttribute('href').slice(1)] = t; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          tabs.forEach(function (t) { t.classList.toggle('is-on', t === map[en.target.id]); });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }
})();
