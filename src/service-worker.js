const FETCH_MSG = "NO_BS_PROTO_VIEWER_FETCH";

function isAllowedRawUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  if (host === "raw.githubusercontent.com") return true;
  if (host.endsWith(".githubusercontent.com")) return true;
  if (host === "github.com" && url.pathname.includes("/raw/")) return true;
  return false;
}

async function fetchRaw(rawUrl) {
  const res = await fetch(rawUrl, { credentials: "include", redirect: "follow" });
  if (!res.ok) {
    return { ok: false, error: "HTTP " + res.status + " fetching raw file" };
  }
  const text = await res.text();
  return { ok: true, text: text };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== FETCH_MSG) return false;
  if (!isAllowedRawUrl(message.url)) {
    sendResponse({ ok: false, error: "Blocked non-allowlisted URL" });
    return false;
  }
  (async () => {
    try {
      sendResponse(await fetchRaw(message.url));
    } catch (e) {
      sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  })();
  return true;
});
