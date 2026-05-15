const API_BASE = "http://localhost:8001";
const SESSION_ID = "demo-" + Math.random().toString(36).slice(2, 8);

let isListening = false;
let recognition = null;
let currentDraft = null;
let selectedContractId = null;
let selectedNegotiationId = null;
let selectedEsigId = null;
let expandedClauseId = null;
let selectedObligationId = null;
let selectedPricingContractId = null;
let clauseCategory = "All";

// ─── Synthetic data ───────────────────────────────────────────────────────────

const CONTRACTS = [
  { id: "CTR-001", provider: "Auckland Surgical Centre",    city: "Auckland",      procedure: "Total Knee Replacement", model: "TIERED",    rateRange: "$3,600–$4,200", cap: 150, status: "EXPIRING", expiry: "2026-07-31", ytd: 94,  networkTier: "preferred",
    tiers: [{from:1,to:50,rate:4200},{from:51,to:100,rate:3900},{from:101,to:null,rate:3600}] },
  { id: "CTR-002", provider: "Wellington Orthopaedics",     city: "Wellington",    procedure: "Total Knee Replacement", model: "FFS",       rateRange: "$4,050",        cap: 80,  status: "ACTIVE",   expiry: "2026-08-31", ytd: 61,  networkTier: "preferred",
    rate: 4050 },
  { id: "CTR-003", provider: "Christchurch Surgical Centre",city: "Christchurch",  procedure: "Knee Arthroscopy",       model: "FFS",       rateRange: "$2,800",        cap: 100, status: "ACTIVE",   expiry: "2026-09-30", ytd: 43,  networkTier: "preferred",
    rate: 2800 },
  { id: "CTR-004", provider: "Auckland Surgical Centre",    city: "Auckland",      procedure: "Knee Arthroscopy",       model: "TIERED",    rateRange: "$2,400–$2,900", cap: 200, status: "ACTIVE",   expiry: "2026-12-31", ytd: 112, networkTier: "preferred",
    tiers: [{from:1,to:75,rate:2900},{from:76,to:150,rate:2600},{from:151,to:null,rate:2400}] },
  { id: "CTR-005", provider: "Wellington Regional Hospital",city: "Wellington",    procedure: "Total Knee Replacement", model: "MATRIX",    rateRange: "$2,800–$5,000", cap: 120, status: "ACTIVE",   expiry: "2027-06-30", ytd: 38,  networkTier: "preferred",
    matrix: {"A:high":5000,"A:low":3500,"B:high":4200,"B:low":2800} },
  { id: "CTR-006", provider: "Auckland Surgical Centre",    city: "Auckland",      procedure: "Total Hip Replacement",  model: "STAIRCASE", rateRange: "$4,900–$5,800", cap: 120, status: "ACTIVE",   expiry: "2027-06-30", ytd: 107, networkTier: "preferred",
    threshold: 100, rateBefore: 5800, rateAfter: 4900 },
];

const APPROVALS = [
  {
    id: "APP-001", contractId: "CTR-DRAFT-CHC-001", type: "New Contract",
    provider: "Christchurch Surgical Centre", procedure: "Total Knee Replacement",
    model: "TIERED", annualValue: 479400, submittedBy: "AI Studio (Sarah Mitchell)",
    submittedAt: "11 May 2026, 09:23",
    approvers: ["Contracting Manager", "CFO"], currentStep: 0, status: "PENDING",
    summary: "Tiered pricing — $3,990 / $3,705 / $3,420 · Cap: 120 · Term: 1 Jul 2026 – 30 Jun 2027",
  },
  {
    id: "APP-002", contractId: "AMD-CTR-001-001", type: "Amendment",
    provider: "Auckland Surgical Centre", procedure: "Total Knee Replacement",
    model: "TIERED", annualValue: 430620, submittedBy: "AI Studio (Sarah Mitchell)",
    submittedAt: "11 May 2026, 10:45",
    approvers: ["Contracting Manager"], currentStep: 0, status: "PENDING",
    summary: "5% tier reduction across all bands · Effective: 25 May 2026 · Annual saving: ~$22,600",
  },
];

const ACTIVITY = [
  { text: "Amendment drafted — CTR-001 Auckland Surgical (−5% tier reduction, annual saving $22,600)", time: "10:45", dot: "blue" },
  { text: "Utilization checked — Auckland Surgical Centre (3 contracts, 1 alert at 89.2%)", time: "10:12", dot: "blue" },
  { text: "New contract drafted — CTR-DRAFT-CHC-001 Christchurch Surgical Centre (knee replacement, tiered)", time: "09:23", dot: "blue" },
  { text: "Provider validated — CHC-SURGICAL-001 HPI Active, expires 31 Dec 2026", time: "09:22", dot: "green" },
  { text: "Pricing evaluated — AKL-SURGICAL-001 · NZACS-14711 · Tier 1 → $4,200 NZD", time: "09:21", dot: "green" },
];

const CLAUSES = [
  { id: "CL-001", category: "Indemnity", title: "Standard Indemnity — Bilateral", status: "approved", version: "v3.2", lastReviewed: "Feb 2026", tags: ["indemnity", "risk", "bilateral"],
    body: "Each party (\"Indemnifying Party\") shall indemnify, defend and hold harmless the other party and its officers, directors, employees and agents from and against any and all claims, damages, losses, costs and expenses (including reasonable legal fees) arising out of or resulting from the Indemnifying Party's breach of this Agreement or negligent acts or omissions in connection with the performance of its obligations hereunder." },
  { id: "CL-002", category: "Termination", title: "Termination for Convenience — 90 Days", status: "approved", version: "v2.1", lastReviewed: "Jan 2026", tags: ["termination", "notice", "90-day"],
    body: "Either party may terminate this Agreement without cause upon ninety (90) days' written notice to the other party. In the event of termination, the Health Insurer shall pay the Provider for all Services properly rendered prior to the effective date of termination in accordance with the rates set out in Schedule 1." },
  { id: "CL-003", category: "Confidentiality", title: "Patient Data — NZ Privacy Act 2020", status: "approved", version: "v4.0", lastReviewed: "Mar 2026", tags: ["privacy", "data", "compliance", "NZ"],
    body: "The Provider shall maintain the confidentiality of all patient health information in accordance with the New Zealand Privacy Act 2020 and the Health Information Privacy Code 2020. Patient data shall not be disclosed to any third party without prior written consent from the Health Insurer, except as required by law or for the direct provision of health services to the patient." },
  { id: "CL-004", category: "Performance", title: "Wait Time SLA — Elective Procedures", status: "approved", version: "v1.8", lastReviewed: "Feb 2026", tags: ["SLA", "wait-time", "elective"],
    body: "The Provider shall ensure that patients referred for elective procedures are offered a first specialist assessment appointment within 60 calendar days of referral acceptance. The Provider shall report monthly on compliance with this standard using the agreed reporting template submitted within 10 business days of month end." },
  { id: "CL-005", category: "Dispute Resolution", title: "Dispute Resolution — Mediation First", status: "approved", version: "v2.0", lastReviewed: "Dec 2025", tags: ["dispute", "mediation", "arbitration"],
    body: "Any dispute arising under this Agreement shall first be referred to good-faith mediation between the parties' senior representatives within 15 business days of written notice of dispute. If mediation does not resolve the dispute within 30 days, either party may refer the matter to arbitration under the Arbitration Act 1996 (NZ)." },
  { id: "CL-006", category: "Indemnity", title: "Clinical Negligence Exclusion", status: "under-review", version: "v1.0", lastReviewed: "Apr 2026", tags: ["indemnity", "clinical", "exclusion"],
    body: "Nothing in this Agreement shall be construed to require the Health Insurer to indemnify the Provider against claims arising from the Provider's own clinical negligence, errors or omissions. The Provider shall maintain appropriate professional indemnity insurance of no less than $5,000,000 NZD per claim at all times during the Term." },
  { id: "CL-007", category: "Pricing", title: "Rate Adjustment — CPI Indexation", status: "approved", version: "v2.3", lastReviewed: "Jan 2026", tags: ["pricing", "CPI", "indexation"],
    body: "Contract rates shall be subject to annual review on the anniversary of the Commencement Date. The Health Insurer may adjust rates by up to the CPI movement for the preceding 12 months as published by Statistics New Zealand, without requiring formal contract amendment. Adjustments shall take effect 30 days after written notification." },
  { id: "CL-008", category: "Reporting", title: "Monthly Claims Reporting Obligation", status: "approved", version: "v3.1", lastReviewed: "Mar 2026", tags: ["reporting", "claims", "monthly"],
    body: "The Provider shall submit a monthly claims report to the Health Insurer within 10 business days of the end of each calendar month. Reports shall be submitted in the agreed electronic format compatible with the IQVIA TMB claims platform and shall include procedure codes, dates of service, NHI numbers, provider identifiers, and total charges billed." },
];

const ESIG_DOCS = [
  { id: "ESIG-001", contractId: "CTR-DRAFT-CHC-001", provider: "Christchurch Surgical Centre", type: "New Contract", procedure: "Total Knee Replacement",
    status: "awaiting-provider", sentAt: "12 May 2026, 14:30",
    signers: [{name:"Sarah Mitchell", role:"Contract Manager, Health Insurer", signed: true, signedAt:"12 May 2026, 14:31"}, {name:"Dr. James Chen", role:"Medical Director, Christchurch Surgical", signed: false}] },
  { id: "ESIG-002", contractId: "AMD-CTR-001-001", provider: "Auckland Surgical Centre", type: "Amendment", procedure: "Total Knee Replacement",
    status: "awaiting-insurer", sentAt: "11 May 2026, 16:00",
    signers: [{name:"Michael Thompson", role:"CEO, Auckland Surgical Centre", signed: true, signedAt:"12 May 2026, 09:15"}, {name:"Sarah Mitchell", role:"Contract Manager, Health Insurer", signed: false}] },
  { id: "ESIG-003", contractId: "CTR-004", provider: "Auckland Surgical Centre", type: "Renewal", procedure: "Knee Arthroscopy",
    status: "completed", sentAt: "28 Apr 2026, 11:00", completedAt: "30 Apr 2026, 15:22",
    signers: [{name:"James Okonkwo", role:"Contracting Manager, Health Insurer", signed: true, signedAt:"29 Apr 2026, 10:00"}, {name:"Michael Thompson", role:"CEO, Auckland Surgical Centre", signed: true, signedAt:"30 Apr 2026, 15:22"}] },
];

const NEGOTIATIONS = [
  { id: "NEG-001", contractId: "CTR-DRAFT-CHC-001", provider: "Christchurch Surgical Centre", procedure: "Total Knee Replacement", round: 2, status: "in-progress", lastActivity: "13 May 2026",
    changes: [
      { id: "CH-001", type: "rate-change", field: "Tier 1 Rate (Claims 1–40)", from: "$3,990", to: "$4,100", proposedBy: "Provider", status: "pending", note: "Provider requests Tier 1 alignment with Auckland Surgical rates" },
      { id: "CH-002", type: "clause-change", field: "Termination Notice Period", from: "60 days written notice", to: "90 days written notice", proposedBy: "Provider", status: "accepted", note: "Accepted — aligns with standard clause CL-002" },
      { id: "CH-003", type: "cap-change", field: "Annual Volume Cap", from: "120 procedures/year", to: "140 procedures/year", proposedBy: "Insurer", status: "rejected", note: "Provider rejects — cites OR capacity constraints for 2026/27" },
    ]
  },
  { id: "NEG-002", contractId: "CTR-005", provider: "Wellington Regional Hospital", procedure: "Total Knee Replacement", round: 1, status: "awaiting-response", lastActivity: "10 May 2026",
    changes: [
      { id: "CH-004", type: "rate-change", field: "Matrix Rate A:High", from: "$5,000", to: "$4,800", proposedBy: "Insurer", status: "pending", note: "5-year volume growth justifies 4% rate reduction on highest complexity tier" },
      { id: "CH-005", type: "clause-change", field: "Claims Reporting Frequency", from: "Quarterly", to: "Monthly", proposedBy: "Insurer", status: "pending", note: "Required for IQVIA TMB real-time integration in Phase 2" },
    ]
  },
];

const OBLIGATIONS = [
  { id: "OBL-001", contractId: "CTR-002", provider: "Wellington Orthopaedics", type: "Wait Time", metric: "FSA within 60 days of referral", current: 52, target: 60, unit: "days avg", status: "on-track", trend: "↓ improving", lastReported: "Apr 2026",
    history: [{month:"Feb",value:48},{month:"Mar",value:55},{month:"Apr",value:52}] },
  { id: "OBL-002", contractId: "CTR-001", provider: "Auckland Surgical Centre", type: "Reporting", metric: "Monthly claims submission", current: 8, target: 10, unit: "days avg", status: "on-track", trend: "↓ improving", lastReported: "Apr 2026",
    history: [{month:"Feb",value:12},{month:"Mar",value:9},{month:"Apr",value:8}] },
  { id: "OBL-003", contractId: "CTR-003", provider: "Christchurch Surgical Centre", type: "Quality", metric: "Complication rate ≤ 2%", current: 3.1, target: 2.0, unit: "% rate", status: "at-risk", trend: "↑ worsening", lastReported: "Apr 2026",
    history: [{month:"Feb",value:1.8},{month:"Mar",value:2.4},{month:"Apr",value:3.1}] },
  { id: "OBL-004", contractId: "CTR-005", provider: "Wellington Regional Hospital", type: "Wait Time", metric: "Surgery within 4 months of FSA", current: 89, target: 80, unit: "days avg", status: "breach", trend: "↑ worsening", lastReported: "Apr 2026",
    history: [{month:"Feb",value:75},{month:"Mar",value:83},{month:"Apr",value:89}] },
  { id: "OBL-005", contractId: "CTR-006", provider: "Auckland Surgical Centre", type: "Reporting", metric: "Post-op outcome data submission", current: 5, target: 10, unit: "days avg", status: "on-track", trend: "→ stable", lastReported: "Apr 2026",
    history: [{month:"Feb",value:5},{month:"Mar",value:6},{month:"Apr",value:5}] },
  { id: "OBL-006", contractId: "CTR-004", provider: "Auckland Surgical Centre", type: "Quality", metric: "30-day readmission rate ≤ 3%", current: 1.8, target: 3.0, unit: "% rate", status: "on-track", trend: "→ stable", lastReported: "Apr 2026",
    history: [{month:"Feb",value:2.1},{month:"Mar",value:1.9},{month:"Apr",value:1.8}] },
];

// ─── Screen switching ─────────────────────────────────────────────────────────

const renderedScreens = new Set(["studio"]);

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
  document.querySelector(`.nav-item[data-screen="${name}"]`)?.classList.add("active");

  if (!renderedScreens.has(name)) {
    renderedScreens.add(name);
    const renderers = {
      dashboard:   renderDashboard,
      contracts:   renderContracts,
      approvals:   renderApprovals,
      utilization: renderUtilization,
      clauses:     renderClauseLibrary,
      esignature:  renderESignature,
      negotiation: renderNegotiation,
      obligations: renderObligations,
      pricing:     renderPricingSchedule,
    };
    renderers[name]?.();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const res = await fetch(`${API_BASE}/api/health`).catch(() => null);
  const badge = document.getElementById("modeBadge");
  if (res?.ok) {
    const data = await res.json();
    badge.textContent = data.mode === "live" ? "Live AI" : "Demo Mode";
    badge.className = "mode-badge " + (data.mode === "live" ? "live" : "mock");
  } else {
    badge.textContent = "Offline";
    badge.className = "mode-badge mock";
  }
  renderDashboard();
  showScreen("dashboard");
  setupVoice();
  initTooltips();
}

// ─── Tooltip system ───────────────────────────────────────────────────────────

function initTooltips() {
  const tip = document.getElementById("infoTooltip");
  let hideTimer = null;

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip-title]");
    if (!el) return;
    clearTimeout(hideTimer);
    document.getElementById("tipTitle").textContent = el.dataset.tipTitle || "";
    document.getElementById("tipPhase").textContent = el.dataset.tipPhase || "";
    document.getElementById("tipDesc").textContent = el.dataset.tipDesc || "";
    tip.style.display = "block";

    const rect = el.getBoundingClientRect();
    let left = rect.right + 14;
    let top = rect.top;

    setTimeout(() => {
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      if (left + tw > window.innerWidth - 8) left = rect.left - tw - 14;
      if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
      tip.style.left = Math.max(8, left) + "px";
      tip.style.top  = Math.max(8, top)  + "px";
    }, 0);
  });

  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest("[data-tip-title]");
    if (!el) return;
    hideTimer = setTimeout(() => { tip.style.display = "none"; }, 80);
  });
}

// ─── Screen 1: Dashboard ──────────────────────────────────────────────────────

function renderDashboard() {
  const alertContracts = CONTRACTS.map(c => ({ ...c, pct: Math.round((c.ytd / c.cap) * 100) }))
    .filter(c => c.pct >= 75).sort((a, b) => b.pct - a.pct);
  const expiring = CONTRACTS.filter(c => c.status === "EXPIRING")
    .concat(CONTRACTS.filter(c => c.status === "ACTIVE" && new Date(c.expiry) < new Date("2026-09-01")))
    .slice(0, 3);
  const pendingApprovals = APPROVALS.filter(a => a.status === "PENDING");

  document.getElementById("screen-dashboard").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div>
          <div class="screen-title">Good morning, Sarah.</div>
          <div class="screen-sub">Thursday, 15 May 2026 · Here's your contract portfolio.</div>
        </div>
        <button class="btn-sm primary" onclick="showScreen('studio')">+ New Contract in AI Studio</button>
      </div>
    </div>
    <div class="screen-body">
      <div class="stat-row">
        <div class="stat-card"><div class="stat-label">Active Contracts</div><div class="stat-value blue">6</div><div class="stat-sub">Across 4 providers</div></div>
        <div class="stat-card"><div class="stat-label">Pending Approval</div><div class="stat-value amber">${pendingApprovals.length}</div><div class="stat-sub">Awaiting your action</div></div>
        <div class="stat-card"><div class="stat-label">Utilization Alerts</div><div class="stat-value red">${alertContracts.length}</div><div class="stat-sub">Above 75% of cap</div></div>
        <div class="stat-card"><div class="stat-label">Expiring ≤ 90 days</div><div class="stat-value amber">1</div><div class="stat-sub">CTR-001 · 77 days</div></div>
      </div>
      <div class="dashboard-grid">
        <div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Utilization Alerts</span><span class="section-card-count">${alertContracts.length} contracts</span></div>
            ${alertContracts.map(c => {
              const level = c.pct >= 90 ? "critical" : "warning";
              const weeksLeft = Math.round(((c.cap - c.ytd) / (c.ytd / 10)) * 4.33);
              return `<div class="alert-row"><div class="alert-info"><div class="alert-title">${c.provider}</div><div class="alert-sub">${c.procedure} · ${c.id} · ${c.model}</div><div class="alert-bar-wrap"><div class="alert-bar ${level}" style="width:${c.pct}%"></div></div></div><div class="alert-meta"><div class="alert-pct ${level}">${c.pct}%</div><div class="alert-days">${c.ytd}/${c.cap} · ~${weeksLeft}w to cap</div><button class="btn-sm outline" style="margin-top:6px;font-size:11px" onclick="showScreen('utilization')">View</button></div></div>`;
            }).join("")}
          </div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Expiring Contracts</span><span class="section-card-count">within 90 days</span></div>
            ${expiring.map(c => {
              const days = Math.round((new Date(c.expiry) - new Date("2026-05-15")) / 86400000);
              const urgency = days <= 30 ? "critical" : days <= 60 ? "warning" : "ok";
              return `<div class="alert-row"><div class="alert-info"><div class="alert-title">${c.provider}</div><div class="alert-sub">${c.procedure} · ${c.id} · Expires ${c.expiry}</div></div><div class="alert-meta"><div class="alert-pct ${urgency}">${days}d</div><div class="alert-days">remaining</div><button class="btn-sm outline" style="margin-top:6px;font-size:11px" onclick="showScreen('studio')">Renew</button></div></div>`;
            }).join("")}
          </div>
        </div>
        <div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Pending Approvals</span><span class="section-card-count">${pendingApprovals.length} awaiting action</span></div>
            ${pendingApprovals.map(a => `<div class="approval-row"><div class="approval-type"><span class="status-pill ${a.type==="New Contract"?"draft":"pending"}">${a.type}</span></div><div class="approval-info"><div class="approval-title">${a.provider}</div><div class="approval-sub">${a.procedure} · ${a.contractId}</div><div class="approval-sub" style="margin-top:3px">$${a.annualValue.toLocaleString()} estimated annual value</div></div><button class="btn-sm primary" style="flex-shrink:0" onclick="showScreen('approvals')">Review</button></div>`).join("")}
          </div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Recent AI Activity</span><span class="section-card-count">Today</span></div>
            ${ACTIVITY.slice(0,4).map(a => `<div class="activity-row"><div class="activity-dot" style="background:var(--${a.dot})"></div><div class="activity-body"><div class="activity-text">${a.text}</div><div class="activity-time">${a.time} · AI Studio</div></div></div>`).join("")}
          </div>
        </div>
      </div>
    </div>`;
}

// ─── Screen 3: Contract Registry ──────────────────────────────────────────────

function renderContracts() {
  document.getElementById("screen-contracts").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Contract Registry</div><div class="screen-sub">All active and expiring provider contracts — click a row for details</div></div>
        <button class="btn-sm primary" onclick="showScreen('studio')">+ Draft New Contract</button>
      </div>
    </div>
    <div class="filter-bar">
      <div class="search-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Search provider, procedure, or contract ID..." oninput="filterContracts(this.value)" /></div>
      <select class="filter-select" onchange="filterContracts('',this.value)"><option value="">All models</option><option value="TIERED">Tiered</option><option value="FFS">FFS</option><option value="MATRIX">Matrix</option><option value="STAIRCASE">Staircase</option></select>
    </div>
    <div class="screen-body" style="padding-top:0">
      <div class="registry-layout">
        <div class="registry-left">
          <div class="contracts-table">
            <div class="table-header"><div class="th">Contract</div><div class="th">Provider</div><div class="th">Procedure</div><div class="th">Model</div><div class="th">Rate</div><div class="th">Cap</div><div class="th">Status</div></div>
            <div id="contractRows">${renderContractRows(CONTRACTS)}</div>
          </div>
        </div>
        <div class="registry-right" id="contractDetail"><div class="section-card" style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">Select a contract to view details</div></div>
      </div>
    </div>`;
}

function renderContractRows(list) {
  return list.map(c => `
    <div class="table-row ${c.id===selectedContractId?"selected":""}" onclick="selectContract('${c.id}')">
      <div class="td mono">${c.id}</div>
      <div class="td">${c.provider.replace(" Centre","").replace(" Hospital","")}</div>
      <div class="td muted">${c.procedure}</div>
      <div class="td"><span class="status-pill draft" style="font-size:10px">${c.model}</span></div>
      <div class="td muted" style="font-size:12px">${c.rateRange}</div>
      <div class="td muted">${c.cap}</div>
      <div class="td"><span class="status-pill ${c.status.toLowerCase()}">${c.status}</span></div>
    </div>`).join("");
}

function filterContracts(search, model) {
  const s = (search || "").toLowerCase();
  const m = model || document.querySelector(".filter-select")?.value || "";
  const filtered = CONTRACTS.filter(c =>
    (!s || c.id.toLowerCase().includes(s) || c.provider.toLowerCase().includes(s) || c.procedure.toLowerCase().includes(s)) &&
    (!m || c.model === m)
  );
  const rows = document.getElementById("contractRows");
  if (rows) rows.innerHTML = renderContractRows(filtered);
}

function selectContract(id) {
  selectedContractId = id;
  const c = CONTRACTS.find(x => x.id === id);
  if (!c) return;
  document.querySelectorAll(".table-row").forEach(r => {
    r.classList.toggle("selected", r.querySelector(".mono")?.textContent === id);
  });
  const pct = Math.round((c.ytd / c.cap) * 100);
  const level = pct >= 90 ? "critical" : pct >= 80 ? "warning" : pct >= 60 ? "warning" : "ok";
  const days = Math.round((new Date(c.expiry) - new Date("2026-05-15")) / 86400000);
  let rateDetail = "";
  if (c.model === "TIERED") {
    rateDetail = c.tiers.map((t,i) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12.5px"><span style="color:var(--text-muted)">Tier ${i+1}: ${t.from}–${t.to??"∞"}</span><strong>$${t.rate.toLocaleString()}</strong></div>`).join("");
  } else if (c.model === "FFS") {
    rateDetail = `<div style="font-size:14px;font-weight:700">$${c.rate.toLocaleString()} NZD <span style="font-size:12px;font-weight:400;color:var(--text-muted)">flat rate</span></div>`;
  } else if (c.model === "STAIRCASE") {
    rateDetail = `<div style="font-size:12.5px;display:flex;flex-direction:column;gap:5px"><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Claims 1–${c.threshold}</span><span style="${c.ytd>=c.threshold?"text-decoration:line-through;color:var(--text-muted)":"font-weight:700"}">$${c.rateBefore.toLocaleString()}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Claims ${c.threshold+1}+</span><span style="${c.ytd>=c.threshold?"font-weight:700;color:var(--amber)":""}">$${c.rateAfter.toLocaleString()}</span></div>${c.ytd>=c.threshold?`<div style="font-size:11px;color:var(--amber);margin-top:3px">⚡ Threshold crossed at ${c.ytd} procedures</div>`:""}</div>`;
  } else if (c.model === "MATRIX") {
    rateDetail = Object.entries(c.matrix).map(([k,v]) => { const [f,cx]=k.split(":"); return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:12.5px"><span style="color:var(--text-muted)">Facility ${f} · ${cx}</span><strong>$${v.toLocaleString()}</strong></div>`; }).join("");
  }
  document.getElementById("contractDetail").innerHTML = `
    <div class="detail-panel" style="height:100%">
      <div class="detail-header"><div style="display:flex;align-items:center;justify-content:space-between"><div><div class="detail-title">${c.provider}</div><div class="detail-sub">${c.id} · ${c.procedure}</div></div><span class="status-pill ${c.status.toLowerCase()}">${c.status}</span></div></div>
      <div class="detail-section"><div class="detail-label">Pricing Model</div><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span class="status-pill draft">${c.model}</span><span style="font-size:12px;color:var(--text-muted)">${c.city} · ${c.networkTier.toUpperCase()} network</span></div>${rateDetail}</div>
      <div class="detail-section"><div class="detail-label">YTD Utilization</div><div class="util-bar-wrap"><div class="util-bar" style="width:${pct}%;background:var(--${level==="ok"?"green":level==="warning"?"amber":"red"})"></div></div><div style="display:flex;justify-content:space-between;font-size:12px;margin-top:5px"><span style="font-weight:600">${c.ytd} of ${c.cap} procedures (${pct}%)</span><span class="util-alert-badge ${level}">${level.toUpperCase()}</span></div></div>
      <div class="detail-section"><div class="detail-label">Contract Period</div><div class="detail-value">Expires <strong>${c.expiry}</strong> · ${days} days remaining</div></div>
      <div class="detail-section" style="display:flex;gap:8px"><button class="btn-sm primary" onclick="showScreen('studio')">Amend in AI Studio</button><button class="btn-sm outline" onclick="showScreen('studio')">Initiate Renewal</button></div>
    </div>`;
}

// ─── Screen 4: Approval Queue ─────────────────────────────────────────────────

let approvalsState = APPROVALS.map(a => ({ ...a }));

function renderApprovals() {
  const pending = approvalsState.filter(a => a.status === "PENDING");
  const completed = approvalsState.filter(a => a.status !== "PENDING");
  document.getElementById("screen-approvals").innerHTML = `
    <div class="screen-header"><div class="screen-header-top"><div><div class="screen-title">Approval Queue</div><div class="screen-sub">${pending.length} item${pending.length!==1?"s":""} awaiting your review and decision</div></div></div></div>
    <div class="screen-body">
      <div class="approvals-layout">
        <div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:12px">Awaiting Decision (${pending.length})</div>
          ${pending.length===0?`<div class="section-card" style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">All caught up — no pending approvals.</div>`:""}
          ${pending.map(a => renderApprovalCard(a)).join("")}
          ${completed.length>0?`<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin:24px 0 12px">Completed Today (${completed.length})</div>${completed.map(a=>renderApprovalCard(a)).join("")}`:""}
        </div>
        <div>
          <div class="section-card" style="margin-bottom:16px">
            <div class="section-card-header"><span class="section-card-title">Compliance Audit Log</span></div>
            <div class="audit-log-entry"><div class="audit-icon blue"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="audit-body"><div class="audit-text">APP-002 submitted — AMD-CTR-001-001 amendment</div><div class="audit-ts">11 May 2026, 10:45 · Sarah Mitchell</div></div></div>
            <div class="audit-log-entry"><div class="audit-icon blue"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="audit-body"><div class="audit-text">APP-001 submitted — CTR-DRAFT-CHC-001 new contract</div><div class="audit-ts">11 May 2026, 09:23 · Sarah Mitchell</div></div></div>
            <div class="audit-log-entry"><div class="audit-icon green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><div class="audit-body"><div class="audit-text">CTR-004 renewal confirmed — Auckland Surgical</div><div class="audit-ts">28 Apr 2026, 14:12 · James Okonkwo</div></div></div>
          </div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">CoFI Compliance</span></div>
            <div style="padding:14px 20px;font-size:12.5px;color:var(--text);line-height:1.6">Every approval decision is <strong>immutably logged</strong> with timestamp, approver identity, and full contract terms. Approval chain cannot be bypassed. The AI never commits — it only drafts.</div>
            <div style="padding:0 20px 14px;display:flex;gap:6px;flex-wrap:wrap"><span class="tag">CoFI Act ✓</span><span class="tag">7-year retention ✓</span><span class="tag">Human sign-off ✓</span><span class="tag">Immutable log ✓</span></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderApprovalCard(a) {
  const isDone = a.status !== "PENDING";
  const chainHtml = a.approvers.map((role,i) => {
    const stepDone = isDone || i < a.currentStep;
    const isCurrent = !isDone && i === a.currentStep;
    return `${i>0?'<div class="chain-arrow"></div>':""}<div class="chain-step ${stepDone?"done":isCurrent?"current":""}"><div class="chain-dot ${stepDone?"done":isCurrent?"current":"pending"}"></div>${role}</div>`;
  }).join("");
  return `
    <div class="approval-card ${isDone?"done":""}" id="card-${a.id}">
      <div class="approval-card-header"><div><div style="display:flex;align-items:center;gap:8px"><span class="status-pill ${a.type==="New Contract"?"draft":"pending"}">${a.type}</span><span style="font-size:12px;color:var(--text-muted);font-family:monospace">${a.contractId}</span></div><div class="approval-card-title" style="margin-top:6px">${a.provider}</div><div class="approval-card-sub">${a.procedure}</div></div><span class="status-pill ${a.status==="PENDING"?"pending":a.status==="APPROVED"?"approved":"rejected"}">${a.status}</span></div>
      <div class="approval-card-body"><div class="approval-field"><div class="approval-field-label">Annual Value</div><div class="approval-field-value">$${a.annualValue.toLocaleString()}</div></div><div class="approval-field"><div class="approval-field-label">Model</div><div class="approval-field-value">${a.model}</div></div><div class="approval-field"><div class="approval-field-label">Submitted</div><div class="approval-field-value" style="font-size:12px">${a.submittedAt}</div></div><div class="approval-field"><div class="approval-field-label">Submitted By</div><div class="approval-field-value" style="font-size:12px">${a.submittedBy}</div></div></div>
      <div style="padding:0 20px 12px;font-size:12.5px;color:var(--text-muted)">${a.summary}</div>
      <div class="approval-chain-visual">${chainHtml}</div>
      <div class="approval-actions"><button class="btn-sm outline" onclick="showScreen('studio')">View in AI Studio</button><div class="spacer"></div>${!isDone?`<button class="btn-sm danger" onclick="rejectApproval('${a.id}')">Reject</button><button class="btn-sm success" onclick="approveApproval('${a.id}')">Approve</button>`:""}</div>
    </div>`;
}

function approveApproval(id) {
  const a = approvalsState.find(x => x.id === id);
  if (!a) return;
  if (a.currentStep < a.approvers.length - 1) { a.currentStep++; }
  else { a.status = "APPROVED"; updateApprovalBadge(); }
  renderApprovals();
}

function rejectApproval(id) {
  const a = approvalsState.find(x => x.id === id);
  if (a) { a.status = "REJECTED"; updateApprovalBadge(); }
  renderApprovals();
}

function updateApprovalBadge() {
  const pending = approvalsState.filter(a => a.status === "PENDING").length;
  const badge = document.getElementById("badgeApprovals");
  if (badge) { badge.textContent = pending; badge.style.display = pending === 0 ? "none" : ""; }
}

// ─── Screen 5: Utilization Monitor ───────────────────────────────────────────

function renderUtilization() {
  const cards = CONTRACTS.map(c => {
    const pct = Math.round((c.ytd / c.cap) * 100);
    const level = pct >= 90 ? "critical" : pct >= 80 ? "warning" : pct >= 60 ? "warning" : "ok";
    const runRate = Math.round((c.ytd / 10) * 12);
    const weeksLeft = c.ytd > 0 ? Math.round(((c.cap - c.ytd) / (c.ytd / (10 * 4.33)))) : null;
    return { ...c, pct, level, runRate, weeksLeft };
  });
  const alertCount = cards.filter(c => c.pct >= 80).length;

  document.getElementById("screen-utilization").innerHTML = `
    <div class="screen-header"><div class="screen-header-top"><div><div class="screen-title">Utilization Monitor</div><div class="screen-sub">Live cap tracking across all contracted providers · Data: IQVIA TMB · As of 15 May 2026</div></div></div></div>
    <div class="screen-body">
      <div class="stat-row" style="grid-template-columns:repeat(3,1fr);max-width:640px;margin-bottom:24px">
        <div class="stat-card"><div class="stat-label">Contracts Monitored</div><div class="stat-value blue">6</div><div class="stat-sub">All active contracts</div></div>
        <div class="stat-card"><div class="stat-label">Alerts ≥ 80%</div><div class="stat-value ${alertCount>0?"red":"green"}">${alertCount}</div><div class="stat-sub">Require attention</div></div>
        <div class="stat-card"><div class="stat-label">Total YTD Procedures</div><div class="stat-value">${CONTRACTS.reduce((s,c)=>s+c.ytd,0)}</div><div class="stat-sub">Across all contracts</div></div>
      </div>
      <div class="util-grid">
        ${cards.map(c => `
          <div class="util-card ${c.level}">
            <div class="util-card-top"><div><div class="util-card-title">${c.provider.replace(" Centre","").replace(" Hospital","")}</div><div class="util-card-sub">${c.procedure} · ${c.id}</div></div><span class="util-alert-badge ${c.level}">${c.level.toUpperCase()}</span></div>
            <div class="util-progress-wrap"><div class="util-progress-bar"><div class="util-progress-fill ${c.level}" style="width:${c.pct}%"></div></div><div class="util-progress-labels"><span class="util-ytd">${c.ytd} used</span><span class="util-cap">of ${c.cap} cap (${c.pct}%)</span></div></div>
            <div class="util-meta"><div class="util-kv"><div class="util-k">Annual Run Rate</div><div class="util-v ${c.runRate>c.cap?"red":""}">${c.runRate} projected</div></div><div class="util-kv"><div class="util-k">Weeks to Cap</div><div class="util-v ${c.weeksLeft&&c.weeksLeft<8?"red":c.weeksLeft&&c.weeksLeft<16?"amber":""}">${c.weeksLeft?c.weeksLeft+"w":"—"}</div></div><div class="util-kv"><div class="util-k">Model</div><div class="util-v" style="font-size:11px">${c.model}</div></div><div class="util-kv"><div class="util-k">Network</div><div class="util-v" style="font-size:11px">${c.networkTier.toUpperCase()}</div></div></div>
            ${c.level!=="ok"?`<button class="btn-sm outline" style="width:100%;margin-top:4px" onclick="showScreen('studio')">${c.pct>=90?"Amend Cap in AI Studio":"Review in AI Studio"}</button>`:""}
          </div>`).join("")}
      </div>
    </div>`;
}

// ─── Screen 6: Clause Library ─────────────────────────────────────────────────

function renderClauseLibrary() {
  const categories = ["All", ...new Set(CLAUSES.map(c => c.category))];
  const filtered = clauseCategory === "All" ? CLAUSES : CLAUSES.filter(c => c.category === clauseCategory);

  document.getElementById("screen-clauses").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Clause Library</div><div class="screen-sub">Pre-approved legal building blocks — click a clause to read the full text</div></div>
        <button class="btn-sm primary" onclick="alert('Add Clause — available in Phase 2 with full legal workflow')">+ Add Clause</button>
      </div>
    </div>
    <div class="screen-body">
      <div class="clause-layout">
        <div class="clause-sidebar">
          ${categories.map(cat => {
            const count = cat === "All" ? CLAUSES.length : CLAUSES.filter(c=>c.category===cat).length;
            return `<button class="clause-cat-btn ${clauseCategory===cat?"active":""}" onclick="setClauseCategory('${cat}')"><span>${cat}</span><span class="clause-cat-count">${count}</span></button>`;
          }).join("")}
          <div style="margin-top:12px;padding:10px 12px;background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.15);border-radius:8px;font-size:11.5px;color:var(--blue);line-height:1.5">
            <strong>8 clauses</strong> in library<br><span style="color:var(--text-muted)">7 approved · 1 under review</span>
          </div>
        </div>
        <div class="clause-list">
          ${filtered.map(cl => `
            <div class="clause-card ${expandedClauseId===cl.id?"expanded":""}" onclick="toggleClause('${cl.id}')">
              <div class="clause-card-header">
                <div class="clause-card-meta">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                    <span class="clause-status-${cl.status}">${cl.status==="approved"?"Approved":"Under Review"}</span>
                    <span style="font-size:11px;color:var(--text-muted);font-family:monospace">${cl.id} · ${cl.version}</span>
                  </div>
                  <div class="clause-card-title">${cl.title}</div>
                  <div class="clause-card-sub">${cl.category} · Last reviewed ${cl.lastReviewed}</div>
                  <div class="clause-tags">${cl.tags.map(t=>`<span class="clause-tag">${t}</span>`).join("")}</div>
                </div>
                <div class="clause-expand-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
              <div class="clause-card-body">${escapeHtml(cl.body)}</div>
              ${expandedClauseId===cl.id?`<div class="clause-card-footer"><button class="btn-sm primary" onclick="event.stopPropagation();alert('Insert into draft — connects to AI Studio in Phase 2')">Insert into Draft</button><button class="btn-sm outline" onclick="event.stopPropagation()">Copy Text</button></div>`:""}
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

function setClauseCategory(cat) {
  clauseCategory = cat;
  expandedClauseId = null;
  renderedScreens.delete("clauses");
  renderClauseLibrary();
  renderedScreens.add("clauses");
}

function toggleClause(id) {
  expandedClauseId = expandedClauseId === id ? null : id;
  renderedScreens.delete("clauses");
  renderClauseLibrary();
  renderedScreens.add("clauses");
}

// ─── Screen 7: E-Signature ────────────────────────────────────────────────────

function renderESignature() {
  const statusLabel = { "awaiting-provider": "Awaiting Provider", "awaiting-insurer": "Awaiting Insurer", "completed": "Completed" };
  const pending = ESIG_DOCS.filter(d => d.status !== "completed");
  const done    = ESIG_DOCS.filter(d => d.status === "completed");

  document.getElementById("screen-esignature").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">E-Signature</div><div class="screen-sub">DocuSign-integrated signing queue — ${pending.length} awaiting signature, ${done.length} completed</div></div>
      </div>
    </div>
    <div class="screen-body">
      <div class="esig-layout">
        <div>
          ${pending.length>0?`<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:10px">Awaiting Signature (${pending.length})</div>`:""}
          <div class="esig-list">
            ${ESIG_DOCS.map(doc => `
              <div class="esig-card ${selectedEsigId===doc.id?"selected":""}" onclick="selectEsig('${doc.id}')">
                <div class="esig-card-header">
                  <div><div class="esig-card-title">${doc.provider}</div><div class="esig-card-sub">${doc.type} · ${doc.contractId} · ${doc.procedure}</div></div>
                  <span class="esig-status-pill esig-status-${doc.status}">${statusLabel[doc.status]}</span>
                </div>
                <div class="esig-card-body">
                  <div class="esig-signers">
                    ${doc.signers.map(s => `<div class="esig-signer"><div class="esig-signer-dot ${s.signed?"signed":"pending"}"></div><div class="esig-signer-name">${s.name}</div><div class="esig-signer-ts">${s.signed?s.signedAt:"Pending"}</div></div>`).join("")}
                  </div>
                </div>
              </div>`).join("")}
          </div>
        </div>
        <div class="esig-detail">
          ${selectedEsigId ? renderEsigEnvelope(ESIG_DOCS.find(d=>d.id===selectedEsigId)) : `<div class="section-card" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">Select a document to view the signing envelope</div>`}
        </div>
      </div>
    </div>`;
}

function renderEsigEnvelope(doc) {
  if (!doc) return "";
  const mySigner = doc.signers.find(s => s.name === "Sarah Mitchell");
  const canSign  = mySigner && !mySigner.signed;
  return `
    <div class="esig-envelope">
      <div class="esig-envelope-header">
        <div class="esig-envelope-logo">DocuSign</div>
        <div class="esig-envelope-sub">Electronic Signature Platform · NZ Health Insurer CLM Integration</div>
      </div>
      <div class="esig-doc-preview">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:12px">Document Preview</div>
        <div class="esig-doc-page">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;text-align:center">${doc.type} — ${doc.contractId}</div>
          <div style="margin-bottom:8px"><strong>Provider:</strong> ${doc.provider}</div>
          <div style="margin-bottom:8px"><strong>Procedure:</strong> ${doc.procedure}</div>
          <div style="margin-bottom:8px"><strong>Document Type:</strong> ${doc.type}</div>
          <div style="margin-bottom:16px"><strong>Sent:</strong> ${doc.sentAt}</div>
          <div style="font-size:11.5px;color:var(--text-muted)">This document has been prepared in accordance with the NZ Contract Law and CoFI Act requirements. Both parties must sign to activate this agreement.</div>
          ${doc.signers.map(s => `
            <div class="esig-sign-zone" style="margin-top:16px">
              <div><div class="esig-sign-label">${s.role}</div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">${s.name}</div></div>
              ${s.signed
                ? `<div class="esig-signed-stamp">✓ Signed ${s.signedAt}</div>`
                : (s.name==="Sarah Mitchell" && canSign
                   ? `<button class="btn-sm primary" onclick="signDocument('${doc.id}')">Sign Now</button>`
                   : `<span style="font-size:11px;color:var(--amber);font-weight:600">Awaiting signature</span>`)}
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

function selectEsig(id) {
  selectedEsigId = id;
  renderedScreens.delete("esignature");
  renderESignature();
  renderedScreens.add("esignature");
}

function signDocument(esigId) {
  const doc = ESIG_DOCS.find(d => d.id === esigId);
  const signer = doc?.signers.find(s => s.name === "Sarah Mitchell" && !s.signed);
  if (signer) {
    signer.signed = true;
    signer.signedAt = new Date().toLocaleString("en-NZ", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    if (doc.signers.every(s => s.signed)) { doc.status = "completed"; doc.completedAt = signer.signedAt; }
  }
  renderedScreens.delete("esignature");
  renderESignature();
  renderedScreens.add("esignature");
}

// ─── Screen 8: Negotiation & Redlining ───────────────────────────────────────

function renderNegotiation() {
  const statusLabel = { "in-progress": "In Progress", "awaiting-response": "Awaiting Response", "complete": "Complete" };
  const statusClass = { "in-progress": "draft", "awaiting-response": "pending", "complete": "approved" };

  document.getElementById("screen-negotiation").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Negotiation & Redlining</div><div class="screen-sub">${NEGOTIATIONS.length} active negotiations — click to review tracked changes and accept or reject each item</div></div>
      </div>
    </div>
    <div class="screen-body">
      <div class="neg-layout">
        <div class="neg-list">
          ${NEGOTIATIONS.map(neg => `
            <div class="neg-card ${selectedNegotiationId===neg.id?"selected":""}" onclick="selectNegotiation('${neg.id}')">
              <div class="neg-card-title">${neg.provider}</div>
              <div class="neg-card-sub">${neg.procedure} · ${neg.contractId}</div>
              <div class="neg-card-meta">
                <span class="neg-round-badge">Round ${neg.round}</span>
                <span class="status-pill ${statusClass[neg.status]}" style="font-size:10px">${statusLabel[neg.status]}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${neg.changes.length} changes · Last activity ${neg.lastActivity}</div>
            </div>`).join("")}
        </div>
        <div class="neg-detail">
          ${selectedNegotiationId
            ? renderNegotiationDetail(NEGOTIATIONS.find(n => n.id === selectedNegotiationId))
            : `<div class="section-card" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">Select a negotiation to review tracked changes</div>`}
        </div>
      </div>
    </div>`;
}

function renderNegotiationDetail(neg) {
  if (!neg) return "";
  const pendingCount   = neg.changes.filter(c => c.status === "pending").length;
  const acceptedCount  = neg.changes.filter(c => c.status === "accepted").length;
  const rejectedCount  = neg.changes.filter(c => c.status === "rejected").length;

  return `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${neg.provider} — Round ${neg.round}</span>
          <div style="display:flex;gap:8px;font-size:11.5px">
            <span style="color:var(--amber);font-weight:600">${pendingCount} pending</span>
            <span style="color:var(--green);font-weight:600">${acceptedCount} accepted</span>
            <span style="color:var(--red);font-weight:600">${rejectedCount} rejected</span>
          </div>
        </div>
        ${neg.changes.map(ch => `
          <div class="change-row">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="change-field">${ch.field}</div>
              ${ch.status==="pending"
                ? `<div class="change-actions"><span class="change-proposer">Proposed by ${ch.proposedBy}</span><button class="btn-sm danger" onclick="resolveChange('${neg.id}','${ch.id}','rejected')">Reject</button><button class="btn-sm success" onclick="resolveChange('${neg.id}','${ch.id}','accepted')">Accept</button></div>`
                : `<span class="change-status-${ch.status}">${ch.status==="accepted"?"✓ Accepted":"✗ Rejected"}</span>`}
            </div>
            <div class="change-diff">
              <div class="change-from"><strong>Was:</strong> ${ch.from}</div>
              <div class="change-arrow">→</div>
              <div class="change-to"><strong>Proposed:</strong> ${ch.to}</div>
            </div>
            <div class="change-note">${ch.note}</div>
          </div>`).join("")}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-sm primary" onclick="alert('Send counter-proposal — available in Phase 2 full negotiation workflow')">Send Counter-Proposal</button>
        <button class="btn-sm outline">Export Redline PDF</button>
      </div>
    </div>`;
}

function selectNegotiation(id) {
  selectedNegotiationId = id;
  renderedScreens.delete("negotiation");
  renderNegotiation();
  renderedScreens.add("negotiation");
}

function resolveChange(negId, changeId, resolution) {
  const neg = NEGOTIATIONS.find(n => n.id === negId);
  const change = neg?.changes.find(c => c.id === changeId);
  if (change) change.status = resolution;
  renderedScreens.delete("negotiation");
  renderNegotiation();
  renderedScreens.add("negotiation");
}

// ─── Screen 9: Obligations & SLA ─────────────────────────────────────────────

function renderObligations() {
  const breachCount   = OBLIGATIONS.filter(o => o.status === "breach").length;
  const atRiskCount   = OBLIGATIONS.filter(o => o.status === "at-risk").length;
  const onTrackCount  = OBLIGATIONS.filter(o => o.status === "on-track").length;

  document.getElementById("screen-obligations").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Obligations & SLA Tracking</div><div class="screen-sub">Post-signature performance monitoring across all active contracts · Click a card for history</div></div>
      </div>
    </div>
    <div class="screen-body">
      <div class="stat-row" style="grid-template-columns:repeat(3,1fr);max-width:640px;margin-bottom:24px">
        <div class="stat-card"><div class="stat-label">On Track</div><div class="stat-value green">${onTrackCount}</div><div class="stat-sub">Meeting targets</div></div>
        <div class="stat-card"><div class="stat-label">At Risk</div><div class="stat-value amber">${atRiskCount}</div><div class="stat-sub">Monitor closely</div></div>
        <div class="stat-card"><div class="stat-label">In Breach</div><div class="stat-value red">${breachCount}</div><div class="stat-sub">Action required</div></div>
      </div>
      <div class="obl-grid">
        ${OBLIGATIONS.map(obl => {
          const isExpanded = selectedObligationId === obl.id;
          const max = Math.max(...obl.history.map(h=>h.value), obl.target) * 1.15;
          const sparkBars = obl.history.map(h => {
            const pct = Math.round((h.value / max) * 44);
            const isGood = obl.type==="Quality" ? h.value <= obl.target : (obl.status==="on-track" ? true : h.value <= obl.target * 1.1);
            const color = h.value > obl.target && obl.type!=="Quality" ? "var(--amber)" : h.value > obl.target ? "var(--red)" : "var(--green)";
            return `<div class="spark-col"><div class="spark-bar" style="height:${pct}px;background:${color};min-height:4px"></div><div class="spark-label">${h.month}</div></div>`;
          }).join("");
          return `
            <div class="obl-card ${obl.status} ${isExpanded?"expanded":""}" onclick="selectObligation('${obl.id}')">
              <div class="obl-card-header">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span class="obl-type-badge">${obl.type}</span><span style="font-size:11px;color:var(--text-muted);font-family:monospace">${obl.contractId}</span></div>
                  <div class="obl-card-title">${obl.provider}</div>
                  <div class="obl-card-sub">${obl.metric}</div>
                </div>
                <span class="obl-status-${obl.status}">${obl.status.replace("-"," ").replace(/\b\w/g,l=>l.toUpperCase())}</span>
              </div>
              <div class="obl-card-body">
                <div class="obl-metric-row">
                  <div class="obl-current ${obl.status}">${obl.current}</div>
                  <div class="obl-target">/ ${obl.target} ${obl.unit} target</div>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <div class="obl-trend">${obl.trend}</div>
                  <div style="font-size:11px;color:var(--text-muted)">Reported ${obl.lastReported}</div>
                </div>
              </div>
              <div class="obl-history">
                <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">3-Month History</div>
                <div class="spark-row">${sparkBars}</div>
                <div style="font-size:11px;color:var(--blue);margin-top:4px">Target: ${obl.target} ${obl.unit}</div>
              </div>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function selectObligation(id) {
  selectedObligationId = selectedObligationId === id ? null : id;
  renderedScreens.delete("obligations");
  renderObligations();
  renderedScreens.add("obligations");
}

// ─── Screen 10: Pricing Schedule ─────────────────────────────────────────────

function renderPricingSchedule() {
  const multipliers = [
    { name: "Out of Hours", value: "1.25×", desc: "Procedures performed outside standard hours (6am–8pm)", type: "above" },
    { name: "Bilateral",    value: "1.70×", desc: "Both sides performed in same session", type: "above" },
    { name: "Emergency",    value: "1.50×", desc: "Unplanned emergency presentation", type: "above" },
    { name: "Repeat <30d",  value: "0.80×", desc: "Same procedure within 30 days of prior claim", type: "below" },
  ];

  const selected = selectedPricingContractId ? CONTRACTS.find(c => c.id === selectedPricingContractId) : null;

  document.getElementById("screen-pricing").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Pricing Schedule</div><div class="screen-sub">Rules Engine — visual rate explorer across all contracts and multiplier combinations</div></div>
        <button class="btn-sm outline" onclick="showScreen('studio')">Evaluate a Claim in AI Studio</button>
      </div>
    </div>
    <div class="screen-body">
      <div class="pricing-layout">
        <div class="pricing-left">
          <div class="pricing-table-wrap">
            <div class="pricing-row header">
              <div class="th">ID</div><div class="th">Provider</div><div class="th">Model</div><div class="th">Cap</div><div class="th">Status</div>
            </div>
            ${CONTRACTS.map(c => `
              <div class="pricing-row ${selectedPricingContractId===c.id?"selected":""}" onclick="selectPricingContract('${c.id}')">
                <div class="td mono">${c.id}</div>
                <div class="td" style="font-size:12.5px">${c.provider.replace(" Centre","").replace(" Hospital","")}<div style="font-size:11px;color:var(--text-muted)">${c.procedure}</div></div>
                <div class="td"><span class="model-chip ${c.model.toLowerCase()}">${c.model}</span></div>
                <div class="td muted">${c.cap}</div>
                <div class="td"><span class="status-pill ${c.status.toLowerCase()}">${c.status}</span></div>
              </div>`).join("")}
          </div>

          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Claim Multipliers</span><span class="section-card-count">Multiplicative — stack on top of base rate</span></div>
            <div style="padding:16px 20px">
              <div class="multiplier-grid">
                ${multipliers.map(m => `
                  <div class="multiplier-card">
                    <div class="multiplier-name">${m.name}</div>
                    <div class="multiplier-value ${m.type}">${m.value}</div>
                    <div class="multiplier-desc">${m.desc}</div>
                  </div>`).join("")}
              </div>
              <div style="margin-top:12px;padding:10px 12px;background:rgba(37,99,235,0.05);border:1px solid rgba(37,99,235,0.15);border-radius:8px;font-size:12px;color:var(--text-muted);line-height:1.6">
                Multipliers are <strong>multiplicative</strong> — an out-of-hours bilateral procedure at $5,000 base = $5,000 × 1.25 × 1.70 = <strong>$10,625</strong>. Evaluated by the Rules Engine, never calculated by the AI.
              </div>
            </div>
          </div>
        </div>

        <div class="pricing-right">
          ${selected ? renderPricingDetail(selected) : `<div class="section-card" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">Select a contract to explore its rate schedule</div>`}
        </div>
      </div>
    </div>`;
}

function renderPricingDetail(c) {
  let rateRows = "";
  if (c.model === "TIERED") {
    rateRows = c.tiers.map((t,i) => `<div class="rate-row"><span class="rate-tier">Tier ${i+1}: ${t.from}–${t.to??"∞"} procedures</span><span class="rate-amount">$${t.rate.toLocaleString()} NZD</span></div>`).join("");
  } else if (c.model === "FFS") {
    rateRows = `<div class="rate-row"><span class="rate-tier">Fixed rate (FFS)</span><span class="rate-amount">$${c.rate.toLocaleString()} NZD</span></div>`;
  } else if (c.model === "STAIRCASE") {
    const flipped = c.ytd >= c.threshold;
    rateRows = `
      <div class="rate-row ${!flipped?"rate-row-active":""}"><span class="rate-tier">Claims 1–${c.threshold} (pre-threshold)</span><span class="rate-amount ${flipped?"rate-crossed":""}">$${c.rateBefore.toLocaleString()}</span></div>
      <div class="rate-row ${flipped?"rate-row-active":""}"><span class="rate-tier">Claims ${c.threshold+1}+ (post-threshold)</span><span class="rate-amount">$${c.rateAfter.toLocaleString()}</span></div>
      <div class="staircase-status ${flipped?"flipped":""}">${flipped?"⚡ Threshold CROSSED — "+c.ytd+" YTD. Rate locked at $"+c.rateAfter.toLocaleString()+" for remainder of year.":c.ytd+" of "+c.threshold+" procedures — threshold not reached"}</div>`;
  } else if (c.model === "MATRIX") {
    rateRows = Object.entries(c.matrix).map(([k,v]) => { const [f,cx]=k.split(":"); return `<div class="rate-row"><span class="rate-tier">Facility ${f} · ${cx} complexity</span><span class="rate-amount">$${v.toLocaleString()}</span></div>`; }).join("");
  }

  const ytdCost = c.model==="FFS" ? c.ytd*c.rate
    : c.model==="TIERED" ? c.tiers.reduce((sum,t) => {
        const from = t.from - 1;
        const to   = Math.min(c.ytd, t.to ?? Infinity);
        const vol  = Math.max(0, to - from);
        return sum + vol * t.rate;
      }, 0)
    : c.model==="STAIRCASE" ? (c.ytd<=c.threshold ? c.ytd*c.rateBefore : c.threshold*c.rateBefore+(c.ytd-c.threshold)*c.rateAfter)
    : 0;

  return `
    <div class="section-card">
      <div class="section-card-header">
        <div><div style="font-size:13.5px;font-weight:700;color:var(--text)">${c.provider.replace(" Centre","").replace(" Hospital","")}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${c.id} · ${c.procedure}</div></div>
        <span class="model-chip ${c.model.toLowerCase()}">${c.model}</span>
      </div>
      <div style="padding:16px 20px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Rate Schedule</div>
        <div class="rate-table">${rateRows}</div>
      </div>
      <div style="padding:0 20px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">YTD Volume</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">${c.ytd}<span style="font-size:12px;font-weight:400;color:var(--text-muted)"> / ${c.cap} cap</span></div>
        </div>
        <div style="padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">YTD Cost Estimate</div>
          <div style="font-size:20px;font-weight:800;color:var(--blue)">$${Math.round(ytdCost).toLocaleString()}</div>
        </div>
      </div>
      <div style="padding:0 20px 16px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Network & Period</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="network-tier-badge tier-${c.networkTier}">${c.networkTier.toUpperCase()} NETWORK</span>
          <span class="value-pill" style="font-size:12px">Expires ${c.expiry}</span>
          <span class="value-pill" style="font-size:12px">${c.city}</span>
        </div>
      </div>
    </div>`;
}

function selectPricingContract(id) {
  selectedPricingContractId = id;
  renderedScreens.delete("pricing");
  renderPricingSchedule();
  renderedScreens.add("pricing");
}

// ─── Contract Preview ─────────────────────────────────────────────────────────

function renderContractPreview(draft, awaitingConfirm, financialImpact) {
  document.getElementById("emptyState").style.display = "none";
  const card = document.getElementById("contractCard");
  card.style.display = "block";

  const isAmendment = !!draft.amendment_id;
  const isRenewal   = !!draft.renewal_id;

  const statusText = draft.status || "DRAFT — Awaiting Confirmation";
  let statusClass = "contract-status";
  if (statusText.includes("ACTIVE"))    statusClass += " active";
  if (statusText.includes("CONFIRMED")) statusClass += " confirmed";
  if (statusText.includes("REJECTED"))  statusClass += " rejected";

  let title    = draft.provider_name || draft.provider_id || "";
  let subtitle = isAmendment ? `Amendment ${draft.amendment_id} · ${draft.procedure_name || ""}`
    : isRenewal ? `Renewal ${draft.renewal_id} · ${draft.procedure_name || ""}`
    : `${(draft.procedure_codes || []).join(", ")} · Contract: ${draft.contract_id}`;

  let pricingModel = isAmendment ? (draft.original_terms?.pricing_model || "")
    : isRenewal ? (draft.baseline_terms?.pricing_model || "") : (draft.pricing_model || "");

  const networkTier = draft.network_tier || draft.baseline_terms?.network_tier || "preferred";
  const sections = [];

  if (!isAmendment) {
    sections.push(`<div class="contract-section"><div class="section-label">Provider</div><div class="hpi-badge">✓ HPI Validated — Registration ACTIVE · NZ HPI (FHIR R4)</div><div class="network-tier-badge tier-${networkTier.toLowerCase()}" style="margin-top:5px">${networkTier.toUpperCase()} NETWORK</div></div>`);
  }

  sections.push(`<div class="contract-section"><div class="section-label">Pricing Model</div><div class="pricing-model-badge">${pricingModel.toUpperCase()}</div></div>`);

  if (isAmendment) {
    sections.push(`<div class="contract-section"><div class="section-label">Original Rates</div><div class="rate-table">${renderRateSummaryText(draft.original_terms?.rate_summary)}</div></div><div class="contract-section"><div class="section-label">Proposed Changes ↓</div><div class="rate-table">${renderProposedChanges(draft.proposed_changes)}</div></div>`);
    if (draft.reason) sections.push(`<div class="contract-section"><div class="section-label">Reason</div><div class="amendment-note">${draft.reason}</div></div>`);
    if (draft.effective_date) sections.push(`<div class="contract-section"><div class="section-label">Effective Date</div><div class="value-pill">${draft.effective_date}</div></div>`);
  } else if (isRenewal) {
    const bl = draft.baseline_terms || {};
    sections.push(`<div class="contract-section"><div class="section-label">Baseline Rates</div><div class="rate-table">${renderRateSummaryText(bl.rate_summary)}</div></div><div class="contract-section"><div class="section-label">Volume Cap</div><div class="value-pill">${bl.annual_cap || "—"} procedures / year</div></div><div class="contract-section"><div class="section-label">Current Expiry</div><div class="value-pill expiring">${draft.current_expiry || "—"}</div></div><div class="contract-section"><div class="section-label">Proposed New Term</div><div class="value-pill">${draft.proposed_start} → ${draft.proposed_end}</div></div>`);
  } else {
    sections.push(`<div class="contract-section"><div class="section-label">Rate Schedule</div><div class="rate-table">${renderRateSchedule(draft.pricing_model, draft.rate_schedule)}</div></div><div class="contract-section"><div class="section-label">Volume Cap</div><div class="value-pill">${draft.volume_cap} procedures / year</div></div><div class="contract-section"><div class="section-label">Contract Period</div><div class="value-pill">${draft.start_date} → ${draft.end_date}</div></div>`);
  }

  if (financialImpact && !financialImpact.error) {
    const delta = financialImpact.annual_delta;
    const dir = financialImpact.delta_direction || (delta < 0 ? "saving" : "increase");
    sections.push(`<div class="contract-section"><div class="section-label">Financial Impact</div><div class="financial-impact ${dir}"><div>Current annual cost: <strong>$${(financialImpact.current_annual_cost||0).toLocaleString()}</strong></div><div>Proposed annual cost: <strong>$${(financialImpact.proposed_annual_cost||0).toLocaleString()}</strong></div><div class="delta">Annual ${dir}: <strong>$${Math.abs(delta).toLocaleString()}</strong></div><div class="fi-note">${financialImpact.note||""}</div></div></div>`);
  }

  if (!isAmendment && !isRenewal && (draft.approval_route||[]).length > 0) {
    const chainHtml = draft.approval_route.map((role,i) => (i>0?'<span class="arrow">→</span>':"") + `<div class="approver-badge">${role}</div>`).join("");
    sections.push(`<div class="contract-section"><div class="section-label">Approval Required</div><div class="approval-chain">${chainHtml}</div></div>`);
  }

  sections.push(`<div class="contract-section"><div class="section-label">Compliance</div><div class="compliance-tags"><span class="tag">CoFI Act ✓</span><span class="tag">NZ Privacy Act ✓</span><span class="tag">FHIR R4 ✓</span><span class="tag">AWS Sydney ✓</span></div></div>`);

  card.innerHTML = `
    <div id="contractStatus" class="${statusClass}">${statusText}</div>
    <div class="contract-title">${title}</div>
    <div class="contract-subtitle">${subtitle}</div>
    ${sections.join("")}
    <div class="contract-footer">
      <div class="audit-note">${draft.audit_note || "AI-generated — all values sourced from Rules Engine and HPI. No data was invented."}</div>
      <div class="confirm-actions" id="confirmActions" style="display:${awaitingConfirm?"flex":"none"}">
        <button class="btn-reject" onclick="rejectContract()">Reject</button>
        <button class="btn-confirm" onclick="confirmContract()">Confirm &amp; Submit for Approval</button>
      </div>
    </div>`;

  document.getElementById("previewHint").textContent = isAmendment
    ? "Amendment draft ready — review changes and confirm"
    : isRenewal ? "Renewal draft ready — review terms and confirm"
    : "Draft ready — review and confirm below";
}

function renderRateSchedule(model, schedule) {
  if (!schedule) return '<div class="rate-row"><span class="rate-tier">No rate schedule</span></div>';
  if (model === "tiered" && schedule.tiers) {
    return schedule.tiers.map((t,i) => `<div class="rate-row"><span class="rate-tier">Tier ${i+1}: ${t.from}–${t.to??"∞"} procedures</span><span class="rate-amount">$${Number(t.rate).toLocaleString()} NZD</span></div>`).join("");
  }
  if (model === "ffs" || (schedule.rate !== undefined && !schedule.threshold)) {
    return `<div class="rate-row"><span class="rate-tier">Fixed rate (Fee-for-Service)</span><span class="rate-amount">$${Number(schedule.rate).toLocaleString()} NZD</span></div>`;
  }
  if (model === "staircase" && schedule.threshold !== undefined) {
    const ytd = schedule.ytd_volume || 0;
    const flipped = ytd >= schedule.threshold;
    const staircaseMsg = flipped
      ? `⚡ Threshold CROSSED — ${ytd} procedures YTD. Rate locked at $${Number(schedule.rate_after).toLocaleString()} for remainder of year.`
      : `${ytd} of ${schedule.threshold} procedures — threshold not yet reached`;
    return `<div class="rate-row${flipped?"":" rate-row-active"}"><span class="rate-tier">Claims 1–${schedule.threshold} <em>(pre-threshold)</em></span><span class="rate-amount${flipped?" rate-crossed":""}">$${Number(schedule.rate_before).toLocaleString()} NZD</span></div><div class="rate-row${flipped?" rate-row-active":""}"><span class="rate-tier">Claims ${schedule.threshold+1}+ <em>(post-threshold)</em></span><span class="rate-amount">$${Number(schedule.rate_after).toLocaleString()} NZD</span></div><div class="staircase-status${flipped?" flipped":""}">${staircaseMsg}</div>`;
  }
  if (model === "matrix" && schedule.values) {
    return Object.entries(schedule.values).map(([key,rate]) => { const [f,cx]=key.split(":"); return `<div class="rate-row"><span class="rate-tier">Facility ${f} · ${cx} complexity</span><span class="rate-amount">$${Number(rate).toLocaleString()} NZD</span></div>`; }).join("");
  }
  return '<div class="rate-row"><span class="rate-tier">See contract for rate details</span></div>';
}

function renderRateSummaryText(summary) {
  if (!summary) return '<div class="rate-row"><span class="rate-tier">—</span></div>';
  return `<div class="rate-row"><span class="rate-tier">${summary}</span></div>`;
}

function renderProposedChanges(changes) {
  if (!changes) return '<div class="rate-row"><span class="rate-tier">No changes specified</span></div>';
  if (changes.tiers) return changes.tiers.map((t,i) => `<div class="rate-row proposed-row"><span class="rate-tier">Tier ${i+1}: ${t.from}–${t.to??"∞"} procedures</span><span class="rate-amount">$${Number(t.rate).toLocaleString()} NZD</span></div>`).join("");
  if (changes.rate !== undefined) return `<div class="rate-row proposed-row"><span class="rate-tier">New flat rate</span><span class="rate-amount">$${Number(changes.rate).toLocaleString()} NZD</span></div>`;
  if (changes.annual_cap !== undefined) return `<div class="rate-row proposed-row"><span class="rate-tier">New volume cap</span><span class="rate-amount">${changes.annual_cap} procedures/year</span></div>`;
  return `<div class="rate-row proposed-row"><span class="rate-tier">${escapeHtml(JSON.stringify(changes))}</span></div>`;
}

function confirmContract() {
  document.getElementById("contractStatus").textContent = "CONFIRMED — Submitted for Approval";
  document.getElementById("contractStatus").className = "contract-status confirmed";
  document.getElementById("confirmActions").style.display = "none";
  document.getElementById("previewHint").textContent = "Submitted for approval";
  appendAIMessage("Contract confirmed and submitted for approval. The Contracting Manager has been notified. An immutable audit entry has been logged with your confirmation, timestamp, and the full contract terms. Contract ID: **" + (currentDraft?.contract_id || currentDraft?.amendment_id || currentDraft?.renewal_id || "DRAFT") + "**", []);
}

function rejectContract() {
  document.getElementById("contractStatus").textContent = "REJECTED";
  document.getElementById("contractStatus").className = "contract-status rejected";
  document.getElementById("confirmActions").style.display = "none";
  document.getElementById("previewHint").textContent = "Draft rejected";
  appendAIMessage("Understood — draft rejected. Nothing has been saved. Tell me what you'd like to change and I'll revise it.", []);
}

// ─── Voice ────────────────────────────────────────────────────────────────────

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const btn = document.getElementById("micBtn");
    if (btn) { btn.style.opacity = "0.3"; btn.title = "Voice not supported (use Chrome or Safari)"; }
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = false; recognition.interimResults = true; recognition.lang = "en-NZ";
  recognition.onresult = (e) => {
    const t = Array.from(e.results).map(r => r[0].transcript).join("");
    const inp = document.getElementById("messageInput");
    if (inp) { inp.value = t; autoResize(inp); }
    if (e.results[e.results.length-1].isFinal) stopVoice();
  };
  recognition.onend  = () => stopVoice();
  recognition.onerror = (e) => { setVoiceStatus(e.error==="no-speech"?"No speech detected.":`Error: ${e.error}`); stopVoice(); };
}

function toggleVoice() { isListening ? stopVoice() : startVoice(); }
function startVoice()  { if (!recognition) return; isListening=true; recognition.start(); document.getElementById("micBtn")?.classList.add("listening"); setVoiceStatus("Listening..."); }
function stopVoice()   { if (!recognition) return; isListening=false; try{recognition.stop();}catch(_){} document.getElementById("micBtn")?.classList.remove("listening"); setVoiceStatus(""); }
function setVoiceStatus(msg) { const el=document.getElementById("voiceStatus"); if(el) el.textContent=msg; }

// ─── Chat ─────────────────────────────────────────────────────────────────────

function handleKey(e)    { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }
function autoResize(el)  { el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,120)+"px"; }

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;
  input.value=""; autoResize(input); stopVoice();
  appendUserMessage(text);
  const thinkingEl = appendThinking();
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/chat`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({message:text,session_id:SESSION_ID}) });
    const data = await res.json();
    thinkingEl.remove();
    await renderAIResponse(data);
  } catch {
    thinkingEl.remove();
    appendAIMessage("Sorry, I couldn't reach the AI service. Make sure the backend is running on port 8001.", []);
  }
  if (sendBtn) sendBtn.disabled = false;
  scrollToBottom();
}

function scrollToBottom() { const el=document.getElementById("chatMessages"); if(el) setTimeout(()=>el.scrollTop=el.scrollHeight,50); }

function appendUserMessage(text) {
  const el = document.createElement("div");
  el.className = "message user";
  el.innerHTML = `<div class="message-avatar">You</div><div class="message-body"><div class="message-text">${escapeHtml(text)}</div><div class="message-time">${now()}</div></div>`;
  document.getElementById("chatMessages").appendChild(el);
  scrollToBottom();
}

function appendThinking() {
  const el = document.createElement("div");
  el.className = "message ai";
  el.innerHTML = `<div class="message-avatar">AI</div><div class="message-body"><div class="thinking"><div class="thinking-dots"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>Processing...</div></div>`;
  document.getElementById("chatMessages").appendChild(el);
  scrollToBottom();
  return el;
}

async function renderAIResponse(data) {
  const container = document.getElementById("chatMessages");
  if (data.tool_calls?.length > 0) {
    const toolContainer = document.createElement("div");
    toolContainer.className = "tool-calls";
    container.appendChild(toolContainer);
    for (const tc of data.tool_calls) {
      await delay(400);
      const chip = document.createElement("div");
      chip.className = `tool-chip ${tc.result?.error ? "error" : "success"}`;
      chip.innerHTML = `<span class="tool-name">${tc.tool}()</span><span class="tool-summary">${escapeHtml(tc.summary)}</span>`;
      toolContainer.appendChild(chip);
      scrollToBottom();
    }
    await delay(300);
  }
  const el = document.createElement("div");
  el.className = "message ai";
  el.innerHTML = `<div class="message-avatar">AI</div><div class="message-body"><div class="message-text">${markdownToHtml(data.ai_message)}</div><div class="message-time">${now()}</div></div>`;
  container.appendChild(el);
  if (data.contract_draft) {
    currentDraft = data.contract_draft;
    const fiCall = (data.tool_calls||[]).find(tc => tc.tool==="get_financial_impact");
    renderContractPreview(data.contract_draft, data.awaiting_confirmation, fiCall ? fiCall.result : null);
  }
  scrollToBottom();
}

function appendAIMessage(text, toolCalls) {
  renderAIResponse({ ai_message: text, tool_calls: toolCalls||[], awaiting_confirmation: false, contract_draft: null });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function now()     { return new Date().toLocaleTimeString("en-NZ", {hour:"2-digit",minute:"2-digit"}); }
function escapeHtml(str) { return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function markdownToHtml(text) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/`(.+?)`/g,"<code>$1</code>")
    .replace(/\n/g,"<br>");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
