/**
 * Script Purpose: Stitchy London — Homepage animations (standout reveal,
 *                 overlapping-tilt Services stack, team flip-card grid).
 *                 Per-section detail lives in each builder's docstring below.
 * Author: Erlen Masson
 * Version: 1.2.0
 * Created: 27 May 2026
 * Last Updated: 28 May 2026
 */

(function () {
  "use strict";

  // Guard: bail (but don't strand the reveal text) if GSAP isn't present.
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.warn("homepage: GSAP/ScrollTrigger not loaded, skipping init");
    document.querySelectorAll(".standout-scene").forEach(function (el) {
      el.style.opacity = "1";
    });
    return;
  }

  console.log("Script - Homepage v1.2.0 (Stitchy)");

  gsap.registerPlugin(ScrollTrigger); // idempotent — safe if bd-animations already registered it

  //
  //------- Configuration -------//
  //

  // Standout timeline knobs (timeline units, not seconds — scrub normalizes the lot).
  var ballDuration = 0.3;       // base travel; per-ball randomised by ballSpeed*
  var ballSpread = 0.12;        // outer→inner start offset (centre leaves LAST, lands at the pin)
  var ballSpeedMin = 0.8;       // each ball's duration = base × [min, max] ⇒ varied speeds
  var ballSpeedMax = 1.4;
  var ballStartJitter = 0.06;   // small random head-start on top of the centre stagger
  var ballEase = "power4.in";   // slow start, accelerating end — try power4.in / expo.in for more extreme

  // Generic N-scene cross-fade knobs — applied to every scene in sequence.
  // Outgoing fade is kept QUICKER than incoming so each scene clears before the
  // next lands (the readability pattern from the old text1/text2 cross-fade).
  var sceneHold = 0.3;          // how long each scene reads before swapping (also the trailing hold)
  var sceneFadeOut = 0.15;      // outgoing scene fade duration
  var sceneFadeIn = 0.4;        // incoming scene fade duration

  // Standout scroll triggers (the reveal is split across two so the balls get a
  // head-start: they part as the section scrolls UP into view, finishing exactly
  // as it pins at the top; the pin then runs the text payoff).
  var ballPreRollStart = "top 37%"; // section-top position where balls START parting, before the pin. Higher % = earlier / bigger head-start.
  var pinScrollLength = "+=80%";   // pinned scroll distance for the text payoff + hold
  var scrubLag = 0;                 // catch-up smoothing (both triggers)

  // Ball grid — desktop / mobile column counts and geometry.
  var colsDesktop = 15;
  var colsMobile = 6;
  var mobileBreakpoint = 768;
  var ballOverlap = 1.8;        // diameter ÷ cell — > 1 so the field reads as solid green
  var ballJitter = 0.25;        // home wander as a fraction of cell; low ⇒ no white gaps

  // Overlapping-tilt stack knobs (the Services [data-bd-stack] panels). The overlap
  // DISTANCE is the CSS var --bd-stack-overlap (single source of truth, shared with
  // the negative-margin layout); these tune the motion layered on top.
  var stackMaxRotation = 1.5;  // deg — each panel gets a random tilt in [-max, +max]; lower = subtler
  var stackRotationCache = []; // random tilts cached per index so they stay put across resize rebuilds
  var stackSpread = 10;        // px — extra initial separation beyond edge-to-edge per panel step
  var stackScale = 1.05;       // grow each panel as it tilts in, to cover the edges the rotation exposes

  // Team polaroid grid — flip-card timing and the position-driven layout pattern.
  // TEAM_LAYOUTS maps photo-position (1-6, indexing the 3x2 grid TL..BR) to the
  // content type each of the six cells holds. Keeps the CMS minimal: each member
  // only stores name/role/fact/main/hover/sticker; the per-person card placement
  // is derived from their grid order, not authored.
  var teamFlipDuration = 0.6;
  var teamFlipStagger = 0.04;
  var teamFlipEase = "power2.inOut";
  var TEAM_LAYOUTS = {
    1: ['photo', 'name',    'sticker', 'blank',   'role',    'fact'   ], // Doug
    2: ['name',  'photo',   'role',    'fact',    'sticker', 'blank'  ], // Ange
    3: ['blank', 'role',    'photo',   'fact',    'sticker', 'name'   ], // Stephanie
    4: ['name',  'blank',   'fact',    'photo',   'role',    'sticker'], // Natalie
    5: ['blank', 'sticker', 'blank',   'name',    'photo',   'role'   ], // Ruth (no fact)
    6: ['fact',  'blank',   'name',    'sticker', 'role',    'photo'  ]  // Colin
  };

  //
  //------- Module State -------//
  //

  var ctx = null;
  var lastViewportWidth = window.innerWidth;
  var resizeTimer = null;

  // Team grid state — single open member at a time. teamWired prevents the
  // resize rebuild from re-adding click/keydown listeners to the same DOM
  // (ctx.revert() only reverts GSAP tweens, not addEventListener calls).
  var teamGridEl = null;
  var activeTeamCell = null;
  var lastFocusedCard = null;
  var teamWired = false;

  //
  //------- Utility Functions -------//
  //

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Random tilt per stacking panel within ±stackMaxRotation. Cached by index so
  // the angle stays put across the resize rebuild (a fresh random each reinit
  // would visibly jump); re-randomises on a new page load.
  function stackRotation(index) {
    if (stackRotationCache[index] === undefined) {
      stackRotationCache[index] = (Math.random() * 2 - 1) * stackMaxRotation;
    }
    return stackRotationCache[index];
  }

  // Build the green-ball field into the (empty) ball layer. Uniform diameter,
  // scattered on a jittered grid with deliberate overlap. Returns the ball
  // descriptors + the shared diameter so the caller can set initial sizes.
  function buildStandoutBalls(ballLayer) {
    // Rebuild from scratch each init so resizes don't accumulate balls.
    ballLayer.innerHTML = "";

    var rect = ballLayer.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w === 0 || h === 0) return { balls: [], size: 0 };

    // More, smaller balls; fewer columns on narrow viewports.
    var targetCols = w < mobileBreakpoint ? colsMobile : colsDesktop;
    var cell = w / targetCols;
    // Diameter well over the cell so the field reads as solid green even with
    // jitter — circles only tile gap-free with generous overlap.
    var size = cell * ballOverlap;
    var rows = Math.ceil(h / cell);
    var jitter = cell * ballJitter; // small wander; kept low so no white gaps open up

    var cx = w / 2;
    var cy = h / 2;
    var maxDist = Math.hypot(cx, cy) || 1;
    // Diagonal basis so every bearing clears the viewport on any aspect ratio,
    // with headroom for a moderate viewport-height growth between rebuilds.
    var exitDist = Math.hypot(w, h) * 1.4 + size;

    var balls = [];
    var frag = document.createDocumentFragment();

    // One extra ring of balls beyond each edge so coverage is complete.
    for (var r = -1; r <= rows; r++) {
      for (var c = -1; c <= targetCols; c++) {
        var el = document.createElement("div");
        el.className = "standout-ball";

        // Cell centre minus half a ball (top-left origin) + random jitter.
        var homeX = c * cell + cell / 2 - size / 2 + (Math.random() * 2 - 1) * jitter;
        var homeY = r * cell + cell / 2 - size / 2 + (Math.random() * 2 - 1) * jitter;

        // Exit bearing = this ball's centre relative to the stage centre.
        var dx = homeX + size / 2 - cx;
        var dy = homeY + size / 2 - cy;
        var d = Math.hypot(dx, dy);
        var ux, uy;
        if (d < 1) {
          var a = Math.random() * Math.PI * 2; // dead-centre ⇒ random bearing
          ux = Math.cos(a);
          uy = Math.sin(a);
        } else {
          ux = dx / d;
          uy = dy / d;
        }

        balls.push({
          el: el,
          homeX: homeX,
          homeY: homeY,
          exitX: homeX + ux * exitDist,
          exitY: homeY + uy * exitDist,
          norm: Math.min(d / maxDist, 1), // 0 = centre, 1 = corner
          // Per-ball motion variation → some lag behind, some shoot ahead.
          speed: ballSpeedMin + Math.random() * (ballSpeedMax - ballSpeedMin),
          startJitter: Math.random() * ballStartJitter
        });
        frag.appendChild(el);
      }
    }

    ballLayer.appendChild(frag);
    return { balls: balls, size: size };
  }

  //
  //------- Main Functions -------//
  //

  // Wire one .section-standout: discover scenes, build the balls, and chain the
  // pinned scene cross-fades. GSAP targets scene WRAPPERS (.standout-scene) only,
  // not their contents — so any HTML inside a scene (headings, stickers, CTAs,
  // images) cross-fades with the wrapper, and adding scene 3, 4, N is pure HTML.
  function buildStandoutSection(section) {
    var stage = section.querySelector(".standout-stage");
    var ballLayer = section.querySelector(".standout-balls");
    var scenes = section.querySelectorAll(".standout-scene");
    if (!stage || !ballLayer || scenes.length === 0) return;

    var scene1 = scenes[0];
    var laterScenes = Array.prototype.slice.call(scenes, 1);

    // Reduced motion → static stacked fallback (CSS .is-static); no pin/balls.
    if (prefersReducedMotion()) {
      section.classList.add("is-static");
      ballLayer.innerHTML = ""; // clear any balls from a motion-enabled rebuild
      gsap.set(scenes, { autoAlpha: 1, clearProps: "transform" });
      return;
    }
    section.classList.remove("is-static");

    var built = buildStandoutBalls(ballLayer);
    var balls = built.balls;
    if (!balls.length) return;

    // Initial states.
    balls.forEach(function (b) {
      gsap.set(b.el, { width: built.size, height: built.size, x: b.homeX, y: b.homeY });
    });
    // Scene 1 is fully present from the start — the balls clearing IS its reveal
    // (it sits under the ball layer; no fade of its own). Later scenes start
    // invisible + slightly down, ready to cross-fade in over scene 1 in sequence.
    gsap.set(scene1, { autoAlpha: 1 });
    if (laterScenes.length) gsap.set(laterScenes, { autoAlpha: 0, y: 30 });

    // Trigger 1 — ball motion, NOT pinned. Runs as the section scrolls up into
    // view and finishes exactly at "top top", so the reveal is already underway
    // by the time the section pins. Ending at "top top" keeps this whole range in
    // pre-pin space (the pin spacer never sits inside it), so ball timing stays
    // independent of the pin distance.
    var ballsTl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: ballPreRollStart,
        end: "bottom 80%",
        scrub: scrubLag,
        invalidateOnRefresh: true,
        onToggle: function (st) {
          // Promote ball layers to their own compositor layer only while moving.
          ballLayer.classList.toggle("is-active", st.isActive);
        }
      }
    });

    // Centre-LAST stagger: corner balls (b.norm = 1) leave first, centre balls
    // (b.norm = 0) leave last — so the central clearing (which uncovers scene 1)
    // lands exactly at the pin moment. Each ball runs at its own randomised speed
    // + tiny head-start for organic motion.
    balls.forEach(function (b) {
      ballsTl.to(
        b.el,
        { x: b.exitX, y: b.exitY, ease: ballEase, duration: ballDuration * b.speed },
        (1 - b.norm) * ballSpread + b.startJitter
      );
    });

    // Trigger 2 — pin at "top top" for the scene payoff. By now the balls are
    // gone and scene 1 is fully revealed. refreshPriority keeps the pin (which
    // inserts a spacer) measuring before any later/global refresh.
    var textTl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: pinScrollLength,
        pin: section,
        scrub: scrubLag,
        invalidateOnRefresh: true,
        refreshPriority: 1
      }
    });

    // Generic N-scene chain: hold the current scene, then cross-fade the next
    // one in over it (outgoing scene's fade-out runs quicker than the incoming
    // fade-in so the previous clears before the next lands), then hold the new
    // scene. Trailing hold on the last scene before the section releases.
    var currentScene = scene1;
    textTl.to({}, { duration: sceneHold });
    laterScenes.forEach(function (nextScene) {
      textTl.to(currentScene, { autoAlpha: 0, ease: "power2.in",  duration: sceneFadeOut }, ">");
      textTl.to(nextScene,    { autoAlpha: 1, y: 0, ease: "power2.out", duration: sceneFadeIn }, "<");
      textTl.to({}, { duration: sceneHold });
      currentScene = nextScene;
    });
  }

  // Wire one [data-bd-stack]: the resting overlap is real CSS layout (each panel
  // after the first has margin-top: -(--bd-stack-overlap)), so the section height
  // is compact — no bottom gap, and the pinned standout below measures a stable
  // layout. This animates only the DEVIATION: each panel starts pushed down
  // (cancelling the cumulative negative margin + extra stackSpread, so it looks
  // non-overlapped) and slides to y:0 (its overlapped rest) while tilting + scaling
  // in. Scrubbed as the section enters; all panels stay visible.
  function buildStackSection(stack) {
    // Reduced motion → plain stacked blocks. The CSS overlap margin is gated to
    // prefers-reduced-motion: no-preference, so there's nothing to undo here.
    if (prefersReducedMotion()) return;

    var cards = Array.prototype.slice.call(stack.children);
    if (!cards.length) return;

    // Overlap distance is the CSS single source of truth (--bd-stack-overlap).
    var overlap = parseFloat(getComputedStyle(stack).getPropertyValue("--bd-stack-overlap")) || 50;
    var fromY = function (i) { return i * (overlap + stackSpread); };

    // Paint the from-state immediately so there's no flash before the first tick.
    cards.forEach(function (card, i) {
      gsap.set(card, { y: fromY(i) });
    });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: stack,
        start: "top 95%", // just as the section enters
        end: "top 40%",   // settled while comfortably on screen
        scrub: 1,         // soft, smooth catch-up
        invalidateOnRefresh: true,
        onToggle: function (st) {
          gsap.set(cards, { willChange: st.isActive ? "transform" : "auto" });
        }
      }
    });

    cards.forEach(function (card, i) {
      tl.fromTo(
        card,
        { y: fromY(i), rotation: 0, scale: 1 },
        {
          y: 0, // settle into the real, CSS-overlapped resting position
          rotation: stackRotation(i),
          scale: stackScale,
          ease: "none"
        },
        0 // all panels converge together
      );
    });
  }

  // Wire one [data-team-grid]: cells already carry their content via data-
  // attributes (CMS-friendly), so this function only handles INTERACTION — click
  // to open, click open card / × / ESC to close. The visual flip is GSAP
  // rotateY on the inner .team-card; the active member's cell does NOT flip.
  function buildTeamSection(grid) {
    if (teamWired) return; // idempotent across resize rebuilds
    teamGridEl = grid;
    var cells = Array.prototype.slice.call(grid.querySelectorAll('.team-cell'));
    if (!cells.length) return;

    cells.forEach(function (cell) {
      var card = cell.querySelector('.team-card');
      var close = cell.querySelector('.team-cell-close');
      if (card) {
        card.addEventListener('click', function () {
          // Any click on a card while another member is open closes — keeps
          // the model simple: the only open path is from the browse state.
          if (activeTeamCell) {
            closeMember();
            return;
          }
          activateMember(cell);
        });
      }
      if (close) {
        close.addEventListener('click', function (e) {
          // Stop the click bubbling to the underlying card button when × is
          // clicked on the active cell.
          e.stopPropagation();
          closeMember();
        });
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && activeTeamCell) closeMember();
    });

    teamWired = true;
  }

  // Open one member: populate the five non-active back faces from the clicked
  // member's data, set state classes, move focus to the close button, then run
  // the staggered rotateY flip on the inner cards. Reduced motion skips GSAP
  // and lets the CSS @media block cross-fade the faces via opacity.
  function activateMember(cell) {
    if (!teamGridEl) return;
    var position = parseInt(cell.dataset.position, 10);
    var layout = TEAM_LAYOUTS[position];
    if (!layout) return;

    var data = {
      name:    cell.dataset.name    || '',
      role:    cell.dataset.role    || '',
      fact:    cell.dataset.fact    || '',
      sticker: cell.dataset.sticker || ''
    };

    var cells = Array.prototype.slice.call(teamGridEl.querySelectorAll('.team-cell'));
    var nonActiveCards = [];

    cells.forEach(function (other) {
      if (other === cell) return;
      var otherPos = parseInt(other.dataset.position, 10);
      var type = layout[otherPos - 1];
      var back = other.querySelector('.team-face-back');
      var front = other.querySelector('.team-face-front');
      if (back) {
        back.innerHTML = fillBackFace(type, data);
        back.setAttribute('aria-hidden', 'false');
      }
      if (front) front.setAttribute('aria-hidden', 'true');
      nonActiveCards.push(other.querySelector('.team-card'));
    });

    activeTeamCell = cell;
    cell.classList.add('is-active');
    lastFocusedCard = cell.querySelector('.team-card');
    teamGridEl.classList.add('is-open');

    var activeClose = cell.querySelector('.team-cell-close');
    if (activeClose) {
      activeClose.setAttribute('aria-label', 'Close team member ' + data.name);
      activeClose.focus();
    }

    if (prefersReducedMotion()) {
      cells.forEach(function (other) {
        if (other !== cell) other.classList.add('is-flipped');
      });
      return;
    }

    gsap.to(nonActiveCards, {
      rotationY: 180,
      duration: teamFlipDuration,
      stagger: teamFlipStagger,
      ease: teamFlipEase,
      onComplete: function () {
        // Lock in the flipped state with the class so the CSS rule holds the
        // rotation even after any later GSAP cleanup.
        cells.forEach(function (other) {
          if (other !== cell) other.classList.add('is-flipped');
        });
      }
    });
  }

  // Close the open member: animate flips back to 0, then clear DOM state,
  // restore aria, return focus to the previously-active card. Pass immediate
  // = true to bypass the animation (used internally if needed).
  function closeMember(immediate) {
    if (!activeTeamCell || !teamGridEl) return;
    var closingCell = activeTeamCell;
    var cells = Array.prototype.slice.call(teamGridEl.querySelectorAll('.team-cell'));

    function finish() {
      cells.forEach(function (other) {
        if (other === closingCell) return;
        var back = other.querySelector('.team-face-back');
        var front = other.querySelector('.team-face-front');
        if (back) {
          back.innerHTML = '';
          back.setAttribute('aria-hidden', 'true');
        }
        if (front) front.setAttribute('aria-hidden', 'false');
        other.classList.remove('is-flipped');
      });
      var closingCloseBtn = closingCell.querySelector('.team-cell-close');
      if (closingCloseBtn) {
        closingCloseBtn.setAttribute('aria-label', 'Close team member');
      }
      closingCell.classList.remove('is-active');
      teamGridEl.classList.remove('is-open');
      if (lastFocusedCard) lastFocusedCard.focus();
      activeTeamCell = null;
    }

    if (immediate === true || prefersReducedMotion()) {
      finish();
      return;
    }

    var nonActiveCards = cells
      .filter(function (other) { return other !== closingCell; })
      .map(function (other) { return other.querySelector('.team-card'); });

    gsap.to(nonActiveCards, {
      rotationY: 0,
      duration: teamFlipDuration,
      stagger: teamFlipStagger,
      ease: teamFlipEase,
      onComplete: function () {
        gsap.set(nonActiveCards, { clearProps: 'transform' });
        finish();
      }
    });
  }

  // Map a content type to the back-face HTML. 'photo' / 'blank' (and any
  // unknown type) render empty so the white card itself reads as the blank
  // beat. Text is escape-routed through textContent to keep CMS-bound strings
  // safe from accidental HTML.
  function fillBackFace(type, data) {
    switch (type) {
      case 'name':
        return '<h3 class="team-back-name">' + escapeHtml(data.name) + '</h3>';
      case 'role':
        return '<p class="team-back-role">' + escapeHtml(data.role) + '</p>';
      case 'fact':
        return data.fact ? '<p class="team-back-fact">' + escapeHtml(data.fact) + '</p>' : '';
      case 'sticker':
        return data.sticker ? '<img class="team-back-sticker" src="' + escapeAttr(data.sticker) + '" alt="" />' : '';
      case 'photo':
      case 'blank':
      default:
        return '';
    }
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = String(s == null ? '' : s);
    return div.innerHTML;
  }

  // Tighter escape for an attribute value — quotes and angle brackets are the
  // ones that break out of an attribute context.
  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Initialise the standout reveal(s) AND the overlapping-tilt stack(s) inside one
  // gsap.context so every tween, ScrollTrigger and pin-spacer is reclaimed by
  // ctx.revert() on rebuild.
  function initHomepage() {
    var standouts = gsap.utils.toArray(".section-standout");
    var stacks = gsap.utils.toArray("[data-bd-stack]");
    var teamGrid = document.querySelector("[data-team-grid]");
    if (!standouts.length && !stacks.length && !teamGrid) return;

    ctx = gsap.context(function () {
      standouts.forEach(buildStandoutSection);
      stacks.forEach(buildStackSection);
      if (teamGrid) buildTeamSection(teamGrid);
    });
  }

  // Tear down and rebuild — balls and pin distances are pixel-measured, so a
  // genuine width change needs fresh geometry.
  function rebuildHomepage() {
    if (ctx) {
      ctx.revert();
      ctx = null;
    }
    initHomepage();
    ScrollTrigger.refresh();
  }

  //
  //------- Event Listeners -------//
  //

  // Width-only resize → rebuild. Height-only changes (mobile URL bar showing/
  // hiding) are ignored so the field doesn't churn mid-scroll.
  function handleResize() {
    var width = window.innerWidth;
    if (width === lastViewportWidth) return;
    lastViewportWidth = width;
    rebuildHomepage();
  }

  function setupEventListeners() {
    window.addEventListener("resize", function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 200);
    });
  }

  //
  //------- Initialize -------//
  //

  // Init after fonts settle so the pinned section measures against final layout
  // (mirrors bd-animations.js; its global ScrollTrigger.refresh calls also keep
  // these triggers correct after the loading-screen curtain dismisses).
  document.fonts.ready
    .then(function () {
      initHomepage();
      setupEventListeners();
    })
    .catch(function () {
      console.error("homepage: font loading error, initializing anyway");
      initHomepage();
      setupEventListeners();
    });
})();
