import fs from "node:fs";
import { slotOf, isSettled } from "./slot.js";
import { step, close } from "./settlerun.js";

// 验收断言：上面每条值收进 emit，最后与期望值逐项比对，不符就非零退出。
const __lines = [];
function emit(label, value) { __lines.push([String(label).replace(/ =$/, ""), value]); }


const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/windows.json", "utf8"));
const events = spec.events || [];
const half = Math.ceil(events.length / 2);
const first = step(spec);
const closed = close(Object.assign({}, spec, { state: first.state }));
const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
const replay = step(Object.assign({}, spec, { state: closed.state }));
const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
const full = step(Object.assign({}, spec, { budget: events.length + 2 }));
const fullClosed = close(Object.assign({}, spec, { state: full.state }));
const counts = closed.state.counts || {};
const keys = Object.keys(counts).map(Number).sort(function (a, b) { return a - b; });
let top = -1;
let topCount = 0;
keys.forEach(function (key) {
  if (counts[key] > topCount) { topCount = counts[key]; top = key; }
});
const fingerprint = function (state) {
  return JSON.stringify({ counts: state.counts, settled: state.settled, applied: state.applied.length });
};

emit("结算序列 =", JSON.stringify(closed.state.settled));
emit("首轮结算条数 =", first.settled_count);
emit("二档结算条数 =", wide.settled_count);
emit("收尾前压账条数 =", first.pending_before);
emit("收尾补齐条数 =", closed.catchup);
emit("计数最高的窗口 =", top);
emit("计数最高窗口的计数 =", topCount);
emit("两个预算档结算不同 =", first.settled_count !== wide.settled_count);
emit("拆两轮中间态不同 =", fingerprint(r2.state) !== fingerprint(first.state));
emit("拆两轮收尾态一致 =", fingerprint(closedTwo.state) === fingerprint(closed.state));
emit("重放新增结算 =", replay.settled_count);
emit("工作计数未超上界 =", first.judged <= first.judged_bound);
emit("与全量对照差异 =", fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1);


// ---- 异常路径探针：真调用实现，看它报出什么码（不是从样例里抄）----
let badSettleCode = "没有报错";
let tooLateCode = "没有报错";
let badEventCode = "没有报错";
try {
  step(Object.assign({}, { state: { counts: { 0: 1 }, settled: [], applied: [] },
    events: [{ id: 1, kind: "settle", slot: 9 }], budget: 1, window: 3 }));
} catch (error) {
  badSettleCode = error && error.code ? error.code : String(error.message);
}
emit("结算不存在窗口写错的错误码", badSettleCode);
try {
  step(Object.assign({}, { state: { counts: { 0: 1 }, settled: [0], applied: [] },
    events: [{ id: 1, kind: "mark", at: 1 }], budget: 1, window: 3 }));
} catch (error) {
  tooLateCode = error && error.code ? error.code : String(error.message);
}
emit("太迟写错的错误码", tooLateCode);
try {
  step(Object.assign({}, { state: { counts: {}, settled: [], applied: [] },
    events: [{ id: 1, kind: "peek", at: 0 }], budget: 1, window: 3 }));
} catch (error) {
  badEventCode = error && error.code ? error.code : String(error.message);
}
emit("事件写错的错误码", badEventCode);


// ---- 七条机检断言：脚本自己断言，每条真调实现；不符即失败退出 ----
const facts = [
  ["两档预算结算不同", first.settled_count !== wide.settled_count],
  ["收尾前有账收尾后归零", first.pending_before > 0 && closed.state.pending.length === 0],
  ["拆两轮中间态不同", fingerprint(r2.state) !== fingerprint(first.state)],
  ["拆两轮收尾态一致", fingerprint(closedTwo.state) === fingerprint(closed.state)],
  ["重放不再结算", replay.settled_count === 0],
  ["工作计数不超事件条数", first.judged <= events.length],
  ["与全量对照差异为零", fingerprint(closed.state) === fingerprint(fullClosed.state)],
  ["状态型异常探针真调", badSettleCode === "E_BAD_SETTLE"
    && tooLateCode === "E_TOO_LATE" && badEventCode === "E_BAD_EVENT"]
];
for (const [name, ok] of facts) {
  if (ok) { console.log("机检断言通过 " + name); }
  else { __bad += 1; console.log("机检断言失败 " + name); }
}


// ---- 期望值（参考模型算出，与题面给的验收数值一致）----
const EXPECTED = {
  "结算序列": [
    0,
    1,
    2
  ],
  "首轮结算条数": 1,
  "二档结算条数": 3,
  "收尾前压账条数": 2,
  "收尾补齐条数": 2,
  "计数最高的窗口": 0,
  "计数最高窗口的计数": 3,
  "两个预算档结算不同": true,
  "拆两轮中间态不同": true,
  "拆两轮收尾态一致": true,
  "重放新增结算": 0,
  "工作计数未超上界": true,
  "与全量对照差异": 0,
  "结算不存在窗口写错的错误码": "E_BAD_SETTLE",
  "太迟写错的错误码": "E_TOO_LATE",
  "事件写错的错误码": "E_BAD_EVENT"
};
// 有的值在收进来之前已经 stringify 过，比较前先试着解析回来，避免类型错配把正确实现判成不过。
function __same(got, want) {
  if (typeof got === "string") {
    try { const parsed = JSON.parse(got); if (JSON.stringify(parsed) === JSON.stringify(want)) return true; } catch (error) { /* 不是 JSON 就按原文比 */ }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  const got = found[1];
  if (__same(got, want)) { console.log("一致 " + label + " = " + JSON.stringify(got)); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(got)); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
