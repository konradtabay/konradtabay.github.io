function trackEvent(eventName, params = {}) {
  if (typeof gtag !== "function") {
    return;
  }
  gtag("event", eventName, params);
}

function outboundLinkName(link) {
  if (link.id?.startsWith("nav-")) {
    return link.id.replace(/^nav-/, "");
  }
  const text = link.textContent?.trim().toLowerCase();
  return text || "link";
}

document.addEventListener(
  "click",
  (event) => {
    const link = event.target.closest("a");
    if (!link) {
      return;
    }

    if (link.dataset.pane || link.closest("#stage-back")) {
      return;
    }

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) {
      return;
    }

    if (
      href === "/" ||
      href === "./" ||
      href === window.location.pathname
    ) {
      return;
    }

    trackEvent("outbound_click", {
      link_name: outboundLinkName(link),
      link_url: href,
    });
  },
  true,
);

window.trackEvent = trackEvent;
