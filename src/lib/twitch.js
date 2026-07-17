// Load a channel's current sub emotes by name — no login, no secret.
//
// This hits Twitch's public GraphQL endpoint with the same Client-ID Twitch's
// own web app ships (a public identifier, safe to commit — NOT a secret). It's
// an undocumented endpoint, so if Twitch changes it this may break; that's the
// price of a zero-auth, name-only lookup. Images come off the public emote CDN
// and are CORS-clean, so they still bake into the export canvas.

export const TWITCH_GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

// Sub tier → showcase section. Animated emotes go to the animated pool instead.
const TIER_SECTION = { 1000: "tier1", 2000: "tier2", 3000: "tier3" };

export function emoteImageUrl(id, animated) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/${animated ? "animated" : "static"}/dark/3.0`;
}

export async function fetchTwitchEmotes(login) {
  const clean = (login || "").trim().toLowerCase().replace(/^@/, "");
  if (!clean) throw new Error("Enter a channel name first.");

  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-Id": TWITCH_GQL_CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "query($login:String!){user(login:$login){id displayName subscriptionProducts{tier emotes{id token assetType}}}}",
      variables: { login: clean },
    }),
  }).catch(() => {
    throw new Error("Couldn't reach Twitch — check your connection.");
  });
  if (!res.ok) throw new Error(`Twitch returned ${res.status}.`);

  const body = await res.json().catch(() => {
    throw new Error("Twitch sent back an unreadable response.");
  });
  const user = body?.data?.user;
  if (!user) throw new Error(`Channel "${clean}" not found.`);

  const seen = new Set();
  const emotes = [];
  for (const p of user.subscriptionProducts ?? []) {
    for (const e of p.emotes ?? []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const animated = e.assetType === "ANIMATED";
      emotes.push({
        name: e.token,
        animated,
        section: animated ? "animated" : (TIER_SECTION[p.tier] ?? "tier1"),
        url: emoteImageUrl(e.id, animated),
      });
    }
  }
  return { displayName: user.displayName || clean, emotes };
}
