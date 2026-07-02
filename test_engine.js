/*
 * test_engine.js — engine.js のテスト
 * 実行: osascript -l JavaScript test_engine.js
 */
ObjC.import('Foundation');
function read(path) {
  var s = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
  return ObjC.unwrap(s);
}
// engine.js を読み込む（module.exports 経路を使う）
var module = { exports: {} };
eval(read('engine.js'));
var E = module.exports;

var pass = 0, fail = 0;
function eq(name, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; }
  else { fail++; console.log('✗ ' + name + '  got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)); }
}

// lineAmount
eq('lineAmount', E.lineAmount({ qty: 3, unitPrice: 1500 }), 4500);
eq('lineAmount 空', E.lineAmount({}), 0);

// 10%のみ・切り捨て
var t1 = E.calcTotals([{ qty: 1, unitPrice: 1980, taxRate: 10 }], 'floor');
eq('subtotal 10%', t1.subtotal, 1980);
eq('tax 10% floor', t1.taxTotal, 198);
eq('total 10%', t1.total, 2178);

// 端数: 1333 * 10% = 133.3 → floor 133 / round 133 / ceil 134
eq('floor', E.calcTotals([{ qty: 1, unitPrice: 1333, taxRate: 10 }], 'floor').taxTotal, 133);
eq('round', E.calcTotals([{ qty: 1, unitPrice: 1333, taxRate: 10 }], 'round').taxTotal, 133);
eq('ceil', E.calcTotals([{ qty: 1, unitPrice: 1333, taxRate: 10 }], 'ceil').taxTotal, 134);
// 1338 * 10% = 133.8 → round 134
eq('round up', E.calcTotals([{ qty: 1, unitPrice: 1338, taxRate: 10 }], 'round').taxTotal, 134);

// 複数税率（10%と8%の混在）→ グループ単位で課税
var mix = E.calcTotals([
  { qty: 1, unitPrice: 1000, taxRate: 10 },
  { qty: 2, unitPrice: 500, taxRate: 8 }  // 1000
], 'floor');
eq('mix subtotal', mix.subtotal, 2000);
eq('mix groups len', mix.taxGroups.length, 2);
eq('mix tax total', mix.taxTotal, 100 + 80); // 10%→100, 8%→80
eq('mix total', mix.total, 2180);
eq('mix order 10 first', mix.taxGroups[0].rate, 10);

// 非課税(0%)は税0
var zero = E.calcTotals([{ qty: 1, unitPrice: 5000, taxRate: 0 }], 'floor');
eq('zero tax', zero.taxTotal, 0);
eq('zero total', zero.total, 5000);

// 収入印紙
eq('stamp <5万', E.stampDuty(49999), 0);
eq('stamp 5万', E.stampDuty(50000), 200);
eq('stamp 100万', E.stampDuty(1000000), 200);
eq('stamp 100万超', E.stampDuty(1000001), 400);
eq('stamp 500万', E.stampDuty(5000000), 1000);

// yen 表示
eq('yen', E.yen(1234567), '¥1,234,567');
eq('yen 0', E.yen(0), '¥0');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) $.exit(1);
