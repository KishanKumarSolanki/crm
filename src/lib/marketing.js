const CONSENT_KEY = "creative-crew-marketing-consent";
const ATTRIBUTION_KEY = "creative-crew-first-touch";

export function getCookie(name) {
  const prefix = `${name}=`;
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) || "";
}

export function getAttribution() {
  const params = new URLSearchParams(window.location.search);
  let firstTouch = {};
  try { firstTouch = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "{}"); } catch { /* ignore invalid stored data */ }
  const current = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].map((key) => [key, (params.get(key) || "").slice(0, 160)]));
  current.fbclid = (params.get("fbclid") || "").slice(0, 500);
  const utmValues = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].map((key) => [key, current[key]]));
  const hasCampaign = Object.values(utmValues).some(Boolean);
  if (hasCampaign) {
    firstTouch = { ...firstTouch, ...Object.fromEntries(Object.entries(utmValues).filter(([key, value]) => value && !firstTouch[key])) };
    try { localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(firstTouch)); } catch { /* storage may be disabled */ }
  }
  const fbclid = current.fbclid || "";
  const fbcCookie = getCookie("_fbc");
  return {
    utm_source: firstTouch.utm_source || current.utm_source || "",
    utm_medium: firstTouch.utm_medium || current.utm_medium || "",
    utm_campaign: firstTouch.utm_campaign || current.utm_campaign || "",
    utm_content: firstTouch.utm_content || current.utm_content || "",
    fbclid,
    fbc: fbcCookie || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : ""),
    fbp: getCookie("_fbp"),
  };
}

export function hasMarketingConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === "granted"; } catch { return false; }
}

export function hasMarketingChoice() {
  try { return localStorage.getItem(CONSENT_KEY) !== null; } catch { return false; }
}

export function saveMarketingConsent(granted) {
  try { localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied"); } catch { /* storage may be disabled */ }
}

export function trackMetaPageView() {
  const pixelId = import.meta.env.VITE_META_PIXEL_ID;
  if (!pixelId || !hasMarketingConsent() || typeof window === "undefined") return;
  if (!window.fbq) {
    const fbq = function (...args) { fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args); };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  if (!window.__creativeCrewPixelInitialized) {
    window.fbq("init", pixelId);
    window.__creativeCrewPixelInitialized = true;
  }
  if (!window.__creativeCrewPageViewTracked) {
    window.fbq("track", "PageView");
    window.__creativeCrewPageViewTracked = true;
  }
}

export function trackMetaLead(eventId) {
  if (!eventId || !hasMarketingConsent() || !window.fbq) return;
  window.fbq("track", "Lead", {}, { eventID: eventId });
}
