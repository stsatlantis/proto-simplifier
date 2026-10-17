(function () {
  "use strict";

  const BTN_ID = "proto-simplifier-btn";
  const PANEL_ATTR = "data-proto-simplifier-panel";
  const FETCH_MSG = "PROTO_SIMPLIFIER_FETCH";
  const PROTO_BLOB_RE = /^\/[^/]+\/[^/]+\/blob\/.+\.proto$/i;
  const RAW_SELECTOR = 'a[data-testid="raw-button"], a#raw-url';

  const STORAGE_DEFAULTS = {
    keepComments: false,
    keepAnnotations: [],
    preserveBlanks: false,
  };

  let currentPath = location.pathname;
  let cache = { path: null, content: null };
  let view = { active: false, panelHost: null, originalEl: null };
  let panelCssPromise = null;

  function getOptions() {
    return new Promise(function (resolve) {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(STORAGE_DEFAULTS, function (s) {
            resolve(s || STORAGE_DEFAULTS);
          });
          return;
        }
      } catch (e) {
        /* fall through */
      }
      resolve(STORAGE_DEFAULTS);
    });
  }

  function isProtoBlob() {
    return PROTO_BLOB_RE.test(location.pathname);
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  // --- content retrieval -----------------------------------------------------

  function getEmbeddedData() {
    const el = document.querySelector(
      'script[type="application/json"][data-target="react-app.embeddedData"]'
    );
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function getBlobPayload(data) {
    if (!data || !data.payload) return null;
    const p = data.payload;
    if (p.codeViewBlobLayoutRoute && p.codeViewBlobLayoutRoute.blob) {
      return p.codeViewBlobLayoutRoute.blob;
    }
    return p.blob || null;
  }

  function getRawLines(data, blob) {
    if (blob && Array.isArray(blob.rawLines) && blob.rawLines.length) {
      return blob.rawLines;
    }
    const styled =
      data && data.payload && data.payload["codeViewBlobLayoutRoute.StyledBlob"];
    if (styled && Array.isArray(styled.rawLines) && styled.rawLines.length) {
      return styled.rawLines;
    }
    return null;
  }

  function buildRawUrl() {
    const u = new URL(location.href);
    u.pathname = u.pathname.replace("/blob/", "/raw/");
    u.search = "";
    u.hash = "";
    return u.toString();
  }

  async function fetchRaw(url) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const resp = await chrome.runtime.sendMessage({ type: FETCH_MSG, url: url });
        if (resp && resp.ok) return resp.text;
        if (resp && resp.error) throw new Error(resp.error);
      } catch (e) {
        // service worker unavailable — fall back to a direct credentialed fetch
      }
    }
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("HTTP " + r.status + " fetching raw file");
    return r.text();
  }

  async function getContent() {
    if (cache.path === location.pathname && cache.content != null) {
      return cache.content;
    }
    const data = getEmbeddedData();
    const blob = getBlobPayload(data);
    const truncated = !!(blob && blob.truncated === true);
    const rawLines = getRawLines(data, blob);

    let content;
    if (!truncated && rawLines) {
      content = rawLines.join("\n");
    } else {
      const url = (blob && blob.rawBlobUrl) || buildRawUrl();
      content = await fetchRaw(url);
    }
    cache = { path: location.pathname, content: content };
    return content;
  }

  // --- rendered-code region --------------------------------------------------

  const CODE_ANCHOR_SELECTOR =
    "#read-only-cursor-text-area, [data-hpc], .react-code-lines, .react-code-file-contents, [data-testid='code-viewer']";

  // The content block that holds the code — the largest ancestor of the code that
  // does NOT also contain the Raw button (which lives in #repos-sticky-header, a
  // sibling of the content wrapper). Hiding this leaves the sticky header intact.
  function findCodeRegion() {
    const anchor = document.querySelector(CODE_ANCHOR_SELECTOR);
    if (!anchor) return null;
    const raw = document.querySelector(RAW_SELECTOR);
    let el = anchor;
    while (el && el.parentElement) {
      const parent = el.parentElement;
      if (raw && parent.contains(raw)) return el;
      if (parent.tagName === "MAIN" || parent === document.body) return el;
      el = parent;
    }
    return anchor.parentElement;
  }

  function loadPanelCss() {
    if (!panelCssPromise) {
      panelCssPromise = (async () => {
        if (!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)) {
          return "";
        }
        try {
          const r = await fetch(chrome.runtime.getURL("styles/panel.css"));
          return await r.text();
        } catch (e) {
          return "";
        }
      })();
    }
    return panelCssPromise;
  }

  const TOKEN_CLASS = {
    keyword: "pp-k",
    type: "pp-t",
    string: "pp-s",
    number: "pp-n",
    comment: "pp-c",
  };

  function appendTokens(parent, text) {
    const tokens = ProtoSimplifier.tokenizeProtoLine(text);
    for (const t of tokens) {
      const cls = TOKEN_CLASS[t.type];
      if (cls) {
        const span = document.createElement("span");
        span.className = cls;
        span.textContent = t.value;
        parent.appendChild(span);
      } else {
        parent.appendChild(document.createTextNode(t.value));
      }
    }
  }

  function selectLine(root, line, opts) {
    opts = opts || {};
    root.querySelectorAll(".pp-row--selected").forEach(function (r) {
      r.classList.remove("pp-row--selected");
    });
    const target = root.querySelector('.pp-row[data-line="' + line + '"]');
    if (!target) return;
    target.classList.add("pp-row--selected");
    if (opts.scroll !== false) {
      target.scrollIntoView({ block: "center" });
    }
    if (opts.updateHash !== false) {
      location.hash = "L" + line;
    }
  }

  function applyHashSelection(root) {
    const m = /^#L(\d+)$/.exec(location.hash);
    if (!m) return;
    selectLine(root, Number(m[1]), { updateHash: false });
  }

  function buildCodeView(lines) {
    const root = document.createElement("div");
    root.className = "pp-code";
    let maxLine = 0;
    for (const l of lines) {
      if (l.srcLine && l.srcLine > maxLine) maxLine = l.srcLine;
    }
    root.style.setProperty("--pp-ln-width", String(maxLine).length + 1 + "ch");
    for (const l of lines) {
      const row = document.createElement("div");
      row.className = "pp-row";
      const ln = document.createElement("span");
      ln.className = "pp-ln";
      ln.textContent = l.srcLine != null ? String(l.srcLine) : "";
      if (l.srcLine != null) {
        row.dataset.line = String(l.srcLine);
        ln.setAttribute("role", "button");
        ln.setAttribute("tabindex", "0");
        ln.setAttribute("aria-label", "Select line " + l.srcLine);
        ln.addEventListener("click", function () {
          selectLine(root, l.srcLine);
        });
        ln.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            selectLine(root, l.srcLine);
          }
        });
      }
      const code = document.createElement("span");
      code.className = "pp-src";
      appendTokens(code, l.text);
      row.appendChild(ln);
      row.appendChild(code);
      root.appendChild(row);
    }
    return root;
  }

  // GitHub's sticky file header (#repos-sticky-header) overlaps the top of the
  // code slot; GitHub clears it by putting `margin-top: 46px` on its own content
  // section. Our injected panel takes the code's slot but without that offset, so
  // the header hides the first rows. Mirror GitHub exactly: offset the panel by
  // the live header height (falling back to GitHub's 46px baseline).
  function stickyHeaderHeight() {
    const header = document.querySelector("#repos-sticky-header");
    if (header) {
      const h = header.offsetHeight;
      if (h > 0) return h;
    }
    return 46;
  }

  function clearStickyOverlap(host) {
    if (!host) return;
    const h = stickyHeaderHeight();
    host.style.marginTop = h + "px";
    host.style.scrollMarginTop = h + "px";
  }

  async function activate(content) {
    const css = await loadPanelCss();
    const region = findCodeRegion();

    const host = document.createElement("div");
    host.setAttribute(PANEL_ATTR, "");
    const shadow = host.attachShadow({ mode: "open" });
    const opts = await getOptions();
    const style = document.createElement("style");
    style.textContent = css;
    const codeView = buildCodeView(
      ProtoSimplifier.simplifyProtoLines(content, opts)
    );
    shadow.appendChild(style);
    shadow.appendChild(codeView);

    if (region && region.parentElement) {
      region.style.display = "none";
      region.parentElement.insertBefore(host, region);
      view.originalEl = region;
    } else {
      document.body.appendChild(host);
      view.originalEl = null;
    }
    view.panelHost = host;
    view.active = true;
    setButtonLabel("Show original");
    clearStickyOverlap(host);
    applyHashSelection(codeView);
  }

  function deactivate() {
    if (view.panelHost && view.panelHost.isConnected) view.panelHost.remove();
    if (view.originalEl) view.originalEl.style.display = "";
    view = { active: false, panelHost: null, originalEl: null };
    setButtonLabel("Simplify");
  }

  // --- button ----------------------------------------------------------------

  function setButtonLabel(text) {
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.textContent = text;
  }

  async function onToggle() {
    if (view.active) {
      deactivate();
      return;
    }
    setButtonLabel("Simplifying…");
    try {
      const content = await getContent();
      await activate(content);
    } catch (e) {
      setButtonLabel("Simplify");
      console.error("[Proto Simplifier]", e);
      window.alert(
        "Proto Simplifier could not load the file content.\n" +
          (e && e.message ? e.message : String(e))
      );
    }
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    const raw = document.querySelector(RAW_SELECTOR);
    if (!raw) return;

    const btn = document.createElement(raw.tagName);
    btn.id = BTN_ID;
    btn.className = raw.className;
    btn.textContent = "Simplify";
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.setAttribute(PANEL_ATTR, "button");
    btn.style.cursor = "pointer";
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      onToggle();
    });
    btn.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        onToggle();
      }
    });

    const rawWrap = raw.parentElement;
    if (rawWrap && rawWrap.parentElement) {
      const wrap = document.createElement(rawWrap.tagName);
      wrap.className = rawWrap.className;
      wrap.appendChild(btn);
      rawWrap.parentElement.insertBefore(wrap, rawWrap);
    } else {
      raw.insertAdjacentElement("beforebegin", btn);
    }
  }

  // --- navigation / lifecycle ------------------------------------------------

  function maybeResetOnNav() {
    if (location.pathname === currentPath) return;
    currentPath = location.pathname;
    if (view.panelHost && view.panelHost.isConnected) view.panelHost.remove();
    view = { active: false, panelHost: null, originalEl: null };
    cache = { path: null, content: null };
  }

  function tick() {
    maybeResetOnNav();
    if (isProtoBlob()) injectButton();
  }

  function start() {
    tick();
    const observer = new MutationObserver(debounce(tick, 100));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("turbo:load", tick);
    document.addEventListener("soft-nav:end", tick);

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function () {
        if (view.active && cache.content != null) {
          const content = cache.content;
          deactivate();
          activate(content);
        }
      });
    }

    window.addEventListener(
      "resize",
      debounce(function () {
        if (view.active && view.panelHost && view.panelHost.isConnected) {
          clearStickyOverlap(view.panelHost);
        }
      }, 150)
    );

    window.addEventListener("hashchange", function () {
      if (!view.active || !view.panelHost || !view.panelHost.isConnected) return;
      const root = view.panelHost.shadowRoot.querySelector(".pp-code");
      if (root) applyHashSelection(root);
    });
  }

  start();
})();
