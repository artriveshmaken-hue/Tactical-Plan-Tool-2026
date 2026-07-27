/* app.js */
// Bump this together with every ?v= in index.html whenever the app files change, so reviewers
// can never be left on a cached older build after a deploy.
const APP_VERSION='2.2';

// Global filters are multi-select (arrays) and are the single source of truth for activity
// scoping across every view — see ADR-0004. An empty array means "no restriction".
const APP={baseline:null,review:null,violations:[],comparison:null,yearMatch:null,activeView:'overview',filters:{region:[],tier:[],market:[],type:[],priority:[]},allMarkets:[],allTypes:[]};
const $=id=>document.getElementById(id);
function setupUpload(){
  let bF=null,rF=null;
  function onFile(f,isBase){if(!f)return;if(isBase){bF=f;$('fname-baseline').textContent=f.name;$('ok-baseline').classList.remove('hidden');$('card-baseline').classList.add('loaded');}else{rF=f;$('fname-review').textContent=f.name;$('ok-review').classList.remove('hidden');$('card-review').classList.add('loaded');}$('btn-analyze').disabled=!(bF&&rF);}
  $('input-baseline').addEventListener('change',e=>onFile(e.target.files[0],true));
  $('input-review').addEventListener('change',e=>onFile(e.target.files[0],false));
  $('btn-analyze').addEventListener('click',async()=>{
    $('loading-overlay').classList.remove('hidden');$('loading-msg').textContent='Parsing 2026 baseline…';
    try{
      const[b,r]=await Promise.all([parseWorkbook(bF),parseWorkbook(rF)]);
      APP.baseline=b;APP.review=r;$('loading-msg').textContent='Running compliance rules…';await new Promise(x=>setTimeout(x,50));
      APP.yearMatch=buildYearMatch(b.activities||[],r.activities||[]);
      APP.violations=runRules(b,r,APP.yearMatch);applyStoredDecisions(APP.violations);APP.comparison=compareYears(b,r,APP.yearMatch);
      APP.filters={region:[],tier:[],market:[],type:[],priority:[]};
      populateFilters(r,b);setupFilters();updateFilterSummary();
      $('dash-sub').textContent=`${bF.name} (2026) vs ${rF.name} (2027) — ${r.activities.length} activities`;
      renderKPIs();updatePills();renderView('overview');
      $('upload-screen').classList.add('hidden');$('dashboard').classList.remove('hidden');
    }catch(e){console.error(e);alert('Error reading file:\n'+e.message+'\n\nBoth files must have a "Tactical Details" sheet.');}
    finally{$('loading-overlay').classList.add('hidden');}
  });
  $('btn-new-upload')?.addEventListener('click',()=>{$('dashboard').classList.add('hidden');$('upload-screen').classList.remove('hidden');APP.baseline=APP.review=APP.comparison=APP.yearMatch=null;APP.violations=[];APP.allMarkets=[];APP.allTypes=[];APP.filters={region:[],tier:[],market:[],type:[],priority:[]};destroyCharts();$('input-baseline').value=$('input-review').value='';$('btn-analyze').disabled=true;bF=rF=null;['baseline','review'].forEach(t=>{$(`fname-${t}`).textContent='No file selected';$(`ok-${t}`).classList.add('hidden');$(`card-${t}`).classList.remove('loaded');});});
}
const GLOBAL_FLT=[
  {key:'region',  id:'greg',  label:'Region'},
  {key:'tier',    id:'gtier', label:'Tier'},
  {key:'market',  id:'gmkt',  label:'Market'},
  {key:'type',    id:'gtype', label:'Activity Type'},
  {key:'priority',id:'gprio', label:'Priority'},
];
function populateFilters(review,baseline){
  // Build option lists from both years so a filter never hides one side of a comparison.
  const acts=[...(review.activities||[]),...(baseline?.activities||[])];
  APP.allMarkets=[...new Set(acts.map(a=>a.market).filter(Boolean))].sort();
  APP.allTypes=[...new Set(acts.map(a=>a.activityType).filter(Boolean))].sort();
  const regions=[...new Set(APP.allMarkets.map(m=>getRegion(m)))].sort();
  $('filter-bar').innerHTML=
    buildMS('greg','Region',regions)+
    buildMS('gtier','Tier',[{value:'1',label:'Tier 1 — Priority'},{value:'2',label:'Tier 2 — Growth'},{value:'3',label:'Others'}])+
    buildMS('gmkt','Market',APP.allMarkets.map(m=>({value:m,label:`${m} (T${getTier(m)})`})))+
    buildMS('gtype','Activity Type',APP.allTypes)+
    buildMS('gprio','Priority',[{value:'1',label:'P1 — Committed'},{value:'2',label:'P2 — High'},{value:'3',label:'P3 — Low'}])+
    `<button class="btn-ghost btn-sm" id="btn-reset-flt">Reset all</button>`+
    `<span id="flt-summary" class="flt-summary"></span>`;
}
// Shared predicate: an activity OR a violation passes when it matches every active filter.
// Market-level violations have no priority, so the priority filter does not exclude them.
function passesGlobal(x){
  const f=APP.filters,mkt=x.market;
  if(f.region.length  &&!f.region.includes(getRegion(mkt)))return false;
  if(f.tier.length    &&!f.tier.includes(String(getTier(mkt))))return false;
  if(f.market.length  &&!f.market.includes(mkt))return false;
  if(f.type.length    &&!f.type.includes(x.activityType))return false;
  if(f.priority.length&&x.priority!=null&&!f.priority.includes(String(x.priority)))return false;
  return true;
}
function applyGlobalFilters(acts){return(acts||[]).filter(passesGlobal);}
function anyFilterActive(){return GLOBAL_FLT.some(f=>APP.filters[f.key].length>0);}
function updateFilterSummary(){
  const el=$('flt-summary');if(!el)return;
  const parts=GLOBAL_FLT.filter(f=>APP.filters[f.key].length).map(f=>`${f.label}: ${APP.filters[f.key].length}`);
  el.textContent=parts.length?`Filtered — ${parts.join(' · ')}`:'';
  el.classList.toggle('active',parts.length>0);
}
function refreshAfterFilterChange(){updateFilterSummary();renderKPIs();updatePills();destroyCharts();renderView(APP.activeView);}
function setupFilters(){
  GLOBAL_FLT.forEach(f=>{
    document.querySelector(`#ms-${f.id} .ms-panel`)?.addEventListener('change',()=>{
      APP.filters[f.key]=getMSVals(`ms-${f.id}`);
      updateMSBtn(`ms-${f.id}`,f.label);
      refreshAfterFilterChange();
    });
  });
  $('btn-reset-flt')?.addEventListener('click',()=>{
    GLOBAL_FLT.forEach(f=>{APP.filters[f.key]=[];clearMS(`ms-${f.id}`,f.label);});
    refreshAfterFilterChange();
  });
}
function setupNav(){document.querySelectorAll('.nav-tab').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');APP.activeView=btn.dataset.view;destroyCharts();renderView(APP.activeView);});});}
// Both years and the violation list go through the same global filter, so YoY comparisons stay
// apples-to-apples and every view agrees on what is in scope (F1/F2/F3 — see ADR-0004).
function buildState(){
  return{
    baseline:APP.baseline,review:APP.review,comparison:APP.comparison,yearMatch:APP.yearMatch,filters:APP.filters,
    acts:applyGlobalFilters(APP.review.activities||[]),
    acts26:applyGlobalFilters(APP.baseline.activities||[]),
    violations:APP.violations.filter(passesGlobal),
  };
}
function renderView(id){
  const state=buildState();
  switch(id){case 'overview':renderOverview(state);break;case 'portfolio':renderPortfolio(state);break;case 'market':renderMarket(state);break;case 'calendar':renderCalendar(state);break;case 'violations':renderViolations(state);break;case 'rules':renderRulesRef(state);break;default:renderOverview(state);}
}
function renderKPIs(){
  const a27=applyGlobalFilters(APP.review.activities||[]),a26=applyGlobalFilters(APP.baseline.activities||[]);
  const viols=APP.violations.filter(passesGlobal);
  const sum=summarise(viols);
  const added=APP.comparison.added.filter(passesGlobal);
  const t27=a27.reduce((s,a)=>s+a.cashflow,0),t26=a26.reduce((s,a)=>s+a.cashflow,0);
  const jmpCF=a27.filter(a=>isJMP(a)).reduce((s,a)=>s+a.cashflow,0);
  const jmpPct=t27?(jmpCF/t27*100).toFixed(0):0;
  $('kpi-strip').innerHTML=`<div class="kpi-card kpi-info"><div class="kpi-label">2027 Cashflow</div><div class="kpi-value">${fmtShort(t27)}</div><div class="kpi-sub">AED total</div></div><div class="kpi-card ${t27>t26?'kpi-danger':'kpi-success'}"><div class="kpi-label">vs 2026</div><div class="kpi-value ${t27>t26?'t-red':'t-green'}">${t27>=t26?'+':''}${fmtShort(t27-t26)}</div><div class="kpi-sub">${t26?((t27-t26)/t26*100).toFixed(1)+'%':''}</div></div><div class="kpi-card"><div class="kpi-label">Activities</div><div class="kpi-value">${a27.length}</div><div class="kpi-sub">vs ${a26.length} in 2026</div></div><div class="kpi-card"><div class="kpi-label">JMP Share</div><div class="kpi-value">${jmpPct}%</div><div class="kpi-sub">of total budget</div></div><div class="kpi-card kpi-success"><div class="kpi-label">New</div><div class="kpi-value t-green">${added.length}</div><div class="kpi-sub">activities in 2027</div></div><div class="kpi-card ${sum.total>0?'kpi-danger':'kpi-success'}"><div class="kpi-label">Violations</div><div class="kpi-value ${sum.total>0?'t-red':''}">${sum.total}</div><div class="kpi-sub">${sum.counts.HIGH} HIGH · ${sum.counts.MEDIUM} MED</div></div>`;
}
function updatePills(){const s=summarise(APP.violations.filter(passesGlobal));$('sev-pills').innerHTML=`<div class="sev-pill high">${s.counts.HIGH} HIGH</div><div class="sev-pill medium">${s.counts.MEDIUM} MED</div><div class="sev-pill low">${s.counts.LOW} LOW</div>`;$('nav-viol-count').textContent=s.total;}
function jumpToMarket(mkt){APP.activeView='market';document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));document.querySelector('[data-view="market"]')?.classList.add('active');destroyCharts();renderMarket(buildState(),mkt);}
document.addEventListener('DOMContentLoaded',()=>{
  const v=$('app-version');if(v)v.textContent=APP_VERSION;
  setupUpload();setupNav();
});
