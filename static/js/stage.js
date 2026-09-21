const stage = document.getElementById("stage");
const stageBody = document.getElementById("stage-body");
const stageBack = document.getElementById("stage-back");
const stageOriginalLink = document.querySelector("#stage-original a");
const homeLink = document.querySelector(".head-link");

const paneOriginalUrls = {
  "track-field": "https://orleansonline.ca/pages/S2023052501.htm",
  "georg-northoff":
    "https://scholar.google.com/citations?hl=en&user=-w-9zOQAAAAJ",
};
const REEL_SECTIONS = new Set(["mountains", "cooking"]);
const mobilePane = window.matchMedia("(max-width: 760px)");
const MOBILE_PANE_PEEK = 170;
const SCHOLAR_PANES = new Set(["georg-northoff"]);
const SCHOLAR_EMBED_WIDTH = 1200;

let reelObserver = null;
let reelSectionObserver = null;

function paneNameFromHash() {
  return location.hash.replace(/^#/, "");
}

function trackPaneOpen(name) {
  window.trackEvent?.("pane_open", { pane_name: name });
}

function trackPaneClose(name) {
  if (!name) {
    return;
  }
  window.trackEvent?.("pane_close", { pane_name: name });
}

function trackReelSection(section) {
  window.trackEvent?.("reel_section_view", { section_name: section });
}

function bindEmbedFit(iframe, apply) {
  let resizeObserver = null;
  let mutationObserver = null;
  let stableTimer = null;
  let stopped = false;

  const cleanup = () => {
    stopped = true;
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    if (stableTimer) {
      window.clearTimeout(stableTimer);
    }
  };

  const tryApply = () => {
    if (stopped) {
      return;
    }

    try {
      apply();
    } catch (error) {
      // Cross-origin or unloaded documents can be ignored.
    }
  };

  const scheduleApply = () => {
    if (stableTimer) {
      window.clearTimeout(stableTimer);
    }
    stableTimer = window.setTimeout(tryApply, 120);
  };

  const observe = () => {
    try {
      const doc = iframe.contentDocument;
      const root = doc?.documentElement;
      const body = doc?.body;
      if (!root || !body) {
        return;
      }

      resizeObserver?.disconnect();
      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(() => scheduleApply());
        resizeObserver.observe(root);
        resizeObserver.observe(body);
      }

      mutationObserver?.disconnect();
      mutationObserver = new MutationObserver(() => scheduleApply());
      mutationObserver.observe(body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    } catch (error) {
      // Ignore observer setup errors.
    }
  };

  iframe.addEventListener(
    "load",
    () => {
      tryApply();
      observe();
      scheduleApply();

      [400, 900, 1800, 3000, 5000, 8000, 12000].forEach((delay) => {
        window.setTimeout(() => {
          tryApply();
          scheduleApply();
        }, delay);
      });

      window.setTimeout(cleanup, 15000);
    },
    { once: true },
  );

  tryApply();
  return cleanup;
}

function fitScholarEmbed(iframe, paneName = "georg-northoff") {
  const wrap = iframe.parentElement;
  if (!wrap) {
    return;
  }

  const apply = () => {
    const doc = iframe.contentDocument;
    const root = doc?.documentElement;
    const body = doc?.body;
    if (!root || !body) {
      return;
    }

    iframe.style.transform = "none";
    iframe.style.width = `${SCHOLAR_EMBED_WIDTH}px`;
    iframe.style.height = `${Math.max(body.scrollHeight, 2400)}px`;
    root.style.overflowX = "hidden";
    body.style.overflowX = "hidden";
    body.style.margin = "0";

    const pageWidth = Math.max(
      root.scrollWidth,
      body.scrollWidth,
      SCHOLAR_EMBED_WIDTH,
    );
    const scale = wrap.clientWidth / pageWidth;

    iframe.style.width = `${pageWidth}px`;
    iframe.style.height = `${Math.ceil(wrap.clientHeight / scale)}px`;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = "top left";
  };

  bindEmbedFit(iframe, apply);
}

function trackFieldHighlightScrollY(doc) {
  const win = doc.defaultView;
  const highlight = doc.getElementById("konrad-highlight");
  if (!win || !highlight) {
    return null;
  }

  return Math.max(
    0,
    highlight.offsetTop - win.innerHeight / 2 + highlight.offsetHeight / 2,
  );
}

function scrollTrackFieldHighlight(iframe, doc) {
  const targetScrollY = trackFieldHighlightScrollY(doc);
  if (targetScrollY === null) {
    return false;
  }

  doc.defaultView.scrollTo(0, targetScrollY);
  iframe.dataset.highlightScrolled = "1";
  return true;
}

function fitEmbed(iframe, paneName = "") {
  const wrap = iframe.parentElement;
  if (!wrap) {
    return;
  }

  const renderWidth = 1600;

  const apply = () => {
    const doc = iframe.contentDocument;
    const root = doc?.documentElement;
    const body = doc?.body;
    if (!root || !body) {
      return;
    }

    iframe.style.transform = "none";
    iframe.style.width = `${renderWidth}px`;
    iframe.style.height = `${Math.max(body.scrollHeight, 2400)}px`;
    root.style.zoom = "1";
    root.style.overflowX = "hidden";
    body.style.overflowX = "hidden";
    body.style.margin = "0";

    const pageWidth = Math.max(root.scrollWidth, body.scrollWidth, 1);
    const available = wrap.clientWidth;
    let scale = available / pageWidth;

    if (paneName === "track-field" && mobilePane.matches) {
      const focusWidth = pageWidth * 0.66;
      scale = available / focusWidth;
    }

    const viewportHeight = Math.ceil(wrap.clientHeight / scale);
    const scaledWidth = pageWidth * scale;
    const offsetX =
      paneName === "track-field" && mobilePane.matches
        ? (available - scaledWidth) / 2
        : 0;

    iframe.style.width = `${pageWidth}px`;
    iframe.style.height = `${viewportHeight}px`;
    iframe.style.transform =
      offsetX === 0
        ? `scale(${scale})`
        : `translateX(${offsetX}px) scale(${scale})`;
    iframe.style.transformOrigin = "top left";
  };

  const cleanup = bindEmbedFit(iframe, apply);

  if (paneName !== "track-field") {
    return;
  }

  const scrollOnceAndRelease = () => {
    apply();
    requestAnimationFrame(() => {
      try {
        const doc = iframe.contentDocument;
        if (doc && !iframe.dataset.highlightScrolled) {
          scrollTrackFieldHighlight(iframe, doc);
        }
      } catch (error) {
        // Ignore cross-origin or unload errors.
      }
      cleanup();
    });
  };

  if (iframe.contentDocument?.readyState === "complete") {
    window.setTimeout(scrollOnceAndRelease, 300);
  } else {
    iframe.addEventListener(
      "load",
      () => {
        window.setTimeout(scrollOnceAndRelease, 300);
      },
      { once: true },
    );
  }
}

function disconnectReelObservers() {
  reelObserver?.disconnect();
  reelSectionObserver?.disconnect();
  reelObserver = null;
  reelSectionObserver = null;
}

function playVisibleReelVideos() {
  stageBody.querySelectorAll("video").forEach((video) => {
    video.muted = true;
    const slide = video.closest(".reel-slide");
    if (!slide) {
      video.play().catch(() => {});
      return;
    }

    const rect = slide.getBoundingClientRect();
    const bodyRect = stageBody.getBoundingClientRect();
    const visible =
      rect.top < bodyRect.bottom - 80 && rect.bottom > bodyRect.top + 80;
    if (visible) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

function setupReelObservers() {
  disconnectReelObservers();

  reelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) {
          return;
        }
        if (entry.isIntersecting) {
          video.muted = true;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { root: stageBody, threshold: 0.65 },
  );

  stageBody.querySelectorAll("video").forEach((video) => {
    reelObserver.observe(video);
  });

  reelSectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) {
        return;
      }
      const section = visible.target.dataset.section;
      if (section && document.body.dataset.pane !== section) {
        const previousPane = document.body.dataset.pane;
        document.body.dataset.pane = section;
        if (location.hash !== `#${section}`) {
          history.replaceState({ pane: section }, "", `#${section}`);
        }
        if (previousPane && REEL_SECTIONS.has(previousPane)) {
          trackReelSection(section);
        }
      }
    },
    { root: stageBody, threshold: [0.55, 0.75] },
  );

  stageBody.querySelectorAll(".reel-slide").forEach((slide) => {
    reelSectionObserver.observe(slide);
  });

  stageBody.removeEventListener("scroll", playVisibleReelVideos);
  stageBody.addEventListener("scroll", playVisibleReelVideos, {
    passive: true,
  });
}

function fitMobileReelSlides() {
  if (!stageBody?.classList.contains("reel-scroll")) {
    stageBody?.style.removeProperty("--mobile-pane-slide");
    return;
  }

  const slideHeight = stageBody.clientHeight;
  if (!slideHeight) {
    return;
  }

  stageBody.style.setProperty("--mobile-pane-slide", `${slideHeight}px`);
  stageBody.querySelectorAll(".reel-slide").forEach((slide) => {
    slide.style.height = `${slideHeight}px`;
    slide.style.minHeight = `${slideHeight}px`;
    slide.style.maxHeight = `${slideHeight}px`;
  });
}

function placeMobileCluster(open) {
  const cluster = document.getElementById("bio-cluster");
  const box = document.getElementById("wrapper");
  if (!cluster || !box || !stage) {
    return;
  }

  if (!mobilePane.matches || !open) {
    cluster.style.transition = "";
    cluster.style.transform = "";
    delete cluster.dataset.paneShift;
    stage.style.height = "";
    stageBody?.style.removeProperty("--mobile-pane-slide");
    return;
  }

  if (cluster.dataset.paneShift === "1") {
    return;
  }

  cluster.style.transition = "none";
  cluster.style.transform = "none";

  const clusterTop = cluster.getBoundingClientRect().top;
  const stageTop = stage.getBoundingClientRect().top;
  if (clusterTop < 40) {
    cluster.style.transition = "";
    return;
  }

  const shift = Math.max(
    0,
    Math.round(window.innerHeight - MOBILE_PANE_PEEK - clusterTop),
  );
  const stageHeight = Math.max(
    220,
    Math.round(clusterTop + shift - stageTop - 12),
  );
  stage.style.height = `${stageHeight}px`;
  fitMobileReelSlides();
  cluster.dataset.paneShift = "1";

  requestAnimationFrame(() => {
    cluster.style.transition = "";
    cluster.style.transform = `translateY(${shift}px)`;
  });
}

function scrollReelTo(section, behavior = "smooth") {
  const target = stageBody.querySelector(
    `.reel-slide[data-section="${section}"]`,
  );
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior, block: "start" });
  document.body.dataset.pane = section;
  playVisibleReelVideos();
}

function openReel(section, pushHash = true) {
  const template = document.getElementById("pane-gallery-reel");
  if (!template || !stage || !stageBody) {
    return;
  }

  stageBody.replaceChildren(template.content.cloneNode(true));
  stageBody.classList.add("reel-scroll");
  stage.classList.add("is-open");
  document.body.dataset.pane = section;

  setupReelObservers();

  requestAnimationFrame(() => {
    scrollReelTo(section, "auto");
  });

  if (pushHash && location.hash !== `#${section}`) {
    history.pushState({ pane: section }, "", `#${section}`);
  }

  placeMobileCluster(true);
  trackPaneOpen(section);
}

function openPane(name, pushHash = true) {
  if (REEL_SECTIONS.has(name)) {
    if (
      stage.classList.contains("is-open") &&
      stageBody.classList.contains("reel-scroll")
    ) {
      const previousPane = document.body.dataset.pane;
      scrollReelTo(name);
      if (pushHash && location.hash !== `#${name}`) {
        history.pushState({ pane: name }, "", `#${name}`);
      }
      if (previousPane !== name) {
        trackPaneOpen(name);
      }
      return;
    }
    openReel(name, pushHash);
    return;
  }

  const template = document.getElementById(`pane-${name}`);
  if (!template || !stage || !stageBody) {
    return;
  }

  disconnectReelObservers();
  stageBody.classList.remove("reel-scroll");
  stageBody.replaceChildren(template.content.cloneNode(true));
  stage.classList.add("is-open");
  document.body.dataset.pane = name;
  stageBody.scrollTop = 0;

  if (stageOriginalLink) {
    const originalUrl = paneOriginalUrls[name];
    if (originalUrl) {
      stageOriginalLink.href = originalUrl;
    }
  }

  stageBody.querySelectorAll("video").forEach((video) => {
    video.muted = true;
    video.play().catch(() => {});
  });

  const iframe = stageBody.querySelector("iframe");
  if (iframe) {
    if (SCHOLAR_PANES.has(name)) {
      fitScholarEmbed(iframe, name);
    } else {
      fitEmbed(iframe, name);
    }
  }

  if (pushHash && location.hash !== `#${name}`) {
    history.pushState({ pane: name }, "", `#${name}`);
  }

  placeMobileCluster(true);
  trackPaneOpen(name);
}

function closePane(pushHash = true) {
  if (!stage || !stageBody) {
    return;
  }

  const closedPane = document.body.dataset.pane;

  disconnectReelObservers();
  stageBody.removeEventListener("scroll", playVisibleReelVideos);
  stageBody.replaceChildren();
  stageBody.classList.remove("reel-scroll");
  stage.classList.remove("is-open");
  delete document.body.dataset.pane;
  placeMobileCluster(false);
  window.dispatchEvent(new Event("resize"));

  if (pushHash && location.hash) {
    history.pushState({}, "", `${location.pathname}${location.search}`);
  }

  trackPaneClose(closedPane);
}

function syncFromHash() {
  const name = paneNameFromHash();
  if (name) {
    openPane(name, false);
  } else {
    closePane(false);
  }
}

document.querySelectorAll("[data-pane]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const name = link.dataset.pane;
    if (document.body.dataset.pane === name) {
      closePane();
      return;
    }
    openPane(name);
  });
});

if (stageBack) {
  stageBack.addEventListener("click", (event) => {
    event.preventDefault();
    closePane();
  });
}

if (homeLink) {
  homeLink.addEventListener("click", (event) => {
    if (!document.body.dataset.pane) {
      return;
    }
    event.preventDefault();
    closePane();
  });
}

if (stageOriginalLink) {
  stageOriginalLink.addEventListener("click", () => {
    window.trackEvent?.("see_original_page", {
      pane_name: document.body.dataset.pane || "",
      link_url: stageOriginalLink.href,
    });
  });
}

window.addEventListener("popstate", syncFromHash);
window.addEventListener("resize", () => {
  if (!mobilePane.matches || !document.body.dataset.pane) {
    return;
  }

  const cluster = document.getElementById("bio-cluster");
  if (cluster) {
    delete cluster.dataset.paneShift;
  }
  placeMobileCluster(true);
});
syncFromHash();
