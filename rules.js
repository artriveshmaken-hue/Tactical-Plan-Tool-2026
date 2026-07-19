/* rules.js v8 — Final confirmed severities */
const VALID_TYPES=new Set(['fam','e-learning','roadshow','events / workshops','webinars','new jmp','b2b pr fam trip','exhibitions','stakeholder engagement','mall activation','existing jmp','b2b comms','expenses','mission & travel','gsa retainer fee','corporate activation','newsletter','cruise jmp','b2c conversion','content partnership','manpower','projects','admin','mega fam','marketplace','travel trade partnership','co-host industry event','stand build','space rent','hospitality','experience abu dhabi workshop','destination sponsorship','others','fam trip','mega fam trip','showcase','consultant','sales calls','partners appreciation event','corporate policies']);
const TRADE_PROMO_TYPES=new Set(['Trade Promotion','Trade Promotions','trade promotion','FAM','FAM Trip','Mega FAM','Mega FAM Trip','GCC Fam-Trip','B2B PR FAM Trip','Roadshow','Events / WorkShops','Events / Workshops','Co-Host Industry Event','Co-Host Industry event','Travel Trade Partnership','Experience Abu Dhabi Workshop','Stakeholder Engagement','Partners Appreciation Event']);
const RULE_META={'0.1':{name:'Activity type not in predefined list',severity:'HIGH',cat:'Data Quality'},'1.1':{name:'Budget increased >10% vs 2026 baseline',severity:'MEDIUM',cat:'Budget'},'1.2':{name:'Nov + Dec > 20% of annual cashflow',severity:'MEDIUM',cat:'Cashflow'},'1.4':{name:'New JMP cashflow in signing year',severity:'MEDIUM',cat:'JMP'},'1.5':{name:'Webinar has non-zero budget',severity:'LOW',cat:'Activity'},'1.6':{name:'Admin Miscellaneous line present',severity:'LOW',cat:'Data Quality'},'1.7':{name:'Locked Existing JMP cashflow = 0',severity:'HIGH',cat:'JMP'},'2.2':{name:'JMP contract closes in Q4',severity:'MEDIUM',cat:'JMP'},'2.6':{name:'JMP missing Hotel Guest target',severity:'HIGH',cat:'JMP'},'3.1':{name:'Activity type is "Others"',severity:'MEDIUM',cat:'Data Quality'},'3.2':{name:'Duplicate: same name AND same type',severity:'LOW',cat:'Data Quality'},'3.3':{name:'Training/Workshop spans >1 month',severity:'LOW',cat:'Activity'},'3.6':{name:'Webinar at Priority 1',severity:'LOW',cat:'Activity'},'3.8':{name:'Activity missing KPIs',severity:'MEDIUM',cat:'KPI'},'4.1':{name:'Mega FAM target < 50 participants',severity:'MEDIUM',cat:'Activity'},'4.3':{name:'FAM trip outside Ramadan/Early Summer',severity:'LOW',cat:'Activity'},'5.1':{name:'< 2 zero-budget Ramadan activities',severity:'HIGH',cat:'Planning'},'6.1':{name:'2 sales missions in same quarter',severity:'MEDIUM',cat:'Activity'},'6.3':{name:'Exhibition with no revenue KPI',severity:'MEDIUM',cat:'KPI'},'8.4':{name:'New non-JMP activity >500K — no 2026 ref',severity:'MEDIUM',cat:'Budget'},'B.1':{name:'Cost efficiency outlier (>15% above median)',severity:'MEDIUM',cat:'Benchmark'}};
const RAM_S=new Date(2027,0,1),RAM_E=new Date(2027,1,15);
const THRESH={INC_PCT:10,INC_AED:50000,NOVDEC_PCT:20,NEW_CF:500000,OUTLIER_PCT:15};
const TIER1_MARKETS=['China','France','Germany','India','Italy','Kuwait','Russia','Saudi Arabia','UAE','United Kingdom','United States'];
const TIER2_MARKETS=['Armenia','Bahrain','Belgium','Canada','Egypt','Japan','Kazakhstan','Netherlands','Oman','Poland','Qatar','Romania','South Korea','Spain','Uzbekistan'];
const REGIONS={'Europe & CIS':['France','Germany','Italy','Spain','Poland','Romania','Belgium','Netherlands','Russia','Armenia','Kazakhstan','Uzbekistan'],'APAC':['India','China','Japan','Korea','South Korea'],'GCC':['KSA','Saudi Arabia','Kuwait','Egypt','Domestic','UAE','Bahrain','Qatar','Oman'],'UK & US':['UK','United Kingdom','USA','United States','Canada'],'PR':['PR','PR & Marketing','B2B PR and Marketing'],'Global':['Global Partnerships','Exhibitions','IO Office','Global','International']};
function getRegion(m){if(!m)return'Other';const ml=m.toLowerCase();for(const[r,ms]of Object.entries(REGIONS)){if(ms.some(x=>ml.includes(x.toLowerCase())||x.toLowerCase().includes(ml)))return r;}return'Other';}
function getTier(m){if(!m)return 3;const ml=m.toLowerCase();if(TIER1_MARKETS.some(x=>ml.includes(x.toLowerCase())||x.toLowerCase().includes(ml)))return 1;if(TIER2_MARKETS.some(x=>ml.includes(x.toLowerCase())||x.toLowerCase().includes(ml)))return 2;return 3;}
function getQuarter(d){if(!d)return null;const m=d.getMonth();return m<3?'Q1':m<6?'Q2':m<9?'Q3':'Q4';}
function V(ruleId,a,detail){const meta=RULE_META[ruleId]||{name:ruleId,severity:'LOW',cat:'Other'};return{ruleId,ruleName:meta.name,severity:meta.severity,category:meta.cat,market:a?.market||'—',region:getRegion(a?.market||''),tier:getTier(a?.market||''),activityId:a?.id||'—',activityName:a?.activityName||'—',activityType:a?.activityType||'—',startDate:a?.startDate||null,endDate:a?.endDate||null,detail,status:'pending',comment:''};}
function Vm(ruleId,market,label,detail){const meta=RULE_META[ruleId]||{name:ruleId,severity:'LOW',cat:'Other'};return{ruleId,ruleName:meta.name,severity:meta.severity,category:meta.cat,market,region:getRegion(market),tier:getTier(market),activityId:'Market-level',activityName:label,activityType:'—',startDate:null,endDate:null,detail,status:'pending',comment:''};}
// Violation Identity (see GLOSSARY.md): what makes two violations "the same" across sessions.
function violationKey(v){return `${v.ruleId}||${v.market}||${v.activityId}||${(v.activityName||'').toLowerCase().trim()}`;}

// JMP year-over-year matching (see ADR-0002). Activity Name always carries a year suffix that
// changes every Cycle, so JMP-ID (stable across the Cycle a JMP is signed and the one it continues
// in) is the primary match; base-name + date continuity is the fallback for JMPs missing an ID.
function stripYearTokens(name){return(name||'').replace(/\b\d{2,4}\s*[-\/–—]\s*\d{2,4}\b/g,'').replace(/\b(19|20)\d{2}\b/g,'').replace(/\s{2,}/g,' ').trim().toLowerCase();}
function buildJmpIndex(activities){
  const byId={},byMarket={};
  // A 2026 row with a JMP-ID is only ever matched via that ID — excluding it from byMarket
  // stops the name+date fallback from mis-attaching an unrelated new signing to it.
  activities.filter(isJMP).forEach(a=>{
    if(a.jmpId)byId[a.jmpId]=a;
    else(byMarket[a.market]=byMarket[a.market]||[]).push(a);
  });
  return{byId,byMarket};
}
function matchPriorJMP(a,idx){
  if(a.jmpId&&idx.byId[a.jmpId])return idx.byId[a.jmpId];
  const base=stripYearTokens(a.activityName);
  if(!base)return undefined;
  const candidates=(idx.byMarket[a.market]||[]).filter(p=>stripYearTokens(p.activityName)===base);
  if(!candidates.length)return undefined;
  if(candidates.length===1)return candidates[0];
  let best=null,bestDiff=Infinity;
  candidates.forEach(c=>{if(!c.endDate||!a.startDate)return;const diff=Math.abs(a.startDate-c.endDate);if(diff<bestDiff){bestDiff=diff;best=c;}});
  return best||candidates[0];
}
function matchPriorYear(a,map26ByName,jmpIdx26){
  if(isJMP(a))return matchPriorJMP(a,jmpIdx26);
  return map26ByName[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`];
}
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
function isKPIExempt(a){return isJMP(a)||isMission(a)||isGSA(a)||/^(manpower|admin|projects|expenses|stand.?build|hospitality)$/i.test(a.activityType||'');}
function inRam(d){return d&&d>=RAM_S&&d<=RAM_E;}
function exhPrefix(a){return(a.activityName||'').replace(/\s*[-:]\s*(space.?rent|stand.?build|hospitality|venue|design.?build).*/i,'').trim().toLowerCase();}
function med(arr){if(!arr.length)return 0;const s=[...arr].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function mSum(mo,months){return months.reduce((s,m)=>s+(mo[m]||0),0);}

function runRules(baseline26,review27){
  const violations=[],A27=review27.activities||[],A26=baseline26.activities||[];
  const map26={};A26.forEach(a=>{const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}`;map26[k]=(map26[k]||0)+a.cashflow;});
  const jmpIdx26=buildJmpIndex(A26);
  // 0.1
  A27.forEach(a=>{const t=(a.activityType||'').trim();if(!t||t==='—')return;if(!VALID_TYPES.has(t.toLowerCase()))violations.push(V('0.1',a,`"${t}" is not in the predefined activity type list.`));});
  // 1.1
  A27.forEach(a=>{let prev=0;if(isJMP(a)){const m=matchPriorJMP(a,jmpIdx26);prev=m?m.cashflow:0;}else{const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}`;prev=map26[k]||0;}if(prev>0&&a.cashflow>prev){const pct=((a.cashflow-prev)/prev)*100,abs=a.cashflow-prev;if(pct>THRESH.INC_PCT&&abs>THRESH.INC_AED)violations.push(V('1.1',a,`${fmtAED(prev)} (2026) → ${fmtAED(a.cashflow)} (2027). +${fmtAED(abs)} (+${pct.toFixed(1)}%)`));}});
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
  // 3.2
  const seen={};A27.forEach(a=>{const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}||${(a.activityType||'').toLowerCase().trim()}`;if(seen[k])violations.push(V('3.2',a,`Duplicate name+type in ${a.market}.`));seen[k]=true;});
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
  A27.forEach(a=>{if(isJMP(a)||isGSA(a)||isMission(a))return;const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}`;if(!map26[k]&&a.cashflow>THRESH.NEW_CF)violations.push(V('8.4',a,`New activity ${fmtAED(a.cashflow)} — no 2026 equivalent.`));});
  // B.1
  const typeGroups={};A27.filter(a=>!isJMP(a)).forEach(a=>{if(!typeGroups[a.activityType])typeGroups[a.activityType]={};if(!typeGroups[a.activityType][a.market])typeGroups[a.activityType][a.market]={cf:0,att:0,stak:0};typeGroups[a.activityType][a.market].cf+=a.cashflow;typeGroups[a.activityType][a.market].att+=a.attendees||0;typeGroups[a.activityType][a.market].stak+=a.stakeholders||0;});
  Object.entries(typeGroups).forEach(([type,byMkt])=>{const cpaE=Object.entries(byMkt).filter(([,d])=>d.att>0&&d.cf>0).map(([m,d])=>({m,v:d.cf/d.att}));if(cpaE.length>=3){const m=med(cpaE.map(x=>x.v));cpaE.filter(x=>x.v>m*(1+THRESH.OUTLIER_PCT/100)).forEach(({m:mkt,v})=>{violations.push(V('B.1',{market:mkt,id:'—',activityName:type,activityType:type},`Cost/attendee for ${type}: ${fmtAED(Math.round(v))} vs median ${fmtAED(Math.round(m))} (+${(((v/m)-1)*100).toFixed(0)}% above).`));});}const cpSE=Object.entries(byMkt).filter(([,d])=>d.stak>0&&d.cf>0).map(([m,d])=>({m,v:d.cf/d.stak}));if(cpSE.length>=3){const m=med(cpSE.map(x=>x.v));cpSE.filter(x=>x.v>m*(1+THRESH.OUTLIER_PCT/100)).forEach(({m:mkt,v})=>{violations.push(V('B.1',{market:mkt,id:'—',activityName:type,activityType:type},`Cost/stakeholder for ${type}: ${fmtAED(Math.round(v))} vs median ${fmtAED(Math.round(m))} (+${(((v/m)-1)*100).toFixed(0)}% above).`));});}});
  return violations;
}
function summarise(violations){const active=violations.filter(v=>v.status!=='accepted');const counts={HIGH:0,MEDIUM:0,LOW:0};active.forEach(v=>{counts[v.severity]=(counts[v.severity]||0)+1;});const byMarket={};active.forEach(v=>{byMarket[v.market]=(byMarket[v.market]||0)+1;});const topMarkets=Object.entries(byMarket).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([market,count])=>({market,count}));return{counts,topMarkets,total:active.length};}
function compareYears(b26,r27){
  const A26=b26.activities||[],A27=r27.activities||[];
  const m26ByName={};A26.forEach(a=>{m26ByName[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]=a;});
  const jmpIdx26=buildJmpIndex(A26);
  const matchedA26=new Set();
  const added=[],changed=[];
  A27.forEach(a27=>{
    const a26=matchPriorYear(a27,m26ByName,jmpIdx26);
    if(!a26){added.push(a27);return;}
    matchedA26.add(a26);
    const ch=[];
    if(Math.abs(a27.cashflow-a26.cashflow)>1000)ch.push({field:'Cashflow',from:a26.cashflow,to:a27.cashflow,diff:a27.cashflow-a26.cashflow});
    if(a27.priority!==a26.priority&&a27.priority&&a26.priority)ch.push({field:'Priority',from:a26.priority,to:a27.priority,diff:0});
    if(a27.activityType!==a26.activityType)ch.push({field:'Type',from:a26.activityType,to:a27.activityType,diff:0});
    if(a27.locked!==a26.locked)ch.push({field:'Lock',from:a26.locked,to:a27.locked,diff:0});
    if(ch.length)changed.push({a27,a26,changes:ch});
  });
  const removed=A26.filter(a=>!matchedA26.has(a));
  return{added,removed,changed};
}
