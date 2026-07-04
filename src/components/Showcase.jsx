import { useRef, useState } from "react";
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
import { exportShowcase } from "@/lib/exportGrid";
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

const ACCEPT = /\.(png|gif|jpe?g|webp)$/i;
const ACCEPT_TYPE = /^image\/(png|gif|jpeg|webp)$/;

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
  const [done, setDone] = useState(() => new Set()); // checked-off todo ids
  // Per-section cap overrides so you can match your real dashboard numbers.
  const [overrides, setOverrides] = useState({}); // "<platform>:<section>" -> number
  // { "<platform>:<sectionKey>": Item[] } — Item = { id, name, url, img, bytes }
  const [store, setStore] = useState({});
  const nextId = useRef(0);

  const cfg = PLATFORMS[platform];
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
    const files = [...(fileList ?? [])].filter(
      (f) => ACCEPT_TYPE.test(f.type) || ACCEPT.test(f.name),
    );
    const px = uploadPx(platform, sectionKey);
    for (const file of files) {
      const id = nextId.current++;
      const name = file.name.replace(/\.[^.]+$/, "");
      const isGif = /gif/i.test(file.type) || /\.gif$/i.test(file.name);
      if (isGif) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => pushItem(sectionKey, { id, name, url, img, bytes: file.size, animated: true });
        img.src = url;
      } else {
        try {
          const { dataUrl, bytes } = await squareDataUrl(file, px);
          const img = new Image();
          img.onload = () => pushItem(sectionKey, { id, name, url: dataUrl, img, bytes, resized: true });
          img.src = dataUrl;
        } catch {
          /* unreadable image — skip it */
        }
      }
    }
  }

  function remove(sectionKey, id) {
    setStore((prev) => {
      const k = keyOf(sectionKey);
      const arr = prev[k] ?? [];
      const gone = arr.find((it) => it.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return { ...prev, [k]: arr.filter((it) => it.id !== id) };
    });
  }

  function clearPlatform() {
    setStore((prev) => {
      const next = { ...prev };
      for (const s of cfg.sections) {
        const k = keyOf(s.key);
        (next[k] ?? []).forEach((it) => URL.revokeObjectURL(it.url));
        delete next[k];
      }
      return next;
    });
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
    const ok = exportShowcase(
      { title: title || cfg.label, subtitle, accent: cfg.accent, blocks },
      `${(title || cfg.label).toLowerCase().replace(/\s+/g, "-")}-${cfg.key}-showcase.png`,
    );
    ok.then?.((v) => v === false && alert("Add some emotes first, then export."));
  }

  const todos = buildTodos(cfg, platform, list, capOf);

  return (
    <div className="space-y-5">
      {/* Toolbar: platform · title · export */}
      <div className="flex flex-wrap items-end justify-center gap-3">
        <Segmented
          label="Platform"
          value={platform}
          onChange={setPlatform}
          options={Object.values(PLATFORMS).map((p) => [p.key, p.label])}
        />
        <label className="block space-y-1.5">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Showcase title
          </span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 w-44 font-mono"
          />
        </label>
        <div className="flex gap-2">
          <Button onClick={doExport} disabled={total === 0}>
            <Download /> Export PNG
          </Button>
          {total > 0 && (
            <Button variant="ghost" onClick={clearPlatform} aria-label="Clear all">
              <Trash2 /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Status console — declare where you stand so the slots are real */}
      <StatusBar
        platform={platform}
        accent={cfg.accent}
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

      <p className="mx-auto max-w-2xl text-center text-xs text-muted-foreground">{cfg.note}</p>

      {/* Load current emotes from a channel (Twitch only) */}
      {platform === "twitch" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Load current emotes from a channel
            </span>
            <div className="flex gap-2">
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && loadFromChannel(channel)}
                placeholder="your_twitch_name"
                className="font-mono"
              />
              <Button onClick={() => loadFromChannel(channel)} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <DownloadCloud />} Load
              </Button>
            </div>
          </label>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Pulls your Tier 1 / 2 / 3 sub emotes (static + animated) straight from Twitch — no login.
            Follower &amp; Bit emotes aren't exposed here; add those by hand.
          </p>
          {loadError && <p className="mt-2 text-xs text-destructive">{loadError}</p>}
          {loadMsg && !loadError && <p className="mt-2 text-xs text-emerald-400">{loadMsg}</p>}
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
    </div>
  );
}

function StatusBar({
  platform,
  accent,
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

  // Right-hand readout: the "you are here" line, in console mono.
  const readout = twitch
    ? [
        TWITCH_STATUS[status].label.toUpperCase(),
        `${subPoints || 0} SUB PTS`,
        next ? `NEXT SLOT @ ${next}` : "ALL LISTED SLOTS UNLOCKED",
      ]
    : [
        `LEVEL ${level}`,
        `${boosts || 0} BOOST${boosts === 1 ? "" : "S"}`,
        level < 3
          ? `+${BOOSTS_FOR_LEVEL[level + 1] - (boosts || 0)} → L${level + 1}`
          : "MAX LEVEL",
      ];

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-card"
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4 pl-6 pr-4">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: accent }}
            />
            <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: accent }} />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {twitch ? "Your channel" : "Your server"}
          </span>
        </div>

        {twitch ? (
          <>
            <Segmented
              label="Status"
              value={status}
              onChange={setStatus}
              options={Object.entries(TWITCH_STATUS).map(([k, v]) => [k, v.label])}
            />
            <Stepper label="Sub points" value={subPoints} onChange={setSubPoints} step={5} />
          </>
        ) : (
          <>
            <Segmented
              label="Boost level"
              value={String(level)}
              onChange={(v) => onLevel(Number(v))}
              options={levels.map((_, i) => [String(i), `L${i}`])}
            />
            <Stepper label="Boosts" value={boosts} onChange={onBoosts} step={1} />
          </>
        )}

        {/* Readout — pushes right on wide screens */}
        <div className="ml-auto text-right">
          <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {readout[0]} <span className="text-muted-foreground">·</span> {readout[1]}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wider" style={{ color: accent }}>
            {readout[2]}
          </div>
        </div>
      </div>

      {twitch && (
        <p className="border-t border-border/60 px-6 py-2 font-mono text-[11px] text-muted-foreground">
          start: {TWITCH_STATUS[status].start} · +1 static & +1 animated at{" "}
          {TWITCH_STATUS[status].milestones.join(" / ")} sub pts
        </p>
      )}
    </div>
  );
}

function SectionCard({ accent, section, cap, capLocked, onCap, items, onAdd, onRemove }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const overCap = cap != null && items.length > cap;

  return (
    <section
      aria-label={section.label}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onAdd(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-colors",
        over && "border-primary bg-primary/5",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: accent }} />
          <h3 className="font-display text-base font-semibold text-foreground">{section.label}</h3>
          <span
            className={cn(
              "font-mono text-xs",
              overCap ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {items.length}
          </span>
          <span className="font-mono text-xs text-muted-foreground">/</span>
          {capLocked ? (
            <span className="font-mono text-xs text-muted-foreground" title="Fixed by Twitch">
              {cap}
            </span>
          ) : (
            <input
              type="number"
              min={0}
              value={cap ?? 0}
              onChange={(e) => onCap(e.target.value)}
              aria-label={`${section.label} slot limit`}
              className="w-12 rounded border border-input bg-transparent px-1 py-0.5 text-center font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          )}
          <span className="font-mono text-[11px] text-muted-foreground">slots</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => input.current?.click()}>
          <ImagePlus className="!size-3.5" /> Add
        </Button>
      </div>

      <p className="mb-3 font-mono text-[11px] text-muted-foreground">
        {section.spec} · <span className="text-foreground/70">{section.where}</span>
      </p>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="checker flex w-full items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground transition-colors hover:border-primary/60"
        >
          Drop {section.label.toLowerCase()} here, or click to add
        </button>
      ) : (
        <div className="checker flex flex-wrap gap-3 rounded-lg p-3">
          {items.map((it, i) => {
            const flagged = cap != null && i >= cap;
            return (
              <div key={it.id} className="group relative">
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
                  className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {overCap && (
        <p className="mt-2 text-xs text-destructive">
          {items.length - cap} over your {cap}-slot limit — trim the set or unlock more slots.
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/png,image/gif,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

// Compact −/N/+ number control that also accepts direct typing.
function Stepper({ label, value, onChange, step = 1 }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center rounded-lg bg-muted p-[3px]">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, (value || 0) - step))}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-12 bg-transparent text-center font-mono text-sm text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange((value || 0) + step)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </label>
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
  add: { label: "Add", cls: "text-emerald-400" },
  del: { label: "Delete", cls: "text-destructive" },
  dup: { label: "Dupe", cls: "text-amber-400" },
  spec: { label: "Fix", cls: "text-amber-400" },
};

function TodoList({ todos, done, onToggle }) {
  const open = todos.filter((t) => !done.has(t.id)).length;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListTodo className="size-4 text-primary" />
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
                className="flex w-full items-start gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/5"
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
                    <span className={cn("mr-1.5 font-mono text-[10px] uppercase tracking-wide", k.cls)}>
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

function Segmented({ label, value, onChange, options }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-lg bg-muted p-[3px]">
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </label>
  );
}
