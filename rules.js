/* rules.js v8 — Final confirmed severities */
const VALID_TYPES=new Set(['fam','e-learning','roadshow','events / workshops','webinars','new jmp','b2b pr fam trip','exhibitions','stakeholder engagement','mall activation','existing jmp','b2b comms','expenses','mission & travel','gsa retainer fee','corporate activation','newsletter','cruise jmp','b2c conversion','content partnership','manpower','projects','admin','mega fam','marketplace','travel trade partnership','co-host industry event','stand build','space rent','hospitality','experience abu dhabi workshop','destination sponsorship','others','fam trip','mega fam trip','showcase','consultant','sales calls','partners appreciation event','corporate policies','pr mgmt retainer','event participation']);
const TRADE_PROMO_TYPES=new Set(['Trade Promotion','Trade Promotions','trade promotion','FAM','FAM Trip','Mega FAM','Mega FAM Trip','GCC Fam-Trip','B2B PR FAM Trip','Roadshow','Events / WorkShops','Events / Workshops','Co-Host Industry Event','Co-Host Industry event','Travel Trade Partnership','Experience Abu Dhabi Workshop','Stakeholder Engagement','Partners Appreciation Event']);
const RULE_META={'0.1':{name:'Activity type not in predefined list',severity:'HIGH',cat:'Data Quality'},'1.1':{name:'Budget increased >10% vs 2026 baseline',severity:'MEDIUM',cat:'Budget'},'1.2':{name:'Nov + Dec > 20% of annual cashflow',severity:'MEDIUM',cat:'Cashflow'},'1.4':{name:'New JMP cashflow in signing year',severity:'MEDIUM',cat:'JMP'},'1.5':{name:'Webinar has non-zero budget',severity:'LOW',cat:'Activity'},'1.6':{name:'Admin Miscellaneous line present',severity:'LOW',cat:'Data Quality'},'1.7':{name:'Locked Existing JMP cashflow = 0',severity:'HIGH',cat:'JMP'},'2.2':{name:'JMP contract closes in Q4',severity:'MEDIUM',cat:'JMP'},'2.6':{name:'JMP missing Hotel Guest target',severity:'HIGH',cat:'JMP'},'3.1':{name:'Activity type is "Others"',severity:'MEDIUM',cat:'Data Quality'},'3.2':{name:'Duplicate: same name AND same type',severity:'LOW',cat:'Data Quality'},'3.3':{name:'Training/Workshop spans >1 month',severity:'LOW',cat:'Activity'},'3.6':{name:'Webinar at Priority 1',severity:'LOW',cat:'Activity'},'3.8':{name:'Activity missing KPIs',severity:'MEDIUM',cat:'KPI'},'4.1':{name:'Mega FAM target < 50 participants',severity:'MEDIUM',cat:'Activity'},'4.3':{name:'FAM trip outside Ramadan/Early Summer',severity:'LOW',cat:'Activity'},'5.1':{name:'< 2 zero-budget Ramadan activities',severity:'HIGH',cat:'Planning'},'6.1':{name:'2 sales missions in same quarter',severity:'MEDIUM',cat:'Activity'},'6.3':{name:'Exhibition with no revenue KPI',severity:'MEDIUM',cat:'KPI'},'8.4':{name:'New non-JMP activity >500K — no 2026 ref',severity:'MEDIUM',cat:'Budget'},'B.1':{name:'Cost efficiency outlier (>15% above median)',severity:'MEDIUM',cat:'Benchmark'}};
const RAM_S=new Date(2027,0,1),RAM_E=new Date(2027,1,15);
const THRESH={INC_PCT:10,INC_AED:50000,NOVDEC_PCT:20,NEW_CF:500000,OUTLIER_PCT:15};
const REGIONS={'Europe & CIS':['France','Germany','Italy','Spain','Poland','Romania','Belgium','Netherlands','Russia','Armenia','Kazakhstan','Uzbekistan'],'APAC':['India','China','Japan','Korea','South Korea'],'GCC':['KSA','Saudi Arabia','Kuwait','Egypt','Domestic','UAE','Bahrain','Qatar','Oman'],'UK & US':['UK','United Kingdom','USA','United States','Canada'],'PR':['PR','PR & Marketing','B2B PR and Marketing'],'Global':['Global Partnerships','Exhibitions','IO Office','Global','International']};
function getRegion(m){if(!m)return'Other';const ml=m.toLowerCase();for(const[r,ms]of Object.entries(REGIONS)){if(ms.some(x=>ml.includes(x.toLowerCase())||x.toLowerCase().includes(ml)))return r;}return'Other';}

// Tier comes from these fixed lists. Anything not named here is "Others" — there is no Tier 3.
// Tier is a property of the Market, not of an individual activity.
const TIER1_MARKETS=['China','France','Germany','India','Italy','Kuwait','Russia','Saudi Arabia','UAE','United Kingdom','United States'];
const TIER2_MARKETS=['Armenia','Bahrain','Belgium','Canada','Egypt','Japan','Kazakhstan','Netherlands','Oman','Poland','Qatar','Romania','South Korea','Spain','Uzbekistan'];
function getTier(m){if(!m)return 3;const ml=m.toLowerCase();if(TIER1_MARKETS.some(x=>ml.includes(x.toLowerCase())||x.toLowerCase().includes(ml)))return 1;if(TIER2_MARKETS.some(x=>ml.includes(x.toLowerCase())||x.toLowerCase().includes(ml)))return 2;return 3;}
// Display label — the catch-all bucket reads "Others", never "Tier 3".
function getTierLabel(m){const t=getTier(m);return t===1?'Tier 1':t===2?'Tier 2':'Others';}
function getQuarter(d){if(!d)return null;const m=d.getMonth();return m<3?'Q1':m<6?'Q2':m<9?'Q3':'Q4';}
function V(ruleId,a,detail){const meta=RULE_META[ruleId]||{name:ruleId,severity:'LOW',cat:'Other'};return{ruleId,ruleName:meta.name,severity:meta.severity,category:meta.cat,market:a?.market||'—',region:getRegion(a?.market||''),tier:getTier(a?.market||''),activityId:a?.id||'—',activityName:a?.activityName||'—',activityType:a?.activityType||'—',startDate:a?.startDate||null,endDate:a?.endDate||null,priority:a?.priority||null,detail,status:'pending',comment:''};}
function Vm(ruleId,market,label,detail){const meta=RULE_META[ruleId]||{name:ruleId,severity:'LOW',cat:'Other'};return{ruleId,ruleName:meta.name,severity:meta.severity,category:meta.cat,market,region:getRegion(market),tier:getTier(market),activityId:'Market-level',activityName:label,activityType:'—',startDate:null,endDate:null,priority:null,detail,status:'pending',comment:''};}
// Violation Identity (see GLOSSARY.md): what makes two violations "the same" across sessions.
function violationKey(v){return `${v.ruleId}||${v.market}||${v.activityId}||${(v.activityName||'').toLowerCase().trim()}`;}

// ── Activity Signature: cross-year matching (see ADR-0003) ───────────────────────────
// Activity Names embed the year ("WTM 2027 - Hospitality", "TUI DACH JMP 2026-2027"), so an
// exact-name match wrongly reports every recurring activity as brand new. Instead we run four
// increasingly permissive passes and stop at the first confident match. Passes run globally in
// tier order (not per-activity), so a stronger match always wins over a weaker one regardless
// of row order.
//
// Fence: candidates must share Market + Activity Type Family. JMP types collapse into one
// family because New JMP → Existing JMP is the normal lifecycle (136 of 145 JMPs change type
// between years), so a strict type fence would break JMP matching entirely.
function typeFamily(t){
  const s=(t||'').trim().toLowerCase();
  if(/jmp|existing\s*mp/.test(s))return 'jmp';
  return s;
}
function stripYearTokens(name){return(name||'').replace(/\b\d{2,4}\s*[-\/–—]\s*\d{2,4}\b/g,'').replace(/\b(19|20)\d{2}\b/g,'').replace(/\b\d{2}\/\d{2}\b/g,'');}
function nameCore(name){
  return stripYearTokens(name).toLowerCase().replace(/[^a-z0-9&]+/g,' ').replace(/\s+/g,' ').trim();
}
// Identifying prefix — everything before the first year token, which is where the event or
// partner name sits ("itb berlin", "itb china", "wtm", "iltm"). Taking only the first word would
// collapse "ITB Berlin" and "ITB China" onto the same anchor and risk cross-matching two
// unrelated exhibitions. With no year token present, fall back to the first two words so the
// anchor stays specific enough to be meaningful.
function anchorToken(name){
  const raw=(name||'').toString();
  const yr=raw.match(/\b((?:19|20)\d{2}|\d{2})\b(?!\d)/);
  const head=yr?raw.slice(0,yr.index):raw;
  const toks=head.toLowerCase().replace(/[^a-z0-9&]+/g,' ').trim().split(/\s+/).filter(Boolean);
  if(!toks.length)return'';
  return yr?toks.join(' '):toks.slice(0,2).join(' ');
}
function fenceKey(a){return `${a.market}||${typeFamily(a.activityType)}`;}

// First year mentioned in a name, normalised to 4 digits ("JMP 26-27" → 2026). null when the
// name carries no year at all.
function primaryYear(name){
  const m=(name||'').match(/\b((?:19|20)\d{2}|\d{2})\b(?!\d)/);
  if(!m)return null;
  const n=parseInt(m[1],10);
  if(n>=1900)return n;
  if(n>=20&&n<=99)return 2000+n;   // two-digit shorthand
  return null;
}
// Names that both carry a year may only be paired when those years are the same or consecutive.
// Without this, a serially-named activity can pair across a skipped term — e.g.
// "TUI DACH JMP 2025-2026" (ended) wrongly matching "TUI DACH JMP 2027-2028" (genuinely new).
function yearsAdjacent(prior,cur){
  const yp=primaryYear(prior),yc=primaryYear(cur);
  if(yp===null||yc===null)return true;   // nothing to compare — leave it to the other guards
  return Math.abs(yc-yp)<=1;
}

function buildMatchIndex(activities){
  const byJmpId={},byFence={},byMarket={};
  activities.forEach(a=>{
    const jid=a.jmpId?String(a.jmpId).trim():'';
    if(jid)byJmpId[jid]=a;
    (byFence[fenceKey(a)]=byFence[fenceKey(a)]||[]).push(a);
    (byMarket[a.market]=byMarket[a.market]||[]).push(a);
  });
  return{byJmpId,byFence,byMarket};
}

const MATCH_TIERS=[
  // Tier 1 — exact name, within fence. Safest; most activities match here.
  {label:'Exact name',unique:false,cand:(a,idx,used)=>{
    const n=(a.activityName||'').toLowerCase().trim();
    if(!n)return[];
    return fencePool(a,idx,used).filter(p=>(p.activityName||'').toLowerCase().trim()===n);
  }},
  // Tier 2 — JMP-ID. Deliberately NOT fenced: the ID is definitive, and it is what carries the
  // New JMP → Existing JMP transition and genuine reclassifications.
  {label:'JMP-ID',unique:false,cand:(a,idx,used)=>{
    const jid=a.jmpId?String(a.jmpId).trim():'';
    if(!jid)return[];
    const m=idx.byJmpId[jid];
    return(m&&!used.has(m))?[m]:[];
  }},
  // Tier 2b — identical name in the same Market but a different Activity Type: a genuine
  // reclassification (e.g. "Miles Attack Trade Campaign" Events/WorkShops → Travel Trade
  // Partnership). An exact full-name match inside one market is strong enough to cross the type
  // fence; compareYears then reports the Type change instead of hiding it as removed + new.
  {label:'Exact name (retyped)',unique:true,cand:(a,idx,used)=>{
    const n=(a.activityName||'').toLowerCase().trim();
    if(!n)return[];
    return marketPool(a,idx,used).filter(p=>(p.activityName||'').toLowerCase().trim()===n);
  }},
  // Tier 3 — year-stripped name, within fence, years must be same or consecutive.
  {label:'Name (year-stripped)',unique:true,cand:(a,idx,used)=>{
    const c=nameCore(a.activityName);
    if(!c)return[];
    return fencePool(a,idx,used).filter(p=>nameCore(p.activityName)===c&&yearsAdjacent(p.activityName,a.activityName));
  }},
  // Tier 4 — unique anchor token, within fence. Handles reworded lines
  // ("WTM Stand Build" → "WTM Stand Build Up Payment") but declines whenever ambiguous.
  {label:'Anchor token',unique:true,cand:(a,idx,used)=>{
    const t=anchorToken(a.activityName);
    if(!t||t.length<2)return[];
    return fencePool(a,idx,used).filter(p=>anchorToken(p.activityName)===t&&yearsAdjacent(p.activityName,a.activityName));
  }},
];
function fencePool(a,idx,used){return(idx.byFence[fenceKey(a)]||[]).filter(p=>!used.has(p));}
function marketPool(a,idx,used){return(idx.byMarket[a.market]||[]).filter(p=>!used.has(p));}

// Returns { matchOf: Map(a27 -> {prior, tier}), matchedPrior: Set(a26) }
function buildYearMatch(A26,A27){
  const idx=buildMatchIndex(A26||[]);
  const used=new Set(),matchOf=new Map();
  MATCH_TIERS.forEach(tier=>{
    (A27||[]).forEach(a=>{
      if(matchOf.has(a))return;
      const c=tier.cand(a,idx,used);
      const pick=tier.unique?(c.length===1?c[0]:null):c[0];
      if(pick){matchOf.set(a,{prior:pick,tier:tier.label});used.add(pick);}
    });
  });
  return{matchOf,matchedPrior:used};
}
function priorOf(ym,a){return ym.matchOf.get(a)?.prior;}
function isJMP(a){return /jmp|existing\s*mp/i.test(a.activityType||'');}
function isNewJMP(a){return /new\s+jmp/i.test(a.activityType||'');}
function isExistJMP(a){return /exist\w*\s*(jmp|mp)/i.test(a.activityType||'');}
function isMission(a){return /mis+ion/i.test((a.activityType||'')+' '+(a.activityName||''));}
function isGSA(a){return /gsa/i.test(a.activityType||'');}
function isWebinar(a){return /webinar/i.test(a.activityType||'');}
function isFAM(a){return /\bfam\b/i.test((a.activityType||'')+' '+(a.activityName||''));}
function isMegaFAM(a){return /mega.?fam/i.test((a.activityType||'')+' '+(a.activityName||''));}
function isExhibition(a){return /^(exhibitions?|stand.?build|space.?rent|hospitality)$/i.test(a.activityType||'')||/exhibition|exhibit|\bitb\b|\bwtm\b|\batm\b/i.test((a.activityType||'')+' '+(a.activityName||''));}
function isWebinarA(a){return /webinar/i.test(a.activityType||'');}
// Retainers (GSA, PR Mgmt) carry no KPI by design — they are fixed agency/agent fees.
function isRetainer(a){return isGSA(a)||/retainer/i.test(a.activityType||'');}
function isKPIExempt(a){return isJMP(a)||isMission(a)||isRetainer(a)||/^(manpower|admin|projects|expenses|stand.?build|hospitality)$/i.test(a.activityType||'');}
function inRam(d){return d&&d>=RAM_S&&d<=RAM_E;}
function exhPrefix(a){return(a.activityName||'').replace(/\s*[-:]\s*(space.?rent|stand.?build|hospitality|venue|design.?build).*/i,'').trim().toLowerCase();}
function med(arr){if(!arr.length)return 0;const s=[...arr].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function mSum(mo,months){return months.reduce((s,m)=>s+(mo[m]||0),0);}

function runRules(baseline26,review27,yearMatch){
  const violations=[],A27=review27.activities||[],A26=baseline26.activities||[];
  const ym=yearMatch||buildYearMatch(A26,A27);
  // 0.1
  A27.forEach(a=>{const t=(a.activityType||'').trim();if(!t||t==='—')return;if(!VALID_TYPES.has(t.toLowerCase()))violations.push(V('0.1',a,`"${t}" is not in the predefined activity type list.`));});
  // 1.1
  A27.forEach(a=>{const m=priorOf(ym,a);const prev=m?m.cashflow:0;if(prev>0&&a.cashflow>prev){const pct=((a.cashflow-prev)/prev)*100,abs=a.cashflow-prev;if(pct>THRESH.INC_PCT&&abs>THRESH.INC_AED)violations.push(V('1.1',a,`${fmtAED(prev)} (2026) → ${fmtAED(a.cashflow)} (2027). +${fmtAED(abs)} (+${pct.toFixed(1)}%)`));}});
  // 1.2 Nov+Dec >20%
  const mktCF={};A27.forEach(a=>{if(!mktCF[a.market])mktCF[a.market]=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});MONTH_LABELS.forEach(m=>{mktCF[a.market][m]+=a.monthly[m]||0;});});
  Object.entries(mktCF).forEach(([mkt,mo])=>{const tot=MONTH_LABELS.reduce((s,m)=>s+mo[m],0);if(tot<50000)return;const nd=mSum(mo,['Nov','Dec']);if((nd/tot)*100>THRESH.NOVDEC_PCT)violations.push(Vm('1.2',mkt,'Nov-Dec Cashflow',`Nov+Dec=${fmtAED(nd)} (${((nd/tot)*100).toFixed(1)}% of annual). Threshold >${THRESH.NOVDEC_PCT}%.`));});
  // 1.4
  A27.filter(isNewJMP).forEach(a=>{if(a.cashflow<=0)return;const cross=a.endDate&&a.endDate.getFullYear()>2027;violations.push(V('1.4',a,cross?`Cross-year JMP (ends ${fmtDate(a.endDate)}): ${fmtAED(a.cashflow)} in 2027. Confirm partial only.`:`Ends ${fmtDate(a.endDate)}: ${fmtAED(a.cashflow)} in signing year.`));});
  // 1.5
  A27.filter(isWebinar).forEach(a=>{if(a.cashflow>0)violations.push(V('1.5',a,`Webinar has ${fmtAED(a.cashflow)}. Must be zero-cost.`));});
  // 1.6
  A27.forEach(a=>{if(/admin.misc|miscellaneous/i.test(`${a.activityName||''} ${a.activityType||''}`))violations.push(V('1.6',a,'Admin Miscellaneous must be removed.'));});
  // 1.7 (bypassed for Domestic market)
  A27.filter(isExistJMP).filter(a=>a.market!=='Domestic').forEach(a=>{if(a.cashflow===0&&a.locked==='Locked')violations.push(V('1.7',a,'Locked Existing JMP cashflow=0. Contract value may be missing.'));});
  // 2.2
  A27.filter(isJMP).forEach(a=>{if(!a.endDate)return;if(a.endDate.getMonth()>=9)violations.push(V('2.2',a,`JMP ends ${fmtDate(a.endDate)} (Q4). Close by end of Q3.`));});
  // 2.6
  A27.filter(isJMP).forEach(a=>{if(!a.hotelGuests||a.hotelGuests===0)violations.push(V('2.6',a,'JMP has no Hotel Guest target. Required for all JMPs.'));});
  // 3.1
  A27.filter(a=>/^others$/i.test(a.activityType||'')).forEach(a=>violations.push(V('3.1',a,'Type is "Others". Must be reclassified.')));
  // 3.2 — same name+type is only a duplicate when the dates match too; different dates
  //       mean genuinely separate sessions (e.g. two Ramadan webinars a week apart).
  const seen={};A27.forEach(a=>{
    const ds=a.startDate?a.startDate.getTime():'—',de=a.endDate?a.endDate.getTime():'—';
    const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}||${(a.activityType||'').toLowerCase().trim()}||${ds}||${de}`;
    if(seen[k])violations.push(V('3.2',a,`Duplicate name, type and dates in ${a.market} (${fmtDate(a.startDate)} → ${fmtDate(a.endDate)}).`));
    seen[k]=true;
  });
  // 3.3
  const TRAIN_RE=/^(events \/ workshops|webinars|e-learning|experience abu dhabi workshop)$/i;
  A27.filter(a=>TRAIN_RE.test(a.activityType||'')||/training|workshop/i.test(a.activityName||'')).forEach(a=>{if(!a.startDate||!a.endDate)return;const days=(a.endDate-a.startDate)/864e5;if(days>31)violations.push(V('3.3',a,`Spans ${Math.round(days)} days (${fmtDate(a.startDate)}→${fmtDate(a.endDate)}). Split into individual sessions.`));});
  // 3.6
  A27.filter(isWebinar).forEach(a=>{if(a.priority===1)violations.push(V('3.6',a,'Webinar is Priority 1. Must be P2 or P3.'));});
  // 3.8
  const exhGroups={};A27.filter(isExhibition).forEach(a=>{const p=exhPrefix(a);if(!exhGroups[p])exhGroups[p]=[];exhGroups[p].push(a);});
  A27.forEach(a=>{if(isKPIExempt(a)||isWebinar(a)||/^others$/i.test(a.activityType||''))return;if(isExhibition(a)){const p=exhPrefix(a),grp=exhGroups[p]||[];if(grp.length>1&&!/^space.?rent$/i.test(a.activityType||'')&&grp[0].id!==a.id)return;}if(!a.revenue&&!a.attendees)violations.push(V('3.8',a,'No revenue and no attendee/KPI target. At least one KPI required.'));});
  // 4.1
  A27.filter(isMegaFAM).forEach(a=>{if(a.attendees<50)violations.push(V('4.1',a,`Mega FAM targets ${a.attendees||0} participants. Minimum 50.`));});
  // 4.3
  A27.filter(isFAM).filter(a=>!isMegaFAM(a)).forEach(a=>{if(a.startDate&&(a.startDate.getMonth()<1||a.startDate.getMonth()>5))violations.push(V('4.3',a,`FAM starts ${fmtDate(a.startDate)} — outside Feb-Jun window.`));});
  // 5.1
  const mkts27=[...new Set(A27.map(a=>a.market).filter(Boolean))];
  mkts27.forEach(mkt=>{const rz=A27.filter(a=>a.market===mkt&&(inRam(a.startDate)||inRam(a.endDate))&&a.cashflow===0);if(rz.length<2)violations.push(Vm('5.1',mkt,'Ramadan Planning',`Only ${rz.length} zero-budget Ramadan activit${rz.length===1?'y':'ies'}. Min 2 required.`));});
  // 6.1
  mkts27.forEach(mkt=>{const ms=A27.filter(a=>a.market===mkt&&isMission(a));if(ms.length<=1)return;const byQ={Q1:[],Q2:[],Q3:[],Q4:[]};ms.forEach(a=>{const q=a.startDate?getQuarter(a.startDate):null;if(q)byQ[q].push(a);});Object.entries(byQ).forEach(([q,qs])=>{if(qs.length>1)violations.push(Vm('6.1',mkt,`${qs.length} missions in ${q}`,`${qs.length} missions in ${q}. Max 1 per quarter.`));});});
  // 6.3
  A27.filter(isExhibition).forEach(a=>{const p=exhPrefix(a),grp=exhGroups[p]||[];if(grp.length>1&&!/^space.?rent$/i.test(a.activityType||'')&&grp[0].id!==a.id)return;if(!a.revenue)violations.push(V('6.3',a,'Exhibition has no revenue KPI.'));});
  // 8.4
  A27.forEach(a=>{if(isJMP(a)||isGSA(a)||isMission(a))return;if(!priorOf(ym,a)&&a.cashflow>THRESH.NEW_CF)violations.push(V('8.4',a,`New activity ${fmtAED(a.cashflow)} — no 2026 equivalent.`));});
  // B.1
  const typeGroups={};A27.filter(a=>!isJMP(a)).forEach(a=>{if(!typeGroups[a.activityType])typeGroups[a.activityType]={};if(!typeGroups[a.activityType][a.market])typeGroups[a.activityType][a.market]={cf:0,att:0,stak:0};typeGroups[a.activityType][a.market].cf+=a.cashflow;typeGroups[a.activityType][a.market].att+=a.attendees||0;typeGroups[a.activityType][a.market].stak+=a.stakeholders||0;});
  Object.entries(typeGroups).forEach(([type,byMkt])=>{const cpaE=Object.entries(byMkt).filter(([,d])=>d.att>0&&d.cf>0).map(([m,d])=>({m,v:d.cf/d.att}));if(cpaE.length>=3){const m=med(cpaE.map(x=>x.v));cpaE.filter(x=>x.v>m*(1+THRESH.OUTLIER_PCT/100)).forEach(({m:mkt,v})=>{violations.push(V('B.1',{market:mkt,id:'—',activityName:type,activityType:type},`Cost/attendee for ${type}: ${fmtAED(Math.round(v))} vs median ${fmtAED(Math.round(m))} (+${(((v/m)-1)*100).toFixed(0)}% above).`));});}const cpSE=Object.entries(byMkt).filter(([,d])=>d.stak>0&&d.cf>0).map(([m,d])=>({m,v:d.cf/d.stak}));if(cpSE.length>=3){const m=med(cpSE.map(x=>x.v));cpSE.filter(x=>x.v>m*(1+THRESH.OUTLIER_PCT/100)).forEach(({m:mkt,v})=>{violations.push(V('B.1',{market:mkt,id:'—',activityName:type,activityType:type},`Cost/stakeholder for ${type}: ${fmtAED(Math.round(v))} vs median ${fmtAED(Math.round(m))} (+${(((v/m)-1)*100).toFixed(0)}% above).`));});}});
  return violations;
}
function summarise(violations){const active=violations.filter(v=>v.status!=='accepted');const counts={HIGH:0,MEDIUM:0,LOW:0};active.forEach(v=>{counts[v.severity]=(counts[v.severity]||0)+1;});const byMarket={};active.forEach(v=>{byMarket[v.market]=(byMarket[v.market]||0)+1;});const topMarkets=Object.entries(byMarket).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([market,count])=>({market,count}));return{counts,topMarkets,total:active.length};}
function compareYears(b26,r27,yearMatch){
  const A26=b26.activities||[],A27=r27.activities||[];
  const ym=yearMatch||buildYearMatch(A26,A27);
  const added=[],changed=[];
  A27.forEach(a27=>{
    const a26=priorOf(ym,a27);
    if(!a26){added.push(a27);return;}
    const ch=[];
    if(Math.abs(a27.cashflow-a26.cashflow)>1000)ch.push({field:'Cashflow',from:a26.cashflow,to:a27.cashflow,diff:a27.cashflow-a26.cashflow});
    if(a27.priority!==a26.priority&&a27.priority&&a26.priority)ch.push({field:'Priority',from:a26.priority,to:a27.priority,diff:0});
    if(a27.activityType!==a26.activityType)ch.push({field:'Type',from:a26.activityType,to:a27.activityType,diff:0});
    if(a27.locked!==a26.locked)ch.push({field:'Lock',from:a26.locked,to:a27.locked,diff:0});
    if(ch.length)changed.push({a27,a26,changes:ch});
  });
  const removed=A26.filter(a=>!ym.matchedPrior.has(a));
  return{added,removed,changed};
}
