import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { compileExplicitVoxelSpec, fakeExplicitPlan, toMcfunction } from "./explicitVoxel";
import { Viewer } from "./Viewer";
import type { ExplicitVoxelSpec } from "./explicitVoxel";
import type { CompiledStructure } from "./types";
import { AuthPanel } from "./AuthPanel";
import "./styles.css";

const presets = [
  "A small modern house with glass windows",
  "A medieval castle tower with a roof",
  "A wooden bridge over a river",
  "A Japanese temple with a curved roof",
];

const aiProvider = import.meta.env.VITE_AI_PROVIDER ?? "fake";

type GenerationPayload = { spec?: ExplicitVoxelSpec; mode?: string; model?: string; pipeline?: string; stages?: string[]; usage?: { prompt?: { totalTokenCount?: number }; parts?: { totalTokenCount?: number }; total?: number }; scenePlan?: { partCount?: number; mode?: string }; optimization?: { optimizedPrompt?: string; subject?: string; silhouette?: string; palette?: string[]; focalFeatures?: string[]; orientation?: string; buildConstraints?: string[] }; qualityReport?: { blockCount?: number; rejected?: number; detachedRemoved?: number; connectedComponents?: number; missingRequestedColors?: string[]; promptOptimized?: boolean; attempts?: number }; error?: string };

async function planBuild(prompt: string, size: "small" | "medium" | "large", referenceImage?: string, model?: string, forceDirectDraw?: boolean): Promise<GenerationPayload> {
  if (aiProvider !== "gemini") {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    return { spec: fakeExplicitPlan(), mode: "architecture", model: "explicit-demo" };
  }
  const response = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, size, model, forceDirectDraw, ...(referenceImage ? { referenceImage } : {}) }) });
  const payload = await response.json() as GenerationPayload;
  if (!response.ok || !payload.spec) throw new Error(payload.error || "Gemini explicit voxel generation failed.");
  return payload;
}

function promptMode(prompt: string) {
  const text = prompt.toLowerCase();
  if (/\b(car|truck|vehicle|airplane|aircraft|jet|helicopter|ship|boat|rocket|bus|train|motorcycle)\b/.test(text)) return "Vehicle";
  if (/\b(pixel art|pixel-art|sprite|8-bit|16-bit)\b/.test(text)) return "Pixel art";
  if (/\b(house|castle|tower|building|bridge|temple|church|cathedral|pyramid|fortress|wall|gate|arch|dome|cabin|cottage|palace|mansion|barn|lighthouse|monument|skyscraper|hut|shrine|mosque|windmill|mill|farm|fountain|pool|well|pier|dock|harbor|station|garage|warehouse|shop|store|market|school|library|hospital|prison|dungeon|arena|fort|tavern|inn|villa|bunker|shelter|igloo|pagoda|minaret|obelisk|stable|silo|greenhouse|gazebo|pavilion|amphitheatre|colosseum|aqueduct)\b/.test(text)) return "Architecture";
  if (/\b(object|prop|ball|soccer|soccerball|football|sword|chair|table|lamp|guitar|tool|chest|hat|helmet|statue|figure|flower|tree|logo)\b/.test(text)) return "Object";
  return "Character";
}

function materialColor(block: string) {
  const colors: Array<[string, string]> = [
    ["light_blue", "#4cc7d9"], ["blue", "#3f75c5"], ["yellow", "#f5d547"], ["orange", "#e87528"],
    ["red", "#d64747"], ["black", "#161b24"], ["white", "#f2f4f7"], ["light_gray", "#9d9d97"],
    ["gray", "#4b4d52"], ["green", "#5b8c3a"], ["lime", "#83c43b"], ["purple", "#8e3db4"],
    ["pink", "#e997b8"], ["cyan", "#169c9c"], ["brown", "#8f5b3e"], ["wood", "#9b623c"],
    ["glass", "#8ad9e8"], ["deepslate", "#394353"],
  ];
  return colors.find(([token]) => block.includes(token))?.[1] ?? "#8d98a6";
}

function App() {
  const [prompt, setPrompt] = useState(presets[0]);
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [structure, setStructure] = useState<CompiledStructure | null>(null);
  const [status, setStatus] = useState("Ready for your first build.");
  const [busy, setBusy] = useState(false);
  const [generatedMode, setGeneratedMode] = useState("Architecture");
  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("blockdraft.history") ?? "[]") as string[]; } catch { return []; }
  });
  const [forceDirectDraw, setForceDirectDraw] = useState(() => localStorage.getItem("blockdraft.forceDirectDraw") === "true");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceDataUrl, setReferenceDataUrl] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState("");
  const materialRows = useMemo(() => structure ? Object.entries(structure.histogram).sort((a, b) => b[1] - a[1]) : [], [structure]);

  useEffect(() => { localStorage.setItem("blockdraft.history", JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem("blockdraft.forceDirectDraw", String(forceDirectDraw)); }, [forceDirectDraw]);

  const generate = async () => {
    if (prompt.trim().length < 4) { setStatus("Please describe a structure first."); return; }
    setBusy(true);
    const stages = ["Designing blueprint", "Planning parts", "Calculating voxels", "Validating structure", "Assembling blocks"];
    let stageIndex = 0;
    const stageTimer = window.setInterval(() => { stageIndex = Math.min(stageIndex + 1, stages.length - 1); setStatus(`${stages[stageIndex]} …`); }, 1800);
    setStatus(`${stages[0]} …`);
    setStatus(referenceImage ? "Photo reference ready. Planning your build …" : `${aiProvider === "gemini" ? "Gemini" : "The demo planner"} is preparing your build …`);
    try {
      const planned = await planBuild(prompt, size, referenceDataUrl ?? undefined, selectedModel, forceDirectDraw);
      const result = compileExplicitVoxelSpec(planned.spec!);
      if (planned.qualityReport?.detachedRemoved) result.warnings.push(`${planned.qualityReport.detachedRemoved} detached voxels were removed by connectivity validation.`);
      if (planned.qualityReport?.missingRequestedColors?.length) result.warnings.push(`Requested colors missing from occupied voxels: ${planned.qualityReport.missingRequestedColors.map((color) => color.replace("minecraft:", "")).join(", ")}.`);
      const mode = planned.mode ? `${planned.mode[0].toUpperCase()}${planned.mode.slice(1).replace("_", " ")}` : promptMode(prompt);
      setGeneratedMode(mode);
      setOptimizedPrompt(planned.optimization?.optimizedPrompt ?? "");
      setStructure(result);
      setHistory((items) => [prompt, ...items.filter((item) => item !== prompt)].slice(0, 5));
      setStatus(`Ready: ${result.blocks.length.toLocaleString("en-US")} blocks compiled · ${mode} mode${planned.optimization ? " · prompt enhanced" : ""}.`);
      window.setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Generation failed."); }
    finally { window.clearInterval(stageTimer); setBusy(false); }
  };

  const download = () => {
    if (!structure) return;
    const blob = new Blob([toMcfunction(structure)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "blockdraft-build.mcfunction"; anchor.click(); URL.revokeObjectURL(url);
    setStatus("The .mcfunction file was created and downloaded locally.");
  };

  const remixPrompt = () => { setPrompt(`${prompt} with a new roof shape and an alternative material palette`); setStatus("Remix prompt loaded. Generate a new variation when ready."); document.getElementById("create")?.scrollIntoView({ behavior: "smooth" }); };

  const chooseReference = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) { setStatus("Please choose an image up to 8 MB."); return; }
    if (referenceImage) URL.revokeObjectURL(referenceImage);
    const previewUrl = URL.createObjectURL(file);
    setReferenceImage(previewUrl); setReferenceName(file.name);
    const reader = new FileReader();
    reader.onload = () => setReferenceDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    setStatus("Photo loaded. It will be sent only when you generate this prompt.");
  };

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand-lockup" href="#create"><span className="brand-mark">✦</span><span><span className="brand">BlockDraft</span><span className="tagline">AI BUILD STUDIO</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><a className="active" href="#create">CREATE</a><a href="#gallery">GALLERY</a><a href="#how-it-works">HOW IT WORKS</a><a href="#pricing">PRICING</a></nav>
      <div className="topbar-actions"><AuthPanel /><span className="local-pill">LAN READY</span></div>
    </header>

    <main>
      <section id="create" className="create-page">
        <div className="hero-copy"><div className="eyebrow">AI MINECRAFT BUILDER</div><h1><span className="gradient-text">Text to blocks.</span><br />What will you build today?</h1><p>Describe a structure, preview it in 3D and export a ready-to-use Minecraft blueprint.</p></div>
        <div className="prompt-ideas"><span>Prompt ideas:</span><button className="refresh-button" aria-label="Refresh prompt ideas" onClick={() => setPrompt(presets[Math.floor(Math.random() * presets.length)])}>↻</button>{presets.slice(0, 3).map((item) => <button className="idea-pill" key={item} onClick={() => setPrompt(item)}>{item.replace(/^A /, "").replace(/^a /, "")}</button>)}</div>

        <section className="composer-card" aria-label="Build prompt composer">
          <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} placeholder="Describe your Minecraft build idea …" aria-label="Build idea" />
          <div className="composer-footer"><div className="composer-pills"><span className="selected-pill">{promptMode(prompt)} <button aria-label="Detected generation mode">×</button></span><span className="selected-pill">{size[0].toUpperCase() + size.slice(1)} <button aria-label="Remove size">×</button></span><label className="icon-pill" title="Use a photo reference">📷<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseReference(event.target.files?.[0])} /></label></div><button className="send-button" onClick={generate} disabled={busy} aria-label="Generate build">{busy ? "…" : "➤"}</button></div>
          <div className="composer-tools"><button className="advanced-toggle" onClick={() => setAdvanced((value) => !value)}>Advanced <span>{advanced ? "⌃" : "⌄"}</span></button><a href="#how-it-works">▷ How to use</a></div>
          {advanced && <div className="advanced-panel"><label className="advanced-field"><span>Build size</span><select value={size} onChange={(event) => setSize(event.target.value as typeof size)}><option value="small">Small · fast</option><option value="medium">Medium · recommended</option><option value="large">Large · experimental</option></select></label><label className="advanced-field"><span>Generation model</span><select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}><option value="gemini-3-flash-preview">gemini-3-flash-preview (fast)</option><option value="gemini-3-flash">gemini-3-flash (stable)</option><option value="gemini-3.1-flash">gemini-3.1-flash</option><option value="gemini-3.5-flash">gemini-3.5-flash</option><option value="gemini-3.1-pro">gemini-3.1-pro (highest quality, slower)</option></select></label><label className="advanced-field checkbox-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}><input type="checkbox" checked={forceDirectDraw} onChange={(e) => setForceDirectDraw(e.target.checked)} /> <span>Force Direct Draw (Bypass Category)</span></label>{referenceImage && <div className="photo-preview"><img src={referenceImage} alt="Local photo reference" /><span>{referenceName}<small>Optional Gemini vision reference · sent for this generation only</small></span><button className="photo-clear" onClick={() => { URL.revokeObjectURL(referenceImage); setReferenceImage(null); setReferenceDataUrl(null); setReferenceName(""); }}>Remove</button></div>}</div>}
        </section>
        <div className="status-line" role="status"><span className={busy ? "pulse-dot" : "status-dot"} />{status}</div>
        {history.length > 0 && <div className="history-strip"><span>Recent:</span>{history.slice(0, 3).map((item) => <button className="history-item" key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>}
      </section>

      <section id="result" className="result-section" aria-label="Build result"><div className="section-heading"><div><div className="eyebrow">YOUR BLUEPRINT</div><h2>{structure ? "Preview and export" : "Your 3D preview will appear here"}</h2>{structure && <span className="quality-badge">{generatedMode} · two-pass compiled · layer validated</span>}{optimizedPrompt && <details className="optimized-prompt"><summary>View optimized design brief</summary><p>{optimizedPrompt}</p></details>}</div>{structure && <div className="preview-actions"><button className="secondary" onClick={remixPrompt}>↻ Remix</button><button className="secondary" onClick={download}>↓ Export .mcfunction</button></div>}</div>{structure ? <><div className="viewer-shell"><Viewer structure={structure} /></div><div className="stats"><div><strong>{structure.blocks.length.toLocaleString("en-US")}</strong><span>Blocks</span></div><div><strong>{structure.dimensions.x}×{structure.dimensions.y}×{structure.dimensions.z}</strong><span>Dimensions</span></div><div><strong>{materialRows.length}</strong><span>Materials</span></div></div><div className="materials">{materialRows.map(([block, count]) => <span key={block}><i style={{ background: materialColor(block) }} />{block.replace("minecraft:", "")} · {count}</span>)}</div>{structure.warnings.map((warning) => <div className="warning" key={warning}>⚠ {warning}</div>)}</> : <div className="empty-preview"><div className="cube-icon">◇</div><p>Your generated structure will appear here.<br />Start with a prompt above.</p></div>}</section>

      <section id="gallery" className="info-section"><div className="section-heading"><div><div className="eyebrow">COMMUNITY BUILDS</div><h2>Explore the gallery</h2></div><button className="secondary">View all builds</button></div><div className="gallery-grid"><div className="gallery-card"><div className="gallery-art art-house">⌂</div><span>Modern courtyard</span><small>Remixable blueprint</small></div><div className="gallery-card"><div className="gallery-art art-tower">◈</div><span>Watchtower study</span><small>1,240 blocks</small></div><div className="gallery-card"><div className="gallery-art art-temple">△</div><span>Mountain temple</span><small>Community pick</small></div></div></section>

      <section id="how-it-works" className="info-section split-info"><div><div className="eyebrow">HOW IT WORKS</div><h2>From rough idea to playable build.</h2><p>BlockDraft turns a short description into a bounded, validated blueprint. Inspect the result before you export it to Minecraft.</p></div><div className="steps"><div><b>01</b><span>Describe</span><small>Tell us what to build.</small></div><div><b>02</b><span>Preview</span><small>Review the geometry in 3D.</small></div><div><b>03</b><span>Export</span><small>Place it in your world.</small></div></div></section>

      <section id="pricing" className="info-section pricing-section"><div><div className="eyebrow">SIMPLE PRICING</div><h2>Start building for free.</h2><p>One daily build during the private alpha. No credit card required.</p></div><div className="pricing-card"><strong>Free alpha</strong><span>1 build per day</span><span>3D preview and Java export</span><button className="primary" onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}>Start creating</button></div></section>
    </main>
    <footer><span>BlockDraft · AI build studio</span><span>AI provider: {aiProvider === "gemini" ? "Gemini" : "FakePlanner"} · Export: Minecraft Java</span></footer>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
