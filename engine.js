/*
 * engine.js — 請求書・領収書アプリの計算ロジック（純粋関数）
 * 依存ゼロ。ブラウザ(window)とJXA(osascript)の両方から使えるように export する。
 */
(function (root) {
  'use strict';

  // 端数処理: 円未満を切り捨て/四捨五入/切り上げ
  function roundYen(value, mode) {
    if (mode === 'round') return Math.round(value);
    if (mode === 'ceil') return Math.ceil(value);
    return Math.floor(value); // 既定: 切り捨て
  }

  // 1明細の税抜金額
  function lineAmount(item) {
    var qty = Number(item.qty) || 0;
    var price = Number(item.unitPrice) || 0;
    return qty * price;
  }

  // 明細配列から合計・税率別内訳を算出
  // rounding: 'floor' | 'round' | 'ceil'（税額の端数処理／税率グループ単位）
  function calcTotals(items, rounding) {
    items = items || [];
    var mode = rounding || 'floor';
    var byRate = {}; // rate -> base(税抜合計)

    items.forEach(function (it) {
      var rate = Number(it.taxRate);
      if (isNaN(rate)) rate = 10;
      var amt = lineAmount(it);
      byRate[rate] = (byRate[rate] || 0) + amt;
    });

    var rates = Object.keys(byRate)
      .map(Number)
      .sort(function (a, b) { return b - a; }); // 10%,8%,0% の順

    var taxGroups = rates.map(function (rate) {
      var base = byRate[rate];
      var tax = roundYen(base * rate / 100, mode);
      return { rate: rate, base: base, tax: tax };
    });

    var subtotal = taxGroups.reduce(function (s, g) { return s + g.base; }, 0);
    var taxTotal = taxGroups.reduce(function (s, g) { return s + g.tax; }, 0);
    var total = subtotal + taxTotal;

    return {
      subtotal: subtotal,
      taxGroups: taxGroups,
      taxTotal: taxTotal,
      total: total
    };
  }

  // 収入印紙が必要か（領収書・現金/相殺の受取額に応じて）。
  // 電子交付(PDF)は課税文書に当たらないため印紙不要だが、紙で手渡す場合の目安を返す。
  // 5万円未満:0 / 100万円以下:200円 / …（主要区分のみ）
  function stampDuty(total) {
    var t = Number(total) || 0;
    if (t < 50000) return 0;
    if (t <= 1000000) return 200;
    if (t <= 2000000) return 400;
    if (t <= 3000000) return 600;
    if (t <= 5000000) return 1000;
    if (t <= 10000000) return 2000;
    return 4000; // 1000万円超〜2000万円以下（以降は省略）
  }

  // 金額を「¥1,234」形式に
  function yen(n) {
    var v = Math.round(Number(n) || 0);
    var sign = v < 0 ? '-' : '';
    return sign + '¥' + Math.abs(v).toLocaleString('ja-JP');
  }

  var api = {
    roundYen: roundYen,
    lineAmount: lineAmount,
    calcTotals: calcTotals,
    stampDuty: stampDuty,
    yen: yen
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;            // Node風
  } else {
    root.Engine = api;               // ブラウザ: window.Engine / JXA: globalThis.Engine
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
