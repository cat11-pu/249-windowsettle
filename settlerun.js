// settlerun.js：按窗口收货、按预算结算，预算用尽压账跨轮，收尾不限预算结清
import { slotOf, isSettled } from "./slot.js";

function error(spec, field, fallback) {
  const code = spec && spec[field] ? spec[field] : fallback;
  const err = new Error(code);
  err.code = code;
  return err;
}

function isInt(value) {
  return typeof value === "number" && Number.isFinite(value) && Math.floor(value) === value;
}

function freshState(state) {
  return {
    counts: Object.assign({}, state && state.counts),
    settled: (state && state.settled ? state.settled.slice() : []),
    applied: (state && state.applied ? state.applied.slice() : []),
    pending: (state && state.pending ? state.pending.slice() : [])
  };
}

// 按预算处理一批事件；返回新状态、本步新结算序列与跨轮压账信息
export function step(spec) {
  const state = freshState(spec.state);
  const events = spec.events || [];
  const width = spec.window;
  const budget = Math.max(0, Math.floor(spec.budget));
  const counts = state.counts;
  const settled = state.settled;
  const applied = state.applied;
  const pending = state.pending;
  const newlySettled = [];

  if (!isInt(width) || width <= 0) {
    throw error(spec, "event_error_code", "E_BAD_EVENT");
  }

  let remaining = budget;
  let judged = 0;

  function settleSlot(slot) {
    if (isSettled(state, slot)) return false;
    settled.push(slot);
    newlySettled.push(slot);
    return true;
  }

  // 上一轮压在账上的结算先结（仍受本轮预算约束）
  const carried = pending.slice();
  state.pending = [];
  for (const slot of carried) {
    if (remaining > 0 && settleSlot(slot)) {
      remaining -= 1;
    } else if (!isSettled(state, slot)) {
      state.pending.push(slot);
    }
  }

  for (const event of events) {
    if (!event || typeof event !== "object" || event.id === null || event.id === undefined) {
      throw error(spec, "event_error_code", "E_BAD_EVENT");
    }
    const id = event.id;
    if (applied.indexOf(id) !== -1) {
      judged += 1;
      continue;
    }
    if (event.kind === "mark") {
      if (!isInt(event.at) || event.at < 0) {
        throw error(spec, "event_error_code", "E_BAD_EVENT");
      }
      const slot = slotOf(event.at, width);
      if (isSettled(state, slot)) {
        throw error(spec, "late_error_code", "E_TOO_LATE");
      }
      counts[slot] = (counts[slot] || 0) + 1;
      applied.push(id);
      judged += 1;
    } else if (event.kind === "settle") {
      if (!isInt(event.slot) || event.slot < 0) {
        throw error(spec, "event_error_code", "E_BAD_EVENT");
      }
      const slot = event.slot;
      if (isSettled(state, slot)) {
        applied.push(id);
        judged += 1;
        continue;
      }
      if (!counts[slot]) {
        throw error(spec, "settle_error_code", "E_BAD_SETTLE");
      }
      if (remaining > 0) {
        settleSlot(slot);
        remaining -= 1;
      } else if (state.pending.indexOf(slot) === -1) {
        state.pending.push(slot);
      }
      applied.push(id);
      judged += 1;
    } else {
      throw error(spec, "event_error_code", "E_BAD_EVENT");
    }
  }

  return {
    state: state,
    settled: newlySettled,
    settled_count: newlySettled.length,
    pending_before: state.pending.length,
    pending_ids: state.pending.slice(),
    catchup: 0,
    judged: judged,
    judged_bound: events.length
  };
}

// 收尾：不限预算，把账上还没结算的窗口全部结完
export function close(spec) {
  const state = freshState(spec.state);
  const caughtUp = [];
  const pending = state.pending.slice();
  state.pending = [];
  for (const slot of pending) {
    if (!isSettled(state, slot)) {
      state.settled.push(slot);
      caughtUp.push(slot);
    }
  }
  return { state: state, catchup: caughtUp.length };
}
