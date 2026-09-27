// app.js：渲染结果
import { slotOf, isSettled } from "./slot.js";
import { step, close } from "./settlerun.js";

export function render(spec) {
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
  let top = -1;
  let topCount = 0;
  Object.keys(counts).forEach(function (key) {
    if (counts[key] > topCount) { topCount = counts[key]; top = Number(key); }
  });
  const fingerprint = function (state) {
    return JSON.stringify({ counts: state.counts, settled: state.settled, applied: state.applied.length });
  };
  return { counts: Object.keys(counts).map(function (key) { return [Number(key), counts[key]]; }),
           settled: closed.state.settled, settled_count: first.settled_count,
           pending_before: first.pending_before, pending_ids: first.pending_ids,
           catchup: closed.catchup, top: top, top_count: topCount,
           budget_pair_differs: first.settled_count !== wide.settled_count,
           two_round_mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           two_round_closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.settled_count, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count: events.length, tail: slotOf(7, 3) };
}
