import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====== CONFIG YOU CARE ABOUT ======
const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co"; // <-- NOTE: keep your original if different by
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";

// Only YOU are admin:
const ADMIN_EMAILS = ["justicemw9857@gmail.com"]; // add more if you want

// Tables:
const TBL_CONFIG = "config";           // row: { id: 'app', cutoff: timestamptz|null }
const TBL_SUBMISSIONS = "submissions"; // row: { id uuid, user_id uuid unique, nombre text, clase text, picks jsonb, locked bool }
const TBL_CLASSES = "classes";         // ✅ ADDED (teacher-created classes for dropdown)
const TBL_RESULTS = "results";

const LINKS = {
  bracket: "https://locurademarzo.org",
  teachers: "https://teachers.locurademarzo.org",
  results: "https://results.locurademarzo.org",
  voting: "https://voting.locurademarzo.org",
  votingAdmin: "https://voting.locurademarzo.org/admin",
  votingDownloads: "https://voting.locurademarzo.org/downloads"
};

// ====== BRACKET DATA (includes Round 0 play-in) ======
const SONGS = {
  // Left play-in (Round 0)
  "L-R0-A": { song: "TQMQA", artist: "Eladio Carrión" },
  "L-R0-B": { song: "Akakaw", artist: "Renata Flores" },

  // Left round 1
  "L-R1-1-A": { song: "Ángel", artist: "Grupo Frontera & Romeo Santos" }, // faces play-in winner
  "L-R1-2-A": { song: "Tocando el Cielo", artist: "Luis Fonsi" },
  "L-R1-2-B": { song: "Regalo", artist: "Alvaro Soler" },
  "L-R1-3-A": { song: "Si Sabes Contar", artist: "Los Ángeles Azules, Luck Ra, Yami Safdie" },
  "L-R1-3-B": { song: "Amuleto", artist: "Diego Torres" },
  "L-R1-4-A": { song: "Narcisista", artist: "The Warning" },
  "L-R1-4-B": { song: "Coleccionando Heridas", artist: "Karol G & Antonis Solís" },

  // Right round 1
  "R-R1-1-A": { song: "¿Para Qué?", artist: "Ela Taubert" },
  "R-R1-1-B": { song: "La Mujer que Soy", artist: "Fanny Lu" },
  "R-R1-2-A": { song: "Buen Café", artist: "Efecto Pasillo" },
  "R-R1-2-B": { song: "Goodbye", artist: "Arthur Hanlon, Carlos Vives, Goyo" },
  "R-R1-3-A": { song: "6 de Febrero", artist: "Aitana" },
  "R-R1-3-B": { song: "Luna Llena", artist: "Ebenezer Guerra & Elvis Crespo" },
  "R-R1-4-A": { song: "Vuela", artist: "Luck Ra & Ke Personaje" },
  "R-R1-4-B": { song: "Music Sessions #66", artist: "Daddy Yankee & BZRP" },
};

// Each match has two “slots” which are either a seed (SONGS key) or comes from another match winner.
const MATCHES = [
  // Round 0 (Play-in) - Left only
  { id: "L-R0", title: "Round 0 (Play-in)", code: "R0 • Play-in", side: "Left",
    a: { seed: "L-R0-A" }, b: { seed: "L-R0-B" },
    next: { matchId: "L-R1-1", slot: "B" } // winner becomes slot B in L-R1-1
  },

  // Round 1 (Left)
  { id: "L-R1-1", title: "Round 1 (Left)", code: "R1 • Left 1", side: "Left",
    a: { seed: "L-R1-1-A" }, b: { from: "L-R0" },
    next: { matchId: "L-QF-1", slot: "A" }
  },
  { id: "L-R1-2", title: "Round 1 (Left)", code: "R1 • Left 2", side: "Left",
    a: { seed: "L-R1-2-A" }, b: { seed: "L-R1-2-B" },
    next: { matchId: "L-QF-1", slot: "B" }
  },
  { id: "L-R1-3", title: "Round 1 (Left)", code: "R1 • Left 3", side: "Left",
    a: { seed: "L-R1-3-A" }, b: { seed: "L-R1-3-B" },
    next: { matchId: "L-QF-2", slot: "A" }
  },
  { id: "L-R1-4", title: "Round 1 (Left)", code: "R1 • Left 4", side: "Left",
    a: { seed: "L-R1-4-A" }, b: { seed: "L-R1-4-B" },
    next: { matchId: "L-QF-2", slot: "B" }
  },

  // Quarterfinals (Left)
  { id: "L-QF-1", title: "Quarterfinals (Left)", code: "R2 • Left QF 1", side: "Left",
    a: { from: "L-R1-1" }, b: { from: "L-R1-2" },
    next: { matchId: "L-SF", slot: "A" }
  },
  { id: "L-QF-2", title: "Quarterfinals (Left)", code: "R2 • Left QF 2", side: "Left",
    a: { from: "L-R1-3" }, b: { from: "L-R1-4" },
    next: { matchId: "L-SF", slot: "B" }
  },

  // Semifinal (Left)
  { id: "L-SF", title: "Semifinal (Left)", code: "R3 • Left Semi", side: "Left",
    a: { from: "L-QF-1" }, b: { from: "L-QF-2" },
    next: { matchId: "FINAL", slot: "A" }
  },

  // Round 1 (Right)
  { id: "R-R1-1", title: "Round 1 (Right)", code: "R1 • Right 1", side: "Right",
    a: { seed: "R-R1-1-A" }, b: { seed: "R-R1-1-B" },
    next: { matchId: "R-QF-1", slot: "A" }
  },
  { id: "R-R1-2", title: "Round 1 (Right)", code: "R1 • Right 2", side: "Right",
    a: { seed: "R-R1-2-A" }, b: { seed: "R-R1-2-B" },
    next: { matchId: "R-QF-1", slot: "B" }
  },
  { id: "R-R1-3", title: "Round 1 (Right)", code: "R1 • Right 3", side: "Right",
    a: { seed: "R-R1-3-A" }, b: { seed: "R-R1-3-B" },
    next: { matchId: "R-QF-2", slot: "A" }
  },
  { id: "R-R1-4", title: "Round 1 (Right)", code: "R1 • Right 4", side: "Right",
    a: { seed: "R-R1-4-A" }, b: { seed: "R-R1-4-B" },
    next: { matchId: "R-QF-2", slot: "B" }
  },

  // Quarterfinals (Right)
  { id: "R-QF-1", title: "Quarterfinals (Right)", code: "R2 • Right QF 1", side: "Right",
    a: { from: "R-R1-1" }, b: { from: "R-R1-2" },
    next: { matchId: "R-SF", slot: "A" }
  },
  { id: "R-QF-2", title: "Quarterfinals (Right)", code: "R2 • Right QF 2", side: "Right",
    a: { from: "R-R1-3" }, b: { from: "R-R1-4" },
    next: { matchId: "R-SF", slot: "B" }
  },

  // Semifinal (Right)
  { id: "R-SF", title: "Semifinal (Right)", code: "R3 • Right Semi", side: "Right",
    a: { from: "R-QF-1" }, b: { from: "R-QF-2" },
    next: { matchId: "FINAL", slot: "B" }
  },

  // Final
  { id: "FINAL", title: "Final", code: "R4 • Final", side: "Final",
    a: { from: "L-SF" }, b: { from: "R-SF" },
    next: null
  },
];

const MATCH_BY_ID = Object.fromEntries(MATCHES.map(m => [m.id, m]));

// ====== APP STATE ======
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let session = null;
let user = null;

let configRow = null;     // { id:'app', cutoff: ... }
let submission = null;    // user’s row in submissions (or null)
let picks = {};           // { matchId: 'A' | 'B' } winner slot
let classes = [];         // ✅ ADDED
let adminLockedSubmissions = [];
let adminLoadingLocked = false;

let saving = false;
let submitting = false;
let lastError = "";

// ====== DOM ======
const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (typeof v === "boolean") {
      // For boolean HTML attrs (disabled, checked, etc.), presence means true.
      if (v) n.setAttribute(k, "");
      else n.removeAttribute(k);
    }
    else n.setAttribute(k, v);
  }
  for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}

// ====== AUTH / LOAD ======
async function init() {
  renderSkeleton();

  const { data } = await supabase.auth.getSession();
  session = data.session;
  user = session?.user ?? null;

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    user = newSession?.user ?? null;
    // reload app state after auth changes
    boot().catch(err => showError(err?.message || String(err)));
  });

  await boot();
}

async function boot() {
  lastError = "";
  renderSkeleton();

  await loadConfig();
  await loadClasses(); // ✅ ADDED

  if (user) {
    await loadOrCreateSubmission();
    picks = (submission?.picks && typeof submission.picks === "object") ? submission.picks : {};
    // normalize: only keep known match IDs
    for (const k of Object.keys(picks)) if (!MATCH_BY_ID[k]) delete picks[k];
  } else {
    submission = null;
    picks = {};
  }

  // enforce cascade validity (clears downstream if needed)
  normalizeCascade();

  if (user && isAdmin()) {
    await loadAdminLockedSubmissions();
  } else {
    adminLockedSubmissions = [];
  }

  render();
}

async function signIn() {
  // Google OAuth via Supabase
  const callbackUrl = new URL(window.location.href);
  callbackUrl.hash = "";
  callbackUrl.search = "";

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() }
  });
  if (error) throw error;
}

async function signOut() {
  await supabase.auth.signOut();
}

async function handleAuthClick() {
  try {
    if (user) await signOut();
    else await signIn();
  } catch (e) {
    const msg = e?.message || String(e);
    showError(msg);
    alert("Auth failed: " + msg);
  }
}

function isAdmin() {
  const email = user?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);
}

// ✅ ADDED: load classes for dropdown
async function loadClasses() {
  const { data, error } = await supabase
    .from(TBL_CLASSES)
    .select("*")
    .order("teacher_name");

  if (error) throw error;
  classes = data || [];
}

// ====== DATA: CONFIG ======
async function loadConfig() {
  // Expect exactly one row: id='app'
  const { data, error } = await supabase
    .from(TBL_CONFIG)
    .select("*")
    .eq("id", "app")
    .maybeSingle();

  if (error) throw error;

  // If missing, create it (admin will lock it down via RLS)
  if (!data) {
    // This insert will only work if your RLS allows it (or you did initial seed).
    // If it fails, that’s OK — we’ll show "missing config".
    const ins = await supabase.from(TBL_CONFIG).insert({ id: "app", cutoff: null }).select().maybeSingle();
    if (!ins.error) configRow = ins.data;
    else configRow = null;
  } else {
    configRow = data;
  }
}

// ====== DATA: SUBMISSION ======
async function loadOrCreateSubmission() {
  const uid = user.id;

  const { data, error } = await supabase
    .from(TBL_SUBMISSIONS)
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    submission = data;
    return;
  }

  // Create draft submission if missing.
  // Use ignoreDuplicates so this remains safe if a row already exists.
  const created = await supabase
    .from(TBL_SUBMISSIONS)
    .upsert({
      user_id: uid,
      nombre: "",
      clase: "",
      class_id: null, // ✅ ADDED
      picks: {},
      locked: false
    }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();

  if (created.error) throw created.error;
  if (created.data) {
    submission = created.data;
    return;
  }

  // If duplicate was ignored, fetch the existing row.
  const retry = await supabase
    .from(TBL_SUBMISSIONS)
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (retry.error) throw retry.error;
  if (!retry.data) {
    throw new Error("Could not load your submission row. Check submissions RLS select policy for auth.uid().");
  }

  submission = retry.data;
}

function cutoffIsSet() {
  return !!(configRow && configRow.cutoff);
}

function cutoffAllowsEdits() {
  // If cutoff is null => open
  if (!configRow || !configRow.cutoff) return true;
  const cutoff = new Date(configRow.cutoff);
  return new Date() < cutoff;
}

function editingAllowed() {
  if (!user) return false;
  if (!submission) return false;
  if (submission.locked) return false;
  return cutoffAllowsEdits();
}

function getEditingBlockReason() {
  if (!user) return "You must sign in first.";
  if (!submission) return "Submission record not found.";
  if (submission.locked) return "Your bracket is already locked.";
  if (!cutoffAllowsEdits()) return "Submissions are closed (cutoff passed).";
  return "";
}

// ====== BRACKET LOGIC ======
function getWinnerSeed(matchId) {
  const win = picks[matchId]; // 'A'|'B' or undefined
  if (!win) return null;
  const m = MATCH_BY_ID[matchId];
  const entrant = (win === "A") ? resolveSlot(m.a) : resolveSlot(m.b);
  return entrant?.seedKey ?? null;
}

function resolveSlot(slot) {
  // Returns { seedKey, song, artist } or null
  if (slot.seed) {
    const seedKey = slot.seed;
    const info = SONGS[seedKey];
    if (!info) return null;
    return { seedKey, ...info };
  }
  if (slot.from) {
    const seedKey = getWinnerSeed(slot.from);
    if (!seedKey) return null;
    const info = SONGS[seedKey];
    if (!info) return null;
    return { seedKey, ...info };
  }
  return null;
}

function matchReady(matchId) {
  const m = MATCH_BY_ID[matchId];
  const a = resolveSlot(m.a);
  const b = resolveSlot(m.b);
  return !!(a && b);
}

function normalizeCascade() {
  // Clear picks for matches that are not ready or conflict with current entrants.
  // Repeat until stable.
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of MATCHES) {
      const currentPick = picks[m.id];
      if (!currentPick) continue;

      const a = resolveSlot(m.a);
      const b = resolveSlot(m.b);

      // If not ready, clear
      if (!a || !b) {
        delete picks[m.id];
        changed = true;
        continue;
      }

      // If pick refers to a slot that exists but downstream was based on old entrants,
      // it’s still valid because we store A/B choice, not seedKey.
      // However, if user had picked and entrants changed due to upstream change,
      // we should clear it (so it doesn’t silently pick a different song).
      const pickedSeed = currentPick === "A" ? a.seedKey : b.seedKey;
      const prevSnapshotKey = `__snapshot_${m.id}`;
      const snapshot = picks[prevSnapshotKey];

      const nowSnapshot = `${a.seedKey}|${b.seedKey}`;
      if (!snapshot) {
        picks[prevSnapshotKey] = nowSnapshot;
        continue;
      }

      if (snapshot !== nowSnapshot) {
        // entrants changed -> clear the pick (and update snapshot)
        delete picks[m.id];
        picks[prevSnapshotKey] = nowSnapshot;
        changed = true;
        continue;
      }

      // keep snapshot aligned
      if (picks[prevSnapshotKey] !== nowSnapshot) {
        picks[prevSnapshotKey] = nowSnapshot;
        changed = true;
      }

      // pickedSeed computed just to force resolution
      void pickedSeed;
    }
  }

  // remove snapshot keys before saving
  for (const k of Object.keys(picks)) {
    if (k.startsWith("__snapshot_")) delete picks[k];
  }
}

function setPick(matchId, slot) {
  if (!editingAllowed()) return;

  const m = MATCH_BY_ID[matchId];
  const a = resolveSlot(m.a);
  const b = resolveSlot(m.b);
  if (!a || !b) return;

  picks[matchId] = slot; // 'A' or 'B'
  // cascade clears later picks if this changes entrants
  normalizeCascade();

  render(); // update UI immediately
}

// ====== SAVE / SUBMIT ======
let saveTimer = null;

function scheduleSave() {
  if (!editingAllowed()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDraft().catch(err => showError(err?.message || String(err))), 350);
}

async function saveDraft() {
  if (!editingAllowed()) {
    const reason = getEditingBlockReason();
    if (reason) showError(reason);
    return;
  }
  if (!submission) {
    showError("Submission record not found.");
    return;
  }

  saving = true;
  renderHeaderPills();

  const nombre = $("#nombre")?.value ?? "";
  const clase  = $("#clase")?.value ?? "";

  const cleanPicks = { ...picks };

  const { data, error } = await supabase
    .from(TBL_SUBMISSIONS)
    .update({
      nombre,
      clase,
      picks: cleanPicks
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  saving = false;
  if (error) throw error;
  submission = data;
  renderHeaderPills();
}

async function submitAndLock() {
  if (!editingAllowed()) {
    const reason = getEditingBlockReason();
    if (reason) {
      showError(reason);
      alert("Submit blocked: " + reason);
    }
    return;
  }
  if (submitting) return;

  try {
    submitting = true;
    render();
    clearTimeout(saveTimer);
    saveTimer = null;
    const nombre = $("#nombre")?.value ?? "";
    const clase  = $("#clase")?.value ?? "";
    const cleanPicks = { ...picks };

    const { data, error } = await supabase
      .from(TBL_SUBMISSIONS)
      .update({
        nombre,
        clase,
        picks: cleanPicks,
        locked: true
      })
      .eq("user_id", user.id)
      .eq("locked", false)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error("Submit failed. Your bracket may already be locked, or update permissions are blocking this change.");
    }

    submission = data;
    render();
    alert("Bracket submitted and locked.");
  } catch (e) {
    const msg = e?.message || String(e);
    showError(msg);
    alert("Submit failed: " + msg);
  } finally {
    submitting = false;
    render();
  }
}

// ====== ADMIN PANEL ======
async function adminSetCutoff(valueOrNull) {
  if (!isAdmin()) return;

  const patch = { id: "app", cutoff: valueOrNull }; // null or ISO string
  const { data, error } = await supabase
    .from(TBL_CONFIG)
    .upsert(patch, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Could not save cutoff row.");
  configRow = data;
  lastError = "";
  render();
}

async function adminResetResults() {
  if (!isAdmin()) return;

  const { data, error } = await supabase
    .from(TBL_RESULTS)
    .update({ winners: {} })
    .eq("id", "current")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No current results row found (id='current').");
}

async function loadAdminLockedSubmissions() {
  if (!isAdmin()) return;
  adminLoadingLocked = true;
  render();

  const { data, error } = await supabase
    .from(TBL_SUBMISSIONS)
    .select("user_id,nombre,clase,locked")
    .eq("locked", true)
    .limit(300);

  adminLoadingLocked = false;
  if (error) throw error;
  adminLockedSubmissions = data || [];
}

async function adminUnlockSubmission(userId) {
  if (!isAdmin()) return;
  if (!userId) return;

  const { error } = await supabase
    .from(TBL_SUBMISSIONS)
    .update({ locked: false })
    .eq("user_id", userId)
    .eq("locked", true);

  if (error) throw error;

  if (submission && submission.user_id === userId) {
    submission.locked = false;
  }

  await loadAdminLockedSubmissions();
  render();
  alert("Bracket unlocked.");
}


// ====== RENDER ======
function renderSkeleton() {
  const root = $("#app");
  root.innerHTML = "";
  root.appendChild(el("div", { class: "container" }, [
    el("div", { class: "header" }, [
      el("div", { class: "brand" }, [
        el("h1", {}, ["Locura Bracket"]),
        el("div", { class: "sub" }, ["Powered by Supabase + Vercel"]),
        el("div", { class: "pillrow", id: "pillrow" }, [])
      ]),
      el("div", { class: "top-actions" }, [
        el("button", { class: "btn primary", id: "authBtn", onclick: () => handleAuthClick() }, [ user ? "Sign out" : "Sign in with Google" ]),
        el("div", { class: "smallMuted", id: "userLine" }, [ user ? `(${user.email})` : "" ]),
      ])
    ]),
    el("div", { id: "content" }, [
      el("div", { class: "card" }, [
        el("h2", {}, ["Loading…"]),
        el("p", { class: "hint" }, ["Setting up your session and bracket."])
      ])
    ])
  ]));
}

function renderHeaderPills() {
  const pillrow = $("#pillrow");
  if (!pillrow) return;
  pillrow.innerHTML = "";

  const cutoffPill = cutoffIsSet()
    ? el("div", { class: "pill bad" }, [`Cutoff set (${new Date(configRow.cutoff).toLocaleString()})`])
    : el("div", { class: "pill warn" }, ["Cutoff not set (open)"]);

  const editPill = !user
    ? el("div", { class: "pill" }, ["Sign in to edit"])
    : submission?.locked
      ? el("div", { class: "pill bad" }, ["Locked"])
      : cutoffAllowsEdits()
        ? el("div", { class: "pill ok" }, [saving ? "Saving…" : "Editing enabled"])
        : el("div", { class: "pill bad" }, ["Editing closed"]);

  pillrow.appendChild(cutoffPill);
  pillrow.appendChild(editPill);

  if (isAdmin()) {
    pillrow.appendChild(el("div", { class: "pill ok" }, ["Admin"]));
  }
}

function showError(msg) {
  lastError = msg;
  render();
}

function renderPortalLinks() {
  const wrap = el("div", { class: "card" }, [
    el("h2", {}, ["Locura Pages"]),
    el("p", { class: "hint" }, ["Use these shortcuts to open each student/teacher page."])
  ]);

  const row = el("div", { class: "footerBar" }, [
    el("button", { class: "btn", onclick: () => window.location.href = LINKS.bracket }, ["Student Bracket"]),
    el("button", { class: "btn", onclick: () => window.location.href = LINKS.voting }, ["Student Voting"]),
    el("button", { class: "btn", onclick: () => window.location.href = LINKS.teachers }, ["Teacher Portal"]),
    el("button", { class: "btn", onclick: () => window.location.href = LINKS.results }, ["Results Admin"]),
    el("button", { class: "btn", onclick: () => window.location.href = LINKS.votingAdmin }, ["Voting Admin"]),
    el("button", { class: "btn", onclick: () => window.location.href = LINKS.votingDownloads }, ["Voting Downloads"]),
  ]);

  wrap.appendChild(row);
  return wrap;
}

// ✅ ADDED: class select gate + class selector UI
function renderClassSelector() {
  const wrap = el("div", { class: "card" }, [
    el("h2", {}, ["Select Your Class"]),
    el("p", { class: "hint" }, ["You must choose teacher and period before filling out your bracket."])
  ]);

  const teacherSelect = el("select", { class: "input", id: "teacherSelect" });
  const periodSelect = el("select", { class: "input", id: "periodSelect" });

  teacherSelect.appendChild(el("option", { value: "" }, ["-- Choose teacher --"]));
  periodSelect.appendChild(el("option", { value: "" }, ["-- Choose period --"]));

  const teachers = [...new Set(classes.map(c => (c.teacher_name || "").trim()).filter(Boolean))];
  for (const t of teachers) {
    teacherSelect.appendChild(el("option", { value: t }, [t]));
  }

  const populatePeriods = () => {
    const t = teacherSelect.value || "";
    periodSelect.innerHTML = "";
    periodSelect.appendChild(el("option", { value: "" }, ["-- Choose period --"]));
    if (!t) return;

    const teacherRows = classes
      .filter(c => (c.teacher_name || "").trim() === t)
      .sort((a, b) => String(a.period).localeCompare(String(b.period)));

    for (const c of teacherRows) {
      const label = `${c.period}`;
      periodSelect.appendChild(el("option", { value: c.id }, [label]));
    }
  };

  teacherSelect.addEventListener("change", populatePeriods);

  const btn = el("button", {
    class: "btn primary",
    onclick: async () => {
      const val = periodSelect.value || "";
      if (!val) return alert("Please select a class.");

      const { data, error } = await supabase
        .from(TBL_SUBMISSIONS)
        .update({ class_id: val })
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) return showError(error.message);

      submission = data;
      render();
    }
  }, ["Join Class"]);

  wrap.appendChild(el("div", { class: "label" }, ["Teacher"]));
  wrap.appendChild(teacherSelect);
  wrap.appendChild(el("div", { class: "label" }, ["Period"]));
  wrap.appendChild(periodSelect);
  wrap.appendChild(el("div", { style: "margin-top:16px" }, [btn]));
  return wrap;
}
function render() {
  // Update header auth UI
  const authBtn = $("#authBtn");
  const userLine = $("#userLine");
  if (authBtn) authBtn.textContent = user ? "Sign out" : "Sign in with Google";
  if (userLine) userLine.textContent = user ? `(${user.email})` : "";

  renderHeaderPills();

  const content = $("#content");
  if (!content) return;
  content.innerHTML = "";

  if (lastError) {
    content.appendChild(el("div", { class: "errorBox" }, [
      el("div", { class: "mono" }, ["Error: " + lastError])
    ]));
  }

  content.appendChild(renderPortalLinks());

  // If config row missing, tell them (usually only happens if RLS blocked initial seed)
  if (!configRow) {
    content.appendChild(el("div", { class: "card" }, [
      el("h2", {}, ["Config missing"]),
      el("p", { class: "hint" }, [
        "I couldn’t read the config row (config.id='app'). ",
        "In Supabase Table Editor, insert one row into table ",
        el("span", { class:"mono" }, ["config"]),
        " with id = ",
        el("span", { class:"mono" }, ["app"]),
        " and cutoff = NULL."
      ])
    ]));
  }

  // Admin panel (only you)
  if (user && isAdmin()) {
    content.appendChild(renderAdminPanel());
  }

  // Main UI
  if (!user) {
    content.appendChild(el("div", { class: "card" }, [
      el("h2", {}, ["Sign in to start"]),
      el("p", { class: "hint" }, ["Use the button in the top-right."])
    ]));
    return;
  }

  // ✅ NEW: require class selection before student info + bracket
  if (!submission?.class_id) {
    content.appendChild(renderClassSelector());
    return;
  }

  // Student info + bracket
  content.appendChild(renderStudentInfo());
  content.appendChild(renderBracket());
}

function renderAdminPanel() {
  const cutoffVal = configRow?.cutoff ? new Date(configRow.cutoff) : null;

  const wrapper = el("div", { class: "card" }, [
    el("h2", {}, ["Admin panel"]),
    el("p", { class: "hint" }, ["Only your email can see this. Set cutoff date/time, or leave it open."]),
  ]);

  const dateInput = el("input", {
    class: "input mono",
    type: "datetime-local",
    id: "cutoffInput",
    value: cutoffVal ? toLocalDateTimeValue(cutoffVal) : ""
  });

  const btnSet = el("button", {
    class: "btn primary",
    onclick: async () => {
      try {
        const v = $("#cutoffInput").value;
        if (!v) {
          await adminSetCutoff(null); // open
          alert("Cutoff cleared. Submissions are open.");
          return;
        }
        // datetime-local is local time; convert to ISO
        const dt = new Date(v);
        if (Number.isNaN(dt.getTime())) {
          throw new Error("Invalid cutoff date/time.");
        }
        await adminSetCutoff(dt.toISOString());
        alert("Cutoff saved.");
      } catch (e) {
        const msg = e?.message || String(e);
        showError(msg);
        alert("Save cutoff failed: " + msg);
      }
    }
  }, ["Save cutoff"]);

  const btnOpen = el("button", {
    class: "btn",
    onclick: async () => {
      try {
        await adminSetCutoff(null);
        alert("Cutoff cleared. Submissions are open.");
      } catch (e) {
        const msg = e?.message || String(e);
        showError(msg);
        alert("Clear cutoff failed: " + msg);
      }
    }
  }, ["Clear cutoff (open)"]);

  wrapper.appendChild(el("div", { class: "adminRow" }, [
    el("div", { style: "flex:1; min-width:220px" }, [
      el("div", { class: "label" }, ["Cutoff (local time)"]),
      dateInput,
      el("div", { class: "smallMuted" }, [
        cutoffVal
          ? `Current cutoff: ${cutoffVal.toLocaleString()}`
          : "Current cutoff: (not set — submissions open)"
      ])
    ]),
    el("div", {}, [btnSet]),
    el("div", {}, [btnOpen]),
  ]));

  const lockedWrap = el("div", { style: "margin-top:18px" }, [
    el("h3", {}, ["Unlock Brackets"]),
    el("p", { class: "hint" }, ["Admin only. Unlock a locked bracket so the student can edit again."]),
    el("button", {
      class: "btn",
      onclick: async () => {
        try {
          await loadAdminLockedSubmissions();
          render();
        } catch (e) {
          showError(e?.message || String(e));
        }
      }
    }, ["Refresh list"])
  ]);

  if (adminLoadingLocked) {
    lockedWrap.appendChild(el("p", { class: "smallMuted" }, ["Loading locked submissions..."]));
  } else if (!adminLockedSubmissions.length) {
    lockedWrap.appendChild(el("p", { class: "smallMuted" }, ["No locked submissions found."]));
  } else {
    for (const row of adminLockedSubmissions) {
      const title = `${row.nombre || "(No nombre)"} • ${row.clase || "(No clase)"}`;
      const uid = row.user_id || "";
      lockedWrap.appendChild(el("div", { class: "match" }, [
        el("div", { class: "matchTop" }, [
          el("div", {}, [
            el("div", { class: "song" }, [title]),
            el("div", { class: "artist mono" }, [uid]),
          ]),
          el("button", {
            class: "btn",
            onclick: async () => {
              try {
                await adminUnlockSubmission(uid);
              } catch (e) {
                showError(e?.message || String(e));
                alert("Unlock failed: " + (e?.message || String(e)));
              }
            }
          }, ["Unlock"])
        ])
      ]));
    }
  }

  wrapper.appendChild(lockedWrap);

  const resultsWrap = el("div", { style: "margin-top:18px" }, [
    el("h3", {}, ["Results Controls"]),
    el("p", { class: "hint" }, ["Reset official match results back to empty."]),
    el("button", {
      class: "btn",
      onclick: async () => {
        if (!confirm("Reset all official results? This clears winners used for scoring.")) return;
        try {
          await adminResetResults();
          alert("Official results reset.");
        } catch (e) {
          const msg = e?.message || String(e);
          showError(msg);
          alert("Reset results failed: " + msg);
        }
      }
    }, ["Reset results"])
  ]);

  wrapper.appendChild(resultsWrap);

  return wrapper;
}

function renderStudentInfo() {
  const nombre = submission?.nombre ?? "";
  const clase = submission?.clase ?? "";

  const wrap = el("div", { class: "card" }, [
    el("h2", {}, ["Student Info"]),
    el("p", { class: "hint" }, ["Stored inside your submission."]),
    el("div", { class: "grid2" }, [
      el("div", {}, [
        el("div", { class: "label" }, ["Nombre"]),
        el("input", { class: "input", id: "nombre", value: nombre, placeholder: "Nombre", oninput: scheduleSave })
      ]),
      el("div", {}, [
        el("div", { class: "label" }, ["Clase"]),
        el("input", { class: "input", id: "clase", value: clase, placeholder: "Clase", oninput: scheduleSave })
      ]),
    ])
  ]);

  return wrap;
}

function renderBracket() {
  const wrap = el("div", { class: "card" }, [
    el("h2", {}, ["Bracket"]),
    el("p", { class: "hint" }, ["Pick winners — they will auto-advance."]),
  ]);

  // Group by section titles in the order we defined
  const sections = [];
  const addSection = (title) => {
    const node = el("div", { class: "sectionTitle" }, [title]);
    sections.push(node);
    wrap.appendChild(node);
  };

  let lastTitle = "";
  for (const m of MATCHES) {
    if (m.title !== lastTitle) {
      addSection(m.title);
      lastTitle = m.title;
    }
    wrap.appendChild(renderMatch(m));
  }

  // Footer actions
  wrap.appendChild(el("hr", { class:"sep" }));

  const footer = el("div", { class:"footerBar" }, [
    el("button", { class:"btn", onclick: () => saveDraft().catch(e => showError(e.message || String(e))) , disabled: !editingAllowed() || submitting }, ["Save progress"]),
    el("button", { class:"btn primary", onclick: () => submitAndLock().catch(e => showError(e.message || String(e))), disabled: !editingAllowed() || submitting }, [submitting ? "Submitting..." : "Submit & Lock"]),
  ]);

  wrap.appendChild(footer);
  wrap.appendChild(el("div", { class:"note" }, [
    submission?.locked
      ? "Locked. You can view your bracket but you can’t change it."
      : "Save anytime. When you submit, it locks permanently."
  ]));

  return wrap;
}

function renderMatch(m) {
  const a = resolveSlot(m.a);
  const b = resolveSlot(m.b);

  const ready = !!(a && b);
  const picked = picks[m.id]; // 'A'|'B'|undefined

  const statusText = !ready
    ? "Waiting on earlier pick(s)"
    : picked
      ? "Picked"
      : "Not picked";

  const btnA = renderPickButton(m.id, "A", a, ready && editingAllowed(), picked === "A");
  const btnB = renderPickButton(m.id, "B", b, ready && editingAllowed(), picked === "B");

  const note = !ready
    ? el("div", { class:"note" }, ["Waiting on earlier pick(s) to fill this match-up."])
    : el("div", { class:"note" }, [""]);

  return el("div", { class:"match" }, [
    el("div", { class:"matchTop" }, [
      el("div", {}, [
        el("div", { class:"matchCode" }, [m.code]),
      ]),
      el("div", { class:"statusChip" }, [statusText]),
    ]),
    el("div", { class:"teams" }, [btnA, btnB]),
    note
  ]);
}

function renderPickButton(matchId, slot, entrant, enabled, selected) {
  const missing = !entrant;

  let labelSong = "Waiting…";
  let labelArtist = "Waiting on earlier pick(s)";
  if (!missing) {
    labelSong = entrant.song;
    labelArtist = entrant.artist;
  }

  const cls = [
    "pickBtn",
    !enabled ? "disabled" : "",
    selected ? "selected" : ""
  ].filter(Boolean).join(" ");

  return el("button", {
    class: cls,
    onclick: (e) => {
      e.preventDefault();
      if (!enabled) return;
      setPick(matchId, slot);
      scheduleSave();
    }
  }, [
    el("div", { class:"song" }, [labelSong]),
    el("div", { class:"artist" }, [labelArtist])
  ]);
}

// datetime-local helper
function toLocalDateTimeValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

document.addEventListener("DOMContentLoaded", init);


