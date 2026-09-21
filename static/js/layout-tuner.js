(() => {
  if (!new URLSearchParams(location.search).has("tune")) {
    return;
  }

  const TARGETS = [
    { id: "ascii-brain", label: "brain" },
    { id: "brain-caption", label: "caption" },
    {
      id: "stick-figure-frame",
      label: "character",
      baseTransform: "translate(62px, 8px) translate(42%, -72%)",
    },
  ];

  const offsets = new Map();
  const bases = new Map();
  const dragState = {
    el: null,
    target: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    originOffsetX: 0,
    originOffsetY: 0,
  };

  const style = document.createElement("style");
  style.textContent = `
    .layout-tune-target {
      outline: 1px dashed rgba(255, 255, 255, 0.9);
      outline-offset: 4px;
      touch-action: none;
      cursor: grab;
      z-index: 220;
    }

    .layout-tune-target.is-dragging {
      cursor: grabbing;
      outline-color: #fff;
    }

    #layout-tuner-panel {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 12px;
      z-index: 300;
      padding: 10px 12px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.5;
      color: #fff;
      background: rgba(0, 0, 0, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 8px;
      backdrop-filter: blur(6px);
    }

    #layout-tuner-panel h2 {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: bold;
      text-transform: lowercase;
    }

    #layout-tuner-panel p {
      margin: 0 0 8px;
      opacity: 0.85;
    }

    #layout-tuner-output {
      display: block;
      width: 100%;
      min-height: 72px;
      margin: 0 0 8px;
      padding: 8px;
      box-sizing: border-box;
      font: 9px/1.45 monospace;
      color: #fff;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      resize: vertical;
    }

    #layout-tuner-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    #layout-tuner-actions button {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 4px;
      padding: 6px 10px;
      font: 10px Arial, Helvetica, sans-serif;
      color: #135bd6;
      background: #fff;
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "layout-tuner-panel";
  panel.innerHTML = `
    <h2>layout tuner (temp)</h2>
    <p>drag the brain, caption, or character. copy the css when done.</p>
    <textarea id="layout-tuner-output" readonly></textarea>
    <div id="layout-tuner-actions">
      <button type="button" id="layout-tuner-copy">copy css</button>
      <button type="button" id="layout-tuner-reset">reset</button>
    </div>
  `;
  document.body.appendChild(panel);

  const output = panel.querySelector("#layout-tuner-output");

  function applyPosition(el, target) {
    const base = bases.get(target.id);
    const offset = offsets.get(target.id) || { x: 0, y: 0 };
    if (!base) {
      return;
    }

    el.style.left = `${base.left + offset.x}px`;
    el.style.top = `${base.top + offset.y}px`;
    el.style.transform = target.baseTransform || "none";
  }

  function pinElement(el, target) {
    const rect = el.getBoundingClientRect();
    bases.set(target.id, { left: rect.left, top: rect.top });
    offsets.set(target.id, { x: 0, y: 0 });

    el.style.position = "fixed";
    el.style.width = `${rect.width}px`;
    if (el.id === "ascii-brain") {
      el.style.height = `${rect.height}px`;
    }
    el.style.margin = "0";
    el.style.right = "auto";
    el.style.bottom = "auto";
    applyPosition(el, target);
  }

  function initTargets() {
    TARGETS.forEach((target) => {
      const el = document.getElementById(target.id);
      if (!el) {
        return;
      }

      pinElement(el, target);
      el.classList.add("layout-tune-target");
      el.addEventListener("pointerdown", (event) => startDrag(event, el, target));
    });
    renderOutput();
  }

  function startDrag(event, el, target) {
    if (event.button > 0) {
      return;
    }

    event.preventDefault();
    const offset = offsets.get(target.id) || { x: 0, y: 0 };
    dragState.el = el;
    dragState.target = target;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.originOffsetX = offset.x;
    dragState.originOffsetY = offset.y;
    el.classList.add("is-dragging");
    el.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!dragState.el || event.pointerId !== dragState.pointerId) {
      return;
    }

    const offset = {
      x: dragState.originOffsetX + event.clientX - dragState.startX,
      y: dragState.originOffsetY + event.clientY - dragState.startY,
    };
    offsets.set(dragState.target.id, offset);
    applyPosition(dragState.el, dragState.target);
  }

  function endDrag(event) {
    if (!dragState.el || event.pointerId !== dragState.pointerId) {
      return;
    }

    dragState.el.classList.remove("is-dragging");
    dragState.el.releasePointerCapture(event.pointerId);
    dragState.el = null;
    dragState.target = null;
    dragState.pointerId = null;
    renderOutput();
  }

  function renderOutput() {
    const lines = ["@media (max-width: 760px) {"];
    TARGETS.forEach((target) => {
      const offset = offsets.get(target.id) || { x: 0, y: 0 };
      if (offset.x === 0 && offset.y === 0) {
        return;
      }
      const transform = target.baseTransform
        ? `translate(${offset.x}px, ${offset.y}px) ${target.baseTransform}`
        : `translate(${offset.x}px, ${offset.y}px)`;
      lines.push(`  #${target.id} { transform: ${transform}; }`);
    });
    lines.push("}");
    output.value = lines.join("\n");
  }

  function resetTargets() {
    TARGETS.forEach((target) => {
      const el = document.getElementById(target.id);
      if (!el) {
        return;
      }
      el.style.cssText = "";
      el.classList.remove("layout-tune-target", "is-dragging");
      offsets.set(target.id, { x: 0, y: 0 });
      bases.delete(target.id);
    });
    output.value = "";
    requestAnimationFrame(initTargets);
  }

  panel.querySelector("#layout-tuner-copy").addEventListener("click", async () => {
    renderOutput();
    try {
      await navigator.clipboard.writeText(output.value);
    } catch {
      output.select();
      document.execCommand("copy");
    }
  });

  panel.querySelector("#layout-tuner-reset").addEventListener("click", resetTargets);
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", () => {
    TARGETS.forEach((target) => {
      const el = document.getElementById(target.id);
      if (!el) {
        return;
      }
      const offset = offsets.get(target.id) || { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      bases.set(target.id, {
        left: rect.left - offset.x,
        top: rect.top - offset.y,
      });
      applyPosition(el, target);
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(initTargets));
  } else {
    requestAnimationFrame(initTargets);
  }
})();
