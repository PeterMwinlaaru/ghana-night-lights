/* Night-time Lights and Development in Ghana — static front end.
 * Reads only the files in data/GHA/ written by webapp/build_data.py. No server, no Earth Engine.
 * Libraries: Leaflet 1.9.4 (map), Plotly 2.35.2 cartesian (charts), both vendored in assets/vendor. */
"use strict";

const DATA = "data/GHA/";
const S = { pages: {}, rendered: new Set(), map: null, mapLayer: null, mapInd: null, selected: null, miniMap: null };

/* ------------------------------------------------------------------ palettes (validated per theme)
 * Categorical (blue, orange, aqua) validated all-pairs for choropleths; hotspot ramp validated as ordinal.
 * Dark theme follows the AfDB-DI4A night dashboard: low values recede into the night background, high values glow. */
const THEMES = {
  light: {
    surface: "#ffffff", ink: "#0b0b0b", ink2: "#52514e", ink3: "#7a7974", grid: "#eeedea", axis: "#d6d5d0",
    blue: "#2E5CB8", orange: "#eb6834", aqua: "#1baf7a", gray: "#c9c8c3", grayLine: "#d9d8d3", na: "#efeeea", stroke: "#ffffff",
    seq: ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
    hot99: "#a8281e", hot95: "#e0574a", hot90: "#f19a8e", hotNo: "#e9e8e4",
    mmTarget: "#1F3A6E", mmRegion: "#c9d7f0", mmRegionLine: "#6f8fcb", mmOther: "#e2e1dc",
  },
  dark: {
    surface: "#0d141f", ink: "#edf1f6", ink2: "#b4bfcc", ink3: "#8b97a7", grid: "#1d2836", axis: "#34445a",
    blue: "#4f86e8", orange: "#e0662f", aqua: "#1faa78", gray: "#5d6878", grayLine: "#2b3a4f", na: "#1a2333", stroke: "#060a12",
    seq: ["#1a3a6b", "#245aa8", "#3a7fdc", "#7fb2f0", "#cfe3fd"],
    hot99: "#f6a598", hot95: "#d9564a", hot90: "#a3382d", hotNo: "#1a2333",
    mmTarget: "#F5C242", mmRegion: "#24406e", mmRegionLine: "#4d6fa8", mmOther: "#1a2333",
  },
};
const themeName = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
let C = THEMES[themeName()];

const cat = (label, ck) => ({ label, get color() { return C[ck]; } });   // colour follows the active theme
const MODE = {
  "sprawl-dominated": cat("Sprawl-dominated", "orange"),
  "balanced": cat("Balanced", "aqua"),
  "intensification-dominated": cat("Intensification-dominated", "blue"),
  "newly lit / undefined": cat("Newly lit (no 2012 base)", "gray"),
};
const HOT = {
  "Hot 99%": cat("Hotspot, 99% confidence", "hot99"),
  "Hot 95%": cat("Hotspot, 95% confidence", "hot95"),
  "Hot 90%": cat("Hotspot, 90% confidence", "hot90"),
  "Not significant": cat("Not significant", "hotNo"),
};

/* ------------------------------------------------------------------ indicator catalogue */
const SRC_SE = "Spatial expansion study";
const SRC_SO = "Socio-economic study";
const SRC_AC = "Electrification and access analysis";
const ACC = {
  "closing": cat("Closing the gap: fewer people in unlit areas", "aqua"),
  "pace": cat("Keeping pace: more people, but a smaller share", "blue"),
  "behind": cat("Falling behind: a larger share in unlit areas", "orange"),
  "fully_lit": cat("Fully lit: under 1 percent in unlit areas", "gray"),
};
const IND = [
  { key: "se_lit_2025_km2", label: "Lit area, 2025 (km²)", group: SRC_SE, d: 1, desc: "Area of the district with radiance of at least 1.0 nW/cm²/sr in 2025." },
  { key: "se_lit_change_km2", label: "Gain in lit area, 2012–2025 (km²)", group: SRC_SE, d: 1, desc: "Absolute increase in lit area between 2012 and 2025." },
  { key: "se_lit_cagr", label: "Growth of lit area, 2012–2025 (% per year)", group: SRC_SE, d: 1, desc: "Compound annual growth rate of lit area. Not defined for the 7 districts with no lit area in 2012." },
  { key: "se_lit_share_2025", label: "Share of district area lit, 2025 (%)", group: SRC_SE, d: 0, desc: "Lit area as a percentage of the district's total area." },
  { key: "se_mode", label: "Dominant mode of expansion, 2012–2025", group: SRC_SE, cat: MODE, desc: "Whether growth in brightness came mainly from new land being lit (sprawl) or from existing lit land growing brighter (intensification)." },
  { key: "se_hotspot_level", label: "Urban hotspot: brightness, 2025", group: SRC_SE, cat: HOT, desc: "Getis-Ord Gi* hotspots of 2025 mean radiance: districts that, with their neighbours, are significantly brighter than expected at random." },
  { key: "se_hotspot_growth", label: "Urban hotspot: growth in brightness, 2012–2025", group: SRC_SE, cat: HOT, desc: "Getis-Ord Gi* hotspots of the 2012–2025 change in mean radiance." },
  { key: "so_ntl_mean_2021", label: "Mean radiance, 2021 (nW/cm²/sr)", group: SRC_SO, d: 2, desc: "Average night-time radiance of all pixels in the district, 2021." },
  { key: "so_growth_pct", label: "Growth in mean radiance, 2012–2024 (%)", group: SRC_SO, d: 0, desc: "Cumulative change in mean radiance. Not defined for the 4 districts with no light in 2012." },
  { key: "so_rwi", label: "Relative Wealth Index", group: SRC_SO, d: 2, desc: "Relative standard of living estimated from satellite and connectivity data; 0 is the national average." },
  { key: "so_electricity_pct", label: "Households with electricity access (%)", group: SRC_SO, d: 1, desc: "Share of households with access to electricity, 2021 Population and Housing Census (District rankings)." },
  { key: "so_internet_pct", label: "Internet use (%)", group: SRC_SO, d: 1, desc: "Share of individuals using the internet, 2021 Census." },
  { key: "so_clean_cooking_pct", label: "Clean cooking fuel (%)", group: SRC_SO, d: 1, desc: "Access to clean fuels and technologies for cooking." },
  { key: "so_adult_literacy_pct", label: "Adult literacy (%)", group: SRC_SO, d: 1, desc: "Adult literacy rate, 2021." },
  { key: "so_ner_primary_pct", label: "Net enrolment, primary (%)", group: SRC_SO, d: 1, desc: "Net enrolment rate, primary level." },
  { key: "so_ner_shs_pct", label: "Net enrolment, senior high (%)", group: SRC_SO, d: 1, desc: "Net enrolment rate, senior high school." },
  { key: "so_urbanisation_pct", label: "Urbanisation (%)", group: SRC_SO, d: 1, desc: "Share of the population living in urban localities." },
  { key: "so_pop_density", label: "Population density (persons per km²)", group: SRC_SO, d: 0, desc: "Persons per square kilometre, 2021." },
  { key: "so_household_size", label: "Average household size", group: SRC_SO, d: 2, desc: "Average number of persons per household." },
  { key: "so_mpi_pct", label: "Multidimensional poverty (%)", group: SRC_SO, d: 1, desc: "Share of the population that is multidimensionally poor, 2021." },
  { key: "so_vulnerable_employment_pct", label: "Vulnerable employment (%)", group: SRC_SO, d: 1, desc: "Own-account and contributing family workers as a share of the employed." },
  { key: "so_child_marriage_pct", label: "Child marriage (%)", group: SRC_SO, d: 1, desc: "Child marriage rate." },
  { key: "so_infant_mortality", label: "Infant mortality rate", group: SRC_SO, d: 1, desc: "Infant deaths per 1,000 live births." },
  { key: "so_under5_mortality", label: "Under-five mortality rate", group: SRC_SO, d: 1, desc: "Deaths under age five per 1,000 live births." },
  { key: "ac_dark_share_2020", label: "People living in unlit areas, 2020 (%)", group: SRC_AC, d: 1, desc: "Share of the population living where no night-time light is detected (radiance below 0.5 nW/cm²/sr), WorldPop population 2020. A proxy for lack of electricity." },
  { key: "ac_pop_dark_2020", label: "People living in unlit areas, 2020 (number)", group: SRC_AC, d: 0, desc: "Number of people living where no night-time light is detected, 2020." },
  { key: "ac_dark_change_pp", label: "Change in share living in unlit areas, 2012–2020 (points)", group: SRC_AC, d: 1, desc: "Percentage-point change in the share of the population living in unlit areas; negative values mean light has reached more people." },
  { key: "ac_class", label: "Progress in reaching people with light, 2012–2020", group: SRC_AC, cat: ACC, desc: "Whether the number and share of people living in unlit areas fell between 2012 and 2020." },
  { key: "ac_electrified_km2", label: "Newly lit land in existing settlements, 2012–2025 (km²)", group: SRC_AC, d: 1, desc: "Land dark in 2012 and 2013, lit in 2024 and 2025, that was already inhabited in 2012: electrification of existing villages and towns." },
];
const INDK = Object.fromEntries(IND.map((i) => [i.key, i]));

/* ------------------------------------------------------------------ helpers */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function fmt(v, d = 1) {
  if (!isNum(v)) return "–";
  return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
}
const pct = (v, d = 1) => (isNum(v) ? fmt(v, d) + "%" : "–");
const signed = (v, d = 1) => (isNum(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), d) : "–");
const median = (a) => { const s = a.filter(isNum).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length / 2; return s.length % 2 ? s[m - 0.5] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => { const s = a.filter(isNum); return s.length ? s.reduce((p, c) => p + c, 0) / s.length : NaN; };
function quantile(sorted, q) { const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo); }

function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, j) => {
    const v = r[j];
    if (v === "") return [h, null];
    if (v === "True" || v === "False") return [h, v === "True"];
    const n = Number(v);
    return [h, Number.isFinite(n) && /^[-+0-9.eE]+$/.test(v) ? n : v];
  })));
}
async function get(name) {
  const r = await fetch(DATA + name, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return name.endsWith(".csv") ? parseCSV(await r.text()) : r.json();
}

/* ------------------------------------------------------------------ chart scaffolding */
const FONT = "Century Gothic, URW Gothic, Avant Garde, Questrial, Segoe UI, sans-serif";
function layout(extra = {}) {
  const ax = { gridcolor: C.grid, linecolor: C.axis, zeroline: false, tickfont: { size: 11, color: C.ink2 }, title: { font: { size: 12, color: C.ink2 } }, automargin: true };
  const base = {
    font: { family: FONT, size: 12, color: C.ink }, paper_bgcolor: C.surface, plot_bgcolor: C.surface,
    margin: { l: 56, r: 24, t: 16, b: 48 }, showlegend: false, barcornerradius: 4, bargap: 0.5,
    hoverlabel: { font: { family: FONT, size: 12, color: C.ink }, bgcolor: C.surface, bordercolor: C.axis },
    legend: { orientation: "h", x: 0, y: 1.08, font: { size: 12 } },
  };
  const out = { ...base, ...extra };
  out.xaxis = { ...ax, ...(extra.xaxis || {}) };
  out.yaxis = { ...ax, ...(extra.yaxis || {}) };
  return out;
}
const CONFIG = { displayModeBar: false, responsive: true };
/* Charts are drawn only when they come within 400 px of the screen: a page with ten charts opens at once and the
 * rest draw as the reader scrolls. Redrawing a chart (a dropdown change, a theme switch) replaces its pending spec. */
const drawNow = (el) => { const sp = el._spec; if (sp) { el._spec = null; Plotly.newPlot(el, sp.traces, sp.lay, CONFIG); } };
const chartObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { chartObserver.unobserve(e.target); drawNow(e.target); } }), { rootMargin: "400px 0px" })
  : null;
function plot(id, traces, lay) {
  const el = document.getElementById(id);
  if (!el) return;
  el._spec = { traces, lay: layout(lay) };
  if (!chartObserver || el.classList.contains("js-plotly-plot")) { drawNow(el); return; }   // already drawn once: update in place
  chartObserver.observe(el);
}

/* A GSS figure: blue key-message box, navy caption, chart(s), italic note. */
function figure({ msg, caption, note, charts, tools = "", panels }) {
  const ch = charts.map((c, i) => `<div>${panels ? `<p class="panel-label">(${String.fromCharCode(97 + i)}) ${esc(panels[i])}</p>` : ""}<div class="chart ${c.cls || ""}" id="${c.id}" role="img" aria-label="${esc(c.alt || caption)}"></div><div class="dl-row"><button type="button" class="dl" data-png="${c.id}" data-name="${esc(caption)}">PNG</button></div></div>`).join("");
  return `<section class="figure">
    ${msg ? `<div class="msg">${msg}</div>` : ""}
    <h2 class="caption">${esc(caption)}</h2>
    ${tools ? `<div class="fig-tools">${tools}</div>` : ""}
    <div class="${charts.length > 1 ? "figrow" : ""}">${ch}</div>
    ${note ? `<p class="note">Note: ${note}</p>` : ""}
  </section>`;
}
function tableFig({ msg, caption, note, head, rows, numCols = [] }) {
  return `<section class="figure">
    ${msg ? `<div class="msg">${msg}</div>` : ""}
    <h2 class="caption">${esc(caption)}</h2>
    ${table(head, rows, numCols)}
    <div class="dl-row"><button type="button" class="dl" data-csv="1" data-name="${esc(caption)}">CSV</button></div>
    ${note ? `<p class="note">Note: ${note}</p>` : ""}
  </section>`;
}
function table(head, rows, numCols = []) {
  const nc = new Set(numCols);
  return `<div class="table-wrap"><table class="data"><thead><tr>${head.map((h, i) => `<th class="${nc.has(i) ? "num" : ""}" scope="col">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${nc.has(i) ? "num" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
const kpi = (label, value, sub = "", tag = "") => `<div class="kpi"><div class="k-label">${esc(label)}${tag ? `<span class="k-tag">${esc(tag)}</span>` : ""}</div><div class="k-value">${value}</div><div class="k-sub">${sub}</div></div>`;

/* Confidence badge: status colour always with an icon and a text label, plus the reason */
const CONF = { high: ["✓", "High confidence"], medium: ["!", "Medium confidence"], low: ["✕", "Low confidence"] };
const badge = (level, why) => `<span class="conf conf-${level}"><span class="ic" aria-hidden="true">${CONF[level][0]}</span>${CONF[level][1]}</span>${why ? `<span class="conf-why">${why}</span>` : ""}`;

/* Download a chart as PNG or a table as CSV (buttons are written by figure() and tableFig()) */
const slug = (s) => String(s).toLowerCase().replace(/^(figure|table)\s+\d+:\s*/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 70) || "chart";
function onDownload(e) {
  const b = e.target.closest(".dl");
  if (!b) return;
  if (b.dataset.png) {
    const el = document.getElementById(b.dataset.png);
    if (el && el._spec) drawNow(el);   // not drawn yet (below the screen): draw first
    if (el) Plotly.downloadImage(el, { format: "png", filename: `gss_ntl_${slug(b.dataset.name)}`, width: el.clientWidth, height: el.clientHeight, scale: 2 });
  } else if (b.dataset.csv) {
    const t = b.closest(".figure").querySelector("table");
    const q = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = [...t.rows].map((r) => [...r.cells].map((c) => q(c.textContent.trim())).join(","));
    const blob = new Blob(["\ufeff" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `gss_ntl_${slug(b.dataset.name)}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  try {
    // the district boundaries (0.7 MB) and the district-year panel (0.4 MB) load only for the pages that use them
    const opt = (n) => get(n).catch(() => null);   // optional files: the site works without them
    const [meta, districts, regions, se, so, gdp, lights, access, accessD, media] = await Promise.all([
      get("meta.json"), get("districts.csv"), get("regions.csv"),
      get("spatial_expansion.json"), get("socioeconomic.json"), get("gdp.json"),
      opt("lights/lights.json"), opt("access.json"), opt("access_districts.csv"), opt("media/media.json")]);
    districts.forEach((d) => { d.so_growth_pct = isNum(d.so_log_growth_2012_2024) ? (Math.exp(d.so_log_growth_2012_2024) - 1) * 100 : null; });
    if (accessD) { const by = new Map(accessD.map((r) => [r.id, r])); districts.forEach((d) => Object.assign(d, by.get(d.id) || {})); }
    if (!access) document.querySelector('.tabs a[data-page="access"]').hidden = true;
    Object.assign(S, { meta, districts, regions, se, so, gdp, lights, access, media });
    document.addEventListener("click", onDownload);
    S.byId = new Map(districts.map((d) => [d.id, d]));
    S.byName = new Map(districts.map((d) => [d.name.toLowerCase(), d]));
    $("#district-list").innerHTML = districts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((d) => `<option value="${esc(d.name)}">${esc(d.region)}</option>`).join("");
    $("#build-info").textContent = `Data built ${meta.built.slice(0, 10)}`;
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#loading").hidden = true;
    window.addEventListener("hashchange", safeRoute);
    await safeRoute();
    setTimeout(prefetch, 2500);
  } catch (e) {
    $("#loading").hidden = true;
    const box = $("#load-error");
    box.hidden = false;
    box.innerHTML = `<strong>The data could not be loaded.</strong> ${esc(e.message)}. If you opened <code>index.html</code> directly from disk,
      serve the folder instead, for example with <code>python -m http.server</code> in the <code>webapp</code> folder.`;
    console.error(e);
  }
}

function toggleTheme() {
  const next = themeName() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("gss-ntl-theme", next); } catch (e) { /* private mode: theme just isn't remembered */ }
  C = THEMES[next];
  S.rendered.clear();                                   // charts are redrawn with the new palette on next view
  safeRoute();                                          // redraw the current page now
}

/* Large files are fetched once, the first time a page needs them */
const NEEDS = { map: ["geo", "panel"], socio: ["panel", "plotly"], district: ["geo", "panel", "plotly"],
                expansion: ["plotly"], access: ["plotly"], gdp: ["plotly"] };
const loadScript = (src) => new Promise((ok, fail) => { const t = document.createElement("script"); t.src = src; t.onload = ok; t.onerror = () => fail(new Error(`${src} could not be loaded`)); document.head.appendChild(t); });
const LOADERS = {
  plotly: async () => { if (!window.Plotly) await loadScript("assets/vendor/plotly-cartesian.min.js"); S.plotly = true; },   // 1.4 MB: only for chart pages
  geo: async () => { S.geo = await get("districts.geojson"); },
  panel: async () => { S.panel = await get("district_panel.csv"); S.panelBy = new Map(S.panel.map((p) => [`${p.id}-${p.year}`, p])); },
};
async function ensureData(keys) {
  const todo = keys.filter((k) => !S[k]);
  if (!todo.length) return;
  $("#loading").hidden = false; $("#loading").textContent = todo.includes("geo") ? "Loading map and district data…" : "Loading charts…";
  try { await Promise.all(todo.map((k) => (S[`_${k}`] = S[`_${k}`] || LOADERS[k]()))); }
  finally { $("#loading").hidden = true; }
}
/* After start-up, fetch the large files quietly so that first visits to the map and chart pages rarely wait */
function prefetch() {
  const later = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  ["plotly", "geo", "panel"].forEach((k, i) => setTimeout(() => later(() => { if (!S[k]) S[`_${k}`] = S[`_${k}`] || LOADERS[k]().catch(() => { S[`_${k}`] = null; }); }), i * 800));
}
const currentPage = () => { const p = (location.hash.replace(/^#/, "") || "overview").split("/")[0]; return PAGES[p] ? p : "overview"; };

async function safeRoute() {
  const box = $("#load-error");
  box.hidden = true;
  try { await ensureData(NEEDS[currentPage()] || []); route(); } catch (e) {
    box.hidden = false;
    box.innerHTML = `<strong>This page could not be displayed.</strong> ${esc(e.message)}`;
    console.error(e);
  }
}

const PAGES = { overview: renderOverview, map: renderMap, expansion: renderExpansion, socio: renderSocio, access: renderAccess, gdp: renderGdp, district: renderDistrict, methods: renderMethods };
function route() {
  const [page, ...args] = (location.hash.replace(/^#/, "") || "overview").split("/");
  const name = PAGES[page] ? page : "overview";
  document.querySelectorAll(".page").forEach((p) => { p.hidden = p.id !== `page-${name}`; });
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.page === name));
  const on = document.querySelector(".tabs a.on");
  if (on) on.scrollIntoView({ block: "nearest", inline: "center" });
  if (name === "district") { renderDistrict(args[0]); }
  else if (name === "map") { renderMap(args); }
  else if (!S.rendered.has(name)) { PAGES[name](); S.rendered.add(name); }
  // charts drawn while hidden get the wrong width: resize everything on the visible page
  if (window.Plotly) requestAnimationFrame(() => document.querySelectorAll(`#page-${name} .js-plotly-plot`).forEach((el) => Plotly.Plots.resize(el)));
  if (name !== "district" && name !== "map") window.scrollTo(0, 0);
}

/* ================================================================== OVERVIEW */
function renderOverview() {
  const h = S.se.headline, so = S.so.headline, g = S.gdp.headline, A = S.access;
  const corr = Object.fromEntries(S.so.correlations_2021.map((r) => [r.column, r]));
  $("#ov-kpis").innerHTML = [
    kpi("Land lit at night, 2025", `${fmt(h.lit_area_2025_km2, 0)} km²`, `${fmt(h.lit_area_2025_km2 / h.lit_area_2012_km2, 1)} times the area lit in 2012`),
    A ? kpi("People living beyond the reach of light, 2020", `${fmt(A.headline.pop_dark_2020 / 1e6, 1)} million`, `${pct(A.headline.dark_share_2020, 0)} of Ghanaians, down from ${pct(A.headline.dark_share_2012, 0)} in 2012`) : "",
    kpi("Districts that are mostly dark, 2021", pct(so.share_districts_below_0_5_pct, 0), "of the 261 districts emit very little light at night"),
    kpi("Differences in light that are regional", pct(so.theil_between_share_ntl_pct, 0), "of the gap in brightness between districts reflects differences between regions"),
    kpi("Brightness and population density", fmt(corr.pop_density.spearman, 2), "rank correlation (1 = districts in exactly the same order): the closest link of 16 indicators"),
    kpi("Projected GDP, 2026 Q1", `GHS ${fmt(g.forecast_2026q1_ghs_m / 1000, 1)} bn`, `a model projection; it missed actual GDP by ${pct(g.rolling_mape_pct, 1)} on average in 2024–2025`),
  ].join("");
  const mc = h.mode_counts;
  const cards = [
    { t: "Spatial expansion of settlements", href: "#expansion", li: [
      [`Lit area grew from ${fmt(h.lit_area_2012_km2, 0)} to ${fmt(h.lit_area_2025_km2, 0)} km², ${pct(h.cagr_pct, 1)} a year; ${h.districts_gaining} districts expanded and none contracted.`,
        "high", "The same growth appears at 0.5, 1.0 and 5.0 nW/cm²/sr thresholds (12.6 to 15.5 percent a year), and no district lost lit area at any of them."],
      [`${pct(h.area_effect_pct, 0)} of the growth in brightness came from new land being lit; ${mc["sprawl-dominated"]} of 261 districts were sprawl-dominated.`,
        "medium", "The split between new land and brighter land depends on the lit-area threshold."],
      ["Greater Accra and Greater Kumasi are the only significant urban hotspots.", "high", "Getis-Ord Gi* clusters significant at the 99 percent level."]] },
    { t: "Socio-economic development", href: "#socio", li: [
      [`Mean district radiance rose from ${fmt(so.mean_radiance_2012, 2)} in 2012 to ${fmt(so.mean_radiance_2025, 2)} in 2025.`,
        "high", "Measured the same way for all 261 districts each year; the satellite product version changes in 2022."],
      ["Brightness tracks population density, clean cooking fuel, electricity, wealth and internet use (rank correlations 0.83 to 0.96) and falls with poverty.",
        "high", "261 districts, all correlations significant at p < 0.001. They show association, not cause."],
      ["Districts that were darkest in 2012 grew fastest: the gap is narrowing.", "medium", `Convergence slope ${fmt(so.convergence_slope, 2)}; the ${261 - so.convergence_n} districts with no light in 2012 cannot be included.`]] },
  ];
  if (A) cards.push({ t: "Electrification and access", href: "#access", li: [
    [`People living where no light is detected fell from ${fmt(A.headline.pop_dark_2012 / 1e6, 1)} million in 2012 to ${fmt(A.headline.pop_dark_2020 / 1e6, 1)} million in 2020.`,
      "medium", `A proxy for lack of electricity; the 2020 figure ranges from ${fmt(A.headline.range_2020[0] / 1e6, 1)} to ${fmt(A.headline.range_2020[1] / 1e6, 1)} million across light thresholds.`],
    ["Districts with more people in unlit areas are those with lower electricity access in the 2021 Census.", "high",
      `Independent source: rank correlation ${fmt(A.validation.spearman, 2)} across 261 districts.`],
    [`${pct(A.headline.electrified_km2 / A.headline.new_lit_km2 * 100, 0)} of newly lit land was already inhabited in 2012: new light mostly reached existing villages.`,
      "medium", "Depends on how WorldPop distributes population across rural land."]] });
  cards.push({ t: "Economic activity and GDP", href: "#gdp", li: [
    ["Quarterly GDP and night-time lights both rose strongly over 2014–2025.", "high", "Official quarterly national accounts and a direct satellite measurement."],
    [`One-quarter-ahead forecasts missed actual GDP by ${pct(g.rolling_mape_pct, 2)} on average over 2024–2025.`, "low", "Only 8 quarters evaluated, and the model was chosen using the whole sample."],
    [`The model projects GHS ${fmt(g.forecast_2026q1_ghs_m, 0)} million for 2026 Q1.`, "low", `A one-quarter-ahead projection with a 95 percent interval of ${fmt(g.forecast_ci95_ghs_m[0], 0)} to ${fmt(g.forecast_ci95_ghs_m[1], 0)} million.`]] });
  $("#ov-cards").innerHTML = cards.map((c) => `<article class="card"><h2>${esc(c.t)}</h2><ul>${c.li.map(([t, lv, why]) => `<li>${t} ${badge(lv, why)}</li>`).join("")}</ul><a class="btn" href="${c.href}">Explore</a></article>`).join("")
    + `<p class="note" style="grid-column:1/-1">Each finding carries a confidence level and the reason for it. Estimates from night-time lights are experimental statistics: they complement, and do not replace, official statistics.</p>`;
  renderOvMap();
}

/* Overview map: 2021 night-time lights (left of the curtain) against PHC household electricity access (right) */
const OV_BREAKS = [75, 85, 92, 96];
const OV_LABELS = ["Below 75%", "75 to 85%", "85 to 92%", "92 to 96%", "96% or more"];
// same purple-to-gold ramp as the night-light image, so bright (high access) reads like bright (much light); validated ordinal on the night background
const OV_COLORS = ["#0a0a06", "#5c5200", "#a39200", "#f2d800", "#fff35c"];   // the night-light ramp itself: low access is as dark as unlit land, high access as bright as city lights
function renderOvMap() {
  const slot = $("#ov-media-slot");
  if (!slot || !S.lights) return;
  const cK = Object.fromEntries(S.so.correlations_2021.map((r) => [r.column, r]));
  const yr = 2021, counts = OV_LABELS.map((_, i) => S.districts.filter((d) => isNum(d.so_electricity_pct) && OV_BREAKS.filter((x) => d.so_electricity_pct >= x).length === i).length);
  slot.innerHTML = `<section class="figure" id="ov-media">
    <h2 class="caption">Night-time lights and household access to electricity (2021 PHC), 2021</h2>
    <div id="ov-map" class="ov-map" role="region" aria-label="Map of Ghana comparing the share of households with access to electricity in the 2021 Population and Housing Census with night-time lights in 2021"></div>
    <div class="ov-legends">
      <div class="legend"><div class="ttl">Night-time radiance, ${yr} (nW/cm²/sr, log scale)</div>
        <div class="ramp" style="background:linear-gradient(to right, ${S.lights.legend.stops.join(", ")})"></div>
        <div class="ramp-ticks">${[0.5, 2, 10, 80].map((t) => `<span style="left:${((Math.log10(t) - Math.log10(0.5)) / (Math.log10(80) - Math.log10(0.5))) * 100}%">${t}</span>`).join("")}</div></div>
      <div class="legend"><div class="ttl">Households with access to electricity, 2021 PHC (% of households)</div>
        ${OV_LABELS.map((l, i) => `<span class="row-inline"><span class="sw" style="background:${OV_COLORS[i]}"></span>${esc(l)} (${counts[i]})</span>`).join("")}</div>
    </div>
    <p class="note">Note: Drag the gold curtain across the map to compare. Left: VIIRS night-time radiance, ${yr} annual composite (Earth Observation Group). Right: share of households with access to electricity, by district, 2021 Population and Housing Census (District rankings). Hover over a district for both values; click to open its profile. Other years are in the <a href="#map/lights/${yr}">map explorer</a>.</p>
  </section>`;
  $("#ov-msg").innerHTML = `<div class="msg">Where the 2021 PHC recorded high household access to electricity, satellites see light at night: both maps show the same bright south and darker north (rank correlation ${fmt(cK.electricity_access.spearman, 2)} across 261 districts).</div>`;   // key message sits above the headline tiles
  if (!S.geo) {                                       // boundaries load in the background so the page appears at once
    $("#ov-map").innerHTML = `<p class="muted" style="padding:16px">Loading the map…</p>`;
    (S._geo = S._geo || LOADERS.geo()).then(() => { if (currentPage() === "overview") renderOvMap(); });
    return;
  }
  if (S.ovMap) { S.ovMap.remove(); S.ovMap = null; }
  const m = L.map("ov-map", { zoomSnap: 0.25, attributionControl: false, minZoom: 6, maxZoom: 10, scrollWheelZoom: false });
  S.ovMap = m;
  m.createPane("ovimg").style.zIndex = 450;            // night-light image above the districts, clipped at the curtain
  m.createPane("ovlines").style.zIndex = 460;          // boundaries and town names above both
  m.getPane("ovlines").style.pointerEvents = "none";
  const col = (v) => (isNum(v) ? OV_COLORS[OV_BREAKS.filter((x) => v >= x).length] : "#1a2333");
  const choro = L.geoJSON(S.geo, {
    style: (f) => ({ fillColor: col(S.byId.get(f.properties.id).so_electricity_pct), fillOpacity: 1, color: "#15171a", weight: 0, opacity: 0 }),   // boundaries come from the shared outline layer, as on the lights side
    onEachFeature: (f, l) => {
      l.bindTooltip(() => { const d = S.byId.get(f.properties.id);
        return `<strong>${esc(d.name)}</strong><br>${esc(d.region)}<br>Households with electricity access, 2021 PHC: <strong>${pct(d.so_electricity_pct, 1)}</strong><br>Mean night-time radiance, ${yr}: <strong>${fmt(d.so_ntl_mean_2021, 2)}</strong> nW/cm²/sr`; },
        { sticky: true, className: "dist-tip" });
      l.on({ click: () => { location.hash = `district/${f.properties.id}`; },
             mouseover: () => l.setStyle({ weight: 2, color: "#ffffff", opacity: 1 }), mouseout: () => l.setStyle({ weight: 0, opacity: 0 }) });
    },
  }).addTo(m);
  L.geoJSON(S.geo, { pane: "ovlines", interactive: false, style: { fill: false, color: "#c8d7f0", opacity: 0.3, weight: 0.5 } }).addTo(m);
  const img = L.imageOverlay(lightUrl(yr), S.lights.bounds, { pane: "ovimg", interactive: false }).addTo(m);
  TOWNS.filter((t) => t[3] <= 6).forEach(([n, la, lo]) => L.marker([la, lo], { pane: "ovlines", interactive: false, keyboard: false,
    icon: L.divIcon({ className: "town-label", html: esc(n), iconSize: null, iconAnchor: [3, 6] }) }).addTo(m));
  m.fitBounds(choro.getBounds(), { padding: [8, 8] });

  // curtain: the night-light image shows to the left of it, the PHC districts to the right
  const box = m.getContainer();
  const bar = L.DomUtil.create("div", "swipe-bar", box), handle = L.DomUtil.create("div", "swipe-handle", bar);
  const tagL = L.DomUtil.create("div", "swipe-tag", box), tagR = L.DomUtil.create("div", "swipe-tag", box);
  tagL.style.left = "56px"; tagR.style.right = "12px";
  tagL.textContent = `Night-time lights, ${yr}`; tagR.textContent = "Household electricity access, 2021 PHC";
  handle.textContent = "⇔"; handle.tabIndex = 0;
  Object.entries({ role: "slider", "aria-label": "Curtain position", "aria-valuemin": "0", "aria-valuemax": "100" }).forEach(([k, v]) => handle.setAttribute(k, v));
  L.DomEvent.disableClickPropagation(bar); L.DomEvent.disableScrollPropagation(bar);
  let pos = 0.5;
  const clip = () => {
    const el = img.getElement(); if (!el) return;
    const x = m.getSize().x * pos, layerX = m.containerPointToLayerPoint([x, 0]).x, imgX = (L.DomUtil.getPosition(el) || { x: 0 }).x;
    el.style.clipPath = `inset(0 ${Math.max(0, el.offsetWidth - (layerX - imgX))}px 0 0)`;   // image shows LEFT of the curtain
  };
  const set = (p) => { pos = Math.min(0.98, Math.max(0.02, p)); bar.style.left = `${pos * 100}%`; handle.setAttribute("aria-valuenow", String(Math.round(pos * 100))); clip(); };
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId); m.dragging.disable();
    const move = (ev) => { const r = box.getBoundingClientRect(); set((ev.clientX - r.left) / r.width); };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); m.dragging.enable(); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up);
  });
  handle.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); set(pos + (e.key === "ArrowLeft" ? -0.05 : 0.05)); } });
  m.on("move zoom zoomend resize viewreset", clip);
  img.getElement().addEventListener("load", clip);
  set(pos);
  setTimeout(() => { m.invalidateSize(); clip(); }, 0);
}

/* ================================================================== MAP */
/* Four views on one map, as in the AfDB-DI4A dashboard:
 *   ntl  Night lights: the VIIRS image for one year, year slider and play button
 *   cmp  Before / after: two linked maps, any two years
 *   chg  Change 2012–2025: per-pixel change image
 *   ind  District indicators: choropleth of any district result
 * Night-light images come from webapp/build_lights.py (Web Mercator PNGs, so they align with the district layer). */
const LIGHT_MODES = new Set(["ntl", "cmp", "chg", "dark"]);
const TOWNS = [   // regional capitals plus Tema, Obuasi and Techiman; z = lowest zoom at which the name shows
  ["Accra", 5.6037, -0.1870, 6], ["Kumasi", 6.6885, -1.6244, 6], ["Tamale", 9.4008, -0.8393, 6], ["Sekondi-Takoradi", 4.9346, -1.7137, 6],
  ["Cape Coast", 5.1053, -1.2466, 7], ["Koforidua", 6.0941, -0.2591, 7], ["Ho", 6.6008, 0.4713, 6], ["Sunyani", 7.3399, -2.3268, 6],
  ["Bolgatanga", 10.7856, -0.8514, 6], ["Wa", 10.0601, -2.5099, 6], ["Damongo", 9.0833, -1.8167, 7], ["Nalerigu", 10.5270, -0.3698, 7],
  ["Dambai", 8.0662, 0.1795, 7], ["Goaso", 6.8036, -2.5172, 7], ["Sefwi Wiawso", 6.2058, -2.4894, 7], ["Techiman", 7.5862, -1.9381, 7],
  ["Tema", 5.6698, -0.0166, 8], ["Obuasi", 6.2020, -1.6610, 8]];
const LIGHT_SRC = "Source: GSS computations from VIIRS Day/Night Band annual composites (Earth Observation Group, Colorado School of Mines), version 2.1 for 2012–2021 and 2.2 for 2022–2025. The 2012 image covers April 2012 to March 2013. Boundaries: GSS 261 districts.";
const MAP_OPTS = { zoomSnap: 0.25, attributionControl: false, minZoom: 6, maxZoom: 11 };

function classify(ind) {
  if (ind.cat) {
    return { kind: "cat", color: (v) => (ind.cat[v] ? ind.cat[v].color : C.na),
      legend: Object.entries(ind.cat).map(([k, o]) => ({ color: o.color, label: `${o.label} (${S.districts.filter((d) => d[ind.key] === k).length})` })) };
  }
  const vals = S.districts.map((d) => d[ind.key]).filter(isNum).sort((a, b) => a - b);
  let breaks = [0.2, 0.4, 0.6, 0.8].map((q) => quantile(vals, q));
  breaks = breaks.filter((b, i) => i === 0 || b > breaks[i - 1] + 1e-12);
  const n = breaks.length + 1;   // fewer than 5 classes when many districts share a value (e.g. 100% lit)
  const pal = n === 5 ? C.seq : Array.from({ length: n }, (_, i) => C.seq[Math.round(i * 4 / Math.max(1, n - 1))]);
  const cls = (v) => { let i = 0; while (i < breaks.length && v > breaks[i]) i++; return i; };
  const lo = [vals[0], ...breaks], hi = [...breaks, vals[vals.length - 1]];
  const legend = pal.map((c, i) => ({ color: c, label: `${fmt(lo[i], ind.d)} – ${fmt(hi[i], ind.d)}` }));
  const nNa = S.districts.length - vals.length;
  if (nNa) legend.push({ color: C.na, label: `Not defined (${nNa})` });
  return { kind: "seq", color: (v) => (isNum(v) ? pal[cls(v)] : C.na), legend };
}
function valueText(ind, v) {
  if (ind.cat) return ind.cat[v] ? ind.cat[v].label : "–";
  return fmt(v, ind.d);
}

const lightUrl = (y) => `${DATA}lights/${S.lights.files[String(y)]}`;
const panelAt = (id, y) => S.panelBy.get(`${id}-${y}`) || {};
const viewYear = () => (S.mode === "cmp" ? S.cmpB : S.mode === "chg" ? 2025 : S.mode === "dark" ? S.darkYear : S.year);
function baseStyle() {
  if (S.mode === "ind") return { weight: 0.6, color: C.stroke, opacity: 1, fillOpacity: 0.92 };
  return { weight: 0.6, color: "#c8d7f0", opacity: $("#map-borders").checked ? 0.32 : 0, fillOpacity: 0 };
}
const hiStyle = (w) => ({ weight: w, color: S.mode === "ind" ? C.ink : "#F5C242", opacity: 1 });
function restyleAll() {
  S.mapLayer.eachLayer((l) => l.setStyle(l.feature.properties.id === S.selected ? hiStyle(2.5) : baseStyle()));
}

function initMap() {
  const sel = $("#map-indicator");
  const groups = [...new Set(IND.map((i) => i.group))];
  sel.innerHTML = groups.map((g) => `<optgroup label="${esc(g)}">${IND.filter((i) => i.group === g).map((i) => `<option value="${i.key}">${esc(i.label)}</option>`).join("")}</optgroup>`).join("");
  sel.addEventListener("change", () => { location.hash = `map/${sel.value}`; });
  $("#map-search").addEventListener("change", (e) => { const d = S.byName.get(e.target.value.trim().toLowerCase()); if (d) selectDistrict(d.id, true); });
  $("#map-mode").addEventListener("click", (e) => { const b = e.target.closest("button[data-mode]"); if (b) location.hash = mapHash(b.dataset.mode); });
  $("#map-borders").addEventListener("change", restyleAll);

  if (S.lights) {
    const ys = S.lights.years;
    S.year = S.year || ys[ys.length - 1]; S.cmpA = S.cmpA || ys[0]; S.cmpB = S.cmpB || ys[ys.length - 1];
    $("#map-year").max = ys.length - 1;
    $("#map-year").addEventListener("input", (e) => { stopPlay(); const y = ys[+e.target.value]; setYear(y); history.replaceState(null, "", `#map/lights/${y}`); });
    $("#map-play").addEventListener("click", () => (S.timer ? stopPlay() : startPlay()));
    const opts = ys.map((y) => `<option value="${y}">${y}</option>`).join("");
    $("#cmp-a").innerHTML = opts; $("#cmp-b").innerHTML = opts;
    ["#cmp-a", "#cmp-b"].forEach((id) => $(id).addEventListener("change", () => {
      S.cmpA = +$("#cmp-a").value; S.cmpB = +$("#cmp-b").value; setCompare(); history.replaceState(null, "", `#${mapHash("cmp")}`);
    }));
    renderLightLegends();
    S.darkYear = S.darkYear || 2020;
    if (S.access) {
      $("#dark-year").addEventListener("click", (e) => { const b = e.target.closest("button[data-year]"); if (b) location.hash = `map/dark/${b.dataset.year}`; });
      const AL = S.access.legend;
      $("#dark-legend").innerHTML = `<div class="ttl">Inhabited areas</div>
        <div class="row"><span class="sw" style="background:${AL.lit}"></span><span>Light detected</span></div>
        <div class="row"><span class="sw" style="background:${AL.dark}"></span><span>No light detected</span></div>
        <div class="row"><span class="sw" style="background:${AL.land}"></span><span>Fewer than 5 people per pixel</span></div>`;
    } else { $('#map-mode button[data-mode="dark"]').hidden = true; }
  } else {
    document.querySelectorAll("#map-mode button").forEach((b) => { b.hidden = b.dataset.mode !== "ind"; });
  }

  S.map = L.map("map", MAP_OPTS);
  S.map.createPane("lights").style.zIndex = 350;        // below the district layer, so hover still works
  S.mapLayer = L.geoJSON(S.geo, {
    style: baseStyle,
    onEachFeature: (f, layer) => {
      layer.on({
        mouseover: () => { if (f.properties.id !== S.selected) layer.setStyle(hiStyle(2)); layer.bringToFront(); },
        mouseout: () => { if (f.properties.id !== S.selected) layer.setStyle(baseStyle()); },
        click: () => selectDistrict(f.properties.id, false),
      });
      layer.bindTooltip(() => tipHtml(f.properties.id), { sticky: true, className: "dist-tip" });
    },
  }).addTo(S.map);
  S.map.fitBounds(S.mapLayer.getBounds(), { padding: [10, 10] });
  // town names, above the images and districts but never catching the mouse
  S.map.createPane("towns").style.zIndex = 450;
  S.map.getPane("towns").style.pointerEvents = "none";
  S.towns = TOWNS.map(([n, la, lo, z]) => ({ z, m: L.marker([la, lo], { pane: "towns", interactive: false, keyboard: false,
    icon: L.divIcon({ className: "town-label", html: esc(n), iconSize: null, iconAnchor: [3, 6] }) }) }));
  const showTowns = () => S.towns.forEach(({ z, m }) => { const on = $("#map-towns").checked && S.map.getZoom() >= z; if (on && !S.map.hasLayer(m)) m.addTo(S.map); if (!on && S.map.hasLayer(m)) m.remove(); });
  S.map.on("zoomend", showTowns); $("#map-towns").addEventListener("change", showTowns); showTowns();
  if (S.lights) initSwipe();
}

/* Curtain comparison on one map: the right-hand year is drawn over the left-hand year and clipped at the curtain. */
function initSwipe() {
  const box = S.map.getContainer();
  const bar = L.DomUtil.create("div", "swipe-bar", box), handle = L.DomUtil.create("div", "swipe-handle", bar);
  const tagL = L.DomUtil.create("div", "swipe-tag", box), tagR = L.DomUtil.create("div", "swipe-tag", box);
  tagL.style.left = "56px"; tagR.style.right = "12px";
  handle.textContent = "⇔"; handle.tabIndex = 0;
  Object.entries({ role: "slider", "aria-label": "Curtain position", "aria-valuemin": "0", "aria-valuemax": "100" }).forEach(([k, v]) => handle.setAttribute(k, v));
  L.DomEvent.disableClickPropagation(bar); L.DomEvent.disableScrollPropagation(bar);
  S.swipe = { bar, handle, tagL, tagR, pos: 0.5 };
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId); S.map.dragging.disable();
    const move = (ev) => { const r = box.getBoundingClientRect(); setSwipe((ev.clientX - r.left) / r.width); };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); S.map.dragging.enable(); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up);
  });
  handle.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setSwipe(S.swipe.pos + (e.key === "ArrowLeft" ? -0.05 : 0.05)); } });
  S.map.on("move zoom zoomend resize viewreset", clipSwipe);
  showSwipe(false);
}
function showSwipe(on) {
  ["bar", "tagL", "tagR"].forEach((k) => { S.swipe[k].hidden = !on; });
  if (!on && S.ovB) { if (S.map.hasLayer(S.ovB)) S.map.removeLayer(S.ovB); }
}
function setSwipe(p) {
  S.swipe.pos = Math.min(0.98, Math.max(0.02, p));
  S.swipe.bar.style.left = `${S.swipe.pos * 100}%`;
  S.swipe.handle.setAttribute("aria-valuenow", String(Math.round(S.swipe.pos * 100)));
  clipSwipe();
}
function clipSwipe() {
  if (S.mode !== "cmp" || !S.ovB || !S.map.hasLayer(S.ovB)) return;
  const img = S.ovB.getElement();
  if (!img) return;
  const x = S.map.getSize().x * S.swipe.pos;
  const layerX = S.map.containerPointToLayerPoint([x, 0]).x;
  const imgX = (L.DomUtil.getPosition(img) || { x: 0 }).x;
  img.style.clipPath = `inset(0 0 0 ${Math.max(0, layerX - imgX)}px)`;
}

function mapHash(mode) {
  if (mode === "ind") return `map/${S.mapInd ? S.mapInd.key : "se_lit_cagr"}`;
  if (mode === "ntl") return `map/lights/${S.year}`;
  if (mode === "cmp") return `map/compare/${S.cmpA}/${S.cmpB}`;
  if (mode === "dark") return `map/dark/${S.darkYear}`;
  return "map/change";
}

function renderMap(args = []) {
  if (!S.map) initMap();
  const [a, b, c] = args;
  const ys = S.lights ? S.lights.years : [];
  let mode;
  if (INDK[a]) { mode = "ind"; S.mapInd = INDK[a]; }
  else if (a === "lights") mode = "ntl";
  else if (a === "compare") mode = "cmp";
  else if (a === "change") mode = "chg";
  else if (a === "dark" && S.access) mode = "dark";
  else mode = S.mode || (S.lights ? "ntl" : "ind");
  if (mode === "dark" && ["2012", "2020"].includes(b)) S.darkYear = +b;
  if (!S.lights) mode = "ind";
  if (mode === "ntl" && ys.includes(+b)) S.year = +b;
  if (mode === "cmp") { if (ys.includes(+b)) S.cmpA = +b; if (ys.includes(+c)) S.cmpB = +c; }
  setMode(mode);
}

function setMode(mode) {
  if (mode !== "ntl") stopPlay();
  S.mode = mode;
  document.querySelectorAll("#map-mode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  document.querySelectorAll(".map-controls [data-for]").forEach((el) => { el.hidden = !el.dataset.for.split(" ").includes(mode); });
  $("#map-ranks").hidden = mode !== "ind";
  $("#map").classList.toggle("night", LIGHT_MODES.has(mode));
  if (S.swipe) showSwipe(mode === "cmp");
  if (mode !== "cmp" && S.ovA && S.ovA.getElement()) S.ovA.getElement().style.clipPath = "";

  if (mode === "ind") {
    removeOverlay();
    restyleAll();
    setIndicator(S.mapInd ? S.mapInd.key : "se_lit_cagr");
  } else {
    restyleAll();
    $("#map-source").textContent = LIGHT_SRC;
    if (mode === "ntl") { preloadLights(); setYear(S.year); }
    if (mode === "chg") setOverlay(`${DATA}lights/${S.lights.change_file}`, "Change 2012 → 2025");
    if (mode === "cmp") setCompare();
    if (mode === "dark") setDark();
  }
  setTimeout(() => { S.map.invalidateSize(); clipSwipe(); }, 0);
  if (S.selected) showSelected(S.selected); else $("#map-selected").innerHTML = "";
}

function setOverlay(url, badge) {
  if (!S.ovA) S.ovA = L.imageOverlay(url, S.lights.bounds, { pane: "lights", interactive: false });
  else S.ovA.setUrl(url);
  if (!S.map.hasLayer(S.ovA)) S.ovA.addTo(S.map);
  S.badgeA = setBadge(S.map, S.badgeA, badge);
}
function removeOverlay() {
  if (S.ovA && S.map.hasLayer(S.ovA)) S.map.removeLayer(S.ovA);
  if (S.badgeA) S.badgeA.remove();
}
function setBadge(map, ctl, text) {
  if (!ctl) { ctl = L.control({ position: "topright" }); ctl.onAdd = () => L.DomUtil.create("div", "map-badge"); }
  if (!ctl._map) ctl.addTo(map);
  ctl.getContainer().textContent = text;
  return ctl;
}
function preloadLights() {
  if (S.preloaded) return;
  S.preloaded = true;
  S.lights.years.forEach((y) => { const im = new Image(); im.src = lightUrl(y); });
}
function setYear(y) {
  S.year = y;
  $("#map-year").value = S.lights.years.indexOf(y);
  $("#year-label").textContent = y;
  setOverlay(lightUrl(y), String(y));
  const ns = S.se.national_series.find((r) => r.year === y);
  $("#ntl-stat").innerHTML = `<strong>${pct(S.lights.share_of_ghana_lit[String(y)] * 100, 1)}</strong> of Ghana's land showed detectable light (0.5 nW/cm²/sr or more) in ${y}; settled lit area at the 1.0 nW/cm²/sr threshold was <strong>${fmt(ns.lit_area_km2, 0)} km²</strong>.`;
  if (S.selected) showSelected(S.selected);
}
function startPlay() {
  const ys = S.lights.years;
  if (S.year === ys[ys.length - 1]) setYear(ys[0]);
  $("#map-play").textContent = "❚❚ Pause";
  S.timer = setInterval(() => {
    const i = ys.indexOf(S.year);
    if (i >= ys.length - 1) { stopPlay(); return; }
    setYear(ys[i + 1]);
    history.replaceState(null, "", `#map/lights/${S.year}`);
  }, 900);
}
function stopPlay() {
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
  const b = $("#map-play"); if (b) b.textContent = "▶ Play";
}

function setCompare() {
  $("#cmp-a").value = S.cmpA; $("#cmp-b").value = S.cmpB;
  setOverlay(lightUrl(S.cmpA), "");
  if (S.badgeA) S.badgeA.remove();
  if (!S.ovB) S.ovB = L.imageOverlay(lightUrl(S.cmpB), S.lights.bounds, { pane: "lights", interactive: false });
  else S.ovB.setUrl(lightUrl(S.cmpB));
  if (!S.map.hasLayer(S.ovB)) S.ovB.addTo(S.map);
  S.ovB.getElement().addEventListener("load", clipSwipe);
  S.swipe.tagL.textContent = String(S.cmpA); S.swipe.tagR.textContent = String(S.cmpB);
  setSwipe(S.swipe.pos);
  if (S.selected) showSelected(S.selected);
}
function setDark() {
  const y = S.darkYear, A = S.access;
  document.querySelectorAll("#dark-year button").forEach((b) => b.classList.toggle("on", +b.dataset.year === y));
  setOverlay(`${DATA}lights/${A.images[String(y)]}`, `Areas in the dark, ${y}`);
  const n = A.national.find((r) => r.year === y);
  $("#dark-stat").innerHTML = `<strong>${fmt(n["pop_dark_0.5"] / 1e6, 1)} million people</strong> (${pct(n["dark_share_0.5"] * 100, 0)} of the population) lived where no light was detected in ${y}.`;
  $("#map-source").textContent = `Source: GSS Data Science Unit computations from WorldPop population (100 m, UN-adjusted) and VIIRS night-time lights. Inhabited: at least 5 people per pixel of about 460 m; no light detected: radiance below 0.5 nW/cm²/sr. Boundaries: GSS 261 districts.`;
}

function renderLightLegends() {
  const L0 = S.lights.legend, lo = Math.log10(L0.floor), hi = Math.log10(L0.ceil);
  const pos = (v) => ((Math.log10(v) - lo) / (hi - lo)) * 100;
  $("#ntl-legend").innerHTML = `<div class="ttl">Radiance, nW/cm²/sr (log scale)</div>
    <div class="ramp" style="background:linear-gradient(to right, ${L0.stops.join(", ")})"></div>
    <div class="ramp-ticks">${L0.ticks.map((t) => `<span style="left:${pos(t)}%">${t}</span>`).join("")}</div>
    <div class="row"><span class="sw" style="background:${L0.land}"></span><span>Below 0.5: no light detected</span></div>`;
  const CL = S.lights.change_legend;
  $("#chg-legend").innerHTML = `<div class="ttl">Change in radiance, 2012 to 2025</div>
    <div class="ramp" style="background:linear-gradient(to right, ${CL.stops.join(", ")})"></div>
    <div class="ramp-ticks">${CL.ticks.map(([v, t]) => `<span style="left:${(v + 1) * 50}%">${esc(t)}</span>`).join("")}</div>
    <div class="row"><span class="sw" style="background:${L0.land}"></span><span>Little change, or dark in both years</span></div>`;
}

function tipHtml(id) {
  const d = S.byId.get(id);
  const head = `<strong>${esc(d.name)}</strong><br>${esc(d.region)}`;
  if (S.mode === "ind") { const ind = S.mapInd; return `${head}<br>${esc(ind.label)}: <strong>${esc(valueText(ind, d[ind.key]))}</strong>`; }
  if (S.mode === "cmp") {
    const a = panelAt(id, S.cmpA), b = panelAt(id, S.cmpB);
    return `${head}<br>Lit area ${S.cmpA}: <strong>${fmt(a.se_lit_area_km2, 1)} km²</strong><br>Lit area ${S.cmpB}: <strong>${fmt(b.se_lit_area_km2, 1)} km²</strong>`;
  }
  if (S.mode === "dark") {
    const y = S.darkYear, sh = d[`ac_dark_share_${y}`], n = d[`ac_pop_dark_${y}`];
    return `${head}<br>Living in unlit areas, ${y}: <strong>${fmt(n, 0)}</strong> (${pct(sh, 1)})<br>${esc(ACC[d.ac_class] ? ACC[d.ac_class].label : "")}`;
  }
  if (S.mode === "chg") {
    return `${head}<br>Lit area: <strong>${fmt(d.se_lit_2012_km2, 1)} → ${fmt(d.se_lit_2025_km2, 1)} km²</strong><br>Mean radiance: ${fmt(panelAt(id, 2012).se_ntl_mean, 2)} → ${fmt(panelAt(id, 2025).se_ntl_mean, 2)}`;
  }
  const p = panelAt(id, S.year);
  return `${head}<br>Lit area ${S.year}: <strong>${fmt(p.se_lit_area_km2, 1)} km²</strong> (${pct(p.se_lit_share * 100, 0)} of district)<br>Mean radiance: ${fmt(p.se_ntl_mean, 2)} nW/cm²/sr`;
}

function setIndicator(key) {
  const ind = INDK[key];
  S.mapInd = ind;
  $("#map-indicator").value = key;
  $("#map-desc").textContent = ind.desc;
  const k = classify(ind);
  S.mapLayer.eachLayer((l) => { const d = S.byId.get(l.feature.properties.id); l.setStyle({ fillColor: k.color(d[key]) }); });
  $("#map-legend").innerHTML = `<div class="ttl">${esc(ind.label)}</div>` + k.legend.map((r) => `<div class="row"><span class="sw" style="background:${r.color}"></span><span>${esc(r.label)}</span></div>`).join("") +
    (k.kind === "seq" ? `<div class="note">Classes are quintiles of the 261 districts.</div>` : "");
  $("#map-source").textContent = `Source: ${ind.group === SRC_SE ? "GSS, Spatial Expansion of Settlements in Ghana, 2012–2025" : ind.group === SRC_AC ? "GSS Data Science Unit, from WorldPop population and VIIRS night-time lights" : "GSS, Night-time Lights as a Lens on Socio-economic Development in Ghana"}. Boundaries: GSS 261 districts.`;
  if (ind.cat) {
    $("#map-top").innerHTML = `<li class="muted">Rankings apply to numeric indicators.</li>`; $("#map-bottom").innerHTML = "";
  } else {
    const rows = S.districts.filter((d) => isNum(d[key])).sort((a, b) => b[key] - a[key]);
    const li = (d) => `<li><a href="#district/${d.id}">${esc(d.name)}</a> <span class="muted">· ${esc(d.region)}</span><span class="rv">${fmt(d[key], ind.d)}</span></li>`;
    // say so when the 10th place is shared, e.g. the many saturated districts with zero lit-area growth
    const tie = (list, v) => { const n = rows.filter((d) => d[key] === v).length - list.filter((d) => d[key] === v).length;
      return n > 0 ? `<li class="muted" style="list-style:none">…and ${n} more district${n > 1 ? "s" : ""} at ${fmt(v, ind.d)}</li>` : ""; };
    const top10 = rows.slice(0, 10), bot10 = rows.slice(-10).reverse();
    $("#map-top").innerHTML = top10.map(li).join("") + tie(top10, top10[top10.length - 1][key]);
    $("#map-bottom").innerHTML = bot10.map(li).join("") + tie(bot10, bot10[bot10.length - 1][key]);
  }
  if (S.selected) showSelected(S.selected);
}
function selectDistrict(id, zoom) {
  const prevId = S.selected;
  S.selected = id;
  if (prevId) { const prev = findLayer(prevId); if (prev) prev.setStyle(baseStyle()); }
  const l = findLayer(id);
  if (l) { l.setStyle(hiStyle(2.5)); l.bringToFront(); if (zoom) S.map.fitBounds(l.getBounds(), { maxZoom: 9 }); }
  showSelected(id);
}
const findLayer = (id) => { let f = null; S.mapLayer.eachLayer((l) => { if (l.feature.properties.id === id) f = l; }); return f; };
function showSelected(id) {
  const d = S.byId.get(id);
  let body;
  if (S.mode === "ind") {
    const ind = S.mapInd;
    let rank = "";
    if (!ind.cat && isNum(d[ind.key])) {
      const n = S.districts.filter((x) => isNum(x[ind.key])).length;
      rank = `Rank ${S.districts.filter((x) => isNum(x[ind.key]) && x[ind.key] > d[ind.key]).length + 1} of ${n} (1 = highest)`;
    }
    body = `<div class="s-val">${esc(valueText(ind, d[ind.key]))}</div><div class="muted">${esc(ind.label)}${rank ? `<br>${rank}` : ""}</div>`;
  } else if (S.mode === "dark") {
    const y = S.darkYear;
    body = `<div class="s-val">${pct(d[`ac_dark_share_${y}`], 1)}</div><div class="muted">of residents (${fmt(d[`ac_pop_dark_${y}`], 0)} people) lived where no light was detected in ${y}; ${pct(d[`ac_dark_share_${y === 2020 ? 2012 : 2020}`], 1)} in ${y === 2020 ? 2012 : 2020}</div>`;
  } else {
    const y = viewYear(), p = panelAt(id, y);
    body = `<div class="s-val">${fmt(p.se_lit_area_km2, 1)} km²</div><div class="muted">lit area in ${y} (${pct(p.se_lit_share * 100, 0)} of the district); ${fmt(d.se_lit_2012_km2, 1)} km² in 2012</div>`;
  }
  $("#map-selected").innerHTML = `<div class="s-name">${esc(d.name)}</div><div class="muted">${esc(d.region)} Region</div>${body}
    <p><a class="btn" href="#district/${d.id}">Open district profile</a></p>`;
}

/* ================================================================== SETTLEMENT GROWTH */
function renderExpansion() {
  const h = S.se.headline, ns = S.se.national_series, th = S.se.theil_series;
  const R = S.regions.slice();
  const mc = h.mode_counts;
  $("#se-kpis").innerHTML = [
    kpi("Lit area, 2012 → 2025", `${fmt(h.lit_area_2012_km2, 0)} → ${fmt(h.lit_area_2025_km2, 0)} km²`, `+${fmt(h.abs_change_km2, 0)} km² (${signed(h.total_change_pct, 0)}%)`),
    kpi("Compound growth", `${fmt(h.cagr_pct, 1)}% a year`, "national lit area, 2012–2025"),
    kpi("Districts expanding", `${h.districts_gaining} of 261`, `${h.districts_losing} contracted; ${h.newly_lit_districts} lit for the first time`),
    kpi("Growth from new land lit", pct(h.area_effect_pct, 1), `the rest (${pct(h.intensity_effect_pct, 1)}) from existing lit land brightening`),
  ].join("");

  const bySize = R.slice().sort((a, b) => b.se_lit_2025_km2 - a.se_lit_2025_km2);
  const top = bySize[0], ga = R.find((r) => r.region === "Greater Accra");
  const byG = R.slice().sort((a, b) => b.se_cagr_pct - a.se_cagr_pct);
  const fast = byG.filter((r) => r.se_cagr_pct > 22).map((r) => r.region);
  const t0 = th[0], t1 = th[th.length - 1];
  const g15 = S.se.top15_gain;

  $("#se-figs").innerHTML = [
    figure({ msg: `Settlements expanded more than six-fold: lit area rose from about ${fmt(h.lit_area_2012_km2, 0)} km² in 2012 to ${fmt(h.lit_area_2025_km2, 0)} km² in 2025, roughly ${fmt(h.cagr_pct, 1)} percent a year.`,
      caption: "Figure 1: National lit area, 2012–2025", charts: [{ id: "se-f1" }],
      note: "Sum of district lit area at a 1.0 nW/cm²/sr threshold, district boundaries held constant. VIIRS annual composites v2.1 (2012–2021) and v2.2 (2022–2025)." }),
    figure({ msg: `${top.region} has overtaken Greater Accra as the most extensively settled region (about ${fmt(top.se_lit_2025_km2, 0)} against ${fmt(ga.se_lit_2025_km2, 0)} km² in 2025); the saturated capital can no longer spread outward.`,
      caption: "Figure 2: Lit area by region, 2012 and 2025", charts: [{ id: "se-f2", cls: "tall" }],
      note: "Regions ordered by lit area in 2025." }),
    figure({ msg: `The fastest regional growth was in ${fast.slice(0, -1).join(", ")} and ${fast.slice(-1)} (each above 22 percent a year); the slowest was Greater Accra (${fmt(ga.se_cagr_pct, 1)} percent).`,
      caption: "Figure 3: Growth of lit area by region, 2012–2025", charts: [{ id: "se-f3", cls: "tall" }],
      note: "Compound annual growth rate of regional lit area." }),
    figure({ msg: `Regional gaps are narrowing: inequality in settlement area more than halved (Theil ${fmt(t0.theil_total, 2)} to ${fmt(t1.theil_total, 2)}), and the share due to differences between regions fell from ${fmt(t0.between_share_pct, 0)} to ${fmt(t1.between_share_pct, 0)} percent.`,
      caption: "Figure 4: Inequality in lit area across districts, 2012–2025", charts: [{ id: "se-f4a", cls: "short" }, { id: "se-f4b", cls: "short" }],
      panels: ["Theil index of district lit area", "Share of inequality between regions (%)"],
      note: "Theil T index of district lit area, decomposed into between-region and within-region components." }),
    figure({ msg: `Growth was overwhelmingly outward: ${mc["sprawl-dominated"]} of 261 districts were sprawl-dominated, while intensification was confined to ${mc["intensification-dominated"]} saturated metropolitan cores with no dark land left.`,
      caption: "Figure 5: Districts by dominant mode of expansion, 2012–2025", charts: [{ id: "se-f5", cls: "short" }],
      tools: `<a class="btn" href="#map/se_mode">Show on the map</a>`,
      note: "The log change in a district's summed radiance, 2012–2025, is split into a lit-area (extensification) component and an intensity component. Sprawl-dominated: lit-area component at least 70 percent of the change; intensification-dominated: intensity component at least 70 percent; balanced: neither." }),
    figure({ msg: `The largest absolute gains were on the fringes of Accra and in the forest belt, led by ${esc(g15[0].name)} (+${fmt(g15[0].se_lit_change_km2, 0)} km²).`,
      caption: "Figure 6: Top 15 districts by gain in lit area, 2012–2025", charts: [{ id: "se-f6", cls: "tall" }],
      tools: `<a class="btn" href="#map/se_lit_change_km2">Show gains on the map</a> <a class="btn" href="#map/se_hotspot_level">Show urban hotspots</a>` }),
    tableFig({ caption: "Table 1: Regional profile of settlement-area growth, 2012–2025",
      head: ["Region", "Districts", "Lit area 2012 (km²)", "Lit area 2025 (km²)", "Change (%)", "Growth (% per year)", "Districts sprawl-dominated", "Urban hotspot districts"],
      numCols: [1, 2, 3, 4, 5, 6, 7],
      rows: bySize.map((r) => [esc(r.region), r.se_n_districts, fmt(r.se_lit_2012_km2, 0), fmt(r.se_lit_2025_km2, 0), fmt(r.se_pct_change, 0), fmt(r.se_cagr_pct, 1), r.se_sprawl_dominated, r.se_hotspot_districts]),
      note: "Urban hotspot districts: significant Getis-Ord Gi* hot spot of 2025 radiance at 90 percent confidence or more." }),
  ].join("");

  // F1 national lit area (single series, endpoint labels)
  const last = ns[ns.length - 1], first = ns[0];
  plot("se-f1", [{ x: ns.map((r) => r.year), y: ns.map((r) => r.lit_area_km2), type: "scatter", mode: "lines+markers",
    line: { color: C.blue, width: 2 }, marker: { size: 7, color: C.blue }, hovertemplate: "%{x}: %{y:,.0f} km²<extra></extra>" }],
  { yaxis: { title: { text: "Lit area (km²)" }, rangemode: "tozero", tickformat: ",.0f" }, xaxis: { dtick: 1, range: [2011.6, 2025.4] },
    annotations: [first, last].map((r) => ({ x: r.year, y: r.lit_area_km2, text: `${fmt(r.lit_area_km2, 0)} km²`, showarrow: false, yshift: 16, font: { size: 12, color: C.ink } })) });

  // F2 dumbbell 2012 -> 2025
  const ord = bySize.slice().reverse();
  const segX = [], segY = [];
  ord.forEach((r) => { segX.push(r.se_lit_2012_km2, r.se_lit_2025_km2, null); segY.push(r.region, r.region, null); });
  plot("se-f2", [
    { x: segX, y: segY, type: "scatter", mode: "lines", line: { color: C.grayLine, width: 2 }, hoverinfo: "skip", showlegend: false },
    { x: ord.map((r) => r.se_lit_2012_km2), y: ord.map((r) => r.region), name: "2012", type: "scatter", mode: "markers", marker: { size: 10, color: C.orange, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}, 2012: %{x:,.0f} km²<extra></extra>" },
    { x: ord.map((r) => r.se_lit_2025_km2), y: ord.map((r) => r.region), name: "2025", type: "scatter", mode: "markers", marker: { size: 10, color: C.blue, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}, 2025: %{x:,.0f} km²<extra></extra>" },
  ], { showlegend: true, legend: { orientation: "h", x: 0, y: 1.04 }, xaxis: { title: { text: "Lit area (km²)" }, tickformat: ",.0f", rangemode: "tozero" }, margin: { l: 110, r: 24, t: 30, b: 48 } });

  // F3 CAGR by region
  const og = byG.slice().reverse();
  plot("se-f3", [{ x: og.map((r) => r.se_cagr_pct), y: og.map((r) => r.region), type: "bar", orientation: "h", marker: { color: og.map((r) => (r.region === "Greater Accra" ? C.ink3 : C.blue)) },
    text: og.map((r) => fmt(r.se_cagr_pct, 1)), textposition: "outside", cliponaxis: false, textfont: { color: C.ink2, size: 11 },
    hovertemplate: "%{y}: %{x:.1f}% per year<extra></extra>" }],
  { xaxis: { title: { text: "Growth of lit area (% per year)" }, rangemode: "tozero" }, margin: { l: 110, r: 40, t: 16, b: 48 } });

  // F4 Theil (two panels, one axis each)
  plot("se-f4a", [{ x: th.map((r) => r.year), y: th.map((r) => r.theil_total), type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 7 }, hovertemplate: "%{x}: %{y:.3f}<extra></extra>" }],
    { yaxis: { title: { text: "Theil index" }, rangemode: "tozero" }, xaxis: { dtick: 2, range: [2011.5, 2025.5] } });
  plot("se-f4b", [{ x: th.map((r) => r.year), y: th.map((r) => r.between_share_pct), type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 7 }, hovertemplate: "%{x}: %{y:.1f}%<extra></extra>" }],
    { yaxis: { title: { text: "Between-region share (%)" }, rangemode: "tozero" }, xaxis: { dtick: 2, range: [2011.5, 2025.5] } });

  // F5 modes (nominal: one colour)
  const modes = ["sprawl-dominated", "balanced", "intensification-dominated", "newly lit / undefined"].reverse();
  plot("se-f5", [{ x: modes.map((m) => mc[m] || 0), y: modes.map((m) => MODE[m].label), type: "bar", orientation: "h", marker: { color: C.blue },
    text: modes.map((m) => String(mc[m] || 0)), textposition: "outside", cliponaxis: false, textfont: { color: C.ink2 }, hovertemplate: "%{y}: %{x} districts<extra></extra>" }],
  { xaxis: { title: { text: "Number of districts" }, rangemode: "tozero" }, margin: { l: 190, r: 40, t: 10, b: 48 } });

  // F6 top 15 gains
  const tg = g15.slice().reverse();
  plot("se-f6", [{ x: tg.map((r) => r.se_lit_change_km2), y: tg.map((r) => r.name), type: "bar", orientation: "h", marker: { color: C.blue },
    customdata: tg.map((r) => [r.region, r.se_lit_2012_km2, r.se_lit_2025_km2]),
    text: tg.map((r) => fmt(r.se_lit_change_km2, 0)), textposition: "outside", cliponaxis: false, textfont: { color: C.ink2, size: 11 },
    hovertemplate: "<b>%{y}</b> (%{customdata[0]})<br>%{customdata[1]:,.0f} → %{customdata[2]:,.0f} km²<br>gain %{x:,.0f} km²<extra></extra>" }],
  { xaxis: { title: { text: "Gain in lit area (km²)" }, rangemode: "tozero" }, margin: { l: 170, r: 40, t: 10, b: 48 } });
}

/* ================================================================== SOCIO-ECONOMIC */
function renderSocio() {
  const so = S.so, h = so.headline;
  const corr = so.correlations_2021;
  const cK = Object.fromEntries(corr.map((r) => [r.column, r]));
  const th = Object.fromEntries(so.theil_2021.map((r) => [r.indicator, r]));
  const rt = so.regional_trend;
  const R = S.regions.slice();
  const ga21 = rt.find((r) => r.region === "Greater Accra" && r.year === 2021).mean;
  const as21 = rt.find((r) => r.region === "Ashanti" && r.year === 2021).mean;
  const growth = so.regional_growth_2012_2024.slice();
  const gGA = growth.find((r) => r.region === "Greater Accra").growth_pct;

  $("#so-kpis").innerHTML = [
    kpi("Mean district radiance, 2012 → 2025", `${fmt(h.mean_radiance_2012, 2)} → ${fmt(h.mean_radiance_2025, 2)}`, `${signed(h.increase_2012_2025_pct, 0)}% over thirteen years (nW/cm²/sr)`),
    kpi("Brightest district against dimmest, 2021", `${fmt(h.brightest.ntl_mean / h.dimmest.ntl_mean, 0)} times`, `${esc(h.brightest.name)} (${fmt(h.brightest.ntl_mean, 1)}) against ${esc(h.dimmest.name)} (${fmt(h.dimmest.ntl_mean, 3)})`),
    kpi("Inequality between regions", pct(h.theil_between_share_ntl_pct, 1), "of the Theil index of district radiance, 2021"),
    kpi("Convergence slope", fmt(h.convergence_slope, 2), "darker districts in 2012 grew faster to 2024"),
  ].join("");

  const theilOrder = ["Night-time lights", "Internet use", "Relative Wealth Index (shifted)", "Electricity access"];
  const scatterOpts = IND.filter((i) => i.group === SRC_SO && !["so_ntl_mean_2021", "so_growth_pct"].includes(i.key));

  $("#so-figs").innerHTML = [
    figure({ msg: `Night-time light has risen almost without interruption: mean district radiance went from ${fmt(h.mean_radiance_2012, 2)} in 2012 to ${fmt(h.mean_radiance_2025, 2)} in 2025, and the median district rose more than tenfold, so brightening has spread well beyond the cities.`,
      caption: "Figure 1: Mean and median district radiance, 2012–2025", charts: [{ id: "so-f1" }],
      note: "Mean and median of the 261 district mean radiances (nW/cm²/sr), VIIRS annual composites." }),
    figure({ msg: `Greater Accra is on a trajectory of its own, with an average district radiance close to ${fmt(ga21, 0)} in 2021, more than ${Math.floor(ga21 / as21)} times that of Ashanti, the next brightest region; every region is rising.`,
      caption: "Figure 2: Mean district radiance by region, 2012–2025", charts: [{ id: "so-f2", cls: "tall" }],
      tools: `<label for="so-f2-sel">Highlight region</label> <select id="so-f2-sel">${[...new Set(rt.map((r) => r.region))].sort().map((r) => `<option ${r === "Greater Accra" ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>`,
      note: "Logarithmic scale. Each line is the mean of the region's district radiances." }),
    figure({ msg: `All ten of the brightest districts in 2021 are in Greater Accra, led by ${esc(h.brightest.name)} (${fmt(h.brightest.ntl_mean, 1)}); the dimmest are dominated by the Savannah Region, and ${esc(h.dimmest.name)} is the darkest (${fmt(h.dimmest.ntl_mean, 3)}).`,
      caption: "Figure 3: Brightest and dimmest districts by mean radiance, 2021", charts: [{ id: "so-f3a", cls: "short" }, { id: "so-f3b", cls: "short" }],
      panels: ["10 brightest (nW/cm²/sr)", "10 dimmest (nW/cm²/sr)"], note: "Mean radiance of all pixels in the district." }),
    figure({ msg: `Disparity within regions is a feature of the already-bright regions: Greater Accra's inter-quartile range is ${fmt(R.find((r) => r.region === "Greater Accra").so_iqr_ntl, 1)}, while the lagging regions are uniformly dark.`,
      caption: "Figure 4: Inter-quartile range of district radiance by region, 2021", charts: [{ id: "so-f4", cls: "tall" }],
      note: "Difference between the 75th and 25th percentiles of district mean radiance within each region." }),
    figure({ msg: `About ${fmt(th["Night-time lights"].between_share * 100, 0)} percent of inequality in night-time lights and in internet use lies between regions; electricity access is the most evenly spread, with ${fmt(th["Electricity access"].within_share * 100, 0)} percent of its inequality within regions.`,
      caption: "Figure 5: Decomposition of inequality, between and within regions, 2021", charts: [{ id: "so-f5", cls: "short" }],
      note: "Theil T index across the 261 districts, each district weighted equally. The Relative Wealth Index is shifted to positive values before the index is computed." }),
    figure({ msg: `The fastest growth came where the period began in darkness: Oti and the Upper East more than tenfold between 2012 and 2024, against ${fmt(gGA, 0)} percent for Greater Accra.`,
      caption: "Figure 6: Growth in mean district radiance by region, 2012–2024", charts: [{ id: "so-f6", cls: "tall" }],
      note: "Percentage change in the regional mean of district radiance, 2012 to 2024." }),
    figure({ msg: `Districts that were darkest in 2012 have grown fastest since: the convergence slope is ${fmt(h.convergence_slope, 2)}, so the periphery is brightening more quickly than the centre even though the absolute gap remains wide.`,
      caption: "Figure 7: Growth in radiance against initial radiance, districts, 2012–2024", charts: [{ id: "so-f7" }],
      note: `Log growth of mean radiance 2012–2024 against log radiance in 2012; ${h.convergence_n} districts (the ${261 - h.convergence_n} with no light in 2012 are excluded). Correlation ${fmt(h.convergence_pearson_r, 2)} (Pearson), ${fmt(h.convergence_spearman, 2)} (Spearman rank).` }),
    figure({ msg: `Night-time light is very strongly associated with population density (${fmt(cK.pop_density.spearman, 2)}), clean cooking fuel (${fmt(cK.clean_cooking_fuel.spearman, 2)}) and electricity access (${fmt(cK.electricity_access.spearman, 2)}), and strongly negatively with vulnerable employment (${fmt(cK.vulnerable_employment.spearman, 2)}) and multidimensional poverty (${fmt(cK.mpi_rate.spearman, 2)}).`,
      caption: "Figure 8: Correlation of night-time lights with socio-economic indicators, 2021", charts: [{ id: "so-f8", cls: "tall" }],
      note: "Spearman rank correlation with mean radiance, and Pearson correlation with the logarithm of mean radiance; 261 districts." }),
    figure({ msg: "Each indicator can be compared with district brightness directly; the districts of Greater Accra are highlighted.",
      caption: "Figure 9: District mean radiance against a socio-economic indicator, 2021", charts: [{ id: "so-f9" }],
      tools: `<label for="so-f9-sel">Indicator</label> <select id="so-f9-sel">${scatterOpts.map((i) => `<option value="${i.key}" ${i.key === "so_rwi" ? "selected" : ""}>${esc(i.label)}</option>`).join("")}</select>`,
      note: "Horizontal axis on a logarithmic scale." }),
    tableFig({ caption: "Table 1: Regional profile of night-time lights and development indicators, 2021",
      head: ["Region", "Districts", "Mean radiance", "Median radiance", "Inter-quartile range", "Electricity access (%)", "Internet use (%)", "Multidimensional poverty (%)"],
      numCols: [1, 2, 3, 4, 5, 6, 7],
      rows: R.slice().sort((a, b) => b.so_mean_ntl - a.so_mean_ntl).map((r) => [esc(r.region), r.so_districts, fmt(r.so_mean_ntl, 2), fmt(r.so_median_ntl, 2), fmt(r.so_iqr_ntl, 2), fmt(r.so_electricity_pct, 1), fmt(r.so_internet_pct, 1), fmt(r.so_poverty_pct, 1)]),
      note: "Radiance in nW/cm²/sr. Regional values are unweighted means and quartiles of district values." }),
  ].join("");

  // F1 mean & median (2 series: legend + direct end labels)
  const nt = so.national_trend, yrs = nt.map((r) => r.year), lastY = yrs[yrs.length - 1];
  plot("so-f1", [
    { x: yrs, y: nt.map((r) => r.mean), name: "Mean", type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 7 }, hovertemplate: "%{x}, mean: %{y:.2f}<extra></extra>" },
    { x: yrs, y: nt.map((r) => r.median), name: "Median", type: "scatter", mode: "lines+markers", line: { color: C.orange, width: 2 }, marker: { size: 7 }, hovertemplate: "%{x}, median: %{y:.3f}<extra></extra>" },
  ], { showlegend: true, yaxis: { title: { text: "Radiance (nW/cm²/sr)" }, rangemode: "tozero" }, xaxis: { dtick: 1, range: [2011.6, 2025.4] },
    annotations: [["Mean", nt[nt.length - 1].mean], ["Median", nt[nt.length - 1].median]].map(([t, v]) => ({ x: lastY, y: v, text: t, xanchor: "left", xshift: 8, showarrow: false, font: { size: 12, color: C.ink2 } })),
    margin: { l: 56, r: 70, t: 30, b: 48 } });

  // F2 regional lines with highlight
  const drawF2 = () => {
    const hi = $("#so-f2-sel").value;
    const regs = [...new Set(rt.map((r) => r.region))].sort((a, b) => (a === hi) - (b === hi));
    plot("so-f2", regs.map((reg) => {
      const s = rt.filter((r) => r.region === reg), on = reg === hi;
      return { x: s.map((r) => r.year), y: s.map((r) => r.mean), name: reg, type: "scatter", mode: on ? "lines+markers" : "lines",
        line: { color: on ? C.blue : C.grayLine, width: on ? 2.5 : 1.25 }, marker: { size: 7 },
        hovertemplate: `${esc(reg)}, %{x}: %{y:.2f}<extra></extra>` };
    }), { yaxis: { type: "log", title: { text: "Mean district radiance (log scale)" }, tickvals: [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30], ticktext: ["0.01", "0.03", "0.1", "0.3", "1", "3", "10", "30"] },
      xaxis: { dtick: 1, range: [2011.6, 2025.4] },
      annotations: [{ x: 2025, y: Math.log10(rt.find((r) => r.region === hi && r.year === 2025).mean), text: hi, xanchor: "left", xshift: 8, showarrow: false, font: { color: C.ink, size: 12 } }],
      margin: { l: 64, r: 110, t: 16, b: 48 } });
  };
  drawF2();
  $("#so-f2-sel").addEventListener("change", drawF2);

  // F3 top / bottom
  const tb = so.top_bottom_2021;
  const tTop = tb.filter((r) => r.group === "top").reverse(), tBot = tb.filter((r) => r.group === "bottom").reverse();
  const barH = (id, rows, d) => plot(id, [{ x: rows.map((r) => r.ntl_mean), y: rows.map((r) => r.name), type: "bar", orientation: "h", marker: { color: C.blue },
    customdata: rows.map((r) => r.region), text: rows.map((r) => fmt(r.ntl_mean, d)), textposition: "outside", cliponaxis: false, textfont: { size: 11, color: C.ink2 },
    hovertemplate: `<b>%{y}</b> (%{customdata})<br>%{x:.${d}f} nW/cm²/sr<extra></extra>` }],
  { xaxis: { rangemode: "tozero" }, margin: { l: 150, r: 44, t: 8, b: 36 } });
  barH("so-f3a", tTop, 1); barH("so-f3b", tBot, 3);

  // F4 IQR by region
  const iq = R.slice().sort((a, b) => a.so_iqr_ntl - b.so_iqr_ntl);
  plot("so-f4", [{ x: iq.map((r) => r.so_iqr_ntl), y: iq.map((r) => r.region), type: "bar", orientation: "h", marker: { color: C.blue },
    text: iq.map((r) => fmt(r.so_iqr_ntl, 2)), textposition: "outside", cliponaxis: false, textfont: { size: 11, color: C.ink2 }, hovertemplate: "%{y}: %{x:.2f}<extra></extra>" }],
  { xaxis: { title: { text: "Inter-quartile range (nW/cm²/sr)" }, rangemode: "tozero" }, margin: { l: 110, r: 44, t: 16, b: 48 } });

  // F5 Theil stacked between/within (2 series)
  const tl = theilOrder.slice().reverse(), lbl = (s) => s.replace(" (shifted)", "");
  plot("so-f5", [
    { x: tl.map((k) => th[k].between_share * 100), y: tl.map(lbl), name: "Between regions", type: "bar", orientation: "h", marker: { color: C.blue, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}: %{x:.1f}% between regions<extra></extra>",
      text: tl.map((k) => pct(th[k].between_share * 100, 1)), textposition: "inside", insidetextanchor: "start", textfont: { color: "#fff", size: 11 } },
    { x: tl.map((k) => th[k].within_share * 100), y: tl.map(lbl), name: "Within regions", type: "bar", orientation: "h", marker: { color: C.orange, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}: %{x:.1f}% within regions<extra></extra>",
      text: tl.map((k) => pct(th[k].within_share * 100, 1)), textposition: "inside", insidetextanchor: "end", textfont: { color: "#fff", size: 11 } },
  ], { barmode: "stack", showlegend: true, barcornerradius: 0, legend: { orientation: "h", x: 0, y: 1.12, traceorder: "normal" }, xaxis: { range: [0, 100], title: { text: "Share of total inequality (%)" } }, margin: { l: 150, r: 20, t: 30, b: 48 } });

  // F6 regional growth
  const gr = growth.slice().sort((a, b) => a.growth_pct - b.growth_pct);
  plot("so-f6", [{ x: gr.map((r) => r.growth_pct), y: gr.map((r) => r.region), type: "bar", orientation: "h", marker: { color: gr.map((r) => (r.region === "Greater Accra" ? C.ink3 : C.blue)) },
    text: gr.map((r) => fmt(r.growth_pct, 0)), textposition: "outside", cliponaxis: false, textfont: { size: 11, color: C.ink2 }, hovertemplate: "%{y}: %{x:,.0f}%<extra></extra>" }],
  { xaxis: { title: { text: "Growth in mean radiance, 2012–2024 (%)" }, rangemode: "tozero", tickformat: ",.0f" }, margin: { l: 110, r: 50, t: 16, b: 48 } });

  // F7 convergence scatter + fit
  const cv = S.districts.filter((d) => isNum(d.so_log_growth_2012_2024));
  const pv = new Map(S.panel.filter((p) => p.year === 2012).map((p) => [p.id, p.so_ntl_mean]));
  const xs = cv.map((d) => Math.log(pv.get(d.id))), ys = cv.map((d) => d.so_log_growth_2012_2024);
  const xm = mean(xs), ym = mean(ys), slope = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0) / xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  plot("so-f7", [
    { x: xs, y: ys, type: "scatter", mode: "markers", marker: { size: 8, color: C.blue, opacity: 0.75, line: { color: C.surface, width: 1 } },
      customdata: cv.map((d) => [d.name, d.region]), hovertemplate: "<b>%{customdata[0]}</b> (%{customdata[1]})<br>log radiance 2012: %{x:.2f}<br>log growth: %{y:.2f}<extra></extra>" },
    { x: [x0, x1], y: [ym + slope * (x0 - xm), ym + slope * (x1 - xm)], type: "scatter", mode: "lines", line: { color: C.ink, width: 2 }, hoverinfo: "skip" },
  ], { xaxis: { title: { text: "Log of mean radiance, 2012" } }, yaxis: { title: { text: "Log growth of mean radiance, 2012–2024" } },
    annotations: [{ x: x1, y: ym + slope * (x1 - xm), text: `slope ${fmt(slope, 2)}`, showarrow: false, xanchor: "right", yshift: 14, font: { color: C.ink, size: 12 } }] });

  // F8 correlations dot plot (2 series)
  const co = corr.slice().sort((a, b) => a.spearman - b.spearman);
  const lab = co.map((r) => r.indicator);
  plot("so-f8", [
    { x: co.map((r) => r.spearman), y: lab, name: "Spearman (rank)", type: "scatter", mode: "markers", marker: { size: 11, color: C.blue, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}<br>Spearman %{x:.2f}<extra></extra>" },
    { x: co.map((r) => r.pearson_log_ntl), y: lab, name: "Pearson (log radiance)", type: "scatter", mode: "markers", marker: { size: 9, color: C.orange, symbol: "diamond", line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}<br>Pearson %{x:.2f}<extra></extra>" },
  ], { showlegend: true, xaxis: { range: [-1, 1], dtick: 0.25, title: { text: "Correlation coefficient" }, zeroline: true, zerolinecolor: C.axis }, margin: { l: 200, r: 24, t: 30, b: 48 } });

  // F9 scatter explorer
  const drawF9 = () => {
    const ind = INDK[$("#so-f9-sel").value];
    const pts = S.districts.filter((d) => isNum(d[ind.key]) && isNum(d.so_ntl_mean_2021));
    const tr = (sub, on) => ({ x: sub.map((d) => d.so_ntl_mean_2021), y: sub.map((d) => d[ind.key]), name: on ? "Greater Accra" : "Other regions", type: "scatter", mode: "markers",
      marker: { size: 8, color: on ? C.blue : C.gray, opacity: on ? 0.95 : 0.8, line: { color: C.surface, width: 1 } }, customdata: sub.map((d) => [d.name, d.region]),
      hovertemplate: `<b>%{customdata[0]}</b> (%{customdata[1]})<br>radiance %{x:.2f}<br>${esc(ind.label)}: %{y:.${ind.d}f}<extra></extra>` });
    plot("so-f9", [tr(pts.filter((d) => d.region !== "Greater Accra"), false), tr(pts.filter((d) => d.region === "Greater Accra"), true)],
      { showlegend: true, xaxis: { type: "log", title: { text: "Mean radiance, 2021 (nW/cm²/sr, log scale)" } }, yaxis: { title: { text: ind.label } }, margin: { l: 64, r: 24, t: 30, b: 48 } });
  };
  drawF9();
  $("#so-f9-sel").addEventListener("change", drawF9);
}

/* ================================================================== ACCESS */
function renderAccess() {
  const A = S.access;
  if (!A) { $("#ac-figs").innerHTML = `<p class="muted">The electrification data have not been built yet.</p>`; return; }
  const h = A.headline, nat = A.national, v = A.validation;
  const reg = A.regions.slice().sort((a, b) => b.dark_share_2020 - a.dark_share_2020);
  const cc = h.class_counts, n12 = nat[0], n20 = nat[nat.length - 1];
  const popGrowth = (n20.pop_total - n12.pop_total) / 1e6;
  $("#ac-kpis").innerHTML = [
    kpi("People living in unlit areas, 2020", `${fmt(h.pop_dark_2020 / 1e6, 1)} million`, `${pct(h.dark_share_2020, 0)} of the population; ${fmt(h.range_2020[0] / 1e6, 1)}–${fmt(h.range_2020[1] / 1e6, 1)} million across light thresholds`),
    kpi("Change since 2012", `−${fmt((h.pop_dark_2012 - h.pop_dark_2020) / 1e6, 1)} million`, `from ${fmt(h.pop_dark_2012 / 1e6, 1)} million (${pct(h.dark_share_2012, 0)}) in 2012, while the population grew by ${fmt(popGrowth, 1)} million`),
    kpi("Newly lit land in existing settlements", pct(h.electrified_km2 / h.new_lit_km2 * 100, 0), `of ${fmt(h.new_lit_km2, 0)} km² newly lit between 2012/13 and 2024/25`),
    kpi("Agreement with the 2021 Census", fmt(v.spearman, 2), "rank correlation with district electricity access rates, 261 districts"),
  ].join("");
  const mapBtns = `<a class="btn" href="#map/dark/2020">Show areas in the dark</a> <a class="btn" href="#map/ac_dark_share_2020">Map the share by district</a>`;
  const top = S.districts.filter((d) => isNum(d.ac_pop_dark_2020)).sort((a, b) => b.ac_pop_dark_2020 - a.ac_pop_dark_2020).slice(0, 15);
  const regS = reg.slice(0, 3).map((r) => r.region);
  $("#ac-figs").innerHTML = [
    figure({ msg: `The number of people living where no light is detected fell from ${fmt(h.pop_dark_2012 / 1e6, 1)} million (${pct(h.dark_share_2012, 0)}) in 2012 to ${fmt(h.pop_dark_2020 / 1e6, 1)} million (${pct(h.dark_share_2020, 0)}) in 2020, even as the population grew by ${fmt(popGrowth, 1)} million.`,
      caption: "Figure 1: People living in unlit areas, 2012–2020", charts: [{ id: "ac-f1" }], tools: mapBtns,
      note: "WorldPop population (100 m, UN-adjusted) summed onto the night-light grid. A person counts as living in an unlit area when the annual radiance of their pixel (about 460 m) is below 0.5 nW/cm²/sr; the band shows the result for thresholds of 0.25 and 1.0. A proxy: low-consumption connections can be invisible from space. Population estimates end in 2020." }),
    figure({ msg: `The gap is regional: in ${regS.slice(0, -1).join(", ")} and ${regS.slice(-1)}, three-quarters or more of residents still lived where no light was detected in 2020, against ${pct(reg.find((r) => r.region === "Greater Accra").dark_share_2020, 0)} in Greater Accra. Every region improved.`,
      caption: "Figure 2: Share of the population living in unlit areas by region, 2012 and 2020", charts: [{ id: "ac-f2", cls: "tall" }],
      note: "Regions ordered by the 2020 share." }),
    figure({ msg: `Districts where more people live in unlit areas are the districts where the 2021 Census recorded lower electricity access (rank correlation ${fmt(v.spearman, 2)}). The satellite measure is a useful guide between censuses, not a replacement for the Census rate.`,
      caption: "Figure 3: Share living in unlit areas (2020) against household electricity access (2021 PHC), districts", charts: [{ id: "ac-f3" }],
      note: `${v.n} districts. The Census measure is the share of households with access to electricity, counting any connection, so it is higher than the share of people living in lit areas: nationally ${pct(v.national_lit_share_2020, 0)} lived in lit areas in 2020.` }),
    figure({ msg: `Light reached more people almost everywhere: ${cc.closing || 0} districts reduced the number of people in unlit areas, ${cc.pace || 0} reduced the share while their population grew, and ${cc.behind || 0} fell behind; ${cc.fully_lit || 0} were already fully lit.`,
      caption: "Figure 4: Districts by progress in reaching people with light, 2012–2020", charts: [{ id: "ac-f4", cls: "short" }],
      tools: `<a class="btn" href="#map/ac_class">Show on the map</a>`,
      note: "Closing the gap: the number of people in unlit areas fell. Keeping pace: the number rose but the share fell. Falling behind: the share rose. Fully lit: under 1 percent in unlit areas in both years." }),
    figure({ msg: `Almost all newly lit land (${pct(h.electrified_km2 / h.new_lit_km2 * 100, 0)}) was already inhabited in 2012: new light has mainly reached existing villages and towns rather than new settlements.`,
      caption: "Figure 5: Newly lit land by region, 2012/13 to 2024/25", charts: [{ id: "ac-f5", cls: "tall" }],
      note: "Newly lit: dark in both 2012 and 2013 and lit in both 2024 and 2025, so short-lived lights are ignored. Existing settlement: at least 5 people per pixel in 2012 (WorldPop)." }),
    tableFig({ caption: "Table 1: Districts with the most people living in unlit areas, 2020",
      head: ["District", "Region", "People in unlit areas, 2020", "Share 2020 (%)", "Share 2012 (%)", "Change (points)", "Progress"], numCols: [2, 3, 4, 5],
      rows: top.map((d) => [`<a href="#district/${d.id}">${esc(d.name)}</a>`, esc(d.region), fmt(d.ac_pop_dark_2020, 0), fmt(d.ac_dark_share_2020, 1), fmt(d.ac_dark_share_2012, 1), signed(d.ac_dark_change_pp, 1), esc(ACC[d.ac_class] ? ACC[d.ac_class].label.split(":")[0] : "")]),
      note: "Districts ranked by the number of people, which favours populous districts; the map explorer ranks them by share." }),
  ].join("");

  const yrs = nat.map((r) => r.year), M = (k) => nat.map((r) => r[k] / 1e6);
  plot("ac-f1", [
    { x: yrs, y: M("pop_dark_1"), type: "scatter", mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
    { x: yrs, y: M("pop_dark_0.25"), name: "Range for thresholds 0.25 to 1.0", type: "scatter", mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: themeName() === "dark" ? "rgba(79,134,232,0.18)" : "rgba(46,92,184,0.14)", hoverinfo: "skip" },
    { x: yrs, y: M("pop_dark_0.5"), name: "Threshold 0.5 nW/cm²/sr", type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2.5 }, marker: { size: 8 },
      customdata: nat.map((r) => [r["dark_share_0.5"] * 100, r["pop_dark_0.25"] / 1e6, r["pop_dark_1"] / 1e6]),
      hovertemplate: "%{x}: %{y:.2f} million (%{customdata[0]:.1f}%)<br>range %{customdata[1]:.2f}–%{customdata[2]:.2f} million<extra></extra>" },
  ], { showlegend: true, yaxis: { title: { text: "Million people" }, rangemode: "tozero" }, xaxis: { dtick: 1 }, margin: { l: 56, r: 24, t: 34, b: 40 } });

  const ord = reg.slice().reverse(), segX = [], segY = [];
  ord.forEach((r) => { segX.push(r.dark_share_2012, r.dark_share_2020, null); segY.push(r.region, r.region, null); });
  plot("ac-f2", [
    { x: segX, y: segY, type: "scatter", mode: "lines", line: { color: C.grayLine, width: 2 }, hoverinfo: "skip", showlegend: false },
    { x: ord.map((r) => r.dark_share_2012), y: ord.map((r) => r.region), name: "2012", type: "scatter", mode: "markers", marker: { size: 10, color: C.orange, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}, 2012: %{x:.1f}%<extra></extra>" },
    { x: ord.map((r) => r.dark_share_2020), y: ord.map((r) => r.region), name: "2020", type: "scatter", mode: "markers", marker: { size: 10, color: C.blue, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}, 2020: %{x:.1f}%<extra></extra>" },
  ], { showlegend: true, xaxis: { title: { text: "Share of the population living in unlit areas (%)" }, range: [0, 100] }, margin: { l: 110, r: 24, t: 30, b: 48 } });

  const pts = S.districts.filter((d) => isNum(d.ac_dark_share_2020) && isNum(d.so_electricity_pct));
  plot("ac-f3", [{ x: pts.map((d) => d.so_electricity_pct), y: pts.map((d) => d.ac_dark_share_2020), type: "scatter", mode: "markers",
    marker: { size: 8, color: C.blue, opacity: 0.75, line: { color: C.surface, width: 1 } }, customdata: pts.map((d) => [d.name, d.region]),
    hovertemplate: "<b>%{customdata[0]}</b> (%{customdata[1]})<br>households with electricity, 2021 PHC %{x:.1f}%<br>living in unlit areas %{y:.1f}%<extra></extra>" }],
  { xaxis: { title: { text: "Households with electricity access, 2021 PHC (%)" } }, yaxis: { title: { text: "Living in unlit areas, 2020 (%)" }, rangemode: "tozero" } });

  const ks = ["closing", "pace", "behind", "fully_lit"].reverse();
  plot("ac-f4", [{ x: ks.map((k) => cc[k] || 0), y: ks.map((k) => ACC[k].label.split(":")[0]), type: "bar", orientation: "h", marker: { color: C.blue },
    text: ks.map((k) => String(cc[k] || 0)), textposition: "outside", cliponaxis: false, textfont: { color: C.ink2 }, hovertemplate: "%{y}: %{x} districts<extra></extra>" }],
  { xaxis: { title: { text: "Number of districts" }, rangemode: "tozero" }, margin: { l: 130, r: 40, t: 10, b: 48 } });

  const r5 = A.regions.slice().sort((a, b) => (a.electrified_km2 + a.new_settlement_km2) - (b.electrified_km2 + b.new_settlement_km2));
  plot("ac-f5", [
    { x: r5.map((r) => r.electrified_km2), y: r5.map((r) => r.region), name: "Existing settlement (electrified)", type: "bar", orientation: "h", marker: { color: C.blue, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}: %{x:,.0f} km² in existing settlements<extra></extra>" },
    { x: r5.map((r) => r.new_settlement_km2), y: r5.map((r) => r.region), name: "New settlement", type: "bar", orientation: "h", marker: { color: C.orange, line: { color: C.surface, width: 2 } }, hovertemplate: "%{y}: %{x:,.0f} km² new settlement<extra></extra>" },
  ], { barmode: "stack", barcornerradius: 0, showlegend: true, legend: { orientation: "h", x: 0, y: 1.06, traceorder: "normal" }, xaxis: { title: { text: "Newly lit land (km²)" }, tickformat: ",.0f" }, margin: { l: 110, r: 24, t: 30, b: 48 } });
}

/* ================================================================== GDP */
function renderGdp() {
  const g = S.gdp, h = g.headline, rf = g.rolling_forecast, ser = g.series;
  $("#gdp-status").hidden = true;
  const qlab = (p) => p.replace("Q", " Q");
  const first = ser[0], last = ser[ser.length - 1];
  const exogNames = { mean_asi: "agricultural stress", d_mean_evi: "change in vegetation (EVI)", mean_vhi: "vegetation health",
    d_mean_ntl_dnb: "change in night-time lights", covid: "a COVID-19 dummy" };
  const exogText = h.sarimax_exog.map((e) => exogNames[e] || e);
  $("#gdp-kpis").innerHTML = [
    kpi("Average forecast error, 2024–2025", pct(h.rolling_mape_pct, 2), `one-quarter-ahead forecasts; root mean square error GHS ${fmt(h.rolling_rmse_ghs_m, 0)} million`),
    kpi("GDP forecast, 2026 Q1", `GHS ${fmt(h.forecast_2026q1_ghs_m, 0)} m`, `95% interval ${fmt(h.forecast_ci95_ghs_m[0], 0)} to ${fmt(h.forecast_ci95_ghs_m[1], 0)}; ${signed(h.forecast_qoq_pct, 2)}% on 2025 Q4`),
    kpi("Forecasting model", `SARIMAX${esc(h.sarimax_order).replace(/4$/, "<sub>4</sub>")}`, `selected by AIC from ${h.sarimax_candidates} candidates`),
    kpi("Quarters analysed", `${g.scope.n}`, `${qlab(first.period)} to ${qlab(last.period)}, GDP at constant prices`),
  ].join("");
  const sig = (p) => (p < 0.01 ? "***" : p < 0.05 ? "**" : p < 0.1 ? "*" : "");
  const worst = rf.reduce((a, b) => (b.error_pct > a.error_pct ? b : a));
  $("#gdp-figs").innerHTML = [
    figure({ msg: `Quarterly GDP rose from GHS ${fmt(first.gdp_millions, 0)} million in ${qlab(first.period)} to GHS ${fmt(last.gdp_millions, 0)} million in ${qlab(last.period)}, with a strong seasonal pattern, while average night-time radiance over Ghana rose about ${fmt(last.mean_ntl_dnb / first.mean_ntl_dnb, 1)}-fold.`,
      caption: `Figure 1: Quarterly GDP and night-time lights, ${qlab(first.period)} – ${qlab(last.period)}`,
      charts: [{ id: "gdp-f1a" }, { id: "gdp-f1b" }], panels: ["GDP, GHS million at constant prices", "Mean night-time radiance over Ghana, nW/cm²/sr"],
      note: `GDP: Ghana Statistical Service quarterly national accounts. Night-time lights: ${esc(g.scope.ntl_source)}. The 2026 Q1 point in panel (a) is the model forecast with its 95% interval.` }),
    figure({ msg: `One-quarter-ahead forecasts tracked actual GDP closely over 2024–2025, missing by ${pct(h.rolling_mape_pct, 2)} on average (largest miss ${pct(worst.error_pct, 2)} in ${qlab(worst.quarter)}); the model projects GHS ${fmt(h.forecast_2026q1_ghs_m, 0)} million for 2026 Q1, a seasonal fall of ${fmt(Math.abs(h.forecast_qoq_pct), 2)} percent.`,
      caption: "Figure 2: Quarterly GDP, actual and forecast, 2024 Q1 – 2026 Q1", charts: [{ id: "gdp-f2" }],
      note: `Each forecast comes from a model refitted on all quarters before it, using that quarter's satellite indicators: ${exogText.slice(0, -1).join(", ")} and ${exogText.slice(-1)}. The 2026 Q1 forecast carries the 2025 Q4 indicator values forward.` }),
    figure({ caption: "Figure 3: Forecast error by quarter, 2024 Q1 – 2025 Q4", charts: [{ id: "gdp-f3", cls: "short" }],
      note: "Absolute percentage difference between the one-quarter-ahead forecast and actual GDP." }),
    tableFig({ caption: `Table 1: Regression of log GDP on satellite indicators, ${qlab(first.period)} – ${qlab(last.period)}`,
      head: ["Variable", "Coefficient", "Standard error (HC3)", "z-statistic", "p-value", "Significance"], numCols: [1, 2, 3, 4],
      rows: g.ols.map((r) => [esc(r.variable), fmt(r.coef, 4), fmt(r.se_hc3, 4), fmt(r.z, 2), fmt(r.p, 3), sig(r.p)]),
      note: `${g.scope.n} quarterly observations; variables in levels, as in the report. Q2 to Q4 are seasonal dummies with Q1 as the base. R² ${fmt(h.ols_r2, 3)} (adjusted ${fmt(h.ols_adj_r2, 3)}). Series that trend upward together can appear closely related in levels, so the coefficients describe co-movement rather than effects. *** p<0.01, ** p<0.05, * p<0.10.` }),
    `<details class="more"><summary>Model diagnostics and selection</summary>
      ${tableFig({ caption: "Table 2: Diagnostic tests of the regression model", head: ["Test", "Statistic", "p-value"], numCols: [1, 2], rows: g.diagnostics.map((r) => [esc(r.test), fmt(r.stat, 3), isNum(r.p) ? fmt(r.p, 3) : "–"]) })}
      ${tableFig({ caption: "Table 3: Five best SARIMAX models by AIC", head: ["Model order", "AIC", "BIC"], numCols: [1, 2], rows: g.sarimax_top5.map((r) => [esc(r.order), fmt(r.aic, 2), fmt(r.bic, 2)]) })}
      ${tableFig({ caption: "Table 4: Augmented Dickey-Fuller stationarity tests", head: ["Variable", "ADF statistic", "p-value", "Result"], numCols: [1, 2], rows: g.adf.map((r) => [esc(r.variable), fmt(r.stat, 4), fmt(r.p, 3), esc(r.result)]) })}
      ${tableFig({ caption: "Table 5: Variance inflation factors", head: ["Variable", "VIF", "Decision"], numCols: [1], rows: g.vif.map((r) => [esc(r.variable), fmt(r.vif, 2), esc(r.decision)]) })}
      ${tableFig({ caption: `Table 6: Descriptive statistics, ${g.scope.n} quarters`, head: ["Variable", "Mean", "Standard deviation", "Minimum", "Median", "Maximum"], numCols: [1, 2, 3, 4, 5], rows: g.descriptives.map((r) => [esc(r.variable), fmt(r.mean, 4), fmt(r.sd, 4), fmt(r.min, 4), fmt(r.median, 4), fmt(r.max, 4)]) })}
    </details>`,
  ].join("");

  // Figure 1: two panels, one axis each (never a dual-axis chart)
  const sq = ser.map((r) => qlab(r.period));
  const fq = "2026 Q1", [lo, hi] = h.forecast_ci95_ghs_m, fc = h.forecast_2026q1_ghs_m;
  const tickv = sq.filter((p) => p.endsWith("Q1")), tickt = tickv.map((p) => p.slice(0, 4));
  plot("gdp-f1a", [
    { x: sq, y: ser.map((r) => r.gdp_millions), type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 5 }, hovertemplate: "%{x}: GHS %{y:,.0f} m<extra></extra>" },
    { x: [fq], y: [fc], type: "scatter", mode: "markers", marker: { size: 10, color: C.orange, symbol: "diamond-open", line: { width: 2.5 } },
      error_y: { type: "data", symmetric: false, array: [hi - fc], arrayminus: [fc - lo], color: C.orange, thickness: 1.5, width: 5 }, hovertemplate: `%{x} forecast: GHS %{y:,.0f} m<br>95% interval ${fmt(lo, 0)} – ${fmt(hi, 0)}<extra></extra>` },
  ], { yaxis: { tickformat: ",.0f", rangemode: "tozero" }, xaxis: { type: "category", tickvals: tickv, ticktext: tickt }, margin: { l: 64, r: 16, t: 12, b: 40 } });
  plot("gdp-f1b", [
    { x: sq, y: ser.map((r) => r.mean_ntl_dnb), type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 5 }, hovertemplate: "%{x}: %{y:.3f} nW/cm²/sr<extra></extra>" },
  ], { yaxis: { rangemode: "tozero" }, xaxis: { type: "category", tickvals: tickv, ticktext: tickt }, margin: { l: 56, r: 16, t: 12, b: 40 } });

  // Figure 2: rolling forecasts and the 2026 Q1 forecast
  const q = rf.map((r) => qlab(r.quarter));
  plot("gdp-f2", [
    { x: q, y: rf.map((r) => r.actual_ghs_m), name: "Actual GDP", type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 8 }, hovertemplate: "%{x}: GHS %{y:,.0f} m (actual)<extra></extra>" },
    { x: q, y: rf.map((r) => r.forecast_ghs_m), name: "One-quarter-ahead forecast", type: "scatter", mode: "markers", marker: { size: 9, color: C.orange, symbol: "diamond", line: { color: C.surface, width: 1.5 } }, hovertemplate: "%{x}: GHS %{y:,.0f} m (forecast)<extra></extra>" },
    { x: [fq], y: [fc], name: "2026 Q1 forecast (95% interval)", type: "scatter", mode: "markers", marker: { size: 11, color: C.orange, symbol: "diamond-open", line: { width: 2.5 } },
      error_y: { type: "data", symmetric: false, array: [hi - fc], arrayminus: [fc - lo], color: C.orange, thickness: 1.5, width: 6 }, hovertemplate: `%{x}: GHS %{y:,.0f} m<br>95% interval ${fmt(lo, 0)} – ${fmt(hi, 0)}<extra></extra>` },
  ], { showlegend: true, yaxis: { title: { text: "GDP (GHS million, constant prices)" }, tickformat: ",.0f" }, xaxis: { type: "category" }, margin: { l: 72, r: 24, t: 34, b: 48 } });
  plot("gdp-f3", [{ x: q, y: rf.map((r) => r.error_pct), type: "bar", marker: { color: C.blue }, text: rf.map((r) => fmt(r.error_pct, 2)), textposition: "outside", cliponaxis: false, textfont: { size: 11, color: C.ink2 }, hovertemplate: "%{x}: %{y:.2f}%<extra></extra>" }],
    { yaxis: { title: { text: "Absolute error (%)" }, rangemode: "tozero" }, xaxis: { type: "category" } });
}

/* ================================================================== DISTRICT */
function renderDistrict(arg) {
  const inp = $("#district-search"), selR = $("#district-region"), selD = $("#district-select");
  const inRegion = (r) => S.districts.filter((x) => x.region === r).sort((a, b) => a.name.localeCompare(b.name));
  const fillDistricts = (r) => { selD.innerHTML = inRegion(r).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join(""); };
  if (!inp.dataset.bound) {
    inp.dataset.bound = "1";
    inp.addEventListener("change", () => { const d = S.byName.get(inp.value.trim().toLowerCase()); if (d) location.hash = `district/${d.id}`; });
    const regions = [...new Set(S.districts.map((x) => x.region))].sort();
    selR.innerHTML = regions.map((r) => `<option value="${esc(r)}">${esc(r)} (${inRegion(r).length})</option>`).join("");
    // choosing a region lists its districts and opens the first one; choosing a district opens it
    selR.addEventListener("change", () => { fillDistricts(selR.value); location.hash = `district/${selD.value}`; });
    selD.addEventListener("change", () => { location.hash = `district/${selD.value}`; });
  }
  const id = Number(arg);
  const d = S.byId.get(id) || S.districts.find((x) => x.name === "Shai Osudoku");
  if (String(d.id) !== arg) { history.replaceState(null, "", `#district/${d.id}`); }
  inp.value = "";
  selR.value = d.region;
  fillDistricts(d.region);
  selD.value = String(d.id);
  const sig = `${d.id}|${themeName()}`;
  if (S.districtShown === sig && $("#district-body").childElementCount) {   // same profile: keep what is on screen
    if (S.miniMap) setTimeout(() => S.miniMap.invalidateSize(), 0);
    return;
  }
  S.districtShown = sig;
  const all = S.districts, reg = all.filter((x) => x.region === d.region);
  const rank = (k) => (isNum(d[k]) ? all.filter((x) => isNum(x[k]) && x[k] > d[k]).length + 1 : null);
  const nOf = (k) => all.filter((x) => isNum(x[k])).length;
  const rk = (k) => (rank(k) ? `rank ${rank(k)} of ${nOf(k)}` : "");
  const modeL = MODE[d.se_mode] ? MODE[d.se_mode].label : "–";
  const hotL = HOT[d.se_hotspot_level] ? HOT[d.se_hotspot_level].label : "–";

  const rows = IND.filter((i) => !i.cat).map((i) => [
    `<a href="#map/${i.key}">${esc(i.label)}</a>`, `<strong>${fmt(d[i.key], i.d)}</strong>`, fmt(mean(reg.map((x) => x[i.key])), i.d), fmt(median(all.map((x) => x[i.key])), i.d), rank(i.key) ? `${rank(i.key)} / ${nOf(i.key)}` : "–"]);

  $("#district-body").innerHTML = `
    <div class="d-title"><h1>${esc(d.name)}</h1><span class="chip">${esc(d.region)} Region</span></div>
    <div class="kpis">
      ${kpi("Lit area, 2012 → 2025", `${fmt(d.se_lit_2012_km2, 1)} → ${fmt(d.se_lit_2025_km2, 1)} km²`, `${pct(d.se_lit_share_2025, 0)} of the district lit in 2025`)}
      ${kpi("Growth of lit area", isNum(d.se_lit_cagr) ? `${fmt(d.se_lit_cagr, 1)}% a year` : "Newly lit", rk("se_lit_cagr"))}
      ${kpi("Mode of expansion", `<span style="font-size:1.05rem">${esc(modeL)}</span>`, `Urban hotspot: ${esc(hotL.toLowerCase())}`)}
      ${kpi("Mean radiance, 2021", `${fmt(d.so_ntl_mean_2021, 2)}`, `nW/cm²/sr; ${rk("so_ntl_mean_2021")}`)}
    </div>
    <div class="d-grid">
      <div>
        ${figure({ caption: `Figure 1: Lit area, ${d.name}, 2012–2025`, charts: [{ id: "d-f1", cls: "short" }], note: "Area with radiance of at least 1.0 nW/cm²/sr (spatial expansion study)." })}
        ${figure({ caption: `Figure 2: Mean radiance, ${d.name} and ${d.region} Region, 2012–2025`, charts: [{ id: "d-f2", cls: "short" }], note: "Mean radiance in nW/cm²/sr (socio-economic study panel). Regional line is the mean of the region's districts." })}
      </div>
      <div>
        <h2 class="caption">Location</h2>
        <div id="mini-map" class="mini-map" role="img" aria-label="Map showing the location of ${esc(d.name)}"></div>
        <p class="note">Highlighted: ${esc(d.name)}; outlined: other districts of ${esc(d.region)} Region.</p>
        <p><a class="btn" href="#map">Open the map explorer</a></p>
      </div>
    </div>
    ${tableFig({ caption: `Table 1: Indicators for ${d.name}, its region and Ghana`, head: ["Indicator", d.name, `${d.region} Region (mean)`, "Ghana (median district)", "Rank (1 = highest)"], numCols: [1, 2, 3, 4], rows,
      note: "Lit-area indicators from the spatial expansion study (2012–2025); other indicators from the socio-economic study (2021 unless stated). Regional value is the unweighted mean of its districts." })}`;

  const p = S.panel.filter((r) => r.id === d.id).sort((a, b) => a.year - b.year);
  plot("d-f1", [{ x: p.map((r) => r.year), y: p.map((r) => r.se_lit_area_km2), type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 7 }, hovertemplate: "%{x}: %{y:,.1f} km²<extra></extra>" }],
    { yaxis: { title: { text: "Lit area (km²)" }, rangemode: "tozero" }, xaxis: { dtick: 2, range: [2011.5, 2025.5] } });
  const regIds = new Set(reg.map((x) => x.id));
  const years = p.map((r) => r.year);
  const regMean = years.map((y) => mean(S.panel.filter((r) => r.year === y && regIds.has(r.id)).map((r) => r.so_ntl_mean)));
  plot("d-f2", [
    { x: years, y: p.map((r) => r.so_ntl_mean), name: d.name, type: "scatter", mode: "lines+markers", line: { color: C.blue, width: 2 }, marker: { size: 7 }, hovertemplate: `${esc(d.name)}, %{x}: %{y:.2f}<extra></extra>` },
    { x: years, y: regMean, name: `${d.region} Region (mean)`, type: "scatter", mode: "lines", line: { color: C.ink3, width: 2 }, hovertemplate: `${esc(d.region)}, %{x}: %{y:.2f}<extra></extra>` },
  ], { showlegend: true, yaxis: { title: { text: "Mean radiance" }, rangemode: "tozero" }, xaxis: { dtick: 2, range: [2011.5, 2025.5] }, margin: { l: 56, r: 24, t: 30, b: 40 } });

  // mini map
  if (S.miniMap) { S.miniMap.remove(); S.miniMap = null; }
  S.miniMap = L.map("mini-map", { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false });
  let target = null;
  S.miniMap.fitBounds(L.geoJSON(S.geo).getBounds(), { padding: [8, 8] });   // a view must exist before markers are added
  const lay = L.geoJSON(S.geo, {
    style: (f) => {
      const p2 = f.properties;
      if (p2.id === d.id) return { fillColor: C.mmTarget, color: C.mmTarget, weight: 1.5, fillOpacity: 1 };
      if (regIds.has(p2.id)) return { fillColor: C.mmRegion, color: C.mmRegionLine, weight: 0.8, fillOpacity: 1 };
      return { fillColor: C.mmOther, color: C.stroke, weight: 0.5, fillOpacity: 1 };
    },
    onEachFeature: (f, l) => { if (f.properties.id === d.id) target = l; },
  }).addTo(S.miniMap);
  // small districts vanish at country scale: mark the centre as well
  const marker = target ? L.circleMarker(target.getBounds().getCenter(), { radius: 7, color: C.surface, weight: 2, fillColor: C.mmTarget, fillOpacity: 1 }).addTo(S.miniMap) : null;
  const fit = () => { S.miniMap.invalidateSize(); S.miniMap.fitBounds(lay.getBounds(), { padding: [8, 8] }); if (target) target.bringToFront(); if (marker) marker.bringToFront(); };
  fit(); setTimeout(fit, 60);
  window.scrollTo(0, 0);
}

/* ================================================================== METHODS */
function renderMethods() {
  const m = S.meta;
  const desc = {
    "districts.geojson": "Simplified boundaries of the 261 districts (id, name, region).",
    "districts.csv": "One row per district with every district-level result. Columns starting se_ come from the spatial expansion study, so_ from the socio-economic study.",
    "district_panel.csv": "District by year, 2012–2025: lit area and mean radiance from both studies' night-time light extractions.",
    "regions.csv": "One row per region with the regional results of both district-level studies.",
    "spatial_expansion.json": "National lit-area series, inequality series, headline figures and rankings.",
    "socioeconomic.json": "National and regional radiance trends, inequality, convergence and correlations.",
    "gdp.json": "Quarterly GDP and night-light series, regression, forecasting model and forecasts of the economic activity study.",
  };
  const loadDict = () => get("data_dictionary.csv").then((rows) => {
    $("#dict-table").innerHTML = table(["File", "Column", "Description", "Unit", "Source"],
      rows.map((r) => [`<code>${esc(r.file)}</code>`, `<code>${esc(r.column)}</code>`, esc(r.description), esc(r.unit), esc(r.source)]));
  }).catch(() => { $("#dict-table").innerHTML = `<p class="muted">The data dictionary is not available.</p>`; });
  setTimeout(() => { const d = $("#dict-details"); if (d) d.addEventListener("toggle", () => { if (d.open && !d.dataset.loaded) { d.dataset.loaded = "1"; loadDict(); } }); }, 0);
  $("#methods-body").innerHTML = `<div class="methods">
    <p class="lede">This site presents three Ghana Statistical Service studies. Night-time light estimates are <strong>experimental statistics</strong>:
      they complement, and do not replace, official statistics from censuses, surveys and the national accounts.</p>

    <h2>Spatial expansion of settlements</h2>
    <ul>
      <li><strong>Data:</strong> VIIRS Day/Night Band annual composites from the Earth Observation Group (version 2.1 for 2012–2021, version 2.2 for 2022–2025), about 500 m resolution, summarised for the 261 districts with boundaries held constant.</li>
      <li><strong>Settlement:</strong> a pixel is lit, and counted as settled, when its radiance is at least 1.0 nW/cm²/sr. Lit area is the area of lit pixels in a district.</li>
      <li><strong>Growth:</strong> absolute change and compound annual growth of lit area, 2012–2025.</li>
      <li><strong>Mode of expansion:</strong> the change in a district's summed radiance is split into a lit-area component (new land lit) and an intensity component (lit land growing brighter).</li>
      <li><strong>Inequality:</strong> Theil T index of district lit area, decomposed into between-region and within-region parts.</li>
      <li><strong>Urban hotspots:</strong> Getis-Ord Gi* statistic with queen-contiguity neighbours, on 2025 radiance and on 2012–2025 change.</li>
    </ul>

    <h2>Night-time lights and socio-economic development</h2>
    <ul>
      <li><strong>Data:</strong> district mean radiance 2012–2025 from VIIRS annual composites, matched to 2021 Population and Housing Census indicators, the District rankings dataset, the Relative Wealth Index and regional income and life expectancy.</li>
      <li><strong>Correlation:</strong> Pearson correlation with the logarithm of mean radiance and Spearman rank correlation, 2021.</li>
      <li><strong>Disparities:</strong> inter-quartile range within regions; Theil T decomposition with each district weighted equally.</li>
      <li><strong>Convergence:</strong> log growth of mean radiance 2012–2024 regressed on log radiance in 2012; districts with no light in 2012 are excluded.</li>
      <li>The results shown here were recomputed from the study's data files and checked against the published report.</li>
    </ul>

    <h2>Night-time lights and economic activity</h2>
    <ul>
      <li><strong>Data:</strong> 48 quarters, 2014 Q1 – 2025 Q4: VIIRS Day/Night Band monthly night-time light composites (NOAA/EOG), MODIS vegetation indices (MOD13A3), FAO Agricultural Stress Index and Vegetation Health Index, Sentinel-5P nitrogen dioxide and CHIRPS precipitation, averaged over Ghana and over each quarter, with GSS quarterly GDP at constant prices.</li>
      <li><strong>Models:</strong> regression of log GDP on satellite indicators with seasonal dummies and robust (HC3) standard errors; SARIMAX forecasting model selected by AIC, evaluated by rolling one-quarter-ahead forecasts over 2024–2025.</li>
      <li>The results shown here were recomputed from the study's quarterly dataset and analysis code and checked against the published report.</li>
    </ul>

    <h2>Electrification and access</h2>
    <ul>
      <li><strong>Data:</strong> WorldPop population (100 m, UN-adjusted) for 2012–2020, summed onto the VIIRS night-light grid (about 460 m), with the yearly VIIRS composites and the GSS district boundaries. Prepared by the GSS Data Science Unit, adapting use cases 5 and 8 of the AfDB-DI4A night-lights workshop.</li>
      <li><strong>People living in unlit areas:</strong> people whose pixel has an annual radiance below 0.5 nW/cm²/sr, the detection threshold; results for 0.25 and 1.0 are shown as a range. No minimum population per pixel is applied, so thinly settled rural residents are counted.</li>
      <li><strong>Newly lit land:</strong> pixels dark in both 2012 and 2013 and lit in both 2024 and 2025. Existing settlement: at least 5 people per pixel in 2012.</li>
      <li><strong>Progress typology:</strong> districts are grouped by whether the number and the share of people in unlit areas fell between 2012 and 2020.</li>
      <li><strong>Validation:</strong> the district share living in unlit areas is compared with the 2021 Census electricity access rate.</li>
      <li>The measure is a proxy: low-consumption connections, indoor lighting and off-grid solar can be invisible from space, so it overstates lack of access compared with the Census.</li>
    </ul>

    <h2>Notes on the data</h2>
    <ul>
      <li>The two district-level studies summarised the same VIIRS imagery in separate processing runs. Their district radiance values agree closely (median difference below 0.001 nW/cm²/sr) but are not identical, so each chart states which study it draws on.</li>
      <li>Seven districts had no lit area in 2012, so their growth rate and mode of expansion cannot be computed; they are shown as newly lit.</li>
      <li>Four districts recorded no light at all in 2012 and are excluded from the convergence analysis.</li>
      <li>Offinso North could not be assigned neighbours in the hotspot analysis, so its hotspot class is shown as not significant without a test.</li>
      <li>Night-time light measures light, not people or income: bright industrial sites, mines and transport corridors can appear developed, and districts with low-consumption electricity connections can appear darker than their access rate suggests.</li>
    </ul>

    ${S.media ? `<h2>Images and animations</h2>
    <div class="media-grid">${["timelapse", "before_after", "cover"].filter((k) => S.media[k]).map((k) => `<figure><img src="${DATA}${esc(S.media[k].file)}" alt="${esc(S.media[k].alt)}" loading="lazy">
      <figcaption>${esc(S.media[k].title)} · <a href="${DATA}${esc(S.media[k].file)}" download>download</a></figcaption></figure>`).join("")}</div>
    <p class="muted">Free to reuse with the credit “Source: Ghana Statistical Service, from VIIRS night-time lights (Earth Observation Group, Colorado School of Mines)”.</p>` : ""}

    <h2>How to cite</h2>
    <p class="muted">Please cite the study you use, and this site for the interactive material and data files:</p>
    <ul class="cite-list">
      <li>Ghana Statistical Service (2026). <em>Spatial Expansion of Settlements in Ghana: Evidence from Satellite Nighttime Lights, 2012–2025</em>. Accra: GSS.</li>
      <li>Ghana Statistical Service (2026). <em>Night-time Lights as a Lens on Socio-economic Development in Ghana: A District-Level Analysis of Satellite Luminosity across 261 Districts</em>. Small Area Statistics, Geospatial Analytics Series. Accra: GSS.</li>
      <li>Ghana Statistical Service, Economic Analysis Division (2026). <em>Satellite-derived Nighttime Light and Economic Activity Analysis: Predicting Ghana's GDP Using Remote Sensing Indicators, 2014 Q1 – 2025 Q4</em>. Accra: GSS.</li>
      <li>Ghana Statistical Service, Data Science Unit (2026). <em>Night-time Lights and Development in Ghana</em> [web application and data], data built ${esc(m.built.slice(0, 10))}. Accra: GSS.</li>
    </ul>

    <h2>Download the data</h2>
    <ul class="downloads">${m.files.filter((f) => !["access.json", "access_districts.csv", "data_dictionary.csv"].includes(f)).map((f) => `<li><a href="${DATA}${esc(f)}" download><code>${esc(f)}</code></a>: ${esc(desc[f] || "")}</li>`).join("")}
      ${S.access ? `<li><a href="${DATA}access_districts.csv" download><code>access_districts.csv</code></a>: one row per district: people living in unlit areas (2012, 2020), change, progress class and newly lit land.</li>
      <li><a href="${DATA}access.json" download><code>access.json</code></a>: national series by light threshold, regional table, validation against the 2021 Census.</li>` : ""}
      <li><a href="${DATA}meta.json" download><code>meta.json</code></a>: sources, build date and notes.</li>
      <li><a href="${DATA}data_dictionary.csv" download><code>data_dictionary.csv</code></a>: the definition, unit and source of every column in the CSV files.</li></ul>
    <details class="more" id="dict-details"><summary>Data dictionary: what each column means</summary><div id="dict-table"><p class="muted">Loading…</p></div></details>

    <h2>Contact</h2>
    <p class="muted">Questions and feedback on this site: Data Science Unit, Ghana Statistical Service, <a href="https://statsghana.gov.gh" rel="noopener">statsghana.gov.gh</a>.</p>

    <h2>Credits</h2>
    <p class="muted">Ghana Statistical Service, Data Science Unit. Night-time light data: Earth Observation Group, Payne Institute, Colorado School of Mines (VIIRS annual and monthly composites). Vegetation: NASA MODIS; agricultural stress and vegetation health: FAO; nitrogen dioxide: Copernicus Sentinel-5P; rainfall: CHIRPS.
      The design of this site draws on the night-time lights workshop materials of the African Development Bank's Data Innovation for Africa (DI4A) programme.
      Built with Leaflet and Plotly. Data built ${esc(m.built.slice(0, 10))}.</p>
  </div>`;
}

boot();
