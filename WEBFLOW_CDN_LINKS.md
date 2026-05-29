---
Global Header
---

<!-- JS-Available Guard -->
<script>document.documentElement.classList.add("js");</script>

<!-- Theme Flash Prevention -->
<script>
(function() {
  const theme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const active = theme || (prefersDark ? 'dark' : 'light');
  document.documentElement.className = document.documentElement.className.replace(/u-theme-\w+/g, '');
  document.documentElement.classList.add(`u-theme-${active}`);
})();
</script>

<!-- Viewport -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<!-- Inline Tweaks -->
<style>
  * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  .w-editor .custom-cursor-active * { cursor: auto !important; }
  .custom-arrows svg { width: 24px; height: 24px; fill: var(--_semantic---text--text-primary); }
  .grecaptcha-badge { box-shadow: none !important; background: transparent !important; padding: 0 !important; border: none !important; width: auto !important; height: auto !important; bottom: auto !important; right: auto !important; }
</style>

<!-- Splide CSS -->
<link rel="preload" href="https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.3/dist/css/splide.min.css" as="style" onload="this.onload=null;this.rel='stylesheet';">

<!-- Stitchy Styles -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/css/style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/css/bd-animations.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/css/bd-cursor.css">

<!-- Custom Cursor Token Bridge -->
<style>
  :root {
    --text-accent: var(--_semantic---cursor-primary);
    --white: var(--_semantic---cursor-secondary);
    --alpha-5: transparent 95%;
    --alpha-10: transparent 90%;
    --alpha-20: transparent 80%;
    --alpha-50: transparent 50%;
    --alpha-90: transparent 10%;
  }
</style>


---
Global Footer
---

<!-- GSAP -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/SplitText.min.js"></script>

<!-- Lottie -->
<script src="https://cdn.jsdelivr.net/npm/lottie-web@5/build/player/lottie_light.min.js"></script>

<!-- Custom Cursor -->
<script>window.BD_CURSOR_SPRITE = "https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/images/svg-icons/_sprite.svg";</script>
<script src="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/js/bd-cursor.js"></script>
<div class="cursor-label" aria-hidden="true">
  <div class="cursor-label-icon cursor-label-icon-lead"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="100%" height="100%"><use href="#plus"/></svg></div>
  <span class="cursor-label-text"></span>
  <div class="cursor-label-icon cursor-label-icon-end"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="100%" height="100%"><use href="#plus"/></svg></div>
</div>
<div class="cursor-halo" aria-hidden="true"></div>

<!-- BD Animations -->
<script src="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/js/bd-animations.js"></script>

<!-- Site Loader -->
<script src="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/js/site-loader.js"></script>


---
Homepage Footer
---

<!-- Homepage Scripts -->
<script src="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/js/homepage.js"></script>


---
Our Science Footer
---

<!-- Matter.js -->
<script src="https://cdn.jsdelivr.net/npm/matter-js@0.20/build/matter.min.js"></script>

<!-- Our Science Scripts -->
<script src="https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/js/our-science.js"></script>
