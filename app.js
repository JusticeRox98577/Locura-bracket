import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ EDIT THESE
const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";
const ADMIN_EMAIL = "justicemw9857@gmail.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// UI helpers
const el = (id) => document.getElementById(id);

const btnLogin = el("btnLogin");
const btnLogout = el("btnLogout");
const btnSave = el("btnSave");
const btnLock = el("btnLock");
const btnSetCutoff = el("btnSetCutoff");
const btnClearCutoff = el("btnClearCutoff");

const status = el("status");
const notice = el("notice");
const me = el("me");
const meEmail = el("meEmail");
const cutoffText = el("cutoffText");
const lockState = el("lockState");

const bracketSection = el("bracket");
const bracketRoot = el("bracketRoot");
const adminSection = el("admin");
const adminCutoff = el("adminCutoff");

// State
let SONGS = [];
let SONG_MAP = new Map();
let CURRENT_USER = null;
let CURRENT_SUBMISSION = null; // row from submissions
let CUTOFF = null; // Date or null
let DIRTY = false;

// ---------- UI ----------
function showNotice(msg, kind = "info") {
  notice.classList.remove("hidden");
  notice.innerHTML = `<strong>${kind.toUpperCase()}:</strong> ${msg}`;
}
function hideNotice() {
  notice.classList.add("hidden");
  notice.innerHTML = "";
}
function setStatus(msg) {
  status.textContent = msg || "";
}

// ---------- Bracket helpers ----------
function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

function roundCount(n) {
  return Math.log2(n);
}

function nowIso() {
  return new Date().toISOString();
}

function cutoffPassed() {
  if (!CUTOFF) return false;
  return new Date() >= CUTOFF;
}

function canEdit() {
  if (!CURRENT_USER) return false;
  if (cutoffPassed()) return false;
  if (!CURRENT_SUBMISSION) return false;
  return CURRENT_SUBMISSION.locked !== true;
}

async function loadSongs() {
  const res = await fetch("./songs.json", { cache: "no-store" });
  const json = await res.json();
  SONGS = json.songs || [];
  SONG_MAP = new Map(SONGS.map((s) => [s.id, s]));

  if (!isPowerOfTwo(SONGS.length)) {
    showNotice(
      `songs.json has ${SONGS.length} songs. Use 8/16/32/64… (power of 2) for a clean bracket.`,
      "warning"
    );
  }
}

function getInitialRoundIds() {
  return SONGS.map((s) => s.id);
}

function buildEmptyPicks() {
  const n = SONGS.length;
  const rounds = roundCount(n);

  const roundWinners = [];
  for (let r = 0; r < rounds; r++) {
    roundWinners.push(Array(n / (2 ** (r + 1))).fill(null));
  }

  return {
    version: 1,
    createdAt: nowIso(),
    roundWinners
  };
}

function deriveRoundEntries(picks) {
  const rounds = roundCount(SONGS.length);
  const entries = [];
  entries[0] = getInitialRoundIds();

  for (let r = 1; r < rounds; r++) {
    const prevWinners = picks.roundWinners[r - 1];
    entries[r] = prevWinners.slice(); // may contain nulls
  }
  return entries;
}

function makeChoice(group, id, label, winner, disabled, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "choice";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = group;
  input.value = id ?? "";
  input.disabled = disabled;
  input.checked = winner && id && winner === id;

  input.addEventListener("change", () => {
    if (!id) return;
    onChange();
  });

  const span = document.createElement("span");
  span.textContent = label;

  wrap.appendChild(input);
  wrap.appendChild(span);
  return wrap;
}

function onPick(picks, roundIndex, matchIndex, winnerId) {
  picks.roundWinners[roundIndex][matchIndex] = winnerId;

  // Clear all later rounds (simple + safe)
  for (let r = roundIndex + 1; r < picks.roundWinners.length; r++) {
    picks.roundWinners[r] = picks.roundWinners[r].map(() => null);
  }

  DIRTY = true;
  renderBracket(picks);
}

function renderBracket(picks) {
  bracketRoot.innerHTML = "";

  const rounds = roundCount(SONGS.length);
  const entries = deriveRoundEntries(picks);

  const roundsDiv = document.createElement("div");
  roundsDiv.className = "rounds";

  for (let r = 0; r < rounds; r++) {
    const roundDiv = document.createElement("div");
    roundDiv.className = "round";

    const title = document.createElement("h3");
    title.textContent = `Round ${r + 1}`;
    roundDiv.appendChild(title);

    const roundEntries = entries[r];
    const matchCount = roundEntries.length / 2;

    for (let m = 0; m < matchCount; m++) {
      const aId = roundEntries[m * 2] ?? null;
      const bId = roundEntries[m * 2 + 1] ?? null;

      const winner = picks.roundWinners[r][m] ?? null;

      const matchup = document.createElement("div");
      matchup.className = "matchup";

      const aName = aId ? (SONG_MAP.get(aId)?.name || aId) : "(TBD)";
      const bName = bId ? (SONG_MAP.get(bId)?.name || bId) : "(TBD)";

      const disabled = !canEdit() || !aId || !bId;

      matchup.appendChild(
        makeChoice(`r${r}m${m}`, aId, aName, winner, disabled, () => onPick(picks, r, m, aId))
      );
      matchup.appendChild(
        makeChoice(`r${r}m${m}`, bId, bName, winner, disabled, () => onPick(picks, r, m, bId))
      );

      roundDiv.appendChild(matchup);
    }

    roundsDiv.appendChild(roundDiv);
  }

  bracketRoot.appendChild(roundsDiv);
  updateButtons();
}

// Reads picks back out of CURRENT_SUBMISSION (we keep picks in-memory via rerender)
function readPicksFromUI() {
  // We always render from CURRENT_SUBMISSION.picks, so just return that.
  // (We update it in-place in onPick via `picks` reference.)
  return CURRENT_SUBMISSION?.picks || buildEmptyPicks();
}

function updateButtons() {
  const locked = CURRENT_SUBMISSION?.locked === true;

  btnSave.classList.toggle("hidden", !CURRENT_USER);
  btnLock.classList.toggle("hidden", !CURRENT_USER);

  btnSave.disabled = !canEdit() || !DIRTY;
  btnLock.disabled = !canEdit();

  lockState.classList.toggle("hidden", !CURRENT_USER);
  lockState.textContent = locked ? "LOCKED" : "Editable (until cutoff)";
}

// ---------- Supabase data ----------
async function fetchCutoff() {
  const { data, error } = await supabase
    .from("config")
    .select("cutoff")
    .eq("id", "app")
    .maybeSingle();

  if (error) {
    showNotice(`Could not read cutoff: ${error.message}`, "error");
    return;
  }

  CUTOFF = data?.cutoff ? new Date(data.cutoff) : null;
  cutoffText.textContent = CUTOFF ? CUTOFF.toLocaleString() : "No cutoff set (open)";

  // Also fill admin input
  if (CUTOFF) {
    // datetime-local expects "YYYY-MM-DDTHH:MM"
    const local = new Date(CUTOFF);
    const pad = (n) => String(n).padStart(2, "0");
    const v = `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
    adminCutoff.value = v;
  } else {
    adminCutoff.value = "";
  }
}

async function ensureSubmissionRow() {
  const uid = CURRENT_USER.id;

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    showNotice(`Submission fetch error: ${error.message}`, "error");
    return;
  }

  if (data) {
    CURRENT_SUBMISSION = data;
    // Ensure picks exists
    if (!CURRENT_SUBMISSION.picks) CURRENT_SUBMISSION.picks = buildEmptyPicks();
    return;
  }

  const empty = buildEmptyPicks();
  const { data: created, error: insErr } = await supabase
    .from("submissions")
    .insert({ user_id: uid, picks: empty, locked: false })
    .select("*")
    .single();

  if (insErr) {
    showNotice(`Submission create error: ${insErr.message}`, "error");
    return;
  }

  CURRENT_SUBMISSION = created;
}

async function refreshUI() {
  hideNotice();

  if (!CURRENT_USER) {
    me.classList.add("hidden");
    bracketSection.classList.add("hidden");
    adminSection.classList.add("hidden");
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    setStatus("Not signed in");
    return;
  }

  btnLogin.classList.add("hidden");
  btnLogout.classList.remove("hidden");
  me.classList.remove("hidden");
  bracketSection.classList.remove("hidden");
  setStatus("");

  meEmail.textContent = CURRENT_USER.email || "(no email?)";

  await fetchCutoff();
  await ensureSubmissionRow();

  // Admin visibility
  const isAdmin = (CURRENT_USER.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
  adminSection.classList.toggle("hidden", !isAdmin);

  if (cutoffPassed()) showNotice("Cutoff has passed. Brackets are view-only.", "info");
  if (CURRENT_SUBMISSION?.locked) showNotice("Your bracket is locked. View-only.", "info");

  DIRTY = false;
  renderBracket(CURRENT_SUBMISSION.picks || buildEmptyPicks());
}

// ---------- Actions ----------
async function signIn() {
  await supabase.auth.signInWithOAuth({ provider: "google" });
}

async function signOut() {
  await supabase.auth.signOut();
  location.reload();
}

async function savePicks() {
  if (!canEdit()) return;

  const { data, error } = await supabase
    .from("submissions")
    .update({ picks: CURRENT_SUBMISSION.picks })
    .eq("user_id", CURRENT_USER.id)
    .select("*")
    .single();

  if (error) {
    showNotice(`Save failed: ${error.message}`, "error");
    return;
  }

  CURRENT_SUBMISSION = data;
  DIRTY = false;
  showNotice("Saved ✅");
  updateButtons();
}

async function lockSubmission() {
  if (!canEdit()) return;

  const ok = confirm("Lock your submission? You will NOT be able to change it after locking.");
  if (!ok) return;

  const { data, error } = await supabase
    .from("submissions")
    .update({ locked: true })
    .eq("user_id", CURRENT_USER.id)
    .select("*")
    .single();

  if (error) {
    showNotice(`Lock failed: ${error.message}`, "error");
    return;
  }

  CURRENT_SUBMISSION = data;
  showNotice("Locked ✅ You can still view your bracket.", "info");
  updateButtons();
  renderBracket(CURRENT_SUBMISSION.picks);
}

async function setCutoff() {
  const isAdmin = (CURRENT_USER.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (!isAdmin) return;

  if (!adminCutoff.value) {
    showNotice("Pick a date/time first.", "warning");
    return;
  }

  const iso = new Date(adminCutoff.value).toISOString();

  const { error } = await supabase
    .from("config")
    .update({ cutoff: iso })
    .eq("id", "app");

  if (error) {
    showNotice(`Cutoff update failed: ${error.message}`, "error");
    return;
  }

  showNotice("Cutoff updated ✅");
  await fetchCutoff();
  updateButtons();
}

async function clearCutoff() {
  const isAdmin = (CURRENT_USER.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (!isAdmin) return;

  const { error } = await supabase
    .from("config")
    .update({ cutoff: null })
    .eq("id", "app");

  if (error) {
    showNotice(`Clear cutoff failed: ${error.message}`, "error");
    return;
  }

  showNotice("Cutoff cleared ✅ Submissions open.");
  await fetchCutoff();
  updateButtons();
}

// ---------- Wire up ----------
btnLogin?.addEventListener("click", signIn);
btnLogout?.addEventListener("click", signOut);
btnSave?.addEventListener("click", savePicks);
btnLock?.addEventListener("click", lockSubmission);
btnSetCutoff?.addEventListener("click", setCutoff);
btnClearCutoff?.addEventListener("click", clearCutoff);

async function bootstrap() {
  await loadSongs();

  const { data: { session } } = await supabase.auth.getSession();
  CURRENT_USER = session?.user || null;

  // Keep UI in sync after OAuth redirect / refresh
  supabase.auth.onAuthStateChange(async (_event, session2) => {
    CURRENT_USER = session2?.user || null;
    CURRENT_SUBMISSION = null;
    DIRTY = false;
    await refreshUI();
  });

  await refreshUI();
}

bootstrap();
