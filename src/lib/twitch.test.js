// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// twitch.js reads import.meta.env.VITE_TWITCH_CLIENT_ID at module load, so stub
// it before the first import and re-import fresh for each test file run.
vi.stubEnv("VITE_TWITCH_CLIENT_ID", "test_client_id");

const {
  TwitchAuthError,
  captureTwitchRedirect,
  disconnectTwitch,
  emoteImageUrl,
  fetchTwitchEmotes,
  isTwitchConnected,
  twitchConfigured,
  twitchToken,
} = await import("./twitch.js");

const BASE = `${window.location.origin}/`;

function setHash(params) {
  window.location.hash = new URLSearchParams(params).toString();
}

// Minimal fetch Response stand-in.
function res(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k] ?? null },
    json: async () => body,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configuration gate", () => {
  it("reports configured when a client-id is present", () => {
    expect(twitchConfigured).toBe(true);
  });
});

describe("emoteImageUrl", () => {
  it("builds static and animated CDN URLs", () => {
    expect(emoteImageUrl("123", false)).toBe(
      "https://static-cdn.jtvnw.net/emoticons/v2/123/static/dark/3.0",
    );
    expect(emoteImageUrl("123", true)).toBe(
      "https://static-cdn.jtvnw.net/emoticons/v2/123/animated/dark/3.0",
    );
  });
});

describe("captureTwitchRedirect — OAuth fragment handling", () => {
  it("does nothing when there is no fragment", () => {
    expect(captureTwitchRedirect()).toBe(false);
    expect(twitchToken()).toBeNull();
  });

  it("stores the token when the CSRF state matches", () => {
    sessionStorage.setItem("twitch_oauth_state", "abc123");
    setHash({ access_token: "tok_ok", state: "abc123" });
    expect(captureTwitchRedirect()).toBe(true);
    expect(twitchToken()).toBe("tok_ok");
    expect(isTwitchConnected()).toBe(true);
  });

  it("REJECTS a token whose state does not match (CSRF defence)", () => {
    sessionStorage.setItem("twitch_oauth_state", "expected");
    setHash({ access_token: "tok_evil", state: "attacker" });
    expect(captureTwitchRedirect()).toBe(false);
    expect(twitchToken()).toBeNull();
  });

  it("REJECTS a token when no state was ever issued", () => {
    setHash({ access_token: "tok_unsolicited", state: "whatever" });
    expect(captureTwitchRedirect()).toBe(false);
    expect(twitchToken()).toBeNull();
  });

  it("clears the fragment so the token never lingers in the URL", () => {
    sessionStorage.setItem("twitch_oauth_state", "s");
    setHash({ access_token: "tok", state: "s" });
    captureTwitchRedirect();
    expect(window.location.hash).toBe("");
    expect(window.location.href).toBe(BASE);
  });

  it("consumes the state so a replayed fragment cannot re-authenticate", () => {
    sessionStorage.setItem("twitch_oauth_state", "one-shot");
    setHash({ access_token: "tok", state: "one-shot" });
    expect(captureTwitchRedirect()).toBe(true);
    disconnectTwitch();
    // Replay the exact same fragment — the state is gone, so it must fail.
    setHash({ access_token: "tok", state: "one-shot" });
    expect(captureTwitchRedirect()).toBe(false);
    expect(twitchToken()).toBeNull();
  });
});

describe("disconnectTwitch", () => {
  it("drops the session token", () => {
    sessionStorage.setItem("twitch_token", "tok");
    expect(isTwitchConnected()).toBe(true);
    disconnectTwitch();
    expect(isTwitchConnected()).toBe(false);
  });
});

describe("fetchTwitchEmotes — auth + error mapping", () => {
  it("throws TwitchAuthError when not connected", async () => {
    await expect(fetchTwitchEmotes("someone")).rejects.toBeInstanceOf(TwitchAuthError);
  });

  it("rejects an empty channel name before any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    sessionStorage.setItem("twitch_token", "tok");
    await expect(fetchTwitchEmotes("   ")).rejects.toThrow(/channel name/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("clears the token and asks for re-auth on 401", async () => {
    sessionStorage.setItem("twitch_token", "expired");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(401, {})),
    );
    await expect(fetchTwitchEmotes("chan")).rejects.toBeInstanceOf(TwitchAuthError);
    expect(twitchToken()).toBeNull(); // must not keep a dead token
  });

  it("surfaces a rate limit on 429", async () => {
    sessionStorage.setItem("twitch_token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(429, {}, { "Ratelimit-Reset": "60" })),
    );
    await expect(fetchTwitchEmotes("chan")).rejects.toThrow(/rate limit/i);
  });

  it("reports an unknown channel", async () => {
    sessionStorage.setItem("twitch_token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(200, { data: [] })),
    );
    await expect(fetchTwitchEmotes("ghost")).rejects.toThrow(/not found/i);
  });

  it("maps a network failure to a friendly message", async () => {
    sessionStorage.setItem("twitch_token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(fetchTwitchEmotes("chan")).rejects.toThrow(/couldn't reach twitch/i);
  });

  it("normalises the login (trims, lowercases, strips a leading @)", async () => {
    sessionStorage.setItem("twitch_token", "tok");
    const fetchSpy = vi.fn(async (url) =>
      String(url).includes("/users")
        ? res(200, { data: [{ id: "7", display_name: "MrDemonWolf" }] })
        : res(200, { data: [] }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchTwitchEmotes("  @MrDemonWolf  ");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("login=mrdemonwolf");
  });

  it("sends the Client-Id and bearer token", async () => {
    sessionStorage.setItem("twitch_token", "tok_abc");
    const fetchSpy = vi.fn(async (url) =>
      String(url).includes("/users")
        ? res(200, { data: [{ id: "7", display_name: "X" }] })
        : res(200, { data: [] }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchTwitchEmotes("x");
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers["Client-Id"]).toBe("test_client_id");
    expect(headers.Authorization).toBe("Bearer tok_abc");
  });
});

describe("fetchTwitchEmotes — emote → slot routing", () => {
  function withEmotes(emotes) {
    sessionStorage.setItem("twitch_token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        String(url).includes("/users")
          ? res(200, { data: [{ id: "7", display_name: "MrDemonWolf" }] })
          : res(200, { data: emotes }),
      ),
    );
  }

  it("routes subscription tiers to tier1/tier2/tier3", async () => {
    withEmotes([
      { id: "a", name: "A", emote_type: "subscriptions", tier: "1000", format: ["static"] },
      { id: "b", name: "B", emote_type: "subscriptions", tier: "2000", format: ["static"] },
      { id: "c", name: "C", emote_type: "subscriptions", tier: "3000", format: ["static"] },
    ]);
    const { emotes } = await fetchTwitchEmotes("x");
    expect(emotes.map((e) => e.section)).toEqual(["tier1", "tier2", "tier3"]);
  });

  it("routes ANY animated emote to the animated pool regardless of tier", async () => {
    withEmotes([
      { id: "a", name: "A", emote_type: "subscriptions", tier: "3000", format: ["animated"] },
    ]);
    const { emotes } = await fetchTwitchEmotes("x");
    expect(emotes[0].section).toBe("animated");
    expect(emotes[0].animated).toBe(true);
    expect(emotes[0].url).toContain("/animated/");
  });

  it("routes follower and bits emotes to their own sections", async () => {
    withEmotes([
      { id: "f", name: "F", emote_type: "follower", format: ["static"] },
      { id: "b", name: "B", emote_type: "bitstier", format: ["static"] },
    ]);
    const { emotes } = await fetchTwitchEmotes("x");
    expect(emotes.map((e) => e.section)).toEqual(["follower", "bits"]);
  });

  it("defaults an unknown tier to tier1", async () => {
    withEmotes([{ id: "a", name: "A", emote_type: "subscriptions", format: ["static"] }]);
    const { emotes } = await fetchTwitchEmotes("x");
    expect(emotes[0].section).toBe("tier1");
  });

  it("dedupes repeated emote ids", async () => {
    withEmotes([
      { id: "dup", name: "One", emote_type: "subscriptions", tier: "1000", format: ["static"] },
      { id: "dup", name: "Two", emote_type: "subscriptions", tier: "1000", format: ["static"] },
    ]);
    const { emotes } = await fetchTwitchEmotes("x");
    expect(emotes).toHaveLength(1);
  });

  it("returns the channel display name", async () => {
    withEmotes([]);
    const { displayName, emotes } = await fetchTwitchEmotes("x");
    expect(displayName).toBe("MrDemonWolf");
    expect(emotes).toEqual([]);
  });

  it("aborts in flight when the caller signals", async () => {
    sessionStorage.setItem("twitch_token", "tok");
    const ac = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, opts) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const p = fetchTwitchEmotes("x", { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});
