// Range slider with anchored estimate.
// Three handles: low, mid (the "expected"), high.
// Mid stays clamped between low and high.
// Visual density: a soft gaussian-like gradient peaking at mid signals confidence.

const { useRef, useState, useEffect, useCallback } = React;

function fmtMoney(n) {
  if (n == null || !isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}k`;
}
function fmtMoneyFull(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

function RangeSlider({
  min, max, low, mid, high,
  onChange,           // (low, mid, high) =>
  trueValue,          // optional — for reveal
  revealed = false,
  showTicks = true,
  height = 88
}) {
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(null); // "low" | "mid" | "high"

  const pct = (v) => ((v - min) / (max - min)) * 100;

  // STEP: round to nearest $1k while dragging
  const STEP = 1000;
  const snap = (v) => Math.round(v / STEP) * STEP;

  const valueAtClient = useCallback((clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return snap(min + f * (max - min));
  }, [min, max]);

  // pick nearest handle on bare-track click
  const onTrackDown = (e) => {
    if (e.target !== trackRef.current && e.target.dataset.role !== "fill") return;
    const v = valueAtClient(e.clientX);
    const dL = Math.abs(v - low), dM = Math.abs(v - mid), dH = Math.abs(v - high);
    const which = dL <= dM && dL <= dH ? "low" : dH <= dM ? "high" : "mid";
    startDrag(which, e);
  };

  const startDrag = (which, e) => {
    e.preventDefault();
    setDrag(which);
    const v = valueAtClient(e.clientX);
    apply(which, v);
  };

  const apply = (which, v) => {
    v = Math.max(min, Math.min(max, v));
    let nL = low, nM = mid, nH = high;
    if (which === "low") {
      nL = Math.min(v, mid);
    } else if (which === "high") {
      nH = Math.max(v, mid);
    } else { // mid
      nM = Math.max(low, Math.min(high, v));
    }
    onChange(nL, nM, nH);
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => apply(drag, valueAtClient(e.clientX));
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, valueAtClient, low, mid, high]);

  // keyboard
  const onKey = (which) => (e) => {
    let step = STEP * (e.shiftKey ? 25 : 5);
    if (e.key === "ArrowLeft") { apply(which, ({low, mid, high})[which] - step); e.preventDefault(); }
    if (e.key === "ArrowRight") { apply(which, ({low, mid, high})[which] + step); e.preventDefault(); }
  };

  const lowPct = pct(low);
  const midPct = pct(mid);
  const highPct = pct(high);

  // density gradient — peaks at mid, falls off toward bounds (gaussian-ish)
  const halfWidth = Math.max(highPct - lowPct, 0.1);
  const sigma = Math.max(halfWidth / 2.8, 1.2);
  const stops = [];
  for (let i = 0; i <= 24; i++) {
    const p = lowPct + (highPct - lowPct) * (i / 24);
    const z = (p - midPct) / sigma;
    const alpha = Math.exp(-0.5 * z * z); // 0..1
    stops.push(`rgba(199, 90, 50, ${(0.10 + 0.55 * alpha).toFixed(3)}) ${p.toFixed(2)}%`);
  }
  const fillBg = `linear-gradient(90deg, ${stops.join(", ")})`;

  // tick stride
  const tickStep = (max - min) > 1_200_000 ? 200_000 : (max - min) > 600_000 ? 100_000 : 50_000;
  const ticks = [];
  for (let v = Math.ceil(min / tickStep) * tickStep; v <= max; v += tickStep) ticks.push(v);

  return (
    <div className="rs-root" style={{height}}>
      {/* numerical labels above */}
      <div className="rs-labels">
        <div className="rs-label rs-label-low" style={{left: `${lowPct}%`}}>
          <span className="rs-lab-cap">LOW</span>
          <span className="rs-lab-val">{fmtMoney(low)}</span>
        </div>
        <div className="rs-label rs-label-mid" style={{left: `${midPct}%`}}>
          <span className="rs-lab-cap">ESTIMATE</span>
          <span className="rs-lab-val rs-lab-val-mid">{fmtMoney(mid)}</span>
        </div>
        <div className="rs-label rs-label-high" style={{left: `${highPct}%`}}>
          <span className="rs-lab-cap">HIGH</span>
          <span className="rs-lab-val">{fmtMoney(high)}</span>
        </div>
      </div>

      <div className="rs-track" ref={trackRef} onMouseDown={onTrackDown}>
        {/* baseline */}
        <div className="rs-base" />

        {/* confidence fill (between low and high) */}
        <div
          className="rs-fill"
          data-role="fill"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%`, background: fillBg }}
        />

        {/* center crosshair through mid */}
        <div className="rs-midline" style={{ left: `${midPct}%` }} />

        {/* low handle */}
        <button
          className={`rs-handle rs-handle-edge ${drag === "low" ? "is-drag" : ""}`}
          style={{ left: `${lowPct}%` }}
          onMouseDown={(e) => startDrag("low", e)}
          onKeyDown={onKey("low")}
          aria-label="Low bound"
        >
          <span className="rs-handle-pip" />
        </button>

        {/* high handle */}
        <button
          className={`rs-handle rs-handle-edge ${drag === "high" ? "is-drag" : ""}`}
          style={{ left: `${highPct}%` }}
          onMouseDown={(e) => startDrag("high", e)}
          onKeyDown={onKey("high")}
          aria-label="High bound"
        >
          <span className="rs-handle-pip" />
        </button>

        {/* mid (anchor) */}
        <button
          className={`rs-handle rs-handle-mid ${drag === "mid" ? "is-drag" : ""}`}
          style={{ left: `${midPct}%` }}
          onMouseDown={(e) => startDrag("mid", e)}
          onKeyDown={onKey("mid")}
          aria-label="Estimate"
        >
          <span className="rs-handle-anchor">◆</span>
        </button>

        {/* revealed: actual market value flag */}
        {revealed && trueValue != null && (
          <div className="rs-truth" style={{ left: `${pct(trueValue)}%` }}>
            <div className="rs-truth-pin" />
            <div className="rs-truth-cap">ACTUAL</div>
            <div className="rs-truth-val">{fmtMoney(trueValue)}</div>
          </div>
        )}

        {/* tick marks */}
        {showTicks && (
          <div className="rs-ticks">
            {ticks.map(t => (
              <div key={t} className="rs-tick" style={{ left: `${pct(t)}%` }}>
                <span>{fmtMoney(t)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

window.RangeSlider = RangeSlider;
window.fmtMoney = fmtMoney;
window.fmtMoneyFull = fmtMoneyFull;
