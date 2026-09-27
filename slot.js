// slot.js：窗口落点与是否已结算
export function slotOf(at, size) {
  return Math.floor(at / size);
}

export function isSettled(state, slot) {
  const settled = (state && state.settled) || [];
  if (Array.isArray(settled)) return settled.indexOf(slot) !== -1;
  return Boolean(settled[slot]);
}
