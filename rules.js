/* ============================================================
 *  ELIGIBILITY RULES — faculty recruitment
 *  Sources (verify against the latest gazette before each recruitment):
 *   • UGC (Minimum Qualifications for Appointment of Teachers…) Regulations, 18 July 2018,
 *     with the 2nd Amendment 2023 (NET/SET/SLET minimum for Assistant Professor; PhD optional, from 1 July 2023).
 *   • AICTE Regulations on Pay Scales, Service Conditions and Minimum Qualifications…, 1 March 2019
 *     (Engineering & Technology, MCA, Management).
 *   • Pay levels: 7th CPC pay revision for university/college teachers (MHRD, now Ministry of Education),
 *     as adopted in UGC 2018 / AICTE 2019.
 *  Note: draft UGC Regulations 2025 were released for consultation in Jan 2025; update this file if they are notified.
 * ============================================================ */
window.RULES_CONFIG = {
  firstClassPercent: 60,     // "First class or equivalent"
  firstClassCGPA: 6.5,       // CGPA treated as first class (on a 10-point scale) — check your university's conversion
  ugcMasterPercent: 55,      // UGC: Master's with 55%
  ugcRelaxedPercent: 50,     // UGC: 50% for SC/ST/OBC (non-creamy layer)/PwD
  relaxedCategories: ["SC", "ST", "OBC-NCL", "PwD"],
  posts: ["Assistant Professor", "Associate Professor", "Professor"],
  payLevels: {
    "Assistant Professor": "Academic Level 10 (entry ₹57,700)",
    "Associate Professor": "Academic Level 13A (entry ₹1,31,400)",
    "Professor": "Academic Level 14 (entry ₹1,44,200)",
  },
};

window.REGIMES = {
  /* ---------------------------------------------------------------- */
  "AICTE-ET": {
    name: "Engineering & Technology (AICTE 2019)",
    source: "AICTE Regulations, 1 March 2019 — Engineering & Technology",
    criteria: {
      "Assistant Professor": f => [
        crit("B.E./B.Tech. degree", f.hasBachelorEngg),
        crit("M.E./M.Tech./M.S. (or integrated M.Tech.) in relevant branch", f.hasMasterEngg),
        crit("First class or equivalent in B.E./B.Tech. or M.E./M.Tech.", f.firstClass, firstClassDetail(f)),
        note("Experience not mandatory"),
      ],
      "Associate Professor": f => [
        crit("Ph.D. in relevant field (awarded)", f.phdAwarded, f.phdText),
        crit("First class or equivalent at Bachelor's or Master's level", f.firstClass, firstClassDetail(f)),
        num("≥ 8 years teaching / research / industry experience", f.totalExp, 8, "yrs"),
        num("≥ 2 years post-Ph.D. experience", f.postPhdExp, 2, "yrs"),
        num("≥ 6 research publications (SCI/SCIE/UGC/AICTE-approved journals)", f.journalPubs, 6, "papers", f.pubsFound),
      ],
      "Professor": f => [
        crit("Ph.D. in relevant field (awarded)", f.phdAwarded, f.phdText),
        crit("First class or equivalent at Bachelor's or Master's level", f.firstClass, firstClassDetail(f)),
        num("≥ 10 years teaching / research / industry experience", f.totalExp, 10, "yrs"),
        num("≥ 3 years at a post equivalent to Associate Professor", f.assocExp, 3, "yrs (Assoc. Prof. or higher posts — verify)"),
        anyOf("Publications & guidance: (≥ 6 papers at Assoc. Prof. level AND ≥ 2 Ph.D.s guided) OR ≥ 10 papers at Assoc. Prof. level", [
          both(num("", f.journalPubs, 6, "", f.pubsFound), num("", f.phdGuided, 2, "", f.guidedFound)),
          num("", f.journalPubs, 10, "", f.pubsFound),
        ], `${val(f.journalPubs, f.pubsFound)} papers, ${val(f.phdGuided, f.guidedFound)} Ph.D.s guided — verify they fall in the Assoc. Prof. period`),
      ],
    },
  },
  /* ---------------------------------------------------------------- */
  "AICTE-MCA": {
    name: "Computer Applications / MCA (AICTE 2019)",
    source: "AICTE Regulations, 1 March 2019 — MCA",
    criteria: {
      "Assistant Professor": f => [
        anyOf("Qualification: (B.E./B.Tech. + M.E./M.Tech.) OR (B.E./B.Tech. + MCA) with first class in either, OR MCA first class + 2 years relevant experience", [
          both(crit("", f.hasBachelorEngg), crit("", f.hasMasterEngg || f.hasMCA), crit("", f.firstClass)),
          both(crit("", f.hasMCA), crit("", f.firstClass), num("", f.totalExp, 2)),
        ], `${f.degreeSummary}; ${firstClassDetail(f)}; ${val(f.totalExp)} yrs experience`),
      ],
      "Associate Professor": f => window.REGIMES["AICTE-ET"].criteria["Associate Professor"](f),
      "Professor": f => window.REGIMES["AICTE-ET"].criteria["Professor"](f),
    },
  },
  /* ---------------------------------------------------------------- */
  "AICTE-MGMT": {
    name: "Management (AICTE 2019)",
    source: "AICTE Regulations, 1 March 2019 — Management",
    criteria: {
      "Assistant Professor": f => [
        crit("Bachelor's degree", f.hasBachelor),
        crit("Master's in Business Administration / PGDM / C.A. / ICWA / M.Com.", f.hasMgmtMaster),
        crit("First class or equivalent in the Master's degree", f.masterFirstClass, firstClassDetail(f)),
        num("≥ 2 years professional experience after the Master's degree", f.totalExp, 2, "yrs"),
      ],
      "Associate Professor": f => window.REGIMES["AICTE-ET"].criteria["Associate Professor"](f),
      "Professor": f => window.REGIMES["AICTE-ET"].criteria["Professor"](f),
    },
  },
  /* ---------------------------------------------------------------- */
  "UGC": {
    name: "Sciences, Humanities, Commerce & others (UGC 2018)",
    source: "UGC Regulations, 18 July 2018 (with 2nd Amendment 2023)",
    criteria: {
      "Assistant Professor": f => [
        num(`Master's degree with ≥ ${f.ugcPct}% marks${f.relaxed ? " (relaxed for " + f.category + ")" : ""}`, f.masterPct, f.ugcPct, "%", f.masterPct != null),
        anyOf("NET / SET / SLET qualified, OR Ph.D. (exempt from NET/SET/SLET)", [crit("", f.net), crit("", f.phdAwarded)],
          `NET/SET/SLET: ${f.net ? "found" : "not found"}; Ph.D.: ${f.phdAwarded ? "yes" : "no"}`),
      ],
      "Associate Professor": f => [
        crit("Ph.D. in the concerned / allied subject (awarded)", f.phdAwarded, f.phdText),
        num(`Master's degree with ≥ ${f.ugcPct}% marks`, f.masterPct, f.ugcPct, "%", f.masterPct != null),
        num("≥ 8 years teaching / research at Assistant Professor (or equivalent) level", f.teachResExp, 8, "yrs"),
        num("≥ 7 publications in peer-reviewed or UGC-listed journals", f.journalPubs, 7, "papers", f.pubsFound),
        num("Research score ≥ 75 (Appendix II, Table 2)", f.researchScore, 75, "", f.researchScore != null),
      ],
      "Professor": f => [
        crit("Ph.D. in the concerned / allied subject (awarded)", f.phdAwarded, f.phdText),
        num("≥ 10 publications in peer-reviewed or UGC-listed journals", f.journalPubs, 10, "papers", f.pubsFound),
        num("Research score ≥ 120 (Appendix II, Table 2)", f.researchScore, 120, "", f.researchScore != null),
        num("≥ 10 years teaching / research experience (Asst./Assoc./Prof. level)", f.teachResExp, 10, "yrs"),
        num("Evidence of having guided doctoral candidates", f.phdGuided, 1, "Ph.D.s", f.guidedFound),
      ],
    },
  },
};

/* ---------- criterion helpers: status = pass | fail | unknown ---------- */
function val(v, known = true) { return v == null || !known ? "?" : (Math.round(v * 10) / 10); }
function crit(label, ok, detail) { return { label, status: ok == null ? "unknown" : ok ? "pass" : "fail", detail: detail || "" }; }
function num(label, v, min, unit = "", known = true) {
  if (v == null || !known) return { label, status: "unknown", detail: "not found in CV — verify" };
  return { label, status: v >= min ? "pass" : "fail", detail: `${val(v)}${unit ? " " + unit : ""}` };
}
function both(...cs) { const s = cs.some(c => c.status === "fail") ? "fail" : cs.some(c => c.status === "unknown") ? "unknown" : "pass"; return { status: s }; }
function anyOf(label, options, detail) {
  const s = options.some(o => o.status === "pass") ? "pass" : options.some(o => o.status === "unknown") ? "unknown" : "fail";
  return { label, status: s, detail: detail || "" };
}
function note(label) { return { label, status: "info", detail: "" }; }
function firstClassDetail(f) {
  const parts = [];
  if (f.bachelorMark) parts.push("UG: " + f.bachelorMark);
  if (f.masterMark) parts.push("PG: " + f.masterMark);
  return parts.join(" · ") || "marks not found — verify";
}
