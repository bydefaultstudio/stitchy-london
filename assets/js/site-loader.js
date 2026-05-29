/**
 * Script Purpose: Stitchy London — Site Loader. Acts as the bd-animations
 *                 "intro curtain": fades in, plays the line-draw Stitchy
 *                 Lottie over an animated gradient, waits for the page to
 *                 settle, then fades out and hands control back to
 *                 bd-animations via studio:intro-complete + bd:intro-complete.
 *
 *                 Dismiss gates (all must pass, or 5s safety cap):
 *                   1. Lottie animation finished
 *                   2. studio:ready dispatched by bd-animations.js
 *                   3. window.load fired
 *
 *                 Contract with bd-animations.js (assets/js/bd-animations.js):
 *                   • body.is-intro-loading must be present BEFORE
 *                     bd-animations init runs — set in HTML, not from JS.
 *                   • dispatch studio:intro-complete  → reveals start
 *                   • dispatch bd:intro-complete      → ScrollTrigger refresh
 *
 * Author: Erlen Masson
 * Version: 1.1.0
 * Created: 29 May 2026
 */

(function () {
  "use strict";

  var loaderEl = document.querySelector("[data-site-loader]");
  if (!loaderEl) return;

  console.log("Script - Site Loader v1.1.0 (Stitchy)");

  var logoMount = loaderEl.querySelector("[data-site-loader-logo]");
  var animationPath =
    loaderEl.getAttribute("data-lottie-path") ||
    "assets/images/logo-line-svg.json";
  // Lottie native duration is 3s (75 frames @ 25fps). 1.5x ⇒ 2s draw.
  var animationSpeed =
    parseFloat(loaderEl.getAttribute("data-lottie-speed")) || 1.5;
  var fadeMs = 500; // matches CSS transition on .site-loader
  var safetyMs = 5000;

  var lottieDone = false;
  var pageLoaded = document.readyState === "complete";
  // bd-animations sets data-studio-ready before dispatching the event, so we
  // can detect a fire that happened before our listener attached (cached-font
  // cold loads, bfcache, etc.). If GSAP isn't loaded, bd-animations bails and
  // never fires studio:ready — treat that as ready so we don't hang.
  var studioReady =
    document.documentElement.dataset.studioReady === "true" ||
    typeof gsap === "undefined";
  var hidden = false;

  function dispatchIntroComplete() {
    document.dispatchEvent(new CustomEvent("studio:intro-complete"));
    document.dispatchEvent(new CustomEvent("bd:intro-complete"));
  }

  function hideLoader() {
    if (hidden) return;
    hidden = true;
    loaderEl.classList.remove("is-visible");
    loaderEl.classList.add("is-hidden");
    window.setTimeout(function () {
      document.body.classList.remove("is-intro-loading");
      dispatchIntroComplete();
      if (loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
    }, fadeMs);
  }

  function maybeHide() {
    if (lottieDone && pageLoaded && studioReady) hideLoader();
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
    anim.setSpeed(animationSpeed);
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

  // Fade IN on the next frame — without this the browser paints the loader
  // already at opacity 1 and skips the transition.
  window.requestAnimationFrame(function () {
    loaderEl.classList.add("is-visible");
  });

  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    // Honour the user's setting: skip the draw, shorten the display, still let
    // the gradient sit briefly so the brand moment isn't completely silent.
    safetyMs = 1000;
    lottieDone = true;
  } else {
    startLottie();
  }

  if (!studioReady) {
    document.addEventListener(
      "studio:ready",
      function () {
        studioReady = true;
        maybeHide();
      },
      { once: true }
    );
  }

  window.addEventListener("load", function () {
    pageLoaded = true;
    maybeHide();
  });

  // Safety cap: dismiss even if one of the gates never resolves (CDN fail,
  // GSAP missing, fonts.ready hang) so the page is never stuck behind the
  // curtain. dispatchIntroComplete() still fires so reveals catch up.
  window.setTimeout(hideLoader, safetyMs);
})();
