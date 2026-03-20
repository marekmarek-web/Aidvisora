import { useState, useRef, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   AIDVISORA MOBILE — Full Build v3.0
   Senior UX/UI · 2026 Design Language · Czech Support
═══════════════════════════════════════════════════════════ */

// ── GLOBAL STYLES ────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  input, textarea, select { font-family: 'Outfit', sans-serif; }
  button { font-family: 'Outfit', sans-serif; cursor: pointer; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 99px; }
  input::placeholder { color: #94a3b8; }
  @keyframes slideUp   { from { transform:translateY(32px); opacity:0; } to { transform:translateY(0); opacity:1; } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
  @keyframes scaleIn   { from { transform:scale(0.94); opacity:0; } to { transform:scale(1); opacity:1; } }
  @keyframes shimmer   { 0%,100%{opacity:.4} 50%{opacity:1} }
  @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pulse     { 0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.4)} 50%{box-shadow:0 0 0 8px rgba(124,58,237,0)} }
  .slide-up   { animation: slideUp  .28s cubic-bezier(.16,1,.3,1) forwards; }
  .fade-in    { animation: fadeIn   .2s ease forwards; }
  .scale-in   { animation: scaleIn  .22s cubic-bezier(.16,1,.3,1) forwards; }
  .shimmer    { animation: shimmer  1.6s ease infinite; }
  .spin       { animation: spin     .9s linear infinite; }
  .pulse-dot  { animation: pulse    2s ease infinite; }
`;

// ── DESIGN TOKENS ─────────────────────────────────────────────
const T = {
  bg:         "#f0f2f8",
  surface:    "#ffffff",
  surfaceAlt: "#f8f9fd",
  navy:       "#0d0f1c",
  navyDark:   "#07080f",
  purple:     "#7c3aed",
  purpleMid:  "#9333ea",
  violet:     "#8b5cf6",
  indigo:     "#4f46e5",
  indigoSoft: "#6366f1",
  cyan:       "#06b6d4",
  emerald:    "#10b981",
  amber:      "#f59e0b",
  rose:       "#f43f5e",
  slate300:   "#cbd5e1",
  slate400:   "#94a3b8",
  slate500:   "#64748b",
  slate600:   "#475569",
  slate700:   "#334155",
  slate800:   "#1e293b",
  slate900:   "#0f172a",
  border:     "rgba(226,232,240,.9)",
  glass:      "rgba(255,255,255,.82)",
};

// ── SVG ICON SET ───────────────────────────────────────────────
const ic = (d, opts = {}) => (p) => {
  const { fill = "none", vb = "0 0 24 24" } = opts;
  const { size = 18, style = {}, className = "", stroke = "currentColor", strokeWidth = 2 } = p;
  return (
    <svg width={size} height={size} viewBox={vb} fill={fill} stroke={stroke}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}>
      {d}
    </svg>
  );
};

const Ico = {
  Home:      ic(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  Check:     ic(<polyline points="20 6 9 17 4 12"/>),
  CheckCirc: ic(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>),
  Circle:    ic(<circle cx="12" cy="12" r="10"/>),
  Users:     ic(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  Brief:     ic(<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>),
  Menu:      ic(<><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>),
  Bell:      ic(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>),
  Plus:      ic(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
  Search:    ic(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>),
  ChevR:     ic(<polyline points="9 18 15 12 9 6"/>),
  ChevL:     ic(<polyline points="15 18 9 12 15 6"/>),
  ChevD:     ic(<polyline points="6 9 12 15 18 9"/>),
  ChevU:     ic(<polyline points="18 15 12 9 6 15"/>),
  Stars:     ic(<><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3z"/></>),
  Cal:       ic(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  TrendUp:   ic(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>),
  Phone:     ic(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.1 3.4a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/>),
  Mail:      ic(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>),
  User:      ic(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  X:         ic(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  ArrL:      ic(<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>),
  ArrR:      ic(<><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>),
  Clock:     ic(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  Flag:      ic(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>),
  Target:    ic(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>),
  Bar:       ic(<><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>),
  Pie:       ic(<><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></>),
  Calc:      ic(<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/></>),
  Brain:     ic(<><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></>),
  Build:     ic(<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></>),
  Gear:      ic(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
  Upload:    ic(<><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>),
  File:      ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>),
  Net:       ic(<><circle cx="12" cy="12" r="2"/><circle cx="20" cy="12" r="2"/><circle cx="4"  cy="12" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="12" cy="4"  r="2"/><line x1="14" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="12" y1="6" x2="12" y2="10"/></>),
  MapPin:    ic(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>),
  Share:     ic(<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>),
  Eye:       ic(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>),
  Lock:      ic(<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>),
  Warn:      ic(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  DolSign:   ic(<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>),
  Pencil:    ic(<><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></>),
  Trash:     ic(<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>),
  Video:     ic(<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>),
  Msg:       ic(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>),
  Heart:     ic(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>),
  Piggy:     ic(<><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8.5 3.3 1.3 4.4-.3.5-.8 2.3-.8 3.6 0 1 .3 1.8.9 2.3.6.5 1.3.7 2.1.7h4.5c.8 0 1.5-.2 2.1-.7.6-.5.9-1.3.9-2.3 0-.4-.1-.8-.1-1.3.7.1 1.4.1 2.1.1 2.2 0 4-1.8 4-4V9c0-2.2-1.8-4-4-4z"/><circle cx="9" cy="12" r="1" fill="currentColor"/></>),
  TrendD:    ic(<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>),
  ZoomIn:    ic(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>),
  ZoomOut:   ic(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>),
  Baby:      ic(<><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></>),
  Star:      ic(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>, { fill: "currentColor" }),
  Lightning: ic(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>),
  Activity:  ic(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
  Shield:    ic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>),
  Refresh:   ic(<><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>),
  Download:  ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>),
  Edit2:     ic(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>),
};

// ── DATA ──────────────────────────────────────────────────────
const TASKS_DATA = [
  { id:"t1", title:"Zavolat ohledně refinancování hypotéky", client:"Martin Dvořák", date:"Dnes, 14:00", urgency:"high",    status:"pending", tag:"Telefonát" },
  { id:"t2", title:"Připravit nabídku životního pojištění",   client:"Kristýna Benešová", date:"Dnes, 16:00", urgency:"medium",   status:"pending", tag:"Příprava" },
  { id:"t3", title:"Online schůzka — Prezentace portfolia",   client:"Rodina Novákova", date:"Zítra, 10:00", urgency:"normal",   status:"pending", tag:"Schůzka" },
  { id:"t4", title:"Urgovat dodání výpisů z účtu",            client:"Petr Malý",       date:"Včera",       urgency:"overdue",  status:"pending", tag:"Admin" },
  { id:"t5", title:"Výroční servisní schůzka",                client:"Jana Černá",      date:"10. 3.",      urgency:"normal",   status:"done",    tag:"Servis" },
];

const CONTACTS_DATA = [
  { id:"c1", name:"Kristýna Benešová", email:"klient16@example.cz", phone:"+420 715 115 165", status:"vip",    aum:"1.2M", initials:"KB", hue:"purple",  starred:true  },
  { id:"c2", name:"Jana Černá",        email:"klient6@example.cz",  phone:"+420 705 105 555", status:"klient", aum:"450k", initials:"JČ", hue:"emerald", starred:false },
  { id:"c3", name:"Martin Dvořák",     email:"klient5@example.cz",  phone:"+420 704 104 444", status:"lead",   aum:"—",    initials:"MD", hue:"slate",   starred:true  },
  { id:"c4", name:"Pavel Horák",       email:"klient11@example.cz", phone:"+420 710 110 110", status:"klient", aum:"800k", initials:"PH", hue:"blue",    starred:false },
  { id:"c5", name:"MUDr. Jan Novák",   email:"jan.novak@example.cz",phone:"+420 777 123 456", status:"vip",    aum:"5.2M", initials:"JN", hue:"amber",   starred:true  },
  { id:"c6", name:"Filip Kučera",      email:"klient19@example.cz", phone:"+420 718 118 198", status:"vip",    aum:"5.5M", initials:"FK", hue:"violet",  starred:true  },
];

const DEALS_DATA = [
  { id:"d1", stageId:"s1", title:"Hypotéka — Koupě domu",    client:"Tomáš Procházka", value:"8.5M Kč", type:"hypo" },
  { id:"d2", stageId:"s2", title:"Investiční portfolio",      client:"Lucie Opalenská", value:"20k/měs", type:"invest" },
  { id:"d3", stageId:"s3", title:"Životní pojištění rodiny",  client:"Rodina Novákova", value:"3 600 Kč/měs", type:"life" },
  { id:"d4", stageId:"s4", title:"Refinancování bytu",        client:"Rodina Černá",    value:"4.2M Kč", type:"hypo", alert:"Chybí odhad" },
];

const STAGES_DATA = [
  { id:"s1", title:"1. Zájem",     dot:T.emerald },
  { id:"s2", title:"2. Analýza",   dot:T.indigo  },
  { id:"s3", title:"3. Příprava",  dot:T.purple  },
  { id:"s4", title:"4. Realizace", dot:T.rose    },
];

const PERF_DATA = [
  { label:"Říj", v:60 }, { label:"Lis", v:78 }, { label:"Pro", v:94 },
  { label:"Led", v:44 }, { label:"Úno", v:72 }, { label:"Bře", v:88, cur:true },
];

const TEAM_DATA = [
  { id:"1", name:"Martin Dvořák", role:"Senior",  initials:"MD", hue:"indigo",  prod:"1.25M", meet:24, act:95, trend:"up",   status:"online"  },
  { id:"2", name:"Lucie Černá",   role:"Poradce", initials:"LČ", hue:"emerald", prod:"850k",  meet:18, act:82, trend:"up",   status:"offline" },
  { id:"3", name:"Petr Nový",     role:"Junior",  initials:"PN", hue:"blue",    prod:"320k",  meet:12, act:65, trend:"down", status:"online",  alert:true },
  { id:"4", name:"Jana Malá",     role:"Poradce", initials:"JM", hue:"rose",    prod:"940k",  meet:21, act:88, trend:"up",   status:"online"  },
];

const AI_CONTRACTS = [
  { id:"a1", file:"Kooperativa_Zivot.pdf",    client:"Jan Novák",       type:"Životní pojištění", status:"review",      conf:94, insights:[{l:"Pojistná částka",v:"2 000 000 Kč"},{l:"Měsíční pojistné",v:"1 450 Kč"},{l:"Obmyšlená osoba",v:"Chybí",warn:true}] },
  { id:"a2", file:"Hypoteka_CS_Dvorak.pdf",   client:"Martin Dvořák",   type:"Hypoteční úvěr",    status:"processing",  conf:null, insights:[] },
  { id:"a3", file:"Allianz_Auto_1AB2345.pdf", client:"Kristýna Benešová",type:"Pojištění vozidel", status:"done",        conf:99, insights:[{l:"SPZ",v:"1AB 2345"},{l:"Spoluúčast",v:"5 %, min. 5 000 Kč"}] },
];

const CALCS_DATA = [
  { id:"inv",  title:"Investiční",         desc:"Projekce zhodnocení investice v čase.",     Icon:Ico.TrendUp, color:T.indigo,  bg:"rgba(79,70,229,.1)"  },
  { id:"hypo", title:"Hypoteční",           desc:"Splátka a náklady, srovnání sazeb.",        Icon:Ico.Build,   color:T.cyan,    bg:"rgba(6,182,212,.1)"  },
  { id:"penz", title:"Penzijní",            desc:"Výpočet penze, optimalizace příspěvků.",    Icon:Ico.Piggy,   color:T.emerald, bg:"rgba(16,185,129,.1)" },
  { id:"ziv",  title:"Životní pojištění",   desc:"Analýza rizik a propočet potřebného krytí.",Icon:Ico.Heart,   color:T.rose,    bg:"rgba(244,63,94,.1)"  },
];

const ANALYSES_DATA = [
  { id:"an1", client:"MUDr. Jan Novák",   type:"Komplexní finanční plán",  status:"completed", progress:100 },
  { id:"an2", client:"Rodina Dvořákova",  type:"Analýza bydlení a hypo",    status:"draft",     progress:45  },
  { id:"an3", client:"Ing. Lucie O.",     type:"Investiční strategie",      status:"review",    progress:90  },
  { id:"an4", client:"Petr Malý",         type:"Zajištění příjmů",          status:"draft",     progress:20  },
];

const COVERAGE_DATA = [
  { id:"auto",     title:"Pojištění auta",       Icon:Ico.Brief,   color:"#4f46e5", items:[{id:"pov",label:"POV"},{id:"hav",label:"HAV"}] },
  { id:"majetek",  title:"Majetek",              Icon:Ico.Build,   color:"#f59e0b", items:[{id:"nem",label:"Nemovitost"},{id:"dom",label:"Domácnost"}] },
  { id:"odp",      title:"Odpovědnost",          Icon:Ico.Shield,  color:"#10b981", items:[{id:"main",label:"Nastavit"}], single:true },
  { id:"zivot",    title:"Životní pojištění",    Icon:Ico.Heart,   color:"#f43f5e", items:[{id:"main",label:"Nastavit"}], single:true },
  { id:"uvery",    title:"Úvěry & Bydlení",      Icon:Ico.DolSign, color:"#06b6d4", items:[{id:"hypo",label:"Hypotéky"},{id:"stav",label:"Stavební sp."}] },
  { id:"invest",   title:"Investice",            Icon:Ico.TrendUp, color:"#7c3aed", items:[{id:"dip",label:"DIP"},{id:"prav",label:"Pravidelné"}] },
  { id:"dps",      title:"DPS",                  Icon:Ico.Piggy,   color:"#64748b", items:[{id:"main",label:"Nastavit"}], single:true },
  { id:"penz2",    title:"Penzijní připojištění", Icon:Ico.Target,  color:"#8b5cf6", items:[{id:"main",label:"Nastavit"}], single:true },
];

const HOUSEHOLD = {
  name:"Rodina Novákova", address:"Sluneční 145, Praha 4", aum:"8 450 000 Kč", health:92,
  members:[
    { id:"m1", name:"MUDr. Jan Novák",   role:"Hlava rodiny", age:45, aum:"5.2M Kč", type:"adult", initials:"JN", hue:"amber"   },
    { id:"m2", name:"Ing. Eva Nováková", role:"Manželka",      age:42, aum:"2.8M Kč", type:"adult", initials:"EN", hue:"purple"  },
    { id:"m3", name:"Tomáš Novák",       role:"Syn (17 let)",  age:17, aum:"450k Kč", type:"child", initials:"TN", hue:"emerald" },
  ],
  goals:[
    { id:"g1", title:"VŠ pro Tomáše",              target:"500 000 Kč", current:"450 000 Kč", progress:90, color:T.emerald },
    { id:"g2", title:"Předčasné splacení hypotéky", target:"2 000 000 Kč", current:"800 000 Kč", progress:40, color:T.indigo },
  ],
};

const CLIENT_PROFILE = {
  fullName:"MUDr. Jan Novák", initials:"JN", hue:"amber",
  tags:["VIP","Podnikatel"], email:"jan.novak@example.cz", phone:"+420 777 123 456",
  address:"Sluneční 145, Praha 4", aum:"5.2M Kč", monthly:"25 000 Kč", health:88,
  products:[
    { id:"p1", name:"Portu — Portfolio", provider:"Portu",           value:"1.2M Kč",  type:"invest", status:"active"  },
    { id:"p2", name:"Refinancování hyp.", provider:"Česká spořitelna", value:"4.5M Kč", type:"hypo",   status:"pending" },
  ],
  note:"Klient uvažuje o koupi investiční nemovitosti v příštím roce.",
};

const MESSAGES = [
  { id:"msg1", from:"Jan Novák",       initials:"JN", hue:"amber",   last:"Dobrý den, posílám ty výpisy...",  time:"4 min", unread:2 },
  { id:"msg2", from:"Martin Dvořák",   initials:"MD", hue:"slate",   last:"Zdravím, podepsáno.",              time:"4 h",   unread:0 },
  { id:"msg3", from:"Kristýna B.",     initials:"KB", hue:"purple",  last:"Kdy bude hotová analýza?",        time:"Včera", unread:1 },
  { id:"msg4", from:"Rodina Novákova", initials:"RN", hue:"emerald", last:"Díky za schůzku!",                time:"Pon",   unread:0 },
];

const CHAT_MSGS = [
  { id:1, from:"client", text:"Dobrý den, potřebuji se zeptat na stav naší hypotéky.", time:"10:12" },
  { id:2, from:"me",     text:"Dobrý den! Hypotéka je momentálně ve fázi přípravy dokumentů. Čekáme na výsledky odhadu nemovitosti.", time:"10:14" },
  { id:3, from:"client", text:"Jak dlouho to ještě potrvá?", time:"10:15" },
  { id:4, from:"me",     text:"Odhad by měl být hotový do 3–5 pracovních dnů. Hned jak to bude, dám vám vědět.", time:"10:16" },
];

// ── HELPERS & PRIMITIVES ──────────────────────────────────────
const HUE = {
  purple:  {bg:"rgba(124,58,237,.12)",  text:"#7c3aed"},
  indigo:  {bg:"rgba(79,70,229,.12)",   text:"#4f46e5"},
  emerald: {bg:"rgba(16,185,129,.12)",  text:"#059669"},
  amber:   {bg:"rgba(245,158,11,.12)",  text:"#d97706"},
  rose:    {bg:"rgba(244,63,94,.12)",   text:"#e11d48"},
  blue:    {bg:"rgba(59,130,246,.12)",  text:"#2563eb"},
  slate:   {bg:"rgba(71,85,105,.1)",    text:"#475569"},
  violet:  {bg:"rgba(139,92,246,.12)",  text:"#7c3aed"},
  cyan:    {bg:"rgba(6,182,212,.12)",   text:"#0891b2"},
};

function Avatar({ initials, hue="slate", size=40 }) {
  const h = HUE[hue] || HUE.slate;
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.3, background:h.bg, color:h.text,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontWeight:800, fontSize:size*0.3, fontFamily:"'Plus Jakarta Sans',sans-serif",
      flexShrink:0, border:`1.5px solid ${h.text}20`, letterSpacing:"-0.01em"
    }}>{initials}</div>
  );
}

function Badge({ children, color=T.indigo, bg, small=false }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:3,
    padding: small ? "1px 6px" : "2px 8px",
    borderRadius:6, background: bg||color+"18", color, fontSize: small?8:9,
    fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase",
    border:`1px solid ${color}22`, whiteSpace:"nowrap"
  }}>{children}</span>;
}

function Pill({ children, active, onClick, color=T.indigo }) {
  return <button onClick={onClick} style={{
    padding:"6px 14px", borderRadius:20, border:`1.5px solid ${active ? color : T.border}`,
    background: active ? color+"12" : T.surface,
    color: active ? color : T.slate500,
    fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
    transition:"all .15s", fontFamily:"'Outfit',sans-serif"
  }}>{children}</button>;
}

function Bar({ value, color=T.indigo, h=5, bg="rgba(226,232,240,.8)" }) {
  return <div style={{ width:"100%", height:h, borderRadius:h, background:bg, overflow:"hidden" }}>
    <div style={{ width:`${Math.min(value,100)}%`, height:"100%", borderRadius:h, background:color, transition:"width .6s cubic-bezier(.4,0,.2,1)" }}/>
  </div>;
}

function Card({ children, style={}, onClick, glass=false }) {
  const [press, setPress] = useState(false);
  return <div
    onClick={onClick}
    onPointerDown={()=>onClick&&setPress(true)}
    onPointerUp={()=>setPress(false)}
    onPointerLeave={()=>setPress(false)}
    style={{
      background: glass ? T.glass : T.surface,
      backdropFilter: glass ? "blur(20px)" : "none",
      borderRadius:20, border:`1px solid ${T.border}`,
      boxShadow:"0 1px 8px rgba(0,0,0,.05)",
      transition:"all .15s",
      transform: press ? "scale(.98)" : "scale(1)",
      cursor: onClick ? "pointer" : "default",
      ...style
    }}>{children}</div>;
}

function GlassBtn({ children, onClick, primary=false, danger=false, style={}, full=false }) {
  const [press, setPress] = useState(false);
  const bg = primary ? T.purple : danger ? "#fff0f2" : T.surface;
  const clr = primary ? "#fff" : danger ? T.rose : T.slate700;
  const bdr = primary ? "none" : danger ? `1.5px solid ${T.rose}30` : `1.5px solid ${T.border}`;
  const shadow = primary ? `0 4px 18px ${T.purple}40` : "0 1px 4px rgba(0,0,0,.06)";
  return <button onClick={onClick}
    onPointerDown={()=>setPress(true)} onPointerUp={()=>setPress(false)} onPointerLeave={()=>setPress(false)}
    style={{ background:bg, color:clr, border:bdr, borderRadius:12,
      padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center", gap:6,
      transform: press?"scale(.97)":"scale(1)", boxShadow:shadow,
      transition:"all .15s", width:full?"100%":"auto",
      fontFamily:"'Outfit',sans-serif", letterSpacing:"0.01em", ...style
    }}>{children}</button>;
}

function SegTab({ options, active, onChange }) {
  return <div style={{ display:"flex", background:"rgba(226,232,240,.5)", borderRadius:14, padding:3 }}>
    {options.map(({id,label})=><button key={id} onClick={()=>onChange(id)} style={{
      flex:1, padding:"8px 0", borderRadius:10, border:"none",
      background: active===id ? T.surface : "transparent",
      color: active===id ? T.slate800 : T.slate400,
      fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:"0.01em",
      boxShadow: active===id ? "0 1px 6px rgba(0,0,0,.08)" : "none",
      transition:"all .18s", fontFamily:"'Outfit',sans-serif"
    }}>{label}</button>)}
  </div>;
}

function Sheet({ open, onClose, children, title, half=false }) {
  if (!open) return null;
  return <div style={{ position:"absolute", inset:0, background:"rgba(7,8,15,.6)",
    backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"flex-end"
  }} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} className="slide-up"
      style={{ width:"100%", background:T.surface, borderRadius:"28px 28px 0 0",
        overflow:"hidden", boxShadow:"0 -20px 60px rgba(0,0,0,.18)",
        maxHeight: half ? "55%" : "92%", display:"flex", flexDirection:"column"
      }}>
      <div style={{ width:36, height:4, borderRadius:2, background:T.slate300, margin:"12px auto 0", flexShrink:0 }}/>
      {title && <div style={{ padding:"16px 22px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <h3 style={{ fontSize:17, fontWeight:800, color:T.slate900, margin:0, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{title}</h3>
        <button onClick={onClose} style={{ width:30, height:30, borderRadius:9, background:T.bg, border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <Ico.X size={14} style={{ color:T.slate400 }}/>
        </button>
      </div>}
      <div style={{ overflowY:"auto", padding:"16px 22px 28px", flex:1 }}>{children}</div>
    </div>
  </div>;
}

// ── BOTTOM NAV ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"home",     label:"Přehled",  Icon:Ico.Home  },
  { id:"tasks",    label:"Úkoly",    Icon:Ico.CheckCirc, badge:2 },
  { id:"clients",  label:"Klienti",  Icon:Ico.Users },
  { id:"pipeline", label:"Pipeline", Icon:Ico.Brief },
  { id:"menu",     label:"Více",     Icon:Ico.Menu  },
];

function BottomNav({ active, onChange }) {
  return <nav style={{ position:"absolute", bottom:0, left:0, right:0, background:T.glass,
    backdropFilter:"blur(24px)", borderTop:`1px solid ${T.border}`,
    display:"flex", alignItems:"stretch", justifyContent:"space-around",
    padding:"8px 4px 22px", zIndex:50
  }}>
    {NAV_ITEMS.map(({ id, label, Icon, badge })=>{
      const on = active===id;
      return <button key={id} onClick={()=>onChange(id)} style={{
        display:"flex", flexDirection:"column", alignItems:"center", gap:3,
        background:"none", border:"none", cursor:"pointer", padding:"4px 10px",
        position:"relative", minWidth:0, flex:1
      }}>
        <div style={{ width:40, height:34, borderRadius:12,
          background: on ? `${T.purple}15` : "transparent",
          display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s"
        }}>
          <Icon size={20} style={{ color: on ? T.purple : T.slate400 }} strokeWidth={on?2.5:2}/>
        </div>
        <span style={{ fontSize:8.5, fontWeight:800, letterSpacing:"0.05em",
          color: on ? T.purple : T.slate400, textTransform:"uppercase",
          fontFamily:"'Outfit',sans-serif", transition:"color .2s"
        }}>{label}</span>
        {badge && !on && <span style={{ position:"absolute", top:2, right:8, width:16, height:16,
          background:T.rose, borderRadius:8, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:8, fontWeight:900, color:"#fff",
          border:"2px solid "+T.surface
        }}>{badge}</span>}
      </button>;
    })}
  </nav>;
}

// ── STATUS BAR ────────────────────────────────────────────────
function StatusBar({ dark=false }) {
  const c = dark ? "rgba(255,255,255,.8)" : T.slate800;
  return <div style={{ height:44, display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"0 24px", flexShrink:0, position:"relative", zIndex:10
  }}>
    <span style={{ fontSize:13, fontWeight:800, color:c, fontFamily:"'Outfit',sans-serif" }}>9:41</span>
    <div style={{ width:120, height:30, background:T.navy, borderRadius:15, position:"absolute", top:0, left:"50%", transform:"translateX(-50%)"}}/>
    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
      <div style={{ display:"flex", gap:1.5, alignItems:"flex-end" }}>
        {[3,4,5,6].map((h,i)=><div key={i} style={{ width:3, height:h, borderRadius:1.5, background:c }}/>)}
      </div>
      <svg width="18" height="11" viewBox="0 0 22 12"><rect x="1" y="2" width="18" height="8" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><rect x="20" y="4" width="2.5" height="4" rx="1" fill={c}/><rect x="2" y="3" width="12" height="6" rx="1" fill={c}/></svg>
    </div>
  </div>;
}

// ── APP HEADER ────────────────────────────────────────────────
function AppHeader({ subView, onBack, subLabel }) {
  return <header style={{ background:T.glass, backdropFilter:"blur(24px)",
    padding:"10px 18px", display:"flex", alignItems:"center", justifyContent:"space-between",
    borderBottom:`1px solid ${T.border}`, flexShrink:0, zIndex:40
  }}>
    {subView ? (
      <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:7,
        background:"none", border:"none", cursor:"pointer", padding:"4px 0" }}>
        <Ico.ArrL size={18} style={{ color:T.purple }}/>
        <span style={{ fontSize:13, fontWeight:700, color:T.purple, fontFamily:"'Outfit',sans-serif" }}>
          {subLabel || "Zpět"}
        </span>
      </button>
    ) : (
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:10,
          background:"linear-gradient(135deg,#7c3aed,#4f46e5)",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`0 4px 12px ${T.purple}40`
        }}>
          <span style={{ fontSize:15, fontWeight:900, color:"#fff",
            fontFamily:"'Plus Jakarta Sans',sans-serif" }}>A</span>
        </div>
        <span style={{ fontSize:17, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.03em" }}>Aidvisora</span>
      </div>
    )}
    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
      <button style={{ width:34, height:34, borderRadius:11, background:T.surfaceAlt,
        border:`1px solid ${T.border}`, display:"flex", alignItems:"center",
        justifyContent:"center", position:"relative" }}>
        <Ico.Bell size={16} style={{ color:T.slate500 }}/>
        <div style={{ position:"absolute", top:7, right:7, width:7, height:7,
          borderRadius:4, background:T.rose, border:"2px solid "+T.surface,
          animation:"pulse 2s ease infinite"
        }}/>
      </button>
      {!subView && <Avatar initials="MM" hue="purple" size={34}/>}
    </div>
  </header>;
}

// ═══════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════

// ── LOGIN ─────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [showPass, setShow]   = useState(false);
  const [loading, setLoading] = useState(false);

  const doLogin = () => {
    setLoading(true);
    setTimeout(()=>{ setLoading(false); onLogin(); }, 1100);
  };

  return (
    <div style={{ height:"100%", background:`linear-gradient(155deg, ${T.navyDark} 0%, #1a1040 50%, ${T.navy} 100%)`,
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"28px 26px", position:"relative", overflow:"hidden"
    }}>
      {/* Blobs */}
      <div style={{ position:"absolute", top:-100, right:-80, width:280, height:280, borderRadius:"50%",
        background:"radial-gradient(circle,rgba(124,58,237,.35) 0%,transparent 70%)", pointerEvents:"none"}}/>
      <div style={{ position:"absolute", bottom:-60, left:-50, width:200, height:200, borderRadius:"50%",
        background:"radial-gradient(circle,rgba(79,70,229,.25) 0%,transparent 70%)", pointerEvents:"none"}}/>
      <div style={{ position:"absolute", top:"40%", left:-60, width:160, height:160, borderRadius:"50%",
        background:"radial-gradient(circle,rgba(6,182,212,.15) 0%,transparent 70%)", pointerEvents:"none"}}/>

      {/* Logo */}
      <div style={{ marginBottom:44, textAlign:"center", zIndex:1 }}>
        <div style={{ width:70, height:70, borderRadius:22,
          background:"linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)",
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 18px", boxShadow:`0 12px 40px ${T.purple}50`,
          border:"1px solid rgba(255,255,255,.12)"
        }}>
          <span style={{ fontSize:32, fontWeight:900, color:"#fff",
            fontFamily:"'Plus Jakarta Sans',sans-serif" }}>A</span>
        </div>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#fff",
          fontFamily:"'Plus Jakarta Sans',sans-serif",
          letterSpacing:"-0.04em", margin:0 }}>Aidvisora</h1>
        <p style={{ fontSize:12, color:"rgba(255,255,255,.38)", fontWeight:600,
          marginTop:5, fontFamily:"'Outfit',sans-serif", letterSpacing:"0.05em" }}>
          Portál finančního poradce
        </p>
      </div>

      {/* Form */}
      <div style={{ width:"100%", zIndex:1, display:"flex", flexDirection:"column", gap:12 }}>
        {/* Email */}
        <div style={{ position:"relative" }}>
          <Ico.Mail size={15} style={{ position:"absolute", left:14, top:"50%",
            transform:"translateY(-50%)", color:"rgba(255,255,255,.3)", pointerEvents:"none"}}/>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="E-mailová adresa"
            style={{ width:"100%", padding:"14px 14px 14px 42px",
              background:"rgba(255,255,255,.07)", backdropFilter:"blur(8px)",
              border:"1.5px solid rgba(255,255,255,.12)", borderRadius:14,
              color:"#fff", fontSize:14, fontWeight:600, outline:"none",
              fontFamily:"'Outfit',sans-serif", boxSizing:"border-box",
              transition:"border-color .2s"
            }}/>
        </div>
        {/* Password */}
        <div style={{ position:"relative" }}>
          <Ico.Lock size={15} style={{ position:"absolute", left:14, top:"50%",
            transform:"translateY(-50%)", color:"rgba(255,255,255,.3)", pointerEvents:"none"}}/>
          <input type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)}
            placeholder="Heslo"
            style={{ width:"100%", padding:"14px 44px 14px 42px",
              background:"rgba(255,255,255,.07)", backdropFilter:"blur(8px)",
              border:"1.5px solid rgba(255,255,255,.12)", borderRadius:14,
              color:"#fff", fontSize:14, fontWeight:600, outline:"none",
              fontFamily:"'Outfit',sans-serif", boxSizing:"border-box"
            }}/>
          <button onClick={()=>setShow(!showPass)} style={{
            position:"absolute", right:13, top:"50%", transform:"translateY(-50%)",
            background:"none", border:"none", cursor:"pointer", padding:2
          }}>
            <Ico.Eye size={15} style={{ color:"rgba(255,255,255,.3)"}}/>
          </button>
        </div>

        <button onClick={doLogin} style={{
          width:"100%", padding:"15px",
          background: loading ? "rgba(124,58,237,.6)" : "linear-gradient(135deg,#7c3aed,#4f46e5)",
          border:"none", borderRadius:14, color:"#fff",
          fontSize:14, fontWeight:800, cursor: loading?"not-allowed":"pointer",
          marginTop:6, fontFamily:"'Plus Jakarta Sans',sans-serif",
          letterSpacing:"0.01em", boxShadow:`0 8px 28px ${T.purple}40`,
          transition:"all .2s"
        }}>
          {loading ? "Přihlašování…" : "Přihlásit se →"}
        </button>

        <p style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,.3)",
          fontWeight:600, marginTop:6, fontFamily:"'Outfit',sans-serif" }}>
          Zapomenuté heslo?{" "}
          <span style={{ color:"#a78bfa", cursor:"pointer" }}>Obnovit přístup</span>
        </p>
      </div>

      <p style={{ position:"absolute", bottom:28, fontSize:10,
        color:"rgba(255,255,255,.15)", fontWeight:600,
        letterSpacing:"0.07em", fontFamily:"'Outfit',sans-serif" }}>
        AIDVISORA CRM v3.0 · © 2026
      </p>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────
function DashboardScreen({ navigate }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, paddingBottom:100 }}>
      {/* Greeting */}
      <div style={{ marginBottom:2 }}>
        <h1 style={{ fontSize:26, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>
          Dobrý den, Marku 👋
        </h1>
        <p style={{ fontSize:11, fontWeight:700, color:T.slate400,
          letterSpacing:"0.08em", textTransform:"uppercase",
          margin:"4px 0 0", fontFamily:"'Outfit',sans-serif" }}>Pátek, 20. března 2026</p>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {[
          { label:"Schůzky",  val:"3", color:T.emerald, id:"calendar" },
          { label:"Úkoly",    val:"7", color:T.indigo,  id:"tasks", badge:true },
          { label:"Pipeline", val:"3", color:T.purple,  id:"pipeline" },
        ].map(({ label, val, color, id })=>(
          <Card key={id} onClick={()=>navigate(id)} style={{ padding:"14px 10px",
            display:"flex", flexDirection:"column", alignItems:"center",
            textAlign:"center", position:"relative", overflow:"hidden", cursor:"pointer"
          }}>
            <div style={{ position:"absolute", top:-20, right:-20, width:60, height:60,
              borderRadius:"50%", background:`${color}10`, pointerEvents:"none"}}/>
            <span style={{ fontSize:28, fontWeight:900, color:T.slate900,
              fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{val}</span>
            <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.09em",
              textTransform:"uppercase", color:T.slate400, marginTop:5,
              fontFamily:"'Outfit',sans-serif" }}>{label}</span>
            <div style={{ width:18, height:3, borderRadius:2, background:color, marginTop:6 }}/>
          </Card>
        ))}
      </div>

      {/* AI Hero Widget */}
      <div style={{ background:`linear-gradient(135deg, ${T.navy} 0%, #1e0d40 100%)`,
        borderRadius:24, padding:"22px", position:"relative", overflow:"hidden",
        boxShadow:`0 16px 48px rgba(13,15,28,.3)`, border:"1px solid rgba(124,58,237,.25)"
      }}>
        <div style={{ position:"absolute", top:-40, right:-30, width:160, height:160, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(124,58,237,.4) 0%,transparent 70%)", pointerEvents:"none"}}/>
        <div style={{ position:"absolute", bottom:-30, left:-20, width:110, height:110, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(79,70,229,.3) 0%,transparent 70%)", pointerEvents:"none"}}/>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, position:"relative" }}>
          <div style={{ width:34, height:34, borderRadius:11,
            background:"rgba(124,58,237,.35)", border:"1px solid rgba(124,58,237,.4)",
            display:"flex", alignItems:"center", justifyContent:"center"
          }}><Ico.Stars size={16} style={{ color:"#c4b5fd"}} /></div>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.2em",
            color:"#a78bfa", textTransform:"uppercase", fontFamily:"'Outfit',sans-serif" }}>
            AI Asistent
          </span>
        </div>
        <p style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,.9)",
          lineHeight:1.55, margin:"0 0 18px", position:"relative",
          fontFamily:"'Outfit',sans-serif" }}>
          Dnes máte <strong style={{ color:"#fca5a5" }}>1 urgentní úkol po termínu</strong> a odpoledne schůzku s rodinou Novákovou.
        </p>
        <div style={{ display:"flex", gap:9, position:"relative", flexWrap:"wrap" }}>
          <button onClick={()=>navigate("tasks")} style={{ padding:"9px 16px",
            background:"rgba(124,58,237,.5)", border:"1px solid rgba(124,58,237,.4)",
            borderRadius:12, color:"#fff", fontSize:11, fontWeight:800, cursor:"pointer",
            fontFamily:"'Outfit',sans-serif", letterSpacing:"0.04em",
            display:"flex", alignItems:"center", gap:6
          }}>
            <Ico.Flag size={12} style={{ color:"#fca5a5"}}/> Agenda dne
          </button>
          <button onClick={()=>navigate("ai_assistant")} style={{ padding:"9px 16px",
            background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.1)",
            borderRadius:12, color:"rgba(255,255,255,.75)", fontSize:11, fontWeight:700,
            cursor:"pointer", fontFamily:"'Outfit',sans-serif"
          }}>Chat s AI</button>
        </div>
      </div>

      {/* Today schedule */}
      <Card style={{ padding:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Ico.Cal size={15} style={{ color:T.slate400 }}/>
            <span style={{ fontSize:13, fontWeight:800, color:T.slate900,
              fontFamily:"'Outfit',sans-serif" }}>Dnes</span>
          </div>
          <button onClick={()=>navigate("calendar")} style={{ background:"none", border:"none",
            fontSize:11, fontWeight:700, color:T.purple, cursor:"pointer",
            fontFamily:"'Outfit',sans-serif" }}>
            Kalendář →
          </button>
        </div>
        {[
          { time:"10:00", title:"Rodina Novákova",   sub:"Online schůzka",      color:T.purple },
          { time:"14:00", title:"Martin Dvořák",     sub:"Telefonát",           color:T.amber  },
          { time:"16:00", title:"Kristýna Benešová", sub:"Příprava nabídky",    color:T.emerald},
        ].map(({ time, title, sub, color })=>(
          <div key={time} style={{ display:"flex", gap:12, alignItems:"flex-start",
            padding:"8px 0", borderBottom:`1px solid ${T.border}`,
          }}>
            <div style={{ width:3, height:42, borderRadius:2, background:color, flexShrink:0, marginTop:2 }}/>
            <div>
              <span style={{ fontSize:10, fontWeight:700, color:T.slate400,
                fontFamily:"'Outfit',sans-serif", letterSpacing:"0.03em" }}>{time}</span>
              <p style={{ fontSize:13, fontWeight:800, color:T.slate900, margin:"1px 0 1px",
                fontFamily:"'Outfit',sans-serif" }}>{title}</p>
              <p style={{ fontSize:11, fontWeight:600, color:T.slate400, margin:0,
                fontFamily:"'Outfit',sans-serif" }}>{sub}</p>
            </div>
          </div>
        ))}
      </Card>

      {/* Messages preview */}
      <Card style={{ padding:"18px" }} onClick={()=>navigate("messages")}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Ico.Msg size={15} style={{ color:T.slate400 }}/>
            <span style={{ fontSize:13, fontWeight:800, color:T.slate900, fontFamily:"'Outfit',sans-serif" }}>Zprávy</span>
          </div>
          <Badge color={T.emerald}>2 nové</Badge>
        </div>
        {MESSAGES.slice(0,2).map(m=>(
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
            borderBottom:`1px solid ${T.border}` }}>
            <Avatar initials={m.initials} hue={m.hue} size={36}/>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:800, color:T.slate900, margin:0,
                fontFamily:"'Outfit',sans-serif" }}>{m.from}</p>
              <p style={{ fontSize:11, fontWeight:500, color:T.slate400, margin:"2px 0 0",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                fontFamily:"'Outfit',sans-serif" }}>{m.last}</p>
            </div>
            {m.unread>0 && <span style={{ width:18, height:18, borderRadius:9,
              background:T.purple, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:9, fontWeight:900, color:"#fff" }}>{m.unread}</span>}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── TASKS ─────────────────────────────────────
function TasksScreen({ openWizard }) {
  const [tasks, setTasks] = useState(TASKS_DATA);
  const [tab, setTab]     = useState("all");
  const [quick, setQuick] = useState("");

  const toggle = id => setTasks(ts => ts.map(t => t.id===id ? {...t, status:t.status==="done"?"pending":"done"} : t));
  const addQ   = () => {
    if (!quick.trim()) return;
    setTasks(ts => [{ id:"q"+Date.now(), title:quick, client:"", date:"Dnes", urgency:"normal", status:"pending", tag:"Nový" }, ...ts]);
    setQuick("");
  };

  const urgClr = u => ({ overdue:T.rose, high:T.amber, medium:"#f59e0b", normal:T.slate400 }[u]||T.slate400);

  const filtered = tasks.filter(t => {
    if (tab==="all") return true;
    if (tab==="done") return t.status==="done";
    if (tab==="overdue") return t.urgency==="overdue" && t.status!=="done";
    return t.status==="pending";
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Moje úkoly</h1>
        <button onClick={openWizard} style={{ width:36, height:36, borderRadius:12,
          background:`linear-gradient(135deg,${T.purple},${T.indigo})`, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`0 4px 14px ${T.purple}40` }}>
          <Ico.Plus size={16} style={{ color:"#fff" }} strokeWidth={2.5}/>
        </button>
      </div>

      {/* Quick add */}
      <Card style={{ padding:"4px 4px 4px 14px", display:"flex", alignItems:"center", gap:8,
        border: quick ? `1.5px solid ${T.purple}60` : `1px solid ${T.border}` }}>
        <Ico.Plus size={15} style={{ color:quick ? T.purple : T.slate300, flexShrink:0 }} strokeWidth={2.5}/>
        <input value={quick} onChange={e=>setQuick(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addQ()}
          placeholder="Rychlý úkol…"
          style={{ flex:1, border:"none", outline:"none", fontSize:13, fontWeight:600,
            color:T.slate800, background:"transparent", fontFamily:"'Outfit',sans-serif",
            padding:"10px 0" }}/>
        {quick && <button onClick={addQ} style={{ padding:"8px 13px", background:T.purple,
          color:"#fff", border:"none", borderRadius:10, fontSize:11, fontWeight:800, cursor:"pointer",
          fontFamily:"'Outfit',sans-serif" }}>Přidat</button>}
      </Card>

      {/* AI overdue alert */}
      <div style={{ background:"rgba(244,63,94,.05)", border:`1.5px solid rgba(244,63,94,.2)`,
        borderRadius:16, padding:"13px 15px", display:"flex", gap:11 }}>
        <Ico.Warn size={15} style={{ color:T.rose, flexShrink:0, marginTop:1 }}/>
        <div>
          <p style={{ fontSize:12, fontWeight:800, color:T.rose, margin:"0 0 4px",
            fontFamily:"'Outfit',sans-serif" }}>AI Priority</p>
          <p style={{ fontSize:11, fontWeight:600, color:"#7f1d1d", margin:"0 0 9px",
            fontFamily:"'Outfit',sans-serif" }}>
            „Urgovat výpisy" pro Petra Malého mělo proběhnout včera.
          </p>
          <button style={{ fontSize:10, fontWeight:800, letterSpacing:"0.07em",
            textTransform:"uppercase", color:T.rose, background:"#fff",
            border:`1.5px solid rgba(244,63,94,.25)`, borderRadius:8, padding:"5px 11px", cursor:"pointer",
            fontFamily:"'Outfit',sans-serif" }}>Přesunout na dnešek</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
        {[{id:"all",label:"Vše"},{id:"pending",label:"Aktivní"},{id:"overdue",label:"Zpožděné",alert:true},{id:"done",label:"Hotové"}]
          .map(({id,label,alert})=>(
            <Pill key={id} active={tab===id} onClick={()=>setTab(id)} color={alert?T.rose:T.purple}>{label}</Pill>
          ))}
      </div>

      {/* List */}
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {filtered.map(task=>{
          const done = task.status==="done";
          return (
            <Card key={task.id} style={{ padding:"15px" }}>
              <div style={{ display:"flex", gap:11 }}>
                <button onClick={()=>toggle(task.id)} style={{ background:"none", border:"none",
                  cursor:"pointer", padding:0, flexShrink:0, marginTop:2 }}>
                  {done
                    ? <Ico.CheckCirc size={21} style={{ color:T.emerald }}/>
                    : <Ico.Circle    size={21} style={{ color: task.urgency==="overdue" ? T.rose : T.slate300 }}/>
                  }
                </button>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:6, flexWrap:"wrap" }}>
                    <Badge color={urgClr(task.urgency)}>{task.tag}</Badge>
                    {task.urgency==="overdue"&&!done && <Badge color={T.rose}>⚠ Zpožděno</Badge>}
                  </div>
                  <p style={{ fontSize:13, fontWeight:800, color:done?T.slate300:T.slate900,
                    margin:"0 0 6px", textDecoration:done?"line-through":"none", lineHeight:1.4,
                    fontFamily:"'Outfit',sans-serif" }}>{task.title}</p>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    {task.client && <span style={{ fontSize:10, fontWeight:600, color:T.slate400,
                      display:"flex", alignItems:"center", gap:3, fontFamily:"'Outfit',sans-serif" }}>
                      <Ico.User size={10}/> {task.client}
                    </span>}
                    <span style={{ fontSize:10, fontWeight:700, color:urgClr(task.urgency),
                      display:"flex", alignItems:"center", gap:3, fontFamily:"'Outfit',sans-serif" }}>
                      <Ico.Clock size={10}/> {task.date}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── CALENDAR ──────────────────────────────────
function CalendarScreen() {
  const [viewDate, setViewDate] = useState({ year:2026, month:2 }); // 0-indexed
  const [selected, setSelected] = useState(20);

  const months = ["Leden","Únor","Březen","Duben","Květen","Červen","Červenec","Srpen","Září","Říjen","Listopad","Prosinec"];
  const days   = ["Po","Út","St","Čt","Pá","So","Ne"];

  const { year, month } = viewDate;
  const firstDay   = new Date(year, month, 1).getDay();
  const daysCount  = new Date(year, month+1, 0).getDate();
  const startOff   = firstDay === 0 ? 6 : firstDay - 1;
  const cells      = Array.from({ length: startOff + daysCount });

  const events = {
    10: [{ title:"Porada týmu",       color:T.purple, time:"9:00"  }],
    15: [{ title:"Jan Novák",          color:T.indigo, time:"14:00" }, { title:"Kristýna B.", color:T.emerald, time:"16:00" }],
    20: [{ title:"Rodina Novákova",    color:T.purple, time:"10:00" }, { title:"Martin Dvořák", color:T.amber, time:"14:00" }],
    25: [{ title:"Výroční revize",     color:T.rose,   time:"11:00" }],
  };

  const selEvts = events[selected] || [];

  const prev = () => setViewDate(v => v.month===0 ? {year:v.year-1,month:11} : {year:v.year,month:v.month-1});
  const next = () => setViewDate(v => v.month===11 ? {year:v.year+1,month:0}  : {year:v.year,month:v.month+1});

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, paddingBottom:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Kalendář</h1>
        <button style={{ width:36, height:36, borderRadius:12,
          background:`linear-gradient(135deg,${T.purple},${T.indigo})`, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`0 4px 14px ${T.purple}40` }}>
          <Ico.Plus size={16} style={{ color:"#fff" }} strokeWidth={2.5}/>
        </button>
      </div>

      <Card style={{ padding:"16px" }}>
        {/* Month nav */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <button onClick={prev} style={{ width:30, height:30, borderRadius:9, background:T.surfaceAlt, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <Ico.ChevL size={14} style={{ color:T.slate500 }}/>
          </button>
          <span style={{ fontSize:15, fontWeight:800, color:T.slate900, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {months[month]} {year}
          </span>
          <button onClick={next} style={{ width:30, height:30, borderRadius:9, background:T.surfaceAlt, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <Ico.ChevR size={14} style={{ color:T.slate500 }}/>
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
          {days.map(d=>(
            <div key={d} style={{ textAlign:"center", fontSize:9, fontWeight:800,
              color:T.slate400, letterSpacing:"0.08em", textTransform:"uppercase",
              fontFamily:"'Outfit',sans-serif", padding:"4px 0" }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px" }}>
          {cells.map((_, i)=>{
            const day = i - startOff + 1;
            if (day < 1) return <div key={i}/>;
            const isSel = day === selected;
            const isToday = day === 20 && month === 2 && year === 2026;
            const hasEvt = !!(events[day]);
            return (
              <button key={i} onClick={()=>setSelected(day)} style={{
                height:36, borderRadius:10, border:"none", cursor:"pointer",
                background: isSel ? T.purple : isToday ? `${T.purple}12` : "transparent",
                color: isSel ? "#fff" : isToday ? T.purple : T.slate600,
                fontSize:12, fontWeight: isSel||isToday ? 800 : 600,
                display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", gap:2, position:"relative",
                fontFamily:"'Outfit',sans-serif", transition:"all .15s"
              }}>
                {day}
                {hasEvt && <div style={{ width:4, height:4, borderRadius:2,
                  background: isSel ? "rgba(255,255,255,.7)" : T.purple }}/>}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected day events */}
      <div>
        <p style={{ fontSize:11, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase",
          color:T.slate400, marginBottom:10, fontFamily:"'Outfit',sans-serif" }}>
          {selected}. {months[month]}
        </p>
        {selEvts.length === 0 ? (
          <Card style={{ padding:"24px", textAlign:"center" }}>
            <p style={{ fontSize:13, fontWeight:600, color:T.slate400, margin:0, fontFamily:"'Outfit',sans-serif" }}>
              Žádné události
            </p>
          </Card>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {selEvts.map((ev,i)=>(
              <Card key={i} style={{ padding:"15px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:4, height:44, borderRadius:2, background:ev.color, flexShrink:0 }}/>
                <div style={{ width:42, height:42, borderRadius:12,
                  background:`${ev.color}15`, display:"flex", alignItems:"center",
                  justifyContent:"center", flexShrink:0 }}>
                  <Ico.Cal size={18} style={{ color:ev.color }}/>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, fontWeight:800, color:T.slate900, margin:0,
                    fontFamily:"'Outfit',sans-serif" }}>{ev.title}</p>
                  <p style={{ fontSize:11, fontWeight:600, color:T.slate400, margin:"3px 0 0",
                    fontFamily:"'Outfit',sans-serif" }}>{ev.time}</p>
                </div>
                <Ico.ChevR size={14} style={{ color:T.slate300 }}/>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CLIENTS ───────────────────────────────────
function ClientsScreen({ navigate }) {
  const [search, setSearch]  = useState("");
  const [filter, setFilter]  = useState("all");

  const filtered = CONTACTS_DATA.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (filter==="all" || c.status===filter)
  );

  const stClr = { vip:T.amber, klient:T.emerald, lead:T.slate500 };
  const stLbl = { vip:"VIP", klient:"Klient", lead:"Lead" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, paddingBottom:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Kontakty</h1>
        <button style={{ width:36, height:36, borderRadius:12, background:T.navy, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ico.Plus size={16} style={{ color:"#fff"}} strokeWidth={2.5}/>
        </button>
      </div>

      <div style={{ position:"relative" }}>
        <Ico.Search size={15} style={{ position:"absolute", left:13, top:"50%",
          transform:"translateY(-50%)", color:T.slate400, pointerEvents:"none" }}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Hledat klienta…"
          style={{ width:"100%", padding:"11px 12px 11px 36px", background:T.surface,
            border:`1.5px solid ${T.border}`, borderRadius:14, fontSize:13, fontWeight:600,
            outline:"none", fontFamily:"'Outfit',sans-serif", color:T.slate800,
            boxSizing:"border-box", transition:"border-color .2s"
          }}/>
      </div>

      <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
        {[["all","Všichni"],["vip","VIP"],["klient","Klienti"],["lead","Leady"]]
          .map(([id,lbl])=>(
            <Pill key={id} active={filter===id} onClick={()=>setFilter(id)}>{lbl}</Pill>
          ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {filtered.map(c=>(
          <Card key={c.id} onClick={()=>navigate("client_detail")} style={{ padding:"15px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Avatar initials={c.initials} hue={c.hue} size={46}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:T.slate900,
                    fontFamily:"'Outfit',sans-serif" }}>{c.name}</span>
                  <Badge color={stClr[c.status]||T.slate400}>{stLbl[c.status]||c.status}</Badge>
                </div>
                <p style={{ fontSize:11, fontWeight:600, color:T.slate400, margin:0,
                  fontFamily:"'Outfit',sans-serif" }}>{c.email}</p>
              </div>
              <Ico.ChevR size={14} style={{ color:T.slate300 }}/>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:12, paddingTop:11,
              borderTop:`1px solid ${T.border}` }}>
              <GlassBtn style={{ flex:1, fontSize:11 }}>
                <Ico.Phone size={11} style={{ color:T.slate600 }}/> Zavolat
              </GlassBtn>
              <GlassBtn style={{ flex:1, fontSize:11 }}>
                <Ico.Mail size={11} style={{ color:T.slate600 }}/> E-mail
              </GlassBtn>
              <GlassBtn primary style={{ flex:1, fontSize:11 }}>Detail →</GlassBtn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── PIPELINE ──────────────────────────────────
function PipelineScreen() {
  const [open, setOpen] = useState("s1");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, paddingBottom:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Pipeline</h1>
        <button style={{ width:36, height:36, borderRadius:12, background:T.navy, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ico.Plus size={16} style={{ color:"#fff"}} strokeWidth={2.5}/>
        </button>
      </div>

      {/* Summary */}
      <div style={{ background:`linear-gradient(135deg,${T.navy},#1e0d40)`,
        borderRadius:22, padding:"20px 22px", display:"flex",
        justifyContent:"space-between", alignItems:"center",
        border:"1px solid rgba(124,58,237,.25)"
      }}>
        <div>
          <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase",
            color:"rgba(255,255,255,.4)", margin:"0 0 3px", fontFamily:"'Outfit',sans-serif" }}>Celkový potenciál</p>
          <p style={{ fontSize:26, fontWeight:900, color:"#fff", margin:0,
            fontFamily:"'Plus Jakarta Sans',sans-serif" }}>12.7M Kč</p>
        </div>
        <div style={{ display:"flex", gap:3, alignItems:"flex-end" }}>
          {PERF_DATA.slice(-4).map((p,i)=>(
            <div key={i} style={{ width:9, background:i===3?T.violet:"rgba(255,255,255,.2)",
              borderRadius:"4px 4px 0 0", height:`${p.v*.55}px`, alignSelf:"flex-end" }}/>
          ))}
        </div>
      </div>

      {STAGES_DATA.map(stage=>{
        const deals = DEALS_DATA.filter(d=>d.stageId===stage.id);
        const isOpen = open===stage.id;
        return (
          <Card key={stage.id} style={{ overflow:"hidden" }}>
            <button onClick={()=>setOpen(isOpen?null:stage.id)}
              style={{ width:"100%", padding:"15px 17px", display:"flex",
                alignItems:"center", justifyContent:"space-between",
                background:"none", border:"none", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <div style={{ width:9, height:9, borderRadius:"50%", background:stage.dot,
                  boxShadow:`0 0 8px ${stage.dot}` }}/>
                <span style={{ fontSize:13, fontWeight:800, color:T.slate800,
                  fontFamily:"'Outfit',sans-serif" }}>{stage.title}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <span style={{ width:22, height:22, borderRadius:7, background:T.surfaceAlt,
                  border:`1px solid ${T.border}`, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:11, fontWeight:800, color:T.slate600 }}>
                  {deals.length}
                </span>
                <Ico.ChevD size={14} style={{ color:T.slate400, transform:isOpen?"rotate(180deg)":"none", transition:"transform .2s" }}/>
              </div>
            </button>
            {isOpen && (
              <div style={{ borderTop:`1px solid ${T.border}`, padding:"11px 14px",
                display:"flex", flexDirection:"column", gap:9 }} className="fade-in">
                {deals.length===0 && <p style={{ textAlign:"center", color:T.slate400,
                  fontSize:12, fontWeight:600, padding:"10px 0", fontFamily:"'Outfit',sans-serif" }}>Prázdná fáze</p>}
                {deals.map(d=>(
                  <div key={d.id} style={{ background:T.surfaceAlt, borderRadius:14,
                    padding:"13px", border:`1px solid ${T.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"flex-start", marginBottom:7 }}>
                      <Badge color={d.type==="hypo"?T.indigo:d.type==="invest"?T.emerald:T.rose}>
                        {d.type==="hypo"?"Hypotéka":d.type==="invest"?"Investice":"Životní"}
                      </Badge>
                      <span style={{ fontSize:12, fontWeight:800, color:T.slate900,
                        fontFamily:"'Outfit',sans-serif" }}>{d.value}</span>
                    </div>
                    <p style={{ fontSize:13, fontWeight:800, color:T.slate900, margin:"0 0 3px",
                      fontFamily:"'Outfit',sans-serif" }}>{d.title}</p>
                    <p style={{ fontSize:11, fontWeight:600, color:T.slate400, margin:0,
                      display:"flex", alignItems:"center", gap:3, fontFamily:"'Outfit',sans-serif" }}>
                      <Ico.User size={10}/> {d.client}
                    </p>
                    {d.alert && <div style={{ marginTop:9, padding:"6px 10px",
                      background:"rgba(244,63,94,.07)", borderRadius:8,
                      border:"1px solid rgba(244,63,94,.2)", display:"flex",
                      alignItems:"center", gap:6 }}>
                      <Ico.Warn size={11} style={{ color:T.rose }}/>
                      <span style={{ fontSize:10, fontWeight:800, color:T.rose,
                        fontFamily:"'Outfit',sans-serif" }}>{d.alert}</span>
                    </div>}
                  </div>
                ))}
                <button style={{ width:"100%", padding:"10px", border:`2px dashed ${T.border}`,
                  borderRadius:12, background:"none", color:T.slate400, fontSize:11,
                  fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center",
                  justifyContent:"center", gap:5, fontFamily:"'Outfit',sans-serif" }}>
                  <Ico.Plus size={13}/> Přidat obchod
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── CLIENT DETAIL ─────────────────────────────
function ClientDetailScreen({ navigate }) {
  const [tab, setTab] = useState("prehled");
  const [coverage, setCoverage] = useState(
    () => COVERAGE_DATA.reduce((a,c) => {
      c.items.forEach(item => { a[`${c.id}_${item.id}`] = "none"; });
      return a;
    }, {})
  );

  const cycleStatus = (key) => setCoverage(prev => {
    const cur = prev[key];
    return { ...prev, [key]: cur==="none"?"pending":cur==="pending"?"active":"none" };
  });

  const stColor = { active:T.emerald, pending:T.amber, none:T.slate300 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, paddingBottom:100 }}>
      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg,${T.navy} 0%,#1e0d40 100%)`,
        borderRadius:24, padding:"22px", textAlign:"center",
        position:"relative", overflow:"hidden",
        border:"1px solid rgba(124,58,237,.25)"
      }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:120, height:120, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(124,58,237,.3) 0%,transparent 70%)", pointerEvents:"none"}}/>
        <div style={{ width:68, height:68, borderRadius:22,
          background:"linear-gradient(135deg,#7c3aed,#4f46e5)",
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 13px", fontSize:22, fontWeight:900, color:"#fff",
          fontFamily:"'Plus Jakarta Sans',sans-serif",
          boxShadow:`0 8px 28px ${T.purple}50`, border:"2px solid rgba(255,255,255,.15)"
        }}>JN</div>
        <h2 style={{ fontSize:19, fontWeight:900, color:"#fff",
          fontFamily:"'Plus Jakarta Sans',sans-serif", margin:"0 0 7px" }}>
          {CLIENT_PROFILE.fullName}
        </h2>
        <div style={{ display:"flex", gap:7, justifyContent:"center", marginBottom:16 }}>
          {CLIENT_PROFILE.tags.map(t=><Badge key={t} color={T.amber}>{t}</Badge>)}
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
          <button style={{ padding:"8px 16px", background:"rgba(255,255,255,.1)",
            border:"1px solid rgba(255,255,255,.15)", borderRadius:10,
            color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6, fontFamily:"'Outfit',sans-serif" }}>
            <Ico.Phone size={12}/> Zavolat
          </button>
          <button onClick={()=>navigate("messages_chat")} style={{ padding:"8px 16px",
            background:"rgba(124,58,237,.3)", border:"1px solid rgba(124,58,237,.4)",
            borderRadius:10, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6, fontFamily:"'Outfit',sans-serif" }}>
            <Ico.Msg size={12}/> Zpráva
          </button>
        </div>
      </div>

      {/* Tabs */}
      <SegTab options={[{id:"prehled",label:"Přehled"},{id:"produkty",label:"Produkty"},{id:"pokryti",label:"Pokrytí"},{id:"kontakt",label:"Kontakt"}]}
        active={tab} onChange={setTab}/>

      {tab==="prehled" && (
        <div style={{ display:"flex", flexDirection:"column", gap:11 }} className="fade-in">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Card style={{ padding:"16px" }}>
              <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
                color:T.slate400, margin:"0 0 5px", fontFamily:"'Outfit',sans-serif" }}>AUM</p>
              <p style={{ fontSize:22, fontWeight:900, color:T.slate900, margin:0,
                fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{CLIENT_PROFILE.aum}</p>
            </Card>
            <Card style={{ padding:"16px" }}>
              <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
                color:T.slate400, margin:"0 0 5px", fontFamily:"'Outfit',sans-serif" }}>Měs. investice</p>
              <p style={{ fontSize:20, fontWeight:900, color:T.emerald, margin:0,
                fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{CLIENT_PROFILE.monthly}</p>
            </Card>
          </div>
          <Card style={{ padding:"17px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9 }}>
              <span style={{ fontSize:12, fontWeight:800, color:T.slate800, fontFamily:"'Outfit',sans-serif" }}>Finanční zdraví</span>
              <span style={{ fontSize:16, fontWeight:900, color:T.emerald, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{CLIENT_PROFILE.health}%</span>
            </div>
            <Bar value={CLIENT_PROFILE.health} color={T.emerald} h={7}/>
          </Card>
          <Card style={{ padding:"17px", background:"#fffbeb", borderColor:"#fde68a" }}>
            <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
              color:"#92400e", margin:"0 0 7px", display:"flex", alignItems:"center", gap:5,
              fontFamily:"'Outfit',sans-serif" }}>
              <Ico.File size={11}/> Poslední zápisek
            </p>
            <p style={{ fontSize:12, fontWeight:600, color:"#78350f", margin:0, lineHeight:1.5,
              fontStyle:"italic", fontFamily:"'Outfit',sans-serif" }}>"{CLIENT_PROFILE.note}"</p>
          </Card>
          <GlassBtn onClick={()=>navigate("mindmap")} style={{ justifyContent:"center" }}>
            <Ico.Net size={14} style={{ color:T.purple }}/> Otevřít Mindmap klienta
          </GlassBtn>
          <GlassBtn onClick={()=>navigate("household_detail")} style={{ justifyContent:"center" }}>
            <Ico.Build size={14} style={{ color:T.slate600 }}/> Detail domácnosti
          </GlassBtn>
        </div>
      )}

      {tab==="produkty" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }} className="fade-in">
          {CLIENT_PROFILE.products.map(p=>(
            <Card key={p.id} style={{ padding:"17px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ marginBottom:6 }}>
                    <Badge color={p.type==="invest"?T.emerald:T.indigo}>
                      {p.type==="invest"?"Investice":"Hypotéka"}
                    </Badge>
                  </div>
                  <p style={{ fontSize:13, fontWeight:800, color:T.slate900, margin:"0 0 3px",
                    fontFamily:"'Outfit',sans-serif" }}>{p.name}</p>
                  <p style={{ fontSize:11, fontWeight:600, color:T.slate400, margin:0,
                    fontFamily:"'Outfit',sans-serif" }}>{p.provider}</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:16, fontWeight:900, color:T.slate900, margin:"0 0 4px",
                    fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{p.value}</p>
                  <Badge color={p.status==="active"?T.emerald:T.amber}>
                    {p.status==="active"?"Aktivní":"Čeká"}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab==="pokryti" && (
        <div style={{ display:"flex", flexDirection:"column", gap:9 }} className="fade-in">
          <p style={{ fontSize:11, fontWeight:700, color:T.slate400, margin:"0 0 4px",
            fontFamily:"'Outfit',sans-serif" }}>
            Klikněte na položku pro změnu stavu. ○ prázdné · ◷ řeší se · ✓ aktivní
          </p>
          {COVERAGE_DATA.map(cat=>{
            const Icon = cat.Icon;
            return (
              <Card key={cat.id} style={{ padding:"14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:34, height:34, borderRadius:10,
                    background:`${cat.color}15`, display:"flex", alignItems:"center",
                    justifyContent:"center" }}>
                    <Icon size={16} style={{ color:cat.color }}/>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, color:T.slate900,
                    fontFamily:"'Outfit',sans-serif" }}>{cat.title}</span>
                </div>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {cat.items.map(item=>{
                    const key = `${cat.id}_${item.id}`;
                    const st = coverage[key];
                    const stC = stColor[st];
                    return (
                      <button key={item.id} onClick={()=>cycleStatus(key)} style={{
                        padding:"7px 13px", borderRadius:10, border:`2px solid ${stC}40`,
                        background: st==="active"?`${T.emerald}12`:st==="pending"?`${T.amber}12`:`${T.surfaceAlt}`,
                        color: st==="active"?T.emerald:st==="pending"?T.amber:T.slate400,
                        fontSize:11, fontWeight:800, cursor:"pointer",
                        display:"flex", alignItems:"center", gap:5,
                        fontFamily:"'Outfit',sans-serif", transition:"all .15s"
                      }}>
                        {st==="active"?<Ico.Check size={11}/>:st==="pending"?<Ico.Clock size={11}/>:<Ico.Circle size={11}/>}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab==="kontakt" && (
        <Card style={{ padding:"18px" }} className="fade-in">
          {[{Icon:Ico.Mail,label:"E-mail",val:CLIENT_PROFILE.email},
            {Icon:Ico.Phone,label:"Telefon",val:CLIENT_PROFILE.phone},
            {Icon:Ico.MapPin,label:"Adresa",val:CLIENT_PROFILE.address},
          ].map(({Icon,label,val})=>(
            <div key={label} style={{ display:"flex", gap:13, alignItems:"flex-start",
              padding:"13px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:36, height:36, borderRadius:10, background:T.surfaceAlt,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon size={15} style={{ color:T.slate400 }}/>
              </div>
              <div>
                <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.09em",
                  textTransform:"uppercase", color:T.slate400, margin:"0 0 3px",
                  fontFamily:"'Outfit',sans-serif" }}>{label}</p>
                <p style={{ fontSize:13, fontWeight:700, color:T.slate900, margin:0,
                  fontFamily:"'Outfit',sans-serif" }}>{val}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── HOUSEHOLD ─────────────────────────────────
function HouseholdScreen() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100 }}>
      {/* Hero */}
      <Card style={{ padding:"20px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:100, height:100, borderRadius:"50%",
          background:`${T.indigo}08`, pointerEvents:"none"}}/>
        <div style={{ width:60, height:60, borderRadius:18, background:`${T.indigo}12`,
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 12px" }}>
          <Ico.Share size={24} style={{ color:T.indigo }}/>
        </div>
        <h2 style={{ fontSize:20, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", margin:"0 0 5px" }}>
          {HOUSEHOLD.name}
        </h2>
        <p style={{ fontSize:11, fontWeight:600, color:T.slate400, margin:"0 0 14px",
          fontFamily:"'Outfit',sans-serif" }}>
          {HOUSEHOLD.address}
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ background:T.surfaceAlt, padding:"12px", borderRadius:12 }}>
            <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
              color:T.slate400, margin:"0 0 4px", fontFamily:"'Outfit',sans-serif" }}>AUM</p>
            <p style={{ fontSize:18, fontWeight:900, color:T.purple, margin:0,
              fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{HOUSEHOLD.aum}</p>
          </div>
          <div style={{ background:T.surfaceAlt, padding:"12px", borderRadius:12 }}>
            <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
              color:T.slate400, margin:"0 0 4px", fontFamily:"'Outfit',sans-serif" }}>Health</p>
            <p style={{ fontSize:18, fontWeight:900, color:T.emerald, margin:0,
              fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{HOUSEHOLD.health}%</p>
          </div>
        </div>
      </Card>

      {/* Members */}
      <Card style={{ padding:"18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <span style={{ fontSize:13, fontWeight:800, color:T.slate900, fontFamily:"'Outfit',sans-serif" }}>
            Členové ({HOUSEHOLD.members.length})
          </span>
          <GlassBtn small style={{ fontSize:11 }}><Ico.Plus size={12}/> Přidat</GlassBtn>
        </div>
        {HOUSEHOLD.members.map(m=>(
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12,
            padding:"11px 12px", background:T.surfaceAlt, borderRadius:14,
            border:`1px solid ${T.border}`, marginBottom:8 }}>
            {m.type==="child"
              ? <div style={{ width:42, height:42, borderRadius:14, background:`${T.amber}15`,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Ico.Baby size={18} style={{ color:T.amber }}/>
                </div>
              : <Avatar initials={m.initials} hue={m.hue} size={42}/>
            }
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:800, color:T.slate900, margin:"0 0 2px",
                fontFamily:"'Outfit',sans-serif" }}>{m.name}</p>
              <p style={{ fontSize:10, fontWeight:600, color:T.slate400, margin:0,
                fontFamily:"'Outfit',sans-serif" }}>{m.role} · {m.aum}</p>
            </div>
          </div>
        ))}
      </Card>

      {/* Goals */}
      <Card style={{ padding:"18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Ico.Target size={15} style={{ color:T.amber }}/>
            <span style={{ fontSize:13, fontWeight:800, color:T.slate900, fontFamily:"'Outfit',sans-serif" }}>Společné cíle</span>
          </div>
          <GlassBtn small><Ico.Plus size={12}/></GlassBtn>
        </div>
        {HOUSEHOLD.goals.map(g=>(
          <div key={g.id} style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
              <span style={{ fontSize:12, fontWeight:700, color:T.slate800, fontFamily:"'Outfit',sans-serif" }}>{g.title}</span>
              <span style={{ fontSize:13, fontWeight:900, color:T.slate900, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{g.progress}%</span>
            </div>
            <Bar value={g.progress} color={g.color} h={7}/>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
              <span style={{ fontSize:10, fontWeight:600, color:T.slate400, fontFamily:"'Outfit',sans-serif" }}>
                Naspořeno: <strong style={{ color:T.slate700 }}>{g.current}</strong>
              </span>
              <span style={{ fontSize:10, fontWeight:600, color:T.slate400, fontFamily:"'Outfit',sans-serif" }}>
                Cíl: {g.target}
              </span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── AI ASSISTANT ──────────────────────────────
function AIAssistantScreen() {
  const [msgs, setMsgs] = useState(AI_CONTRACTS);
  const [tab, setTab]   = useState("smlouvy");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { id:1, from:"ai", text:"Dobrý den! Jsem váš AI asistent. Mohu vám pomoci s analýzou smluv, zodpovědět otázky o klientech nebo připravit shrnutí. Jak vám mohu pomoci?" },
  ]);

  const sendMsg = () => {
    if (!chatInput.trim()) return;
    const userMsg = { id: Date.now(), from:"me", text:chatInput };
    const aiResp  = { id: Date.now()+1, from:"ai", text:`Rozumím. Zpracovávám váš dotaz ohledně: „${chatInput}". Odpověď bude připravena za okamžik…` };
    setChatHistory(h => [...h, userMsg, aiResp]);
    setChatInput("");
  };

  const stConf = {
    done:       { label:"Zpracováno",   color:T.emerald },
    review:     { label:"Ke kontrole",  color:T.amber   },
    processing: { label:"Zpracovává se",color:T.indigo  },
    error:      { label:"Chyba",        color:T.rose    },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100, height:"calc(100% - 60px)" }}>
      <SegTab options={[{id:"smlouvy",label:"AI Smlouvy"},{id:"chat",label:"Chat s AI"}]}
        active={tab} onChange={setTab}/>

      {tab==="smlouvy" && (
        <div style={{ display:"flex", flexDirection:"column", gap:13 }} className="fade-in">
          {/* Upload */}
          <div style={{ background:`linear-gradient(135deg,${T.indigo},${T.purple})`,
            borderRadius:22, padding:"22px", textAlign:"center",
            border:"1px solid rgba(124,58,237,.3)"
          }}>
            <div style={{ width:52, height:52, borderRadius:16,
              background:"rgba(255,255,255,.15)", display:"flex",
              alignItems:"center", justifyContent:"center", margin:"0 auto 13px" }}>
              <Ico.Brain size={24} style={{ color:"#fff" }}/>
            </div>
            <h3 style={{ fontSize:17, fontWeight:800, color:"#fff",
              fontFamily:"'Plus Jakarta Sans',sans-serif", margin:"0 0 7px" }}>AI Review smluv</h3>
            <p style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,.6)",
              margin:"0 0 18px", lineHeight:1.5, fontFamily:"'Outfit',sans-serif" }}>
              Nahrajte PDF nebo fotku — AI automaticky vyčte data do CRM.
            </p>
            <button style={{ width:"100%", padding:"12px", background:"rgba(255,255,255,.95)",
              border:"none", borderRadius:13, color:T.purple, fontSize:12, fontWeight:800,
              cursor:"pointer", display:"flex", alignItems:"center",
              justifyContent:"center", gap:7, fontFamily:"'Outfit',sans-serif" }}>
              <Ico.Upload size={14} style={{ color:T.purple }}/> Nahrát dokument
            </button>
          </div>

          {AI_CONTRACTS.map(c=>{
            const s = stConf[c.status];
            return (
              <Card key={c.id} style={{ padding:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:11 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ width:36, height:36, borderRadius:11,
                      background:`${s.color}15`, display:"flex",
                      alignItems:"center", justifyContent:"center" }}>
                      <Ico.File size={15} style={{ color:s.color }}/>
                    </div>
                    <div>
                      <p style={{ fontSize:12, fontWeight:800, color:T.slate900, margin:0,
                        fontFamily:"'Outfit',sans-serif" }}>{c.file}</p>
                      <p style={{ fontSize:10, fontWeight:600, color:T.slate400, margin:"2px 0 0",
                        fontFamily:"'Outfit',sans-serif" }}>{c.client} · {c.type}</p>
                    </div>
                  </div>
                  <Badge color={s.color}>{s.label}</Badge>
                </div>
                {c.status==="processing" && (
                  <div style={{ height:4, borderRadius:4, background:`${T.surfaceAlt}`, overflow:"hidden", marginBottom:8 }}>
                    <div style={{ width:"60%", height:"100%",
                      background:`linear-gradient(90deg,${T.indigo},${T.purple})`,
                      borderRadius:4, animation:"shimmer 1.6s ease infinite" }}/>
                  </div>
                )}
                {c.conf && <p style={{ fontSize:10, fontWeight:700, color:T.slate400, margin:"0 0 9px",
                  fontFamily:"'Outfit',sans-serif" }}>Spolehlivost AI: <strong style={{ color:T.emerald }}>{c.conf}%</strong></p>}
                {c.insights.length>0 && (
                  <div style={{ background:T.surfaceAlt, borderRadius:12, padding:"11px 13px",
                    border:`1px solid ${T.border}` }}>
                    <p style={{ fontSize:9, fontWeight:900, letterSpacing:"0.1em",
                      textTransform:"uppercase", color:T.purple, margin:"0 0 9px",
                      display:"flex", alignItems:"center", gap:4, fontFamily:"'Outfit',sans-serif" }}>
                      <Ico.Stars size={10}/> AI data
                    </p>
                    {c.insights.map((ins,i)=>(
                      <div key={i} style={{ display:"flex", justifyContent:"space-between",
                        padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ fontSize:11, fontWeight:600, color:T.slate400, fontFamily:"'Outfit',sans-serif" }}>{ins.l}</span>
                        <span style={{ fontSize:11, fontWeight:800, color:ins.warn?T.rose:T.slate900, fontFamily:"'Outfit',sans-serif" }}>{ins.v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab==="chat" && (
        <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 280px)", minHeight:300 }} className="fade-in">
          {/* AI header */}
          <div style={{ background:`linear-gradient(135deg,${T.navy},#1e0d40)`,
            borderRadius:16, padding:"14px 16px", marginBottom:12,
            display:"flex", alignItems:"center", gap:11,
            border:"1px solid rgba(124,58,237,.25)"
          }}>
            <div style={{ width:38, height:38, borderRadius:12,
              background:"rgba(124,58,237,.3)", display:"flex", alignItems:"center",
              justifyContent:"center" }}>
              <Ico.Stars size={18} style={{ color:"#c4b5fd" }}/>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:800, color:"#fff", margin:0,
                fontFamily:"'Outfit',sans-serif" }}>Aidvisora AI</p>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:3, background:T.emerald, animation:"pulse 2s ease infinite" }}/>
                <span style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,.5)",
                  fontFamily:"'Outfit',sans-serif" }}>Online — GPT-4o</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, paddingBottom:8 }}>
            {chatHistory.map(m=>(
              <div key={m.id} style={{ display:"flex", justifyContent:m.from==="me"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"80%", padding:"11px 14px",
                  background: m.from==="me" ? `linear-gradient(135deg,${T.purple},${T.indigo})` : T.surface,
                  borderRadius: m.from==="me" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                  border: m.from==="me" ? "none" : `1px solid ${T.border}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,.08)"
                }}>
                  <p style={{ fontSize:13, fontWeight:600, color:m.from==="me"?"#fff":T.slate800,
                    margin:0, lineHeight:1.5, fontFamily:"'Outfit',sans-serif" }}>{m.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ display:"flex", gap:9, paddingTop:10,
            borderTop:`1px solid ${T.border}`, marginTop:"auto" }}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&sendMsg()}
              placeholder="Zeptejte se AI asistenta…"
              style={{ flex:1, padding:"12px 14px", background:T.surfaceAlt,
                border:`1.5px solid ${T.border}`, borderRadius:13, fontSize:13,
                fontWeight:600, outline:"none", fontFamily:"'Outfit',sans-serif",
                color:T.slate800 }}/>
            <button onClick={sendMsg} style={{ width:44, height:44, borderRadius:13,
              background:`linear-gradient(135deg,${T.purple},${T.indigo})`,
              border:"none", display:"flex", alignItems:"center",
              justifyContent:"center", cursor:"pointer",
              boxShadow:`0 4px 14px ${T.purple}40` }}>
              <Ico.ArrR size={16} style={{ color:"#fff" }}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MESSAGES ──────────────────────────────────
function MessagesScreen({ navigate }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, paddingBottom:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Zprávy</h1>
        <button style={{ width:36, height:36, borderRadius:12, background:T.navy, border:"none",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ico.Plus size={16} style={{ color:"#fff"}} strokeWidth={2.5}/>
        </button>
      </div>
      <div style={{ position:"relative" }}>
        <Ico.Search size={15} style={{ position:"absolute", left:13, top:"50%",
          transform:"translateY(-50%)", color:T.slate400, pointerEvents:"none" }}/>
        <input placeholder="Hledat zprávy…" style={{ width:"100%", padding:"11px 12px 11px 36px",
          background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:14,
          fontSize:13, fontWeight:600, outline:"none", fontFamily:"'Outfit',sans-serif",
          color:T.slate800, boxSizing:"border-box" }}/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
        {MESSAGES.map(m=>(
          <div key={m.id} onClick={()=>navigate("messages_chat")}
            style={{ display:"flex", alignItems:"center", gap:13,
              padding:"14px 12px", borderRadius:16, cursor:"pointer",
              background: m.unread>0 ? `${T.purple}05` : "transparent",
              transition:"background .15s" }}>
            <Avatar initials={m.initials} hue={m.hue} size={46}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:14, fontWeight: m.unread>0?800:700, color:T.slate900,
                  fontFamily:"'Outfit',sans-serif" }}>{m.from}</span>
                <span style={{ fontSize:11, fontWeight:600, color:T.slate400,
                  fontFamily:"'Outfit',sans-serif" }}>{m.time}</span>
              </div>
              <p style={{ fontSize:12, fontWeight: m.unread>0?700:600,
                color: m.unread>0 ? T.slate700 : T.slate400,
                margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                fontFamily:"'Outfit',sans-serif" }}>{m.last}</p>
            </div>
            {m.unread>0 && <span style={{ width:20, height:20, borderRadius:10,
              background:T.purple, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:9, fontWeight:900,
              color:"#fff", flexShrink:0 }}>{m.unread}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CHAT THREAD ───────────────────────────────
function ChatScreen() {
  const [msgs, setMsgs] = useState(CHAT_MSGS);
  const [input, setInput] = useState("");

  const send = () => {
    if (!input.trim()) return;
    setMsgs(m => [...m, { id:Date.now(), from:"me", text:input, time:"Teď" }]);
    setInput("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100% - 50px)" }}>
      {/* Contact header */}
      <div style={{ display:"flex", alignItems:"center", gap:11, padding:"0 0 14px",
        borderBottom:`1px solid ${T.border}`, marginBottom:12 }}>
        <Avatar initials="JN" hue="amber" size={42}/>
        <div>
          <p style={{ fontSize:14, fontWeight:800, color:T.slate900, margin:0,
            fontFamily:"'Outfit',sans-serif" }}>Jan Novák</p>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:3, background:T.emerald }}/>
            <span style={{ fontSize:10, fontWeight:600, color:T.emerald,
              fontFamily:"'Outfit',sans-serif" }}>Online</span>
          </div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:7 }}>
          <button style={{ width:32, height:32, borderRadius:10, background:T.surfaceAlt,
            border:`1px solid ${T.border}`, display:"flex", alignItems:"center",
            justifyContent:"center", cursor:"pointer" }}>
            <Ico.Phone size={14} style={{ color:T.slate500 }}/>
          </button>
          <button style={{ width:32, height:32, borderRadius:10, background:T.surfaceAlt,
            border:`1px solid ${T.border}`, display:"flex", alignItems:"center",
            justifyContent:"center", cursor:"pointer" }}>
            <Ico.Video size={14} style={{ color:T.slate500 }}/>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, paddingBottom:10 }}>
        {msgs.map(m=>(
          <div key={m.id} style={{ display:"flex", justifyContent:m.from==="me"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"78%", padding:"10px 14px",
              background: m.from==="me" ? `linear-gradient(135deg,${T.purple},${T.indigo})` : T.surface,
              borderRadius: m.from==="me" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
              border: m.from==="me" ? "none" : `1px solid ${T.border}`,
            }}>
              <p style={{ fontSize:13, fontWeight:600, color:m.from==="me"?"#fff":T.slate800,
                margin:0, lineHeight:1.5, fontFamily:"'Outfit',sans-serif" }}>{m.text}</p>
              <p style={{ fontSize:9, fontWeight:600,
                color:m.from==="me"?"rgba(255,255,255,.5)":T.slate400,
                margin:"4px 0 0", textAlign:m.from==="me"?"right":"left",
                fontFamily:"'Outfit',sans-serif" }}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ display:"flex", gap:9, paddingTop:12,
        borderTop:`1px solid ${T.border}`, marginTop:"auto" }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Napište zprávu…"
          style={{ flex:1, padding:"12px 14px", background:T.surfaceAlt,
            border:`1.5px solid ${T.border}`, borderRadius:13, fontSize:13,
            fontWeight:600, outline:"none", fontFamily:"'Outfit',sans-serif",
            color:T.slate800 }}/>
        <button onClick={send} style={{ width:44, height:44, borderRadius:13,
          background:`linear-gradient(135deg,${T.purple},${T.indigo})`,
          border:"none", display:"flex", alignItems:"center",
          justifyContent:"center", cursor:"pointer",
          boxShadow:`0 4px 14px ${T.purple}40` }}>
          <Ico.ArrR size={16} style={{ color:"#fff" }}/>
        </button>
      </div>
    </div>
  );
}

// ── CALCULATORS ───────────────────────────────
function CalculatorsScreen() {
  const [active, setActive] = useState(null);
  const [investInput, setInvestInput] = useState({ amount:10000, monthly:2000, years:10, rate:8 });

  const futureValue = () => {
    const r = investInput.rate/100/12;
    const n = investInput.years*12;
    const fv = investInput.amount * Math.pow(1+r,n) + investInput.monthly * (Math.pow(1+r,n)-1)/r;
    return Math.round(fv);
  };

  if (active) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <button onClick={()=>setActive(null)} style={{ width:32, height:32, borderRadius:10,
            background:T.surfaceAlt, border:`1px solid ${T.border}`, display:"flex",
            alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <Ico.ArrL size={14} style={{ color:T.slate500 }}/>
          </button>
          <h1 style={{ fontSize:20, fontWeight:900, color:T.slate900,
            fontFamily:"'Plus Jakarta Sans',sans-serif", margin:0 }}>
            {CALCS_DATA.find(c=>c.id===active)?.title}
          </h1>
        </div>
        {active==="inv" && (
          <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
            {[
              { label:"Jednorázová investice", key:"amount", unit:"Kč", min:0, max:1000000, step:1000 },
              { label:"Měsíční příspěvek",      key:"monthly", unit:"Kč/měs", min:0, max:50000, step:500 },
              { label:"Investiční horizont",    key:"years",  unit:"let",    min:1, max:40,    step:1   },
              { label:"Očekávaný výnos",        key:"rate",   unit:"% p.a.", min:1, max:20,    step:0.5 },
            ].map(({ label, key, unit, min, max, step })=>(
              <Card key={key} style={{ padding:"15px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:T.slate700, fontFamily:"'Outfit',sans-serif" }}>{label}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:T.indigo,
                    fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                    {investInput[key]} {unit}
                  </span>
                </div>
                <input type="range" min={min} max={max} step={step}
                  value={investInput[key]}
                  onChange={e=>setInvestInput(v=>({...v,[key]:Number(e.target.value)}))}
                  style={{ width:"100%", accentColor:T.purple }}/>
              </Card>
            ))}
            <div style={{ background:`linear-gradient(135deg,${T.navy},#1e0d40)`,
              borderRadius:20, padding:"22px", textAlign:"center",
              border:"1px solid rgba(124,58,237,.25)" }}>
              <p style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,.5)",
                margin:"0 0 5px", textTransform:"uppercase", letterSpacing:"0.09em",
                fontFamily:"'Outfit',sans-serif" }}>Odhadovaná hodnota za {investInput.years} let</p>
              <p style={{ fontSize:32, fontWeight:900, color:"#fff", margin:0,
                fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {futureValue().toLocaleString("cs-CZ")} Kč
              </p>
              <p style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,.4)",
                margin:"8px 0 0", fontFamily:"'Outfit',sans-serif" }}>
                Vloženo: {(investInput.amount + investInput.monthly*12*investInput.years).toLocaleString("cs-CZ")} Kč
              </p>
            </div>
          </div>
        )}
        {active!=="inv" && (
          <Card style={{ padding:"32px", textAlign:"center" }}>
            <div style={{ width:56, height:56, borderRadius:18, background:T.surfaceAlt,
              display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
              {(() => { const c = CALCS_DATA.find(x=>x.id===active); if(!c) return null; const Icon=c.Icon; return <Icon size={24} style={{ color:c.color }}/>; })()}
            </div>
            <p style={{ fontSize:14, fontWeight:700, color:T.slate600, fontFamily:"'Outfit',sans-serif" }}>
              Tato kalkulačka se připravuje
            </p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, paddingBottom:100 }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
        fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Kalkulačky</h1>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {CALCS_DATA.map(c=>{
          const Icon = c.Icon;
          return (
            <Card key={c.id} onClick={()=>setActive(c.id)} style={{ padding:"22px 16px",
              display:"flex", flexDirection:"column", alignItems:"center",
              gap:11, textAlign:"center", cursor:"pointer", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-20, right:-20, width:80, height:80,
                borderRadius:"50%", background:`${c.color}08`, pointerEvents:"none" }}/>
              <div style={{ width:52, height:52, borderRadius:17, background:c.bg,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon size={24} style={{ color:c.color }}/>
              </div>
              <span style={{ fontSize:13, fontWeight:800, color:T.slate800,
                fontFamily:"'Outfit',sans-serif" }}>{c.title}</span>
            </Card>
          );
        })}
      </div>

      {/* Complex analysis CTA */}
      <div style={{ background:`linear-gradient(135deg,${T.navy},#1e0d40)`,
        borderRadius:22, padding:"22px", display:"flex", alignItems:"center", gap:16,
        border:"1px solid rgba(124,58,237,.25)", cursor:"pointer"
      }}>
        <div style={{ width:48, height:48, borderRadius:16,
          background:"rgba(124,58,237,.3)", display:"flex",
          alignItems:"center", justifyContent:"center" }}>
          <Ico.Stars size={22} style={{ color:"#c4b5fd" }}/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:14, fontWeight:800, color:"#fff", margin:"0 0 3px",
            fontFamily:"'Outfit',sans-serif" }}>Komplexní analýza</p>
          <p style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,.5)", margin:0,
            fontFamily:"'Outfit',sans-serif" }}>Spojte všechny výpočty do jednoho plánu</p>
        </div>
        <Ico.ArrR size={18} style={{ color:"rgba(255,255,255,.4)" }}/>
      </div>
    </div>
  );
}

// ── FINANCIAL ANALYSES ────────────────────────
function AnalysesScreen() {
  const [filter, setFilter] = useState("all");

  const stConf = {
    completed: { label:"Hotovo",   color:T.emerald },
    review:    { label:"Ke schl.", color:T.amber   },
    draft:     { label:"Koncept",  color:T.slate400 },
  };

  const filtered = ANALYSES_DATA.filter(a => filter==="all" || a.status===filter);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, paddingBottom:100 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Analýzy</h1>
        <GlassBtn primary style={{ padding:"9px 14px", fontSize:11 }}>
          <Ico.Plus size={13}/> Nová
        </GlassBtn>
      </div>

      {/* Wizard CTA */}
      <div style={{ background:`linear-gradient(135deg,${T.indigo},${T.purple})`,
        borderRadius:22, padding:"20px 22px",
        boxShadow:`0 8px 28px ${T.indigo}30`, cursor:"pointer"
      }}>
        <div style={{ width:44, height:44, borderRadius:14,
          background:"rgba(255,255,255,.15)", display:"flex",
          alignItems:"center", justifyContent:"center", marginBottom:12 }}>
          <Ico.Pie size={22} style={{ color:"#fff" }}/>
        </div>
        <h3 style={{ fontSize:17, fontWeight:800, color:"#fff",
          fontFamily:"'Plus Jakarta Sans',sans-serif", margin:"0 0 6px" }}>
          Komplexní finanční plán
        </h3>
        <p style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,.65)",
          margin:"0 0 14px", lineHeight:1.5, fontFamily:"'Outfit',sans-serif" }}>
          7krokový průvodce: cashflow, bilance, cíle, strategie → PDF report.
        </p>
        <button style={{ background:"rgba(255,255,255,.95)", border:"none",
          borderRadius:11, padding:"9px 16px", color:T.indigo, fontSize:11,
          fontWeight:800, cursor:"pointer", fontFamily:"'Outfit',sans-serif" }}>
          Spustit Wizard →
        </button>
      </div>

      <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
        {[["all","Všechny"],["draft","Koncepty"],["review","Ke schl."],["completed","Hotové"]]
          .map(([id,lbl])=>(
            <Pill key={id} active={filter===id} onClick={()=>setFilter(id)}>{lbl}</Pill>
          ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {filtered.map(a=>{
          const s = stConf[a.status];
          return (
            <Card key={a.id} style={{ padding:"16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ width:36, height:36, borderRadius:11,
                    background:`${a.status==="completed"?T.indigo:T.slate400}12`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Ico.File size={16} style={{ color:a.status==="completed"?T.indigo:T.slate400 }}/>
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:800, color:T.slate900, margin:0,
                      fontFamily:"'Outfit',sans-serif" }}>{a.client}</p>
                    <p style={{ fontSize:11, fontWeight:600, color:T.slate400, margin:"2px 0 0",
                      fontFamily:"'Outfit',sans-serif" }}>{a.type}</p>
                  </div>
                </div>
                <Badge color={s.color}>{s.label}</Badge>
              </div>
              {a.status!=="completed" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:T.slate400, fontFamily:"'Outfit',sans-serif" }}>Progres</span>
                    <span style={{ fontSize:10, fontWeight:800, color:T.slate800, fontFamily:"'Outfit',sans-serif" }}>{a.progress}%</span>
                  </div>
                  <Bar value={a.progress} color={T.indigo} h={4}/>
                </div>
              )}
              <div style={{ display:"flex", gap:7, marginTop:11 }}>
                {a.status==="completed"
                  ? <GlassBtn style={{ flex:1, fontSize:11 }}><Ico.Download size={12}/> PDF</GlassBtn>
                  : <GlassBtn style={{ flex:1, fontSize:11 }}><Ico.Edit2 size={12}/> Pokračovat</GlassBtn>
                }
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── PRODUCTION ────────────────────────────────
function ProductionScreen() {
  const [period, setPeriod] = useState("mesic");

  const segs = [
    { label:"Životní poj.", pct:45, color:T.indigo,  amount:"560 250 Kč" },
    { label:"Investice",    pct:30, color:T.emerald, amount:"373 500 Kč" },
    { label:"Hypotéky",     pct:15, color:T.cyan,    amount:"186 750 Kč" },
    { label:"Neživotní",    pct:10, color:T.amber,   amount:"124 500 Kč" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100 }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
        fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Produkce</h1>

      <SegTab options={[{id:"mesic",label:"Měsíc"},{id:"kvartal",label:"Kvartál"},{id:"rok",label:"Rok"}]}
        active={period} onChange={setPeriod}/>

      {/* Main KPI */}
      <div style={{ background:`linear-gradient(135deg,${T.navy},#1e0d40)`,
        borderRadius:24, padding:"22px", border:"1px solid rgba(124,58,237,.25)" }}>
        <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.09em",
          textTransform:"uppercase", color:"rgba(255,255,255,.4)",
          margin:"0 0 3px", fontFamily:"'Outfit',sans-serif" }}>Provize — Březen 2026</p>
        <p style={{ fontSize:32, fontWeight:900, color:"#fff", margin:"0 0 10px",
          fontFamily:"'Plus Jakarta Sans',sans-serif" }}>1 245 000 Kč</p>
        <Bar value={83} color={T.violet} h={6} bg="rgba(255,255,255,.12)"/>
        <p style={{ fontSize:11, fontWeight:700, color:"#a78bfa", marginTop:7,
          fontFamily:"'Outfit',sans-serif" }}>83% z cíle 1 500 000 Kč</p>
      </div>

      {/* Chart */}
      <Card style={{ padding:"18px" }}>
        <p style={{ fontSize:11, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
          color:T.slate400, marginBottom:14, fontFamily:"'Outfit',sans-serif" }}>Trend produkce</p>
        <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:84 }}>
          {PERF_DATA.map((p,i)=>(
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
              <div style={{ width:"100%", height:`${p.v}%`, borderRadius:"6px 6px 0 0",
                background: p.cur ? `linear-gradient(180deg,${T.purple},${T.indigo})` : T.slate200,
                minHeight:4, transition:"height .4s ease",
                boxShadow: p.cur ? `0 4px 12px ${T.purple}40` : "none"
              }}/>
              <span style={{ fontSize:8, fontWeight:700, color:p.cur?T.purple:T.slate400,
                fontFamily:"'Outfit',sans-serif" }}>{p.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Segments */}
      <Card style={{ padding:"18px" }}>
        <p style={{ fontSize:11, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
          color:T.slate400, marginBottom:14, fontFamily:"'Outfit',sans-serif" }}>Struktura produkce</p>
        {segs.map(s=>(
          <div key={s.label} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:12, fontWeight:700, color:T.slate700, fontFamily:"'Outfit',sans-serif" }}>{s.label}</span>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:12, fontWeight:700, color:T.slate500, fontFamily:"'Outfit',sans-serif" }}>{s.amount}</span>
                <span style={{ fontSize:11, fontWeight:800, color:s.color, fontFamily:"'Outfit',sans-serif" }}>{s.pct}%</span>
              </div>
            </div>
            <Bar value={s.pct} color={s.color} h={5}/>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── PLAN ──────────────────────────────────────
function PlanScreen() {
  const [period, setPeriod] = useState("month");
  const d = period==="month"
    ? { prod:185000, prodT:300000, meet:12, meetT:25, clients:3, clientsT:6 }
    : { prod:520000, prodT:900000, meet:45, meetT:75, clients:11, clientsT:18 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100 }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
        fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Můj Plán</h1>

      <SegTab options={[{id:"month",label:"Měsíc"},{id:"quarter",label:"Q1 2026"}]}
        active={period} onChange={setPeriod}/>

      {/* Vision */}
      <div style={{ background:`linear-gradient(135deg,${T.navy},#1e0d40)`,
        borderRadius:22, padding:"20px", border:"1px solid rgba(124,58,237,.25)" }}>
        <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase",
          color:"#a78bfa", margin:"0 0 13px", fontFamily:"'Outfit',sans-serif",
          display:"flex", alignItems:"center", gap:6 }}>
          <Ico.Flag size={11}/> Moje vize
        </p>
        {[{t:"Vlastní kancelář (kauce)",p:85,c:"#34d399"},{t:"Pasivní příjem 50k/měs",p:40,c:"#fbbf24"}]
          .map(g=>(
            <div key={g.t} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,.85)",
                  fontFamily:"'Outfit',sans-serif" }}>{g.t}</span>
                <span style={{ fontSize:13, fontWeight:900, color:g.c,
                  fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{g.p}%</span>
              </div>
              <Bar value={g.p} color={g.c} h={5} bg="rgba(255,255,255,.1)"/>
            </div>
          ))}
      </div>

      {/* Production */}
      <Card style={{ padding:"18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
          <div>
            <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
              color:T.slate400, margin:"0 0 3px", fontFamily:"'Outfit',sans-serif" }}>Produkce</p>
            <p style={{ fontSize:26, fontWeight:900, color:T.slate900, margin:0,
              fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              {(d.prod/1000).toFixed(0)}k <span style={{ fontSize:14, color:T.slate400 }}>/ {(d.prodT/1000).toFixed(0)}k Kč</span>
            </p>
          </div>
          <Badge color={T.emerald}>{Math.round(d.prod/d.prodT*100)}%</Badge>
        </div>
        <Bar value={d.prod/d.prodT*100} color={T.emerald} h={7}/>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        {[
          { label:"Schůzky", cur:d.meet, tgt:d.meetT, color:T.indigo },
          { label:"Noví klienti", cur:d.clients, tgt:d.clientsT, color:T.amber },
        ].map(({ label, cur, tgt, color })=>{
          const pct = Math.round(cur/tgt*100);
          return (
            <Card key={label} style={{ padding:"16px" }}>
              <p style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em",
                textTransform:"uppercase", color:T.slate400, margin:"0 0 7px",
                fontFamily:"'Outfit',sans-serif" }}>{label}</p>
              <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:9 }}>
                <span style={{ fontSize:26, fontWeight:900, color:T.slate900,
                  fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{cur}</span>
                <span style={{ fontSize:12, fontWeight:700, color:T.slate400,
                  fontFamily:"'Outfit',sans-serif" }}>/ {tgt}</span>
              </div>
              <Bar value={pct} color={color} h={5}/>
              <p style={{ fontSize:10, fontWeight:800, color, marginTop:5,
                fontFamily:"'Outfit',sans-serif" }}>{pct}%</p>
            </Card>
          );
        })}
      </div>

      {/* Funnel */}
      <Card style={{ padding:"18px" }}>
        <p style={{ fontSize:11, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
          color:T.slate400, marginBottom:14, fontFamily:"'Outfit',sans-serif" }}>Reverzní matematika</p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-around" }}>
          {[{l:"Volání",v:120,c:T.indigo},{l:"Schůzky",v:25,c:T.purple},{l:"Smlouvy",v:8,c:T.emerald}]
            .map(({ l, v, c }, i, arr) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ width:50, height:50, borderRadius:16, background:`${c}12`,
                    display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 6px" }}>
                    <span style={{ fontSize:18, fontWeight:900, color:c,
                      fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{v}</span>
                  </div>
                  <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.08em",
                    textTransform:"uppercase", color:T.slate400, fontFamily:"'Outfit',sans-serif" }}>{l}</span>
                </div>
                {i<arr.length-1 && <Ico.ChevR size={14} style={{ color:T.slate300 }}/>}
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

// ── TEAM ──────────────────────────────────────
function TeamScreen() {
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const generateSummary = () => {
    setAiLoading(true);
    setTimeout(()=>{
      setAiSummary("Tým je na dobré cestě. Produkce roste (3.1M Kč). Doporučuji 1-on-1 s Karlem a Petrem. Nováčci se adaptují dle plánu.");
      setAiLoading(false);
    }, 1400);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100 }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
        fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Můj Tým</h1>

      {/* Team KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        <Card style={{ padding:"16px" }}>
          <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase",
            color:T.slate400, margin:"0 0 4px", fontFamily:"'Outfit',sans-serif" }}>Produkce týmu</p>
          <p style={{ fontSize:22, fontWeight:900, color:T.slate900, margin:"0 0 4px",
            fontFamily:"'Plus Jakarta Sans',sans-serif" }}>3.77M</p>
          <span style={{ fontSize:10, fontWeight:700, color:T.emerald, display:"flex",
            alignItems:"center", gap:3, fontFamily:"'Outfit',sans-serif" }}>
            <Ico.TrendUp size={10}/> +12% vs. min. měsíc
          </span>
        </Card>
        <Card style={{ padding:"16px" }}>
          <p style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase",
            color:T.slate400, margin:"0 0 4px", fontFamily:"'Outfit',sans-serif" }}>Počet schůzek</p>
          <p style={{ fontSize:22, fontWeight:900, color:T.slate900, margin:"0 0 4px",
            fontFamily:"'Plus Jakarta Sans',sans-serif" }}>85</p>
          <span style={{ fontSize:10, fontWeight:700, color:T.rose, display:"flex",
            alignItems:"center", gap:3, fontFamily:"'Outfit',sans-serif" }}>
            <Ico.TrendD size={10}/> -5%
          </span>
        </Card>
      </div>

      {/* AI Summary */}
      {aiSummary ? (
        <div style={{ background:`${T.purple}10`, border:`1.5px solid ${T.purple}30`,
          borderRadius:18, padding:"16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <Ico.Stars size={14} style={{ color:T.purple }}/>
            <span style={{ fontSize:11, fontWeight:800, color:T.purple, letterSpacing:"0.08em",
              textTransform:"uppercase", fontFamily:"'Outfit',sans-serif" }}>AI Shrnutí</span>
          </div>
          <p style={{ fontSize:13, fontWeight:600, color:T.slate700, margin:0, lineHeight:1.5,
            fontFamily:"'Outfit',sans-serif" }}>{aiSummary}</p>
        </div>
      ) : (
        <button onClick={generateSummary} style={{ display:"flex", alignItems:"center",
          justifyContent:"center", gap:9, padding:"14px",
          background: aiLoading ? T.surfaceAlt : `linear-gradient(135deg,${T.navy},#1e0d40)`,
          border:"none", borderRadius:16, cursor: aiLoading?"not-allowed":"pointer",
          color:"#fff", fontSize:13, fontWeight:700, fontFamily:"'Outfit',sans-serif",
          transition:"all .2s"
        }}>
          {aiLoading
            ? <><Ico.Refresh size={14} className="spin"/> Generuji AI shrnutí…</>
            : <><Ico.Stars size={14} style={{ color:"#c4b5fd"}}/> Generovat AI shrnutí týmu</>
          }
        </button>
      )}

      {/* Chart */}
      <Card style={{ padding:"18px" }}>
        <p style={{ fontSize:11, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
          color:T.slate400, marginBottom:14, fontFamily:"'Outfit',sans-serif" }}>Výkon v čase</p>
        <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
          {PERF_DATA.map((p,i)=>(
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
              <div style={{ width:"100%", height:`${p.v}%`,
                borderRadius:"6px 6px 0 0",
                background: p.cur ? `linear-gradient(180deg,${T.purple},${T.indigo})` : T.slate200,
                minHeight:4, boxShadow: p.cur ? `0 4px 12px ${T.purple}40` : "none"
              }}/>
              <span style={{ fontSize:8, fontWeight:700, color:p.cur?T.purple:T.slate400,
                fontFamily:"'Outfit',sans-serif" }}>{p.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Team members */}
      <p style={{ fontSize:11, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
        color:T.slate400, margin:0, fontFamily:"'Outfit',sans-serif" }}>Členové týmu</p>
      <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
        {TEAM_DATA.map(m=>(
          <Card key={m.id} style={{ padding:"15px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:11 }}>
              <div style={{ position:"relative" }}>
                <Avatar initials={m.initials} hue={m.hue} size={44}/>
                <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10,
                  borderRadius:5, background:m.status==="online"?T.emerald:T.slate300,
                  border:"2px solid "+T.surface }}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:T.slate900,
                    fontFamily:"'Outfit',sans-serif" }}>{m.name}</span>
                  {m.alert && <Ico.Warn size={13} style={{ color:T.rose }}/>}
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:T.slate400,
                  letterSpacing:"0.05em", textTransform:"uppercase",
                  fontFamily:"'Outfit',sans-serif" }}>{m.role}</span>
              </div>
              <Badge color={m.trend==="up"?T.emerald:T.rose}>
                {m.trend==="up"?<Ico.TrendUp size={9}/>:<Ico.TrendD size={9}/>} {m.prod}
              </Badge>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", gap:10 }}>
              <div>
                <p style={{ fontSize:9, fontWeight:800, color:T.slate400, textTransform:"uppercase",
                  letterSpacing:"0.06em", margin:"0 0 3px", fontFamily:"'Outfit',sans-serif" }}>Schůzky</p>
                <p style={{ fontSize:14, fontWeight:900, color:T.slate900, margin:0,
                  fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{m.meet}</p>
              </div>
              <div>
                <p style={{ fontSize:9, fontWeight:800, color:T.slate400, textTransform:"uppercase",
                  letterSpacing:"0.06em", margin:"0 0 3px", fontFamily:"'Outfit',sans-serif" }}>Aktivita</p>
                <p style={{ fontSize:14, fontWeight:900, color:T.slate900, margin:0,
                  fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{m.act}%</p>
              </div>
              <div>
                <p style={{ fontSize:9, fontWeight:800, color:T.slate400, textTransform:"uppercase",
                  letterSpacing:"0.06em", margin:"0 0 5px", fontFamily:"'Outfit',sans-serif" }}>Výkon</p>
                <Bar value={m.act} color={m.act>80?T.emerald:m.act>60?T.amber:T.rose} h={5}/>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── MINDMAP ───────────────────────────────────
function MindmapScreen() {
  const nodes = [
    { id:"root", x:160, y:200, type:"core",  label:"Rodina Novákova", sub:"Finanční plán" },
    { id:"inv",  x:300, y:100, type:"cat",   label:"Investice",       color:T.emerald },
    { id:"bydl", x:300, y:200, type:"cat",   label:"Bydlení",         color:T.indigo  },
    { id:"zaj",  x:300, y:300, type:"cat",   label:"Zajištění",       color:T.rose    },
    { id:"cile", x:20,  y:200, type:"cat",   label:"Cíle",            color:T.amber   },
    { id:"p1",   x:390, y:75,  type:"item",  label:"Portu",           val:"450 000 Kč"},
    { id:"p2",   x:390, y:125, type:"item",  label:"Conseq",          val:"1.2M Kč"   },
    { id:"h1",   x:390, y:175, type:"item",  label:"Hypotéka ČS",     val:"-4.5M Kč"  },
    { id:"z1",   x:390, y:275, type:"item",  label:"Životní poj.",    val:"Krytí 3M"  },
    { id:"z2",   x:390, y:325, type:"item",  label:"Odpovědnost",     val:"Navrženo"  },
    { id:"g1",   x:-50, y:175, type:"goal",  label:"Auto 2027",       val:"45%"       },
    { id:"g2",   x:-50, y:225, type:"goal",  label:"Předč. důchod",   val:"12%"       },
  ];

  const edges = [
    ["root","inv"],["root","bydl"],["root","zaj"],["root","cile"],
    ["inv","p1"],["inv","p2"],
    ["bydl","h1"],
    ["zaj","z1"],["zaj","z2"],
    ["cile","g1"],["cile","g2"],
  ];

  const [zoom, setZoom] = useState(1);
  const [pan, setPan]   = useState({ x:60, y:30 });
  const [drag, setDrag] = useState(null);

  const typeStyle = (n) => {
    if (n.type==="core") return { w:100, h:50, r:16, bg:`linear-gradient(135deg,${T.navy},#1e0d40)`, tc:"#fff", fs:11 };
    if (n.type==="cat")  return { w:88,  h:32, r:12, bg:`${n.color}18`, tc:n.color, fs:10 };
    if (n.type==="goal") return { w:80,  h:36, r:12, bg:`${T.amber}15`, tc:T.amber, fs:9 };
    return { w:90, h:32, r:10, bg:T.surface, tc:T.slate700, fs:9 };
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:80 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
          fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Mindmap</h1>
        <div style={{ display:"flex", gap:7 }}>
          <GlassBtn small onClick={()=>setZoom(z=>Math.max(.5,z-.15))}><Ico.ZoomOut size={13}/></GlassBtn>
          <GlassBtn small onClick={()=>setZoom(z=>Math.min(2,z+.15))}><Ico.ZoomIn size={13}/></GlassBtn>
        </div>
      </div>

      <Card style={{ padding:0, overflow:"hidden", height:340, position:"relative",
        background:"#fafafc" }}>
        <svg width="100%" height="100%" style={{ position:"absolute", inset:0 }}>
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill={T.slate200}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {edges.map(([s,t])=>{
              const sn = nodes.find(n=>n.id===s);
              const tn = nodes.find(n=>n.id===t);
              const ss = typeStyle(sn), ts = typeStyle(tn);
              const x1 = sn.x+pan.x/zoom+ss.w/2, y1 = sn.y+pan.y/zoom+ss.h/2;
              const x2 = tn.x+pan.x/zoom+ts.w/2, y2 = tn.y+pan.y/zoom+ts.h/2;
              return <line key={s+t} x1={sn.x+ss.w/2} y1={sn.y+ss.h/2}
                x2={tn.x+ts.w/2} y2={tn.y+ts.h/2}
                stroke={T.slate200} strokeWidth={1.5} strokeDasharray={tn.type==="goal"?"4,3":"none"}/>;
            })}
            {nodes.map(n=>{
              const s = typeStyle(n);
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                  <rect width={s.w} height={s.h} rx={s.r}
                    fill={typeof s.bg==="string"&&s.bg.startsWith("linear")?"url(#"+n.id+"g)":s.bg}
                    stroke={T.border} strokeWidth={1}/>
                  {typeof s.bg==="string"&&s.bg.startsWith("linear")&&(
                    <defs>
                      <linearGradient id={n.id+"g"} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={T.navy}/>
                        <stop offset="100%" stopColor="#1e0d40"/>
                      </linearGradient>
                    </defs>
                  )}
                  <text x={s.w/2} y={s.h/2-2} textAnchor="middle" dominantBaseline="middle"
                    fill={s.tc} fontSize={s.fs} fontWeight="800" fontFamily="'Outfit',sans-serif">
                    {n.label}
                  </text>
                  {n.val && <text x={s.w/2} y={s.h/2+10} textAnchor="middle"
                    fill={s.tc+"99"} fontSize={8} fontFamily="'Outfit',sans-serif">{n.val}</text>}
                  {n.sub && <text x={s.w/2} y={s.h/2+10} textAnchor="middle"
                    fill="rgba(255,255,255,.5)" fontSize={8} fontFamily="'Outfit',sans-serif">{n.sub}</text>}
                </g>
              );
            })}
          </g>
        </svg>
        <div style={{ position:"absolute", bottom:10, right:10, fontSize:9,
          fontWeight:700, color:T.slate400, fontFamily:"'Outfit',sans-serif" }}>
          Zoom: {Math.round(zoom*100)}%
        </div>
      </Card>

      <Card style={{ padding:"16px" }}>
        <p style={{ fontSize:11, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase",
          color:T.slate400, margin:"0 0 11px", fontFamily:"'Outfit',sans-serif" }}>Legenda</p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {[{l:"Středobod",c:T.navy},{l:"Kategorie",c:T.indigo},{l:"Produkt",c:T.slate500},{l:"Cíl",c:T.amber}]
            .map(({ l, c })=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:c }}/>
                <span style={{ fontSize:10, fontWeight:700, color:T.slate500,
                  fontFamily:"'Outfit',sans-serif" }}>{l}</span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

// ── MENU ──────────────────────────────────────
function MenuScreen({ navigate }) {
  const items = [
    { id:"plan",       label:"Můj Plán",        Icon:Ico.Target,  color:T.rose,    bg:"rgba(244,63,94,.1)"   },
    { id:"team",       label:"Tým",              Icon:Ico.Users,   color:T.purple,  bg:"rgba(124,58,237,.1)"  },
    { id:"production", label:"Produkce",         Icon:Ico.Bar,     color:T.indigo,  bg:"rgba(79,70,229,.1)"   },
    { id:"analyses",   label:"Analýzy",          Icon:Ico.Pie,     color:T.cyan,    bg:"rgba(6,182,212,.1)"   },
    { id:"calcs",      label:"Kalkulačky",       Icon:Ico.Calc,    color:T.amber,   bg:"rgba(245,158,11,.1)"  },
    { id:"ai_assistant",label:"AI Smlouvy",      Icon:Ico.Brain,   color:T.violet,  bg:"rgba(139,92,246,.1)"  },
    { id:"household",  label:"Domácnosti",       Icon:Ico.Build,   color:T.emerald, bg:"rgba(16,185,129,.1)"  },
    { id:"mindmap",    label:"Mindmap",          Icon:Ico.Net,     color:T.slate600,bg:"rgba(71,85,105,.1)"   },
    { id:"messages",   label:"Zprávy",           Icon:Ico.Msg,     color:T.blue||"#3b82f6", bg:"rgba(59,130,246,.1)" },
    { id:"calendar",   label:"Kalendář",         Icon:Ico.Cal,     color:T.rose,    bg:"rgba(244,63,94,.08)"  },
    { id:"settings",   label:"Nastavení",        Icon:Ico.Gear,    color:T.slate500,bg:"rgba(100,116,139,.1)" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13, paddingBottom:100 }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:T.slate900,
        fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"-0.04em", margin:0 }}>Nástroje</h1>

      {/* AI highlight */}
      <div onClick={()=>navigate("ai_assistant")} style={{
        background:`linear-gradient(135deg,${T.indigo},${T.purple})`,
        borderRadius:22, padding:"20px 22px", cursor:"pointer",
        display:"flex", alignItems:"center", gap:16,
        boxShadow:`0 8px 28px ${T.purple}35`
      }}>
        <div style={{ width:48, height:48, borderRadius:16,
          background:"rgba(255,255,255,.15)", display:"flex",
          alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Ico.Stars size={22} style={{ color:"#fff"}}/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:15, fontWeight:900, color:"#fff", margin:"0 0 3px",
            fontFamily:"'Plus Jakarta Sans',sans-serif" }}>AI Review smluv</p>
          <p style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,.6)", margin:0,
            fontFamily:"'Outfit',sans-serif" }}>Automatická extrakce dat z PDF smluv</p>
        </div>
        <Ico.ChevR size={18} style={{ color:"rgba(255,255,255,.5)"}}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {items.filter(i=>i.id!=="ai_assistant").map(item=>{
          const Icon = item.Icon;
          return (
            <Card key={item.id} onClick={()=>navigate(item.id)} style={{ padding:"18px 10px",
              display:"flex", flexDirection:"column", alignItems:"center", gap:9,
              textAlign:"center", cursor:"pointer" }}>
              <div style={{ width:46, height:46, borderRadius:15, background:item.bg,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon size={22} style={{ color:item.color }}/>
              </div>
              <span style={{ fontSize:11, fontWeight:800, color:T.slate700,
                fontFamily:"'Outfit',sans-serif", lineHeight:1.2 }}>{item.label}</span>
            </Card>
          );
        })}
      </div>

      {/* Profile card */}
      <Card style={{ padding:"16px 18px", display:"flex", alignItems:"center", gap:13, marginTop:4 }}>
        <Avatar initials="MM" hue="purple" size={46}/>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:14, fontWeight:800, color:T.slate900, margin:0,
            fontFamily:"'Outfit',sans-serif" }}>Marek Marek</p>
          <p style={{ fontSize:10, fontWeight:600, color:T.slate400, margin:"2px 0 0",
            fontFamily:"'Outfit',sans-serif" }}>AIDVISORA CRM v3.0 · 2026</p>
        </div>
        <Ico.Gear size={16} style={{ color:T.slate400, cursor:"pointer"}}/>
      </Card>
    </div>
  );
}

// ── TASK WIZARD ───────────────────────────────
function TaskWizard({ onClose }) {
  const [step, setStep]  = useState(1);
  const [data, setData]  = useState({ title:"", priority:"normal", client:"" });

  return (
    <div style={{ position:"absolute", inset:0, background:"rgba(7,8,15,.65)",
      backdropFilter:"blur(10px)", zIndex:200,
      display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="slide-up"
        style={{ width:"100%", background:T.surface, borderRadius:"28px 28px 0 0",
          overflow:"hidden", boxShadow:"0 -20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:T.slate200, margin:"12px auto 0" }}/>
        <div style={{ padding:"18px 22px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`${T.purple}15`,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ico.CheckCirc size={16} style={{ color:T.purple}}/>
            </div>
            <h3 style={{ fontSize:17, fontWeight:900, color:T.slate900, margin:0,
              fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Nový úkol</h3>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:9,
            background:T.surfaceAlt, border:"none", display:"flex",
            alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <Ico.X size={13} style={{ color:T.slate400 }}/>
          </button>
        </div>

        {/* Steps */}
        <div style={{ padding:"14px 22px 0", display:"flex", gap:6 }}>
          {[1,2,3].map(s=>(
            <div key={s} style={{ flex:1, height:3, borderRadius:2,
              background: s<=step ? T.purple : T.border, transition:"background .3s" }}/>
          ))}
        </div>

        <div style={{ padding:"16px 22px 24px", display:"flex", flexDirection:"column", gap:14 }}>
          {step===1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div>
                <label style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em",
                  textTransform:"uppercase", color:T.slate400, display:"block",
                  marginBottom:7, fontFamily:"'Outfit',sans-serif" }}>Název úkolu *</label>
                <input autoFocus value={data.title} onChange={e=>setData({...data,title:e.target.value})}
                  placeholder="Např. Urgovat výpisy z účtu"
                  style={{ width:"100%", padding:"13px 15px",
                    background:T.surfaceAlt, border:`2px solid ${data.title?T.purple:T.border}`,
                    borderRadius:14, fontSize:14, fontWeight:700, outline:"none",
                    fontFamily:"'Outfit',sans-serif", color:T.slate900,
                    boxSizing:"border-box", transition:"border-color .2s"
                  }}/>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em",
                  textTransform:"uppercase", color:T.slate400, display:"block",
                  marginBottom:7, fontFamily:"'Outfit',sans-serif" }}>Priorita</label>
                <div style={{ display:"flex", gap:7 }}>
                  {[["low","Nízká",T.slate400],["normal","Normální",T.indigo],["high","Urgentní",T.rose]]
                    .map(([val,lbl,clr])=>(
                      <button key={val} onClick={()=>setData({...data,priority:val})} style={{
                        flex:1, padding:"10px 0", borderRadius:12, border:`2px solid`,
                        borderColor: data.priority===val ? clr : T.border,
                        background: data.priority===val ? `${clr}12` : T.surface,
                        color: data.priority===val ? clr : T.slate400,
                        fontSize:11, fontWeight:800, cursor:"pointer",
                        fontFamily:"'Outfit',sans-serif", transition:"all .15s"
                      }}>{lbl}</button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {step===2 && (
            <div>
              <label style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em",
                textTransform:"uppercase", color:T.slate400, display:"block",
                marginBottom:10, fontFamily:"'Outfit',sans-serif" }}>Přiřadit klienta (volitelné)</label>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {CONTACTS_DATA.map(c=>(
                  <div key={c.id} onClick={()=>setData({...data,client:c.name})}
                    style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 13px",
                      borderRadius:13, border:`2px solid`, cursor:"pointer",
                      borderColor: data.client===c.name ? T.purple : T.border,
                      background: data.client===c.name ? `${T.purple}07` : T.surface,
                      transition:"all .15s"
                    }}>
                    <Avatar initials={c.initials} hue={c.hue} size={34}/>
                    <span style={{ fontSize:13, fontWeight:700, color:T.slate900,
                      fontFamily:"'Outfit',sans-serif" }}>{c.name}</span>
                    {data.client===c.name && <Ico.Check size={15} style={{ color:T.purple, marginLeft:"auto" }}/>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step===3 && (
            <div style={{ textAlign:"center", padding:"18px 0" }}>
              <div style={{ width:60, height:60, borderRadius:20, background:`${T.purple}15`,
                display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                <Ico.Check size={26} style={{ color:T.purple }}/>
              </div>
              <h3 style={{ fontSize:17, fontWeight:900, color:T.slate900, margin:"0 0 7px",
                fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Připraveno k uložení</h3>
              <p style={{ fontSize:12, fontWeight:600, color:T.slate400, margin:0,
                fontFamily:"'Outfit',sans-serif" }}>
                Úkol „{data.title}" bude vytvořen{data.client?` pro ${data.client}`:""}.
              </p>
            </div>
          )}

          <div style={{ display:"flex", gap:9 }}>
            <GlassBtn onClick={()=>step>1?setStep(step-1):onClose()} style={{ flex:step>1?0:1 }}>
              {step>1 ? <Ico.ChevL size={14}/> : "Zrušit"}
            </GlassBtn>
            {step<3
              ? <GlassBtn primary onClick={()=>setStep(step+1)} style={{ flex:1 }}
                  disabled={step===1&&!data.title.trim()}>
                  Pokračovat <Ico.ChevR size={13}/>
                </GlassBtn>
              : <GlassBtn primary onClick={onClose} style={{ flex:1,
                  background:T.navy, boxShadow:`0 4px 16px rgba(13,15,28,.3)` }}>
                  <Ico.Check size={13}/> Vytvořit úkol
                </GlassBtn>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════
const SUB_LABELS = {
  client_detail:  "Profil klienta",
  household:      "Domácnost",
  household_detail:"Domácnost",
  ai_assistant:   "AI Asistent",
  analyses:       "Finanční analýzy",
  calcs:          "Kalkulačky",
  plan:           "Můj Plán",
  team:           "Můj Tým",
  calendar:       "Kalendář",
  production:     "Produkce",
  mindmap:        "Mindmap",
  messages:       "Zprávy",
  messages_chat:  "Jan Novák",
  settings:       "Nastavení",
};

export default function AidvisoraApp() {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [subView, setSubView]     = useState(null);
  const [taskWizard, setTaskWizard] = useState(false);

  const navigate = (id) => {
    if (NAV_ITEMS.find(n=>n.id===id)) { setActiveTab(id); setSubView(null); }
    else setSubView(id);
  };

  const renderScreen = () => {
    if (subView==="client_detail")   return <ClientDetailScreen navigate={navigate}/>;
    if (subView==="household"||subView==="household_detail") return <HouseholdScreen/>;
    if (subView==="ai_assistant")    return <AIAssistantScreen/>;
    if (subView==="analyses")        return <AnalysesScreen/>;
    if (subView==="calcs")           return <CalculatorsScreen/>;
    if (subView==="plan")            return <PlanScreen/>;
    if (subView==="team")            return <TeamScreen/>;
    if (subView==="calendar")        return <CalendarScreen/>;
    if (subView==="production")      return <ProductionScreen/>;
    if (subView==="mindmap")         return <MindmapScreen/>;
    if (subView==="messages")        return <MessagesScreen navigate={navigate}/>;
    if (subView==="messages_chat")   return <ChatScreen/>;
    if (activeTab==="home")          return <DashboardScreen navigate={navigate}/>;
    if (activeTab==="tasks")         return <TasksScreen openWizard={()=>setTaskWizard(true)}/>;
    if (activeTab==="clients")       return <ClientsScreen navigate={navigate}/>;
    if (activeTab==="pipeline")      return <PipelineScreen/>;
    if (activeTab==="menu")          return <MenuScreen navigate={navigate}/>;
    return null;
  };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${T.navyDark} 0%,#1a0d3a 50%,${T.navy} 100%)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:24, fontFamily:"'Outfit',sans-serif"
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* Phone frame */}
      <div style={{ width:390, height:844, background:T.bg, borderRadius:52,
        border:"10px solid #050608",
        boxShadow:"0 40px 120px rgba(0,0,0,.65), inset 0 0 0 1px rgba(255,255,255,.04), 0 0 0 1px rgba(255,255,255,.07)",
        display:"flex", flexDirection:"column", overflow:"hidden", position:"relative"
      }}>
        <StatusBar dark={!loggedIn}/>

        {!loggedIn ? (
          <div style={{ flex:1, overflow:"hidden" }}>
            <LoginScreen onLogin={()=>setLoggedIn(true)}/>
          </div>
        ) : (
          <>
            <AppHeader subView={subView} onBack={()=>setSubView(null)} subLabel={SUB_LABELS[subView]}/>

            <div key={subView||activeTab} className="slide-up"
              style={{ flex:1, overflowY:"auto", padding:"16px 14px 0", position:"relative" }}>
              {renderScreen()}
            </div>

            {!subView && <BottomNav active={activeTab} onChange={id=>{setActiveTab(id);setSubView(null);}}/>}

            {taskWizard && <TaskWizard onClose={()=>setTaskWizard(false)}/>}
          </>
        )}

        {/* Home indicator */}
        <div style={{ position:"absolute", bottom:7, left:"50%", transform:"translateX(-50%)",
          width:100, height:4, borderRadius:2,
          background:"rgba(0,0,0,.18)", pointerEvents:"none", zIndex:200 }}/>
      </div>
    </div>
  );
}
