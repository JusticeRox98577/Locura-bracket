// app.js (ESM)
// Requires: <script type="module" src="/app.js"></script> placed at end of <body>

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// --- Supabase ---
const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Admin email (front-end only shows UI; DB/RLS must enforce real admin access) ---
const ADMIN_EMAILS = new Set(["justicemw9857@gmail.com"]);

// --- DOM helpers ---
const $ = (sel) => document.querySelector(sel);

function setTopStatus(msg) {
  const el = $("#topStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function setError(msg) {
  const el = $("#errorBox");
  if (!el) return;
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function assertEl(id) {
  const el = $(id);
  if (!el) throw new Error(`Missing required element: ${id}`);
  return el;
}

// --- App state ---
let session = null;
let submission = null; // row from public.submissions
let savingTimer = null;

// Your bracket structure
// Round 0 is play-in on left; then Round 1 left (4 matches), QF left (2), Semi left (1)
// Round 1 right (4), QF right (2), Semi right (1), Final (1)
const BRACKET = {
  // Each match has: id, round, side, seedA, seedB
  // team label structure: { title, artist }
  // NOTE: Update these strings if you want exact display.
  teams: {
    // Left play-in (Round 0)
    L0A: { title: "TQMQA", artist: "Eladio Carrión" },
    L0B: { title: "Akakaw", artist: "Renata Flores" },

    // Left Round 1
    L1A: { title: "Ángel", artist: "Grupo Frontera & Romeo Santos" },
    L1B: { title: "Tocando el Cielo", artist: "Luis Fonsi" },
    L1C: { title: "Regalo", artist: "Alvaro Soler" },
    L1D: { title: "Si Sabes Contar", artist: "Los Ángeles Azules, Luck Ra, Yami Safdie" },
    L1E: { title: "Amuleto", artist: "Diego Torres" },
    L1F: { title: "Narcisista", artist: "The Warning" },
    L1G: { title: "Coleccionando Heridas", artist: "Karol G & Antonis Solís" },

    // Right Round 1
    R1A: { title: "¿Para Qué?", artist: "Ela Taubert" },
    R1B: { title: "La Mujer que Soy", artist: "Fanny Lu" },
    R1C: { title: "Buen Café", artist: "Efecto Pasillo" },
    R1D: { title: "Goodbye", artist: "Arthur Hanlon, Carlos Vives, Goyo" },
    R1E: { title: "6 de Febrero", artist: "Aitana" },
    R1F: { title: "Luna Llena", artist: "Ebenezer Guerra & Elvis Crespo" },
    R1G: { title: "Vuela", artist: "Luck Ra & Ke Personaje" },
    R1H: { title: "Music Sessions #66", artist: "Daddy Yankee & BZRP" },
  },

  matches: [
    // Round 0 (Play-in left)
    { id: "L-R0", round: 0, side: "L", a: "L0A", b: "L0B" },

    // Round 1 (Left) - 4 matches; first match uses winner of play-in vs "Ángel"
    { id: "L-R1-1", round: 1, side: "L", a: "WIN:L-R0", b: "L1A" },
    { id: "L-R1-2", round: 1, side: "L", a: "L1B", b: "L1C" },
    { id: "L-R1-3", round: 1, side: "L", a: "L1D", b: "L1E" },
    { id: "L-R1-4", round: 1, side: "L", a: "L1F", b: "L1G" },

    // Quarterfinals (Left)
    { id: "L-QF-1", round: 2, side: "L", a: "WIN:L-R1-1", b: "WIN:L-R1-2" },
    { id: "L-QF-2", round: 2, side: "L", a: "WIN:L-R1-3", b: "WIN:L-R1-4" },

    // Semifinal (Left)
    { id: "L-SF", round: 3, side: "L", a: "WIN:L-QF-1", b: "WIN:L-QF-2" },

    // Round 1 (Right) - 4 matches
    { id: "R-R1-1", round: 1, side: "R", a: "R1A", b: "R1B" },
    { id: "R-R1-2", round: 1, side: "R", a: "R1C", b: "R1D" },
    { id: "R-R1-3", round: 1, side: "R", a: "R1E", b: "R1F" },
    { id: "R-R1-4", round: 1, side: "R", a: "R1G", b: "R1H" },

    // Quarterfinals (Right)
    { id: "R-QF-1", round: 2, side: "R", a: "WIN:R-R1-1", b: "WIN:R-R1-2" },
    { id: "R-QF-2", round: 2, side: "R", a: "WIN:R-R1-3", b: "WIN:R-R1-4" },

    // Semifinal (Right)
    { id: "R-SF", round: 3, side: "R", a: "WIN:R-QF-1", b: "WIN:R-QF-2" },

    // Final
    { id: "FINAL", round: 4, side: "F", a: "WIN:L-SF", b: "WIN:R-SF" },
  ],
};

// --- Utilities to compute winners carry-forward ---
function getPick(matchId) {
  return submission?.picks?.[matchId] ?? null; // should store a teamKey like "L1A" or "R1C" etc.
}

function resolveSlot(slot) {
  // slot can be a team key like "R1A" OR "WIN:<matchId>"
  if (!slot) return null;
  if (!slot.startsWith("WIN:")) return slot;

  const matchId = slot.slice(4);
  const pick = getPick(matchId);
  return pick || null;
}

function clearDependentPicks(changedMatchId) {
  // If you change a pick earlier, any later picks that depended on the old winner might now be invalid.
  // We’ll walk forward and if a match uses WIN:changedMatchId somewhere in its ancestry AND current pick isn't one of its current options, clear it.

  // Quick ancestry check: a slot is dependent if it is WIN:... chain that eventually references changedMatchId
  const dependsOn = (slot, targetId) => {
    if (!slot || !slot.startsWith("WIN:")) return false;
    const m = slot.slice(4);
    if (m === targetId) return true;
    const parent = BRACKET.matches.find(x => x.id === m);
    if (!parent) return false;
    return dependsOn(parent.a, targetId) || dependsOn(parent.b, targetId);
  };

  for (const m of BRACKET.matches) {
    if (m.id === changedMatchId) continue;
    const aNow = resolveSlot(m.a);
    const bNow = resolveSlot(m.b);
    const pick = getPick(m.id);

    const isDependent = dependsOn(m.a, changedMatchId) || dependsOn(m.b, changedMatchId);
    if (!isDependent) continue;

    // If match isn't fillable yet, keep pick cleared
    if (!aNow || !bNow) {
      if (pick) delete submission.picks[m.id];
      continue;
    }

    // If pick exists but isn't one of the valid options anymore, clear it
    if (pick && pick !== aNow && pick !== bNow) {
      delete submission.picks[m.id];
    }
  }
}

// --- Rendering ---
function teamLabel(teamKey) {
  if (!teamKey) return { title: "Waiting…", artist: "Waiting on earlier pick(s)" };
  const t = BRACKET.teams[teamKey];
  if (!t) return { title: "Waiting…", artist: "Waiting on earlier pick(s)" };
  return t;
}

function render() {
  // Header buttons
  const signInBtn = $("#btnSignIn");
  const signOutBtn = $("#btnSignOut");
  const who = $("#whoami");
  const adminChip = $("#adminChip");
  if (session?.user) {
    if (signInBtn) signInBtn.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "inline-flex";
    if (who) who.textContent = session.user.email || session.user.id;
    if (adminChip) adminChip.style.display = ADMIN_EMAILS.has(session.user.email) ? "inline-flex" : "none";
  } else {
    if (signInBtn) signInBtn.style.display = "inline-flex";
    if (signOutBtn) signOutBtn.style.display = "none";
    if (who) who.textContent = "";
    if (adminChip) adminChip.style.display = "none";
  }

  // Student info
  const nameInput = $("#studentName");
  const classInput = $("#studentClass");
  if (nameInput) nameInput.value = submission?.student_name ?? "";
  if (classInput) classInput.value = submission?.student_class ?? "";

  // Bracket list
  const bracketEl = assertEl("#bracket");
  bracketEl.innerHTML = "";

  const grouped = new Map();
  for (const m of BRACKET.matches) {
    const key =
      m.round === 0 ? "Round 0 (Play-In)" :
      m.round === 1 ? (m.side === "L" ? "Round 1 (Left)" : "Round 1 (Right)") :
      m.round === 2 ? (m.side === "L" ? "Quarterfinals (Left)" : "Quarterfinals (Right)") :
      m.round === 3 ? (m.side === "L" ? "Semifinal (Left)" : "Semifinal (Right)") :
      "Final";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(m);
  }

  for (const [section, matches] of grouped.entries()) {
    const h = document.createElement("h3");
    h.textContent = section;
    h.className = "sectionTitle";
    bracketEl.appendChild(h);

    for (const m of matches) {
      const aKey = resolveSlot(m.a);
      const bKey = resolveSlot(m.b);
      const a = teamLabel(aKey);
      const b = teamLabel(bKey);
      const pick = getPick(m.id);

      const card = document.createElement("div");
      card.className = "matchCard";
      card.dataset.matchId = m.id;

      const top = document.createElement("div");
      top.className = "matchTop";
      top.innerHTML = `<div class="matchId">${m.id}</div>
                       <div class="pickBadge">${pick ? "Picked" : "Not picked"}</div>`;
      card.appendChild(top);

      const opts = document.createElement("div");
      opts.className = "options";

      const optBtn = (teamKey, label) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "teamBtn";
        btn.dataset.matchId = m.id;
        btn.dataset.teamKey = teamKey || "";
        btn.disabled = !aKey || !bKey; // can’t pick until both are known
        btn.innerHTML = `
          <div class="teamTitle">${label.title}</div>
          <div class="teamArtist">${label.artist}</div>
        `;
        if (pick && teamKey && pick === teamKey) btn.classList.add("selected");
        return btn;
      };

      opts.appendChild(optBtn(aKey, a));
      opts.appendChild(optBtn(bKey, b));

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = (!aKey || !bKey) ? "Waiting on earlier pick(s) to fill this match-up." : "";

      card.appendChild(opts);
      card.appendChild(hint);

      bracketEl.appendChild(card);
    }
  }
}

// --- Saving (debounced) ---
function scheduleSave() {
  if (!session?.user || !submission) return;
  clearTimeout(savingTimer);
  savingTimer = setTimeout(saveNow, 350);
}

async function saveNow() {
  try {
    setError("");
    setTopStatus("Saving…");

    const payload = {
      user_id: session.user.id,
      email: session.user.email,
      student_name: submission.student_name ?? null,
      student_class: submission.student_class ?? null,
      picks: submission.picks ?? {},
      locked: submission.locked ?? false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("submissions")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    submission = data;

    setTopStatus(""); // clear permanent loading
  } catch (e) {
    setTopStatus("");
    setError(`Save failed: ${e.message || String(e)}`);
    console.error(e);
  }
}

// --- Auth ---
async function signIn() {
  setError("");
  setTopStatus("Opening Google sign-in…");
  const redirectTo = window.location.origin;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // This requests the user email; Supabase will store it in session.user.email
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) {
    setTopStatus("");
    setError(`Sign-in failed: ${error.message}`);
  }
}

async function signOut() {
  setError("");
  setTopStatus("Signing out…");
  const { error } = await supabase.auth.signOut();
  if (error) {
    setTopStatus("");
    setError(`Sign-out failed: ${error.message}`);
  }
  // onAuthStateChange will handle UI reset
}

// --- Load/create current user's submission row ---
async function loadSubmission() {
  if (!session?.user) {
    submission = null;
    return;
  }

  setError("");
  setTopStatus("Loading…");

  // Always expect 0 or 1 row per user_id (your unique index supports this)
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    setTopStatus("");
    throw error;
  }

  if (data) {
    submission = {
      ...data,
      picks: data.picks || {},
      locked: !!data.locked,
    };
  } else {
    // create empty row
    submission = {
      user_id: session.user.id,
      email: session.user.email,
      student_name: "",
      student_class: "",
      picks: {},
      locked: false,
    };
    await saveNow();
  }

  setTopStatus(""); // clear permanent loading
}

// --- Events ---
function attachEvents() {
  // Top buttons
  assertEl("#btnSignIn").addEventListener("click", (e) => {
    e.preventDefault();
    signIn();
  });

  assertEl("#btnSignOut").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

  // Student info saves
  const nameInput = assertEl("#studentName");
  const classInput = assertEl("#studentClass");

  nameInput.addEventListener("input", () => {
    if (!submission) return;
    submission.student_name = nameInput.value;
    scheduleSave();
  });

  classInput.addEventListener("input", () => {
    if (!submission) return;
    submission.student_class = classInput.value;
    scheduleSave();
  });

  // Bracket picks (event delegation)
  assertEl("#bracket").addEventListener("click", (e) => {
    const btn = e.target.closest("button.teamBtn");
    if (!btn) return;

    const matchId = btn.dataset.matchId;
    const teamKey = btn.dataset.teamKey;

    if (!submission || !session?.user) return;
    if (submission.locked) return;
    if (!matchId || !teamKey) return;

    // set pick
    submission.picks = submission.picks || {};
    submission.picks[matchId] = teamKey;

    // clear dependent picks that no longer make sense
    clearDependentPicks(matchId);

    // rerender so winners “carry forward”
    render();

    // save
    scheduleSave();
  });

  // Global error visibility (so we stop guessing)
  window.addEventListener("error", (ev) => {
    setError(`JS error: ${ev.message}`);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    setError(`Promise error: ${ev.reason?.message || String(ev.reason)}`);
  });
}

// --- Boot ---
async function boot() {
  try {
    attachEvents();

    // Initial session
    const { data: sessData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw sessErr;

    session = sessData.session;
    render();

    // Listen to auth changes
    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      session = newSession;
      try {
        if (session?.user) {
          await loadSubmission();
        } else {
          submission = null;
          setTopStatus("");
        }
      } catch (e) {
        setTopStatus("");
        setError(`Auth load failed: ${e.message || String(e)}`);
      }
      render();
    });

    // Load submission if logged in
    if (session?.user) {
      await loadSubmission();
      render();
    }

    setTopStatus(""); // never leave permanent Loading
  } catch (e) {
    setTopStatus("");
    setError(`Boot failed: ${e.message || String(e)}`);
    console.error(e);
  }
}

// Ensure DOM exists
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
