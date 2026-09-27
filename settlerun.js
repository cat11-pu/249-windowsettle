// settlerun.js：按预算结算并留账
import { slotOf, isSettled } from "./slot.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cloneState(state) {
  const src = state || {};
  return {
    counts: Object.assign({}, src.counts || {}),
    settled: (src.settled || []).slice(),
    applied: (src.applied || []).slice(),
    pending: (src.pending || []).slice()
  };
}

export function step(spec) {
  const codeLate = spec.late_error_code || "E_TOO_LATE";
  const codeSettle = spec.settle_error_code || "E_BAD_SETTLE";
  const codeEvent = spec.event_error_code || "E_BAD_EVENT";
  const events = spec.events || [];
  const size = spec.window;
  let budget = Number.isFinite(spec.budget) ? spec.budget : 0;
  const state = cloneState(spec.state);
  const appliedSet = new Set(state.applied);
  const settledNow = [];
  const carry = [];

  for (const slot of state.pending) {
    if (state.settled.indexOf(slot) !== -1 || carry.indexOf(slot) !== -1) continue;
    if (budget > 0) {
      state.settled.push(slot);
      settledNow.push(slot);
      budget -= 1;
    } else {
      carry.push(slot);
    }
  }

  let judged = 0;
  for (const event of events) {
    if (!event || typeof event !== "object" || event.id === undefined || event.id === null) {
      throw fail(codeEvent, "event missing id");
    }
    if (event.kind === "mark") {
      if (typeof event.at !== "number" || !Number.isFinite(event.at)) {
        throw fail(codeEvent, "mark event needs a numeric at");
      }
    } else if (event.kind === "settle") {
      if (typeof event.slot !== "number" || !Number.isFinite(event.slot)) {
        throw fail(codeEvent, "settle event needs a numeric slot");
      }
    } else {
      throw fail(codeEvent, "unknown event kind");
    }
    if (appliedSet.has(event.id)) continue;
    judged += 1;
    if (event.kind === "mark") {
      const slot = slotOf(event.at, size);
      if (isSettled(state, slot)) throw fail(codeLate, "mark landed in a settled slot");
      state.counts[slot] = (state.counts[slot] || 0) + 1;
    } else {
      const slot = event.slot;
      if (isSettled(state, slot) || carry.indexOf(slot) !== -1) {
        // 已结算（或已在账上排队）的再结算直接跳过
      } else {
        if (!state.counts[slot]) throw fail(codeSettle, "settle a slot that never received marks");
        if (budget > 0) {
          state.settled.push(slot);
          settledNow.push(slot);
          budget -= 1;
        } else {
          carry.push(slot);
        }
      }
    }
    state.applied.push(event.id);
    appliedSet.add(event.id);
  }

  state.pending = carry;
  return { state: state, settled: settledNow, settled_count: settledNow.length,
           pending_before: carry.length, catchup: 0,
           pending_ids: carry.slice(), judged: judged, judged_bound: events.length };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  for (const slot of state.pending) {
    if (state.settled.indexOf(slot) !== -1) continue;
    state.settled.push(slot);
    catchup += 1;
  }
  state.pending = [];
  return { state: state, catchup: catchup };
}
