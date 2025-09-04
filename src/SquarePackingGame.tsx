/** Paste the full SquarePackingGame component code here (from canvas) **/
import React, { useEffect, useMemo, useRef, useState } from "react";

const colorForSize = (s: number, max: number) => `hsl(${Math.round((s - 1) * (360 / Math.max(1, max)))} 80% 55%)`;

type Placement = { id: number; size: number; x: number; y: number };
type HoverPreview = { size: number; x: number; y: number } | null;

export default function SquarePackingGame() {
  // maxSize N => grid is (N*(N+1)/2)^2 and sizes are 1..N with count = size
  const [maxSize, setMaxSize] = useState<number>(9);
  const gridSize = useMemo(() => (maxSize * (maxSize + 1)) / 2, [maxSize]);
  const sizes = useMemo(() => Array.from({ length: maxSize }, (_, i) => i + 1), [maxSize]);
  const initialCounts = useMemo(
    () => sizes.reduce<Record<number, number>>((acc, s) => { acc[s] = s; return acc; }, {}),
    [sizes]
  );

  const [grid, setGrid] = useState<number[]>(() => Array(gridSize * gridSize).fill(0));
  const [counts, setCounts] = useState<Record<number, number>>(initialCounts);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [hover, setHover] = useState<HoverPreview>(null);
  const nextPlacementId = useRef(1);
  const draggingSizeRef = useRef<number | null>(null);
  const draggingPlacementRef = useRef<Placement | null>(null);
  const dropHappenedRef = useRef(false);
  const [celebrated, setCelebrated] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  

  const filledCells = useMemo(() => grid.reduce((a, v) => a + (v ? 1 : 0), 0), [grid]);

  const canPlace = (x: number, y: number, size: number) => {
    if (x < 0 || y < 0 || x + size > gridSize || y + size > gridSize) return false;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const idx = (y + dy) * gridSize + (x + dx);
        if (grid[idx] !== 0) return false;
      }
    }
    return true;
  };

  const place = (x: number, y: number, size: number) => {
    if (!canPlace(x, y, size)) return false;
    const newGrid = grid.slice();
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const idx = (y + dy) * gridSize + (x + dx);
        newGrid[idx] = size;
      }
    }
    const id = nextPlacementId.current++;
    setGrid(newGrid);
    setPlacements((p) => [...p, { id, size, x, y }]);
    setCounts((c) => ({ ...c, [size]: c[size] - 1 }));
    return true;
  };

  const handleReset = () => {
    setGrid(Array(gridSize * gridSize).fill(0));
    setCounts(initialCounts);
    setPlacements([]);
    setHover(null);
    setCelebrated(false);
    setShowConfetti(false);
    setShowBanner(false);
  };

  const handleChangeMaxSize = (n: number) => {
    const newGridSize = (n * (n + 1)) / 2;
    const newSizes = Array.from({ length: n }, (_, i) => i + 1);
    const newCounts = newSizes.reduce<Record<number, number>>((acc, s) => { acc[s] = s; return acc; }, {});
    setMaxSize(n);
    setGrid(Array(newGridSize * newGridSize).fill(0));
    setCounts(newCounts);
    setPlacements([]);
    setHover(null);
    setCelebrated(false);
    setShowConfetti(false);
    setShowBanner(false);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, size: number) => {
    // Store size in a ref because most browsers block reading dataTransfer on dragover
    draggingSizeRef.current = size;
    e.dataTransfer.setData("application/json", JSON.stringify({ size }));
    // Provide a subtle drag image
    const drag = document.createElement("div");
    drag.style.width = "24px";
    drag.style.height = "24px";
    drag.style.background = colorForSize(size, maxSize);
    drag.style.border = "2px solid rgba(0,0,0,0.2)";
    drag.style.borderRadius = "6px";
    document.body.appendChild(drag);
    e.dataTransfer.setDragImage(drag, 12, 12);
    setTimeout(() => document.body.removeChild(drag), 0);
  };

  const parseDragData = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData("application/json");
    try {
      const d = JSON.parse(raw);
      if (typeof d?.size === "number" && d.size >= 1 && d.size <= maxSize) return d as { size: number };
    } catch {}
    return null;
  };

  const gridRef = useRef<HTMLDivElement | null>(null);

  const cellFromEvent = (e: React.DragEvent<HTMLDivElement>) => {
    const container = gridRef.current;
    if (!container) return { x: -1, y: -1 };
    const rect = container.getBoundingClientRect();
    const cellSizePx = rect.width / gridSize; // square grid
    const x = Math.floor((e.clientX - rect.left) / cellSizePx);
    const y = Math.floor((e.clientY - rect.top) / cellSizePx);
    return { x, y };
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Always prevent default so the drop can occur
    e.preventDefault();
    // Use the ref (since dataTransfer is not readable on dragover in most browsers)
    const size = draggingSizeRef.current;
    if (!size) {
      setHover(null);
      return;
    }
    const { x, y } = cellFromEvent(e);
    if (x < 0 || y < 0) {
      setHover(null);
      return;
    }
    setHover({ size, x, y });
  };

  const onDragLeave = () => setHover(null);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const data = parseDragData(e);
    if (!data) return;
    e.preventDefault();
    dropHappenedRef.current = true;
    const { x, y } = cellFromEvent(e);
    if (x < 0 || y < 0) return;
    // Check remaining count
    if (counts[data.size] <= 0) return;
    const ok = place(x, y, data.size);
    if (!ok) {
      // If repositioning failed, restore original placement
      const original = draggingPlacementRef.current;
      if (original) {
        // Restore original placement (and revert the count increment done on drag start)
        const newGrid = grid.slice();
        for (let dy = 0; dy < original.size; dy++) {
          for (let dx = 0; dx < original.size; dx++) {
            const idx = (original.y + dy) * gridSize + (original.x + dx);
            newGrid[idx] = original.size;
          }
        }
        setGrid(newGrid);
        setPlacements((p) => [...p, original]);
        setCounts((c) => ({ ...c, [original.size]: c[original.size] - 1 }));
      }
    }
    setHover(null);
    draggingSizeRef.current = null;
    draggingPlacementRef.current = null;
  };

  const findPlacementAt = (cx: number, cy: number) =>
    placements.find((p) => cx >= p.x && cx < p.x + p.size && cy >= p.y && cy < p.y + p.size) || null;

  const removePlacement = (pl: Placement) => {
    const newGrid = grid.slice();
    for (let dy = 0; dy < pl.size; dy++) {
      for (let dx = 0; dx < pl.size; dx++) {
        const idx = (pl.y + dy) * gridSize + (pl.x + dx);
        newGrid[idx] = 0;
      }
    }
    setGrid(newGrid);
    setPlacements((arr) => arr.filter((p) => p.id !== pl.id));
    setCounts((c) => {
      const max = initialCounts[pl.size] ?? pl.size;
      const next = Math.min(max, c[pl.size] + 1);
      return { ...c, [pl.size]: next };
    });
  };

  const handleGridContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    // Right-click to remove a placement under cursor
    e.preventDefault();
    const container = gridRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cellSizePx = rect.width / gridSize;
    const x = Math.floor((e.clientX - rect.left) / cellSizePx);
    const y = Math.floor((e.clientY - rect.top) / cellSizePx);
    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return;
    const pl = findPlacementAt(x, y);
    if (pl) removePlacement(pl);
  };

  const handlePlacementDragStart = (e: React.DragEvent<HTMLDivElement>, pl: Placement) => {
    // Begin repositioning a placed square
    draggingSizeRef.current = pl.size;
    draggingPlacementRef.current = pl;
    dropHappenedRef.current = false;
    e.dataTransfer.setData("application/json", JSON.stringify({ size: pl.size }));

    // Remove it from grid and increment count temporarily so placing is allowed
    removePlacement(pl);

    // Provide a small drag image
    const drag = document.createElement("div");
    drag.style.width = "24px";
    drag.style.height = "24px";
    drag.style.background = colorForSize(pl.size, maxSize);
    drag.style.border = "2px solid rgba(0,0,0,0.2)";
    drag.style.borderRadius = "6px";
    document.body.appendChild(drag);
    e.dataTransfer.setDragImage(drag, 12, 12);
    setTimeout(() => document.body.removeChild(drag), 0);
  };

  const handlePlacementDragEnd = () => {
    // If no successful drop occurred, restore original placement
    const original = draggingPlacementRef.current;
    if (original && !dropHappenedRef.current) {
      const newGrid = grid.slice();
      for (let dy = 0; dy < original.size; dy++) {
        for (let dx = 0; dx < original.size; dx++) {
          const idx = (original.y + dy) * gridSize + (original.x + dx);
          newGrid[idx] = original.size;
        }
      }
      setGrid(newGrid);
      setPlacements((p) => [...p, original]);
      // Decrement back the temporary increment done during drag start (clamped to 0)
      setCounts((c) => ({ ...c, [original.size]: Math.max(0, c[original.size] - 1) }));
    }
    draggingSizeRef.current = null;
    draggingPlacementRef.current = null;
    dropHappenedRef.current = false;
    setHover(null);
  };

  const isPreviewCell = (cx: number, cy: number) => {
    if (!hover) return false;
    const { x, y, size } = hover;
    return cx >= x && cx < x + size && cy >= y && cy < y + size;
  };

  const isPreviewValid = useMemo(() => {
    if (!hover) return false;
    return canPlace(hover.x, hover.y, hover.size);
  }, [hover, grid]);

  const remainingTotal = useMemo(() => sizes.reduce((a, s) => a + (counts[s] ?? 0), 0), [counts, sizes]);

  useEffect(() => {
    const full = filledCells === gridSize * gridSize;
    const allUsed = remainingTotal === 0;
    if (!celebrated && full && allUsed) {
      setCelebrated(true);
      setShowConfetti(true);
      setShowBanner(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      const tb = setTimeout(() => setShowBanner(false), 6000);
      return () => clearTimeout(t);
    }
  }, [filledCells, remainingTotal, celebrated, gridSize]);

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Square Packing Game</h1>
        <div className="flex items-center gap-2 text-sm md:text-base">
          <label className="ml-2 hidden sm:flex items-center gap-1">
            <span className="text-neutral-600 dark:text-neutral-400">Max square</span>
            <select
              value={maxSize}
              onChange={(e) => handleChangeMaxSize(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
            >
              {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n}×{n} (grid {(n * (n + 1)) / 2}×{(n * (n + 1)) / 2})</option>
              ))}
            </select>
          </label>
          <button onClick={handleReset} className="ml-2 px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-black shadow hover:opacity-90">Reset</button>
        </div>
      </header>

      {/* Stats row moved out of the top nav */}
      <div className="flex flex-wrap items-center gap-2 text-sm md:text-base">
        <span className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">Grid: {gridSize}×{gridSize}</span>
        <span className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">Filled: {filledCells} / {gridSize * gridSize}</span>
        <span className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">Pieces remaining: {remainingTotal}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-0">
        {/* Palette */}
        <aside className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3 md:p-4 flex flex-col gap-3">
          <h2 className="font-semibold">Palette</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Drag a colored square onto the grid. Each size has a limited count.</p>
          <div className="sm:hidden -mt-1">
            <label className="text-xs text-neutral-600 dark:text-neutral-400">Max square</label>
            <select
              value={maxSize}
              onChange={(e) => handleChangeMaxSize(Number(e.target.value))}
              className="mt-1 w-full px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
            >
              {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n}×{n} (grid {(n * (n + 1)) / 2}×{(n * (n + 1)) / 2})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sizes.slice().reverse().map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <div
                  draggable={counts[size] > 0}
                  onDragStart={(e) => handleDragStart(e, size)}
                  onDragEnd={() => { draggingSizeRef.current = null; }}
                  className="relative cursor-grab active:cursor-grabbing select-none"
                  title={`Drag ${size}×${size}`}
                >
                  <div
                    style={{ background: colorForSize(size, maxSize), width: `${Math.max(24, size * 6)}px`, height: `${Math.max(24, size * 6)}px` }}
                    className="rounded-lg shadow-inner border border-black/10"
                  />
                </div>
                <div className="text-xs text-center">
                  <div className="font-medium">{size}×{size}</div>
                  <div className="text-neutral-600 dark:text-neutral-400">Left: {counts[size]}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Grid */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3 md:p-4">
          <div
            ref={gridRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onContextMenu={handleGridContextMenu}
            className="relative aspect-square w-full overflow-hidden rounded-xl bg-white dark:bg-neutral-900"
          >
            {/* Grid cells */}
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: gridSize * gridSize }, (_, idx) => {
                const y = Math.floor(idx / gridSize);
                const x = idx % gridSize;
                const val = grid[idx];
                const inPreview = isPreviewCell(x, y);
                const previewColor = hover ? colorForSize(hover.size, maxSize) : "transparent";

                // Cell border layout: only render light borders to avoid heavy DOM
                return (
                  <div
                    key={idx}
                    className="relative border border-neutral-200/40 dark:border-neutral-800/60"
                    style={{
                      background:
                        val > 0
                          ? colorForSize(val, maxSize)
                          : inPreview
                          ? (isPreviewValid ? `${previewColor}AA` : `repeating-linear-gradient(45deg, #f87171AA, #f87171AA 6px, #0000 6px, #0000 12px)`) // red diagonal for invalid
                          : "transparent",
                    }}
                  />
                );
              })}
            </div>

            {/* Draggable overlays for placed pieces (for repositioning/removal) */}
            {placements.map((pl) => (
              <div
                key={pl.id}
                draggable
                onDragStart={(e) => handlePlacementDragStart(e, pl)}
                onDragEnd={handlePlacementDragEnd}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); removePlacement(pl); }}
                title={`Drag to move ${pl.size}×${pl.size} — right-click to remove`}
                className="absolute cursor-grab active:cursor-grabbing select-none"
                style={{
                  left: `${(pl.x / gridSize) * 100}%`,
                  top: `${(pl.y / gridSize) * 100}%`,
                  width: `${(pl.size / gridSize) * 100}%`,
                  height: `${(pl.size / gridSize) * 100}%`,
                  // Transparent overlay; actual color is drawn by cells beneath
                  background: "transparent",
                }}
              />
            ))}

            {/* Hover outline */}
            {hover && (
              <div
                className="pointer-events-none absolute rounded-md"
                style={{
                  left: `${(hover.x / gridSize) * 100}%`,
                  top: `${(hover.y / gridSize) * 100}%`,
                  width: `${(hover.size / gridSize) * 100}%`,
                  height: `${(hover.size / gridSize) * 100}%`,
                  outline: `3px ${isPreviewValid ? "solid rgba(0,0,0,0.6)" : "dashed rgba(239,68,68,0.9)"}`,
                }}
              />
            )}

            {/* Subtle grid overlay to improve visibility */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`, backgroundSize: `${100 / gridSize}% ${100 / gridSize}%` }} />
          </div>
        </div>
      </div>

      <footer className="text-xs text-neutral-600 dark:text-neutral-400">
        Tip: The total area of all required squares is 2,025 cells, which exactly matches a 45×45 grid. It might be possible to perfectly tile the board!
      </footer>

      {showConfetti && <ConfettiOverlay />}
      {showBanner && (
        <CompletionToast onClose={() => setShowBanner(false)} gridSize={gridSize} />
      )}
    </div>
  );
}

function ConfettiOverlay({ count = 140 }: { count?: number }) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100; // vw percent
      const size = 6 + Math.random() * 8;
      const rot = Math.random() * 360;
      const delay = Math.random() * 0.3; // seconds
      const duration = 2.6 + Math.random() * 1.2; // seconds
      const hue = Math.floor(Math.random() * 360);
      const color = `hsl(${hue} 80% 55%)`;
      const xdrift = (Math.random() * 2 - 1) * 30; // px
      return { id: i, left, size, rot, delay, duration, color, xdrift };
    });
  }, [count]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <style>{`
        @keyframes confetti-fall { from { transform: translate3d(0, -10%, 0) rotate(var(--rot)); opacity: 1; } to { transform: translate3d(var(--xdrift), 110%, 0) rotate(calc(var(--rot) + 360deg)); opacity: 1; } }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: `-10%`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            background: p.color,
            borderRadius: "2px",
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
            // CSS vars for keyframes
            // @ts-ignore - custom properties
            "--rot": `${p.rot}deg`,
            // @ts-ignore
            "--xdrift": `${p.xdrift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function CompletionToast({ onClose, gridSize }: { onClose: () => void; gridSize: number }) {
  return (
    <div className="fixed z-60 left-1/2 -translate-x-1/2 top-4">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-lg px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-50">
        <div className="mt-0.5">🎉</div>
        <div className="flex flex-col">
          <div className="font-semibold">Perfect tiling!</div>
          <div className="text-sm opacity-90">You packed the entire {gridSize}×{gridSize} grid.</div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 rounded-md px-2 py-1 text-sm border border-emerald-300 bg-white/70 hover:bg-white dark:border-emerald-800 dark:bg-emerald-800/40 dark:hover:bg-emerald-800/60"
        >
          Close
        </button>
      </div>
    </div>
  );
}
