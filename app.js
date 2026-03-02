import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --------------------
// CONFIG — fill these in
// --------------------
const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co"; // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0"; // starts with sb_publishable_
const ADMIN_EMAILS = ["justicemw9857@gmail.com"]; // ONLY YOU

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bracket “seeds” (round 1). Use song IDs from songs.json.
// NOTE: I mapped this to your screenshot layout.
// Edit IDs if you change songs.json.
const ROUND1 = [
  ["tqma", "akakaw"],
  ["angel", "tocando_el_cielo"],
  ["regalo", "si_sabes_contar"],
  ["amuleto", "narcisista"],
  ["coleccionando_heridas", "para_que"],
  ["la_mujer_que_soy", "buen_cafe"],
  ["goodbye", "seis_de_febrero"],
  ["luna_llena", "vuela"]
];

// --------------------
// DOM
// --------------------
const el = (id) => document.getElementById(id);

const statusEl = el("status");
const profileEl = el("profile");
const userEmailEl = el("userEmail");
const lockBadgeEl = el("lockBadge");
const cutoffNoteEl = el("cutoffNote");

const btnSignIn = el("btnSignIn");
const btnSignOut = el("btnSignOut");

const bracketCard = el("bracketCard");
const bracketEl = el("bracket");
const btnSubmit = el("btnSubmit");
const submitMsg = el("submitMsg");

const adminPanel = el("adminPanel");
const cutoffInput = el("cutoffInput");
const btnSaveCutoff = el("btnSaveCutoff");
const adminMsg = el("adminMsg");

// --------------------
// State
// --------------------
let SONGS = new Map();               // id -> {title, artist}
let session = null;
let user = null;

let config = { cutoff: null };
let submission = null;               // existing submission row or null
let locked = false;

let picks = {
  r1: Array(ROUND1.length).fill(null), // winners by match index
  r2: Array(ROUND1.length / 2).fill(null),
  r3: Array(ROUND1.length / 4).fill(null),
  r4: Array(1).fill(null)             // champion
};

// --------------------
// Helpers
// --------------------
function fmtSong(id) {
  const s = SONGS.get(id);
  if (!s) return { title: id, artist: "" };
  return s;
}

function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.map(x => x.toLowerCase()).includes(email.toLowerCase());
}

function nowUtcMs() {
  return Date.now();
}

function cutoffMs() {
  if (!config.cutoff) return null;
  const d = new Date(config.cutoff);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function isCutoffPassed() {
  const c = cutoffMs();
  return c != null && nowUtcMs() >= c;
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function disableAllPicking(disabled) {
  bracketEl.querySelectorAll("button.pick").forEach((b) => {
    b.disabled = disabled;
  });
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// --------------------
// Bracket computation
// --------------------
function computeNextRoundFrom(prevWinners) {
  // pair winners into next round matches
  const matches = [];
  for (let i = 0; i < prevWinners.length; i += 2) {
    const a = prevWinners[i];
    const b = prevWinners[i + 1];
    matches.push([a, b]); // may be null until picked
  }
  return matches;
}

function sanitizeDownstream(fromRound) {
  // If earlier round changes, downstream picks that are no longer valid must clear.
  // fromRound: 1 means r2/r3/r4 maybe affected, etc.
  if (fromRound <= 1) {
    // rebuild r2 validity
    const r2Matches = computeNextRoundFrom(picks.r1);
    for (let i = 0; i < r2Matches.length; i++) {
      const [a, b] = r2Matches[i];
      if (picks.r2[i] && picks.r2[i] !== a && picks.r2[i] !== b) picks.r2[i] = null;
    }
  }
  if (fromRound <= 2) {
    const r3Matches = computeNextRoundFrom(picks.r2);
    for (let i = 0; i < r3Matches.length; i++) {
      const [a, b] = r3Matches[i];
      if (picks.r3[i] && picks.r3[i] !== a && picks.r3[i] !== b) picks.r3[i] = null;
    }
  }
  if (fromRound <= 3) {
    const finalMatch = computeNextRoundFrom(picks.r3)[0] || [null, null];
    const [a, b] = finalMatch;
    if (picks.r4[0] && picks.r4[0] !== a && picks.r4[0] !== b) picks.r4[0] = null;
  }
}

function setPick(roundKey, matchIndex, songId) {
  // Apply the pick
  picks[roundKey][matchIndex] = songId;

  // Sanitize downstream
  if (roundKey === "r1") sanitizeDownstream(1);
  if (roundKey === "r2") sanitizeDownstream(2);
  if (roundKey === "r3") sanitizeDownstream(3);

  // Re-render
  renderBracket();
}

// --------------------
// Rendering
// --------------------
function renderMatch(roundKey, matchIndex, teamAId, teamBId, readOnly) {
  const match = document.createElement("div");
  match.className = "match";

  const makeBtn = (songId) => {
    const btn = document.createElement("button");
    btn.className = "pick";
    btn.type = "button";

    const s = songId ? fmtSong(songId) : null;
    btn.innerHTML = songId
      ? `<div>${escapeHtml(s.title)}<small>${escapeHtml(s.artist)}</small></div>`
      : `<div><span style="color:var(--muted);font-weight:700;">(waiting on earlier pick)</span></div>`;

    const selected = picks[roundKey][matchIndex] === songId && songId != null;
    if (selected) btn.classList.add("selected");

    btn.disabled = readOnly || songId == null;

    btn.addEventListener("click", () => {
      if (readOnly) return;
      if (!songId) return;
      setPick(roundKey, matchIndex, songId);
    });

    return btn;
  };

  match.appendChild(makeBtn(teamAId));
  match.appendChild(makeBtn(teamBId));
  return match;
}

function renderRound(title, roundKey, matches, readOnly) {
  const col = document.createElement("div");
  col.className = "round";
  const h = document.createElement("h3");
  h.textContent = title;
  col.appendChild(h);

  matches.forEach((m, i) => {
    const [a, b] = m;
    col.appendChild(renderMatch(roundKey, i, a, b, readOnly));
  });

  return col;
}

function renderBracket() {
  bracketEl.innerHTML = "";

  // Build matches for each round
  const r1Matches = ROUND1;
  const r2Matches = computeNextRoundFrom(picks.r1);
  const r3Matches = computeNextRoundFrom(picks.r2);
  const r4Matches = computeNextRoundFrom(picks.r3); // array with 1 match

  const readOnly = locked || isCutoffPassed();

  bracketEl.appendChild(renderRound("Round 1", "r1", r1Matches, readOnly));
  bracketEl.appendChild(renderRound("Quarterfinals", "r2", r2Matches, readOnly));
  bracketEl.appendChild(renderRound("Semifinals", "r3", r3Matches, readOnly));
  bracketEl.appendChild(renderRound("Final", "r4", r4Matches, readOnly));

  // UI state
  if (readOnly) {
    disableAllPicking(true);
  }

  // Submit button behavior
  const canSubmit =
    !locked &&
    !isCutoffPassed() &&
    user &&
    picks.r4[0] != null; // must have champion

  btnSubmit.disabled = !canSubmit;

  if (!user) {
    submitMsg.textContent = "Sign in to fill out and submit your bracket.";
  } else if (locked) {
    submitMsg.textContent = "Your bracket is locked. You can view it, but you cannot change it.";
  } else if (isCutoffPassed()) {
    submitMsg.textContent = "Submissions are closed (cutoff passed). You can view your bracket.";
  } else if (!picks.r4[0]) {
    submitMsg.textContent = "Finish your bracket by picking a champion, then submit.";
  } else {
    submitMsg.textContent = "Ready to submit. Submitting locks your bracket permanently.";
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --------------------
// Supabase: config + submission
// --------------------
async function loadConfig() {
  const { data, error } = await supabase
    .from("config")
    .select("id, cutoff")
    .eq("id", "app")
    .maybeSingle();

  if (error) throw error;

  config.cutoff = data?.cutoff ?? null;

  // Admin input prefill (datetime-local needs local time)
  if (config.cutoff) {
    const d = new Date(config.cutoff);
    cutoffInput.value = toLocalDatetimeValue(d);
  } else {
    cutoffInput.value = "";
  }
}

function toLocalDatetimeValue(dateObj) {
  // yyyy-MM-ddTHH:mm
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  const mm = pad(dateObj.getMonth() + 1);
  const dd = pad(dateObj.getDate());
  const hh = pad(dateObj.getHours());
  const mi = pad(dateObj.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

async function loadMySubmission() {
  submission = null;
  locked = false;

  if (!user) return;

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    submission = data;
    locked = !!data.locked;

    // Restore picks if present
    if (data.picks) {
      const p = data.picks;
      // Defensive shape check
      if (p.r1 && p.r2 && p.r3 && p.r4) {
        picks = deepClone(p);
        sanitizeDownstream(1);
      }
    }
  }
}

async function submitAndLock() {
  if (!user) return;

  // Must be complete (champion picked)
  if (!picks.r4[0]) {
    alert("Pick a champion first.");
    return;
  }

  btnSubmit.disabled = true;
  submitMsg.textContent = "Submitting…";

  const payload = {
    user_id: user.id,
    picks: deepClone(picks),
    locked: true
  };

  if (!submission) {
    // create
    const { data, error } = await supabase
      .from("submissions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      submitMsg.textContent = `Error: ${error.message}`;
      renderBracket();
      return;
    }
    submission = data;
    locked = true;
  } else {
    // update (allowed only if not locked yet; RLS enforces too)
    const { data, error } = await supabase
      .from("submissions")
      .update(payload)
      .eq("id", submission.id)
      .select()
      .single();

    if (error) {
      submitMsg.textContent = `Error: ${error.message}`;
      renderBracket();
      return;
    }
    submission = data;
    locked = true;
  }

  lockBadgeEl.classList.remove("hidden");
  submitMsg.textContent = "Submitted ✅ Your bracket is now locked.";
  renderBracket();
}

async function saveCutoffAdmin() {
  adminMsg.textContent = "Saving…";

  // Blank = null (open submissions)
  const value = cutoffInput.value?.trim();
  const cutoff = value ? new Date(value).toISOString() : null;

  const { error } = await supabase
    .from("config")
    .upsert({ id: "app", cutoff }, { onConflict: "id" });

  if (error) {
    adminMsg.textContent = `Error: ${error.message}`;
    return;
  }

  config.cutoff = cutoff;
  adminMsg.textContent = cutoff ? "Cutoff saved ✅" : "Cutoff cleared ✅ (submissions open)";
  refreshCutoffNote();
  renderBracket();
}

function refreshCutoffNote() {
  const c = cutoffMs();
  if (!c) {
    cutoffNoteEl.textContent = "Cutoff: not set (submissions open).";
    cutoffNoteEl.style.color = "var(--muted)";
    return;
  }

  const local = new Date(c).toLocaleString();
  if (isCutoffPassed()) {
    cutoffNoteEl.textContent = `Cutoff passed: ${local} (submissions closed).`;
    cutoffNoteEl.style.color = "var(--warn)";
  } else {
    cutoffNoteEl.textContent = `Cutoff: ${local}`;
    cutoffNoteEl.style.color = "var(--muted)";
  }
}

// --------------------
// Auth
// --------------------
async function signIn() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) alert(error.message);
}

async function signOut() {
  await supabase.auth.signOut();
}

function updateAuthUI() {
  const email = user?.email || "";

  if (!user) {
    btnSignIn.classList.remove("hidden");
    btnSignOut.classList.add("hidden");
    profileEl.classList.add("hidden");
    bracketCard.classList.add("hidden");
    adminPanel.classList.add("hidden");
    lockBadgeEl.classList.add("hidden");
    setStatus("Sign in to fill out your bracket.");
    return;
  }

  btnSignIn.classList.add("hidden");
  btnSignOut.classList.remove("hidden");

  profileEl.classList.remove("hidden");
  bracketCard.classList.remove("hidden");

  userEmailEl.textContent = email;

  // Admin gate
  if (isAdminEmail(email)) adminPanel.classList.remove("hidden");
  else adminPanel.classList.add("hidden");

  lockBadgeEl.classList.toggle("hidden", !locked);

  refreshCutoffNote();

  if (locked) setStatus("Signed in. Your bracket is locked.");
  else if (isCutoffPassed()) setStatus("Signed in. Submissions are closed.");
  else setStatus("Signed in. Make your picks.");
}

// --------------------
// Boot
// --------------------
async function loadSongs() {
  const res = await fetch("./songs.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load songs.json");
  const json = await res.json();
  SONGS = new Map(json.songs.map((s) => [s.id, s]));
}

async function init() {
  try {
    setStatus("Loading…");

    await loadSongs();
    await loadConfig();

    const { data } = await supabase.auth.getSession();
    session = data.session;
    user = session?.user ?? null;

    if (user && user.email && !user.email.toLowerCase().endsWith("@gmail.com")) {
      // If you truly want ONLY Google emails, you can restrict by domain here.
      // But since you're using Google sign-in, this is mostly redundant.
    }

    await loadMySubmission();
    updateAuthUI();
    renderBracket();

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, _session) => {
      session = _session;
      user = _session?.user ?? null;
      await loadConfig();
      await loadMySubmission();
      updateAuthUI();
      renderBracket();
    });

    // Wire buttons
    btnSignIn.addEventListener("click", signIn);
    btnSignOut.addEventListener("click", signOut);
    btnSubmit.addEventListener("click", submitAndLock);
    btnSaveCutoff.addEventListener("click", saveCutoffAdmin);

    setStatus(user ? "Ready." : "Sign in to fill out your bracket.");
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message || e}`);
  }
}

init();
