# Stitchy London — Website

Custom CSS/JavaScript layer for the Stitchy London website, a Webflow build. Stitchy is a strategy-led social agency, shaped by social and grounded in marketing science. This repo holds the shipped front-end code and the design-system authoring environment behind it.

## What this is

- A **Webflow project** — Webflow owns page structure, base layout, and the CMS
- Our work is the **custom layer on top**: GSAP-driven motion (JavaScript) first, then CSS
- A **design system** (tokens, utility classes, components) used as the authoring and reference environment
- A **brand book** for visual identity (fonts, colours, logo)
- Documented **best practices** for CSS, JavaScript, and HTML

## Code delivery

Shipped CSS/JS is committed to the public GitHub repo and served to Webflow via the jsDelivr CDN:

- **Repo:** https://github.com/bydefaultstudio/stitchy-london
- **CDN pattern:**
  ```
  https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/css/<file>.css
  https://cdn.jsdelivr.net/gh/bydefaultstudio/stitchy-london@main/assets/js/<file>.js
  ```

Only `assets/` is published (see `.gitignore`). Everything else — docs, design system, brand book, briefs — stays local.

## Getting started

1. Review `PROJECT_BRIEF.md` for project goals and requirements
2. Follow the [Setup guide](docs/site/setup.html) to customise brand colours, fonts, and logo
3. Explore the [Documentation](docs/site/index.html) for design system details
4. Check the [Design System Styleguide](styleguide.html) for available patterns
5. Check the [Brand Book](brand-book/index.html) for the current brand identity
6. Build per-page modules in `assets/js/` and `assets/css/`

## Documentation

Complete documentation is available in the [Documentation site](docs/site/index.html):

- **Design System** — Colour, typography, spacing, borders, components
- **Code Structure** — CSS and JavaScript organisation patterns
- **HTML Layout** — Page structure and layout primitives
- **Content** — Markdown style and SEO best practices
- **Project** — Setup, folder structure, and project overview

---

Built by **By Default Studio** — [bydefault.studio](https://bydefault.studio)
