/**
 * Script Purpose: ByDefault Animations (Studio)
 * Author: Erlen Masson
 * Version: 3.0.0
 * Created: 5 Feb 2025
 * Last Updated: 23 April 2026
 *
 * Refactored for Barba.js integration using gsap.context().
 * All animations are scoped to a container and cleaned up
 * automatically between page transitions via ctx.revert().
 */

(function () {
  "use strict";

  // Guard: bail if GSAP failed to load (prevents cascading script death)
  if (typeof gsap === "undefined") {
    console.warn("bd-animations: GSAP not loaded, skipping init");
    // Force-show all CSS-hidden elements so content isn't invisible
    document.querySelectorAll("[data-bd-animate],[data-bd-enter],[data-text-animate]")
      .forEach(function (el) { el.style.opacity = "1"; });
    return;
  }

  console.log("Script - Animations v3.0.0 (Studio)");

  // Register plugins once — survives ctx.revert()
  gsap.registerPlugin(ScrollTrigger, SplitText);

  // Mobile browsers fire `resize` whenever the URL bar shows/hides during
  // scroll. Without this, ScrollTrigger refreshes on every toggle — the main
  // cause of mobile scroll jank. This tells ScrollTrigger to ignore height-only
  // mobile resizes (it still refreshes on genuine width/orientation changes).
  ScrollTrigger.config({ ignoreMobileResize: true });

  // ------- Module State ------- //

  var ctx = null;
  var currentContainer = null;
  var resizeListenerAttached = false;
  var lastViewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
  var activeObserver = null;

  // ------- Configurable Parameters ------- //

  var animationStagger = { chars: 0.05, words: 0.1, lines: 0.15 };
  var FADED_FROM_OPACITY = 0.2;



  function getFadeStart() {
    return window.innerWidth < 768 ? "top 100%" : "top 100%";
  }

  function getFadeEnd() {
    return window.innerWidth < 768 ? "top 60%" : "bottom 75%";
  }

  function getFadeEndChars() {
    return window.innerWidth < 768 ? "top 50%" : "bottom 75%";
  }

  // Headline settings
  var headlineWordStagger = 0.3;
  var headlineFromOpacity = 0.1;


  function headlineStart() {
    return window.innerWidth < 768 ? "top 88%" : "top 88%";
  }

  function headlineEnd() {
    return window.innerWidth < 768 ? "top 50%" : "bottom 65%";
  }


  // data-bd-faded elements start later so the ghosted (0.2 opacity) reveal
  // has time to register before the stagger fires.
  function getFadeStartFor(element) {
    return element.hasAttribute("data-bd-faded") ? "top 85%" : getFadeStart();
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ------- Helpers ------- //

  function getScrubValue(element) {
    if (!element.hasAttribute("data-bd-scrub")) return undefined;

    var scrubAttr = element.getAttribute("data-bd-scrub");

    if (!scrubAttr || scrubAttr === "") return true;
    if (scrubAttr.toLowerCase() === "true") return true;

    var numericValue = parseFloat(scrubAttr);
    if (!isNaN(numericValue) && numericValue > 0) {
      return Math.max(numericValue, 0.1);
    }

    return undefined;
  }

  // Scrub ties a tween to scroll position, re-applying it every frame the
  // element is in range. With dozens of scrubbed (often SplitText) reveals per
  // page, that per-frame work is the dominant mobile scroll cost. Below the
  // 768px breakpoint we drop scrub entirely: reveals become one-shot `once`
  // tweens that fire and detach. Desktop keeps every scroll-linked reveal.
  // Read at create time; a width cross past 768 triggers a full rebuild via
  // handleResize, so this re-evaluates with the new width.
  function shouldScrub() {
    return window.innerWidth >= 768;
  }

  function getDelayValue(element, defaultDelay) {
    if (defaultDelay === undefined) defaultDelay = 0;
    var delayAttr = element.getAttribute("data-bd-delay");
    if (!delayAttr) return defaultDelay;

    var delayValue = parseFloat(delayAttr);
    if (isNaN(delayValue) || delayValue < 0) return defaultDelay;
    return delayValue;
  }

  // data-bd-faded — boolean opt-in. Starts split units at 0.2 instead of 0
  // for a "ghosted reveal" where the text outline is faintly visible from
  // the start and crisps up as the stagger plays.
  function getFromOpacity(element) {
    return element.hasAttribute("data-bd-faded") ? FADED_FROM_OPACITY : 0;
  }

  function isInViewport(element) {
    var rect = element.getBoundingClientRect();
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    var visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    var visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);

    if (visibleHeight <= 0 || visibleWidth <= 0) return false;

    var elementArea = rect.height * rect.width;
    var visibleArea = visibleHeight * visibleWidth;
    return (visibleArea / elementArea) * 100 >= 2;
  }

  // Helper: create a standard scroll-triggered animation
  // Reduces repetition across the 15+ animation functions
  function createScrollAnimation(sel, fromProps, toProps, self) {
    sel.forEach(function (element) {
      // Skip children already handled by a scrub-group parent — their tween
      // lives on the shared timeline; running the per-element path here
      // would create a duplicate trigger on the same element.
      if (element.dataset.bdScrubHandled === "true") return;

      // Mobile drops scrub (see shouldScrub). Resolve once up front so the
      // above-fold short-circuit and the scrub/once branch agree — otherwise a
      // mobile above-fold scrub element would skip the immediate-play path and
      // get a stranded `once` trigger whose start is already passed.
      var effectiveScrub = shouldScrub() ? getScrubValue(element) : undefined;
      var delayValue = getDelayValue(element);

      gsap.set(element, fromProps);

      // Above-fold: animate immediately instead of waiting for ScrollTrigger
      if (effectiveScrub === undefined && isInViewport(element)) {
        gsap.to(element, Object.assign({ duration: 0.8 }, toProps, { delay: delayValue }));
        return;
      }

      var tweenConfig = Object.assign({ duration: 0.8 }, toProps, {
        delay: delayValue,
        scrollTrigger: {
          trigger: element,
          start: getFadeStart(),
          end: getFadeEnd()
        }
      });

      if (effectiveScrub !== undefined) {
        tweenConfig.scrollTrigger.scrub = effectiveScrub;
      } else {
        tweenConfig.scrollTrigger.once = true;
      }

      gsap.to(element, tweenConfig);
    });
  }

  // ------- Scrub Groups -------
  //
  // Pattern: a parent declares data-bd-scrub-group and owns ONE ScrollTrigger.
  // Each child with data-bd-animate joins a shared gsap.timeline scrubbed by
  // that trigger, with its tween positioned at `index * stagger`. This lets
  // same-Y siblings reveal in sequence as the parent scrolls through its
  // trigger range — something per-element triggers can't do, since aligned
  // siblings all fire at the same scroll Y.
  //
  // API:
  //   parent: data-bd-scrub-group
  //   parent: data-bd-scrub-stagger="0.2"  (optional; default scrubGroupDefaultStagger)
  //   child:  data-bd-animate="slide-up"   (or fade/slide/slide-*/scale-in/scale-up)

  var scrubGroupDefaultStagger = 0.15;
  var scrubGroupWarnedTypes = new Set();        // dedup unknown-type warnings
  var scrubGroupWarnedChildren = new WeakSet(); // dedup conflicting-child warnings

  function getScrubGroupProps(animateValue) {
    switch (animateValue) {
      case "slide-up":    return { from: { opacity: 0, y: 50 },      to: { opacity: 1, y: 0 } };
      case "slide-down":  return { from: { opacity: 0, y: -50 },     to: { opacity: 1, y: 0 } };
      case "slide-left":  return { from: { opacity: 0, x: -50 },     to: { opacity: 1, x: 0 } };
      case "slide-right": return { from: { opacity: 0, x: 50 },      to: { opacity: 1, x: 0 } };
      case "scale-in":    return { from: { opacity: 0, scale: 0.8 }, to: { opacity: 1, scale: 1 } };
      case "scale-up":    return { from: { opacity: 1, scale: 0.8 }, to: { scale: 1 } };
      case "slide":       return { from: { opacity: 0, y: 40 },      to: { opacity: 1, y: 0 } };
      case "fade":        return { from: { opacity: 0 },             to: { opacity: 1 } };
      default:
        if (animateValue && !scrubGroupWarnedTypes.has(animateValue)) {
          scrubGroupWarnedTypes.add(animateValue);
          console.warn("bd-animations: unsupported data-bd-animate value '" + animateValue + "' inside scrub-group; falling back to fade");
        }
        return { from: { opacity: 0 }, to: { opacity: 1 } };
    }
  }

  function processScrubGroups(self) {
    var groups = self.selector("[data-bd-scrub-group]");

    // Clear stale skip-flags on every reinit so removing data-bd-scrub-group
    // from a parent doesn't leave its children permanently unanimated. We
    // collect every node currently flagged in the active context, then let
    // the loop below re-flag only the ones that are still grouped.
    self.selector("[data-bd-scrub-handled]").forEach(function (el) {
      delete el.dataset.bdScrubHandled;
    });

    groups.forEach(function (parent) {
      var children = parent.querySelectorAll("[data-bd-animate]");
      if (!children.length) return;

      var staggerAttr = parseFloat(parent.getAttribute("data-bd-scrub-stagger"));
      var stagger = (!isNaN(staggerAttr) && staggerAttr >= 0) ? staggerAttr : scrubGroupDefaultStagger;

      // Mobile drops scrub (see shouldScrub): the group plays once on enter
      // instead of tracking scroll. Pass start/end as function refs so
      // invalidateOnRefresh re-evaluates the breakpoint on resize — calling
      // them eagerly here would lock the value to the viewport width at create
      // time. (`end` is inert under `once` but harmless to keep.)
      var scrub = shouldScrub();
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: parent,
          start: getFadeStart,
          end: getFadeEnd,
          scrub: scrub ? true : false,
          once: scrub ? false : true,
          invalidateOnRefresh: true
        }
      });

      // If the parent itself opts into a per-element animation, mark it as
      // handled so createScrollAnimation skips it — otherwise the parent
      // gets its own duplicate trigger that fights the timeline.
      if (parent.hasAttribute("data-bd-animate")) {
        parent.dataset.bdScrubHandled = "true";
      }

      children.forEach(function (child, index) {
        // Footgun: data-bd-scrub on a child of a scrub-group is silently
        // ignored — the parent's trigger owns scrub for the whole group.
        // Warn once per element so the markup author can clean up.
        if (child.hasAttribute("data-bd-scrub") && !scrubGroupWarnedChildren.has(child)) {
          scrubGroupWarnedChildren.add(child);
          console.warn("bd-animations: data-bd-scrub on a child of data-bd-scrub-group is ignored; remove it from the child markup", child);
        }

        var animateValue = child.getAttribute("data-bd-animate");
        var props = getScrubGroupProps(animateValue);
        var position = index * stagger;

        gsap.set(child, props.from);
        // Under scrub, duration: 1 is a unitless timeline beat — actual run
        // time comes from scroll progress through the parent's range. When
        // played once (mobile), use the file's standard 0.8s reveal so each
        // child animates in real time rather than over a literal 1s beat.
        tl.to(child, Object.assign({}, props.to, {
          duration: scrub ? 1 : 0.8,
          ease: "power2.out"
        }), position);

        // Flag prevents the per-element path in createScrollAnimation
        // from creating a second trigger on this child.
        child.dataset.bdScrubHandled = "true";
      });
    });
  }

  //
  // ------- Scroll Reveal Animations ------- //
  //

  function textAnimations(self) {
    // Global reduced-motion guard — all animation functions skip
    if (prefersReducedMotion()) {
      var allAnimated = self.selector("[data-bd-animate], [data-text-animate]");
      allAnimated.forEach(function (el) {
        gsap.set(el, { opacity: 1, clearProps: "transform,filter" });
      });
      return;
    }

    // Scrub-groups must run FIRST so children get marked with
    // dataset.bdScrubHandled before the per-element animation paths see them.
    processScrubGroups(self);

    // Base animations (fade/slide)
    baseTextAnimations(self);

    // SplitText animations
    fadeCharacters(self);
    fadeWords(self);
    fadeWordHeadline(self);
    fadeLines(self);
    fadeRichText(self);
    fadeList(self);

    // Specialized effects
    slideUp(self);
    slideDown(self);
    slideFromLeft(self);
    slideFromRight(self);
    scaleIn(self);
    scaleUp(self);
    rotateIn(self);
    expandSpacing(self);
    skewText(self);
    flipText(self);
    fadeInOut(self);
    blurIn(self);
    bounceIn(self);
    shakeText(self);
    flashText(self);
    tiltText(self);
    // Note: neonText removed — uses hardcoded colors, not suitable for studio
    fadeInViewport(self);
  }

  // ------- Base Animations (fade/slide) ------- //

  function baseTextAnimations(self) {
    // Legacy shim: convert data-text-animate="element" to data-bd-animate="fade"
    self.selector("[data-text-animate='element']").forEach(function (element) {
      if (!element.hasAttribute("data-bd-animate")) {
        element.setAttribute("data-bd-animate", "fade");
      }
    });

    var allElements = self.selector("[data-bd-animate]");
    var fadeElements = [];
    var slideElements = [];

    allElements.forEach(function (element) {
      var animateValue = element.getAttribute("data-bd-animate");
      if (!animateValue || animateValue === "fade") {
        fadeElements.push(element);
      } else if (animateValue === "slide") {
        slideElements.push(element);
      }
      // Other values handled by specialized functions
    });

    // Fade elements
    createScrollAnimation(
      fadeElements,
      { opacity: 0 },
      { opacity: 1, duration: 0.8, ease: "power2.out" },
      self
    );

    // Slide elements
    createScrollAnimation(
      slideElements,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
      self
    );
  }

  // ------- In-Viewport (above-fold on load) ------- //

  function fadeInViewport(self) {
    var introLoading = document.body.classList.contains("is-intro-loading");

    self.selector("[data-bd-animate='in-view'], [data-text-animate='in-view']").forEach(function (el) {
      if (isInViewport(el)) {
        // Already visible — animate immediately (no ScrollTrigger).
        // If the intro curtain is up, hold the reveal until studio:intro-complete
        // so the user sees the animation, not its already-finished result.
        var delay = getDelayValue(el, 0);
        var fromY = parseFloat(el.getAttribute("data-bd-from-y") || "0") || 0;
        var fromX = parseFloat(el.getAttribute("data-bd-from-x") || "0") || 0;
        var fromScale = parseFloat(el.getAttribute("data-bd-from-scale") || "1") || 1;

        var fromState = { autoAlpha: 0, y: fromY, x: fromX, scale: fromScale, force3D: true };
        var toState = { autoAlpha: 1, y: 0, x: 0, scale: 1, duration: 0.8, delay: delay, ease: "power2.out" };

        if (introLoading) {
          gsap.set(el, fromState);
          document.addEventListener("studio:intro-complete", function runIt() {
            gsap.to(el, toState);
          }, { once: true });
        } else {
          gsap.fromTo(el, fromState, toState);
        }
      } else {
        // Out of viewport — create a standard fade ScrollTrigger instead of mutating the attribute
        gsap.set(el, { opacity: 0 });
        gsap.to(el, {
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: getFadeStart(),
            end: getFadeEnd(),
            once: true
          }
        });
      }
    });
  }

  // ------- SplitText Animations ------- //
  // Context tracks SplitText instances automatically in GSAP 3.12+

  // Helper for SplitText scroll config — handles scrub vs once consistently.
  // startFn is optional; defaults to the shared getFadeStart so existing
  // callers stay identical. Pass a custom start function (e.g. headlineStart)
  // for variants that need their own ScrollTrigger start position.
  function splitScrollConfig(element, endFn, startFn) {
    var effectiveScrub = shouldScrub() ? getScrubValue(element) : undefined;
    var config = {
      trigger: element,
      start: (startFn || getFadeStart)(),
      end: endFn()
    };
    if (effectiveScrub !== undefined) {
      config.scrub = effectiveScrub;
    } else {
      config.once = true;
    }
    return config;
  }

  // Reveal the parent that the FOUC-prevention CSS rule
  // (`.js [data-text-animate] { opacity: 0 }` in studio.css) keeps hidden.
  // Children opacity drives the actual animation; this just unhides the
  // wrapper. ctx.revert() clears the inline style on Barba transition,
  // restoring the FOUC guard for the next page.
  function fadeCharacters(self) {
    self.selector("[data-text-animate='chars']").forEach(function (element) {
      var split = new SplitText(element, { type: "chars", tag: "span" });
      gsap.set(split.chars, { opacity: getFromOpacity(element) });
      gsap.set(element, { opacity: 1 });

      gsap.to(split.chars, {
        opacity: 1,
        ease: "power1.inOut",
        stagger: animationStagger.chars,
        scrollTrigger: splitScrollConfig(element, getFadeEndChars)
      });
    });
  }

  function fadeWords(self) {
    self.selector("[data-text-animate='words']").forEach(function (element) {
      var split = new SplitText(element, { type: "words", tag: "span" });
      gsap.set(split.words, { opacity: getFromOpacity(element) });
      gsap.set(element, { opacity: 1 });

      gsap.to(split.words, {
        opacity: 1,
        ease: "power1.inOut",
        stagger: animationStagger.words,
        scrollTrigger: splitScrollConfig(element, getFadeEnd)
      });
    });
  }

  // Headline-only word fade. Independent from fadeWords so the home hero
  // can be tuned without affecting case-study card titles or any future
  // [data-text-animate='words'] usage. Tuning knobs live at the top of
  // the file: headlineWordStagger, headlineFromOpacity, headlineStart(),
  // headlineEnd().
  function fadeWordHeadline(self) {
    self.selector("[data-text-animate='word-headline']").forEach(function (element) {
      var split = new SplitText(element, { type: "words", tag: "span" });
      gsap.set(split.words, { opacity: headlineFromOpacity });
      gsap.set(element, { opacity: 1 });

      gsap.to(split.words, {
        opacity: 1,
        ease: "power1.inOut",
        stagger: headlineWordStagger,
        scrollTrigger: splitScrollConfig(element, headlineEnd, headlineStart)
      });
    });
  }

  function fadeLines(self) {
    self.selector("[data-text-animate='lines']").forEach(function (element) {
      var split = new SplitText(element, { type: "lines" });
      gsap.set(split.lines, { opacity: getFromOpacity(element) });
      gsap.set(element, { opacity: 1 });

      gsap.to(split.lines, {
        opacity: 1,
        ease: "power1.inOut",
        stagger: animationStagger.lines,
        scrollTrigger: splitScrollConfig(element, getFadeEnd)
      });
    });
  }

  function fadeRichText(self) {
    self.selector("[data-text-animate='rich-text']").forEach(function (richTextElement) {
      var elements = richTextElement.querySelectorAll(
        "h1, h2, h3, h4, h5, h6, p, span, strong, em, a, ul, ol, li, blockquote, figure"
      );
      if (elements.length === 0) return;

      var fromOpacity = getFromOpacity(richTextElement);

      elements.forEach(function (element) {
        var split = new SplitText(element, { type: "lines", tag: "span" });
        gsap.set(split.lines, { opacity: fromOpacity });

        gsap.to(split.lines, {
          opacity: 1,
          ease: "power1.inOut",
          stagger: animationStagger.lines,
          scrollTrigger: splitScrollConfig(richTextElement, getFadeEnd)
        });
      });

      gsap.set(richTextElement, { opacity: 1 });
    });
  }

  function fadeList(self) {
    self.selector("[data-text-animate='list']").forEach(function (list) {
      var items = list.querySelectorAll("li");
      if (items.length === 0) return;

      gsap.set(items, { opacity: getFromOpacity(list) });
      gsap.set(list, { opacity: 1 });
      gsap.to(items, {
        opacity: 1,
        stagger: 0.2,
        ease: "power2.inOut",
        scrollTrigger: splitScrollConfig(list, getFadeEnd)
      });
    });
  }

  // ------- Specialized Scroll Animations ------- //

  function slideUp(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='slide-up']"),
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, ease: "power2.out" },
      self
    );
  }

  function slideDown(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='slide-down']"),
      { opacity: 0, y: -50 },
      { opacity: 1, y: 0, ease: "power2.out" },
      self
    );
  }

  function slideFromLeft(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='slide-left']"),
      { opacity: 0, x: -50 },
      { opacity: 1, x: 0, ease: "power2.out" },
      self
    );
  }

  function slideFromRight(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='slide-right']"),
      { opacity: 0, x: 50 },
      { opacity: 1, x: 0, ease: "power2.out" },
      self
    );
  }

  function scaleIn(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='scale-in']"),
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, ease: "power2.out" },
      self
    );
  }

  // scale-up — pure scale, no fade. Element stays fully visible; it just grows.
  // opacity: 1 in fromProps overrides the .js [data-bd-animate] FOUC pre-hide
  // rule in studio.css; without it the element would scale while invisible.
  function scaleUp(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='scale-up']"),
      { opacity: 1, scale: 0.8 },
      { scale: 1, ease: "power2.out" },
      self
    );
  }

  function rotateIn(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='rotate-in']"),
      { opacity: 0, rotate: -15 },
      { opacity: 1, rotate: 0, ease: "power2.out" },
      self
    );
  }

  function expandSpacing(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='expand-spacing']"),
      { opacity: 0, letterSpacing: "-2px" },
      { opacity: 1, letterSpacing: "normal", ease: "power2.out" },
      self
    );
  }

  function skewText(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='skew']"),
      { opacity: 0, skewX: "15deg" },
      { opacity: 1, skewX: "0deg", ease: "power2.out" },
      self
    );
  }

  function flipText(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='flip']"),
      { opacity: 0, rotateX: -90 },
      { opacity: 1, rotateX: 0, ease: "power2.out" },
      self
    );
  }

  function fadeInOut(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='fade-in-out']"),
      { opacity: 0 },
      { opacity: 1, ease: "power2.inOut" },
      self
    );
  }

  function blurIn(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='blur-in']"),
      { opacity: 0, filter: "blur(10px)" },
      { opacity: 1, filter: "blur(0px)", ease: "power2.out" },
      self
    );
  }

  function bounceIn(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='bounce-in']"),
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, ease: "bounce.out" },
      self
    );
  }

  function shakeText(self) {
    self.selector("[data-bd-animate='shake']").forEach(function (element) {
      gsap.set(element, { x: 0 });
      gsap.to(element, {
        x: "+=10",
        repeat: 5,
        yoyo: true,
        ease: "power2.out",
        delay: getDelayValue(element),
        scrollTrigger: {
          trigger: element,
          start: getFadeStart(),
          end: getFadeEnd(),
          scrub: getScrubValue(element)
        }
      });
    });
  }

  // Note: flash and neon use repeat: -1 (infinite). Context.revert() kills them
  // and restores elements to their from-state. Since these elements are always
  // inside the Barba container (removed from DOM on navigation), this is safe.
  function flashText(self) {
    self.selector("[data-bd-animate='flash']").forEach(function (element) {
      gsap.fromTo(
        element,
        { opacity: 0 },
        { opacity: 1, repeat: -1, yoyo: true, duration: 0.5, ease: "power2.out" }
      );
    });
  }

  function tiltText(self) {
    createScrollAnimation(
      self.selector("[data-bd-animate='tilt']"),
      { rotateY: 90, opacity: 0 },
      { rotateY: 0, opacity: 1, duration: 1, ease: "power2.out" },
      self
    );
  }

  //
  // ------- Pin Elements ------- //
  //

  function pinElements(self) {
    var pinnedEls = self.selector("[data-pin]");
    if (!pinnedEls.length) return;

    // Desktop only — matchMedia auto-reverts pins below breakpoint
    ScrollTrigger.matchMedia({
      "(min-width: 992px)": function () {
        pinnedEls.forEach(function (el) {
          var offset = parseFloat(el.getAttribute("data-pin")) || 0;
          var trigger = el.parentElement;

          ScrollTrigger.create({
            trigger: trigger,
            start: "top " + offset + "px",
            end: function () {
              return "+=" + (trigger.offsetHeight - el.offsetHeight);
            },
            pin: el,
            pinSpacing: false,
            invalidateOnRefresh: true
          });
        });
      }
    });
  }

  //
  // ------- Parallax (image cover) ------- //
  //
  // Markup:
  //   <div class="some-mask" data-bd-parallax>
  //     <img src="…" alt="…">
  //   </div>
  //
  // The wrapper must have overflow: hidden and a defined height (or
  // aspect-ratio). The inner image must be TALLER than the wrapper so it has
  // "slack" to translate through — e.g. height: 120% with object-fit: cover.
  //
  // Attribute values:
  //   data-bd-parallax           → "auto" (full slack)
  //   data-bd-parallax="auto"    → full slack
  //   data-bd-parallax="0.5"     → 50% of slack (subtler)
  //
  // If a more specific target is needed inside the wrapper, mark it with
  // [data-bd-parallax-image]; otherwise the first <img> descendant is used.

  function parallaxElements(self) {
    if (prefersReducedMotion()) return;

    var masks = self.selector("[data-bd-parallax]");
    if (!masks.length) return;

    masks.forEach(function (mask) {
      var image = mask.querySelector("[data-bd-parallax-image]")
        || mask.querySelector("img");
      if (!image) return;

      var attr = mask.getAttribute("data-bd-parallax");
      var intensity = 1;
      if (attr && attr !== "" && attr.toLowerCase() !== "auto") {
        var parsed = parseFloat(attr);
        if (!isNaN(parsed)) intensity = Math.max(0, Math.min(2, parsed));
      }

      // Function-based y values are re-read on ScrollTrigger.refresh thanks to
      // invalidateOnRefresh, so layout changes (resize, font load, image
      // decode, Barba arrival) update the slack automatically. Slack is
      // clamped to >= 0 so an undecoded image (offsetHeight: 0) doesn't
      // invert direction until its load event triggers the refresh.
      function getSlack() {
        return Math.max(0, image.offsetHeight - mask.offsetHeight);
      }

      var tween = gsap.fromTo(
        image,
        {
          y: function () { return -(getSlack() / 2) * intensity; }
        },
        {
          y: function () { return (getSlack() / 2) * intensity; },
          ease: "none",
          scrollTrigger: {
            trigger: mask,
            start: "top bottom",
            end: "bottom top",
            // scrub: 1 = playhead catches up over ~1s, smoothing the motion.
            // Higher = more lag/smoother; lower (or true) = locked to scroll.
            scrub: 1,
            invalidateOnRefresh: true
          }
        }
      );

      // Lazy / below-the-fold images often have offsetHeight: 0 at init,
      // which makes slack collapse to 0. Refresh the trigger when the
      // image finally decodes so the function-based y values are re-read.
      // self.add() returns its cleanup function so the listener is removed
      // when ctx.revert() runs at page leave.
      if (image.tagName === "IMG" && !image.complete) {
        self.add(function () {
          function onLoad() {
            if (tween.scrollTrigger) tween.scrollTrigger.refresh();
          }
          image.addEventListener("load", onLoad, { once: true });
          return function () {
            image.removeEventListener("load", onLoad);
          };
        });
      }
    });
  }

  //
  // ------- Refresh Observer ------- //
  //

  function refreshObserve(self) {
    var targets = self.selector("[data-refresh]");
    if (!targets.length) return;

    var timeout;
    var observer = new ResizeObserver(function () {
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        ScrollTrigger.refresh();
      }, 200);
    });

    targets.forEach(function (el) {
      observer.observe(el);
    });

    // Store observer so bdAnimationsCleanup can disconnect it
    activeObserver = observer;
  }

  //
  // ------- Resize Handling ------- //
  //

  function debounce(func) {
    var timer;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(func, 150);
    };
  }

  function handleResize() {
    if (!ctx || !currentContainer) return;

    // The breakpoint logic here only branches on innerWidth, so a height-only
    // resize (e.g. mobile URL bar) never alters output — a full rebuild would
    // be pure waste mid-scroll (re-split + retrigger = jank). Only rebuild on a
    // real width change; ScrollTrigger's own resize handling refreshes trigger
    // positions for legitimate height changes (and ignores mobile URL-bar
    // toggles via ignoreMobileResize, set above).
    var width = window.innerWidth;
    if (width === lastViewportWidth) return;
    lastViewportWidth = width;

    // Full reinit: revert context (reverts SplitText + kills ScrollTriggers)
    // then recreate with fresh measurements. Happens in a single frame so
    // no visible flicker — elements are set to initial state immediately.
    window.bdAnimationsInit(currentContainer);
  }

  function addResizeListener() {
    if (resizeListenerAttached) return;
    resizeListenerAttached = true;
    window.addEventListener("resize", debounce(handleResize));
  }

  //
  // ------- Lifecycle API (called by studio-barba.js) ------- //
  //

  /**
   * Initialize all scroll animations scoped to a container.
   * Creates a gsap.context() — all GSAP work inside is auto-tracked.
   */
  window.bdAnimationsInit = function bdAnimationsInit(container) {
    // Clean up any existing context first
    if (ctx) {
      ctx.revert();
      ctx = null;
    }

    currentContainer = container || document.body;

    ctx = gsap.context(function (self) {
      textAnimations(self);
      pinElements(self);
      parallaxElements(self);
      refreshObserve(self);
      setupParentTriggers(currentContainer, self);
    }, currentContainer);
  };

  /**
   * Kill all GSAP animations, ScrollTriggers, SplitText, and pins.
   * Called before Barba leave transition.
   */
  window.bdAnimationsCleanup = function bdAnimationsCleanup() {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    activeTriggerObservers.forEach(function (o) { o.disconnect(); });
    activeTriggerObservers = [];
    if (ctx) {
      ctx.revert();
      ctx = null;
    }
    currentContainer = null;
  };

  /**
   * Animate [data-bd-leave] elements OUT. Returns a timeout-guarded Promise.
   * Called in studioLeave() before the WAAPI page transition.
   */
  window.bdAnimateElementsOut = function bdAnimateElementsOut(container) {
    if (prefersReducedMotion()) return Promise.resolve();

    var elements = container.querySelectorAll("[data-bd-leave]");
    if (!elements.length) return Promise.resolve();

    var tl = gsap.timeline();

    elements.forEach(function (el) {
      var type = el.getAttribute("data-bd-leave");
      var delay = getDelayValue(el);

      switch (type) {
        case "slide-down":
          tl.to(el, { opacity: 0, y: 40, duration: 0.4, ease: "power2.in", delay: delay }, 0);
          break;
        case "slide-up":
          tl.to(el, { opacity: 0, y: -40, duration: 0.4, ease: "power2.in", delay: delay }, 0);
          break;
        case "blur":
          tl.to(el, { opacity: 0, filter: "blur(10px)", duration: 0.4, ease: "power2.in", delay: delay }, 0);
          break;
        case "scale":
          tl.to(el, { opacity: 0, scale: 0.9, duration: 0.4, ease: "power2.in", delay: delay }, 0);
          break;
        case "fade":
        default:
          tl.to(el, { opacity: 0, duration: 0.3, ease: "power2.in", delay: delay }, 0);
          break;
      }
    });

    // Safety: resolve even if timeline is killed (prevents Barba deadlock)
    // Use totalDuration() to account for delays within the timeline
    return Promise.race([
      tl.then(),
      new Promise(function (r) {
        setTimeout(r, tl.totalDuration() * 1000 + 200);
      })
    ]);
  };

  /**
   * Animate [data-bd-enter] elements IN after the page transition.
   * Appended to existing context via ctx.add() for unified cleanup.
   */
  window.bdAnimateElementsIn = function bdAnimateElementsIn(container) {
    if (!ctx || prefersReducedMotion()) return;

    // If the intro curtain is up, set the from-state immediately and wait
    // for studio:intro-complete to run the actual entry animation. Otherwise
    // run it now (covers Barba transitions + second-visit cold loads).
    if (document.body.classList.contains("is-intro-loading")) {
      ctx.add(function () {
        var elementsForGate = container.querySelectorAll("[data-bd-enter]");
        if (elementsForGate.length) {
          gsap.set(elementsForGate, { autoAlpha: 0 });
        }
      });
      document.addEventListener("studio:intro-complete", function runEntry() {
        runBdAnimateElementsIn(container);
      }, { once: true });
      return;
    }

    runBdAnimateElementsIn(container);
  };

  // Single source of truth for the entry-animation vocabulary used by:
  //   - the in-Barba reveal pass (runBdAnimateElementsIn → ctx-tracked)
  //   - the persistent-chrome pass (bdAnimateChromeIn → outside ctx)
  //   - the active-trigger pass (setupParentTriggers → ctx-tracked, fires on class flip)
  // From/to props are split so the active-trigger pass can pre-set elements to
  // their start state and reset them on close without duplicating the lookup.
  function getEnterFromProps(type) {
    switch (type) {
      case "slide":
      case "slide-up":
        return { autoAlpha: 0, y: 40 };
      case "blur-in":
        return { autoAlpha: 0, filter: "blur(10px)" };
      case "scale":
        return { autoAlpha: 0, scale: 0.9 };
      case "fade":
      default:
        return { autoAlpha: 0 };
    }
  }

  function getEnterToProps(type, delay) {
    var base = { duration: 0.8, ease: "power2.out", delay: delay };
    switch (type) {
      case "slide":
      case "slide-up":
        return Object.assign({ autoAlpha: 1, y: 0 }, base);
      case "blur-in":
        return Object.assign({ autoAlpha: 1, filter: "blur(0px)" }, base);
      case "scale":
        return Object.assign({ autoAlpha: 1, scale: 1 }, base);
      case "fade":
      default:
        return Object.assign({ autoAlpha: 1 }, base);
    }
  }

  function applyEnterFromState(el) {
    gsap.set(el, getEnterFromProps(el.getAttribute("data-bd-enter")));
  }

  function applyEnterAnimation(el, type, delay) {
    gsap.fromTo(el, getEnterFromProps(type), getEnterToProps(type, delay));
  }

  //
  // ------- Active-state parent trigger ------- //
  //
  // Generic mechanism: an element marked with [data-bd-parent="<state>"] is
  // observed for the class .is-<state> being added or removed. When added, the
  // [data-bd-enter] descendants play their entrance via applyEnterAnimation.
  // When removed, descendants reset to their start state silently (no exit
  // animation) — ready to replay on next activation. Children inherit the
  // existing [data-bd-enter] vocabulary and data-bd-delay knobs.
  //
  // Cleanup: observers tracked in activeTriggerObservers and disconnected by
  // bdAnimationsCleanup. Tweens are fired via ctx.add() so ctx.revert() kills
  // any in-flight tween on Barba leave.

  var activeTriggerObservers = [];

  function setupParentTriggers(scope, ctxRef) {
    // Idempotency on re-init: drop any leftover observers before rebinding.
    activeTriggerObservers.forEach(function (o) { o.disconnect(); });
    activeTriggerObservers = [];

    if (prefersReducedMotion()) return;
    var root = scope || document;
    root.querySelectorAll("[data-bd-parent]").forEach(function (parent) {
      setupOneParentTrigger(parent, ctxRef);
    });
  }

  function setupOneParentTrigger(parent, ctxRef) {
    var state = parent.getAttribute("data-bd-parent");
    if (!state) return;
    var stateClass = "is-" + state;

    var children = Array.prototype.slice.call(
      parent.querySelectorAll("[data-bd-enter]")
    );
    if (!children.length) return;

    // Pre-set descendants to start state so they're "off" before first fire.
    children.forEach(applyEnterFromState);

    function fireEntrance() {
      if (!ctxRef) return;
      ctxRef.add(function () {
        children.forEach(function (kid) {
          applyEnterAnimation(
            kid,
            kid.getAttribute("data-bd-enter"),
            getDelayValue(kid)
          );
        });
      });
    }

    function resetToStart() {
      children.forEach(function (kid) {
        gsap.killTweensOf(kid);
        applyEnterFromState(kid);
      });
    }

    var lastOn = parent.classList.contains(stateClass);
    // Cover deep-link / SSR-open / default-active scenarios: if the parent
    // boots already in the on-state, fire the entrance once so descendants
    // animate in rather than sitting invisible.
    if (lastOn) fireEntrance();

    var observer = new MutationObserver(function () {
      var nowOn = parent.classList.contains(stateClass);
      if (nowOn === lastOn) return;
      lastOn = nowOn;
      if (nowOn) fireEntrance();
      else resetToStart();
    });

    observer.observe(parent, { attributes: true, attributeFilter: ["class"] });
    activeTriggerObservers.push(observer);
  }

  function runBdAnimateElementsIn(container) {
    if (!ctx) return;
    // Container may be detached if a Barba nav swapped it out before the
    // gated event fired. Bail rather than animating nothing.
    if (!container || !container.isConnected) return;

    ctx.add(function () {
      var elements = container.querySelectorAll("[data-bd-enter]");
      if (!elements.length) return;

      elements.forEach(function (el) {
        applyEnterAnimation(el, el.getAttribute("data-bd-enter"), getDelayValue(el));
      });
    });
  }

  /**
   * Animate persistent chrome (sidebar, page-header, etc.) — elements that
   * live OUTSIDE the Barba container and must NOT be reverted by ctx.revert()
   * on the next page nav. Uses the same [data-bd-enter] + data-bd-delay
   * vocabulary as in-Barba reveals, but bypasses ctx so completed tweens
   * survive Barba transitions.
   *
   * Per-element idempotency: animated elements get data-bd-revealed set,
   * so future calls (e.g. after dynamic content reload) only animate fresh
   * nodes. Pass a tighter scope (.sidebar-slot) for partial reveals.
   */
  window.bdAnimateChromeIn = function bdAnimateChromeIn(scope) {
    if (!scope) return;
    var elements = scope.querySelectorAll("[data-bd-enter]:not([data-bd-revealed])");
    if (!elements.length) return;

    if (prefersReducedMotion()) {
      elements.forEach(function (el) {
        gsap.set(el, { autoAlpha: 1 });
        el.setAttribute("data-bd-revealed", "");
      });
      return;
    }

    elements.forEach(function (el) {
      applyEnterAnimation(el, el.getAttribute("data-bd-enter"), getDelayValue(el));
      el.setAttribute("data-bd-revealed", "");
    });
  };

  //
  // ------- Initial Load ------- //
  //

  function signalStudioReady() {
    // Latched flag so listeners registered after the event fires can
    // still detect that ready has happened (cheap belt-and-braces against
    // script-order races on cached-font cold loads).
    document.documentElement.dataset.studioReady = "true";
    document.dispatchEvent(new CustomEvent("studio:ready"));
  }

  // Authoritative ScrollTrigger refresh after the curtain dismisses.
  // The pre-curtain refresh below measures triggers against a scroll-locked
  // body (position:fixed; top:-Y), so trigger ranges are wrong relative to
  // the natural layout. unlockPage() restores body + scroll BEFORE the
  // fade, then bd:intro-complete fires after the fade finishes — by then
  // the layout is correct and we can re-measure. Fires once per document
  // load (whether full curtain, reduced-motion skip, or bfcache recovery).
  document.addEventListener("bd:intro-complete", function onIntroDismissed() {
    if (typeof ScrollTrigger !== "undefined" && typeof ScrollTrigger.refresh === "function") {
      ScrollTrigger.refresh();
    }
  }, { once: true });

  document.fonts.ready
    .then(function () {
      var container = document.querySelector("[data-barba='container']") || document.body;
      window.bdAnimationsInit(container);
      window.bdAnimateElementsIn(container);
      addResizeListener();
      // Refresh BEFORE the curtain dismisses — measurement work happens
      // while the curtain hides any potential flicker. The curtain's own
      // dismiss pipeline waits for this event before fading out.
      if (typeof ScrollTrigger !== "undefined" && typeof ScrollTrigger.refresh === "function") {
        ScrollTrigger.refresh();
      }
      signalStudioReady();
    })
    .catch(function () {
      console.error("bd-animations: font loading error, initializing anyway");
      var container = document.querySelector("[data-barba='container']") || document.body;
      window.bdAnimationsInit(container);
      addResizeListener();
      // Refresh so above-fold `once` reveals (whose start is already passed)
      // fire even if the user never scrolls — fonts may have failed but the
      // layout is still measurable.
      if (typeof ScrollTrigger !== "undefined" && typeof ScrollTrigger.refresh === "function") {
        ScrollTrigger.refresh();
      }
      // Don't strand the curtain on a font failure.
      signalStudioReady();
    });
})();
