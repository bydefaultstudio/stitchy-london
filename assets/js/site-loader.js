/**
 * Script Purpose: Stitchy London — Site Loader. Plays the line-draw Stitchy
 *                 Lottie over an animated gradient, then dismisses the overlay
 *                 once BOTH the Lottie finishes AND window.load fires.
 *                 A 4s safety cap prevents the loader hanging if the JSON or a
 *                 third-party asset stalls.
 * Author: Erlen Masson
 * Version: 1.0.0
 * Created: 29 May 2026
 */

(function () {
  "use strict";

  console.log("Script - Site Loader v1.0.0 (Stitchy)");

  var loaderEl = document.querySelector("[data-site-loader]");
  if (!loaderEl) return;

  var logoMount = loaderEl.querySelector("[data-site-loader-logo]");
  var animationPath =
    loaderEl.getAttribute("data-lottie-path") ||
    "assets/images/logo-line-svg.json";
  var safetyMs = 4000;

  var lottieDone = false;
  var pageLoaded = document.readyState === "complete";
  var hidden = false;

  function hideLoader() {
    if (hidden) return;
    hidden = true;
    loaderEl.classList.add("is-hidden");
    window.setTimeout(function () {
      if (loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
    }, 700);
  }

  function maybeHide() {
    if (lottieDone && pageLoaded) hideLoader();
  }

  function startLottie() {
    if (typeof lottie === "undefined" || !logoMount) {
      lottieDone = true;
      maybeHide();
      return;
    }
    var anim = lottie.loadAnimation({
      container: logoMount,
      renderer: "svg",
      loop: false,
      autoplay: true,
      path: animationPath,
    });
    anim.addEventListener("complete", function () {
      lottieDone = true;
      maybeHide();
    });
    anim.addEventListener("data_failed", function () {
      console.warn("site-loader: Lottie data failed to load — dismissing");
      lottieDone = true;
      maybeHide();
    });
  }

  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    // Honour the user's setting: skip the draw, shorten the display, still let
    // the gradient sit briefly so the brand moment isn't completely silent.
    safetyMs = 800;
    lottieDone = true;
  } else {
    startLottie();
  }

  window.addEventListener("load", function () {
    pageLoaded = true;
    maybeHide();
  });

  window.setTimeout(hideLoader, safetyMs);
})();
