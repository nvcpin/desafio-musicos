/* Painel da professora. A senha NÃO existe aqui: o login é feito pelo Google (Supabase Auth)
   e o servidor só entrega os dados se o e-mail estiver na tabela "teachers". */
(function () {
  'use strict';
  var CFG = window.DESAFIO_CONFIG || {};
  var DAYS = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
  var NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  var $ = function (id) { return document.getElementById(id); };
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  var data = null, selDay = DAYS[0], poll = null;

  function show(id) { ['login', 'denied', 'app'].forEach(function (x) { $(x).hidden = (x !== id); }); }
  function fmt(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function pct(a, b) { return b ? Math.round(1000 * a / b) / 10 : 0; }
  function br(n) { return String(n).replace('.', ',') + '%'; }
  function msg(t, cls) { var m = $('msg'); m.innerHTML = ''; if (!t) return; var d = document.createElement('div'); d.className = 'msg-box ' + cls; d.textContent = t; m.appendChild(d); }
  var STAR = '<svg viewBox="0 0 100 100" style="fill:#f6b81f;stroke:#d9960a" aria-label="Sim"><use href="#star"/></svg>';

  function start() {
    sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { show('login'); return; }
      return sb.rpc('am_i_teacher').then(function (x) {
        if (x.data === true) { show('app'); load(); clearInterval(poll); poll = setInterval(load, 30000); }
        else { $('who-denied').textContent = s.user.email || ''; show('denied'); }
      });
    });
  }

  function load() {
    return sb.rpc('admin_overview').then(function (r) {
      if (r.error) { msg(r.error.code === '42501' ? 'Sessão sem permissão. Entre novamente.' : 'Não foi possível atualizar agora.', 'msg-err'); return; }
      msg(''); data = r.data; if (!load.once) { load.once = 1; if (DAYS.indexOf(data.today) >= 0) selDay = data.today; } render();
      $('upd').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
  }

  function avail() { var t = data.today; return DAYS.filter(function (d) { return d <= t; }).length; }

  function render() {
    var ch = data.children.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); });
    var n = ch.length, total = ch.reduce(function (s, c) { return s + c.days.length; }, 0), av = avail();
    var perDay = DAYS.map(function (d) { return ch.filter(function (c) { return c.days.indexOf(d) >= 0; }).length; });
    var today = data.today, ti = DAYS.indexOf(today);
    $('kpis').innerHTML =
      '<div class="kpi"><b>' + br(pct(total, n * 5)) + '</b><span>participação geral (do desafio)</span></div>' +
      '<div class="kpi"><b>' + (av ? br(pct(total, n * av)) : '—') + '</b><span>participação até hoje</span></div>' +
      '<div class="kpi"><b>' + total + ' / ' + n * 5 + '</b><span>estrelas conquistadas</span></div>' +
      '<div class="kpi"><b>' + (ti >= 0 ? perDay[ti] + ' de ' + n : '—') + '</b><span>estrelas de hoje</span></div>';

    var h = '<thead><tr><th>Criança</th>' + DAYS.map(function (d, i) { return '<th>' + NAMES[i].slice(0, 3) + '<br>' + fmt(d) + '</th>'; }).join('') + '<th>Total</th><th>% do desafio</th><th>% até hoje</th></tr></thead><tbody>';
    ch.forEach(function (c) {
      h += '<tr><td></td>' + DAYS.map(function (d) { return '<td>' + (c.days.indexOf(d) >= 0 ? STAR : '<span class="no">—</span>') + '</td>'; }).join('') +
        '<td><b>' + c.days.length + '/5</b></td><td>' + br(pct(c.days.length, 5)) + '</td><td>' + (av ? br(pct(c.days.length, av)) : '—') + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><th>Bandinha</th>' + perDay.map(function (x) { return '<th>' + x + '/' + n + '<br>' + br(pct(x, n)) + '</th>'; }).join('') + '<th>' + total + '</th><th>' + br(pct(total, n * 5)) + '</th><th>' + (av ? br(pct(total, n * av)) : '—') + '</th></tr></tfoot>';
    $('tbl').innerHTML = h;
    var rows = $('tbl').querySelectorAll('tbody tr'); ch.forEach(function (c, i) { rows[i].firstChild.textContent = c.name; });

    var bt = $('daybtns'); bt.innerHTML = '';
    DAYS.forEach(function (d, i) {
      var b = document.createElement('button'); b.className = 'tab'; b.setAttribute('aria-selected', d === selDay); b.textContent = NAMES[i] + ' ' + fmt(d);
      b.addEventListener('click', function () { selDay = d; render(); }); bt.appendChild(b);
    });
    var yes = ch.filter(function (c) { return c.days.indexOf(selDay) >= 0; }), no = ch.filter(function (c) { return c.days.indexOf(selDay) < 0; });
    var lab = (selDay > today) ? 'Ainda não disponível' : 'Sem estrela';
    $('daylists').innerHTML = '';
    [['⭐ Conquistaram (' + yes.length + ')', yes], [lab + ' (' + no.length + ')', no]].forEach(function (g) {
      var box = document.createElement('div'); box.className = 'card'; box.style.marginTop = '14px';
      var t = document.createElement('h2'); t.textContent = g[0]; box.appendChild(t);
      var ul = document.createElement('ul'); ul.className = 'names'; g[1].forEach(function (c) { var li = document.createElement('li'); li.textContent = c.name; ul.appendChild(li); });
      box.appendChild(ul); $('daylists').appendChild(box);
    });
  }

  function csv() {
    if (!data) return;
    var ch = data.children.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }), av = avail();
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var lines = [['Criança'].concat(DAYS.map(fmt), ['Total de estrelas', '% do desafio', '% até hoje']).map(q).join(';')];
    ch.forEach(function (c) {
      lines.push([c.name].concat(DAYS.map(function (d) { return c.days.indexOf(d) >= 0 ? 'Sim' : 'Não'; }), [c.days.length, br(pct(c.days.length, 5)), av ? br(pct(c.days.length, av)) : '']).map(q).join(';'));
    });
    var total = ch.reduce(function (s, c) { return s + c.days.length; }, 0);
    lines.push(['Bandinha'].concat(DAYS.map(function (d) { return ch.filter(function (c) { return c.days.indexOf(d) >= 0; }).length + '/' + ch.length; }), [total, br(pct(total, ch.length * 5)), av ? br(pct(total, ch.length * av)) : '']).map(q).join(';'));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'desafio-pequenos-musicos.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function out() { clearInterval(poll); data = null; sb.auth.signOut().then(function () { show('login'); }); }

  $('b-login').addEventListener('click', function () {
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }).then(function (r) {
      if (r.error) { var m = $('login-msg'); m.className = 'msg-box msg-err'; m.textContent = 'Não foi possível iniciar o login com Google.'; }
    });
  });
  $('b-out').addEventListener('click', out); $('b-out2').addEventListener('click', out);
  $('b-ref').addEventListener('click', load); $('b-csv').addEventListener('click', csv);
  $('t-geral').addEventListener('click', function () { $('t-geral').setAttribute('aria-selected', 'true'); $('t-dia').setAttribute('aria-selected', 'false'); $('v-geral').hidden = false; $('v-dia').hidden = true; });
  $('t-dia').addEventListener('click', function () { $('t-dia').setAttribute('aria-selected', 'true'); $('t-geral').setAttribute('aria-selected', 'false'); $('v-geral').hidden = true; $('v-dia').hidden = false; });
  start();
})();
