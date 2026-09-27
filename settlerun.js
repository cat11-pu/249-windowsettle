// settlerun.js：按预算结算并留账（基线：一律给空表）
import { slotOf, isSettled } from "./slot.js";

export function step(spec) {
  return { state: spec.state, settled: [], settled_count: 0, pending_before: 0, catchup: 0,
           pending_ids: [], judged: 0, judged_bound: 0 };
}

export function close(spec) {
  return { state: spec.state, catchup: 0 };
}
