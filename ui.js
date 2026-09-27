// ui.js：操作面板与视图（原生 DOM，无弹窗）
import { render } from "./app.js";

export function mount(spec, parts) {
  parts.log.textContent = "事件 " + (spec.events || []).length + " 条，窗口宽 " + (spec.window || 0)
    + "，本轮结算预算 " + (spec.budget || 0) + " 个窗口。";

  function draw() {
    let view = null;
    try {
      view = render(spec);
    } catch (error) {
      parts.out.textContent = String(error && error.code ? error.code : error);
      parts.log.textContent = "跑不动：" + String(error && error.message ? error.message : error);
      return;
    }
    parts.out.textContent = JSON.stringify(view, null, 1);
    parts.stage.textContent = "";
    (view.counts || []).forEach(function (pair) {
      const row = document.createElement("div");
      row.className = "row";
      const head = document.createElement("span");
      head.textContent = "窗口 " + pair[0];
      row.appendChild(head);
      const bar = document.createElement("span");
      bar.className = "bar";
      const fill = document.createElement("i");
      fill.style.width = Math.min(100, pair[1] * 25) + "%";
      bar.appendChild(fill);
      row.appendChild(bar);
      const mark = document.createElement("span");
      const done = (view.settled || []).indexOf(pair[0]) !== -1;
      mark.className = "chip" + (done ? " ok" : " warn");
      mark.textContent = done ? "已结算" : "还在收货";
      row.appendChild(mark);
      parts.stage.appendChild(row);
    });
    parts.legend.textContent = "结算 " + view.settled.length + " 个窗口，收尾前压账 " + view.pending_before
      + " 个，收尾补齐 " + view.catchup + " 个";
    parts.log.textContent = "两档结算不同 " + view.budget_pair_differs + "，工作计数 " + view.judged
      + " / 上界 " + view.judged_bound;
  }

  const budgetInput = document.createElement("input");
  budgetInput.type = "number";
  budgetInput.value = "3";
  parts.controls.appendChild(budgetInput);

  const runButton = document.createElement("button");
  runButton.className = "primary";
  runButton.textContent = "跑一遍";
  runButton.addEventListener("click", draw);
  parts.controls.appendChild(runButton);

  const budgetButton = document.createElement("button");
  budgetButton.textContent = "把结算预算换成输入框的值";
  budgetButton.addEventListener("click", function () {
    const next = Number(budgetInput.value);
    spec.budget = Number.isFinite(next) ? Math.max(1, Math.round(next)) : 1;
    draw();
  });
  parts.controls.appendChild(budgetButton);

  const closeButton = document.createElement("button");
  closeButton.textContent = "看收尾补齐后的账";
  closeButton.addEventListener("click", function () {
    render(spec);
    draw();
  });
  parts.controls.appendChild(closeButton);

  const dropButton = document.createElement("button");
  dropButton.textContent = "删最后一条事件";
  dropButton.addEventListener("click", function () {
    spec.events = (spec.events || []).slice(0, Math.max(0, (spec.events || []).length - 1));
    draw();
  });
  parts.controls.appendChild(dropButton);

  draw();
}
