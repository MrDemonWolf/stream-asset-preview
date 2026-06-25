import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Radio, Search, Sparkles } from "lucide-react";

import { AssetCard } from "@/components/AssetCard";
import { ChatStudio } from "@/components/ChatStudio";
import { DropZone } from "@/components/DropZone";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopy } from "@/lib/clipboard";
import { loadFromManifest } from "@/lib/loadAssets";

const BADGE_SIZES = [18, 36, 72];
const EMOTE_SIZES = [28, 56, 112];

export default function App() {
  const [data, setData] = useState({ badges: [], emotes: [] });
  const [source, setSource] = useState(null); // "scan" | "local" | null
  const [tab, setTab] = useState("badges");
  const [query, setQuery] = useState("");
  const { copied, copy } = useCopy();

  // Auto-scan the built manifest on load. No manifest / empty = silent; the
  // drop zone and Chat Studio are always available regardless.
  useEffect(() => {
    loadFromManifest()
      .then((d) => {
        if (d.badges.length || d.emotes.length) {
          setData(d);
          setSource("scan");
        }
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s) => !q || s.toLowerCase().includes(q);
    return {
      badges: data.badges.filter((b) => match(b.name)),
      emotes: data.emotes.filter((e) => match(e.code)),
    };
  }, [data, query]);

  const hasAny = data.badges.length > 0 || data.emotes.length > 0;
  const showSearch = tab !== "chat";

  function onLoad(parsed) {
    setData(parsed);
    setSource("local");
    setQuery("");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-5 pb-24 pt-10 sm:px-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-primary">
          <Radio className="size-4" />
          <span className="font-mono text-xs uppercase tracking-[0.3em]">
            Stream Asset Previewer
          </span>
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Badges & emotes,
          <br className="hidden sm:block" /> at every broadcast size.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          See each asset rendered at the exact pixel sizes Twitch ships them.
          Auto-scans the served folders, drop a folder to preview locally, or
          upload a custom badge/emote in Chat Studio — nothing leaves your browser.
        </p>
        {source && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground">
            <Sparkles className="size-3 text-primary" />
            {source === "scan" ? "Auto-scanned from manifest" : "Loaded from your folder"}
            <span className="text-border">·</span>
            {data.badges.length} badges, {data.emotes.length} emotes
          </p>
        )}
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="badges">
              Badges <span className="ml-1 font-mono text-xs opacity-60">{data.badges.length}</span>
            </TabsTrigger>
            <TabsTrigger value="emotes">
              Emotes <span className="ml-1 font-mono text-xs opacity-60">{data.emotes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare /> Chat Studio
            </TabsTrigger>
          </TabsList>

          {showSearch && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name…"
                className="pl-9 font-mono"
                aria-label="Filter assets by name"
              />
            </div>
          )}
        </div>

        <TabsContent value="badges" className="mt-6">
          {hasAny ? (
            <>
              <Grid
                items={filtered.badges}
                empty="No badges match that filter."
                render={(b) => (
                  <AssetCard key={b.name} asset={b} label="Badge" name={b.name} sizes={BADGE_SIZES} onCopy={copy} copied={copied} />
                )}
              />
              <div className="mt-10">
                <DropZone onLoad={onLoad} compact />
              </div>
            </>
          ) : (
            <DropZone onLoad={onLoad} />
          )}
        </TabsContent>

        <TabsContent value="emotes" className="mt-6">
          {hasAny ? (
            <>
              <Grid
                items={filtered.emotes}
                empty="No emotes match that filter."
                render={(e) => (
                  <AssetCard key={e.code} asset={e} label="Emote code" name={e.code} sizes={EMOTE_SIZES} onCopy={copy} copied={copied} />
                )}
              />
              <div className="mt-10">
                <DropZone onLoad={onLoad} compact />
              </div>
            </>
          ) : (
            <DropZone onLoad={onLoad} />
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <ChatStudio />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Grid({ items, render, empty }) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(render)}
    </div>
  );
}
