/* PrepNex All-Access — subscription + premium study tools (shared by every page).
   Paid: full real exams (1 free attempt per exam page), readiness score, weak-spot review, study plan,
   detailed score reports, spaced-repetition flashcards and custom quizzes.
   Status comes from public.subscriptions (written only by the Stripe webhook). Client-side lock. */
(function(){
'use strict';
const SB_URL='https://slygzqljbyszrxqolcks.supabase.co', SB_KEY='sb_publishable_qS-vSIuh8VwJSJGWPHJlxQ_fS9bN8wQ';
const PRICE='$9.99', TRIAL_DAYS=3, FREE_EXAMS=1, WEAK_ID='__weak', MASTER=2;
const page=(location.pathname.split('/').pop()||'index.html').replace(/\.html$/,'')||'index';
const isHome=!window.ExamApp;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ls={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
let sb=null;try{if(window.supabase)sb=window.supabase.createClient(SB_URL,SB_KEY)}catch(e){}

/* ---------- subscription status ---------- */
let sub=ls.get('pn-sub')||{s:'none'};
const isPremium=()=>(sub.s==='active'||sub.s==='trialing')&&(!sub.end||Date.parse(sub.end)>Date.now());
async function session(){if(!sb)return null;try{const r=await sb.auth.getSession();return r.data.session}catch(e){return null}}
async function refresh(){const s=await session();
 if(!s){sub={s:'none'};ls.set('pn-sub',sub);return render()}
 try{const r=await sb.from('subscriptions').select('status,current_period_end,trial_end,cancel_at_period_end').eq('user_id',s.user.id).maybeSingle();
  if(!r.error){const d=r.data;sub=d?{s:d.status,end:d.current_period_end,trial:d.trial_end,cancel:d.cancel_at_period_end,uid:s.user.id}:{s:'none',uid:s.user.id};ls.set('pn-sub',sub)}}catch(e){}
 render()}

/* ---------- checkout / billing portal (Supabase Edge Functions) ---------- */
let busy=false;
async function checkout(){if(busy)return;const s=await session();
 if(!s){ls.set('pn-after-login','subscribe');return window.Auth&&window.Auth.open?window.Auth.open('signup'):(location.href='index.html#signup')}
 busy=true;msg('Opening secure checkout…');
 try{const r=await sb.functions.invoke('create-checkout',{body:{return_url:location.href.split('#')[0].split('?')[0]}});
  if(r.error||!r.data||!r.data.url)throw r.error||new Error('No checkout link');location.href=r.data.url}
 catch(e){busy=false;msg('Checkout is not available right now. Please try again in a minute.',true)}}
async function portal(){if(busy)return;busy=true;msg('Opening billing…');
 try{const r=await sb.functions.invoke('customer-portal',{body:{return_url:location.href.split('#')[0].split('?')[0]}});
  if(r.error||!r.data||!r.data.url)throw r.error||new Error('No portal link');location.href=r.data.url}
 catch(e){busy=false;msg('Billing is not available right now. Please try again in a minute.',true)}}
function msg(t,err){const m=$('pn-msg');if(m){m.textContent=t;m.style.color=err?'#c0392b':''}}

/* ---------- paywall modal ---------- */
const FEATURES=[['⏱','Full real exams','Unlimited timed exams in the official format on every exam page'],['📊','Detailed score reports','Your score by domain after every exam, and exactly what to study next'],['🃏','Smart flashcards','Spaced repetition brings each card back right before you would forget it'],['🧩','Custom quizzes','Pick sections, length, and only unseen or missed questions'],['🎯','Readiness score','See how ready you are to pass, based on your exams and lessons'],['🩹','Fix my weak spots','Missed questions come back until you master them'],['📅','Study plan','A daily plan that counts down to your exam date']];
function paywall(reason){close();const d=document.createElement('div');d.id='pn-modal';d.className='pn-ov';d.onclick=e=>{if(e.target===d)close()};
 const head=reason==='exam'?'You used your free real exam on this page':reason==='tool'?'This is an All-Access tool':'PrepNex All-Access';
 d.innerHTML=`<div class="pn-box" role="dialog" aria-modal="true" aria-labelledby="pn-h"><button class="pn-x" onclick="Premium.close()" aria-label="Close">✕</button>
 <div class="pn-kick">All-Access · every exam</div><h2 id="pn-h">${esc(head)}</h2>
 <p class="pn-price"><b>${PRICE}</b>/month · <b>${TRIAL_DAYS}-day free trial</b> · cancel anytime</p>
 <ul class="pn-feat">${FEATURES.map(f=>`<li><span>${f[0]}</span><div><b>${f[1]}</b><small>${f[2]}</small></div></li>`).join('')}</ul>
 <button class="pn-cta" onclick="Premium.checkout()">${isPremium()?'You have All-Access ✓':`Start ${TRIAL_DAYS}-day free trial`}</button>
 <p class="pn-fine">Lessons and practice questions stay free. After the trial, ${PRICE} is charged every month until you cancel. Cancel anytime in Settings → Subscription. Payments are processed securely by Stripe. <a href="terms.html">Terms</a></p>
 <div id="pn-msg" class="pn-msg" role="status"></div></div>`;
 document.body.appendChild(d);if(isPremium()){const b=d.querySelector('.pn-cta');b.disabled=true}}
function close(){const m=$('pn-modal');if(m)m.remove()}

/* ---------- learning data helpers (exam pages) ---------- */
const st=()=>{try{return LearnApp.getState()}catch(e){return{}}};
const put=s=>{try{LearnApp.setState(s)}catch(e){}};
const hist=()=>(st().hist||[]).filter(h=>h&&h.exam!=='__weak'&&h.exam!=='__custom');
const allQ=()=>{const out=[];try{SECTIONS.forEach(s=>s.questions.forEach((q,i)=>out.push({q,sec:s.id,i})))}catch(e){}
 const X=window.EXAM_X||{};for(const k in X)if(k!==WEAK_ID)(X[k]||[]).forEach(q=>{if(q&&q.opts&&q.q&&!q.ao)out.push({q,sec:'x:'+k})});return out};
const key=t=>String(t||'').trim().toLowerCase().slice(0,160);
function passThreshold(){const C=window.EXAM_CFG;const e=C&&C.exams&&C.exams.find(x=>!String(x.id).startsWith('__'));const p=(e&&e.pass)||{};
 if(p.type==='pct')return p.v;if(p.type==='scaled'){const lo=p.lo==null?100:p.lo,hi=p.hi==null?900:p.hi;return (p.v-lo)/(hi-lo)}
 if(p.type==='ged')return .55;if(p.type==='interview'){const n=(e.parts[0]||{}).n||20;return p.ok/n}return .6}
function lessonsDone(){try{const L=LearnApp._lessons||{},d=st().done||{};let t=0,n=0;for(const s in L)L[s].forEach(l=>{t++;if(d[l.id])n++});return{n,t}}catch(e){return{n:0,t:0}}}

/* readiness: 70% recent real-exam performance vs the pass mark, 30% lesson coverage */
function readiness(){const H=hist().slice(-3),T=passThreshold(),c=lessonsDone(),cov=c.t?c.n/c.t:0;
 if(!H.length)return{none:true,cov,c,T};
 const p=H.reduce((s,h)=>s+(h.pct||0),0)/H.length,ex=Math.min(1,p/Math.min(.98,T+.05));
 const score=Math.round((ex*.7+cov*.3)*100);const last=H[H.length-1],prev=H.length>1?H[H.length-2]:null;
 const label=p>=T+.05&&score>=80?['Pass likely','ok']:p>=T?['Borderline — keep practicing','mid']:['Not ready yet','no'];
 let weakPart=null;if(last.parts&&last.parts.length>1){weakPart=last.parts.slice().sort((a,b)=>a.c/a.t-b.c/b.t)[0]}
 return{score,p,T,label,cov,c,trend:prev?Math.round((last.pct-prev.pct)*100):null,weakPart,n:H.length}}

/* weak spots: questions missed in real exams or lessons, until answered right MASTER times in a row */
function weakData(){const s=st();const pn=s.pn||{};return pn.weak||{}}
function collectMisses(){const s=st(),W=Object.assign({},weakData()),idx=new Map();allQ().forEach(o=>idx.set(key(o.q.q),o));
 (s.hist||[]).forEach(h=>{if(h.exam===WEAK_ID)return;(h.missed||[]).forEach(m=>{const k=key(m.q);if(idx.has(k)){const w=W[k]||{ok:0,miss:0,last:0};const t=h.ts||0;if(t>(w.last||0)&&t>(w.miss||0)){w.miss=t;w.ok=0}W[k]=w}})});
 try{const S=SECTIONS;for(const sec in (s.miss||{}))(s.miss[sec]||[]).forEach(n=>{const sc=S.find(x=>x.id===sec);const q=sc&&sc.questions[n];if(q){const k=key(q.q);if(!W[k])W[k]={ok:0,miss:1,last:0}}})}catch(e){}
 return{W,idx}}
function weakList(){const{W,idx}=collectMisses();return Object.entries(W).filter(([k,w])=>w.ok<MASTER&&idx.has(k)).sort((a,b)=>(b[1].miss||0)-(a[1].miss||0)).map(([k])=>idx.get(k))}
function startWeak(){if(!isPremium())return paywall('tool');const list=weakList();
 if(!list.length){return alertBox('No weak spots yet','Take a real exam or finish some lessons first. Every question you miss will show up here until you get it right twice in a row.')}
 const qs=list.slice(0,20).map(o=>o.q);window.EXAM_X=window.EXAM_X||{};window.EXAM_X[WEAK_ID]=qs;
 const C=window.EXAM_CFG;C.exams=C.exams.filter(e=>e.id!==WEAK_ID);
 C.exams.push({id:WEAK_ID,title:'Weak-spot review',sub:'Your missed questions',nav:'free',pass:{type:'pct',v:.8,label:'Master each question twice'},rules:[],parts:[{id:WEAK_ID,name:'Weak-spot review',n:qs.length,pool:[{x:WEAK_ID}]}]});
 ls.set('pn-weak-session',{page,keys:qs.map(q=>key(q.q)),ts:Date.now()});ExamApp.open();ExamApp.start(WEAK_ID)}
function recordWeak(rec){const sess=ls.get('pn-weak-session');if(!sess||sess.page!==page)return;ls.del('pn-weak-session');
 const s=st();s.pn=s.pn||{};const W=Object.assign({},weakData()),missed=new Set((rec.missed||[]).map(m=>key(m.q)));
 const now=Date.now();sess.keys.forEach(k=>{const w=W[k]||{ok:0,miss:0};if(missed.has(k)){w.ok=0;w.miss=now}else w.ok=(w.ok||0)+1;w.last=now;W[k]=w});
 s.pn.weak=W;put(s)}

/* ---------- question index (text -> section), used by reports, custom quizzes, flashcards ---------- */
const CUSTOM_ID='__custom',SYS=new Set([WEAK_ID,CUSTOM_ID]);
const h36=t=>{let h=5381;const s=String(t);for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)};
let QIDX=null;
function qindex(){if(QIDX)return QIDX;QIDX=new Map();
 try{SECTIONS.forEach(s=>{const w=((s.desc||'').match(/(\d+)%\s*of exam/)||[])[1];s.questions.forEach((q,i)=>{if(q&&q.q&&q.opts)QIDX.set(key(q.q),{q,sec:s.id,name:s.name,w:w?+w:null,i})})})}catch(e){}
 const X=window.EXAM_X||{},C=window.EXAM_CFG||{exams:[]};
 for(const k in X){if(k==='pbq'||k.startsWith('__'))continue;let nm=k;C.exams.forEach(e=>e.parts.forEach(p=>(p.pool||[]).forEach(pl=>{if(pl.x===k)nm=p.name})));
  (X[k]||[]).forEach(q=>{if(q&&q.q&&q.opts&&!q.ao&&!QIDX.has(key(q.q)))QIDX.set(key(q.q),{q,sec:'x:'+k,name:nm,w:null})})}
 return QIDX}
function groups(){const G=new Map();qindex().forEach(o=>{if(!G.has(o.sec))G.set(o.sec,{id:o.sec,name:o.name,w:o.w,list:[]});G.get(o.sec).list.push(o)});return [...G.values()]}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

/* ---------- 1. detailed score reports (domain breakdown after every exam) ---------- */
let asked=null,viewId=null;
function capture(){if(!asked)return;const el=document.querySelector('#exam-screen .ex-qt');if(el)asked.add(el.textContent.replace('🔊','').trim())}
function onRecord(){const s=st(),H=s.hist||[],last=H[H.length-1];if(!last||last.dom||!asked)return;
 const I=qindex(),missed=new Set((last.missed||[]).map(m=>key(m.q))),dom={};
 asked.forEach(t=>{const o=I.get(key(t));if(!o)return;const d=dom[o.sec]||(dom[o.sec]={n:o.name,w:o.w,a:0,m:0});d.a++;if(missed.has(key(t)))d.m++});
 last.dom=dom;s.pn=s.pn||{};const seen=s.pn.seen||{};asked.forEach(t=>{if(I.has(key(t)))seen[h36(key(t))]=1});s.pn.seen=seen;asked=null;viewId=last.id;put(s)}
function reportHtml(rec){const D=rec&&rec.dom;if(!D)return'';const order=groups().map(g=>g.id);
 const rows=Object.entries(D).map(([id,d])=>Object.assign({id},d,{p:d.a?(d.a-d.m)/d.a:0})).filter(r=>r.a).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));if(!rows.length)return'';
 const T=passThreshold(),P=isPremium(),hasW=rows.some(r=>r.w);
 const pri=rows.slice().sort((a,b)=>(hasW?(b.w||0)*(1-b.p)-(a.w||0)*(1-a.p):a.p-b.p)).filter(r=>r.p<Math.max(T,.8)).slice(0,3);
 const L=(window.LearnApp&&LearnApp._lessons)||{};
 const bar=r=>`<div class="pn-bar"><i style="width:${Math.round(r.p*100)}%;background:${r.p>=T+.05?'#1a7f37':r.p>=T?'#b7791f':'#c0392b'}"></i><em style="left:${Math.round(T*100)}%"></em></div>`;
 return `<div class="ex-card pn-report ${P?'':'locked'}"><h3>Score report by ${hasW?'domain':'section'}</h3>
 <table class="pn-rt"><thead><tr><th>${hasW?'Domain':'Section'}</th>${hasW?'<th>Exam weight</th>':''}<th>Your score</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.n)}</td>${hasW?`<td>${r.w?r.w+'%':'—'}</td>`:''}<td><b>${Math.round(r.p*100)}%</b> <small>${r.a-r.m}/${r.a}</small></td><td>${bar(r)}</td></tr>`).join('')}</tbody></table>
 <p class="pn-sub">The line on each bar is the pass mark (about ${Math.round(T*100)}%).${hasW?' Weaker domains with a bigger exam weight cost you the most points.':''}</p>
 ${pri.length?`<h4>Study these next</h4><ul class="pn-pri">${pri.map(r=>`<li><b>${esc(r.n)}</b> — ${Math.round(r.p*100)}%${r.w?` · ${r.w}% of the exam`:''}<span>${L[r.id]?`<button class="pn-btn sm" onclick="Premium.study('${esc(r.id)}')">Study lessons</button>`:''}<button class="pn-btn sm ghost" onclick="Premium.customFor('${esc(r.id)}')">Drill 20 questions</button></span></li>`).join('')}</ul>`:'<p class="pn-sub"><b>Every area is at or above the pass mark.</b> Keep taking full exams to stay sharp.</p>'}
 ${P?'':`<button class="pn-unlock" onclick="Premium.paywall('tool')">🔒 Unlock score reports with All-Access</button>`}</div>`}
function injectReport(){const scr=$('exam-screen');if(!scr||!viewId||scr.querySelector('.pn-report'))return;const big=scr.querySelector('.ex-big');if(!big)return;
 const rec=(st().hist||[]).find(h=>h.id===viewId);const html=reportHtml(rec);if(!html)return;const card=big.closest('.ex-card');if(card)card.insertAdjacentHTML('afterend',html)}
function study(sec){try{ExamApp.leave();LearnApp.open();LearnApp.sec(sec)}catch(e){}}

/* ---------- 4. custom quizzes ---------- */
function customBuilder(pre){if(!isPremium())return paywall('tool');close();const G=groups(),seen=(st().pn||{}).seen||{},{W}=collectMisses();
 const d=document.createElement('div');d.id='pn-modal';d.className='pn-ov';d.onclick=e=>{if(e.target===d)close()};
 d.innerHTML=`<div class="pn-box pn-wide" role="dialog" aria-modal="true"><button class="pn-x" onclick="Premium.close()" aria-label="Close">✕</button><div class="pn-kick">All-Access</div><h2>Build a custom quiz</h2>
 <fieldset><legend>Sections</legend><div class="pn-secs">${G.map(g=>{const un=g.list.filter(o=>!seen[h36(key(o.q.q))]).length,mi=g.list.filter(o=>W[key(o.q.q)]).length;return `<label><input type="checkbox" name="pn-sec" value="${esc(g.id)}" ${!pre||pre===g.id?'checked':''}> ${esc(g.name)} <small>${g.list.length} · ${un} unseen · ${mi} missed</small></label>`}).join('')}</div>
 <button class="pn-link" type="button" onclick="document.querySelectorAll('[name=pn-sec]').forEach(c=>c.checked=true)">Select all</button> · <button class="pn-link" type="button" onclick="document.querySelectorAll('[name=pn-sec]').forEach(c=>c.checked=false)">None</button></fieldset>
 <fieldset><legend>Questions</legend><div class="pn-row">${[10,20,30,50].map(n=>`<label class="pn-pill"><input type="radio" name="pn-n" value="${n}" ${n===20?'checked':''}> ${n}</label>`).join('')}</div></fieldset>
 <fieldset><legend>Which questions</legend><div class="pn-row"><label class="pn-pill"><input type="radio" name="pn-src" value="all" checked> All</label><label class="pn-pill"><input type="radio" name="pn-src" value="unseen"> Only ones I haven't seen</label><label class="pn-pill"><input type="radio" name="pn-src" value="missed"> Only ones I've missed</label></div></fieldset>
 <label class="pn-chk"><input type="checkbox" id="pn-timed"> Timed (about 72 seconds per question)</label>
 <button class="pn-cta" onclick="Premium.startCustom()">Start quiz</button><div id="pn-msg" class="pn-msg" role="status"></div></div>`;document.body.appendChild(d)}
function startCustom(opts){if(!isPremium())return paywall('tool');
 const o=opts||{secs:[...document.querySelectorAll('[name=pn-sec]:checked')].map(c=>c.value),n:+((document.querySelector('[name=pn-n]:checked')||{}).value||20),src:(document.querySelector('[name=pn-src]:checked')||{}).value||'all',timed:!!($('pn-timed')||{}).checked};
 if(!o.secs.length)return msg('Choose at least one section.',true);
 const seen=(st().pn||{}).seen||{},{W}=collectMisses();let pool=groups().filter(g=>o.secs.includes(g.id)).flatMap(g=>g.list);
 if(o.src==='unseen')pool=pool.filter(x=>!seen[h36(key(x.q.q))]);else if(o.src==='missed')pool=pool.filter(x=>W[key(x.q.q)]);
 if(!pool.length)return msg(o.src==='unseen'?'You have seen every question in these sections. Choose "All" instead.':o.src==='missed'?'No missed questions in these sections yet.':'No questions found.',true);
 const qs=shuffle(pool).slice(0,o.n).map(x=>x.q);window.EXAM_X=window.EXAM_X||{};window.EXAM_X[CUSTOM_ID]=qs;
 const C=window.EXAM_CFG;C.exams=C.exams.filter(e=>e.id!==CUSTOM_ID);
 C.exams.push({id:CUSTOM_ID,title:'Custom quiz',sub:qs.length+' questions',nav:'free',pass:{type:'pct',v:passThreshold(),label:'Pass mark of the real exam'},rules:[],parts:[{id:CUSTOM_ID,name:'Custom quiz',n:qs.length,min:o.timed?Math.ceil(qs.length*1.2):undefined,pool:[{x:CUSTOM_ID}]}]});
 close();ExamApp.open();ExamApp.start(CUSTOM_ID)}
function customFor(sec){if(!isPremium())return paywall('tool');startCustom({secs:[sec],n:20,src:'all',timed:false})}

/* ---------- 2. flashcards with spaced repetition ---------- */
const FC_NEW=20,FC_DAYS=[1,3,7,14,30,60];let DECK=null,fcQ=[],fcCur=null,fcFlip=false;
function deck(){if(DECK)return DECK;const out=[],seenId=new Set(),done=st().done||{},L=(window.LearnApp&&LearnApp._lessons)||{};
 const doneSecs=new Set();for(const s in L)L[s].forEach(l=>{if(done[l.id])doneSecs.add(s)});
 for(const s in L)L[s].forEach(l=>(l.cards||[]).forEach(c=>{if(!c.f)return;const id='r'+h36(c.h+'|'+c.f);if(seenId.has(id))return;seenId.add(id);out.push({id,f:c.h,b:c.f,tag:l.t,rank:done[l.id]?0:2})}));
 qindex().forEach(o=>{const q=o.q,id='q'+h36(key(q.q));if(seenId.has(id))return;seenId.add(id);out.push({id,f:esc(q.q),b:'<b>'+esc(q.opts[q.ans])+'</b>'+(q.exp?'<p>'+esc(q.exp)+'</p>':''),tag:o.name,rank:doneSecs.has(o.sec)?1:3})});
 DECK=out;return out}
function fcState(){const s=st();s.pn=s.pn||{};s.pn.fc=s.pn.fc||{};const t=day();if(!s.pn.fcd||s.pn.fcd.day!==t)s.pn.fcd={day:t,n:0};return s}
function fcCounts(){const s=fcState(),F=s.pn.fc,now=Date.now();let due=0,fresh=0;deck().forEach(c=>{const r=F[c.id];if(r){if(r[1]<=now)due++}else fresh++});return{due,fresh,newLeft:Math.max(0,FC_NEW-s.pn.fcd.n),total:deck().length}}
function flashcards(){if(!isPremium())return paywall('tool');const s=fcState(),F=s.pn.fc,now=Date.now();
 const due=deck().filter(c=>F[c.id]&&F[c.id][1]<=now).sort((a,b)=>F[a.id][1]-F[b.id][1]).slice(0,100);
 const fresh=deck().filter(c=>!F[c.id]).sort((a,b)=>a.rank-b.rank).slice(0,Math.max(0,FC_NEW-s.pn.fcd.n));
 fcQ=due.concat(fresh);fcCur=null;fcShow()}
function fcShow(){close();const d=document.createElement('div');d.id='pn-modal';d.className='pn-ov';
 if(!fcQ.length){const c=fcCounts();d.innerHTML=`<div class="pn-box"><button class="pn-x" onclick="Premium.close()" aria-label="Close">✕</button><div class="pn-kick">Flashcards</div><h2>All done for today 🎉</h2><p>${c.due?c.due+' card'+(c.due>1?'s are':' is')+' still due.':'No more cards are due right now.'} ${c.newLeft?'':'You reached today\'s limit of '+FC_NEW+' new cards.'} Come back tomorrow — cards you know well come back less often.</p><p class="pn-sub">${c.total-c.fresh} of ${c.total} cards started.</p><button class="pn-cta" onclick="Premium.close()">Done</button></div>`;document.body.appendChild(d);return}
 fcCur=fcQ[0];fcFlip=false;const F=fcState().pn.fc,r=F[fcCur.id],b=r?r[0]:0;const iv=k=>{const n=k==='again'?0:k==='hard'?1:k==='good'?FC_DAYS[Math.min(b,5)]:FC_DAYS[Math.min(b+1,5)];return n?n+(n>1?' days':' day'):'<1 min'};
 d.innerHTML=`<div class="pn-box pn-fc" role="dialog" aria-modal="true"><button class="pn-x" onclick="Premium.close()" aria-label="Close">✕</button>
 <div class="pn-fchead"><span class="pn-kick">Flashcards · ${esc(fcCur.tag||'')}</span><small>${fcQ.length} left${r?'':' · new'}</small></div>
 <div class="pn-face">${fcCur.f}</div><div class="pn-back" id="pn-back" hidden>${fcCur.b}</div>
 <div id="pn-fcbtns"><button class="pn-cta" onclick="Premium.fcFlip()">Show answer <small>(space)</small></button></div>
 <div id="pn-rate" class="pn-rate" hidden>${['again','hard','good','easy'].map((k,i)=>`<button class="pn-r ${k}" onclick="Premium.fcRate('${k}')"><b>${k[0].toUpperCase()+k.slice(1)}</b><small>${iv(k)} · ${i+1}</small></button>`).join('')}</div></div>`;
 document.body.appendChild(d)}
function fcDoFlip(){if(!fcCur||fcFlip)return;fcFlip=true;$('pn-back').hidden=false;$('pn-fcbtns').hidden=true;$('pn-rate').hidden=false}
function fcRate(k){if(!fcCur||!fcFlip)return;const s=fcState(),F=s.pn.fc,old=F[fcCur.id],b=old?old[0]:0,now=Date.now();if(!old)s.pn.fcd.n++;
 let nb,due;if(k==='again'){nb=0;due=now+60e3}else if(k==='hard'){nb=Math.max(1,b);due=now+864e5}else if(k==='good'){nb=b+1;due=now+FC_DAYS[Math.min(b,5)]*864e5}else{nb=b+2;due=now+FC_DAYS[Math.min(b+1,5)]*864e5}
 F[fcCur.id]=[nb,due];put(s);const c=fcQ.shift();if(k==='again')fcQ.push(c);fcShow()}
document.addEventListener('keydown',e=>{if(!$('pn-modal')||!document.querySelector('.pn-fc'))return;if(e.key===' '||e.key==='Enter'){e.preventDefault();fcDoFlip()}else if(fcFlip&&'1234'.includes(e.key)){fcRate(['again','hard','good','easy'][+e.key-1])}else if(e.key==='Escape')close()});

/* study plan */
const day=(d=new Date())=>d.toISOString().slice(0,10);
function plan(){const s=st(),pn=s.pn||{},p=pn.plan;if(!p||!p.date)return null;const left=Math.ceil((Date.parse(p.date+'T12:00:00')-Date.now())/864e5);
 const c=lessonsDone(),rem=Math.max(0,c.t-c.n),log=pn.log||{},today=day();
 if(!log[today]){log[today]={done:c.n};pn.log=log;s.pn=pn;put(s)}
 const doneToday=c.n-(log[today].done||0),H=st().hist||[],t0=new Date(today+'T00:00:00').getTime();
 const examToday=H.some(h=>!String(h.exam).startsWith('__')&&h.ts>=t0),weakToday=H.some(h=>h.exam===WEAK_ID&&h.ts>=t0);
 const final=left<=7;const study=Math.max(1,left-(rem?7:0));const perDay=rem?Math.ceil(rem/Math.max(1,final?left:study)):0;
 const tasks=[];if(perDay)tasks.push({t:`Finish ${perDay} lesson${perDay>1?'s':''}`,d:Math.min(doneToday,perDay)>=perDay,prog:`${Math.min(doneToday,perDay)}/${perDay}`});
 if(final||!rem)tasks.push({t:left%2===0||left<=2?'Take a full real exam':'Review your weak spots',d:left%2===0||left<=2?examToday:weakToday});
 else tasks.push({t:'Review your weak spots (10 minutes)',d:weakToday});
 if(left>7&&left%7===0)tasks.push({t:'Take a full real exam to check your progress',d:examToday});
 return{date:p.date,left,rem,tasks}}
function setPlan(v){if(!isPremium())return paywall('tool');const s=st();s.pn=s.pn||{};s.pn.plan=v?{date:v}:null;put(s);render()}

function alertBox(h,t){close();const d=document.createElement('div');d.id='pn-modal';d.className='pn-ov';d.onclick=e=>{if(e.target===d)close()};
 d.innerHTML=`<div class="pn-box"><button class="pn-x" onclick="Premium.close()" aria-label="Close">✕</button><h2>${esc(h)}</h2><p>${esc(t)}</p><button class="pn-cta" onclick="Premium.close()">OK</button></div>`;document.body.appendChild(d)}

/* ---------- exam page panel ---------- */
function panel(){const home=$('home-screen');if(!home)return;let el=$('pn-panel');
 if(!el){el=document.createElement('section');el.id='pn-panel';const anchor=home.querySelector('.hm-stats');anchor?anchor.after(el):home.prepend(el)}
 const P=isPremium(),R=readiness(),wl=weakList().length,pl=plan(),fc=fcCounts(),lastRec=hist().filter(h=>h.dom).slice(-1)[0];
 const lock=P?'':`<button class="pn-unlock" onclick="Premium.paywall('tool')">🔒 Unlock with All-Access · ${TRIAL_DAYS}-day free trial</button>`;
 const rd=R.none?`<p class="pn-big">—</p><p class="pn-sub">Take a real exam to get your score. Lessons done: ${R.c.n}/${R.c.t}.</p>`
  :`<p class="pn-big ${R.label[1]}">${R.score}%</p><p class="pn-sub"><b>${R.label[0]}</b> · last ${R.n} exam${R.n>1?'s':''} avg ${Math.round(R.p*100)}% (pass ≈ ${Math.round(R.T*100)}%)${R.trend!=null?` · ${R.trend>=0?'▲':'▼'} ${Math.abs(R.trend)} pts`:''}${R.weakPart?` · weakest: ${esc(R.weakPart.name)}`:''}</p>${lastRec?`<button class="pn-link" onclick="Premium.report('${lastRec.id}')">See last score report</button>`:''}`;
 const plHtml=pl?`<p class="pn-sub"><b>${pl.left>0?pl.left+' day'+(pl.left>1?'s':'')+' to your exam':pl.left===0?'Exam day — good luck!':'Exam date passed'}</b> (${esc(pl.date)}) · ${pl.rem} lesson${pl.rem===1?'':'s'} left</p><ul class="pn-tasks">${pl.left>=0?pl.tasks.map(t=>`<li class="${t.d?'done':''}">${t.d?'✓':'○'} ${esc(t.t)}${t.prog?` <small>${t.prog}</small>`:''}</li>`).join(''):''}</ul><button class="pn-link" onclick="Premium.setPlan('')">Change date</button>`
  :`<p class="pn-sub">Set your exam date and get a daily plan.</p><div class="pn-row"><input type="date" id="pn-date" min="${day()}" aria-label="Exam date"><button class="pn-btn" onclick="Premium.setPlan(document.getElementById('pn-date').value)">Make my plan</button></div>`;
 el.innerHTML=`<div class="pn-head"><h2>All-Access tools</h2>${P?`<span class="pn-badge">${sub.s==='trialing'?'Free trial':'All-Access'} ✓</span>`:''}</div>
 <div class="pn-grid ${P?'':'locked'}">
  <div class="pn-card"><small>Readiness score</small>${rd}</div>
  <div class="pn-card"><small>Fix my weak spots</small><p class="pn-big">${wl}</p><p class="pn-sub">question${wl===1?'':'s'} to master (right ${MASTER}× in a row)</p><button class="pn-btn" onclick="Premium.startWeak()" ${wl?'':'disabled'}>Review now</button></div>
  <div class="pn-card"><small>Smart flashcards</small><p class="pn-big">${fc.due}</p><p class="pn-sub">due now · ${fc.newLeft?Math.min(fc.newLeft,fc.fresh)+' new today':'new-card limit reached'} · ${fc.total} cards</p><button class="pn-btn" onclick="Premium.flashcards()" ${fc.due||(fc.newLeft&&fc.fresh)?'':'disabled'}>Study cards</button></div>
  <div class="pn-card"><small>Custom quiz</small><p class="pn-sub">Pick sections, how many questions, and only unseen or missed ones.</p><button class="pn-btn" onclick="Premium.customBuilder()">Build a quiz</button></div>
  <div class="pn-card"><small>Study plan</small>${plHtml}</div>
 </div>${lock}`}

/* gate real exams: 1 free attempt per page, then All-Access */
function gate(){if(!window.ExamApp||ExamApp.__pn)return;const orig=ExamApp.start,home=ExamApp.home;
 ExamApp.start=function(id){if(!SYS.has(id)&&!isPremium()&&hist().length>=FREE_EXAMS)return paywall('exam');asked=new Set();viewId=null;return orig.apply(this,arguments)};
 ['go','jump','begin','next','start'].forEach(n=>{const fn=ExamApp[n];ExamApp[n]=function(){const r=fn.apply(this,arguments);capture();return r}});
 const show=ExamApp.show;ExamApp.show=function(id){viewId=id;return show.apply(this,arguments)};
 const scr=$('exam-screen');if(scr&&!scr.__pnObs){scr.__pnObs=1;new MutationObserver(()=>{capture();if(viewId)injectReport()}).observe(scr,{childList:true,subtree:true})}
 ExamApp.home=function(){viewId=null;const C=window.EXAM_CFG,w=C.exams.filter(e=>SYS.has(e.id));C.exams=C.exams.filter(e=>!SYS.has(e.id));const r=home.apply(this,arguments);C.exams.push(...w);
  const box=document.querySelector('#exam-screen .ex-sub');if(box&&!isPremium()){const n=Math.max(0,FREE_EXAMS-hist().length);box.insertAdjacentHTML('afterend',`<p class="pn-note">${n?`You have <b>${n} free real exam</b> on this page.`:'You used your free real exam on this page.'} <a href="#" onclick="Premium.paywall();return false">All-Access</a> gives unlimited real exams on every page.</p>`)}return r};
 if(window.LearnApp&&!LearnApp.__pn){const set=LearnApp.setState;LearnApp.setState=function(o){const before=(st().hist||[]).length;const r=set.apply(this,arguments);const h=(o&&o.hist)||[];if(h.length>before&&asked)onRecord();if(h.length>before||h.length&&h[h.length-1].exam===WEAK_ID){const last=h[h.length-1];if(last&&last.exam===WEAK_ID&&!last.__pn){last.__pn=1;recordWeak(last)}}return r};LearnApp.__pn=1}
 const ss=window.showScreen;if(ss&&!ss.__pn){window.showScreen=function(id){const r=ss.apply(this,arguments);if(id==='home-screen')render();return r};window.showScreen.__pn=1}
 ExamApp.__pn=1}

/* ---------- homepage: banner + settings section ---------- */
function homeBanner(){let el=$('pn-banner');const anchor=document.querySelector('#exams')||document.querySelector('.hub-footer');if(!anchor)return;
 if(!el){el=document.createElement('section');el.id='pn-banner';anchor.parentNode.insertBefore(el,anchor)}
 const P=isPremium();el.innerHTML=`<div class="pn-wrap"><div><div class="pn-kick">All-Access</div><h2>${P?'You have All-Access ✓':'Pass faster with All-Access'}</h2>
 <p>${P?'Unlimited real exams, score reports, smart flashcards, custom quizzes, readiness scores, weak-spot reviews and study plans on every exam.':`Unlimited real exams, detailed score reports, smart flashcards, custom quizzes, a readiness score, weak-spot reviews and a study plan for every exam — <b>${PRICE}/month</b> after a <b>${TRIAL_DAYS}-day free trial</b>. Lessons stay free.`}</p></div>
 <button class="pn-cta" onclick="${P?'Premium.portal()':'Premium.paywall()'}">${P?'Manage subscription':`Start free trial`}</button></div>`}
function settingsHook(){const m=$('auth-modal');if(!m||m.__pnObs)return;m.__pnObs=1;new MutationObserver(()=>{const del=[...m.querySelectorAll('h3')].find(h=>/Delete account/i.test(h.textContent));
 if(del&&!m.querySelector('#pn-st')){const sec=del.closest('section')||del.parentNode;const P=isPremium();const box=document.createElement('section');box.id='pn-st';
  box.innerHTML=`<h3>Subscription</h3><p class="au-sub">${P?`${sub.s==='trialing'?'Free trial':'All-Access'} · ${PRICE}/month${sub.cancel?' · cancels at the end of this period':''}${sub.end?` · ${sub.cancel?'ends':'renews'} ${new Date(sub.end).toLocaleDateString()}`:''}`:`Free plan. All-Access is ${PRICE}/month with a ${TRIAL_DAYS}-day free trial.`}</p><button class="btn btn-ghost au-sm" onclick="${P?'Premium.portal()':'Premium.paywall()'}">${P?'Manage billing / cancel':'Start free trial'}</button><div id="pn-msg" class="au-msg" role="status"></div>`;
  sec.parentNode.insertBefore(box,sec)}}).observe(m,{childList:true,subtree:true});
 if(window.Auth&&Auth.deleteAccount&&!Auth.__pnDel){const d=Auth.deleteAccount;Auth.deleteAccount=function(){if(isPremium()&&!sub.cancel){alert('Please cancel your All-Access subscription first (Settings → Subscription → Manage billing / cancel), then delete your account.');return}return d.apply(this,arguments)};Auth.__pnDel=1}}

/* ---------- render + styles ---------- */
function render(){try{if(isHome){homeBanner();settingsHook()}else{gate();panel()}}catch(e){}}
const css=`#pn-panel{margin:1rem 0}.pn-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem}.pn-head h2{font-size:1.1rem;margin:0;color:var(--olive,#0d2b4e)}
.pn-badge{font-size:.75rem;font-weight:800;color:#fff;background:var(--olive-light,#1cb0f6);border-radius:99px;padding:.2rem .6rem}
.pn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.7rem}.pn-grid.locked .pn-card{filter:blur(1.5px);opacity:.75;pointer-events:none}
.pn-card{background:var(--white,#fff);border:1px solid var(--border,#e2ebf4);border-radius:12px;padding:.9rem 1rem}.pn-card small{font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.7rem;color:var(--muted,#6b7c93)}
.pn-big{font-size:2rem;font-weight:900;margin:.2rem 0;color:var(--olive,#0d2b4e)}.pn-big.ok{color:#1a7f37}.pn-big.mid{color:#b7791f}.pn-big.no{color:#c0392b}.pn-sub{font-size:.85rem;margin:.2rem 0 .5rem;color:var(--ink-mid,#334)}
.pn-btn,.pn-cta{font:inherit;font-weight:800;border:0;border-radius:10px;cursor:pointer;background:var(--olive,#0d2b4e);color:#fff;padding:.55rem .9rem}.pn-btn:disabled,.pn-cta:disabled{opacity:.5;cursor:default}
.pn-link{background:none;border:0;color:var(--olive-light,#1479b8);font:inherit;font-size:.8rem;cursor:pointer;padding:0;text-decoration:underline}
.pn-row{display:flex;gap:.5rem;flex-wrap:wrap}.pn-row input{font:inherit;padding:.45rem;border:1px solid var(--border,#ccd);border-radius:8px}
.pn-tasks{list-style:none;padding:0;margin:.3rem 0;font-size:.85rem}.pn-tasks li{padding:.15rem 0}.pn-tasks li.done{color:#1a7f37;text-decoration:line-through}
.pn-unlock{display:block;width:100%;margin-top:.6rem;font:inherit;font-weight:800;padding:.7rem;border-radius:10px;border:2px dashed var(--olive-light,#1cb0f6);background:var(--olive-pale,#eaf6fe);color:var(--olive,#0d2b4e);cursor:pointer}
.pn-note{font-size:.85rem;background:var(--olive-pale,#eaf6fe);border-radius:10px;padding:.6rem .8rem}
.pn-ov{position:fixed;inset:0;background:rgba(10,20,35,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
.pn-box{position:relative;background:#fff;color:#1f2d3d;border-radius:18px;max-width:30rem;width:100%;padding:1.6rem 1.4rem;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:92vh;overflow:auto}
.pn-box h2{margin:.2rem 0 .4rem;font-size:1.4rem;color:#0d2b4e}.pn-x{position:absolute;top:.6rem;right:.7rem;border:0;background:none;font-size:1.1rem;cursor:pointer}
.pn-kick{font-size:.72rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#1479b8}.pn-price{margin:.2rem 0 .8rem}
.pn-feat{list-style:none;padding:0;margin:0 0 1rem}.pn-feat li{display:flex;gap:.7rem;padding:.45rem 0;border-bottom:1px solid #eef2f7}.pn-feat span{font-size:1.3rem}.pn-feat small{display:block;color:#6b7c93}
.pn-box .pn-cta{width:100%;padding:.85rem;font-size:1rem;background:#1a7f37}.pn-fine{font-size:.75rem;color:#6b7c93;margin:.7rem 0 0}.pn-msg{font-size:.85rem;margin-top:.5rem}
#pn-banner{padding:1.5rem 0}#pn-banner .pn-wrap{max-width:72rem;margin:0 auto;padding:1.4rem 1.6rem;display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap;background:linear-gradient(135deg,#0d2b4e,#1479b8);color:#fff;border-radius:18px}
#pn-banner h2{margin:.2rem 0;font-size:1.4rem}#pn-banner p{margin:0;max-width:44rem;opacity:.95}#pn-banner .pn-kick{color:#9fd8ff}#pn-banner .pn-cta{background:#ffd23f;color:#0d2b4e;padding:.8rem 1.3rem;font-size:1rem}
.pn-report h3{margin:0 0 .5rem}.pn-report h4{margin:.8rem 0 .3rem}.pn-report.locked table,.pn-report.locked .pn-pri,.pn-report.locked h4{filter:blur(3px);pointer-events:none;user-select:none}
.pn-rt{width:100%;border-collapse:collapse;font-size:.88rem}.pn-rt th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#6b7c93);padding:.3rem .4rem}.pn-rt td{padding:.4rem;border-top:1px solid var(--border,#e2ebf4);vertical-align:middle}.pn-rt td:last-child{width:34%}
.pn-bar{position:relative;height:10px;background:var(--cream-dark,#eef2f7);border-radius:99px}.pn-bar i{display:block;height:100%;border-radius:99px}.pn-bar em{position:absolute;top:-3px;bottom:-3px;width:2px;background:#1f2d3d}
.pn-pri{list-style:none;padding:0;margin:0}.pn-pri li{display:flex;justify-content:space-between;gap:.5rem;align-items:center;flex-wrap:wrap;padding:.45rem 0;border-top:1px solid var(--border,#e2ebf4);font-size:.9rem}.pn-pri span{display:flex;gap:.4rem}
.pn-btn.sm{padding:.35rem .6rem;font-size:.8rem}.pn-btn.ghost{background:transparent;color:var(--olive,#0d2b4e);border:2px solid var(--border,#ccd)}
.pn-wide{max-width:36rem}.pn-box fieldset{border:0;padding:0;margin:0 0 .8rem}.pn-box legend{font-weight:800;margin-bottom:.3rem}.pn-secs{display:grid;gap:.25rem;max-height:14rem;overflow:auto;border:1px solid #e2ebf4;border-radius:10px;padding:.5rem}.pn-secs small{color:#6b7c93}
.pn-pill{border:1px solid #d5dfea;border-radius:99px;padding:.3rem .7rem;font-size:.88rem;cursor:pointer}.pn-chk{display:block;margin:.2rem 0 .8rem}
.pn-fc{max-width:34rem}.pn-fchead{display:flex;justify-content:space-between;align-items:center;margin:0 1.6rem .6rem 0}.pn-face{font-size:1.15rem;font-weight:800;line-height:1.45;min-height:5rem;padding:.6rem 0}
.pn-back{border-top:2px dashed #e2ebf4;padding:.8rem 0;line-height:1.5}.pn-rate{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem}.pn-r{border:0;border-radius:10px;padding:.55rem .2rem;cursor:pointer;color:#fff;font:inherit}.pn-r small{display:block;font-size:.7rem;opacity:.9}
.pn-r.again{background:#c0392b}.pn-r.hard{background:#b7791f}.pn-r.good{background:#1a7f37}.pn-r.easy{background:#1479b8}
@media(max-width:760px){.pn-grid{grid-template-columns:1fr}.pn-rt td:last-child{display:none}}`;
function boot(){if(!$('pn-css')){const s=document.createElement('style');s.id='pn-css';s.textContent=css;document.head.appendChild(s)}
 render();refresh();
 const q=new URLSearchParams(location.search);if(q.get('checkout')==='success'){let n=0;const t=setInterval(async()=>{await refresh();if(isPremium()||++n>10){clearInterval(t);if(isPremium())alertBox('Welcome to All-Access!','Your free trial has started. Unlimited real exams, score reports, flashcards, custom quizzes, readiness scores, weak-spot reviews and study plans are now unlocked on every exam page.')}},2000)}
 if(sb)try{sb.auth.onAuthStateChange(()=>{refresh();const a=ls.get('pn-after-login');if(a==='subscribe'){session().then(s=>{if(s){ls.del('pn-after-login');paywall()}})}})}catch(e){}
 window.addEventListener('focus',()=>render())}
window.Premium={isPremium,paywall,close,checkout,portal,startWeak,setPlan,refresh,study,customBuilder,startCustom,customFor,flashcards,fcFlip:fcDoFlip,fcRate,
 report:id=>{try{ExamApp.open();ExamApp.show(id)}catch(e){}},_readiness:readiness,_weak:weakList,_deck:deck,_fc:fcCounts,
 _debug:/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?s=>{sub={s:s||'none',end:null};render()}:undefined};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
