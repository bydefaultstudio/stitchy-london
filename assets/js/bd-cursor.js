/**
 * Script Purpose: Desktop tooltip-style cursor label
 * Author: Erlen Masson
 * Version: 4.0
 * Last Updated: April 29, 2026
 * Notes: Native cursor stays visible always. A small label hangs below it,
 *        showing text and/or icons declared via data-cursor-label,
 *        data-cursor-icon, data-cursor-icon-end on hovered elements.
 */

// Wrapped in an IIFE so Barba re-loads of this script don't collide on the
// top-level `const` declarations below. The window.__bdCursorInited guard
// inside initBdCursor() prevents the listeners from being attached twice.
(function () {
console.log("Script - Cursor v4.1");

// Path to the SVG icon sprite. On Webflow the sprite isn't served from /assets,
// so set `window.BD_CURSOR_SPRITE` to its uploaded/jsDelivr URL in head custom
// code before this script loads. Falls back to the repo-relative path locally.
const SPRITE_URL = window.BD_CURSOR_SPRITE || "/assets/images/svg-icons/_sprite.svg";

// Cross-origin <use href="…sprite.svg#id"> is blocked by browsers regardless of
// CORS headers, so we fetch the sprite once and inject it into the document.
// All <use> references then resolve via bare "#id" fragments (same-doc).
function injectSprite() {
  if (document.querySelector("[data-bd-cursor-sprite]")) return Promise.resolve();
  return fetch(SPRITE_URL)
    .then(function (res) { return res.ok ? res.text() : ""; })
    .then(function (svg) {
      if (!svg) return;
      const wrap = document.createElement("div");
      wrap.setAttribute("data-bd-cursor-sprite", "");
      wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      wrap.innerHTML = svg;
      document.body.insertAdjacentElement("afterbegin", wrap);
    })
    .catch(function (err) {
      console.warn("Custom Cursor: sprite fetch failed", err);
    });
}
// Must match the .cursor-label `transition: opacity` duration in bd-cursor.css.
// If you tune one, tune the other.
const FADE_MS = 150;

function initBdCursor() {
  // Idempotency guard — Barba transitions may re-load this script when navigating
  // from a non-website page to a website page, but the cursor itself lives outside
  // the swapped container and only needs to set up its listeners once.
  if (window.__bdCursorInited) return;
  window.__bdCursorInited = true;

  const label = document.querySelector(".cursor-label");
  const halo = document.querySelector(".cursor-halo");

  if (!label || !halo) {
    console.warn("Custom Cursor skipped — .cursor-label or .cursor-halo not found.");
    return;
  }

  // Reduced-motion users get the OS cursor — strip the custom DOM so it can't render.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    label.remove();
    halo.remove();
    return;
  }

  // Inject the sprite once so cross-origin <use> refs aren't needed.
  injectSprite();

  const text = label.querySelector(".cursor-label-text");
  const leadIcon = label.querySelector(".cursor-label-icon-lead");
  const endIcon = label.querySelector(".cursor-label-icon-end");
  const leadUse = leadIcon && leadIcon.querySelector("use");
  const endUse = endIcon && endIcon.querySelector("use");

  if (!text || !leadIcon || !endIcon || !leadUse || !endUse) {
    console.warn("Custom Cursor skipped — .cursor-label internal structure malformed.");
    return;
  }

  //
  //------- Animation Configuration -------//
  //
  // LERP only matters during the brief moments dots are visible (label hover or click).
  // 1.0 = locked to pointer; lower = softer follow.

  const LABEL_LERP = 0.75;
  const HALO_LERP = 0.2;
  const SNAP_THRESHOLD = 0.5;
  const LABEL_OFFSET_Y = 20;  // px below the cursor

  //
  //------- State -------//
  //

  let mouseX = 0;
  let mouseY = 0;
  let labelX = 0;
  let labelY = 0;
  let haloX = 0;
  let haloY = 0;
  let rafId = null;
  let lastTime = 0;
  let firstMove = true;

  // Transition state machine
  let activeTarget = null;
  let phase = "idle";          // 'idle' | 'visible' | 'fading-out'
  let fadeTimeoutId = null;

  //
  //------- Target detection + content swap -------//
  //

  function getCursorTargetAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return el.closest("[data-cursor-label], [data-cursor-icon], [data-cursor-icon-end]");
  }

  function applyContent(target) {
    const labelText = target.getAttribute("data-cursor-label") || "";
    const iconLead = target.getAttribute("data-cursor-icon") || "";
    const iconEnd = target.getAttribute("data-cursor-icon-end") || "";

    text.textContent = labelText;

    if (iconLead) {
      leadUse.setAttribute("href", `#${iconLead}`);
      leadIcon.classList.add("is-active");
    } else {
      leadIcon.classList.remove("is-active");
    }

    if (iconEnd) {
      endUse.setAttribute("href", `#${iconEnd}`);
      endIcon.classList.add("is-active");
    } else {
      endIcon.classList.remove("is-active");
    }

    label.classList.toggle("is-icon-only", Boolean(iconLead) && !labelText && !iconEnd);
  }

  function completeFadeOutThenIn() {
    fadeTimeoutId = null;
    if (activeTarget) {
      applyContent(activeTarget);
      label.classList.add("is-visible");
      phase = "visible";
    } else {
      phase = "idle";
    }
  }

  function transitionTo(newTarget) {
    if (newTarget === activeTarget) return;
    activeTarget = newTarget;

    if (phase === "fading-out") {
      // Mid fade-out — keep going, just update what'll show on completion.
      if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
      fadeTimeoutId = setTimeout(completeFadeOutThenIn, FADE_MS);
      return;
    }

    if (phase === "idle") {
      if (newTarget) {
        applyContent(newTarget);
        label.classList.add("is-visible");
        phase = "visible";
      }
      return;
    }

    // phase === 'visible' — start fade-out
    label.classList.remove("is-visible");
    phase = "fading-out";
    if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
    fadeTimeoutId = setTimeout(completeFadeOutThenIn, FADE_MS);
  }

  //
  //------- Animation Loop -------//
  //

  function animate(time) {
    if (!lastTime) lastTime = time;
    const dt = (time - lastTime) / (1000 / 60);
    lastTime = time;

    const labelFactor = 1 - Math.pow(1 - LABEL_LERP, dt);
    const haloFactor = 1 - Math.pow(1 - HALO_LERP, dt);

    labelX += (mouseX - labelX) * labelFactor;
    labelY += (mouseY - labelY) * labelFactor;
    haloX += (mouseX - haloX) * haloFactor;
    haloY += (mouseY - haloY) * haloFactor;

    const labelDist = Math.abs(mouseX - labelX) + Math.abs(mouseY - labelY);
    const haloDist = Math.abs(mouseX - haloX) + Math.abs(mouseY - haloY);

    if (labelDist < SNAP_THRESHOLD) { labelX = mouseX; labelY = mouseY; }
    if (haloDist < SNAP_THRESHOLD) { haloX = mouseX; haloY = mouseY; }

    // Label is centered horizontally on cursor and offset below it.
    label.style.transform = `translate3d(calc(${labelX}px - 50%), calc(${labelY}px + ${LABEL_OFFSET_Y}px), 0)`;
    halo.style.transform = `translate3d(calc(${haloX}px - 50%), calc(${haloY}px - 50%), 0)`;

    if (labelDist >= SNAP_THRESHOLD || haloDist >= SNAP_THRESHOLD) {
      rafId = requestAnimationFrame(animate);
    } else {
      rafId = null;
      lastTime = 0;
    }
  }

  function startAnimation() {
    if (!rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(animate);
    }
  }

  //
  //------- Event Listeners -------//
  //

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Snap on first move so we don't lerp from (0,0).
    if (firstMove) {
      labelX = mouseX;
      labelY = mouseY;
      haloX = mouseX;
      haloY = mouseY;
      label.style.transform = `translate3d(calc(${labelX}px - 50%), calc(${labelY}px + ${LABEL_OFFSET_Y}px), 0)`;
      halo.style.transform = `translate3d(calc(${haloX}px - 50%), calc(${haloY}px - 50%), 0)`;
      firstMove = false;
    }

    startAnimation();

    transitionTo(getCursorTargetAtPoint(mouseX, mouseY));
  });

  document.addEventListener("mousedown", () => {
    halo.classList.add("cursor-pressed");
  });

  document.addEventListener("mouseup", () => {
    halo.classList.remove("cursor-pressed");
  });

  // Scroll keeps target in sync when the mouse is still but elements move
  // beneath it. Browsers don't fire mousemove on scroll alone, so without
  // this the label sticks to the last-hovered element's content.
  window.addEventListener("scroll", () => {
    if (firstMove) return;
    transitionTo(getCursorTargetAtPoint(mouseX, mouseY));
  }, { passive: true });
}

// Run immediately if DOM is already ready (Barba transitions or late script load),
// otherwise wait for DOMContentLoaded.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBdCursor);
} else {
  initBdCursor();
}
})();
