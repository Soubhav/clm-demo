const API_BASE = "http://localhost:8001";
const SESSION_ID = "demo-" + Math.random().toString(36).slice(2, 8);

let isListening = false;
let recognition = null;
let currentDraft = null;
let selectedContractId = null;
let selectedNegotiationId = null;
let expandedClauseId = null;
let selectedTemplateId = null;
let selectedProviderId = null;
let clauseCategory = "All";
let contractStatusFilter = "All";
let templateCategory = "All";
let networkFilter = "All";

// ─── Synthetic data ───────────────────────────────────────────────────────────

const CONTRACTS = [
  { id:"CTR-001", provider:"Auckland Surgical Centre",     city:"Auckland",      contractType:"Surgical — Elective", procedure:"Total Knee Replacement", hpiOrgId:"G00001-K", procedureCode:"NZACS-1471", accCode:"SA11106", model:"TIERED",    rateRange:"$3,600–$4,200", cap:150, status:"EXPIRING",     effectiveDate:"2025-08-01", expiry:"2026-07-31", ytd:94,  networkTier:"preferred", relationshipOwner:"Sarah Mitchell",
    tiers:[{from:1,to:50,rate:4200},{from:51,to:100,rate:3900},{from:101,to:null,rate:3600}] },
  { id:"CTR-002", provider:"Wellington Orthopaedics",      city:"Wellington",    contractType:"Surgical — Elective", procedure:"Total Knee Replacement", hpiOrgId:"G00012-M", procedureCode:"NZACS-1471", accCode:"SA11106", model:"FFS",       rateRange:"$4,050",         cap:80,  status:"ACTIVE",       effectiveDate:"2025-09-01", expiry:"2026-08-31", ytd:61,  networkTier:"preferred", relationshipOwner:"James Okonkwo",
    rate:4050 },
  { id:"CTR-003", provider:"Christchurch Surgical Centre", city:"Christchurch",  contractType:"Surgical — Elective", procedure:"Knee Arthroscopy",       hpiOrgId:"G00023-P", procedureCode:"NZACS-1422", accCode:"SA11104", model:"FFS",       rateRange:"$2,800",         cap:100, status:"ACTIVE",       effectiveDate:"2025-10-01", expiry:"2026-09-30", ytd:43,  networkTier:"preferred", relationshipOwner:"Sarah Mitchell",
    rate:2800 },
  { id:"CTR-004", provider:"Auckland Surgical Centre",     city:"Auckland",      contractType:"Surgical — Elective", procedure:"Knee Arthroscopy",       hpiOrgId:"G00001-K", procedureCode:"NZACS-1422", accCode:"SA11104", model:"TIERED",    rateRange:"$2,400–$2,900",  cap:200, status:"ACTIVE",       effectiveDate:"2025-01-01", expiry:"2026-12-31", ytd:112, networkTier:"preferred", relationshipOwner:"Sarah Mitchell",
    tiers:[{from:1,to:75,rate:2900},{from:76,to:150,rate:2600},{from:151,to:null,rate:2400}] },
  { id:"CTR-005", provider:"Wellington Regional Hospital", city:"Wellington",    contractType:"Surgical — Elective", procedure:"Total Knee Replacement", hpiOrgId:"G00045-R", procedureCode:"NZACS-1471", accCode:"SA11106", model:"MATRIX",    rateRange:"$2,800–$5,000",  cap:120, status:"ACTIVE",       effectiveDate:"2026-07-01", expiry:"2027-06-30", ytd:38,  networkTier:"preferred", relationshipOwner:"James Okonkwo",
    matrix:{"A:high":5000,"A:low":3500,"B:high":4200,"B:low":2800} },
  { id:"CTR-006", provider:"Auckland Surgical Centre",     city:"Auckland",      contractType:"Surgical — Elective", procedure:"Total Hip Replacement",  hpiOrgId:"G00001-K", procedureCode:"NZACS-1502", accCode:"SA11109", model:"STAIRCASE", rateRange:"$4,900–$5,800",  cap:120, status:"ACTIVE",       effectiveDate:"2026-07-01", expiry:"2027-06-30", ytd:107, networkTier:"preferred", relationshipOwner:"Sarah Mitchell",
    threshold:100, rateBefore:5800, rateAfter:4900 },
  { id:"CTR-007", provider:"Dunedin Surgical Group",       city:"Dunedin",       contractType:"Surgical — Elective", procedure:"Knee Arthroscopy",       hpiOrgId:"G00067-T", procedureCode:"NZACS-1422", accCode:"SA11104", model:"FFS",       rateRange:"$2,400",         cap:60,  status:"NEGOTIATION",  effectiveDate:"2027-04-01", expiry:"2027-03-31", ytd:0,   networkTier:"standard",   relationshipOwner:"Sarah Mitchell",
    rate:2400 },
  { id:"CTR-DRAFT", provider:"Christchurch Surgical Centre",city:"Christchurch", contractType:"Surgical — Elective", procedure:"Total Knee Replacement", hpiOrgId:"G00023-P", procedureCode:"NZACS-1471", accCode:"SA11106", model:"TIERED",    rateRange:"$3,420–$3,990",  cap:120, status:"DRAFT",        effectiveDate:"2026-07-01", expiry:"2027-06-30", ytd:0,   networkTier:"preferred", relationshipOwner:"Sarah Mitchell",
    tiers:[{from:1,to:40,rate:3990},{from:41,to:80,rate:3705},{from:81,to:null,rate:3420}] },
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

const PROVIDERS = [
  { id:"PRV-001", name:"Auckland Surgical Centre",     city:"Auckland",     type:"Surgical Centre",   tier:"gold",     status:"contracted",     contracts:3, contact:"Michael Thompson", contactEmail:"m.thompson@aucklandsurgical.co.nz",   contactPhone:"+64 9 555 0100", hpiOrgId:"G00001-K", hpiFacilityCode:"F00034", nzbn:"9429041000001", specialty:"Orthopaedics",           onboardingDate:"2019-03-15", relationshipOwner:"Sarah Mitchell",  annualVolume:312, ytdSpend:1284600, hpiStatus:"Active", hpiExpiry:"2027-06-30" },
  { id:"PRV-002", name:"Wellington Orthopaedics",      city:"Wellington",   type:"Specialist Clinic", tier:"gold",     status:"contracted",     contracts:1, contact:"Dr. Sarah Lee",    contactEmail:"s.lee@wellingtonortho.co.nz",        contactPhone:"+64 4 555 0200", hpiOrgId:"G00012-M", hpiFacilityCode:"F00089", nzbn:"9429041000002", specialty:"Orthopaedics",           onboardingDate:"2020-08-20", relationshipOwner:"James Okonkwo", annualVolume:88,  ytdSpend:356400,  hpiStatus:"Active", hpiExpiry:"2027-03-31" },
  { id:"PRV-003", name:"Christchurch Surgical Centre", city:"Christchurch", type:"Surgical Centre",   tier:"silver",   status:"in-negotiation", contracts:0, contact:"Dr. James Chen",   contactEmail:"j.chen@chcsurgical.co.nz",           contactPhone:"+64 3 555 0300", hpiOrgId:"G00023-P", hpiFacilityCode:"F00112", nzbn:"9429041000003", specialty:"Orthopaedics",           onboardingDate:"2022-11-01", relationshipOwner:"Sarah Mitchell",  annualVolume:0,   ytdSpend:0,       hpiStatus:"Active", hpiExpiry:"2026-12-31" },
  { id:"PRV-004", name:"Wellington Regional Hospital", city:"Wellington",   type:"Hospital",          tier:"platinum", status:"contracted",     contracts:1, contact:"Helen Park",       contactEmail:"h.park@wrh.health.nz",               contactPhone:"+64 4 555 0400", hpiOrgId:"G00045-R", hpiFacilityCode:"F00156", nzbn:"9429041000004", specialty:"Multi-Specialty",        onboardingDate:"2018-06-15", relationshipOwner:"James Okonkwo", annualVolume:156, ytdSpend:780000,  hpiStatus:"Active", hpiExpiry:"2028-01-31" },
  { id:"PRV-005", name:"Dunedin Surgical Group",       city:"Dunedin",      type:"Surgical Centre",   tier:"standard", status:"in-negotiation", contracts:0, contact:"Dr. Andrew Wu",    contactEmail:"a.wu@dunedinsurgical.co.nz",         contactPhone:"+64 3 555 0500", hpiOrgId:"G00067-T", hpiFacilityCode:"F00198", nzbn:"9429041000005", specialty:"Orthopaedics",           onboardingDate:"2024-02-28", relationshipOwner:"Sarah Mitchell",  annualVolume:0,   ytdSpend:0,       hpiStatus:"Active", hpiExpiry:"2027-09-30" },
  { id:"PRV-006", name:"Hamilton Health Partners",     city:"Hamilton",     type:"Specialist Clinic", tier:"standard", status:"lead",           contracts:0, contact:"Dr. Maria Santos", contactEmail:"m.santos@hamiltonhealth.co.nz",      contactPhone:"+64 7 555 0600", hpiOrgId:"G00089-W", hpiFacilityCode:"F00234", nzbn:"9429041000006", specialty:"Specialist Outpatient",  onboardingDate:null,         relationshipOwner:"James Okonkwo", annualVolume:0,   ytdSpend:0,       hpiStatus:"Pending", hpiExpiry:null },
];

const NEGOTIATIONS = [
  { id:"NEG-001", contractId:"CTR-DRAFT-CHC-001", provider:"Christchurch Surgical Centre", contractType:"Surgical — Elective", hpiOrgId:"G00023-P", procedure:"Total Knee Replacement", round:2, status:"in-progress", lastActivity:"13 May 2026",
    collaborators:[
      { name:"Sarah Mitchell", role:"Contract Manager",        initials:"SM", online:true,  color:"#1e40af" },
      { name:"James Okonkwo",  role:"Senior Contract Manager", initials:"JO", online:false, color:"#1e40af" },
    ],
    votes:{ approve:1, reject:0, pending:1 },
    changes:[
      { id:"CH-001", type:"rate-change",   field:"Tier 1 Rate (Claims 1–40)",  from:"$3,990",             to:"$4,100",               proposedBy:"Provider (G00023-P)",     proposerType:"provider", status:"pending",  note:"Provider requests Tier 1 alignment with Auckland Surgical rates" },
      { id:"CH-002", type:"clause-change", field:"Termination Notice Period",   from:"60 days written notice", to:"90 days written notice", proposedBy:"Provider (G00023-P)", proposerType:"provider", status:"accepted", note:"Accepted — aligns with standard clause CL-002" },
      { id:"CH-003", type:"cap-change",    field:"Annual Volume Cap",           from:"120 procedures/year",to:"140 procedures/year",  proposedBy:"Sarah Mitchell (Insurer)", proposerType:"insurer",  status:"rejected", note:"Provider rejects — cites OR capacity constraints for 2026/27" },
    ]
  },
  { id:"NEG-002", contractId:"CTR-005", provider:"Wellington Regional Hospital", contractType:"Surgical — Elective", hpiOrgId:"G00045-R", procedure:"Total Knee Replacement", round:1, status:"awaiting-response", lastActivity:"10 May 2026",
    collaborators:[
      { name:"James Okonkwo", role:"Senior Contract Manager", initials:"JO", online:true, color:"#1e40af" },
    ],
    votes:{ approve:0, reject:0, pending:1 },
    changes:[
      { id:"CH-004", type:"rate-change",   field:"Matrix Rate A:High · NZACS-1471", from:"$5,000", to:"$4,800", proposedBy:"James Okonkwo (Insurer)", proposerType:"insurer", status:"pending", note:"5-year volume growth justifies 4% rate reduction on highest complexity tier" },
      { id:"CH-005", type:"clause-change", field:"Claims Reporting Frequency",       from:"Quarterly",  to:"Monthly",  proposedBy:"James Okonkwo (Insurer)", proposerType:"insurer", status:"pending", note:"Required for IQVIA TMB real-time integration in Phase 2" },
    ]
  },
];

const TEMPLATES = [
  { id:"TPL-001", name:"Surgical — Elective", category:"Surgical",
    description:"Standard elective surgical procedures for contracted surgical centres and hospitals.",
    tags:["elective","volume-cap","tiered","ACC-funded","NZACS","orthopaedics"],
    model:"TIERED", baseRate:4000, clauses:8, lastUpdated:"Mar 2026", usedIn:4,
    applicableTo:"Surgical Centres, Hospitals",
    pricingNote:"Base rate × network tier multiplier. Platinum 1.2× · Gold 1.1× · Silver 1.05× · Standard 1.0×",
    clauseList:["Standard Indemnity — Bilateral","Termination for Convenience — 90 Days","Patient Data — NZ Privacy Act 2020","Wait Time SLA — Elective Procedures","Monthly Claims Reporting Obligation","Rate Adjustment — CPI Indexation","Dispute Resolution — Mediation First","Clinical Negligence Exclusion"] },
  { id:"TPL-002", name:"Surgical — Acute / Emergency", category:"Surgical",
    description:"Acute and emergency surgical procedures including after-hours and ED components.",
    tags:["acute","emergency","staircase","after-hours","hospital","ACC"],
    model:"STAIRCASE", baseRate:5000, clauses:9, lastUpdated:"Jan 2026", usedIn:1,
    applicableTo:"Hospitals, Level 3+ Facilities",
    pricingNote:"Staircase — pre-threshold $5,000 · post-threshold $4,200. After-hours surcharge 15%.",
    clauseList:["Standard Indemnity — Bilateral","Termination for Convenience — 90 Days","Patient Data — NZ Privacy Act 2020","After-Hours Surcharge Clause","Wait Time SLA — Emergency Triage","Monthly Claims Reporting Obligation","Rate Adjustment — CPI Indexation","Dispute Resolution — Mediation First","Clinical Negligence Exclusion"] },
  { id:"TPL-003", name:"Specialist Outpatient", category:"Specialist",
    description:"First specialist assessments (FSA) and ongoing specialist consultations.",
    tags:["outpatient","FFS","FSA","specialist-consultation","referral"],
    model:"FFS", baseRate:350, clauses:7, lastUpdated:"Feb 2026", usedIn:2,
    applicableTo:"Specialist Clinics, Private Hospitals",
    pricingNote:"Flat FFS per consultation. FSA $350 · Follow-up $280 · Procedure add-on rates in Schedule 1.",
    clauseList:["Standard Indemnity — Bilateral","Termination for Convenience — 90 Days","Patient Data — NZ Privacy Act 2020","FSA Wait Time SLA","Monthly Claims Reporting Obligation","Rate Adjustment — CPI Indexation","Dispute Resolution — Mediation First"] },
  { id:"TPL-004", name:"Radiology & Diagnostics", category:"Diagnostics",
    description:"Imaging, radiology, and diagnostic procedure contracts.",
    tags:["radiology","imaging","matrix","IQVIA-TMB","diagnostics","MRI","CT"],
    model:"MATRIX", baseRate:280, clauses:7, lastUpdated:"Apr 2026", usedIn:1,
    applicableTo:"Radiology Practices, Imaging Centres",
    pricingNote:"Matrix pricing by modality (X-ray / CT / MRI / PET) × complexity. See Schedule 1.",
    clauseList:["Standard Indemnity — Bilateral","Termination for Convenience — 90 Days","Patient Data — NZ Privacy Act 2020","Equipment Calibration and Quality Standards","Monthly Claims Reporting Obligation","Rate Adjustment — CPI Indexation","Dispute Resolution — Mediation First"] },
  { id:"TPL-005", name:"Allied Health", category:"Allied Health",
    description:"Physiotherapy, occupational therapy, speech language therapy and related services.",
    tags:["allied-health","physiotherapy","ACC","FFS","session-cap","OT","SLT"],
    model:"FFS", baseRate:120, clauses:6, lastUpdated:"Feb 2026", usedIn:3,
    applicableTo:"Allied Health Providers, Community Clinics",
    pricingNote:"FFS per session. Standard $120 · Extended $180 · Group $60/head. ACC surcharge applies.",
    clauseList:["Standard Indemnity — Bilateral","Termination for Convenience — 90 Days","Patient Data — NZ Privacy Act 2020","ACC Co-Payment Compliance","Monthly Claims Reporting Obligation","Dispute Resolution — Mediation First"] },
  { id:"TPL-006", name:"Mental Health & Wellbeing", category:"Mental Health",
    description:"Psychology, psychiatry, counselling, and mental health and addictions services.",
    tags:["mental-health","psychology","FFS","session-cap","psychiatry","counselling"],
    model:"FFS", baseRate:200, clauses:8, lastUpdated:"Mar 2026", usedIn:2,
    applicableTo:"Psychology Practices, Mental Health Clinics",
    pricingNote:"FFS per session. Psychology $200 · Psychiatry $380. Annual session cap per member applies.",
    clauseList:["Standard Indemnity — Bilateral","Termination for Convenience — 90 Days","Patient Data — NZ Privacy Act 2020","Session Cap — Annual Benefit Limit","Crisis Response Protocol","Monthly Claims Reporting Obligation","Rate Adjustment — CPI Indexation","Dispute Resolution — Mediation First"] },
];

const USERS = [
  { id:"USR-001", name:"Sarah Mitchell", email:"s.mitchell@healthinsurer.co.nz", role:"contract_manager",        roleLabel:"Contract Manager",        status:"active",   lastLogin:"18 May 2026, 09:14", initials:"SM", avatarColor:"#1e40af" },
  { id:"USR-002", name:"James Okonkwo",  email:"j.okonkwo@healthinsurer.co.nz",  role:"senior_contract_manager", roleLabel:"Senior Contract Manager", status:"active",   lastLogin:"18 May 2026, 08:47", initials:"JO", avatarColor:"#1e40af" },
  { id:"USR-003", name:"Lisa Chen",      email:"l.chen@healthinsurer.co.nz",      role:"admin",                   roleLabel:"Administrator",           status:"active",   lastLogin:"17 May 2026, 16:33", initials:"LC", avatarColor:"#7c3aed" },
  { id:"USR-004", name:"David Park",     email:"d.park@healthinsurer.co.nz",      role:"viewer",                  roleLabel:"Viewer",                  status:"active",   lastLogin:"16 May 2026, 11:20", initials:"DP", avatarColor:"#71717a" },
  { id:"USR-005", name:"Emma Walsh",     email:"e.walsh@healthinsurer.co.nz",     role:"contract_manager",        roleLabel:"Contract Manager",        status:"inactive", lastLogin:"02 Apr 2026, 14:05", initials:"EW", avatarColor:"#1e40af" },
];

const ROLES = [
  { id:"admin",                   name:"Administrator",           color:"#7c3aed", userCount:1,
    permissions:[{name:"Create Contracts",allowed:true},{name:"Approve Contracts",allowed:true},{name:"Manage Users & Roles",allowed:true},{name:"System Configuration",allowed:true},{name:"View All Data",allowed:true},{name:"Delete Records",allowed:true}] },
  { id:"senior_contract_manager", name:"Senior Contract Manager", color:"#2563eb", userCount:1,
    permissions:[{name:"Create Contracts",allowed:true},{name:"Approve Contracts",allowed:true},{name:"Manage Users & Roles",allowed:false},{name:"System Configuration",allowed:false},{name:"View All Data",allowed:true},{name:"Delete Records",allowed:false}] },
  { id:"contract_manager",        name:"Contract Manager",        color:"#0891b2", userCount:2,
    permissions:[{name:"Create Contracts",allowed:true},{name:"Approve Contracts",allowed:false},{name:"Manage Users & Roles",allowed:false},{name:"System Configuration",allowed:false},{name:"View All Data",allowed:false},{name:"Delete Records",allowed:false}] },
  { id:"viewer",                  name:"Viewer",                  color:"#71717a", userCount:1,
    permissions:[{name:"Create Contracts",allowed:false},{name:"Approve Contracts",allowed:false},{name:"Manage Users & Roles",allowed:false},{name:"System Configuration",allowed:false},{name:"View All Data",allowed:false},{name:"Delete Records",allowed:false}] },
];

const INTEGRATIONS = [
  { id:"INT-001", name:"DocuSign",     category:"E-Signature",       status:"connected",    description:"Electronic signature for all executed contracts",                    lastSync:"18 May 2026" },
  { id:"INT-002", name:"IQVIA TMB",    category:"Claims Data",       status:"connected",    description:"Real-time claims data feed for utilization and adjudication",        lastSync:"18 May 2026" },
  { id:"INT-003", name:"NZ HPI",       category:"Provider Validation",status:"connected",   description:"Health Provider Index — validates provider registration status",      lastSync:"18 May 2026" },
  { id:"INT-004", name:"Salesforce CRM",category:"CRM",             status:"disconnected", description:"Customer relationship data sync for provider management",            lastSync:"Never" },
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
      dashboard:    renderDashboard,
      contracts:    renderContracts,
      approvals:    renderApprovals,
      network:      renderNetworkList,
      clauses:      renderClauseLibrary,
      negotiation:  renderNegotiation,
      templates:    renderTemplateRepository,
      integrations: renderIntegrations,
      admin:        renderAdmin,
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
  const activeCount = CONTRACTS.filter(c => c.status === "ACTIVE").length;

  document.getElementById("screen-dashboard").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div>
          <div class="screen-title">Good morning, Sarah.</div>
          <div class="screen-sub">Monday, 18 May 2026 · Here is your contract portfolio at a glance.</div>
        </div>
        <div class="screen-actions">
          <button class="btn-sm outline" onclick="showScreen('network')">+ New Provider</button>
          <button class="btn-sm primary" onclick="showScreen('studio')">+ New Contract</button>
        </div>
      </div>
    </div>
    <div class="screen-body">
      <div class="stat-row">
        <div class="stat-card clickable" onclick="setContractStatusFilter('Active');showScreen('contracts')">
          <div class="stat-label">Active Contracts</div><div class="stat-value blue">${activeCount}</div><div class="stat-sub">Across 4 providers · click to view</div>
        </div>
        <div class="stat-card clickable" onclick="showScreen('approvals')">
          <div class="stat-label">Pending Approval</div><div class="stat-value amber">${pendingApprovals.length}</div><div class="stat-sub">Awaiting your action · click to review</div>
        </div>
        <div class="stat-card clickable" onclick="setContractStatusFilter('All');showScreen('contracts')">
          <div class="stat-label">Utilization Alerts</div><div class="stat-value red">${alertContracts.length}</div><div class="stat-sub">Above 75% of cap · click to view</div>
        </div>
        <div class="stat-card clickable" onclick="setContractStatusFilter('Expiring');showScreen('contracts')">
          <div class="stat-label">Expiring ≤ 90 days</div><div class="stat-value amber">1</div><div class="stat-sub">CTR-001 · 74 days left · click to view</div>
        </div>
      </div>
      <div class="dashboard-grid">
        <div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Utilization Alerts</span><span class="section-card-count">${alertContracts.length} contracts above 75%</span></div>
            ${alertContracts.map(c => {
              const level = c.pct >= 90 ? "critical" : "warning";
              const weeksLeft = Math.round(((c.cap - c.ytd) / (c.ytd / 10)) * 4.33);
              return `<div class="alert-row"><div class="alert-info"><div class="alert-title">${c.provider}</div><div class="alert-sub">${c.id} · ${c.hpiOrgId} · ${c.model}</div><div class="alert-bar-wrap"><div class="alert-bar ${level}" style="width:${c.pct}%"></div></div></div><div class="alert-meta"><div class="alert-pct ${level}">${c.pct}%</div><div class="alert-days">${c.ytd}/${c.cap} · ~${weeksLeft}w left</div><button class="btn-sm outline" style="margin-top:6px" onclick="showScreen('contracts')">View</button></div></div>`;
            }).join("")}
          </div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Expiring Contracts</span><span class="section-card-count">within 90 days</span></div>
            ${expiring.map(c => {
              const days = Math.round((new Date(c.expiry) - new Date("2026-05-18")) / 86400000);
              const urgency = days <= 30 ? "critical" : days <= 60 ? "warning" : "ok";
              return `<div class="alert-row"><div class="alert-info"><div class="alert-title">${c.provider}</div><div class="alert-sub">${c.id} · ${c.hpiOrgId} · Expires ${c.expiry}</div></div><div class="alert-meta"><div class="alert-pct ${urgency}">${days}d</div><div class="alert-days">remaining</div><button class="btn-sm outline" style="margin-top:6px" onclick="showScreen('studio')">Renew</button></div></div>`;
            }).join("")}
          </div>
        </div>
        <div>
          <div class="section-card">
            <div class="section-card-header"><span class="section-card-title">Pending Approvals</span><span class="section-card-count">${pendingApprovals.length} awaiting action</span></div>
            ${pendingApprovals.map(a => `<div class="approval-row"><div style="flex-shrink:0"><span class="status-pill ${a.type==="New Contract"?"draft":"pending"}">${a.type}</span></div><div class="approval-info"><div class="approval-title">${a.provider}</div><div class="approval-sub">${a.contractId} · $${a.annualValue.toLocaleString()} est. annual</div></div><button class="btn-sm primary" style="flex-shrink:0" onclick="showScreen('approvals')">Review</button></div>`).join("")}
          </div>
        </div>
      </div>
      <div class="dashboard-bottom">
        <div class="section-card">
          <div class="section-card-header"><span class="section-card-title">Recent Activity</span><span class="section-card-count">Today · AI Studio</span></div>
          ${ACTIVITY.map(a => `<div class="activity-row"><div class="activity-dot" style="background:var(--${a.dot})"></div><div class="activity-body"><div class="activity-text">${a.text}</div><div class="activity-time">${a.time} · AI Studio</div></div></div>`).join("")}
        </div>
      </div>
    </div>`;
}

// ─── Screen 3: Contract Registry ──────────────────────────────────────────────

function renderContracts() {
  const statusCounts = {
    All: CONTRACTS.length,
    Active: CONTRACTS.filter(c=>c.status==="ACTIVE").length,
    Expiring: CONTRACTS.filter(c=>c.status==="EXPIRING").length,
    Draft: CONTRACTS.filter(c=>c.status==="DRAFT").length,
    Negotiation: CONTRACTS.filter(c=>c.status==="NEGOTIATION").length,
  };
  const tabsHtml = ["All","Active","Expiring","Draft","Negotiation"].map(s =>
    `<button class="status-tab ${contractStatusFilter===s?"active":""}" onclick="setContractStatusFilter('${s}')">${s} <span class="status-tab-count">${statusCounts[s]}</span></button>`
  ).join("");
  document.getElementById("screen-contracts").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Contract Registry</div><div class="screen-sub">${CONTRACTS.length} contracts — click a row to view details and manage</div></div>
        <button class="btn-sm primary" onclick="showScreen('studio')">+ Draft New Contract</button>
      </div>
    </div>
    <div class="status-tabs">${tabsHtml}</div>
    <div class="filter-bar">
      <div class="search-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Search by provider, HPI code, or contract ID..." oninput="filterContracts(this.value)" /></div>
      <select class="filter-select" onchange="filterContracts('',this.value)"><option value="">All models</option><option value="TIERED">Tiered</option><option value="FFS">FFS</option><option value="MATRIX">Matrix</option><option value="STAIRCASE">Staircase</option></select>
    </div>
    <div class="screen-body" style="padding-top:0">
      <div class="registry-layout">
        <div class="registry-left">
          <div class="contracts-table">
            <div class="table-header">
              <div class="th">ID</div>
              <div class="th">Provider</div>
              <div class="th">HPI Code</div>
              <div class="th">Contract Type</div>
              <div class="th">Effective</div>
              <div class="th">Expiry</div>
              <div class="th">Status</div>
            </div>
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
      <div class="td" style="font-weight:500">${c.provider.replace(" Centre","").replace(" Hospital","").replace(" Surgical","")}</div>
      <div class="td mono" style="color:var(--text-muted);font-size:11px">${c.hpiOrgId}</div>
      <div class="td muted">${c.contractType}</div>
      <div class="td muted">${c.effectiveDate}</div>
      <div class="td muted">${c.expiry}</div>
      <div class="td"><span class="status-pill ${c.status.toLowerCase()}">${c.status}</span></div>
    </div>`).join("");
}

function filterContracts(search, model) {
  const s = (search || "").toLowerCase();
  const m = model || document.querySelector(".filter-select")?.value || "";
  const filtered = CONTRACTS.filter(c => {
    const matchesStatus = contractStatusFilter === "All"
      || (contractStatusFilter === "Active"      && c.status === "ACTIVE")
      || (contractStatusFilter === "Expiring"    && c.status === "EXPIRING")
      || (contractStatusFilter === "Draft"       && c.status === "DRAFT")
      || (contractStatusFilter === "Negotiation" && c.status === "NEGOTIATION");
    return matchesStatus &&
      (!s || c.id.toLowerCase().includes(s) || c.provider.toLowerCase().includes(s) || c.hpiOrgId.toLowerCase().includes(s) || c.contractType.toLowerCase().includes(s)) &&
      (!m || c.model === m);
  });
  const rows = document.getElementById("contractRows");
  if (rows) rows.innerHTML = renderContractRows(filtered);
}

function setContractStatusFilter(filter) {
  contractStatusFilter = filter;
  renderedScreens.delete("contracts");
  renderContracts();
  renderedScreens.add("contracts");
}

function selectContract(id) {
  selectedContractId = id;
  const c = CONTRACTS.find(x => x.id === id);
  if (!c) return;
  document.querySelectorAll(".table-row").forEach(r => {
    r.classList.toggle("selected", r.getAttribute("onclick")?.includes(`'${id}'`));
  });
  const pct = Math.round((c.ytd / c.cap) * 100);
  const level = pct >= 90 ? "critical" : pct >= 75 ? "warning" : "ok";
  const days = Math.round((new Date(c.expiry) - new Date("2026-05-18")) / 86400000);
  let rateDetail = "";
  if (c.model === "TIERED") {
    rateDetail = c.tiers.map((t,i) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12.5px"><span style="color:var(--text-muted)">Tier ${i+1}: ${t.from}–${t.to??"∞"}</span><strong>$${t.rate.toLocaleString()} NZD</strong></div>`).join("");
  } else if (c.model === "FFS") {
    rateDetail = `<div style="font-size:14px;font-weight:700">$${c.rate.toLocaleString()} NZD <span style="font-size:12px;font-weight:400;color:var(--text-muted)">flat fee-for-service</span></div>`;
  } else if (c.model === "STAIRCASE") {
    rateDetail = `<div style="font-size:12.5px;display:flex;flex-direction:column;gap:5px"><div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">Claims 1–${c.threshold}</span><span style="${c.ytd>=c.threshold?"text-decoration:line-through;color:var(--text-muted)":"font-weight:700"}">$${c.rateBefore.toLocaleString()}</span></div><div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--text-muted)">Claims ${c.threshold+1}+</span><span style="${c.ytd>=c.threshold?"font-weight:700;color:var(--amber)":""}">$${c.rateAfter.toLocaleString()}</span></div>${c.ytd>=c.threshold?`<div style="font-size:11px;color:var(--amber);margin-top:3px;padding:3px 6px;background:var(--amber-bg);border-radius:4px">⚡ Threshold crossed at ${c.ytd} procedures</div>`:""}</div>`;
  } else if (c.model === "MATRIX") {
    rateDetail = Object.entries(c.matrix).map(([k,v]) => { const [f,cx]=k.split(":"); return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:12.5px"><span style="color:var(--text-muted)">Facility ${f} · ${cx} complexity</span><strong>$${v.toLocaleString()}</strong></div>`; }).join("");
  }
  const canSign = c.status === "DRAFT" || c.status === "NEGOTIATION";
  const signBtn = canSign
    ? `<button class="btn-sm success" onclick="sendForSignature('${c.id}')">Send for Signature</button>`
    : `<button class="btn-sm disabled" title="Already signed — contract is ${c.status}">Send for Signature</button>`;

  document.getElementById("contractDetail").innerHTML = `
    <div class="detail-panel" style="height:100%;overflow-y:auto">
      <div class="detail-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div>
            <div class="detail-title">${c.provider}</div>
            <div class="detail-sub">${c.id} · ${c.city}</div>
          </div>
          <span class="status-pill ${c.status.toLowerCase()}">${c.status}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Identifiers</div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">HPI Org ID</span><span style="font-family:var(--font-mono);font-weight:600;color:var(--blue)">${c.hpiOrgId}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Procedure Code</span><span style="font-family:var(--font-mono);font-weight:600">${c.procedureCode}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">ACC Code</span><span style="font-family:var(--font-mono);font-weight:600">${c.accCode}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Contract Type</span><span>${c.contractType}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Relationship Owner</span><span>${c.relationshipOwner}</span></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Pricing · <span style="font-weight:400">${c.model}</span></div>
        ${rateDetail}
      </div>
      <div class="detail-section">
        <div class="detail-label">YTD Utilization</div>
        <div class="util-bar-wrap" style="margin-bottom:6px"><div class="util-bar" style="width:${pct}%;background:var(--${level==="ok"?"green":level==="warning"?"amber":"red"})"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="font-weight:600">${c.ytd} of ${c.cap} procedures (${pct}%)</span>
          <span class="util-alert-badge ${level}">${level.toUpperCase()}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Contract Period</div>
        <div style="font-size:12.5px;display:flex;flex-direction:column;gap:3px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Effective</span><span>${c.effectiveDate}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Expiry</span><strong>${c.expiry} · ${days}d remaining</strong></div>
        </div>
      </div>
      <div class="detail-section" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-sm primary" onclick="showScreen('studio')">Amend in AI Studio</button>
        <button class="btn-sm outline" onclick="showScreen('studio')">Initiate Renewal</button>
        ${signBtn}
      </div>
    </div>`;
}

function sendForSignature(id) {
  const c = CONTRACTS.find(x => x.id === id);
  if (!c) return;
  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;bottom:24px;right:24px;background:#047857;color:white;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:9999;animation:fadeUp 0.3s ease";
  toast.textContent = `✓ Sent via DocuSign — ${c.provider} will receive the signing request`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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

// ─── Screen: Network List ─────────────────────────────────────────────────────

function renderNetworkList() {
  const contracted    = PROVIDERS.filter(p=>p.status==="contracted");
  const negotiating   = PROVIDERS.filter(p=>p.status==="in-negotiation");
  const leads         = PROVIDERS.filter(p=>p.status==="lead");
  const totalContracts= PROVIDERS.reduce((s,p)=>s+p.contracts,0);
  const filtered = networkFilter === "All" ? PROVIDERS
    : networkFilter === "contracted"    ? contracted
    : networkFilter === "in-negotiation"? negotiating
    : leads;

  document.getElementById("screen-network").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Provider Network</div><div class="screen-sub">${PROVIDERS.length} providers — contracted, in negotiation, and leads</div></div>
        <button class="btn-sm primary" onclick="alert('Add Provider — validates against NZ HPI in Phase 2')">+ Add Provider</button>
      </div>
    </div>
    <div class="screen-body">
      <div class="stat-row">
        <div class="stat-card clickable ${networkFilter==="contracted"?"":""}" onclick="networkFilter='contracted';renderNetworkList()">
          <div class="stat-label">Contracted</div><div class="stat-value green">${contracted.length}</div><div class="stat-sub">Active network · click to filter</div>
        </div>
        <div class="stat-card clickable" onclick="networkFilter='in-negotiation';renderNetworkList()">
          <div class="stat-label">In Negotiation</div><div class="stat-value amber">${negotiating.length}</div><div class="stat-sub">Contract in progress · click to filter</div>
        </div>
        <div class="stat-card clickable" onclick="networkFilter='lead';renderNetworkList()">
          <div class="stat-label">Leads</div><div class="stat-value blue">${leads.length}</div><div class="stat-sub">Prospective · click to filter</div>
        </div>
        <div class="stat-card clickable" onclick="networkFilter='All';renderNetworkList()">
          <div class="stat-label">Total Contracts</div><div class="stat-value">${totalContracts}</div><div class="stat-sub">Across all providers · show all</div>
        </div>
      </div>
      <div class="network-layout">
        <div class="network-left">
          <div class="section-card" style="overflow:hidden">
            <div class="section-card-header">
              <span class="section-card-title">${networkFilter === "All" ? "All Providers" : networkFilter === "contracted" ? "Contracted" : networkFilter === "in-negotiation" ? "In Negotiation" : "Leads"}</span>
              <span class="section-card-count">${filtered.length} providers</span>
            </div>
            ${filtered.map(p => `
              <div class="provider-row ${selectedProviderId===p.id?"selected":""}" onclick="selectProvider('${p.id}')">
                <div class="provider-row-info">
                  <div class="provider-row-name">${p.name}</div>
                  <div class="provider-row-sub">${p.hpiOrgId} · ${p.city}</div>
                </div>
                <div class="provider-row-meta">
                  <span class="tier-badge tier-${p.tier}">${p.tier.charAt(0).toUpperCase()+p.tier.slice(1)}</span>
                  <span class="status-pill ${p.status==="contracted"?"contracted":p.status==="in-negotiation"?"in-negotiation":"lead"}" style="font-size:10px">${p.status==="contracted"?"Contracted":p.status==="in-negotiation"?"Negotiating":"Lead"}</span>
                </div>
              </div>`).join("")}
          </div>
        </div>
        <div class="network-right" id="providerDetail">
          <div class="section-card" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">Select a provider to view details</div>
        </div>
      </div>
    </div>`;
  if (selectedProviderId) selectProvider(selectedProviderId);
}

function selectProvider(id) {
  selectedProviderId = id;
  const p = PROVIDERS.find(x => x.id === id);
  if (!p) return;
  document.querySelectorAll(".provider-row").forEach(r =>
    r.classList.toggle("selected", r.getAttribute("onclick")?.includes(`'${id}'`))
  );
  const relatedContracts = CONTRACTS.filter(c => c.provider === p.name);
  const contractsHtml = relatedContracts.length > 0
    ? relatedContracts.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">
          <span style="font-family:var(--font-mono);color:var(--blue);font-weight:600">${c.id}</span>
          <span style="color:var(--text-muted);flex:1;margin:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.contractType}</span>
          <span class="status-pill ${c.status.toLowerCase()}" style="font-size:10px">${c.status}</span>
        </div>`).join("")
    : `<div style="font-size:12.5px;color:var(--text-muted);padding:6px 0">No contracts yet — ${p.status==="lead"?"start contracting below":"draft in AI Studio"}</div>`;

  const hpiColor = p.hpiStatus === "Active" ? "var(--green)" : p.hpiStatus === "Pending" ? "var(--amber)" : "var(--red)";
  const ytdSpendFmt = p.ytdSpend > 0 ? `$${(p.ytdSpend/1000).toFixed(0)}k NZD` : "—";
  const annualProjected = p.ytdSpend > 0 ? `$${(p.ytdSpend * 12 / 5 / 1000).toFixed(0)}k projected` : "—";

  document.getElementById("providerDetail").innerHTML = `
    <div class="detail-panel" style="overflow-y:auto;height:100%">
      <div class="detail-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div>
            <div class="detail-title">${p.name}</div>
            <div class="detail-sub">${p.type} · ${p.city} · ${p.specialty}</div>
          </div>
          <span class="tier-badge tier-${p.tier}">${p.tier.charAt(0).toUpperCase()+p.tier.slice(1)}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">HPI Registration</div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">HPI Org ID</span><span style="font-family:var(--font-mono);font-weight:700;color:var(--blue)">${p.hpiOrgId}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Facility Code</span><span style="font-family:var(--font-mono)">${p.hpiFacilityCode}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">NZBN</span><span style="font-family:var(--font-mono)">${p.nzbn}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">HPI Status</span><span style="font-weight:600;color:${hpiColor}">${p.hpiStatus}${p.hpiExpiry ? " · expires "+p.hpiExpiry : ""}</span></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Relationship</div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Owner</span><span style="font-weight:600">${p.relationshipOwner}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Onboarded</span><span>${p.onboardingDate ?? "Not yet onboarded"}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Contract Stage</span><span class="status-pill ${p.status==="contracted"?"contracted":p.status==="in-negotiation"?"in-negotiation":"lead"}" style="font-size:10px">${p.status==="contracted"?"Contracted":p.status==="in-negotiation"?"In Negotiation":"Lead"}</span></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Financial Summary</div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">YTD Spend</span><span style="font-weight:700">${ytdSpendFmt}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Annual (projected)</span><span>${annualProjected}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">YTD Procedures</span><span>${p.annualVolume > 0 ? p.annualVolume : "—"}</span></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Contact</div>
        <div style="font-size:12.5px;display:flex;flex-direction:column;gap:3px">
          <div style="font-weight:600">${p.contact}</div>
          <div style="color:var(--text-muted)">${p.contactEmail}</div>
          <div style="color:var(--text-muted)">${p.contactPhone}</div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Contracts (${relatedContracts.length})</div>
        ${contractsHtml}
      </div>
      <div class="detail-section" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-sm primary" onclick="showScreen('studio')">Draft Contract in AI Studio</button>
        ${relatedContracts.length>0?`<button class="btn-sm outline" onclick="showScreen('contracts')">View All Contracts</button>`:""}
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

// ─── Screen: Template Repository ─────────────────────────────────────────────

function renderTemplateRepository() {
  const categories = ["All", ...new Set(TEMPLATES.map(t => t.category))];
  const filtered = templateCategory === "All" ? TEMPLATES : TEMPLATES.filter(t => t.category === templateCategory);
  const selected = selectedTemplateId ? TEMPLATES.find(t => t.id === selectedTemplateId) : null;

  document.getElementById("screen-templates").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Template Repository</div><div class="screen-sub">${TEMPLATES.length} contract type templates — select a category, then click to view full detail</div></div>
        <button class="btn-sm primary" onclick="alert('New Template — available in Phase 2 with legal workflow')">+ New Template</button>
      </div>
    </div>
    <div class="screen-body">
      <div class="template-layout">
        <div class="template-sidebar">
          ${categories.map(cat => {
            const count = cat === "All" ? TEMPLATES.length : TEMPLATES.filter(t=>t.category===cat).length;
            return `<button class="template-cat-btn ${templateCategory===cat?"active":""}" onclick="setTemplateCategory('${cat}')"><span>${cat}</span><span class="template-cat-count">${count}</span></button>`;
          }).join("")}
          <div style="margin-top:14px;padding:10px;background:var(--blue-bg);border:1px solid var(--blue-border);border-radius:6px;font-size:11.5px;color:var(--blue);line-height:1.6">
            <strong>${TEMPLATES.reduce((s,t)=>s+t.usedIn,0)} deployments</strong><br><span style="color:var(--text-muted)">across active contracts</span>
          </div>
        </div>
        <div class="template-main">
          ${selected ? `
            <div class="template-detail">
              <div class="template-detail-header">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span class="model-chip ${selected.model.toLowerCase()}">${selected.model}</span>
                    <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${selected.id}</span>
                  </div>
                  <div class="template-detail-title">${selected.name}</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <button class="btn-sm primary" onclick="showScreen('studio')">Use as Template</button>
                  <button class="btn-sm outline" onclick="selectedTemplateId=null;renderTemplateRepository()">← Back</button>
                </div>
              </div>
              <div class="template-detail-body">
                <div class="template-detail-section">
                  <div class="template-detail-section-title">Description</div>
                  <p style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:10px">${selected.description}</p>
                  <div style="font-size:12px;color:var(--text-muted)">Applicable to: <strong style="color:var(--text)">${selected.applicableTo}</strong></div>
                </div>
                <div class="template-detail-section">
                  <div class="template-detail-section-title">Tags</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px">${selected.tags.map(t=>`<span class="template-tag">${t}</span>`).join("")}</div>
                </div>
                <div class="template-detail-section">
                  <div class="template-detail-section-title">Pricing Model</div>
                  <div style="background:var(--surface-hover);border:1px solid var(--border);border-radius:6px;padding:12px 14px;font-size:12.5px;line-height:1.7">
                    <div style="margin-bottom:6px"><strong>Model:</strong> ${selected.model} · <strong>Base Rate:</strong> $${selected.baseRate.toLocaleString()} NZD</div>
                    <div style="color:var(--text-muted)">${selected.pricingNote}</div>
                  </div>
                </div>
                <div class="template-detail-section">
                  <div class="template-detail-section-title">Pre-Approved Clauses (${selected.clauses})</div>
                  <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden">
                    ${selected.clauseList.map((cl,i) => `
                      <div class="clause-list-item" style="padding:8px 14px">
                        <div class="clause-list-num">${i+1}</div>
                        <div style="font-size:12.5px;color:var(--text)">${cl}</div>
                      </div>`).join("")}
                  </div>
                </div>
                <div class="template-detail-section">
                  <div style="display:flex;gap:8px">
                    <button class="btn-sm primary" onclick="showScreen('studio')">Use as Template in AI Studio</button>
                    <button class="btn-sm outline" onclick="showScreen('clauses')">View Clause Library</button>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div>
              <div class="template-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Search templates..." oninput="filterTemplates(this.value)" />
              </div>
              <div class="template-grid" id="templateGrid">
                ${renderTemplateCards(filtered)}
              </div>
            </div>
          `}
        </div>
      </div>
    </div>`;
}

function renderTemplateCards(list) {
  return list.map(t => `
    <div class="template-card ${selectedTemplateId===t.id?"active":""}" onclick="selectTemplate('${t.id}')">
      <div class="template-card-header">
        <div class="template-card-meta">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
            <span class="model-chip ${t.model.toLowerCase()}">${t.model}</span>
            <span style="font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono)">${t.id}</span>
          </div>
          <div class="template-card-title">${t.name}</div>
          <div class="template-card-sub" style="margin-top:3px">${t.description.substring(0,70)}…</div>
          <div class="template-card-tags">${t.tags.slice(0,4).map(tg=>`<span class="template-tag">${tg}</span>`).join("")}</div>
        </div>
      </div>
      <div class="template-card-stats">
        <div class="template-stat"><div class="template-stat-label">Base Rate</div><div class="template-stat-value">$${t.baseRate.toLocaleString()}</div></div>
        <div class="template-stat"><div class="template-stat-label">Clauses</div><div class="template-stat-value">${t.clauses}</div></div>
        <div class="template-stat"><div class="template-stat-label">Used In</div><div class="template-stat-value">${t.usedIn} ctr</div></div>
        <div class="template-stat"><div class="template-stat-label">Updated</div><div class="template-stat-value">${t.lastUpdated}</div></div>
      </div>
    </div>`).join("");
}

function selectTemplate(id) {
  selectedTemplateId = id;
  renderedScreens.delete("templates");
  renderTemplateRepository();
  renderedScreens.add("templates");
}

function setTemplateCategory(cat) {
  templateCategory = cat;
  selectedTemplateId = null;
  renderedScreens.delete("templates");
  renderTemplateRepository();
  renderedScreens.add("templates");
}

function filterTemplates(search) {
  const s = search.toLowerCase();
  const base = templateCategory === "All" ? TEMPLATES : TEMPLATES.filter(t => t.category === templateCategory);
  const filtered = !s ? base : base.filter(t =>
    t.name.toLowerCase().includes(s) || t.category.toLowerCase().includes(s) ||
    t.tags.some(tg => tg.includes(s)) || t.model.toLowerCase().includes(s)
  );
  const grid = document.getElementById("templateGrid");
  if (grid) grid.innerHTML = renderTemplateCards(filtered);
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

// ─── Screen: Integrations & API ──────────────────────────────────────────────

function renderIntegrations() {
  document.getElementById("screen-integrations").innerHTML = `
    <div class="screen-header">
      <div class="screen-header-top">
        <div><div class="screen-title">Integrations & API</div><div class="screen-sub">External system connections — data flows in and out of the CLM automatically</div></div>
      </div>
    </div>
    <div class="screen-body">
      <div class="stat-row" style="grid-template-columns:repeat(3,1fr);max-width:480px;margin-bottom:24px">
        <div class="stat-card"><div class="stat-label">Connected</div><div class="stat-value green">${INTEGRATIONS.filter(i=>i.status==="connected").length}</div><div class="stat-sub">Live integrations</div></div>
        <div class="stat-card"><div class="stat-label">Disconnected</div><div class="stat-value amber">${INTEGRATIONS.filter(i=>i.status==="disconnected").length}</div><div class="stat-sub">Requires setup</div></div>
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${INTEGRATIONS.length}</div><div class="stat-sub">Configured</div></div>
      </div>
      <div class="integrations-grid">
        ${INTEGRATIONS.map(int => `
          <div class="integration-card">
            <div class="integration-card-header">
              <div>
                <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
                  <div class="integration-status-dot ${int.status}"></div>
                  <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${int.status==="connected"?"#047857":"#b45309"}">${int.status==="connected"?"Connected":"Disconnected"}</span>
                </div>
                <div class="integration-name">${int.name}</div>
                <div class="integration-category">${int.category}</div>
              </div>
              <div class="integration-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
              </div>
            </div>
            <div class="integration-desc">${int.description}</div>
            <div class="integration-footer">
              <span style="font-size:11px;color:var(--text-muted)">Last sync: ${int.lastSync}</span>
              <button class="btn-sm ${int.status==="connected"?"outline":"primary"}" style="font-size:11px;padding:4px 10px" onclick="alert('${int.status==="connected"?"Configure "+int.name+" — settings in Phase 2":"Connect "+int.name+" — setup wizard in Phase 2"}')">
                ${int.status==="connected"?"Configure":"Connect"}
              </button>
            </div>
          </div>`).join("")}
      </div>
      <div style="margin-top:20px">
        <div class="section-card">
          <div class="section-card-header"><span class="section-card-title">API Access</span><span class="section-card-count">REST + FHIR R4</span></div>
          <div style="padding:18px 20px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px">Base URL</div><div style="font-family:monospace;font-size:12px;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--blue)">https://clm-api.healthinsurer.co.nz/v1</div></div>
            <div><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px">Authentication</div><div style="font-family:monospace;font-size:12px;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text-muted)">OAuth 2.0 / SAML 2.0</div></div>
            <div><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px">Data Standard</div><div style="font-size:13px;color:var(--text)">FHIR R4 · NZ Base IG · HL7</div></div>
            <div><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px">Hosting</div><div style="font-size:13px;color:var(--text)">AWS Sydney · NZ data residency ✓</div></div>
          </div>
          <div style="padding:0 20px 16px;display:flex;gap:6px;flex-wrap:wrap"><span class="tag">CoFI Act ✓</span><span class="tag">NZ Privacy Act ✓</span><span class="tag">FHIR R4 ✓</span><span class="tag">AWS Sydney ✓</span><span class="tag">WCAG 2.1 AA ✓</span></div>
        </div>
      </div>
    </div>`;
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
