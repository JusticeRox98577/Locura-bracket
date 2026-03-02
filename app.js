// app.js (type="module")
// Locura Bracket — Supabase + Vercel
// - Round 0 play-in (left side) included
// - Carry winners forward automatically
// - Admin-only cutoff + admin view
// - No .single() anywhere (prevents "JSON object requested..." crashes)

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ====== CONFIG YOU MUST SET ======
const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";

// Set this to YOUR Google email (the one you sign in with)
const ADMIN_EMAIL = "YOUR_EMAIL_HERE@gmail.com";

// Tables (must exist)
const TABLE_CONFIG = "config";        // columns: id (text pk), cutoff (timestamptz nullable)
const TABLE_SUBMISSIONS = "submissions"; // recommended columns: id uuid pk, user_id uuid, picks jsonb, locked boolean, created_at timestamptz
// =================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----- Bracket Data (from your image) -----
// Round 0 play-in: TQMQA vs Akakaw => winner plays Angel in Round 1

const SONGS = {
  // Left side
  tqmqa: { title: "TQMQA", artist: "Eladio Carrión" },
  akakaw: { title: "Akakaw", artist: "Renata Flores" },
  angel: { title: "Ángel", artist: "Grupo Frontera & Romeo Santos" },

  tocando: { title: "Tocando el Cielo", artist: "Luis Fonsi" },
  regalo: { title: "Regalo", artist: "Álvaro Soler" },

  si_sabes: { title: "Si Sabes Contar", artist: "Los Ángeles Azules, Luck Ra, Yami Safdie" },
  amuleto: { title: "Amuleto", artist: "Diego Torres" },

  narcisista: { title: "Narcisista", artist: "The Warning" },
  coleccion: { title: "Coleccionando Heridas", artist: "Karol G & Antonis Solís" },

  // Right side
  para_que: { title: "¿Para Qué?", artist: "Ela Taubert" },
  mujer_soy: { title: "La Mujer que Soy", artist: "Fanny Lu" },

  buen_cafe: { title: "Buen Café", artist: "Efecto Pasillo" },
  goodbye: { title: "Goodbye", artist: "Arthur Hanlon, Carlos Vives, Goyo" },

  seis_feb: { title: "6 de Febrero", artist: "Aitana" },
  luna_llena: { title: "Luna Llena", artist: "Ebenezer Guerra & Elvis Crespo" },

  vuela: { title: "Vuela", artist: "Luck Ra & Ke Personaje" },
  music_66: { title: "Music Sessions #66", artist: "Daddy Yankee & BZRP" },
};

// A "ref" is either a song or the winner of a prior match.
const SONG = (songId) => ({ type: "song", songId });
const WINNER = (roundKey, matchId) => ({ type: "winner", roundKey, matchId });

// Rounds: r0, r1, r2, r3, r4
// Match ids are unique inside their round.
const BRACKET = {
  r0: [
    { id: "p1", a: SONG("tqmqa"), b: SONG("akakaw"), label: "Play-in" },
  ],
  r1: [
    // Left side (4 matches, but one has the play-in winner)
    { id: "l1", a: SONG("angel"), b: WINNER("r0", "p1"), label: "Left 1" },
    { id: "l2", a: SONG("tocando"), b: SONG("regalo"), label: "Left 2" },
    { id: "l3", a: SONG("si_sabes"), b: SONG("amuleto"), label: "Left 3" },
    { id: "l4", a: SONG("narcisista"), b: SONG("coleccion"), label: "Left 4" },

    // Right side (4 matches)
    { id: "r1", a: SONG("para_que"), b: SONG("mujer_soy"), label: "Right 1" },
    { id: "r2", a: SONG("buen_cafe"), b: SONG("goodbye"), label: "Right 2" },
    { id: "r3", a: SONG("seis_feb"), b: SONG("luna_llena"), label: "Right 3" },
    { id: "r4", a: SONG("vuela"), b: SONG("music_66"), label: "Right 4" },
  ],
  r2: [
    // Left quarterfinals (2)
    { id: "lq1", a: WINNER("r1", "l1"), b: WINNER("r1", "l2"), label: "Left QF 1" },
    { id: "lq2", a: WINNER("r1", "l3"), b: WINNER("r1", "l4"), label: "Left QF 2" },

    // Right quarterfinals (2)
    { id: "rq1", a: WINNER("r1", "r1"), b: WINNER("r1", "r2"), label: "Right QF 1" },
    { id: "rq2", a: WINNER("r1", "r3"), b: WINNER("r1", "r4"), label: "Right QF 2" },
  ],
  r3: [
    // Semis (2)
    { id: "ls", a: WINNER("r2", "lq1"), b: WINNER("r2", "lq2"), label: "Left Semi" },
    { id: "rs", a: WINNER("r2", "rq1"), b: WINNER("r2", "rq2"), label: "Right Semi" },
  ],
  r4: [
    // Final (1)
    { id: "f", a: WINNER("r3", "ls"), b: WINNER("r3", "rs"), label: "Final" },
  ],
};

// ----- State -----
let user = null;
let config = { cutoff: null }; // ISO string or null
let submissionRow = null;      // row from DB
let locked = false;

let picks = makeEmptyPicks();  // stored in submissions.picks (jsonb)

// ----- Helpers -----
function makeEmptyPicks() {
  return {
    meta: { name: "", class: "" },
    r0: {},
    r1: {},
    r2: {},
    r3: {},
    r4: {},
    locked: false,
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

function songLabel(songId) {
  const s = SONGS[songId];
  if (!s) return songId;
  return `${s.title} — ${s.artist}`;
}

function now() {
  return new Date();
}

function cutoffIsSet() {
  return !!config.cutoff;
}

function cutoffPassed() {
  if (!config.cutoff) return false;
  return now().getTime() >= new Date(config.cutoff).getTime();
}

function canEdit() {
  return !!user && !locked && !cutoffPassed();
}

function isAdmin() {
  return !!user && (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function toLocalDatetimeValue(dateObj) {
  // yyyy-MM-ddTHH:mm (for input type=datetime-local)
  const pad = (n) => String(n).padStart(2, "0");
  const y = dateObj.getFullYear();
  const m = pad(dateObj.getMonth() + 1);
  const d = pad(dateObj.getDate());
  const hh = pad(dateObj.getHours());
  const mm = pad(dateObj.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function refToSongId(ref) {
  if (!ref) return null;
  if (ref.type === "song") return ref.songId;

  if (ref.type === "winner") {
    const w = picks?.[ref.roundKey]?.[ref.matchId];
    return w || null;
  }
  return null;
}

function matchById(roundKey, matchId) {
  return (BRACKET[roundKey] || []).find((m) => m.id === matchId) || null;
}

function getMatchParticipants(roundKey, matchId) {
  const m = matchById(roundKey, matchId);
  if (!m) return { a: null, b: null };
  return { a: refToSongId(m.a), b: refToSongId(m.b) };
}

function winnerOf(roundKey, matchId) {
  return picks?.[roundKey]?.[matchId] || null;
}

// Clears downstream picks that no longer match the bracket state.
// startRoundIndex: index into ["r0","r1","r2","r3","r4"]
function sanitizeDownstream(startRoundIndex) {
  const order = ["r0", "r1", "r2", "r3", "r4"];

  for (let i = startRoundIndex; i < order.length; i++) {
    const rk = order[i];
    for (const m of BRACKET[rk]) {
      const currentPick = picks[rk][m.id];
      if (!currentPick) continue;

      const { a, b } = getMatchParticipants(rk, m.id);
      // If either slot is missing, or pick isn't one of the available, clear it.
      if (!a || !b || (currentPick !== a && currentPick !== b)) {
        delete picks[rk][m.id];
      }
    }
  }
}

// ----- Supabase: load config and submission (NO .single()) -----
async function loadConfig() {
  const { data, error } = await supabase
    .from(TABLE_CONFIG)
    .select("id, cutoff")
    .eq("id", "app")
    .limit(5);

  if (error) throw error;

  const row = Array.isArray(data) && data.length ? data[0] : null;
  config.cutoff = row?.cutoff ?? null;
}

async function loadMySubmission() {
  submissionRow = null;
  locked = false;
  picks = makeEmptyPicks();

  if (!user) return;

  const { data, error } = await supabase
    .from(TABLE_SUBMISSIONS)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  const row = Array.isArray(data) && data.length ? data[0] : null;
  if (!row) return;

  submissionRow = row;
  locked = !!row.locked;

  // picks jsonb
  if (row.picks && typeof row.picks === "object") {
    picks = deepClone(row.picks);
    // Back-compat safety
    if (!picks.meta) picks.meta = { name: "", class: "" };
    if (!picks.r0) picks.r0 = {};
    if (!picks.r1) picks.r1 = {};
    if (!picks.r2) picks.r2 = {};
    if (!picks.r3) picks.r3 = {};
    if (!picks.r4) picks.r4 = {};
  }

  // Ensure downstream is consistent
  sanitizeDownstream(0);
}

async function saveProgress({ lockNow = false } = {}) {
  if (!user) return;

  const payload = {
    user_id: user.id,
    picks: {
      ...picks,
      locked: lockNow ? true : !!picks.locked,
    },
    locked: lockNow ? true : !!locked,
  };

  // If there is an existing row, update it by id (safer with no unique constraint)
  // Otherwise insert.
  if (submissionRow?.id) {
    const { error } = await supabase
      .from(TABLE_SUBMISSIONS)
      .update(payload)
      .eq("id", submissionRow.id);

    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from(TABLE_SUBMISSIONS)
      .insert(payload)
      .select("*")
      .limit(1);

    if (error) throw error;

    submissionRow = Array.isArray(data) && data.length ? data[0] : null;
  }

  // Refresh
  await loadMySubmission();
}

async function adminSaveCutoff(isoOrNull) {
  if (!isAdmin()) return;

  // Upsert config row "app" safely without needing single.
  const { error } = await supabase
    .from(TABLE_CONFIG)
    .upsert({ id: "app", cutoff: isoOrNull }, { onConflict: "id" });

  if (error) throw error;

  await loadConfig();
}

// ----- Auth -----
async function refreshAuth() {
  const { data } = await supabase.auth.getSession();
  user = data?.session?.user ?? null;
}

async function signIn() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin, // works for Vercel + custom domain
    },
  });
}

async function signOut() {
  await supabase.auth.signOut();
}

// ----- UI -----
function injectStyles() {
  const css = `
    :root { color-scheme: dark; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#0b1220; color:#e5e7eb; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 18px; }
    .top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .title { font-size: 26px; font-weight: 800; line-height:1.1; }
    .sub { color:#9ca3af; margin-top:4px; }
    .btn { border: 1px solid #334155; background:#111827; color:#e5e7eb; padding:10px 14px; border-radius: 12px; cursor:pointer; font-weight:600; }
    .btn.primary { background:#1f3a8a; border-color:#1f3a8a; }
    .btn.danger { background:#7f1d1d; border-color:#7f1d1d; }
    .btn:disabled { opacity:0.5; cursor:not-allowed; }
    .card { border: 1px solid #1f2937; background:#0f172a; border-radius: 16px; padding: 14px; margin-top: 14px; }
    .row { display:flex; gap:12px; flex-wrap: wrap; align-items: center; }
    .pill { display:inline-flex; gap:8px; align-items:center; padding:6px 10px; border-radius:999px; background:#0b1220; border:1px solid #1f2937; color:#cbd5e1; font-size: 13px;}
    .warn { color:#fbbf24; }
    .ok { color:#34d399; }
    .err { color:#f87171; }
    .grid { display:grid; grid-template-columns: 1fr; gap: 12px; }
    @media (min-width: 920px) { .grid { grid-template-columns: 1fr 1fr; } }
    .colTitle { font-weight: 800; margin-bottom: 8px; }
    .match { border: 1px solid #1f2937; border-radius: 14px; padding: 10px; background:#0b1220; }
    .matchHdr { display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; }
    .mLabel { color:#9ca3af; font-size: 12px; }
    .choice { width:100%; text-align:left; padding:10px; border-radius: 12px; border:1px solid #1f2937; background:#0f172a; color:#e5e7eb; cursor:pointer; margin-top: 8px; }
    .choice.selected { border-color:#60a5fa; box-shadow: 0 0 0 2px rgba(96,165,250,0.25); }
    .choice:disabled { opacity:0.5; cursor:not-allowed; }
    .inputs { display:flex; gap:10px; flex-wrap: wrap; }
    input[type="text"], input[type="datetime-local"] { background:#0b1220; border:1px solid #1f2937; color:#e5e7eb; border-radius: 12px; padding:10px 12px; }
    input[type="text"] { width: 220px; }
    .small { font-size: 13px; color:#9ca3af; }
    .adminTable { width:100%; border-collapse: collapse; }
    .adminTable th, .adminTable td { border-bottom:1px solid #1f2937; padding:8px; text-align:left; font-size: 13px; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

function buildAppShell() {
  let root = document.getElementById("app");
  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  }
  return root;
}

function render(root, state) {
  root.innerHTML = "";

  const headerLeft = el("div", {}, [
    el("div", { class: "title" }, ["Locura Bracket"]),
    el("div", { class: "sub" }, ["Powered by Supabase + Vercel"]),
  ]);

  const authBtn = user
    ? el("button", { class: "btn", onclick: signOut }, [`Sign out (${user.email || "user"})`])
    : el("button", { class: "btn primary", onclick: signIn }, ["Sign in with Google"]);

  const header = el("div", { class: "top" }, [headerLeft, authBtn]);

  const statusPills = [];
  if (cutoffIsSet()) {
    statusPills.push(
      el("span", { class: "pill" }, [
        "Cutoff: ",
        new Date(config.cutoff).toLocaleString(),
        cutoffPassed() ? el("span", { class: "warn" }, [" (closed)"]) : el("span", { class: "ok" }, [" (open)"]),
      ])
    );
  } else {
    statusPills.push(el("span", { class: "pill warn" }, ["Cutoff not set (open)"]));
  }
  if (user && locked) statusPills.push(el("span", { class: "pill warn" }, ["Your bracket is locked"]));
  if (user && canEdit()) statusPills.push(el("span", { class: "pill ok" }, ["Editing enabled"]));
  if (user && !canEdit()) statusPills.push(el("span", { class: "pill warn" }, ["Editing disabled"]));

  const statusRow = el("div", { class: "row" }, statusPills);

  const msg = state.error
    ? el("div", { class: "card err" }, [`Error: ${state.error}`])
    : null;

  const metaCard = user
    ? renderMetaCard()
    : el("div", { class: "card" }, [
        el("div", { class: "small" }, ["Sign in so your bracket is saved and you can view it later."]),
      ]);

  const bracketCard = el("div", { class: "card" }, [
    el("div", { class: "row" }, [
      el("div", { class: "colTitle" }, ["Bracket"]),
      el("div", { class: "small" }, ["Pick winners — they will auto-advance."]),
    ]),
    renderBracket(),
    user ? renderActions() : el("div", { class: "small", style: "margin-top:10px;" }, ["Sign in to make picks."]),
  ]);

  const adminCard = isAdmin() ? renderAdmin() : null;

  const wrap = el("div", { class: "wrap" }, [
    header,
    statusRow,
    ...(msg ? [msg] : []),
    metaCard,
    bracketCard,
    ...(adminCard ? [adminCard] : []),
  ]);

  root.appendChild(wrap);
}

function renderMetaCard() {
  const nameInput = el("input", {
    type: "text",
    placeholder: "Nombre",
    value: picks.meta?.name || "",
    oninput: (e) => {
      picks.meta.name = e.target.value.slice(0, 80);
    },
    disabled: !canEdit(),
  });

  const classInput = el("input", {
    type: "text",
    placeholder: "Clase",
    value: picks.meta?.class || "",
    oninput: (e) => {
      picks.meta.class = e.target.value.slice(0, 40);
    },
    disabled: !canEdit(),
  });

  return el("div", { class: "card" }, [
    el("div", { class: "row" }, [
      el("div", { class: "colTitle" }, ["Student Info"]),
      el("div", { class: "small" }, ["(Stored inside your submission)"]),
    ]),
    el("div", { class: "inputs" }, [nameInput, classInput]),
  ]);
}

function renderMatch(roundKey, match) {
  const { a, b } = getMatchParticipants(roundKey, match.id);
  const current = winnerOf(roundKey, match.id);

  const slotAReady = !!a;
  const slotBReady = !!b;
  const ready = slotAReady && slotBReady;

  const btnA = el(
    "button",
    {
      class: `choice ${current === a ? "selected" : ""}`,
      disabled: !canEdit() || !ready,
      onclick: () => {
        picks[roundKey][match.id] = a;
        // Any downstream that depends on this must be revalidated
        const startIndex = ["r0", "r1", "r2", "r3", "r4"].indexOf(roundKey) + 1;
        sanitizeDownstream(Math.max(0, startIndex));
        rerender();
      },
    },
    [slotAReady ? songLabel(a) : ""]
  );

  const btnB = el(
    "button",
    {
      class: `choice ${current === b ? "selected" : ""}`,
      disabled: !canEdit() || !ready,
      onclick: () => {
        picks[roundKey][match.id] = b;
        const startIndex = ["r0", "r1", "r2", "r3", "r4"].indexOf(roundKey) + 1;
        sanitizeDownstream(Math.max(0, startIndex));
        rerender();
      },
    },
    [slotBReady ? songLabel(b) : ""]
  );

  // If not ready, show why (no TBD text in the bracket itself)
  const hint = !ready
    ? el("div", { class: "small", style: "margin-top:8px;" }, [
        "Waiting on earlier pick(s) to fill this matchup.",
      ])
    : null;

  const hdr = el("div", { class: "matchHdr" }, [
    el("div", { class: "mLabel" }, [`${roundKey.toUpperCase()} • ${match.label}`]),
    current ? el("span", { class: "pill ok" }, ["Picked"]) : el("span", { class: "pill" }, ["Not picked"]),
  ]);

  return el("div", { class: "match" }, [hdr, btnA, btnB, ...(hint ? [hint] : [])]);
}

function renderRound(title, roundKey, matches) {
  return el("div", {}, [
    el("div", { class: "colTitle" }, [title]),
    ...matches.map((m) => renderMatch(roundKey, m)),
  ]);
}

function renderBracket() {
  const leftCol = el("div", {}, [
    renderRound("Round 0 (Play-in)", "r0", BRACKET.r0),
    renderRound("Round 1 (Left)", "r1", BRACKET.r1.filter((m) => m.id.startsWith("l"))),
    renderRound("Quarterfinals (Left)", "r2", BRACKET.r2.filter((m) => m.id.startsWith("l"))),
    renderRound("Semifinal (Left)", "r3", BRACKET.r3.filter((m) => m.id === "ls")),
  ]);

  const rightCol = el("div", {}, [
    renderRound("Round 1 (Right)", "r1", BRACKET.r1.filter((m) => m.id.startsWith("r"))),
    renderRound("Quarterfinals (Right)", "r2", BRACKET.r2.filter((m) => m.id.startsWith("r"))),
    renderRound("Semifinal (Right)", "r3", BRACKET.r3.filter((m) => m.id === "rs")),
    renderRound("Final", "r4", BRACKET.r4),
  ]);

  return el("div", { class: "grid" }, [leftCol, rightCol]);
}

function renderActions() {
  const saveBtn = el("button", {
    class: "btn",
    disabled: !user || locked,
    onclick: async () => {
      try {
        state.error = null;
        await saveProgress({ lockNow: false });
        rerender();
      } catch (e) {
        state.error = e?.message || String(e);
        rerender();
      }
    },
  }, ["Save progress"]);

  const submitBtn = el("button", {
    class: "btn primary",
    disabled: !user || locked || cutoffPassed(),
    onclick: async () => {
      try {
        state.error = null;
        // lock the bracket
        locked = true;
        picks.locked = true;
        await saveProgress({ lockNow: true });
        rerender();
      } catch (e) {
        state.error = e?.message || String(e);
        rerender();
      }
    },
  }, ["Submit & Lock"]);

  const note = locked
    ? el("div", { class: "small warn" }, ["Locked: you can view, but you cannot change anything."])
    : cutoffPassed()
    ? el("div", { class: "small warn" }, ["Submissions are closed (cutoff passed)."])
    : el("div", { class: "small" }, ["Save anytime. When you submit, it locks permanently."]);

  return el("div", { style: "margin-top:12px;" }, [
    el("div", { class: "row" }, [saveBtn, submitBtn]),
    el("div", { style: "margin-top:8px;" }, [note]),
  ]);
}

function renderAdmin() {
  const cutoffInput = el("input", {
    type: "datetime-local",
    value: config.cutoff ? toLocalDatetimeValue(new Date(config.cutoff)) : "",
    disabled: !isAdmin(),
  });

  const saveCutoffBtn = el("button", {
    class: "btn primary",
    onclick: async () => {
      try {
        state.error = null;

        if (!cutoffInput.value) {
          await adminSaveCutoff(null);
        } else {
          // datetime-local is local time; convert to ISO
          const iso = new Date(cutoffInput.value).toISOString();
          await adminSaveCutoff(iso);
        }
        rerender();
      } catch (e) {
        state.error = e?.message || String(e);
        rerender();
      }
    },
  }, ["Save cutoff"]);

  const openBtn = el("button", {
    class: "btn",
    onclick: async () => {
      try {
        state.error = null;
        await adminSaveCutoff(null);
        rerender();
      } catch (e) {
        state.error = e?.message || String(e);
        rerender();
      }
    },
  }, ["Open submissions (no cutoff)"]);

  const refreshBtn = el("button", {
    class: "btn",
    onclick: async () => {
      try {
        state.error = null;
        await loadConfig();
        await loadAdminSubmissions();
        rerender();
      } catch (e) {
        state.error = e?.message || String(e);
        rerender();
      }
    },
  }, ["Refresh admin data"]);

  const adminControls = el("div", { class: "row" }, [
    el("span", { class: "pill" }, [`Admin: ${user.email}`]),
    cutoffInput,
    saveCutoffBtn,
    openBtn,
    refreshBtn,
  ]);

  const table = renderAdminTable();

  return el("div", { class: "card" }, [
    el("div", { class: "colTitle" }, ["Admin Panel"]),
    el("div", { class: "small" }, [
      "Only the email in ADMIN_EMAIL can see this. Students cannot access it.",
    ]),
    el("div", { style: "margin-top:10px;" }, [adminControls]),
    el("div", { style: "margin-top:12px;" }, [table]),
  ]);
}

// Admin submissions view (client-side; relies on RLS to restrict to admin if you want).
// If your RLS currently allows only owners to read, this will return empty (which is fine).
let adminSubmissions = [];

async function loadAdminSubmissions() {
  if (!isAdmin()) {
    adminSubmissions = [];
    return;
  }

  // Try to read latest 200 submissions. This will only work if your RLS allows admin read.
  const { data, error } = await supabase
    .from(TABLE_SUBMISSIONS)
    .select("id, user_id, locked, created_at, picks")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    // Don’t hard-fail admin UI if RLS blocks it; just show a message.
    adminSubmissions = [{ __error: error.message }];
    return;
  }

  adminSubmissions = data || [];
}

function renderAdminTable() {
  if (!isAdmin()) return el("div", {}, []);

  if (adminSubmissions.length === 1 && adminSubmissions[0]?.__error) {
    return el("div", { class: "small warn" }, [
      "Admin submission list is blocked by RLS right now: ",
      adminSubmissions[0].__error,
      ". (If you want, I can give you the exact RLS policy to allow admin read.)",
    ]);
  }

  const thead = el("thead", {}, [
    el("tr", {}, [
      el("th", {}, ["Created"]),
      el("th", {}, ["Locked"]),
      el("th", {}, ["Nombre"]),
      el("th", {}, ["Clase"]),
      el("th", {}, ["User ID"]),
    ]),
  ]);

  const rows = adminSubmissions.map((r) => {
    const meta = r?.picks?.meta || {};
    return el("tr", {}, [
      el("td", {}, [r.created_at ? new Date(r.created_at).toLocaleString() : ""]),
      el("td", {}, [r.locked ? "Yes" : "No"]),
      el("td", {}, [meta.name || ""]),
      el("td", {}, [meta.class || ""]),
      el("td", {}, [(r.user_id || "").slice(0, 12) + "…"]),
    ]);
  });

  return el("table", { class: "adminTable" }, [thead, el("tbody", {}, rows)]);
}

// ----- App lifecycle -----
const state = { error: null };
let rootNode = null;

async function init() {
  injectStyles();
  rootNode = buildAppShell();

  await refreshAuth();
  await loadConfig();

  if (user) {
    await loadMySubmission();
    if (isAdmin()) await loadAdminSubmissions();
  }

  rerender();

  supabase.auth.onAuthStateChange(async () => {
    try {
      state.error = null;
      await refreshAuth();
      await loadConfig();
      if (user) {
        await loadMySubmission();
        if (isAdmin()) await loadAdminSubmissions();
      } else {
        picks = makeEmptyPicks();
        submissionRow = null;
        locked = false;
        adminSubmissions = [];
      }
      rerender();
    } catch (e) {
      state.error = e?.message || String(e);
      rerender();
    }
  });
}

function rerender() {
  render(rootNode, state);
}

// Start
init().catch((e) => {
  console.error(e);
  state.error = e?.message || String(e);
  if (!rootNode) {
    injectStyles();
    rootNode = buildAppShell();
  }
  rerender();
});
