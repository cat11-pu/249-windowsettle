import assert from "node:assert";
import { slotOf, isSettled } from "../slot.js";
import { step, close } from "../settlerun.js";
import { render } from "../app.js";

const base = {
  state: { counts: {}, settled: [], applied: [] },
  events: [], budget: 1, window: 3,
  settle_error_code: "E_BAD_SETTLE", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("slotOf returns a number", () => {
  assert.strictEqual(typeof slotOf(7, 3), "number");
});

check("isSettled returns a flag", () => {
  assert.strictEqual(typeof isSettled(base.state, 0), "boolean");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
