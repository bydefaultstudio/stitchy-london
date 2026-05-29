/**
 * Script Purpose: Stitchy London — Our Science page animations
 * Author: Erlen Masson
 * Version: 0.2.0
 * Created: 28 May 2026
 * Last Updated: 29 May 2026
 */

(function () {
  "use strict";

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.warn("our-science: GSAP/ScrollTrigger not loaded, skipping init");
    return;
  }

  console.log("Script - Our Science v0.2.0 (Stitchy)");

  gsap.registerPlugin(ScrollTrigger);

  //
  //------- Configuration -------//
  //

  // Tuning knobs for the Six Things physics canvas. Edit values only.
  var sixOrbConfig = {
    sizeFromWidth: 4,    // diameter cap from canvas width
    sizeFromHeight: 3,   // diameter cap from canvas height
    minDiameter: 40,     // touch-target floor in px
    paddingToken: "--six-things-padding", // CSS variable on .six-things-canvas; tune the rule in style.css
    restitution: 0.8,    // bounce (0 = thud, 1 = rubber)
    friction: 0.1,       // surface friction between bodies
    frictionAir: 0.012,  // air drag, slows balls over time
    density: 0.001,      // mass per area, affects throw weight
    gravity: 1.3,        // fall speed (1 = Matter default, higher = punchier impacts)
  };

  //
  //------- Main Functions -------//
  //

  var ctx = null;

  // Init/rebuild the page's animation context. Called on fonts.ready and
  // on width-change resizes (height jitter is ignored).
  function initOurScience() {
    if (ctx) {
      ctx.revert();
      ctx = null;
    }

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    ctx = gsap.context(function () {
      if (!reduce) {
        buildHeroIntro();
        buildIntroStickers();
        buildLongGameReveal();
      }
      // Six Things always runs — picks physics vs static fallback internally.
      var teardownSixOrbs = buildSixOrbs(reduce);
      return function cleanup() {
        if (teardownSixOrbs) teardownSixOrbs();
      };
    });
  }

  // Hero portrait / book-sticker entrance (Phase 2).
  function buildHeroIntro() {
    var hero = document.querySelector(".science-hero");
    if (!hero) return;
  }

  // Scroll-scrubbed "01" and coffee-cup sticker reveals (Phase 2).
  function buildIntroStickers() {
    var intro = document.querySelector(".science-intro");
    if (!intro) return;
  }

  // "ONG" rectangle reveal on the long-game headline (Phase 2).
  function buildLongGameReveal() {
    var section = document.querySelector(".science-longgame");
    if (!section) return;
  }

  //
  //------- Six Things — physics-driven fact picker -------//
  //

  // Drops six numbered orbs into the canvas with Matter.js. Orbs collide,
  // drag/throw on pointer or touch, and clicking one swaps the right-side
  // fact. Returns a teardown function for the gsap.context revert.
  function buildSixOrbs(reduce) {
    var section = document.querySelector(".six-things-section");
    if (!section) return null;

    var canvas = section.querySelector("[data-six-orbs]");
    var orbEls = section.querySelectorAll(".science-orb");
    var panel = section.querySelector("[data-six-panel]");
    var panelTitle = section.querySelector("[data-six-panel-title]");
    var panelBody = section.querySelector("[data-six-panel-body]");
    var panelNumber = section.querySelector("[data-six-panel-number]");
    var sourceEls = section.querySelectorAll("[data-six-source] [data-fact-id]");
    if (!canvas || !orbEls.length || !panel || !panelTitle || !panelBody || !panelNumber || !sourceEls.length) {
      return null;
    }

    var facts = new Map();
    sourceEls.forEach(function (el) {
      facts.set(el.getAttribute("data-fact-id"), {
        title: el.getAttribute("data-fact-title") || "",
        body: el.getAttribute("data-fact-body") || "",
      });
    });

    // Resolve canvas padding from a CSS variable (e.g. clamp() in style.css).
    // Probe element lets the browser compute whatever the variable resolves
    // to (clamp / vw / rem / calc) down to a pixel value.
    function computePadding() {
      var probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;visibility:hidden;width:var(" +
        sixOrbConfig.paddingToken +
        ");";
      canvas.appendChild(probe);
      var pad = parseFloat(getComputedStyle(probe).width) || 0;
      probe.remove();
      return pad;
    }

    // Single source of truth for active orb + right-panel content.
    // dataset.activeOrb persists across width-change rebuilds.
    function setActive(id, animate) {
      var stringId = String(id);
      var fact = facts.get(stringId);
      if (!fact) return;
      var target = null;
      orbEls.forEach(function (orb) {
        var isMatch = orb.getAttribute("data-orb-id") === stringId;
        orb.setAttribute("data-active", isMatch ? "true" : "false");
        orb.setAttribute("aria-pressed", isMatch ? "true" : "false");
        if (isMatch) target = orb;
      });
      if (!target) return;
      section.dataset.activeOrb = stringId;

      var apply = function () {
        panelTitle.textContent = fact.title;
        panelBody.textContent = fact.body;
        panelNumber.textContent = stringId;
      };

      if (animate && !reduce) {
        gsap.to(panel, {
          opacity: 0,
          duration: 0.18,
          ease: "power2.in",
          onComplete: function () {
            apply();
            gsap.to(panel, { opacity: 1, duration: 0.18, ease: "power2.out" });
          },
        });
      } else {
        apply();
      }
    }

    var initialId = section.dataset.activeOrb || "1";

    // Reduced motion: no physics, plain DOM clicks; CSS reverts canvas to a flex row.
    if (reduce) {
      var reducedHandlers = [];
      orbEls.forEach(function (orb) {
        var handler = function () {
          setActive(orb.getAttribute("data-orb-id"), false);
        };
        orb.addEventListener("click", handler);
        reducedHandlers.push({ orb: orb, handler: handler });
      });
      setActive(initialId, false);
      return function teardownReduced() {
        reducedHandlers.forEach(function (entry) {
          entry.orb.removeEventListener("click", entry.handler);
        });
      };
    }

    // Matter not loaded: clickable static orbs.
    if (typeof Matter === "undefined") {
      console.warn("our-science: Matter.js not loaded, six orbs fall back to static");
      var fallbackHandlers = [];
      orbEls.forEach(function (orb) {
        var handler = function () {
          setActive(orb.getAttribute("data-orb-id"), true);
        };
        orb.addEventListener("click", handler);
        fallbackHandlers.push({ orb: orb, handler: handler });
      });
      setActive(initialId, false);
      return function teardownFallback() {
        fallbackHandlers.forEach(function (entry) {
          entry.orb.removeEventListener("click", entry.handler);
        });
      };
    }

    //------- Physics path -------//

    var Engine = Matter.Engine;
    var World = Matter.World;
    var Bodies = Matter.Bodies;
    var Mouse = Matter.Mouse;
    var MouseConstraint = Matter.MouseConstraint;
    var Query = Matter.Query;

    var rect = canvas.getBoundingClientRect();
    var width = rect.width;
    var height = rect.height;

    // Uniform diameter from the canvas's actual width × height (NOT viewport vw).
    var orbSize = Math.max(
      sixOrbConfig.minDiameter,
      Math.min(width / sixOrbConfig.sizeFromWidth, height / sixOrbConfig.sizeFromHeight)
    );
    orbEls.forEach(function (orb) {
      orb.style.setProperty("--orb-size", orbSize + "px");
    });

    // enableSleeping stops settled balls from jittering at high restitution.
    var engine = Engine.create({ enableSleeping: true });
    engine.positionIterations = 10;
    engine.velocityIterations = 8;
    engine.gravity.y = 0;

    // Walls inset by padding; no ceiling so orbs drop in from above.
    // Padding value comes from CSS — see --six-things-padding in style.css.
    var pad = computePadding();
    var wallThickness = 200;
    var floor = Bodies.rectangle(
      width / 2,
      height - pad + wallThickness / 2,
      width + wallThickness * 4,
      wallThickness,
      { isStatic: true }
    );
    var leftWall = Bodies.rectangle(
      pad - wallThickness / 2,
      height / 2,
      wallThickness,
      height * 4,
      { isStatic: true }
    );
    var rightWall = Bodies.rectangle(
      width - pad + wallThickness / 2,
      height / 2,
      wallThickness,
      height * 4,
      { isStatic: true }
    );
    World.add(engine.world, [floor, leftWall, rightWall]);

    var r = orbSize / 2;
    var innerWidth = Math.max(orbSize, width - pad * 2);
    var orbBodies = [];
    var orbByBodyId = new Map();
    orbEls.forEach(function (orb, i) {
      var x = pad + (i + 0.5) * (innerWidth / orbEls.length);
      var y = -r * 2 - i * 40;
      var body = Bodies.circle(x, y, r, {
        restitution: sixOrbConfig.restitution,
        friction: sixOrbConfig.friction,
        frictionAir: sixOrbConfig.frictionAir,
        density: sixOrbConfig.density,
      });
      World.add(engine.world, body);
      orbBodies.push(body);
      orbByBodyId.set(body.id, orb);
      // Seed the transform so orbs don't flash at (0,0) before the first tick.
      orb.style.transform =
        "translate3d(" + (x - r) + "px, " + (y - r) + "px, 0)";
    });

    var mouse = Mouse.create(canvas);
    // Matter 0.20 preventDefaults wheel events — detach so the page can scroll over the canvas.
    canvas.removeEventListener("wheel", mouse.mousewheel);
    canvas.removeEventListener("mousewheel", mouse.mousewheel);
    canvas.removeEventListener("DOMMouseScroll", mouse.mousewheel);
    var mc = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    World.add(engine.world, mc);

    // Click vs drag: pointerup within 6px and 250ms of pointerdown on the same body.
    var pointerStart = null;
    function onPointerDown(e) {
      var r2 = canvas.getBoundingClientRect();
      var px = e.clientX - r2.left;
      var py = e.clientY - r2.top;
      var hit = Query.point(orbBodies, { x: px, y: py })[0];
      pointerStart = {
        x: px,
        y: py,
        t: performance.now(),
        bodyId: hit ? hit.id : null,
      };
    }
    function onPointerUp(e) {
      if (!pointerStart) return;
      var r2 = canvas.getBoundingClientRect();
      var px = e.clientX - r2.left;
      var py = e.clientY - r2.top;
      var dx = px - pointerStart.x;
      var dy = py - pointerStart.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var dt = performance.now() - pointerStart.t;
      if (pointerStart.bodyId && dist < 6 && dt < 250) {
        var orb = orbByBodyId.get(pointerStart.bodyId);
        if (orb) setActive(orb.getAttribute("data-orb-id"), true);
      }
      pointerStart = null;
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Keyboard activation — Enter/Space dispatches a click with detail === 0.
    // Pointer clicks (detail >= 1) are handled above; ignore them here.
    var keyHandlers = [];
    orbEls.forEach(function (orb) {
      var handler = function (e) {
        if (e.detail !== 0) return;
        setActive(orb.getAttribute("data-orb-id"), true);
      };
      orb.addEventListener("click", handler);
      keyHandlers.push({ orb: orb, handler: handler });
    });

    // Run physics + DOM sync in the SAME rAF tick (Matter.Runner would lag by one frame).
    var simRunning = false;
    function tick(time, deltaTime) {
      // Clamp dt so a backgrounded tab return doesn't teleport the sim.
      var dt = Math.min(deltaTime || 16.6, 33.3);
      if (simRunning) Engine.update(engine, dt);
      orbBodies.forEach(function (body) {
        var orb = orbByBodyId.get(body.id);
        if (!orb) return;
        var r2 = body.circleRadius;
        orb.style.transform =
          "translate3d(" +
          (body.position.x - r2) +
          "px, " +
          (body.position.y - r2) +
          "px, 0) rotate(" +
          body.angle +
          "rad)";
      });
    }
    gsap.ticker.add(tick);

    setActive(initialId, false);

    // Drop + gravity start when the section enters the viewport.
    ScrollTrigger.create({
      trigger: section,
      start: "top 80%",
      once: true,
      onEnter: function () {
        engine.gravity.y = sixOrbConfig.gravity;
        simRunning = true;
      },
    });

    // gsap.context handles tweens + ScrollTriggers; everything outside GSAP
    // (DOM listeners, Matter, ticker, inline styles) is manual.
    return function teardownPhysics() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      keyHandlers.forEach(function (entry) {
        entry.orb.removeEventListener("click", entry.handler);
      });
      gsap.ticker.remove(tick);
      Mouse.clearSourceEvents(mouse);
      World.clear(engine.world, false);
      Engine.clear(engine);
      orbEls.forEach(function (orb) {
        orb.style.transform = "";
        orb.style.removeProperty("--orb-size");
      });
    };
  }

  //
  //------- Initialize -------//
  //

  // Rebuild on width-change resizes only; ignore mobile address-bar jitter.
  var lastWidth = window.innerWidth;
  function handleResize() {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    initOurScience();
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  }
  window.addEventListener("resize", handleResize);

  // Wait for fonts so SplitText measurements are correct.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(initOurScience);
  } else {
    initOurScience();
  }
})();
