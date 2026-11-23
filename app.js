/* Desafio dos Pequenos Músicos — página dos pais.
   Toda regra de data é decidida no SERVIDOR (Supabase). Este arquivo só exibe e envia o clique. */
(function () {
  'use strict';
  var CFG = window.DESAFIO_CONFIG || {};
  var DAYS = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
  var NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- acesso ao servidor (só funções públicas) ---------- */
  function rpc(fn, args) {
    return fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'apikey': CFG.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ---------- relógio do servidor (ignora o relógio do celular) ---------- */
  var clock = null; // {base, perf, end, today}
  function syncClock() {
    return rpc('server_time').then(function (t) {
      clock = { base: t.now_ms, perf: performance.now(), end: t.end_ms, today: t.today };
      return clock;
    });
  }
  function nowMs() { return clock.base + (performance.now() - clock.perf); }

  /* ---------- estado ---------- */
  var children = [], current = null, earned = [], busy = false;

  function fmtDate(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function status(day) { return day < clock.today ? 'past' : day === clock.today ? 'today' : 'future'; }
  function pct(n) { return String(n).replace('.', ',') + '%'; }

  /* ---------- lista de crianças ---------- */
  function loadChildren() {
    return rpc('list_children').then(function (list) {
      children = list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); });
      var sel = $('sel');
      sel.innerHTML = '';
      var o = document.createElement('option'); o.value = ''; o.textContent = 'Toque aqui para escolher…'; sel.appendChild(o);
      children.forEach(function (c) { var op = document.createElement('option'); op.value = c.id; op.textContent = c.name; sel.appendChild(op); });
      sel.disabled = false;
      $('loadmsg').innerHTML = '';
      try { var last = localStorage.getItem('dpm_child'); if (last && children.some(function (c) { return String(c.id) === last; })) { sel.value = last; selectChild(Number(last)); } } catch (e) {}
    });
  }

  function showError(msg) { var d = $('loadmsg'); d.innerHTML = ''; var b = document.createElement('div'); b.className = 'msg-box msg-err'; b.textContent = msg; d.appendChild(b); }

  /* ---------- criança selecionada ---------- */
  function selectChild(id) {
    current = id; earned = [];
    if (!id) { $('child').hidden = true; return; }
    try { localStorage.setItem('dpm_child', String(id)); } catch (e) {}
    var c = children.filter(function (x) { return x.id === id; })[0];
    $('who').textContent = c ? c.name : '';
    $('child').hidden = false;
    return refreshChild();
  }

  function refreshChild() {
    return Promise.all([syncClock(), rpc('child_stars', { p_child: current })]).then(function (r) {
      if (!r[1].ok) throw new Error('child');
      earned = r[1].days; renderDays(); $('loadmsg').innerHTML = '';
    }).catch(function () { showError('Não foi possível carregar agora. Verifique a internet e tente de novo.'); });
  }

  var STAR = function (cls) { return '<svg class="' + cls + '" viewBox="0 0 100 100" aria-hidden="true"><use href="#star"/></svg>'; };

  function renderDays(popDay) {
    var box = $('days'); box.innerHTML = '';
    DAYS.forEach(function (d, i) {
      var st = status(d), got = earned.indexOf(d) >= 0;
      var el = document.createElement('div');
      el.className = 'day ' + st + (got ? ' earned' : '');
      var label = got ? 'Conquistada!' : st === 'today' ? 'Hoje' : st === 'future' ? 'Em breve' : 'Não registrada';
      el.setAttribute('aria-label', NAMES[i] + ' ' + fmtDate(d) + ': ' + label);
      el.innerHTML = '<div class="dn">' + NAMES[i].slice(0, 3) + '</div><div class="dd">' + fmtDate(d) + '</div>' +
        STAR(got ? 'star-fill' : 'star-empty') + '<div class="st">' + (got ? '⭐ Sim!' : st === 'today' ? 'Hoje' : st === 'future' ? 'Em breve' : '—') + '</div>';
      if (popDay === d) el.querySelector('svg').classList.add('pop');
      box.appendChild(el);
    });
    $('total').textContent = earned.length === 0 ? 'Ainda sem estrelas. Bora começar!' : earned.length === 1 ? '1 estrela conquistada de 5' : earned.length + ' estrelas conquistadas de 5';
    renderToday();
  }

  /* ---------- botão + contagem regressiva ---------- */
  var timer = null;
  function renderToday() {
    var a = $('today-area'); a.innerHTML = ''; clearInterval(timer);
    var t = clock.today;
    if (t < DAYS[0]) { a.innerHTML = '<div class="msg-box msg-info">O desafio começa na segunda-feira, 23/11. Volte lá e conquiste sua primeira estrela! 🎵</div>'; return; }
    if (t > DAYS[4]) {
      a.innerHTML = '<div class="msg-box msg-info">O desafio terminou. Obrigado por participar! Nos vemos no ensaio geral, sábado, 28/11, às 15h. 🎶</div>'; return;
    }
    if (earned.indexOf(t) >= 0) {
      a.innerHTML = '<div class="msg-box msg-ok">⭐ A estrela de hoje já foi conquistada. Parabéns!</div>'; startCount(a); return;
    }
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'btn-star';
    b.innerHTML = '⭐ Conquistar estrela'; b.addEventListener('click', askConfirm); a.appendChild(b);
    var h = document.createElement('p'); h.className = 'legend'; h.style.textAlign = 'center';
    h.textContent = 'Toque somente depois dos 15 minutos de treino.'; a.appendChild(h);
    startCount(a);
  }
  function startCount(a) {
    var c = document.createElement('div'); c.className = 'count'; c.innerHTML = 'A estrela de hoje encerra em <b id="cd">--:--:--</b>'; a.appendChild(c);
    function tick() {
      var left = Math.max(0, Math.floor((clock.end - nowMs()) / 1000));
      var h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
      var el = $('cd'); if (el) el.textContent = [h, m, s].map(function (x) { return String(x).padStart(2, '0'); }).join(':');
      if (left <= 0) { clearInterval(timer); setTimeout(function () { if (current) refreshChild(); loadProgress(); }, 1500); }
    }
    tick(); timer = setInterval(tick, 1000);
  }

  /* ---------- registrar ---------- */
  function askConfirm() {
    var c = children.filter(function (x) { return x.id === current; })[0];
    $('dc-p').textContent = 'Registrar a estrela de hoje para ' + (c ? c.name : '') + '? Depois de registrada, ela não pode ser desfeita.';
    $('dlg-confirm').showModal();
  }
  function register() {
    if (busy) return; busy = true; $('dlg-confirm').close();
    var btn = $('btn-star'); if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
    rpc('register_star', { p_child: current, p_hp: $('hp').value }).then(function (r) {
      busy = false;
      if (r.ok) { celebrate(r.day); return; }
      var m = {
        already: 'A estrela de hoje já estava registrada.',
        not_started: 'O desafio ainda não começou.',
        finished: 'O desafio já terminou.',
        rate_limited: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
        invalid_child: 'Criança não encontrada. Escolha o nome novamente.'
      }[r.error] || 'Não foi possível registrar.';
      showError(m); refreshChild();
    }).catch(function () {
      busy = false; showError('Sem conexão. A estrela NÃO foi salva. Verifique a internet e toque de novo.'); refreshChild();
    });
  }
  function celebrate(day) {
    if (earned.indexOf(day) < 0) earned.push(day);
    var i = DAYS.indexOf(day), c = children.filter(function (x) { return x.id === current; })[0];
    renderDays(day);
    $('dw-p').textContent = (c ? c.name.split(' ')[0] : 'Você') + ' conquistou a estrela de ' + NAMES[i].toLowerCase() + '! ' + (earned.length === 5 ? 'As 5 estrelas! Que campeão(ã)! 🏆' : 'Continue assim! 🎶');
    $('dlg-win').showModal(); confetti(); loadProgress();
  }

  /* ---------- confete ---------- */
  function confetti() {
    var cv = $('confetti'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    var cols = ['#f6b81f', '#ffd75a', '#4aa3e8', '#8fd0ff', '#ffffff'], ps = [], i;
    for (i = 0; i < 110; i++) ps.push({ x: cv.width / 2, y: cv.height * .4, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 3, r: 5 + Math.random() * 7, c: cols[i % 5], a: Math.random() * 6, s: Math.random() > .5 });
    var f = 0;
    (function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(function (p) {
        p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += .15; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        if (p.s) { ctx.beginPath(); for (var k = 0; k < 5; k++) { ctx.lineTo(Math.cos((k * 72 - 90) * Math.PI / 180) * p.r, Math.sin((k * 72 - 90) * Math.PI / 180) * p.r); ctx.lineTo(Math.cos((k * 72 - 54) * Math.PI / 180) * p.r * .45, Math.sin((k * 72 - 54) * Math.PI / 180) * p.r * .45); } ctx.fill(); }
        else ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6);
        ctx.restore();
      });
      if (++f < 150) requestAnimationFrame(loop); else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* ---------- progresso coletivo ---------- */
  function loadProgress() {
    return rpc('public_progress').then(function (p) {
      var box = $('chart'); box.innerHTML = '';
      p.days.forEach(function (d, i) {
        var row = document.createElement('div'); row.className = 'bar-row ' + d.status;
        var txt = d.status === 'future' ? 'em breve' : d.count + ' de ' + p.total + ' = ' + pct(d.pct);
        row.innerHTML = '<div class="nm">' + NAMES[i] + '<small>' + fmtDate(d.day) + '</small></div><div class="track" role="img" aria-label="' + NAMES[i] + ': ' + txt + '"><div class="fill" style="width:0"></div><div class="val"></div></div>';
        row.querySelector('.val').textContent = txt;
        box.appendChild(row);
        var w = d.status === 'future' ? 0 : d.pct;
        setTimeout(function () { row.querySelector('.fill').style.width = w + '%'; }, 60);
      });
      $('legend').textContent = 'Porcentagem de crianças que conquistaram a estrela em cada dia. Atualiza sozinho.';
    }).catch(function () { $('chart').innerHTML = '<div class="msg-box msg-err">Não foi possível carregar o progresso agora.</div>'; });
  }

  /* ---------- início ---------- */
  function boot() {
    if (!CFG.SUPABASE_URL || /COLE_AQUI/.test(CFG.SUPABASE_URL)) { showError('Configuração do banco de dados pendente (config.js).'); return; }
    $('sel').addEventListener('change', function () { $('loadmsg').innerHTML = ''; selectChild(Number(this.value) || null); });
    $('dc-yes').addEventListener('click', register);
    $('dc-no').addEventListener('click', function () { $('dlg-confirm').close(); });
    $('dw-ok').addEventListener('click', function () { $('dlg-win').close(); });
    syncClock().then(loadChildren).then(loadProgress).catch(function () { $('sel').innerHTML = '<option>Sem conexão</option>'; showError('Não foi possível carregar. Verifique a internet e recarregue a página.'); });
    setInterval(loadProgress, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { loadProgress(); if (current) refreshChild(); else syncClock(); } });
  }
  boot();
})();
