/* app.js — 画面制御・プレビュー生成・履歴(localStorage)・PDF出力 */
(function () {
  'use strict';
  var E = window.Engine;
  var STORE_KEY = 'seikyu-ryosyo:v1';
  var ISSUER_KEY = 'seikyu-ryosyo:issuer'; // 発行者情報は使い回すので別保存

  // ---------------- 状態 ----------------
  function blankItem() { return { name: '', qty: 1, unit: '', unitPrice: 0, taxRate: 10 }; }

  function newDoc() {
    var today = new Date().toISOString().slice(0, 10);
    return {
      id: 'D' + Date.now(),
      createdAt: Date.now(),
      seikyuNo: '', nohinNo: '', ryoshuNo: '',
      issueDate: today, dueDate: '', deliveryDate: today, receiptDate: today,
      tadashigaki: '', payMethod: '銀行振込',
      issuer: { name: '', zip: '', address: '', tel: '', email: '', regNo: '', bank: '' },
      client: { name: '', honorific: '御中' },
      items: [blankItem()],
      taxRounding: 'floor',
      note: ''
    };
  }

  var state = newDoc();
  var viewMode = 'seikyu'; // seikyu | ryoshu | both

  // ---------------- DOM 参照 ----------------
  var $ = function (id) { return document.getElementById(id); };

  // ---------------- ユーティリティ ----------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日';
  }

  // ---------------- フォーム → 状態 ----------------
  function bindField(id, apply) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function () { apply(el.value); render(); });
  }

  function readIssuerToForm() {
    var i = state.issuer;
    $('issuerName').value = i.name; $('issuerZip').value = i.zip;
    $('issuerAddress').value = i.address; $('issuerTel').value = i.tel;
    $('issuerEmail').value = i.email; $('issuerRegNo').value = i.regNo;
    $('issuerBank').value = i.bank;
  }
  function readDocToForm() {
    $('clientName').value = state.client.name;
    $('clientHonorific').value = state.client.honorific;
    $('seikyuNo').value = state.seikyuNo; $('nohinNo').value = state.nohinNo;
    $('ryoshuNo').value = state.ryoshuNo;
    $('issueDate').value = state.issueDate; $('dueDate').value = state.dueDate;
    $('deliveryDate').value = state.deliveryDate;
    $('receiptDate').value = state.receiptDate;
    $('tadashigaki').value = state.tadashigaki; $('payMethod').value = state.payMethod;
    $('taxRounding').value = state.taxRounding;
    $('note').value = state.note;
    renderItems();
  }

  function wireForm() {
    // 発行者
    bindField('issuerName', function (v) { state.issuer.name = v; saveIssuer(); });
    bindField('issuerZip', function (v) { state.issuer.zip = v; saveIssuer(); });
    bindField('issuerAddress', function (v) { state.issuer.address = v; saveIssuer(); });
    bindField('issuerTel', function (v) { state.issuer.tel = v; saveIssuer(); });
    bindField('issuerEmail', function (v) { state.issuer.email = v; saveIssuer(); });
    bindField('issuerRegNo', function (v) { state.issuer.regNo = v; saveIssuer(); });
    bindField('issuerBank', function (v) { state.issuer.bank = v; saveIssuer(); });
    // 宛先・取引
    bindField('clientName', function (v) { state.client.name = v; });
    bindField('clientHonorific', function (v) { state.client.honorific = v; });
    bindField('seikyuNo', function (v) { state.seikyuNo = v; });
    bindField('nohinNo', function (v) { state.nohinNo = v; });
    bindField('ryoshuNo', function (v) { state.ryoshuNo = v; });
    bindField('issueDate', function (v) { state.issueDate = v; });
    bindField('dueDate', function (v) { state.dueDate = v; });
    bindField('deliveryDate', function (v) { state.deliveryDate = v; });
    bindField('receiptDate', function (v) { state.receiptDate = v; });
    bindField('tadashigaki', function (v) { state.tadashigaki = v; });
    bindField('payMethod', function (v) { state.payMethod = v; });
    bindField('taxRounding', function (v) { state.taxRounding = v; });
    bindField('note', function (v) { state.note = v; });

    $('clientHonorific').addEventListener('change', function () { state.client.honorific = this.value; render(); });
    $('payMethod').addEventListener('change', function () { state.payMethod = this.value; render(); });
    $('taxRounding').addEventListener('change', function () { state.taxRounding = this.value; render(); });

    $('btnAddItem').addEventListener('click', function () {
      state.items.push(blankItem()); renderItems(); render();
    });
  }

  // ---------------- 明細行 ----------------
  function renderItems() {
    var wrap = $('itemsWrap');
    wrap.innerHTML =
      '<div class="item-head"><span>品目</span><span>数量</span><span>単価</span><span>税率</span><span></span></div>';
    state.items.forEach(function (it, idx) {
      var row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML =
        '<input data-k="name" placeholder="品目名" value="' + esc(it.name) + '" />' +
        '<input data-k="qty" type="number" inputmode="decimal" value="' + esc(it.qty) + '" />' +
        '<input data-k="unitPrice" type="number" inputmode="numeric" value="' + esc(it.unitPrice) + '" />' +
        '<select data-k="taxRate">' +
          '<option value="10"' + (Number(it.taxRate) === 10 ? ' selected' : '') + '>10%</option>' +
          '<option value="8"' + (Number(it.taxRate) === 8 ? ' selected' : '') + '>8%</option>' +
          '<option value="0"' + (Number(it.taxRate) === 0 ? ' selected' : '') + '>非課税</option>' +
        '</select>' +
        '<button class="del" title="削除" type="button">×</button>';

      row.querySelectorAll('[data-k]').forEach(function (input) {
        var k = input.getAttribute('data-k');
        input.addEventListener('input', function () {
          var v = input.value;
          if (k === 'qty' || k === 'unitPrice' || k === 'taxRate') v = Number(v);
          state.items[idx][k] = v;
          render();
        });
      });
      row.querySelector('.del').addEventListener('click', function () {
        state.items.splice(idx, 1);
        if (state.items.length === 0) state.items.push(blankItem());
        renderItems(); render();
      });
      wrap.appendChild(row);
    });
  }

  // ---------------- 帳票HTML生成 ----------------
  function issuerBlock() {
    var i = state.issuer;
    var lines = [];
    if (i.name) lines.push('<span class="issuer-name">' + esc(i.name) + '</span>');
    if (i.zip) lines.push('〒' + esc(i.zip));
    if (i.address) lines.push(esc(i.address));
    if (i.tel) lines.push('TEL: ' + esc(i.tel));
    if (i.email) lines.push(esc(i.email));
    if (i.regNo) lines.push('登録番号: ' + esc(i.regNo));
    return '<div class="doc-issuer">' + lines.join('<br>') + '</div>';
  }

  function itemsTable(showAmount) {
    var rows = '';
    var any = false;
    state.items.forEach(function (it) {
      if (!it.name && !Number(it.unitPrice)) return;
      any = true;
      var amt = E.lineAmount(it);
      var mark = Number(it.taxRate) === 8 ? ' <span class="mark8">※</span>' : '';
      rows +=
        '<tr><td>' + esc(it.name) + mark + '</td>' +
        '<td class="num">' + (Number(it.qty) || 0) + '</td>' +
        '<td class="num">' + E.yen(it.unitPrice) + '</td>' +
        '<td class="num">' + E.yen(amt) + '</td></tr>';
    });
    if (!any) rows = '<tr class="blank"><td colspan="4"></td></tr>';
    // 空行で見栄えを整える
    var blanks = Math.max(0, 3 - state.items.filter(function (it) { return it.name || Number(it.unitPrice); }).length);
    for (var b = 0; b < blanks; b++) rows += '<tr class="blank"><td></td><td></td><td></td><td></td></tr>';

    return '<table class="items"><thead><tr>' +
      '<th>品目</th><th class="num">数量</th><th class="num">単価</th><th class="num">金額</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function sumBlock(totals) {
    var rows = '<tr><td class="label">小計</td><td class="val">' + E.yen(totals.subtotal) + '</td></tr>';
    totals.taxGroups.forEach(function (g) {
      if (g.rate === 0) return;
      rows += '<tr><td class="label">消費税(' + g.rate + '%)</td><td class="val">' + E.yen(g.tax) + '</td></tr>';
    });
    rows += '<tr class="grand"><td class="label">合計</td><td class="val">' + E.yen(totals.total) + '</td></tr>';
    return '<div class="doc-sum"><table>' + rows + '</table></div>';
  }

  function taxDetail(totals) {
    var has8 = totals.taxGroups.some(function (g) { return g.rate === 8; });
    if (!has8) return '';
    var parts = totals.taxGroups.map(function (g) {
      return g.rate + '%対象 ' + E.yen(g.base) + '（税 ' + E.yen(g.tax) + '）';
    });
    return '<div class="doc-tax-detail">※は軽減税率(8%)対象<br>' + parts.join('　/　') + '</div>';
  }

  function clientName() {
    var c = state.client;
    if (!c.name) return '<span style="color:#bbb">宛名未入力</span>';
    return esc(c.name) + (c.honorific ? '　' + esc(c.honorific) : '');
  }

  function renderSeikyu(totals) {
    var i = state.issuer;
    var meta = [];
    if (state.seikyuNo) meta.push('請求書番号: ' + esc(state.seikyuNo));
    meta.push('発行日: ' + fmtDate(state.issueDate));
    if (state.dueDate) meta.push('お支払期限: ' + fmtDate(state.dueDate));

    var bank = i.bank
      ? '<div class="doc-bank"><div class="bank-title">お振込先</div><div class="box">' + esc(i.bank) + '</div></div>'
      : '<div class="doc-bank"></div>';

    return '<div class="doc">' +
      '<div class="doc-title serif">請求書</div><div class="doc-title-rule"></div>' +
      '<div class="doc-top">' +
        '<div class="doc-client"><div class="to-name">' + clientName() + '</div></div>' +
        '<div class="doc-meta">' + meta.join('<br>') + '</div>' +
      '</div>' +
      issuerBlock() +
      '<div class="doc-amount-box"><span class="lbl">ご請求金額</span>' +
        '<span class="val">' + E.yen(totals.total) + '<span class="tax-in">（税込）</span></span></div>' +
      '<div class="doc-lead">下記の通りご請求申し上げます。</div>' +
      itemsTable(true) +
      sumBlock(totals) + taxDetail(totals) +
      '<div class="doc-foot">' + bank + '</div>' +
      (state.note ? '<div class="doc-note">備考：' + esc(state.note) + '</div>' : '') +
      '</div>';
  }

  function renderRyoshu(totals) {
    var meta = [];
    if (state.ryoshuNo) meta.push('No. ' + esc(state.ryoshuNo));
    meta.push('発行日: ' + fmtDate(state.receiptDate || state.issueDate));
    var tadashi = state.tadashigaki || 'お品代';
    var stamp = E.stampDuty(totals.total);

    return '<div class="doc">' +
      '<div class="doc-title serif">領収書</div><div class="doc-title-rule"></div>' +
      '<div class="doc-top">' +
        '<div class="doc-client"><div class="to-name">' + clientName() + '</div></div>' +
        '<div class="doc-meta">' + meta.join('<br>') + '</div>' +
      '</div>' +
      '<div class="doc-amount-box"><span class="lbl">金額</span>' +
        '<span class="val">' + E.yen(totals.total) + '<span class="tax-in">（税込）</span></span></div>' +
      '<div class="doc-lead">但し　' + esc(tadashi) + 'として<br>上記正に領収いたしました。</div>' +
      '<div class="doc-received">お支払方法：' + esc(state.payMethod) + '</div>' +
      itemsTable(true) +
      sumBlock(totals) + taxDetail(totals) +
      (state.issuer.regNo ? '<div class="doc-invoice-no">登録番号: ' + esc(state.issuer.regNo) + '</div>' : '') +
      '<div class="doc-foot">' +
        '<div class="doc-bank" style="display:flex;align-items:flex-end;gap:14px">' + issuerBlock() + '</div>' +
        '<div class="doc-stamp">' + (stamp > 0 ? '収入印紙<br>(' + E.yen(stamp) + ')' : '印') + '</div>' +
      '</div>' +
      (stamp > 0 ? '<div class="doc-tax-detail">※紙で発行する場合、収入印紙 ' + E.yen(stamp) + ' が必要（電子交付は不要）</div>' : '') +
      '</div>';
  }

  function renderNohin(totals) {
    var meta = [];
    if (state.nohinNo) meta.push('納品書番号: ' + esc(state.nohinNo));
    meta.push('納品日: ' + fmtDate(state.deliveryDate || state.issueDate));

    return '<div class="doc">' +
      '<div class="doc-title serif">納品書</div><div class="doc-title-rule"></div>' +
      '<div class="doc-top">' +
        '<div class="doc-client"><div class="to-name">' + clientName() + '</div></div>' +
        '<div class="doc-meta">' + meta.join('<br>') + '</div>' +
      '</div>' +
      issuerBlock() +
      '<div class="doc-amount-box"><span class="lbl">合計金額</span>' +
        '<span class="val">' + E.yen(totals.total) + '<span class="tax-in">（税込）</span></span></div>' +
      '<div class="doc-lead">下記の通り納品いたしました。</div>' +
      itemsTable(true) +
      sumBlock(totals) + taxDetail(totals) +
      (state.note ? '<div class="doc-note">備考：' + esc(state.note) + '</div>' : '') +
      '</div>';
  }

  function buildDocs() {
    var totals = E.calcTotals(state.items, state.taxRounding);
    var html = '';
    if (viewMode === 'nohin' || viewMode === 'all') html += renderNohin(totals);
    if (viewMode === 'seikyu' || viewMode === 'all') html += renderSeikyu(totals);
    if (viewMode === 'ryoshu' || viewMode === 'all') html += renderRyoshu(totals);
    return html;
  }

  // ---------------- レンダー ----------------
  function render() {
    $('previewScroll').innerHTML = buildDocs();
  }

  // ---------------- 保存/履歴 (localStorage) ----------------
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeStore(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }
  function saveIssuer() {
    localStorage.setItem(ISSUER_KEY, JSON.stringify(state.issuer));
  }
  function loadIssuer() {
    try {
      var i = JSON.parse(localStorage.getItem(ISSUER_KEY));
      if (i) state.issuer = Object.assign(state.issuer, i);
    } catch (e) {}
  }

  function saveDoc() {
    var totals = E.calcTotals(state.items, state.taxRounding);
    state.createdAt = Date.now();
    var snapshot = JSON.parse(JSON.stringify(state));
    snapshot._total = totals.total;
    var list = loadStore();
    var idx = list.findIndex(function (d) { return d.id === snapshot.id; });
    if (idx >= 0) list[idx] = snapshot; else list.unshift(snapshot);
    writeStore(list);
    flash('保存しました');
  }

  function flash(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;z-index:99;opacity:.95';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1600);
  }

  function renderHistory() {
    var list = loadStore();
    var box = $('historyList');
    if (list.length === 0) {
      box.innerHTML = '<div class="history-empty">保存された書類はまだありません</div>';
      return;
    }
    box.innerHTML = '';
    list.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'history-item';
      var date = new Date(d.createdAt);
      var dstr = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
      el.innerHTML =
        '<div class="hi-top"><span>' + esc(d.client.name || '（宛名なし）') + '</span>' +
        '<span>' + E.yen(d._total || 0) + '</span></div>' +
        '<div class="hi-sub">' + dstr + '　' + esc(d.seikyuNo || d.ryoshuNo || '') + '</div>' +
        '<div class="hi-actions">' +
          '<button class="ghost act-open" type="button">開く</button>' +
          '<button class="ghost act-dup" type="button">複製</button>' +
          '<button class="ghost act-del" type="button" style="color:#dc2626;border-color:#dc2626">削除</button>' +
        '</div>';
      el.querySelector('.act-open').addEventListener('click', function () { openDoc(d.id); });
      el.querySelector('.act-dup').addEventListener('click', function () { dupDoc(d.id); });
      el.querySelector('.act-del').addEventListener('click', function () { delDoc(d.id); });
      box.appendChild(el);
    });
  }

  function openDoc(id) {
    var d = loadStore().find(function (x) { return x.id === id; });
    if (!d) return;
    state = JSON.parse(JSON.stringify(d));
    delete state._total;
    readIssuerToForm(); readDocToForm(); render();
    closeHistory();
    flash('読み込みました');
  }
  function dupDoc(id) {
    var d = loadStore().find(function (x) { return x.id === id; });
    if (!d) return;
    state = JSON.parse(JSON.stringify(d));
    state.id = 'D' + Date.now();
    delete state._total;
    readIssuerToForm(); readDocToForm(); render();
    closeHistory();
    flash('複製しました（保存で確定）');
  }
  function delDoc(id) {
    if (!confirm('この書類を削除しますか？')) return;
    writeStore(loadStore().filter(function (x) { return x.id !== id; }));
    renderHistory();
  }

  // ---------------- 履歴ドロワー ----------------
  function openHistory() { renderHistory(); $('historyOverlay').classList.remove('hidden'); }
  function closeHistory() { $('historyOverlay').classList.add('hidden'); }

  // ---------------- PDF出力 ----------------
  // jsPDF + html2canvas で各書類をA4ページに描画してダウンロード。
  // ライブラリが無い/失敗した場合はブラウザ印刷にフォールバック。
  function fallbackPrint() {
    $('printArea').innerHTML = buildDocs();
    window.print();
  }

  function safeName(s) {
    return String(s || '').replace(/[\\\/:*?"<>|\s]+/g, '_').slice(0, 40) || '書類';
  }

  function downloadPDF() {
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor || !window.html2canvas) { fallbackPrint(); return; }

    var btn = $('btnPrint');
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = '生成中…';

    // A4幅(約794px)でオフスクリーン描画
    var holder = document.createElement('div');
    holder.className = 'pdf-render';
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
    holder.innerHTML = buildDocs();
    document.body.appendChild(holder);

    var docs = Array.prototype.slice.call(holder.querySelectorAll('.doc'));
    var pdf = new jsPDFCtor({ unit: 'pt', format: 'a4' });
    var pw = pdf.internal.pageSize.getWidth();
    var ph = pdf.internal.pageSize.getHeight();

    var idx = 0;
    function step() {
      if (idx >= docs.length) {
        pdf.save(safeName(state.client.name) + '_' + (state.issueDate || '') + '.pdf');
        if (holder.parentNode) holder.parentNode.removeChild(holder);
        btn.disabled = false; btn.textContent = label;
        flash('PDFを保存しました');
        return;
      }
      window.html2canvas(docs[idx], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
        .then(function (canvas) {
          var img = canvas.toDataURL('image/jpeg', 0.92);
          var imgW = pw;
          var imgH = canvas.height * pw / canvas.width;
          if (imgH > ph) { imgH = ph; imgW = canvas.width * ph / canvas.height; }
          if (idx > 0) pdf.addPage();
          pdf.addImage(img, 'JPEG', (pw - imgW) / 2, 0, imgW, imgH);
          idx++;
          step();
        })
        .catch(function (e) {
          console.error(e);
          if (holder.parentNode) holder.parentNode.removeChild(holder);
          btn.disabled = false; btn.textContent = label;
          flash('PDF生成に失敗。印刷画面から保存してください');
          fallbackPrint();
        });
    }
    step();
  }

  // ---------------- 初期化 ----------------
  function init() {
    loadIssuer();
    readIssuerToForm();
    readDocToForm();
    wireForm();
    render();

    document.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        viewMode = btn.getAttribute('data-doc');
        render();
      });
    });

    $('btnPrint').addEventListener('click', downloadPDF);
    $('btnSave').addEventListener('click', saveDoc);
    $('btnHistory').addEventListener('click', openHistory);
    $('btnCloseHistory').addEventListener('click', closeHistory);
    $('historyOverlay').addEventListener('click', function (e) {
      if (e.target === $('historyOverlay')) closeHistory();
    });
    $('btnNew').addEventListener('click', function () {
      if (!confirm('新規作成します。未保存の内容は失われます。')) return;
      var keepIssuer = state.issuer;
      state = newDoc();
      state.issuer = keepIssuer;
      readDocToForm(); render();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
