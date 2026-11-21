/* RUAS Faculty CV Screening Dashboard — runs fully in the browser */
"use strict";

const RC = window.RULES_CONFIG, REG = window.REGIMES;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r1 = n => n == null ? null : Math.round(n * 10) / 10;
const NOW = (() => { const d = new Date(); return d.getFullYear() + d.getMonth() / 12; })();

const state = { adFile: null, adText: "", adKeys: [], cvFiles: [], cands: [], filter: "", sel: null };

/* ==================== FILE READING ==================== */
async function readFile(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith(".txt")) return file.text();
  if (n.endsWith(".docx")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file("word/document.xml").async("string");
    return xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, " ").replace(/<w:br\/>/g, "\n").replace(/<\/w:tc>/g, " | ")
      .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }
  if (n.endsWith(".pdf")) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let t = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const c = await (await pdf.getPage(i)).getTextContent();
      t += c.items.map(it => it.str + (it.hasEOL ? "\n" : " ")).join("") + "\n";
    }
    return t;
  }
  throw new Error("unsupported file type");
}

/* ==================== EXTRACTION ==================== */
const RX = {
  bEngg: [/\bB\.?\s?E\b\.?/, /\bB\.?\s?Tech\b/i, /bachelor of (engineering|technology)/i],
  mEngg: [/\bM\.?\s?E\b\.?(?=[\s,(]|$)/, /\bM\.?\s?Tech\b/i, /master of (engineering|technology)/i, /\bM\.?\s?S\.?\s*(\(|in\s|by research)/],
  mca: [/\bM\.?\s?C\.?\s?A\b/, /master of computer applications?/i],
  mgmt: [/\bM\.?\s?B\.?\s?A\b/, /\bPGDM\b/, /\bM\.?\s?Com\b/i, /\bICWA\b|\bCMA\b/, /chartered accountant|\bC\.A\.\s/i, /master of (business administration|commerce)/i],
  mOther: [/\bM\.?\s?Sc\b/i, /\bM\.\s?A\.?\b/, /\bM\.?\s?Phil\b/i, /\bM\.?\s?Pharm\b/i, /master of (science|arts|philosophy)/i],
  bOther: [/\bB\.?\s?Sc\b/i, /\bB\.\s?A\.?\b/, /\bB\.?\s?Com\b/i, /\bBCA\b/, /\bB\.?\s?Pharm\b/i, /bachelor of/i],
};
const any = (arr, s) => arr.some(r => r.test(s));
const isMaster = s => any(RX.mEngg, s) || any(RX.mca, s) || any(RX.mgmt, s) || any(RX.mOther, s);
const isBachelor = s => any(RX.bEngg, s) || any(RX.bOther, s);
const isSchool = s => /\b(sslc|hsc|ssc|puc|pre-university|class\s*(x|xii|10|12)|10th|12th|higher secondary|matriculation)\b/i.test(s);

const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const RANGE = new RegExp(`(?:${MON}\\s*[,']?\\s*)?((?:19|20)\\d{2})\\s*(?:-|–|—|to|till|until)\\s*(?:${MON}\\s*[,']?\\s*)?((?:19|20)\\d{2}|present|till\\s*date|to\\s*date|date|current|now|ongoing)`, "gi");
const RANGE_NUM = /(\d{1,2})\/((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(?:(\d{1,2})\/((?:19|20)\d{2})|present|till\s*date|current|now)/gi;
const monIdx = m => m ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m.slice(0, 3).toLowerCase()) : -1;
const ROLE = /(professor|lecturer|faculty|teaching|instructor|scientist|research (associate|engineer|fellow|officer)|post[- ]?doc|engineer|developer|analyst|manager|consultant|executive|officer|designer|head|director|dean|principal|industry|pvt|ltd|limited|technologies|company|laborator)/i;
const TEACHRES = /(professor|lecturer|faculty|teaching|instructor|scientist|research (associate|engineer|fellow|officer)|post[- ]?doc|dean|principal|head of (the )?department|hod)/i;

function mergeLen(iv) {
  const s = iv.filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0]); let tot = 0, cs = null, ce = null;
  for (const [a, b] of s) { if (cs == null) { cs = a; ce = b; } else if (a <= ce) ce = Math.max(ce, b); else { tot += ce - cs; cs = a; ce = b; } }
  if (cs != null) tot += ce - cs; return tot;
}
function overlapAfter(iv, from) { return mergeLen(iv.map(([a, b]) => [Math.max(a, from), b])); }

function extract(text, fileName) {
  const lines = text.split(/\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const all = lines.join("\n");
  const f = { fileName, category: "General", notes: [] };

  // identity
  f.email = (all.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [""])[0];
  f.phone = (all.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/) || [""])[0];
  const nm = lines.slice(0, 8).find(l => /^[A-Za-z][A-Za-z.\s]{3,50}$/.test(l) && l.split(" ").length <= 6 && !/(curriculum|vitae|resume|profile|address|contact|objective)/i.test(l));
  f.name = nm || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

  // degrees and marks (degree line + following line)
  f.hasBachelorEngg = f.hasMasterEngg = f.hasMCA = f.hasMgmtMaster = f.hasMaster = f.hasBachelor = false;
  f.bachelorPct = f.masterPct = f.bachelorCGPA = f.masterCGPA = null; f.bachelorFC = f.masterFC = false;
  lines.forEach((l, i) => {
    if (isSchool(l)) return;
    const ctx = l + " " + (lines[i + 1] && !isMaster(lines[i + 1]) && !isBachelor(lines[i + 1]) ? lines[i + 1] : "");
    const degreeish = /\d|universit|college|institut/i.test(ctx);
    let lvl = null;
    if (isMaster(l) && degreeish) {
      lvl = "m"; f.hasMaster = true;
      if (any(RX.mEngg, l)) f.hasMasterEngg = true;
      if (any(RX.mca, l)) f.hasMCA = true;
      if (any(RX.mgmt, l)) f.hasMgmtMaster = true;
    } else if (isBachelor(l) && degreeish) {
      lvl = "b"; f.hasBachelor = true;
      if (any(RX.bEngg, l)) f.hasBachelorEngg = true;
    }
    if (!lvl) return;
    const pct = ctx.match(/(\d{2}(?:\.\d{1,2})?)\s*%/);
    const cg = ctx.match(/(?:cgpa|cpi|gpa|ogpa)\s*[:\-]?\s*(\d(?:\.\d{1,2})?)/i) || ctx.match(/\b(\d\.\d{1,2})\s*\/\s*10\b/);
    const fc = /first class|1st class|distinction/i.test(ctx);
    if (lvl === "m") { if (pct && f.masterPct == null) f.masterPct = +pct[1]; if (cg && f.masterCGPA == null) f.masterCGPA = +cg[1]; f.masterFC ||= fc; }
    else { if (pct && f.bachelorPct == null) f.bachelorPct = +pct[1]; if (cg && f.bachelorCGPA == null) f.bachelorCGPA = +cg[1]; f.bachelorFC ||= fc; }
  });

  // Ph.D.
  const phdLines = lines.filter(l => /\bph\.?\s?d\b|doctor of philosophy/i.test(l) && !/(guid|supervis|scholars?\s+(guided|under))/i.test(l));
  f.phdStatus = "none";
  if (phdLines.length) {
    const ctx = phdLines.join(" ");
    f.phdStatus = /(pursuing|ongoing|thesis submitted|registered|course ?work|in progress)/i.test(ctx) && !/(awarded|completed|conferred)/i.test(ctx) ? "pursuing" : "awarded";
    const yrs = (ctx.match(/(19|20)\d{2}/g) || []).map(Number).filter(y => y <= NOW);
    f.phdYear = yrs.length ? Math.max(...yrs) : null;
  } else f.phdYear = null;

  // NET / SET / SLET
  f.net = /\b(ugc|csir)[-\s]?net\b|\bnet\s*[-(]?\s*(qualified|cleared|passed|jrf)|\b(qualified|cleared|passed)\s*(the\s*)?(ugc\s*)?net\b|\bk-?set\b|\bslet\b|\bset\s*(qualified|cleared)|state (level )?eligibility test|national eligibility test|\bnet\b\s*\(\s*(june|dec)/i.test(all);

  // experience from date ranges on role lines (Ph.D./education periods are excluded)
  const iv = [], ivTR = [], ivAssoc = [];
  lines.forEach((l, i) => {
    const ctx = (lines[i - 1] || "") + " " + l;
    if (isMaster(l) || isBachelor(l) || isSchool(l) || /(ph\.?\s?d|research scholar|doctoral|student|intern(ship)?\b)/i.test(l)) return;
    if (!ROLE.test(ctx)) return;
    const roleLine = ROLE.test(l) ? l : (lines[i - 1] || "");
    const atAssoc = /associate professor/i.test(roleLine) || (/\bprofessor\b/i.test(roleLine) && !/assistant professor/i.test(roleLine));
    const push = (s, e) => { if (e > s && e - s < 50) { iv.push([s, e]); if (TEACHRES.test(roleLine)) ivTR.push([s, e]); if (atAssoc) ivAssoc.push([s, e]); } };
    let m; RANGE.lastIndex = 0;
    while ((m = RANGE.exec(l))) {
      const sm = monIdx(m[1]), sy = +m[2], em = monIdx(m[3]);
      const s = sy + (sm >= 0 ? sm / 12 : 0);
      const e = /^(19|20)\d{2}$/.test(m[4]) ? +m[4] + (em >= 0 ? (em + 1) / 12 : 0) : NOW;
      push(s, e);
    }
    RANGE_NUM.lastIndex = 0;
    while ((m = RANGE_NUM.exec(l))) push(+m[2] + (+m[1] - 1) / 12, m[4] ? +m[4] + (+m[3]) / 12 : NOW);
  });
  f.totalExp = iv.length ? r1(mergeLen(iv)) : null;
  f.teachResExp = ivTR.length ? r1(mergeLen(ivTR)) : (iv.length ? 0 : null);
  f.assocExp = ivAssoc.length ? r1(mergeLen(ivAssoc)) : (iv.length ? 0 : null);
  f.postPhdExp = f.phdStatus === "awarded" && f.phdYear && iv.length ? r1(overlapAfter(iv, f.phdYear + 0.5)) : (f.phdStatus === "awarded" ? null : 0);
  if (f.totalExp == null) {
    const m = all.match(/(\d{1,2}(?:\.\d)?)\+?\s*years?\s+(?:of\s+)?(?:[a-z]+\s+){0,3}experience/i);
    if (m) { f.totalExp = +m[1]; f.notes.push("Experience taken from a 'years of experience' statement — verify dates"); if (/teaching|academic/i.test(m[0])) f.teachResExp = +m[1]; }
  }

  // publications (journal papers)
  const HEAD = /^(list of\s+)?(selected\s+)?(research\s+)?(publications?|journal (papers|publications|articles)|papers published|research papers)\b/i;
  const NEXT = /^(education|academic|qualifications?|experience|work|professional|employment|teaching|projects?|awards?|achievements?|skills?|patents?|conferences?|conference|books?|book chapters?|personal|references?|declaration|research (guidance|supervision|projects)|ph\.?\s?d\.?\s*(guidance|supervision)|memberships?|certifications?|workshops?|fdps?|funded)\b/i;
  const JOURNAL = /(journal|transactions|letters|j\.\s|vol\.?\s*\d|volume|issn|doi|pp\.\s*\d|springer|elsevier|wiley|ieee access|scopus|sci\b|scie|web of science|ugc[- ]care|impact factor)/i;
  const CONF = /(conference|proceedings|symposium|workshop|\bconf\.)/i;
  let inPub = false, sectionFound = false, numbered = 0, journalish = 0;
  for (const l of lines) {
    if (l.length < 60 && HEAD.test(l)) { inPub = true; sectionFound = true; continue; }
    if (inPub && l.length < 60 && NEXT.test(l)) { inPub = false; continue; }
    if (!inPub) continue;
    const isEntry = /^(\[?\d{1,3}[\].)]|[•\-*▪●◦])\s*/.test(l);
    if (isEntry && !(CONF.test(l) && !/journal/i.test(l))) numbered++;
    if (JOURNAL.test(l) && !(CONF.test(l) && !/journal/i.test(l))) journalish++;
  }
  if (!sectionFound) journalish = lines.filter(l => /journal/i.test(l) && JOURNAL.test(l) && !CONF.test(l)).length;
  f.journalPubs = sectionFound ? Math.max(numbered, journalish) : (journalish || null);
  f.pubsFound = f.journalPubs != null;
  f.sciPubs = lines.filter(l => /(\bsci\b|scie|scopus|web of science)/i.test(l)).length;

  // Ph.D.s guided
  const g = all.match(/(\d{1,2})\s*(?:ph\.?\s?d\.?s?|doctoral)\s*(?:students|scholars|candidates|degrees|theses|thesis)?\s*(?:\(?awarded\)?|guided|supervised|produced|completed)/i)
    || all.match(/(?:guided|supervised|produced)\s*(\d{1,2})\s*(?:ph\.?\s?d|doctoral)/i)
    || all.match(/ph\.?\s?d\.?\s*(?:students|scholars)?\s*(?:guided|supervised|awarded)\s*[:\-]?\s*(\d{1,2})/i);
  f.phdGuided = g ? +g[1] : null;
  f.guidedFound = g != null;

  // research score (UGC Appendix II) if stated
  const rs = all.match(/research score\s*[:\-]?\s*(\d{1,3})/i);
  f.researchScore = rs ? +rs[1] : null;

  // profile info
  const SPECS = ["aerodynamics", "propulsion", "structures", "avionics", "robotics", "data science", "artificial intelligence", "machine learning", "deep learning", "vlsi", "embedded systems", "signal processing", "communication", "power systems", "power electronics", "thermal", "manufacturing", "cfd", "fea", "structural engineering", "geotechnical", "transportation", "environmental", "computer networks", "cyber security", "cloud computing", "iot", "image processing", "control systems", "materials", "nanotechnology", "biotechnology", "pharmaceutics", "finance", "marketing", "human resource", "operations", "economics", "mathematics", "physics", "chemistry"];
  const low = all.toLowerCase();
  f.specs = SPECS.filter(s => new RegExp(`\\b${s}\\b`).test(low)).map(s => s.replace(/\b\w/g, c => c.toUpperCase()));
  const u = all.match(/([A-Z][A-Za-z.&]*(?:\s+[A-Z][A-Za-z.&]*){0,5}\s+(?:University|Institute of (?:Technology|Science)))/);
  f.university = u ? u[1].trim() : "";
  const cur = lines.find(l => /(present|till date|to date|current)/i.test(l) && ROLE.test(l));
  f.current = cur ? cur.replace(RANGE, "").replace(/[|,–—-]+\s*$/, "").slice(0, 90) : "";

  // flags
  if (f.phdStatus === "pursuing") f.notes.push("Ph.D. appears to be in progress");
  if (!f.pubsFound) f.notes.push("No publication list detected");
  if (f.masterCGPA != null && f.masterPct == null) f.notes.push(`PG marks given as CGPA ${f.masterCGPA} — convert per university rule`);
  if (text.split(/\s+/).length < 80) f.notes.push("Very little text read — scanned PDF?");
  return f;
}

/* ==================== EVALUATION ==================== */
function facts(f) {
  const fcOf = (pct, cgpa, fc) => pct != null ? pct >= RC.firstClassPercent : cgpa != null ? cgpa >= RC.firstClassCGPA : fc ? true : null;
  const ug = fcOf(f.bachelorPct, f.bachelorCGPA, f.bachelorFC), pg = fcOf(f.masterPct, f.masterCGPA, f.masterFC);
  const present = [f.hasBachelor || f.hasBachelorEngg ? ug : undefined, f.hasMaster ? pg : undefined].filter(x => x !== undefined);
  const firstClass = present.some(x => x === true) ? true : present.length && present.every(x => x === false) ? false : null;
  const mark = (p, c, fc) => p != null ? p + "%" : c != null ? "CGPA " + c : fc ? "First class (stated)" : "";
  const relaxed = RC.relaxedCategories.includes(f.category);
  const degs = [f.hasBachelorEngg && "B.E./B.Tech.", f.hasMasterEngg && "M.E./M.Tech.", f.hasMCA && "MCA", f.hasMgmtMaster && "MBA/PGDM/M.Com.",
    f.hasMaster && !f.hasMasterEngg && !f.hasMCA && !f.hasMgmtMaster && "Master's (M.Sc./M.A. etc.)",
    !f.hasBachelorEngg && f.hasBachelor && "Bachelor's", f.phdStatus === "pursuing" && "Ph.D. (pursuing)", f.phdStatus === "awarded" && "Ph.D."].filter(Boolean);
  return {
    ...f, firstClass, masterFirstClass: pg,
    bachelorMark: mark(f.bachelorPct, f.bachelorCGPA, f.bachelorFC), masterMark: mark(f.masterPct, f.masterCGPA, f.masterFC),
    phdAwarded: f.phdStatus === "awarded", phdText: f.phdStatus === "awarded" ? `Ph.D.${f.phdYear ? " (" + f.phdYear + ")" : ""}` : f.phdStatus === "pursuing" ? "pursuing" : "not found",
    relaxed, ugcPct: relaxed ? RC.ugcRelaxedPercent : RC.ugcMasterPercent, degreeSummary: degs.join(", ") || "degrees not detected",
  };
}
function evaluate(f, regime, post) {
  const list = REG[regime].criteria[post](facts(f));
  const st = list.some(c => c.status === "fail") ? "fail" : list.some(c => c.status === "unknown") ? "unknown" : "pass";
  return { list, status: st };
}
function highest(f, regime) {
  for (const p of ["Professor", "Associate Professor", "Assistant Professor"]) {
    const s = evaluate(f, regime, p).status;
    if (s !== "fail") return { post: p, sure: s === "pass" };
  }
  return null;
}
const STATUS = { pass: ["Eligible", "ok", "✓"], unknown: ["Needs verification", "warn", "?"], fail: ["Not eligible", "bad", "✗"], info: ["Info", "info", "ℹ"] };

/* ==================== KEYWORD MATCH WITH ADVERTISEMENT ==================== */
const STOP = new Set("the and for with from that this have will shall must should are was were been being your our their about into which who whom candidates candidate applicants application apply post posts position professor assistant associate university ruas applied sciences ramaiah faculty department experience years year degree relevant equivalent minimum required requirements eligibility qualification qualifications norms regulations aicte ugc first class good knowledge ability skills also other such per level date last email recruitment selection interview pay scale salary".split(" "));
function keywords(text, n = 25) {
  const c = new Map();
  for (const w of (text.toLowerCase().match(/[a-z][a-z+#-]{3,}/g) || [])) if (!STOP.has(w)) c.set(w, (c.get(w) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
}
function keyMatch(cvText) {
  if (!state.adKeys.length) return null;
  const t = cvText.toLowerCase();
  const hit = state.adKeys.filter(k => t.includes(k));
  return { pct: Math.round(hit.length / state.adKeys.length * 100), hit, miss: state.adKeys.filter(k => !hit.includes(k)) };
}

/* ==================== RENDER ==================== */
const regime = () => $("selRegime").value, post = () => $("selPost").value;

function render() {
  if (!state.cands.length) { $("results").hidden = true; return; }
  $("results").hidden = false;
  state.cands.forEach(c => { c.ev = evaluate(c.f, regime(), post()); c.hi = highest(c.f, regime()); });
  const order = { pass: 0, unknown: 1, fail: 2 };
  state.cands.sort((a, b) => order[a.ev.status] - order[b.ev.status] || (b.km?.pct ?? 0) - (a.km?.pct ?? 0) || (b.f.journalPubs ?? 0) - (a.f.journalPubs ?? 0));
  const n = s => state.cands.filter(c => c.ev.status === s).length;

  $("kpis").innerHTML = `
    <div class="kpi"><b>${state.cands.length}</b><span>CVs screened</span></div>
    <div class="kpi ok"><b>${n("pass")}</b><span>✓ Eligible — ${esc(post())}</span></div>
    <div class="kpi warn"><b>${n("unknown")}</b><span>? Needs verification</span></div>
    <div class="kpi bad"><b>${n("fail")}</b><span>✗ Not eligible</span></div>`;
  $("ruleNote").innerHTML = `Rules: <b>${esc(REG[regime()].source)}</b> · ${esc(post())} · ${esc(RC.payLevels[post()])}`;

  const max = Math.max(1, ...["pass", "unknown", "fail"].map(n));
  $("chartStatus").innerHTML = ["pass", "unknown", "fail"].map(s => `
    <div class="bar-row" title="${STATUS[s][0]}: ${n(s)}"><span class="lbl">${STATUS[s][2]} ${STATUS[s][0]}</span>
      <div class="track"><div class="fill ${STATUS[s][1]}" style="width:${n(s) / max * 100}%"></div></div><span class="val">${n(s)}</span></div>`).join("");
  $("chartMatch").innerHTML = state.adKeys.length ? state.cands.slice(0, 15).map(c => `
    <div class="bar-row" title="${esc(c.f.name)}: ${c.km.pct}% of advertisement keywords"><span class="lbl">${esc(c.f.name)}</span>
      <div class="track"><div class="fill" style="width:${c.km.pct}%"></div></div><span class="val">${c.km.pct}%</span></div>`).join("")
    : `<p class="muted">Upload the advertisement to see how well each CV matches its keywords.</p>`;

  const list = state.cands.filter(c => !state.filter || c.ev.status === state.filter);
  $("tbl").querySelector("tbody").innerHTML = list.map(c => {
    const s = STATUS[c.ev.status], f = c.f;
    return `<tr data-i="${state.cands.indexOf(c)}">
      <td><b>${esc(f.name)}</b><div class="muted small">${esc(f.fileName)}</div></td>
      <td>${esc(facts(f).degreeSummary)}${f.net ? ' <span class="tag">NET/SET</span>' : ""}</td>
      <td class="c">${f.totalExp ?? "?"}</td><td class="c">${f.journalPubs ?? "?"}</td>
      <td><span class="pill ${s[1]}">${s[2]} ${s[0]}</span><div class="muted small">${c.ev.list.filter(x => x.status === "fail" || x.status === "unknown").slice(0, 2).map(x => esc(x.label.split("(")[0])).join("; ")}</div></td>
      <td>${c.hi ? `${esc(c.hi.post)}${c.hi.sure ? "" : " <span class='muted'>(verify)</span>"}` : "—"}</td>
      <td class="c">${c.km ? c.km.pct + "%" : "—"}</td>
      <td class="c">${f.notes.length ? `<span title="${esc(f.notes.join("; "))}">⚠ ${f.notes.length}</span>` : ""}</td>
    </tr>`;
  }).join("");
}

const FIELDS = [
  ["name", "Name", "text"], ["category", "Category (for UGC relaxation)", "cat"],
  ["hasBachelorEngg", "B.E./B.Tech.", "bool"], ["hasMasterEngg", "M.E./M.Tech./M.S.", "bool"], ["hasMCA", "MCA", "bool"], ["hasMgmtMaster", "MBA/PGDM/M.Com./CA", "bool"],
  ["hasBachelor", "Any Bachelor's", "bool"], ["hasMaster", "Any Master's", "bool"],
  ["bachelorPct", "UG marks %", "num"], ["bachelorCGPA", "UG CGPA", "num"], ["masterPct", "PG marks %", "num"], ["masterCGPA", "PG CGPA", "num"],
  ["phdStatus", "Ph.D. status", "phd"], ["phdYear", "Ph.D. year", "num"], ["net", "NET/SET/SLET qualified", "bool"],
  ["totalExp", "Total experience (teaching/research/industry), yrs", "num"], ["teachResExp", "Teaching/research experience, yrs", "num"],
  ["postPhdExp", "Post-Ph.D. experience, yrs", "num"], ["assocExp", "Years at Assoc. Prof. level or higher", "num"],
  ["journalPubs", "Journal publications", "num"], ["phdGuided", "Ph.D.s guided", "num"], ["researchScore", "UGC research score", "num"],
];
function renderDetail() {
  const c = state.cands[state.sel], f = c.f;
  $("dName").textContent = f.name;
  $("dMeta").innerHTML = [f.email, f.phone, f.university, f.current].filter(Boolean).map(esc).join(" · ");
  $("dPosts").innerHTML = RC.posts.map(p => {
    const e = evaluate(f, regime(), p), s = STATUS[e.status];
    return `<div class="postcol"><h4>${esc(p)} <span class="pill ${s[1]}">${s[2]} ${s[0]}</span></h4>
      <ul class="crit">${e.list.map(x => `<li class="${STATUS[x.status][1]}"><span>${STATUS[x.status][2]}</span><div>${esc(x.label)}${x.detail ? `<small>${esc(x.detail)}</small>` : ""}</div></li>`).join("")}</ul></div>`;
  }).join("");
  $("dFields").innerHTML = FIELDS.map(([k, label, t]) => {
    const v = f[k];
    const input = t === "bool" ? `<input type="checkbox" data-k="${k}" ${v ? "checked" : ""}/>`
      : t === "phd" ? `<select data-k="${k}">${["awarded", "pursuing", "none"].map(o => `<option ${v === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
      : t === "cat" ? `<select data-k="${k}">${["General", "EWS", ...RC.relaxedCategories].map(o => `<option ${v === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
      : `<input type="${t === "num" ? "number" : "text"}" step="any" data-k="${k}" value="${v ?? ""}" placeholder="${t === "num" ? "unknown" : ""}"/>`;
    return `<label class="${t === "bool" ? "chk" : ""}">${input}<span>${esc(label)}</span></label>`;
  }).join("");
  $("dNotes").innerHTML = f.notes.length ? f.notes.map(n => `<li>${esc(n)}</li>`).join("") : "<li>None</li>";
  $("dSpecs").textContent = f.specs.join(", ") || "—";
  $("dKeys").innerHTML = c.km ? `<b>${c.km.pct}%</b> of advertisement keywords · missing: ${c.km.miss.slice(0, 12).map(esc).join(", ") || "none"}` : "No advertisement uploaded";
  $("dText").textContent = c.text.slice(0, 6000);
}

/* ==================== EXPORT (.xlsx) ==================== */
function colName(i) { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
const xe = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
function sheetXml(rows) {
  const w = rows[0].map((_, c) => Math.min(60, Math.max(10, ...rows.map(r => String(r[c] ?? "").length + 2))));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x, i) => `<col min="${i + 1}" max="${i + 1}" width="${x}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
    const ref = colName(c) + (r + 1), st = r === 0 ? ' s="1"' : "";
    return typeof v === "number" ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
  }).join("")}</row>`).join("")}</sheetData></worksheet>`;
}
async function exportXlsx() {
  const head = ["Rank", "Name", "File", "Email", "Phone", "Category", "Degrees", "UG marks", "PG marks", "NET/SET/SLET", "Ph.D.", "Total exp (yrs)", "Teaching/research exp", "Post-PhD exp", "Assoc. Prof. yrs", "Journal pubs", "PhDs guided", "Research score",
    ...RC.posts.map(p => p + " — status"), "Highest eligible post", "Reasons / to verify (" + post() + ")", "Ad keyword match %", "Flags"];
  const rows = state.cands.map((c, i) => {
    const f = c.f, F = facts(f);
    return [i + 1, f.name, f.fileName, f.email, f.phone, f.category, F.degreeSummary, F.bachelorMark, F.masterMark, f.net ? "Yes" : "No", F.phdText,
      f.totalExp ?? "", f.teachResExp ?? "", f.postPhdExp ?? "", f.assocExp ?? "", f.journalPubs ?? "", f.phdGuided ?? "", f.researchScore ?? "",
      ...RC.posts.map(p => STATUS[evaluate(f, regime(), p).status][0]), c.hi ? c.hi.post + (c.hi.sure ? "" : " (verify)") : "None",
      c.ev.list.filter(x => x.status === "fail" || x.status === "unknown").map(x => STATUS[x.status][2] + " " + x.label + (x.detail ? " [" + x.detail + "]" : "")).join("; "),
      c.km ? c.km.pct : "", f.notes.join("; ")];
  });
  const sheets = [{ name: "Screening", rows: [head, ...rows] },
    { name: "Basis", rows: [["Item", "Value"], ["Rules applied", REG[regime()].source], ["Post screened", post()], ["Pay level", RC.payLevels[post()]], ["Generated", new Date().toLocaleString("en-IN")],
      ["Note", "Automated screening aid. Final eligibility must be verified by the scrutiny/selection committee against original documents."]] }];
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4B2A7B"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`);
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)));
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `RUAS_CV_Screening_${post().replace(/\s/g, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ==================== RULES TAB ==================== */
function renderRules() {
  const dummy = { phdStatus: "none", category: "General", notes: [], specs: [] };
  $("rulesBody").innerHTML = Object.entries(REG).map(([k, r]) => `
    <div class="card"><h3>${esc(r.name)}</h3><p class="muted">${esc(r.source)}</p>
      <div class="rulecols">${RC.posts.map(p => `<div><h4>${esc(p)}</h4><p class="muted small">${esc(RC.payLevels[p])}</p>
        <ul>${r.criteria[p](facts(dummy)).map(c => `<li>${esc(c.label)}</li>`).join("")}</ul></div>`).join("")}</div></div>`).join("");
}

/* ==================== WIRING ==================== */
function setStatus(m, err) { $("status").textContent = m; $("status").className = "status" + (err ? " err" : ""); }
function setupDrop(dropId, inputId, cb) {
  const d = $(dropId), inp = $(inputId);
  ["dragenter", "dragover"].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.add("over"); }));
  ["dragleave", "drop"].forEach(e => d.addEventListener(e, ev => { ev.preventDefault(); d.classList.remove("over"); }));
  d.addEventListener("drop", ev => cb([...ev.dataTransfer.files]));
  inp.addEventListener("change", () => { cb([...inp.files]); inp.value = ""; });
}
const okType = f => /\.(pdf|docx|txt)$/i.test(f.name);

async function analyse() {
  if (!state.cvFiles.length) return setStatus("Upload CVs first.", true);
  $("btnAnalyze").disabled = true;
  try {
    if (state.adFile) { setStatus("Reading advertisement…"); state.adText = await readFile(state.adFile); state.adKeys = keywords(state.adText); }
    else { state.adText = ""; state.adKeys = []; }
    state.cands = []; const failed = [];
    for (let i = 0; i < state.cvFiles.length; i++) {
      const file = state.cvFiles[i];
      setStatus(`Reading CV ${i + 1} of ${state.cvFiles.length}: ${file.name}`);
      try { const text = await readFile(file); state.cands.push({ f: extract(text, file.name), text, km: keyMatch(text) }); }
      catch (e) { failed.push(file.name); }
    }
    state.sel = null; render();
    setStatus(`Screened ${state.cands.length} CV(s).` + (failed.length ? ` Could not read: ${failed.join(", ")}` : ""), failed.length > 0);
    $("btnExport").disabled = false;
    $("results").scrollIntoView({ behavior: "smooth" });
  } finally { $("btnAnalyze").disabled = false; }
}

function init() {
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js";
  $("selRegime").innerHTML = Object.entries(REG).map(([k, r]) => `<option value="${k}">${esc(r.name)}</option>`).join("");
  $("selPost").innerHTML = RC.posts.map(p => `<option>${esc(p)}</option>`).join("");
  $("selRegime").onchange = $("selPost").onchange = () => render();

  setupDrop("adDrop", "adFile", fs => { const f = fs.find(okType); if (!f) return; state.adFile = f; $("adName").hidden = false; $("adName").textContent = "📄 " + f.name; });
  setupDrop("cvDrop", "cvFiles", fs => {
    const add = fs.filter(okType).filter(f => !state.cvFiles.some(x => x.name === f.name && x.size === f.size));
    state.cvFiles.push(...add);
    if (state.cvFiles.length > 60) { state.cvFiles = state.cvFiles.slice(0, 60); setStatus("Limited to 60 CVs per batch.", true); }
    $("cvCount").textContent = `${state.cvFiles.length} CV(s) selected`;
  });
  $("btnAnalyze").onclick = analyse;
  $("btnExport").onclick = exportXlsx;
  $("btnClear").onclick = () => { state.adFile = null; state.cvFiles = []; state.cands = []; $("adName").hidden = true; $("cvCount").textContent = ""; $("results").hidden = true; $("btnExport").disabled = true; setStatus(""); };

  $("filters").addEventListener("click", e => {
    const b = e.target.closest("button[data-f]"); if (!b) return;
    state.filter = b.dataset.f; document.querySelectorAll("#filters button").forEach(x => x.classList.toggle("on", x === b)); render();
  });
  $("tbl").addEventListener("click", e => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; state.sel = +tr.dataset.i; renderDetail(); $("dlg").showModal(); });
  $("dFields").addEventListener("input", e => {
    const el = e.target.closest("[data-k]"); if (!el) return;
    const f = state.cands[state.sel].f, k = el.dataset.k;
    f[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? null : +el.value) : el.value;
    if (k === "journalPubs") f.pubsFound = f.journalPubs != null;
    if (k === "phdGuided") f.guidedFound = f.phdGuided != null;
    const cands = state.cands, cur = cands[state.sel];
    render(); state.sel = cands.indexOf(cur);
    renderDetail(); const again = $("dFields").querySelector(`[data-k="${k}"]`); if (again && el.type !== "checkbox") { again.focus(); try { again.setSelectionRange?.(again.value.length, again.value.length); } catch {} }
  });
  $("btnClose").onclick = () => $("dlg").close();
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
    document.querySelectorAll(".pane").forEach(p => (p.hidden = p.id !== "pane-" + t.dataset.tab));
  });
  renderRules();
}
document.addEventListener("DOMContentLoaded", init);
