/**
 * Script Purpose: Stitchy London — Site Loader. Acts as the bd-animations
 *                 "intro curtain": opaque from first paint, plays the
 *                 line-draw Stitchy Lottie over an animated gradient, waits
 *                 for the page to settle, then fades out and hands control
 *                 back to bd-animations.
 *
 *                 Also wires page transitions: intercepts internal link
 *                 clicks, fades a fresh curtain in over the current page,
 *                 then navigates. The next page renders with its own loader
 *                 at opacity 1, so the curtain stays visible across the
 *                 document swap — no flash.
 *
 *                 Dismiss gates (all must pass, or 5s safety cap):
 *                   1. Lottie animation finished
 *                   2. studio:ready dispatched by bd-animations.js
 *                   3. window.load fired
 *
 *                 Curtain enforcement: pauses gsap.globalTimeline immediately
 *                 so any reveals bd-animations creates during its fonts.ready
 *                 init are held at progress 0 until the curtain fade-out
 *                 completes. Without this, above-fold scroll-trigger reveals
 *                 (fade / slide-up / headline-reveal) fire under the curtain
 *                 and the user never sees them play.
 *
 *                 Contract with bd-animations.js (assets/js/bd-animations.js):
 *                   • body.is-intro-loading must be present BEFORE
 *                     bd-animations init runs — set in HTML, not from JS.
 *                   • dispatch studio:intro-complete  → in-view reveals start
 *                   • dispatch bd:intro-complete      → ScrollTrigger refresh
 *
 *                 Per-link opt-out: add data-no-transition to any <a> that
 *                 should bypass the page-transition curtain (e.g. anchor jumps
 *                 you want instant). Anchors (#hash), mailto:/tel:, external
 *                 origins, target=_blank, download links, and modifier-clicked
 *                 links are skipped automatically.
 *
 * Author: Erlen Masson
 * Version: 1.4.0
 * Created: 29 May 2026
 */

(function () {
  "use strict";

  var loaderEl = document.querySelector("[data-site-loader]");
  if (!loaderEl) return;

  console.log("Script - Site Loader v1.4.0 (Stitchy)");

  // Cross-page anchor support: if the URL arrived with a hash (e.g. /#about),
  // the browser auto-jumps to it before ScrollTrigger is built. Scrub reveals
  // above the target then have nothing to scrub through — they stick mid-state.
  // Strip the hash so the curtain starts at top-of-page, capture the target,
  // and re-scroll smoothly after intro-complete so each scrub plays through.
  var initialHash = "";
  if (window.location.hash && window.location.hash.length > 1) {
    initialHash = window.location.hash;
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) {
      // History API unavailable — fall through; the scroll reset alone covers most cases.
    }
    window.scrollTo(0, 0);
  }

  // Pause the GSAP global timeline IMMEDIATELY. bd-animations' fonts.ready
  // callback may have already queued tweens for above-fold reveals (fade,
  // slide-up, headline-reveal) — those tweens are added to the global
  // timeline but won't visually advance until the next rAF. Pausing here
  // catches them before that rAF, so they sit at progress 0 throughout the
  // curtain. We resume them after the fade-out.
  var pausedGsap = false;
  if (typeof gsap !== "undefined" && gsap.globalTimeline) {
    gsap.globalTimeline.pause();
    pausedGsap = true;
  }

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

  // CSS `html { scroll-behavior: smooth }` drives the timing; ScrollTrigger
  // scrubs each reveal as the page passes through its range. prefers-reduced-motion
  // downgrades the CSS to auto, so the scroll becomes an instant jump.
  function scrollToInitialHash() {
    if (!initialHash) return;
    var slug = initialHash.charAt(0) === "#" ? initialHash.slice(1) : initialHash;
    if (!slug) return;
    var selector;
    try {
      selector = "#" + (window.CSS && CSS.escape ? CSS.escape(slug) : slug);
    } catch (e) {
      selector = "#" + slug;
    }
    var target = document.querySelector(selector);
    if (!target) return;
    // rAF so bd-animations' bd:intro-complete listener (ScrollTrigger.refresh)
    // has measured fresh trigger positions before we start scrolling.
    requestAnimationFrame(function () {
      target.scrollIntoView({ block: "start" });
    });
  }

  function hideLoader() {
    if (hidden) return;
    hidden = true;
    loaderEl.classList.add("is-hidden");
    window.setTimeout(function () {
      document.body.classList.remove("is-intro-loading");
      // Resume GSAP THEN dispatch the curtain-complete events. The paused
      // above-fold tweens start playing on the next rAF, and bd-animations'
      // own listeners (refresh, in-view reveals) fire in the same tick — so
      // every reveal lands together once the curtain is gone.
      if (pausedGsap && typeof gsap !== "undefined" && gsap.globalTimeline) {
        gsap.globalTimeline.resume();
      }
      dispatchIntroComplete();
      scrollToInitialHash();
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
  // curtain. Resume + dispatchIntroComplete() still fire so reveals catch up.
  window.setTimeout(hideLoader, safetyMs);

  //
  //------- Page Transitions -------//
  //

  var navigating = false;

  function shouldInterceptLink(link, evt) {
    if (!link) return false;
    // Modifier / non-primary clicks → let the browser handle (new tab etc.)
    if (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return false;
    if (typeof evt.button === "number" && evt.button !== 0) return false;
    // Per-link opt-out
    if (link.hasAttribute("data-no-transition")) return false;
    // New tab / window
    if (link.target && link.target !== "" && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    var raw = link.getAttribute("href");
    if (!raw) return false;
    // Pure anchor jumps stay instant
    if (raw.charAt(0) === "#") return false;
    // Non-http schemes (mailto, tel, javascript, sms, etc.)
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) return false;
    // Resolve and compare origins
    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return false;
    }
    if (url.origin !== window.location.origin) return false;
    // Same URL incl. hash → treat as in-page jump
    if (url.href === window.location.href) return false;
    // Same path + only hash differs → in-page jump
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      url.hash &&
      url.hash !== window.location.hash
    ) {
      return false;
    }
    return true;
  }

  function startPageTransition(href) {
    if (navigating) return;
    navigating = true;

    var curtain = document.createElement("div");
    curtain.className = "site-loader is-fade-in";
    curtain.setAttribute("aria-hidden", "true");
    // Page-transition curtain is gradient-only — no Lottie. The destination
    // page renders its own loader with the Lottie + full lifecycle.
    document.body.appendChild(curtain);

    // Lock scroll for the brief fade-in so the page doesn't bounce under the
    // semi-transparent curtain.
    document.body.classList.add("is-intro-loading");

    // Force a layout read so the browser registers the .is-fade-in start
    // state, then drop it on the next frame to trigger the opacity transition.
    void curtain.offsetWidth;
    window.requestAnimationFrame(function () {
      curtain.classList.remove("is-fade-in");
    });

    window.setTimeout(function () {
      window.location.href = href;
    }, fadeMs);
  }

  document.addEventListener("click", function (evt) {
    var link = evt.target.closest && evt.target.closest("a[href]");
    if (!shouldInterceptLink(link, evt)) return;
    evt.preventDefault();
    startPageTransition(link.href);
  });

  // bfcache restore: if the user hits back/forward and the browser restores
  // this page from memory, the in-flight curtain (if any) is restored too.
  // Tear it down so the user doesn't land on a covered page.
  window.addEventListener("pageshow", function (evt) {
    if (!evt.persisted) return;
    navigating = false;
    document.body.classList.remove("is-intro-loading");
    var stray = document.querySelectorAll(".site-loader");
    for (var i = 0; i < stray.length; i++) {
      if (stray[i].parentNode) stray[i].parentNode.removeChild(stray[i]);
    }
  });
})();
