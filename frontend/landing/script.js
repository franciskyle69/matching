function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(function initPageIntro() {
  const intro = document.getElementById("page-intro");
  if (!intro) return;

  if (prefersReducedMotion()) {
    intro.remove();
    return;
  }

  const displayMs = 850;
  const exitMs = 450;

  window.setTimeout(() => {
    intro.classList.add("is-exit");
    window.setTimeout(() => intro.remove(), exitMs);
  }, displayMs);
})();

(function ensureHeroHashOnLanding() {
  if (window.location.pathname !== "/") return;
  if (window.location.hash) return;
  // Keep root visits anchored to the hero section URL.
  window.history.replaceState(null, "", "/#hero");
})();

(function initSiteNavScroll() {
  const nav = document.getElementById("site-nav");
  const hero = document.getElementById("hero");
  if (!nav) return;

  if (hero) {
    const io = new IntersectionObserver(
      ([entry]) => {
        nav.classList.toggle("site-nav--solid", !entry.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(hero);
  }

  // Active section pill highlight & smooth sliding indicator
  const track = document.getElementById("nav-pill-track");
  const indicator = document.getElementById("nav-pill-indicator");

  function updateNavIndicator() {
    if (!track || !indicator) return;
    const activeLink = track.querySelector(".nav-link-pill.is-active");
    if (!activeLink) {
      indicator.style.opacity = "0";
      return;
    }
    const trackRect = track.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const left = linkRect.left - trackRect.left;
    const width = linkRect.width;

    indicator.style.opacity = "1";
    indicator.style.transform = `translate3d(${Math.round(left)}px, 0, 0)`;
    indicator.style.width = `${Math.round(width)}px`;
  }

  const sections = ["hero", "features", "how", "footer-contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navLinks = nav.querySelectorAll(".nav-link, .nav-link-pill");

  if (sections.length && navLinks.length) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach((link) => {
              const href = link.getAttribute("href") || "";
              link.classList.toggle("is-active", href === `#${id}`);
            });
            updateNavIndicator();
          }
        });
      },
      { threshold: 0.35, rootMargin: "-80px 0px -40% 0px" },
    );
    sections.forEach((sec) => sectionObserver.observe(sec));

    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (href && href.startsWith("#")) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            navLinks.forEach((l) => l.classList.remove("is-active"));
            link.classList.add("is-active");
            updateNavIndicator();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            if (window.history.pushState) {
              window.history.pushState(null, "", href);
            }
          }
        }
      });
    });

    window.addEventListener("resize", updateNavIndicator, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateNavIndicator);
    }
    requestAnimationFrame(updateNavIndicator);
    window.setTimeout(updateNavIndicator, 60);
    window.setTimeout(updateNavIndicator, 300);
  }
})();

(function initScrollReveal() {
  const els = document.querySelectorAll("[data-reveal]");
  if (!els.length) return;
  if (prefersReducedMotion()) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -32px 0px" },
  );
  els.forEach((el) => obs.observe(el));
})();

(function initHeroParallax() {
  const hero = document.getElementById("hero");
  const bg = document.querySelector(".hero-space-bg");
  if (!hero || !bg) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let rafId = null;
  const maxTranslateY = 18; // px

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function update() {
    rafId = null;
    const heroTop = hero.offsetTop;
    const heroHeight = hero.offsetHeight || 1;
    const t = clamp((window.scrollY - heroTop) / heroHeight, 0, 1);
    const translateY = -t * maxTranslateY;
    bg.style.transform = `translate3d(0, ${Math.round(translateY)}px, 0)`;
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  update();
})();

(function initActiveSectionNav() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;

  const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
  const sections = links
    .map((a) => {
      const href = a.getAttribute("href") || "";
      const id = href.startsWith("#") ? href.slice(1) : "";
      if (!id) return null;
      return document.getElementById(id);
    })
    .filter(Boolean);

  if (!links.length || !sections.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      // Pick the most visible intersecting section.
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort(
          (a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0),
        )[0];
      if (!visible) return;

      const activeId = visible.target.id;
      const activeHref = `#${activeId}`;
      links.forEach((a) => {
        a.classList.toggle("is-active", a.getAttribute("href") === activeHref);
      });
    },
    { threshold: [0.25, 0.4, 0.6], rootMargin: "-12% 0px -60% 0px" },
  );

  sections.forEach((s) => io.observe(s));
})();

(function initHeroTypewriter() {
  const headline = document.getElementById("hero-headline");
  if (!headline) return;
  const lineEls = headline.querySelectorAll("[data-hero-line]");
  if (lineEls.length !== 3) return;

  const lines = [
    [
      { text: "Learn ", accent: false },
      { text: "Smarter", accent: true },
      { text: ".", accent: false },
    ],
    [
      { text: "Grow ", accent: false },
      { text: "Faster", accent: true },
      { text: ".", accent: false },
    ],
    [
      { text: "Succeed ", accent: false },
      { text: "Together", accent: true },
      { text: ".", accent: false },
    ],
  ];

  function renderStatic() {
    lineEls.forEach((el, lineIndex) => {
      el.innerHTML = "";
      for (const seg of lines[lineIndex]) {
        const span = document.createElement("span");
        span.className = seg.accent ? "hero-word-accent" : "hero-word-base";
        span.textContent = seg.text;
        el.appendChild(span);
      }
    });
  }

  if (prefersReducedMotion()) {
    renderStatic();
    return;
  }

  const typeCharMs = 42;

  (async function run() {
    for (let lineIndex = 0; lineIndex < 3; lineIndex++) {
      const container = lineEls[lineIndex];
      container.innerHTML = "";
      const cursor = document.createElement("span");
      cursor.className = "hero-cursor";
      cursor.setAttribute("aria-hidden", "true");

      for (const seg of lines[lineIndex]) {
        const span = document.createElement("span");
        span.className = seg.accent ? "hero-word-accent" : "hero-word-base";
        if (cursor.parentNode === container) container.removeChild(cursor);
        container.appendChild(span);
        for (let i = 0; i < seg.text.length; i++) {
          span.textContent += seg.text[i];
          container.appendChild(cursor);
          await delay(typeCharMs);
        }
      }
      cursor.classList.add("is-done");
      await delay(320);
      if (cursor.parentNode === container) container.removeChild(cursor);
    }
  })();
})();

const menuButton = document.getElementById("menu-button");
const navLinks = document.getElementById("nav-links");
const closeMenu = document.getElementById("close-menu");

if (menuButton && navLinks) {
  menuButton.addEventListener("click", () => {
    navLinks.classList.remove("-translate-x-full");
    navLinks.classList.add("translate-x-0");
  });
}

if (closeMenu && navLinks) {
  closeMenu.addEventListener("click", () => {
    navLinks.classList.remove("translate-x-0");
    navLinks.classList.add("-translate-x-full");
  });
}

(function initTeamCarousel() {
  const root = document.getElementById("team-carousel");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll("[data-team-slide]"));
  const dots = root.querySelectorAll("[data-team-dot]");
  const prev = document.getElementById("team-prev");
  const next = document.getElementById("team-next");
  const stage = root.querySelector(".team-carousel-viewport");

  const n = slides.length;
  if (n === 0 || !stage) return;

  let i = 0;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  /** Shortest distance on a circular list (e.g. -1, 0, 1, 2). */
  function circDist(slideIdx, centerIdx, len) {
    let d = slideIdx - centerIdx;
    if (d > len / 2) d -= len;
    if (d < -len / 2) d += len;
    return d;
  }

  function render() {
    const stageW = stage.offsetWidth || 360;
    const sideX = Math.min(158, Math.max(72, stageW * 0.36));
    const dur = reduceMotion ? "0.01ms" : "0.55s";
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

    slides.forEach((slide, j) => {
      const d = circDist(j, i, n);

      let tx = 0;
      let tz = 0;
      let sc = 1;
      let blurPx = 0;
      let op = 1;
      let zi = 10;
      let ry = 0;
      let pe = "none";

      if (d === 0) {
        zi = 40;
        pe = "auto";
        sc = 1;
      } else if (d === -1) {
        tx = -sideX;
        sc = 0.86;
        blurPx = reduceMotion ? 0 : 5;
        op = 0.74;
        zi = 26;
        ry = 12;
        tz = -40;
      } else if (d === 1) {
        tx = sideX;
        sc = 0.86;
        blurPx = reduceMotion ? 0 : 5;
        op = 0.74;
        zi = 26;
        ry = -12;
        tz = -40;
      } else if (d === -2 || d === 2) {
        tx = d < 0 ? -sideX * 0.52 : sideX * 0.52;
        sc = 0.72;
        blurPx = reduceMotion ? 0 : 10;
        op = 0.36;
        zi = 6;
        ry = d < 0 ? 20 : -20;
        tz = -100;
      }

      slide.style.transition = `transform ${dur} ${ease}, opacity ${dur} ease, filter ${dur} ease`;
      slide.style.zIndex = String(zi);
      slide.style.opacity = String(op);
      slide.style.pointerEvents = pe;
      slide.style.transform = `translate3d(calc(-50% + ${tx}px), -50%, ${tz}px) scale(${sc}) rotateY(${ry}deg)`;
      slide.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";

      const art = slide.querySelector("article");
      if (art) {
        art.style.boxShadow =
          d === 0
            ? "0px 28px 60px rgba(0,0,0,0.52)"
            : "0px 14px 40px rgba(0,0,0,0.35)";
      }
    });

    dots.forEach((dotEl, j) => {
      const on = j === i;
      dotEl.classList.toggle("bg-white", on);
      dotEl.classList.toggle("bg-white/35", !on);
      dotEl.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function go(nextIdx) {
    i = ((nextIdx % n) + n) % n;
    render();
  }

  prev?.addEventListener("click", () => go(i - 1));
  next?.addEventListener("click", () => go(i + 1));
  dots.forEach((d, j) => d.addEventListener("click", () => go(j)));

  root.tabIndex = 0;
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(i - 1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(i + 1);
    }
  });

  let touchStartX = null;
  stage.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX == null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > 52) go(i - 1);
      else if (dx < -52) go(i + 1);
      touchStartX = null;
    },
    { passive: true },
  );

  const ro = new ResizeObserver(() => render());
  ro.observe(stage);
  go(0);
  requestAnimationFrame(() => render());
})();

(function initLandingTheme() {
  const landingToggle = document.getElementById("landing-theme-toggle");
  const mobileToggle = document.getElementById("mobile-theme-toggle");
  const mobileLabel = document.getElementById("mobile-theme-label");

  function updateUi() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (mobileLabel) {
      mobileLabel.textContent = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    try {
      localStorage.setItem("theme", next);
    } catch (_) {}
    try {
      document.cookie = "theme=" + next + "; path=/; max-age=31536000; SameSite=Lax";
    } catch (_) {}
    document.documentElement.setAttribute("data-theme", next);
    if (document.body) document.body.setAttribute("data-theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      if (document.body) document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      if (document.body) document.body.classList.remove("dark");
    }
    updateUi();
  }

  updateUi();
  if (landingToggle && !landingToggle.dataset.themeBound) {
    landingToggle.dataset.themeBound = "1";
    landingToggle.addEventListener("click", toggleTheme);
  }
  if (mobileToggle && !mobileToggle.dataset.themeBound) {
    mobileToggle.dataset.themeBound = "1";
    mobileToggle.addEventListener("click", toggleTheme);
  }
  window.addEventListener("storage", (e) => {
    if (e.key === "theme" && (e.newValue === "dark" || e.newValue === "light")) {
      document.documentElement.setAttribute("data-theme", e.newValue);
      if (document.body) document.body.setAttribute("data-theme", e.newValue);
      if (e.newValue === "dark") {
        document.documentElement.classList.add("dark");
        if (document.body) document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        if (document.body) document.body.classList.remove("dark");
      }
      updateUi();
    }
  });
})();
