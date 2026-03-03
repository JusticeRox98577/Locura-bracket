import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.querySelector("#app");

function render(html){
  root.innerHTML = html;
}

/* =========================
   AUTH
========================= */

async function getUser(){
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function signIn(){
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options:{
      redirectTo: window.location.origin
    }
  });
}

/* =========================
   DATA LOADERS
========================= */

async function loadSubmission(user){
  const { data } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

async function loadClasses(){
  const { data } = await supabase
    .from("classes")
    .select("*")
    .order("teacher_name");

  return data || [];
}

/* =========================
   SONG DATA
========================= */

const SONGS = {
  TQMQA:["TQMQA","Eladio Carrión"],
  AKAKAW:["Akakaw","Renata Flores"],
  ANGEL:["Ángel","Grupo Frontera & Romeo Santos"],
  TOCANDO:["Tocando el Cielo","Luis Fonsi"],
  REGALO:["Regalo","Alvaro Soler"],
  SISABES:["Si Sabes Contar","Los Ángeles Azules, Luck Ra, Yami Safdie"],
  AMULETO:["Amuleto","Diego Torres"],
  NARCISISTA:["Narcisista","The Warning"],
  COLEC:["Coleccionando Heridas","Karol G & Antonis Solís"],
  PARAQUE:["¿Para Qué?","Ela Taubert"],
  MUJER:["La Mujer que Soy","Fanny Lu"],
  BUENCAFE:["Buen Café","Efecto Pasillo"],
  GOODBYE:["Goodbye","Arthur Hanlon, Carlos Vives, Goyo"],
  FEB6:["6 de Febrero","Aitana"],
  LUNALLENA:["Luna Llena","Ebenezer Guerra & Elvis Crespo"],
  VUELA:["Vuela","Luck Ra & Ke Personaje"],
  BZRP:["Music Sessions #66","Daddy Yankee & BZRP"]
};

/* =========================
   BRACKET STRUCTURE
========================= */

const BRACKET = [

  { title:"Play-In Round", matches:[
    { id:"L-R0", a:"TQMQA", b:"AKAKAW" }
  ]},

  { title:"Round 1 – Left", matches:[
    { id:"L-R1-1", a:"ANGEL", b:{from:"L-R0"} },
    { id:"L-R1-2", a:"TOCANDO", b:"REGALO" },
    { id:"L-R1-3", a:"SISABES", b:"AMULETO" },
    { id:"L-R1-4", a:"NARCISISTA", b:"COLEC" }
  ]},

  { title:"Round 1 – Right", matches:[
    { id:"R-R1-1", a:"PARAQUE", b:"MUJER" },
    { id:"R-R1-2", a:"BUENCAFE", b:"GOODBYE" },
    { id:"R-R1-3", a:"FEB6", b:"LUNALLENA" },
    { id:"R-R1-4", a:"VUELA", b:"BZRP" }
  ]},

  { title:"Quarterfinals – Left", matches:[
    { id:"L-QF-1", a:{from:"L-R1-1"}, b:{from:"L-R1-2"} },
    { id:"L-QF-2", a:{from:"L-R1-3"}, b:{from:"L-R1-4"} }
  ]},

  { title:"Quarterfinals – Right", matches:[
    { id:"R-QF-1", a:{from:"R-R1-1"}, b:{from:"R-R1-2"} },
    { id:"R-QF-2", a:{from:"R-R1-3"}, b:{from:"R-R1-4"} }
  ]},

  { title:"Semifinals", matches:[
    { id:"L-SF", a:{from:"L-QF-1"}, b:{from:"L-QF-2"} },
    { id:"R-SF", a:{from:"R-QF-1"}, b:{from:"R-QF-2"} }
  ]},

  { title:"Championship Final", matches:[
    { id:"FINAL", a:{from:"L-SF"}, b:{from:"R-SF"} }
  ]}
];

/* =========================
   BRACKET ENGINE
========================= */

function resolveSlot(slot, picks){
  if(typeof slot === "string") return slot;
  if(slot.from){
    const prevWinner = picks[slot.from];
    if(!prevWinner) return null;
    const prevMatch = BRACKET.flatMap(r=>r.matches).find(m=>m.id===slot.from);
    return prevWinner === "A" ? resolveSlot(prevMatch.a,picks)
                              : resolveSlot(prevMatch.b,picks);
  }
  return null;
}

function songLabel(key){
  if(!key) return "Waiting…";
  const s = SONGS[key];
  return `<strong>${s[0]}</strong><br><small>${s[1]}</small>`;
}

/* =========================
   RENDER BRACKET
========================= */

function renderBracket(user, submission){

  const picks = submission?.picks || {};
  const locked = submission?.locked;

  let html = `
    <div class="container">
      <h1>Your Bracket</h1>
      ${locked ? `<p><strong>Bracket Locked</strong></p>` : ""}
  `;

  BRACKET.forEach(round=>{
    html += `<div class="section-title">${round.title}</div>`;

    round.matches.forEach(match=>{
      const aKey = resolveSlot(match.a,picks);
      const bKey = resolveSlot(match.b,picks);

      html+=`
        <div class="card">
          <div class="option ${picks[match.id]==="A"?"selected":""}"
               data-id="${match.id}" data-slot="A">
               ${songLabel(aKey)}
          </div>
          <div class="option ${picks[match.id]==="B"?"selected":""}"
               data-id="${match.id}" data-slot="B">
               ${songLabel(bKey)}
          </div>
        </div>
      `;
    });
  });

  if(!locked){
    html+=`
      <button id="save" class="primary">Save</button>
      <button id="lock" class="danger">Submit & Lock</button>
    `;
  }

  html+=`</div>`;
  render(html);

  if(!locked){
    document.querySelectorAll(".option").forEach(btn=>{
      btn.onclick=()=>{
        picks[btn.dataset.id]=btn.dataset.slot;
        renderBracket(user,{...submission,picks});
      };
    });

    document.querySelector("#save").onclick=()=>save(user,submission,picks,false);
    document.querySelector("#lock").onclick=()=>save(user,submission,picks,true);
  }
}

/* =========================
   SAVE (UPSERT)
========================= */

async function save(user,submission,picks,lock){

  await supabase.from("submissions").upsert({
    user_id:user.id,
    nombre:submission?.nombre || "",
    clase:submission?.clase || "",
    class_id:submission?.class_id || null,
    picks,
    locked:lock
  },{ onConflict:"user_id" });

  location.reload();
}

/* =========================
   INIT
========================= */

async function init(){

  const user = await getUser();
  if(!user){
    render(`<button class="primary" id="login">Sign in with Google</button>`);
    document.querySelector("#login").onclick = signIn;
    return;
  }

  let submission = await loadSubmission(user);
  const classes = await loadClasses();

  if(!submission?.class_id){
    render(`
      <div class="container">
        <h1>Select Your Class</h1>
        <select id="class" class="input">
          <option value="">Choose class</option>
          ${classes.map(c=>`
            <option value="${c.id}">
              ${c.teacher_name} – ${c.class_level} – Period ${c.period}
            </option>
          `).join("")}
        </select>
        <button id="join" class="primary">Join</button>
      </div>
    `);

    document.querySelector("#join").onclick = async ()=>{
      const classId=document.querySelector("#class").value;
      if(!classId) return alert("Select a class.");

      await supabase.from("submissions").upsert({
        user_id:user.id,
        class_id:classId,
        picks:{},
        locked:false
      },{ onConflict:"user_id" });

      location.reload();
    };

    return;
  }

  renderBracket(user,submission);
}

init();
