import { useEffect, useRef, useState } from "react";
import {
  Check,
  DownloadCloud,
  ListTodo,
  Loader2,
  Minus,
  Download,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useFileDrop } from "@/hooks/useFileDrop";
import { exportShowcase } from "@/lib/exportGrid";
import { isGif, isRasterImage, stripExt } from "@/lib/image";
import { squareDataUrl } from "@/lib/resize";
import {
  BOOSTS_FOR_LEVEL,
  PLATFORMS,
  TWITCH_STATUS,
  capFor,
  levelForBoosts,
  nextMilestone,
  offSpec,
  twitchSlotCap,
  uploadPx,
} from "@/lib/platforms";
import { fetchTwitchEmotes } from "@/lib/twitch";
import { cn } from "@/lib/utils";

// Lighter, AA/AAA-safe variant of each platform accent for when it must be TEXT
// (the raw accent is only ever a decorative dot/rail).
const ACCENT_TEXT = {
  twitch: "var(--accent-twitch-text)",
  discord: "var(--accent-discord-text)",
};

// Build a showcase: declare your channel/server status so the slot counts are
// real, drop a whole emote set, sort it into each tier, then bake one
// advertising PNG. Everything is in-memory (nothing uploaded).
export function Showcase() {
  const [platform, setPlatform] = useState("twitch");
  const [status, setStatus] = useState("affiliate"); // Twitch: affiliate | partner
  const [level, setLevel] = useState(0); // Discord Boost Level 0..3
  const [boosts, setBoosts] = useState(0); // Discord boost count (drives level)
  const [subPoints, setSubPoints] = useState(0); // Twitch, informational readout
  const [title, setTitle] = useState("MrDemonWolf");
  const [channel, setChannel] = useState("mrdemonwolf"); // for "Load from channel"
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loadMsg, setLoadMsg] = useState(null);
  const [addError, setAddError] = useState(null); // rejected/undecodable uploads
  const [confirmClear, setConfirmClear] = useState(false);
  const [done, setDone] = useState(() => new Set()); // dismissed to-do ids
  // Per-section cap overrides so you can match your real dashboard numbers.
  const [overrides, setOverrides] = useState({}); // "<platform>:<section>" -> number
  // { "<platform>:<sectionKey>": Item[] } — Item = { id, name, url, img, bytes }
  const [store, setStore] = useState({});
  const nextId = useRef(0);

  const cfg = PLATFORMS[platform];
  const accentText = ACCENT_TEXT[platform];
  const keyOf = (s) => `${platform}:${s}`;
  const list = (s) => store[keyOf(s)] ?? [];
  const total = cfg.sections.reduce((n, s) => n + list(s.key).length, 0);

  // Resolve a section's active slot cap: an explicit override wins, else the
  // seed from the current status (Twitch) or Boost Level (Discord).
  function capOf(section) {
    const ov = overrides[keyOf(section.key)];
    if (ov != null) return ov;
    return platform === "twitch"
      ? twitchSlotCap(section.key, status, subPoints)
      : capFor(section, level);
  }

  function setCap(sectionKey, value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setOverrides((prev) => ({ ...prev, [keyOf(sectionKey)]: n }));
  }

  // Re-seed all caps for this platform from a new status/level (drops overrides).
  function reseed(mut) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const s of cfg.sections) delete next[keyOf(s.key)];
      return next;
    });
    mut();
  }

  function pushItem(sectionKey, item) {
    setStore((prev) => {
      const k = keyOf(sectionKey);
      return { ...prev, [k]: [...(prev[k] ?? []), item] };
    });
  }

  // Auto-size on upload: static images are contained into a transparent square
  // at the slot's spec (112 Twitch / 128 emoji / 320 sticker). GIFs pass through
  // untouched so they keep animating — resizing would flatten them.
  async function addFiles(sectionKey, fileList) {
    const incoming = [...(fileList ?? [])];
    const files = incoming.filter(isRasterImage);
    if (incoming.length && !files.length) {
      setAddError("Use PNG, GIF, JPG, or WEBP images.");
      return;
    }
    setAddError(null);
    const px = uploadPx(platform, sectionKey);
    for (const file of files) {
      const id = nextId.current++;
      const name = stripExt(file.name);
      if (isGif(file)) {
        // GIFs pass through untouched (resizing would flatten the animation).
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => pushItem(sectionKey, { id, name, url, img, bytes: file.size });
        img.onerror = () => {
          URL.revokeObjectURL(url);
          setAddError(`Couldn't read "${file.name}".`);
        };
        img.src = url;
      } else {
        try {
          const { dataUrl, bytes } = await squareDataUrl(file, px);
          const img = new Image();
          img.onload = () => pushItem(sectionKey, { id, name, url: dataUrl, img, bytes });
          img.src = dataUrl;
        } catch {
          setAddError(`Couldn't read "${file.name}".`);
        }
      }
    }
  }

  function remove(sectionKey, id) {
    setStore((prev) => {
      const k = keyOf(sectionKey);
      const arr = prev[k] ?? [];
      const gone = arr.find((it) => it.id === id);
      // Only blob: URLs (GIF passthrough) need revoking; resized items are data:
      // URLs and channel-loaded emotes are remote https: — both no-ops to revoke.
      if (gone?.url?.startsWith("blob:")) URL.revokeObjectURL(gone.url);
      return { ...prev, [k]: arr.filter((it) => it.id !== id) };
    });
  }

  function clearPlatform() {
    setStore((prev) => {
      const next = { ...prev };
      for (const s of cfg.sections) {
        const k = keyOf(s.key);
        (next[k] ?? []).forEach((it) => {
          if (it.url?.startsWith("blob:")) URL.revokeObjectURL(it.url);
        });
        delete next[k];
      }
      return next;
    });
    setConfirmClear(false);
  }

  // Pull the channel's current sub emotes and drop them into their tiers, so you
  // don't re-upload what you already have. Replaces previously loaded emotes;
  // leaves anything you added by hand.
  async function loadFromChannel(name) {
    setLoadError(null);
    setLoadMsg(null);
    setLoading(true);
    try {
      const { displayName, emotes } = await fetchTwitchEmotes(name);
      const loaded = await Promise.all(
        emotes.map(
          (e) =>
            new Promise((res) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => res({ ...e, img });
              img.onerror = () => res({ ...e, img: null });
              img.src = e.url;
            }),
        ),
      );
      setStore((prev) => {
        const next = { ...prev };
        for (const s of cfg.sections) {
          const k = `twitch:${s.key}`;
          next[k] = (next[k] ?? []).filter((it) => !it.remote); // drop old loaded
        }
        for (const e of loaded) {
          const k = `twitch:${e.section}`;
          next[k] = [
            ...(next[k] ?? []),
            { id: nextId.current++, name: e.name, url: e.url, img: e.img, bytes: 0, remote: true },
          ];
        }
        return next;
      });
      setLoadMsg(`Loaded ${emotes.length} emote${emotes.length === 1 ? "" : "s"} from ${displayName}.`);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function doExport() {
    const subtitle =
      cfg.label + (cfg.levels ? ` · ${cfg.levels[level]}` : ` · ${TWITCH_STATUS[status].label}`);
    const blocks = cfg.sections.map((s) => ({
      label: s.label,
      spec: s.spec,
      cap: capOf(s),
      items: list(s.key),
    }));
    exportShowcase(
      { title: title || cfg.label, subtitle, accent: cfg.accent, blocks },
      `${(title || cfg.label).toLowerCase().replace(/\s+/g, "-")}-${cfg.key}-showcase.png`,
    );
  }

  const todos = buildTodos(cfg, platform, list, capOf);

  // Prune dismissed ids that no longer map to a live to-do (so a resolved item
  // doesn't leave a stranded "done" entry that reappears if it recurs).
  const todoKey = todos.map((t) => t.id).join("|");
  useEffect(() => {
    setDone((prev) => {
      const live = new Set(todos.map((t) => t.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoKey]);

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Emote showcase organizer</h2>

      {/* Toolbar: platform · title · export */}
      <div className="flex flex-wrap items-end justify-center gap-4">
        <Segmented
          label="Platform"
          showLabel
          value={platform}
          onChange={(p) => {
            setPlatform(p);
            setConfirmClear(false);
          }}
          options={Object.values(PLATFORMS).map((p) => [p.key, p.label])}
        />
        <label className="block space-y-1.5">
          <span className="u-label block">Showcase title</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-44 font-mono"
          />
        </label>
        <div className="flex gap-2">
          <Button onClick={doExport} disabled={total === 0}>
            <Download /> Export PNG
          </Button>
          {total > 0 &&
            (confirmClear ? (
              <>
                <Button variant="destructive" onClick={clearPlatform}>
                  Confirm clear
                </Button>
                <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmClear(true)}>
                <Trash2 /> Clear
              </Button>
            ))}
        </div>
      </div>

      {/* Status console — declare where you stand so the slot counts are real */}
      <StatusBar
        platform={platform}
        accent={cfg.accent}
        accentText={accentText}
        status={status}
        setStatus={(v) => reseed(() => setStatus(v))}
        subPoints={subPoints}
        setSubPoints={setSubPoints}
        level={level}
        boosts={boosts}
        levels={cfg.levels}
        onLevel={(lvl) => reseed(() => { setLevel(lvl); setBoosts(BOOSTS_FOR_LEVEL[lvl]); })}
        onBoosts={(n) => reseed(() => { setBoosts(n); setLevel(levelForBoosts(n)); })}
      />

      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground sm:text-sm">{cfg.note}</p>

      {/* Load current emotes from a channel (Twitch only) */}
      {platform === "twitch" && (
        <div className="panel p-4">
          <label className="block space-y-1.5" htmlFor="load-channel">
            <span className="u-label block">Load current emotes from a channel</span>
          </label>
          <div role="group" aria-label="Load emotes from a Twitch channel" className="flex gap-2">
            <Input
              id="load-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && loadFromChannel(channel)}
              placeholder="your_twitch_name"
              className="font-mono"
            />
            <Button onClick={() => loadFromChannel(channel)} disabled={loading} aria-busy={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <DownloadCloud />} Load
            </Button>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Pulls your Tier 1 / 2 / 3 sub emotes (static + animated) straight from Twitch — no login.
            Follower &amp; Bit emotes aren't exposed here; add those by hand.
          </p>
          {/* Live regions render even when empty so SRs announce load results. */}
          <p role="status" aria-live="polite" className="mt-2 min-h-0 text-xs text-success-text">
            {loading ? "Loading emotes…" : loadError ? "" : loadMsg}
          </p>
          <p role="alert" aria-live="assertive" className="text-xs text-destructive-text empty:hidden">
            {loadError}
          </p>
        </div>
      )}

      {/* Auto-generated to-do list */}
      {total > 0 && (
        <TodoList todos={todos} done={done} onToggle={(id) =>
          setDone((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
          })
        } />
      )}

      {addError && (
        <p role="alert" className="text-center text-xs text-destructive-text">
          {addError}
        </p>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {cfg.sections.map((s) => (
          <SectionCard
            key={s.key}
            accent={cfg.accent}
            section={s}
            cap={capOf(s)}
            capLocked={s.key === "bits"}
            onCap={(v) => setCap(s.key, v)}
            items={list(s.key)}
            onAdd={(files) => addFiles(s.key, files)}
            onRemove={(id) => remove(s.key, id)}
          />
        ))}
      </div>

      {/* Mobile-only sticky export — keeps the payoff one tap away as you scroll
          the sections; on sm+ the top toolbar button is always in view. */}
      {total > 0 && (
        <div className="sticky bottom-0 z-10 -mx-5 border-t border-border bg-background/95 px-5 py-3 backdrop-blur sm:hidden">
          <Button onClick={doExport} className="w-full">
            <Download /> Export showcase PNG
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBar({
  platform,
  accent,
  accentText,
  status,
  setStatus,
  subPoints,
  setSubPoints,
  level,
  boosts,
  levels,
  onLevel,
  onBoosts,
}) {
  const twitch = platform === "twitch";
  const next = twitch ? nextMilestone(status, subPoints) : null;

  // Left = the mono status chip; right = a plain-English "what's next" line.
  const chip = twitch
    ? `${TWITCH_STATUS[status].label} · ${subPoints || 0} sub pts`
    : `Level ${level} · ${boosts || 0} boost${boosts === 1 ? "" : "s"}`;
  const nextLine = twitch
    ? next
      ? `Next Tier 1 + animated slot unlocks at ${next} sub points`
      : "All listed slots unlocked"
    : level < 3
      ? `${BOOSTS_FOR_LEVEL[level + 1] - (boosts || 0)} more boosts to reach Level ${level + 1}`
      : "Max boost level reached";

  return (
    <div
      className="panel relative overflow-hidden"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <div className="flex flex-col gap-4 py-4 pl-5 pr-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:pl-6">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: accent }}
            />
            <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: accent }} />
          </span>
          <span className="u-label">{twitch ? "Your channel" : "Your server"}</span>
        </div>

        {twitch ? (
          <>
            <Segmented
              label="Status"
              showLabel
              value={status}
              onChange={setStatus}
              options={Object.entries(TWITCH_STATUS).map(([k, v]) => [k, v.label])}
            />
            <div className="space-y-1.5">
              <Stepper label="Sub points" value={subPoints} onChange={setSubPoints} step={5} />
              <p className="max-w-[15rem] text-[11px] leading-tight text-muted-foreground">
                Sub points = Tier 1 ×1 + Tier 2 ×2 + Tier 3 ×6 (Dashboard → Insights).
              </p>
            </div>
          </>
        ) : (
          <>
            <Segmented
              label="Boost level"
              showLabel
              value={String(level)}
              onChange={(v) => onLevel(Number(v))}
              options={levels.map((_, i) => [String(i), `Level ${i}`])}
            />
            <Stepper label="Boosts" value={boosts} onChange={onBoosts} step={1} />
          </>
        )}

        {/* Readout — pushes right on wide screens, stacks on mobile */}
        <div className="sm:ml-auto sm:text-right">
          <div className="font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg">
            {chip}
          </div>
          <div className="text-xs" style={{ color: accentText }}>
            {nextLine}
          </div>
        </div>
      </div>

      {twitch && (
        <details className="border-t border-border/60 px-5 py-2 text-xs text-muted-foreground sm:px-6">
          <summary className="cursor-pointer select-none font-medium hover:text-foreground">
            How slots grow
          </summary>
          <p className="mt-2 leading-relaxed">
            You start with {TWITCH_STATUS[status].start}. Every milestone at{" "}
            {TWITCH_STATUS[status].milestones.join(" / ")} sub points unlocks one more Tier 1 static
            slot and one more animated slot — and they stay unlocked. Edit any slot number below to
            match exactly what your Creator Dashboard shows.
          </p>
        </details>
      )}
    </div>
  );
}

function SectionCard({ accent, section, cap, capLocked, onCap, items, onAdd, onRemove }) {
  const { isOver, dropHandlers, open, inputProps } = useFileDrop(onAdd);
  const overCap = cap != null && items.length > cap;

  return (
    <section
      aria-label={section.label}
      {...dropHandlers}
      className={cn(
        "panel p-4 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-foreground">{section.label}</h3>
          <span className={cn("font-mono text-xs tabular-nums", overCap ? "text-destructive-text" : "text-muted-foreground")}>
            {items.length}
          </span>
          <span className="font-mono text-xs text-muted-foreground">/</span>
          {capLocked ? (
            <span
              className="font-mono text-xs text-muted-foreground"
              aria-label={`Slot limit ${cap}, fixed by Twitch`}
            >
              {cap}
            </span>
          ) : (
            <input
              type="number"
              min={0}
              value={cap ?? 0}
              onChange={(e) => onCap(e.target.value)}
              aria-label={`${section.label} slot limit — edit to match your dashboard`}
              className="w-14 rounded border border-input bg-transparent px-1 py-0.5 text-center font-mono text-base text-foreground underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          )}
          <span className="u-label">slots</span>
        </div>
        <Button size="sm" variant="ghost" className="px-3 text-xs" onClick={open}>
          <ImagePlus /> Add
        </Button>
      </div>

      <p className="mb-3 font-mono text-[11px] text-muted-foreground">
        {section.spec} · <span className="text-foreground/70">{section.where}</span>
      </p>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={open}
          className="checker flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Drop {section.label} emotes here, or click to add
        </button>
      ) : (
        <ul className="checker flex flex-wrap gap-3 rounded-lg p-3">
          {items.map((it, i) => {
            const flagged = cap != null && i >= cap;
            return (
              <li key={it.id} className="group relative">
                <img
                  src={it.url}
                  alt={it.name}
                  title={it.name}
                  style={{ width: section.thumb, height: section.thumb }}
                  className={cn(
                    "rounded-md object-contain ring-1 ring-inset ring-white/10",
                    flagged && "ring-2 ring-destructive",
                  )}
                />
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  aria-label={`Remove ${it.name}`}
                  // Always in the DOM/tab order (never display:none). Visually
                  // revealed on hover/focus on fine pointers, but ALWAYS shown
                  // on touch/coarse pointers where there is no hover.
                  className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {overCap && (
        <p className="mt-2 text-xs text-destructive-text">
          {items.length - cap} over your {cap}-slot limit — trim the set or unlock more slots.
        </p>
      )}

      <input {...inputProps} multiple />
    </section>
  );
}

// Compact −/N/+ number control that also accepts direct typing. Not a <label>
// (a label must not wrap the ± buttons) — a labelled group with an aria-labelled
// input instead.
function Stepper({ label, value, onChange, step = 1 }) {
  const inputId = `stepper-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={`${inputId}-label`} className="space-y-1.5">
      <span id={`${inputId}-label`} className="u-label block">{label}</span>
      <div className="flex items-center rounded-lg bg-muted p-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, (value || 0) - step))}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8"
        >
          <Minus className="size-4" />
        </button>
        <input
          id={inputId}
          type="number"
          min={0}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-14 bg-transparent text-center font-mono text-base tabular-nums text-foreground outline-none sm:text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange((value || 0) + step)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

// Derive the add/delete checklist from the current set + slot caps.
function buildTodos(cfg, platform, list, capOf) {
  const todos = [];
  for (const s of cfg.sections) {
    const n = list(s.key).length;
    const cap = capOf(s);
    if (cap != null && n < cap)
      todos.push({ id: `add-${s.key}`, kind: "add", text: `Add ${cap - n} more to ${s.label}`, sub: `${n} / ${cap} slots filled` });
    if (cap != null && n > cap)
      todos.push({ id: `del-${s.key}`, kind: "del", text: `Remove ${n - cap} from ${s.label}`, sub: `${n} / ${cap} — over by ${n - cap}` });
  }
  // Duplicate names across the whole platform (7TV/BTTV overlap, copy-paste, etc.)
  const names = {};
  for (const s of cfg.sections)
    for (const it of list(s.key)) (names[it.name.toLowerCase()] ??= []).push(s.label);
  for (const [name, where] of Object.entries(names))
    if (where.length > 1)
      todos.push({ id: `dup-${name}`, kind: "dup", text: `Duplicate name "${name}"`, sub: [...new Set(where)].join(", ") });
  // Off-spec: not square, or over the KB cap (only when we know the byte size).
  for (const s of cfg.sections) {
    const { maxKB, square } = offSpec(platform, s.key);
    for (const it of list(s.key)) {
      if (square && it.img && it.img.naturalWidth !== it.img.naturalHeight)
        todos.push({ id: `sq-${it.id}`, kind: "spec", text: `${it.name} isn't square`, sub: `${it.img.naturalWidth}×${it.img.naturalHeight} · ${s.label}` });
      if (it.bytes > 0 && it.bytes > maxKB * 1024)
        todos.push({ id: `kb-${it.id}`, kind: "spec", text: `${it.name} is too big`, sub: `${Math.round(it.bytes / 1024)} KB > ${maxKB} KB · ${s.label}` });
    }
  }
  return todos;
}

const TODO_KIND = {
  add: { label: "Add", cls: "text-success-text" },
  del: { label: "Delete", cls: "text-destructive-text" },
  dup: { label: "Dupe", cls: "text-warning-text" },
  spec: { label: "Fix", cls: "text-warning-text" },
};

function TodoList({ todos, done, onToggle }) {
  const open = todos.filter((t) => !done.has(t.id)).length;
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListTodo className="size-4 text-primary-text" aria-hidden="true" />
        <h3 className="font-display text-base font-semibold text-foreground">To-do</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {open === 0 ? "all clear" : `${open} open`}
        </span>
      </div>
      <ul className="space-y-1">
        {todos.map((t) => {
          const checked = done.has(t.id);
          const k = TODO_KIND[t.kind];
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                aria-pressed={checked}
                className="flex min-h-11 w-full items-start gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {checked && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("text-sm", checked && "text-muted-foreground line-through")}>
                    <span className={cn("mr-1.5 font-mono text-[11px] uppercase tracking-wide", k.cls)}>
                      {k.label}
                    </span>
                    <span className={checked ? "text-muted-foreground" : "text-foreground"}>{t.text}</span>
                  </span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{t.sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
