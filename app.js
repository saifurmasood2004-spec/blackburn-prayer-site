const CSV_PATH="./blackburn_prayer_times.csv",TIMEZONE="Europe/London";
const PRAYERS=[{key:"fajr",name:"Fajr"},{key:"sunrise",name:"Sunrise"},{key:"dhuhr",name:"Dhuhr"},{key:"asr1",name:"Asr 1"},{key:"asr2",name:"Asr 2"},{key:"maghrib",name:"Maghrib"},{key:"isha",name:"Isha"}];

const els={datePill:datePill,timesBody:timesBody,statusText:statusText,mkAfter:mkAfter,mkBefore:mkBefore,themeToggle:themeToggle,themeIcon:themeIcon};

const iso=d=>new Intl.DateTimeFormat("en-CA",{timeZone:TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const nowMin=()=>{let p=new Intl.DateTimeFormat("en-GB",{timeZone:TIMEZONE,hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());return Number(p[0].value)*60+Number(p[2].value)};
const parse=t=>t.trim().split("\n").slice(1).map(r=>Object.fromEntries(r.split(",").map((c,i)=>[t.split("\n")[0].split(",")[i],c])));
const mins=t=>t?t.split(":").reduce((a,v)=>a*60+ +v,0):null;

function init(){
 fetch(CSV_PATH).then(r=>r.text()).then(t=>{
  const rows=parse(t),map=new Map(rows.map(r=>[r.date,r]));
  const today=iso(new Date()),tomorrow=iso(new Date(Date.now()+86400000));
  const now=nowMin(),todayRow=map.get(today),tomorrowRow=map.get(tomorrow);

  PRAYERS.forEach(p=>{
   const m=mins(todayRow[p.key]);
   const tr=document.createElement("tr");
   if(m<=now&&(!PRAYERS[PRAYERS.indexOf(p)+1]||mins(todayRow[PRAYERS[PRAYERS.indexOf(p)+1].key])>now))tr.classList.add("is-current");

   let label=p.name;
   if(p.key==="dhuhr"&&new Date(tomorrow).getDay()==5&&m<now)label="Jumu’ah";

   tr.innerHTML=`<td>${label}</td><td class="right">${m<now?tomorrowRow[p.key]:todayRow[p.key]}</td>`;
   timesBody.appendChild(tr);
  });

  mkAfter.textContent=todayRow.makrooh_after_sunrise_mins+" mins after sunrise";
  mkBefore.textContent=todayRow.makrooh_before_maghrib_mins+" mins before Maghrib";
  datePill.textContent=new Date().toDateString();
  statusText.textContent="Updated Automatically Daily";
  document.documentElement.dataset.theme=localStorage.bpt_theme||"light";
 });
}

themeToggle.onclick=()=>{let t=document.documentElement.dataset.theme=="dark"?"light":"dark";document.documentElement.dataset.theme=t;localStorage.bpt_theme=t};

init();
document.getElementById("copyrightYear").textContent=new Date().getFullYear();
