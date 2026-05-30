/**
 * Script Purpose: Stitchy London — Site Nav (mobile disclosure toggle).
 *                 Wires the burger button to the .site-nav-links panel using
 *                 the ARIA disclosure pattern (button[aria-expanded][aria-controls]
 *                 → panel#id). Closes on ESC, on internal link click, and when
 *                 the viewport widens past the mobile breakpoint so the menu
 *                 doesn't get stuck open on rotate/resize.
 *
 *                 No focus trap — this is a disclosure, not a modal dialog.
 *                 The panel uses visibility:hidden in CSS, so hidden links
 *                 stay out of the tab order while the menu is closed.
 *
 *                 Body scroll lock: toggles body.is-nav-open while open
 *                 (CSS sets overflow:hidden on that class).
 *
 * Author: Erlen Masson
 * Version: 1.0.0
 * Created: 30 May 2026
 */

(function () {
  "use strict";

  var toggle = document.querySelector(".site-nav-toggle");
  var panel = document.getElementById("site-nav-links");
  if (!toggle || !panel) return;

  console.log("Script - Site Nav v1.0.0 (Stitchy)");

  var mqMobile = window.matchMedia("(max-width: 767px)");

  function isOpen() {
    return toggle.getAttribute("aria-expanded") === "true";
  }

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("is-nav-open", open);
  }

  function closeNav() {
    if (isOpen()) setOpen(false);
  }

  toggle.addEventListener("click", function () {
    setOpen(!isOpen());
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen()) {
      closeNav();
      toggle.focus();
    }
  });

  // Close after a link click so the user lands on the destination without the
  // overlay still covering the page (matters for in-page anchor links).
  panel.addEventListener("click", function (event) {
    if (event.target.closest("a")) closeNav();
  });

  // If the viewport widens past mobile while open, reset to closed so the
  // desktop layout doesn't inherit the open state.
  function handleBreakpointChange(event) {
    if (!event.matches) closeNav();
  }
  if (mqMobile.addEventListener) {
    mqMobile.addEventListener("change", handleBreakpointChange);
  } else if (mqMobile.addListener) {
    mqMobile.addListener(handleBreakpointChange);
  }
})();
