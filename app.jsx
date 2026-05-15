// RangeFinder — main app
const { useState, useEffect, useMemo, useRef } = React;
const { useTweaks, TweaksPanel, TweakSection, TweakToggle } = window;
const RangeSlider = window.RangeSlider;
const { AMENITIES, CONDITIONS, fmtDate } = window.Valuation;

const TOTAL_ROUNDS = 5;
const COMP_COUNT = 8;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "ppsfHint": true,
  "showAmenities": true,
  "showStyle": true
} /*EDITMODE-END*/;

const CONDITION_COLOR = {
  "Needs Work": "#aa2a1f",
  "Renovated": "#7a6f60",
  "New": "#2e6e3f"
};

// ---------- shared: a property data table ----------

function DataRow({ k, v, mono = false, accent = null }) {
  return (
    <div className="datarow">
      <div className="datarow-k">{k}</div>
      <div className={"datarow-v " + (mono ? "is-mono " : "") + (accent ? "is-accent" : "")}
      style={accent ? { color: accent } : undefined}>{v}</div>
    </div>);

}

function PropertyData({ p }) {
  return (
    <div className="pdata">
      <DataRow k="Beds" v={p.beds} mono />
      <DataRow k="Baths" v={p.baths.toFixed(1).replace(/\.0$/, "")} mono />
      <DataRow k="House sqft" v={p.sqft.toLocaleString()} mono />
      <DataRow k="Lot sqft" v={p.lot.toLocaleString()} mono />
      <DataRow k="Year built" v={p.year} mono />
      <DataRow k="Style" v={p.style} />
      <DataRow k="Condition" v={p.condition.label} accent={CONDITION_COLOR[p.condition.label]} />
    </div>);

}

// ---------- subject ----------

function Subject({ p, tweaks }) {
  return (
    <div className="subject" style={{ borderStyle: "none", opacity: "1", backgroundColor: "rgba(235, 229, 214, 0)", padding: "24px 0px 26px", margin: "0px 40px" }}>
      <div className="subject-main">
        <div className="subject-head">
          <div>
            <h2 className="subject-addr" style={{ letterSpacing: "1px", fontWeight: "300", color: "rgb(43, 40, 39)" }}>{p.address}</h2>
            <div className="subject-hood">{p.neighborhood.name} · {p.style}</div>
          </div>
        </div>
        <PropertyData p={p} />
        <div className="subject-amen" style={{ margin: "0px", borderStyle: "none" }}>
          <div className="datarow-k" style={{ marginBottom: 6, margin: "4px 0px 12px", fontSize: "12px" }}>3 Key Amenities</div>
          <div className="amen-list">
            {p.amenities.map((a) => <span key={a.key} className="amen-chip" style={{ borderRadius: "9990px" }}>{a.label}</span>)}
          </div>
        </div>
      </div>
      {tweaks.ppsfHint &&
      <div className="subject-side">
          <div className="market-block" style={{ width: "656px" }}>
            <div className="market-cap" style={{ fontSize: "12px", margin: "0px 0px 11px" }}>Market — {p.neighborhood.name}</div>
            <div className="market-ppsf">${p.neighborhood.ppsf}<span> /sqft median</span></div>
            <div className="market-vol">
              <span>Volatility</span>
              <VolBar vol={p.neighborhood.vol} />
            </div>
          </div>
        </div>
      }
    </div>);

}

function VolBar({ vol }) {
  const lvl = Math.max(1, Math.min(5, Math.round((vol - 0.03) / 0.018)));
  return (
    <span className="vol-bar" title={`Volatility ${(vol * 100).toFixed(0)}%`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= lvl ? "on" : ""} />)}
    </span>);

}

// ---------- bar chart ----------

const METRICS = [
{ key: "sale_vs_list", label: "Sale vs List" },
{ key: "ppsf", label: "$ per sqft" },
{ key: "dom", label: "Days on market" }];


function fmtAxis(metric, v) {
  if (metric === "sale_vs_list") return window.fmtMoney(v);
  if (metric === "ppsf") return `$${v}`;
  return `${v}d`;
}

function CompChart({ comps, highlightId, onHighlight }) {
  const [metric, setMetric] = useState("sale_vs_list");

  const series = useMemo(() => {
    if (metric === "sale_vs_list") {
      return comps.map((c) => ({ id: c.id, a: c.salePrice, b: c.listPrice }));
    }
    if (metric === "ppsf") {
      return comps.map((c) => ({ id: c.id, a: c.ppsf }));
    }
    return comps.map((c) => ({ id: c.id, a: c.dom }));
  }, [comps, metric]);

  const max = useMemo(() => {
    const all = series.flatMap((s) => [s.a, s.b].filter((x) => x != null));
    return Math.max(...all) * 1.08;
  }, [series]);

  // y-axis ticks (4 ticks)
  const ticks = useMemo(() => {
    const t = [];
    for (let i = 0; i <= 4; i++) t.push(max * i / 4);
    return t;
  }, [max]);

  return (
    <div className="chart" style={{ borderStyle: "none" }}>
      <div className="chart-head" style={{ margin: "24px 0px" }}>
        <div className="chart-tabs" role="tablist">
          {METRICS.map((m) =>
          <button
            key={m.key}
            role="tab"
            className={"chart-tab " + (metric === m.key ? "is-on" : "")}
            onClick={() => setMetric(m.key)}>
            
              {m.label}
            </button>
          )}
        </div>
        {metric === "sale_vs_list" &&
        <div className="chart-legend">
            <span><i className="lgnd sale" /> Sale price</span>
            <span><i className="lgnd list" /> List price</span>
          </div>
        }
      </div>

      <div className="chart-body">
        <div className="chart-yaxis">
          {[...ticks].reverse().map((t, i) =>
          <div key={i} className="chart-ytick">{fmtAxis(metric, Math.round(t))}</div>
          )}
        </div>
        <div className="chart-plot" style={{ justifyContent: "center", alignItems: "center" }}>
          {[...ticks].reverse().map((t, i) =>
          <div key={i} className="chart-gridline" style={{ bottom: `${i === 4 ? 0 : (4 - i) * 25}%` }} />
          )}
          {comps.map((c, i) => {
            const s = series[i];
            const isHi = highlightId === c.id;
            return (
              <button
                key={c.id}
                className={"chart-bar-group " + (isHi ? "is-hi" : "")}
                onMouseEnter={() => onHighlight(c.id)}
                onMouseLeave={() => onHighlight(null)}
                onClick={() => onHighlight(c.id)} style={{ width: "52px", gap: "2px", alignItems: "flex-end", padding: "0px" }}>
                
                {metric === "sale_vs_list" ?
                <>
                    <div className="chart-bar sale" style={{ height: `${s.a / max * 100}%`, borderRadius: "99990px", width: "14px" }}>
                      <span className="chart-bar-val">{fmtAxis(metric, s.a)}</span>
                    </div>
                    <div className="chart-bar list" style={{ height: `${s.b / max * 100}%`, borderRadius: "99990px", borderStyle: "none", backgroundColor: "rgb(203, 185, 175)" }}>
                      <span className="chart-bar-val">{fmtAxis(metric, s.b)}</span>
                    </div>
                  </> :

                <div className="chart-bar solo" style={{ height: `${s.a / max * 100}%` }}>
                    <span className="chart-bar-val">{fmtAxis(metric, s.a)}</span>
                  </div>
                }
                <div className="chart-bar-lbl">#{String(i + 1).padStart(2, "0")}</div>
              </button>);

          })}
        </div>
      </div>
    </div>);

}

// ---------- comp ----------

function diffSpec(sale, list) {
  const d = sale - list;
  const pct = d / list * 100;
  if (d === 0) return { text: "at list", cls: "neutral" };
  if (d > 0) return { text: `+${window.fmtMoney(d)} (${pct.toFixed(1)}%) over list`, cls: "over" };
  return { text: `${window.fmtMoney(d)} (${pct.toFixed(1)}%) under list`, cls: "under" };
}

function Comp({ comp, n, tweaks, highlighted, onMouseEnter, onMouseLeave }) {
  const dx = diffSpec(comp.salePrice, comp.listPrice);
  return (
    <div className={"comp " + (highlighted ? "is-hi" : "")}
    onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="comp-num">#{String(n).padStart(2, "0")}</div>

      <div className="comp-priceblock">
        <div className="comp-pricecol">
          <div className="comp-price">{window.fmtMoney(comp.salePrice)}</div>
          <div className="comp-priceline">
            <span className="comp-listed">listed {window.fmtMoney(comp.listPrice)}</span>
            <span className={"comp-diff " + dx.cls}>· {dx.text}</span>
          </div>
        </div>
        <div className="comp-ppsf">${comp.ppsf}<span>/sqft</span></div>
      </div>

      <div className="comp-addr">{comp.address}</div>
      <div className="comp-hood">
        {comp.neighborhood.name}
        {tweaks.showStyle && <> · {comp.style}</>}
      </div>

      <div className="comp-grid">
        <div className="cg"><b>{comp.beds}</b><span>bd</span></div>
        <div className="cg"><b>{comp.baths.toFixed(1).replace(/\.0$/, "")}</b><span>ba</span></div>
        <div className="cg"><b>{comp.sqft.toLocaleString()}</b><span>sqft</span></div>
        <div className="cg"><b>{(comp.lot / 1000).toFixed(1)}k</b><span>lot</span></div>
        <div className="cg"><b>{comp.year}</b><span>built</span></div>
        <div className="cg" style={{ color: CONDITION_COLOR[comp.condition.label] }}>
          <b style={{ color: "inherit" }}>{comp.condition.label.split(" ")[0]}</b>
          <span>{comp.condition.label.split(" ")[1] || "cond."}</span>
        </div>
      </div>

      {tweaks.showAmenities &&
      <div className="comp-amens">
          {comp.amenities.map((a) =>
        <span key={a.key} className="comp-amen">{a.label}</span>
        )}
        </div>
      }

      <div className="comp-foot">
        <span>SOLD {fmtDate(comp.saleDate)}</span>
        <span>{comp.dom} DOM</span>
      </div>
    </div>);

}

// ---------- confidence ----------

function confidenceLabel(widthPct) {
  if (widthPct <= 3) return { label: "Very high confidence", level: 5 };
  if (widthPct <= 6) return { label: "High confidence", level: 4 };
  if (widthPct <= 12) return { label: "Moderate confidence", level: 3 };
  if (widthPct <= 20) return { label: "Low confidence", level: 2 };
  return { label: "Very uncertain", level: 1 };
}

// ---------- reveal ----------

function Reveal({ result, totalScore, onContinue, onPlayAgain, hasMoreRounds, roundIdx }) {
  const headline = useMemo(() => {
    const e = result.score.errPct;
    if (e <= 1) return "Bullseye.";
    if (e <= 2) return "Sharp call.";
    if (e <= 5) return "In the zone.";
    if (e <= 10) return "Close, not quite.";
    if (e <= 20) return "Off the mark.";
    return "Way off.";
  }, [result]);

  return (
    <div className="veil">
      <div className="reveal">
        <div className="reveal-points">
          +{result.score.total}<sup>POINTS</sup>
          {result.score.widthBonus > 0 &&
          <span className="points-up">+{result.score.widthBonus} TIGHT-RANGE BONUS</span>
          }
        </div>
        <div className="reveal-headline">{headline}</div>
        <div className="reveal-grid">
          <div className="reveal-stat">
            <div className="reveal-stat-k">Your Estimate</div>
            <div className="reveal-stat-v">{window.fmtMoneyFull(result.mid)}</div>
          </div>
          <div className="reveal-stat">
            <div className="reveal-stat-k">Actual Value</div>
            <div className="reveal-stat-v">{window.fmtMoneyFull(result.actual)}</div>
          </div>
          <div className="reveal-stat">
            <div className="reveal-stat-k">Error</div>
            <div className={`reveal-stat-v ${result.score.errPct <= 5 ? "good" : "bad"}`}>
              {result.score.errPct.toFixed(2)}%
            </div>
          </div>
          <div className="reveal-stat">
            <div className="reveal-stat-k">In Range</div>
            <div className={`reveal-stat-v ${result.score.inRange ? "good" : "bad"}`}>
              {result.score.inRange ? "Yes" : "No"}
            </div>
          </div>
        </div>
        <div className="reveal-actions">
          <div className="reveal-totalbar">
            ROUND <b>{roundIdx} / {TOTAL_ROUNDS}</b> · TOTAL <b>{totalScore}</b>
          </div>
          {hasMoreRounds ?
          <button className="btn btn-primary" onClick={onContinue}>Next property →</button> :

          <button className="btn btn-accent" onClick={onPlayAgain}>Play again</button>
          }
        </div>
      </div>
    </div>);

}

// ---------- end-of-game ----------

function EndScreen({ totalScore, history, onPlayAgain }) {
  const max = TOTAL_ROUNDS * 125;
  const avgErr = history.length ?
  history.reduce((s, h) => s + h.score.errPct, 0) / history.length :
  0;
  const bullseyes = history.filter((h) => h.score.errPct <= 1).length;
  const inRange = history.filter((h) => h.score.inRange).length;

  const grade = (() => {
    const p = totalScore / max;
    if (p >= 0.85) return { letter: "A", word: "Appraiser-grade", color: "var(--good)" };
    if (p >= 0.7) return { letter: "B", word: "Sharp eye", color: "var(--good)" };
    if (p >= 0.55) return { letter: "C", word: "Solid", color: "var(--gold)" };
    if (p >= 0.4) return { letter: "D", word: "Rough", color: "var(--accent-deep)" };
    return { letter: "F", word: "Back to school", color: "var(--bad)" };
  })();

  return (
    <div className="veil">
      <div className="reveal end-reveal">
        <div className="end-grade" style={{ color: grade.color }}>
          <div className="end-letter">{grade.letter}</div>
          <div className="end-grade-word">{grade.word}</div>
        </div>
        <div className="end-total">
          <span>FINAL SCORE</span>
          <b>{totalScore}<i>/ {max}</i></b>
        </div>
        <div className="reveal-grid">
          <div className="reveal-stat">
            <div className="reveal-stat-k">Avg Error</div>
            <div className="reveal-stat-v">{avgErr.toFixed(2)}%</div>
          </div>
          <div className="reveal-stat">
            <div className="reveal-stat-k">Bullseyes</div>
            <div className="reveal-stat-v">{bullseyes} / {TOTAL_ROUNDS}</div>
          </div>
          <div className="reveal-stat">
            <div className="reveal-stat-k">In Range</div>
            <div className="reveal-stat-v">{inRange} / {TOTAL_ROUNDS}</div>
          </div>
          <div className="reveal-stat">
            <div className="reveal-stat-k">Best</div>
            <div className="reveal-stat-v">
              {history.length ?
              Math.min(...history.map((h) => h.score.errPct)).toFixed(2) + "%" :
              "—"}
            </div>
          </div>
        </div>

        <div className="rounds-row">
          {history.map((h, i) => {
            const pts = h.score.total;
            return (
              <div key={i} className="rd">
                <div className="rd-bar" style={{ height: `${4 + pts * 0.7}px` }} />
                <div className="rd-n">{i + 1}</div>
                <div className="rd-pts">{pts}</div>
              </div>);

          })}
        </div>

        <div className="reveal-actions">
          <button className="btn btn-accent" onClick={onPlayAgain}>New game</button>
        </div>
      </div>
    </div>);

}

// ---------- main app ----------

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [round, setRound] = useState(() => window.Valuation.buildRound());
  const [roundIdx, setRoundIdx] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  const [minBound, maxBound] = useMemo(() => {
    const prices = round.comps.map((c) => c.salePrice);
    const lo = Math.floor(Math.min(...prices) * 0.7 / 25000) * 25000;
    const hi = Math.ceil(Math.max(...prices) * 1.3 / 25000) * 25000;
    return [lo, hi];
  }, [round]);

  const [low, setLow] = useState(0);
  const [mid, setMid] = useState(0);
  const [high, setHigh] = useState(0);

  useEffect(() => {
    const center = Math.round((minBound + maxBound) / 2 / 5000) * 5000;
    const span = (maxBound - minBound) * 0.18;
    setLow(Math.round((center - span) / 5000) * 5000);
    setMid(center);
    setHigh(Math.round((center + span) / 5000) * 5000);
  }, [round, minBound, maxBound]);

  const [revealed, setRevealed] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const confidence = useMemo(() => {
    if (!mid) return null;
    const widthPct = (high - low) / mid * 100;
    return { widthPct, ...confidenceLabel(widthPct) };
  }, [low, mid, high]);

  function submit() {
    const score = window.Valuation.scoreFor(mid, low, high, round.estimate);
    const result = { mid, low, high, actual: round.estimate, score };
    setLastResult(result);
    setTotalScore((s) => s + score.total);
    setHistory((h) => [...h, result]);
    setRevealed(true);
  }

  function nextRound() {
    if (roundIdx >= TOTAL_ROUNDS) {
      setRevealed(false);
      setGameOver(true);
      return;
    }
    setRoundIdx((n) => n + 1);
    setRound(window.Valuation.buildRound());
    setRevealed(false);
    setLastResult(null);
    setHighlightId(null);
  }

  function playAgain() {
    setRoundIdx(1);
    setTotalScore(0);
    setHistory([]);
    setRound(window.Valuation.buildRound());
    setRevealed(false);
    setLastResult(null);
    setGameOver(false);
    setHighlightId(null);
  }

  const isFinalRound = roundIdx >= TOTAL_ROUNDS;
  const subject = round.subject;

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-meta">
          <div>Question<b>{roundIdx} <span className="meta-of">/ {TOTAL_ROUNDS}</span></b></div>
          <div>Score<b>{totalScore}</b></div>
          <div>Subject<b className="meta-hood">{subject.neighborhood.name}</b></div>
        </div>
        <div className="masthead-progress" style={{ letterSpacing: "0px", justifyContent: "center", alignItems: "center" }}>
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) =>
          <span key={i}
          className={"pip " + (
          i < history.length ? "done" :
          i === history.length ? "current" : "")
          }
          title={i < history.length ? `Round ${i + 1}: ${history[i].score.total} pts` : `Round ${i + 1}`} style={{ opacity: "1", color: "rgba(255, 255, 255, 0)", backgroundColor: "rgba(255, 255, 255, 0)", borderWidth: "0px 0px 0px 1px", borderRadius: "99990px", height: "18px" }}>
            
              {i < history.length && history[i].score.errPct <= 5 && <i className="pip-dot good" style={{ fontSize: "24px", height: "17px", width: "17px" }} />}
              {i < history.length && history[i].score.errPct > 5 && <i className="pip-dot bad" />}
            </span>
          )}
        </div>
      </header>

      <div className="content" style={{ padding: "24px 16px 32px", margin: "0px" }}>
        <Subject p={subject} tweaks={tweaks} />

        <div style={{ width: "656px" }}>
          <div className="section-head">
            <h3 className="section-title">Comps
</h3>
            <div className="section-tag">{COMP_COUNT} records</div>
          </div>

          <CompChart comps={round.comps}
          highlightId={highlightId}
          onHighlight={setHighlightId} />
          

          <div className="comps">
            {round.comps.map((c, i) =>
            <Comp
              key={c.id}
              comp={c}
              n={i + 1}
              tweaks={tweaks}
              highlighted={highlightId === c.id}
              onMouseEnter={() => setHighlightId(c.id)}
              onMouseLeave={() => setHighlightId(null)} />

            )}
          </div>
        </div>
      </div>

      <div className="dock">
        <div className="dock-inner">
          <div className="dock-slider">
            <RangeSlider
              min={minBound}
              max={maxBound}
              low={low}
              mid={mid}
              high={high}
              onChange={(l, m, h) => {setLow(l);setMid(m);setHigh(h);}}
              trueValue={revealed && lastResult ? lastResult.actual : null}
              revealed={revealed} />
            
          </div>
          <div className="dock-readouts">
            <div className="confbar">
              <div className="confbar-row"><span>Range Width</span><b>{confidence ? confidence.widthPct.toFixed(1) : 0}%</b></div>
              <div className="confbar-meter">
                <i style={{ width: confidence ? `${Math.max(4, 100 - confidence.widthPct * 4)}%` : "0%" }} />
              </div>
              <div className="confbar-label">{confidence ? confidence.label : ""}</div>
            </div>
            <div className="submit-row">
              <button className="btn btn-primary" onClick={submit} disabled={revealed}>
                {revealed ? "Submitted" : "Lock in estimate"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {revealed && lastResult && !gameOver &&
      <Reveal
        result={lastResult}
        totalScore={totalScore}
        onContinue={nextRound}
        onPlayAgain={playAgain}
        hasMoreRounds={!isFinalRound}
        roundIdx={roundIdx} />

      }

      {gameOver &&
      <EndScreen totalScore={totalScore} history={history} onPlayAgain={playAgain} />
      }

      <TweaksPanel title="Tweaks">
        <TweakSection label="Hints">
          <TweakToggle label="Neighborhood $/sqft + volatility" value={tweaks.ppsfHint}
          onChange={(v) => setTweak('ppsfHint', v)} />
          <TweakToggle label="Comp amenities" value={tweaks.showAmenities}
          onChange={(v) => setTweak('showAmenities', v)} />
          <TweakToggle label="Architectural style" value={tweaks.showStyle}
          onChange={(v) => setTweak('showStyle', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);