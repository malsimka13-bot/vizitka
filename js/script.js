/* Визитка: плавающие папки (как логотип DVD) и открытие папок */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = document.getElementById('stage');
  var scrim = document.getElementById('scrim');
  var closeBtn = document.getElementById('close');
  var pauseBtn = document.getElementById('pause');
  var toastEl = document.getElementById('toast');
  var seenEl = document.getElementById('seen');
  var cornersEl = document.getElementById('corners');
  var clockEl = document.getElementById('clock');
  var hintEl = document.getElementById('hint');
  var background = document.querySelectorAll('.bar, .desk, .dock');

  var items = Array.prototype.map.call(stage.querySelectorAll('.folder'), function (el) {
    return { el: el, id: el.dataset.id, x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0,
             slow: 1, hover: false, frozen: false, seen: false };
  });

  var W = 0, H = 0, last = 0;
  var paused = reduce;
  var current = null, closing = false;
  var seenCount = 0, corners = 0, toastTimer = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function measure() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    items.forEach(function (it) {
      it.w = it.el.offsetWidth;
      it.h = it.el.offsetHeight;
      it.x = Math.min(Math.max(it.x, 0), Math.max(W - it.w, 0));
      it.y = Math.min(Math.max(it.y, 0), Math.max(H - it.h, 0));
    });
  }

  function render(it) {
    it.el.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,' + it.y.toFixed(1) + 'px,0)';
  }

  function place() {
    measure();
    var speed = W < 640 ? 46 : 70;
    var cols = [0.08, 0.42, 0.74];
    items.forEach(function (it, i) {
      it.x = (W - it.w) * cols[i % cols.length];
      it.y = rand(0.1, 0.55) * (H - it.h);
      var a = rand(25, 65) * Math.PI / 180;
      it.vx = Math.cos(a) * speed * (Math.random() < 0.5 ? -1 : 1) * rand(0.85, 1.15);
      it.vy = Math.sin(a) * speed * (Math.random() < 0.5 ? -1 : 1) * rand(0.85, 1.15);
      render(it);
    });
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  function cornerHit() {
    corners++;
    cornersEl.textContent = corners;
    if (!current) toast('Папка попала ровно в угол!');
  }

  function step(dt) {
    items.forEach(function (it) {
      if (it.frozen) return;
      it.slow += ((it.hover ? 0.12 : 1) - it.slow) * Math.min(1, dt * 8);
      it.x += it.vx * dt * it.slow;
      it.y += it.vy * dt * it.slow;
      var hitX = false, hitY = false;
      if (it.x < 0) { it.x = 0; it.vx = Math.abs(it.vx); hitX = true; }
      else if (it.x > W - it.w) { it.x = W - it.w; it.vx = -Math.abs(it.vx); hitX = true; }
      if (it.y < 0) { it.y = 0; it.vy = Math.abs(it.vy); hitY = true; }
      else if (it.y > H - it.h) { it.y = H - it.h; it.vy = -Math.abs(it.vy); hitY = true; }
      if (hitX && hitY) cornerHit();
    });

    /* Папки отталкиваются друг от друга как упругие шарики */
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var a = items[i], b = items[j];
        if (a.frozen || b.frozen) continue;
        var dx = (b.x + b.w / 2) - (a.x + a.w / 2);
        var dy = (b.y + b.h / 2) - (a.y + a.h / 2);
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var min = (a.w + b.w) * 0.36;
        if (dist < min) {
          var nx = dx / dist, ny = dy / dist;
          var push = (min - dist) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          var rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rv > 0) {
            a.vx -= rv * nx; a.vy -= rv * ny;
            b.vx += rv * nx; b.vy += rv * ny;
          }
        }
      }
    }
    items.forEach(render);
  }

  function tick(t) {
    var dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (!paused && W) step(dt);
    requestAnimationFrame(tick);
  }

  /* Полёт папки со стола в центр экрана и обратно */
  function transformTo(fig, ico) {
    fig.style.transition = 'none';
    fig.style.transform = 'none';
    var a = fig.getBoundingClientRect();
    var b = ico.getBoundingClientRect();
    var s = b.width / a.width;
    return 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' +
           (b.top + b.height / 2 - a.top - a.height / 2) + 'px) scale(' + s + ')';
  }

  function setInert(on) {
    Array.prototype.forEach.call(background, function (el) { el.inert = on; });
  }

  function openScene(it) {
    if (current || closing) return;
    current = it;
    it.frozen = true;
    it.hover = false;

    var scene = document.getElementById('scene-' + it.id);
    var fig = scene.querySelector('.fig');
    scrim.hidden = false;
    scene.hidden = false;
    setInert(true);

    fig.style.transform = transformTo(fig, it.el.querySelector('.ico'));
    it.el.style.visibility = 'hidden';
    void fig.offsetWidth;

    scrim.classList.add('is-in');
    fig.style.transition = 'transform .65s cubic-bezier(.2, .8, .2, 1)';
    fig.style.transform = 'none';

    setTimeout(function () { scene.classList.add('is-open'); }, reduce ? 0 : 620);
    closeBtn.focus({ preventScroll: true });
    scrim.scrollTop = 0;
  }

  function finishClose(it, scene, fig) {
    scrim.hidden = true;
    scene.hidden = true;
    fig.style.transition = 'none';
    fig.style.transform = 'none';
    it.el.style.visibility = '';
    it.frozen = false;
    setInert(false);
    current = null;
    closing = false;
    it.el.focus({ preventScroll: true });

    if (!it.seen) {
      it.seen = true;
      it.el.classList.add('seen');
      seenCount++;
      seenEl.textContent = seenCount;
      hintEl.classList.add('gone');
      if (seenCount === items.length) toast('Все три проекта открыты. Спасибо, что заглянули!');
    }
  }

  function closeScene() {
    if (!current || closing) return;
    closing = true;
    var it = current;
    var scene = document.getElementById('scene-' + it.id);
    var fig = scene.querySelector('.fig');
    scene.classList.remove('is-open');

    setTimeout(function () {
      scrim.scrollTop = 0;
      var target = transformTo(fig, it.el.querySelector('.ico'));
      fig.style.transform = 'none';
      void fig.offsetWidth;
      fig.style.transition = 'transform .6s cubic-bezier(.5, 0, .3, 1)';
      fig.style.transform = target;
      scrim.classList.remove('is-in');
      setTimeout(function () { finishClose(it, scene, fig); }, reduce ? 0 : 620);
    }, reduce ? 0 : 560);
  }

  /* События */
  items.forEach(function (it) {
    it.el.addEventListener('click', function () { openScene(it); });
    it.el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') it.hover = true; });
    it.el.addEventListener('pointerleave', function () { it.hover = false; });
    it.el.addEventListener('focus', function () { it.hover = true; });
    it.el.addEventListener('blur', function () { it.hover = false; });
  });

  closeBtn.addEventListener('click', closeScene);
  scrim.addEventListener('click', function (e) {
    if (!e.target.closest('.card') && !e.target.closest('.fig') && !e.target.closest('.close')) closeScene();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeScene(); });

  function syncPause() {
    pauseBtn.textContent = paused ? 'Движение' : 'Пауза';
    pauseBtn.setAttribute('aria-pressed', String(paused));
  }
  pauseBtn.addEventListener('click', function () { paused = !paused; syncPause(); });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { measure(); items.forEach(render); }, 100);
  });

  function clock() {
    clockEl.textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  /* Старт */
  syncPause();
  clock();
  setInterval(clock, 10000);
  place();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { measure(); items.forEach(render); });
  }
  requestAnimationFrame(function (t) { last = t; requestAnimationFrame(tick); });
})();
