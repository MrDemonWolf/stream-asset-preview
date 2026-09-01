// Load a channel's current sub emotes via Twitch's SUPPORTED Helix API.
//
// Static sites can't hold a client secret, so this uses the OAuth Implicit
// grant: the user signs in with their own Twitch account, the browser receives a
// short-lived user access token in the URL fragment (never a secret), and we
// call Helix with it. Public data (Get Users, Get Channel Emotes) needs no
// scopes. The token lives only in sessionStorage and is dropped on 401.
//
// Requires a registered Twitch application client-id, supplied at build time as
// VITE_TWITCH_CLIENT_ID. When it's absent the whole feature is hidden (see
// `twitchConfigured`), so a fork without an app still builds and runs.
//   Redirect URI to register: <origin>/stream-asset-preview/ (+ your dev origin)
//   Docs: https://dev.twitch.tv/docs/api/reference#get-channel-emotes

const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID || "";
export const twitchConfigured = Boolean(CLIENT_ID);

const HELIX = "https://api.twitch.tv/helix";
const AUTHORIZE = "https://id.twitch.tv/oauth2/authorize";
const TOKEN_KEY = "twitch_token";
const STATE_KEY = "twitch_oauth_state";
const REQUEST_TIMEOUT_MS = 12_000;

// Error the UI can react to by offering a "Connect Twitch" button.
export class TwitchAuthError extends Error {
  constructor(message = "Connect your Twitch account to load emotes.") {
    super(message);
    this.name = "TwitchAuthError";
    this.needsAuth = true;
  }
}

const redirectUri = () =>
  typeof window === "undefined" ? "" : `${window.location.origin}${import.meta.env.BASE_URL}`;

function randomState() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Kick off the implicit-grant redirect. Returns to redirectUri() with the token
// in the URL fragment. No scopes — Get Users / Get Channel Emotes are public.
export function beginTwitchAuth() {
  if (!twitchConfigured) throw new Error("Twitch integration isn't configured.");
  const state = randomState();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: "",
    state,
  });
  window.location.assign(`${AUTHORIZE}?${params}`);
}

// Call once on load: if we came back from Twitch with a token in the fragment,
// verify the CSRF state, store the token, and strip the fragment. Returns true
// if a token was captured.
export function captureTwitchRedirect() {
  if (typeof window === "undefined" || !window.location.hash) return false;
  const frag = new URLSearchParams(window.location.hash.slice(1));
  const token = frag.get("access_token");
  if (!token) return false;
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  // Clear the fragment regardless so the token never lingers in the URL bar.
  history.replaceState(null, "", redirectUri());
  if (!expected || frag.get("state") !== expected) return false; // CSRF mismatch
  sessionStorage.setItem(TOKEN_KEY, token);
  return true;
}

export function twitchToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function isTwitchConnected() {
  return Boolean(twitchToken());
}
export function disconnectTwitch() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function emoteImageUrl(id, animated) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/${animated ? "animated" : "static"}/dark/3.0`;
}

// fetch with a combined timeout + caller abort. Maps transport failure to a
// friendly error.
/**
 * @param {string} path
 * @param {{ signal?: AbortSignal }} [options]
 */
async function helix(path, { signal } = {}) {
  const token = twitchToken();
  if (!token) throw new TwitchAuthError();
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${HELIX}${path}`, {
      headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e?.name === "AbortError" && signal?.aborted) throw e;
    throw new Error("Couldn't reach Twitch — check your connection or try again.", { cause: e });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
  if (res.status === 401) {
    disconnectTwitch();
    throw new TwitchAuthError("Your Twitch session expired — reconnect to load emotes.");
  }
  if (res.status === 429) {
    const reset = res.headers.get("Ratelimit-Reset");
    throw new Error(`Twitch rate limit hit${reset ? " — try again shortly" : ""}.`);
  }
  if (!res.ok) throw new Error(`Twitch returned ${res.status}.`);
  return res.json();
}

// Emote-type + tier → showcase section. Animated emotes always go to the
// animated pool regardless of tier.
function sectionFor(e) {
  if (e.format?.includes("animated")) return "animated";
  if (e.emote_type === "bitstier") return "bits";
  if (e.emote_type === "follower") return "follower";
  return { 1000: "tier1", 2000: "tier2", 3000: "tier3" }[e.tier] ?? "tier1";
}

// Resolve a channel login to its current emotes via Helix.
/**
 * @param {string} login
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function fetchTwitchEmotes(login, { signal } = {}) {
  const clean = (login || "").trim().toLowerCase().replace(/^@/, "");
  if (!clean) throw new Error("Enter a channel name first.");

  const users = await helix(`/users?login=${encodeURIComponent(clean)}`, { signal });
  const user = users?.data?.[0];
  if (!user) throw new Error(`Channel "${clean}" not found.`);

  const body = await helix(`/chat/emotes?broadcaster_id=${user.id}`, { signal });
  const seen = new Set();
  const emotes = [];
  for (const e of body?.data ?? []) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const animated = e.format?.includes("animated") ?? false;
    emotes.push({
      name: e.name,
      animated,
      section: sectionFor(e),
      url: emoteImageUrl(e.id, animated),
    });
  }
  return { displayName: user.display_name || clean, emotes };
}
