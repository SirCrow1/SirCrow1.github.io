/* SUFFERENCE: wager quizzes + live trivia duels. Needs wager-setup.sql run once in Supabase,
   and account-v14.js (exposes window.SUFF_SB and window.SUFF_claimGold). */
(function(){
// 30 moves. The order MUST match the damage table in wager-setup.sql (_duel_tick). [name, damage]
const MOVES=[['Jab',6],['Quick Slash',8],['Dagger Stab',8],['Shield Bash',9],['Roundhouse',7],['Fireball',14],['Frost Shard',12],['Lightning Bolt',15],['Poison Dart',10],['Mace Smash',11],
 ['Arrow Volley',12],['Knife Throw',9],['Holy Smite',16],['Meteor Strike',22],['Backstab',18],['Whirlwind',13],['Hammer Slam',17],['Vampire Bite',12],['Chain Whip',10],['Boulder Toss',15],
 ['Soul Drain',14],['Thunderclap',13],['Spear Thrust',11],['Cursed Hex',12],['Dragon Breath',20],['Shadow Strike',16],['Radiant Beam',18],['Earthquake',19],['Executioner',24],['Sufference',25]];
const ERR={not_logged_in:'Sign in first (👤 Account).',no_such_player:'No player with that name.',self:"You can't pick yourself.",bad_amount:'Check the gold amounts.',bad_pass:'Pass mark must be 1-100%.',
 bad_time:'Time limit must be 5-300 seconds (or empty).',too_many:'Too many open quizzes (max 10, or 3 for the same player).',bad_questions:'Those questions could not be used.',banned:'This account is banned.',
 not_found:'Not found.',closed:'That one is already over.',late:'Too late.',already_in_duel:'You are already in a duel.',own_duel:"That's your own duel.",not_invited:'That duel is for someone else.',wrong_round:'Round already moved on.'};
const $=s=>document.querySelector(s);
const say=m=>{try{toast(m)}catch(e){alert(m)}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb=null,modal=null,tab='inbox',Q=null,D=null,qTimer=0,dPoll=0,dTick=0,busy=false;

const setGold=d=>{S.gold=Math.max(0,(S.gold|0)+d);save();try{shopGold()}catch(e){}try{shopRender()}catch(e){}};
const collect=()=>{try{window.SUFF_claimGold&&window.SUFF_claimGold()}catch(e){}};
const errMsg=c=>ERR[c]||('Error: '+c);
async function rpc(fn,args,quiet){const {data,error}=await sb.rpc(fn,args||{});if(error){if(!quiet)say('⚠️ '+(/function .* does not exist|schema cache/i.test(error.message)?'Run wager-setup.sql in Supabase first.':error.message));return null}return data}
async function loggedIn(){try{const {data}=await sb.auth.getSession();return !!(data&&data.session)}catch(e){return false}}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

// ---------- turn a deck question into something the server accepts ----------
function conv(q){
  try{
    const t=q&&q.t,txt=String(q.q||'').trim().slice(0,300);if(!txt)return null;
    if(t==='mc'&&Array.isArray(q.o)&&q.o.length>=2&&q.o.length<=6&&Number.isInteger(q.a)&&q.a>=0&&q.a<q.o.length&&q.o.every(x=>String(x).trim()))
      return{t:'mc',q:txt,o:q.o.map(x=>String(x).trim().slice(0,120)),a:q.a};
    if(t==='tf'&&typeof q.a==='boolean')return{t:'tf',q:txt,a:q.a};
    if(t==='fb'&&Array.isArray(q.o)&&q.o[0]){
      const ans=[q.o[0]].concat(Array.isArray(q.alt)?q.alt:[]).map(x=>String(x).trim().slice(0,60)).filter(Boolean).slice(0,8);
      if(ans.length)return{t:'fb',q:txt,ans};
    }
  }catch(e){}
  return null;
}
function pool(deck,types){
  const seen={},out=[];
  [].concat(deck.qs||[],deck.bonus||[]).forEach(q=>{const c=conv(q);if(c&&types.includes(c.t)&&!seen[c.q]){seen[c.q]=1;out.push(c)}});
  return out;
}
const deckOpts=()=>S.decks.map((d,i)=>`<option value="${i}" ${i==S.deck?'selected':''}>${esc(d.name)}</option>`).join('');
const typeBoxes=p=>`<label class="wg-ck"><input type="checkbox" id="${p}-mc" checked> Multiple choice</label><label class="wg-ck"><input type="checkbox" id="${p}-tf" checked> True/False</label><label class="wg-ck"><input type="checkbox" id="${p}-fb" checked> Fill the blank</label>`;
const pickTypes=p=>['mc','tf','fb'].filter(k=>$('#'+p+'-'+k).checked);

// ---------- UI shell ----------
const STYLE=`<style>
#wg-modal button{cursor:pointer}
.wg-b{color:#fff;font-weight:700;padding:7px 14px;border-radius:6px;border:1px solid #0004}
.wg-g{background:#15803d}.wg-r{background:#b91c1c}.wg-y{background:#a16207}.wg-z{background:#3f3f46}.wg-p{background:#6d28d9}
.wg-in{width:100%;padding:7px 8px;border-radius:6px;background:#0b0912;border:1px solid #3f3f46;color:#fff;font:14px sans-serif}
.wg-lb{display:block;font-size:11px;letter-spacing:.06em;color:#a1a1aa;margin:8px 0 3px}
.wg-ck{display:inline-flex;align-items:center;gap:5px;margin:0 12px 0 0;font-size:13px}
.wg-card{background:#0b0912;border:1px solid #2f2a3d;border-radius:8px;padding:9px 11px;margin:7px 0}
.wg-tab{padding:6px 12px;border-radius:6px 6px 0 0;background:#1c1726;color:#a1a1aa;border:1px solid #2f2a3d;border-bottom:0}
.wg-tab.on{background:#2a2140;color:#fcd34d}
.wg-opt{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border-radius:8px;background:#1c1726;border:1px solid #4b4363;color:#fff;font:15px sans-serif}
.wg-opt:hover{background:#2a2140;border-color:#a78bfa}.wg-opt[disabled]{opacity:.5;cursor:default}
.wg-bar{height:14px;border-radius:7px;background:#27272a;overflow:hidden;border:1px solid #0008}
.wg-bar>i{display:block;height:100%;transition:width .6s}
.wg-hit{animation:wgHit .5s}
@keyframes wgHit{0%,100%{transform:none}20%{transform:translateX(-6px);filter:brightness(2)}60%{transform:translateX(5px)}}
.wg-feed{font-size:12px;line-height:1.5;color:#d4d4d8;max-height:150px;overflow:auto}
.wg-s{font-size:11px;padding:1px 7px;border-radius:99px;border:1px solid #fff3}
</style>`;
const MODAL=`<div id="wg-modal" style="display:none;position:fixed;inset:0;z-index:85;align-items:center;justify-content:center;background:rgba(0,0,0,.7);overflow:auto">
<div style="background:#14101c;border:2px solid #a78bfa;border-radius:10px;padding:16px 18px;width:min(94vw,520px);max-height:92vh;overflow:auto;color:#e6dcc0;font:14px sans-serif">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font:900 20px Cinzel,serif;color:#c4b5fd">⚔️ Wagers &amp; Duels</div><button id="wg-x" class="wg-b wg-z">✕</button></div>
<div style="display:flex;gap:4px"><button class="wg-tab" data-tab="inbox">📬 Inbox</button><button class="wg-tab" data-tab="send">📨 Send quiz</button><button class="wg-tab" data-tab="duel">🥊 Duel</button></div>
<div id="wg-body" style="border:1px solid #2f2a3d;border-radius:0 8px 8px 8px;padding:10px 12px;background:#1a1526"></div>
</div></div>`;
const view=h=>{const b=$('#wg-body');if(b)b.innerHTML=h};
const body=()=>$('#wg-body');

// shop items (orb, favour, shield, key...) are banned while a wager quiz or a live duel is running
const itemsBanned=()=>!!(Q||(D&&!D.over));
function banItems(){
  try{const u=window.useItem;if(typeof u!=='function'||u.__wg)return;
    const w=function(){if(itemsBanned()){say('🚫 Items are banned in duels and wagers.');return}return u.apply(this,arguments)};w.__wg=1;window.useItem=w}catch(e){}
}
function init(){
  sb=window.SUFF_SB;banItems();setInterval(banItems,3000);
  // lives in the main menu next to Dungeon / Armory / Gallery (full-width, so the grid stays symmetrical)
  let b=$('#wgnav');
  if(!b){const acct=$('#acctbtn');b=document.createElement('button');b.id='wgnav';b.type='button';b.textContent='⚔️ Wagers & Duels';b.className=acct.className;acct.parentNode.insertBefore(b,acct)}

  document.body.insertAdjacentHTML('beforeend',STYLE+MODAL);
  modal=$('#wg-modal');
  $('#wg-x').addEventListener('click',close);
  ['mousedown','keydown','keyup','keypress'].forEach(ev=>modal.addEventListener(ev,e=>e.stopPropagation()));
  modal.addEventListener('click',onClick);
  modal.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='wg-fb'){e.preventDefault();answerFb()}if(e.key==='Enter'&&e.target.id==='dfb'){e.preventDefault();duelFb()}});
  setTimeout(badge,4000);setInterval(badge,60000);
}
async function badge(){
  try{if(!await loggedIn())return;const r=await rpc('challenge_list',null,true);if(!r)return;
    const n=(r.incoming||[]).filter(c=>c.status==='pending').length;$('#wgnav').textContent='⚔️ Wagers & Duels'+(n?' ('+n+' new)':'');}catch(e){}
}
async function open(){
  modal.style.display='flex';
  if(!await loggedIn()){tab='inbox';mark();view('<div style="padding:14px;text-align:center">Sign in with Google first (👤 Account) to send quizzes and duel other players.</div>');return}
  collect();go(tab);
}
function close(){modal.style.display='none';clearInterval(dPoll);clearInterval(dTick);clearInterval(qTimer)}
const mark=()=>modal.querySelectorAll('.wg-tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));
function go(t){
  tab=t;mark();clearInterval(dPoll);clearInterval(dTick);
  if(Q){showQ();return}
  if(t==='inbox')inbox();else if(t==='send')sendForm();else duelHome();
}

// ---------- INBOX ----------
const STAT={pending:['⏳ waiting','#fcd34d'],active:['▶ in progress','#93c5fd'],passed:['✅ passed','#86efac'],failed:['❌ failed','#fca5a5'],declined:['🚫 declined','#a1a1aa'],cancelled:['🚫 cancelled','#a1a1aa'],expired:['⌛ expired','#a1a1aa'],forfeit:['💤 timed out','#fca5a5']};
const chip=s=>{const c=STAT[s]||[s,'#ccc'];return`<span class="wg-s" style="color:${c[1]}">${c[0]}</span>`};
const rules=c=>`${c.n} question${c.n==1?'':'s'} · pass at ${c.pass_pct}%${c.secs_per_q?' · '+c.secs_per_q+'s each':' · no time limit'}`;
async function inbox(){
  view('Loading…');
  const r=await rpc('challenge_list');if(!r||tab!=='inbox')return;
  collect();
  const inc=(r.incoming||[]).map(c=>{
    let act='';
    if(c.status==='pending')act=`<button class="wg-b wg-g" data-act="play" data-id="${c.id}" data-stake="${c.stake}">Accept &amp; play</button> <button class="wg-b wg-z" data-act="close" data-id="${c.id}">Decline</button>`;
    else if(c.status==='active')act=`<button class="wg-b wg-y" data-act="play" data-id="${c.id}" data-stake="0">Resume</button>`;
    const res=c.total!=null?` · scored ${c.correct}/${c.total}`:'';
    return`<div class="wg-card"><div><b>${esc(c.who)}</b> sent <b>${esc(c.title)}</b> ${chip(c.status)}</div>
      <div style="font-size:12px;color:#a1a1aa">${rules(c)}${res}</div>
      <div style="margin:4px 0">You risk <b style="color:#fca5a5">🪙${c.stake}</b> · pass and you win <b style="color:#86efac">🪙${c.payout}</b></div>${act}</div>`}).join('')||'<div style="color:#71717a;font-size:13px">Nothing received yet.</div>';
  const out=(r.outgoing||[]).map(c=>{
    const act=c.status==='pending'?`<button class="wg-b wg-z" data-act="close" data-id="${c.id}">Cancel &amp; refund</button>`:'';
    const res=c.total!=null?` · they scored ${c.correct}/${c.total}`:'';
    return`<div class="wg-card"><div>To <b>${esc(c.who)}</b>: <b>${esc(c.title)}</b> ${chip(c.status)}</div>
      <div style="font-size:12px;color:#a1a1aa">${rules(c)}${res}</div>
      <div style="margin:4px 0">You risk <b style="color:#fca5a5">🪙${c.payout}</b> · they risk <b style="color:#86efac">🪙${c.stake}</b></div>${act}</div>`}).join('')||'<div style="color:#71717a;font-size:13px">Nothing sent yet.</div>';
  view(`<div style="display:flex;justify-content:space-between"><b style="color:#fcd34d">Received</b><button class="wg-b wg-z" data-act="refresh">↻ Refresh</button></div>${inc}<b style="color:#fcd34d;display:block;margin-top:12px">Sent</b>${out}
    <div style="font-size:11px;color:#71717a;margin-top:10px">Unanswered quizzes expire after 3 days and your gold is refunded.</div>`);
  badge();
}

// ---------- SEND A QUIZ ----------
function sendForm(){
  view(`<div style="font-size:12px;color:#fca5a5">🚫 Items are banned while a wager quiz is running.</div><div style="font-size:12px;color:#a1a1aa">Pick a deck and a player. If they score at least the pass mark they win gold from you; if they miss it, you win their stake.</div>
  <label class="wg-lb">SEND TO (exact player name)</label><input id="wg-to" class="wg-in" maxlength="16" placeholder="Player_1234abcd">
  <label class="wg-lb">DECK</label><select id="wg-deck" class="wg-in">${deckOpts()}</select>
  <label class="wg-lb">QUESTION TYPES</label><div>${typeBoxes('wg-t')}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
   <div><label class="wg-lb">HOW MANY QUESTIONS</label><input id="wg-n" class="wg-in" type="number" min="1" max="30" value="10"></div>
   <div><label class="wg-lb">PASS MARK (%)</label><input id="wg-pass" class="wg-in" type="number" min="1" max="100" value="70"></div>
   <div><label class="wg-lb">THEIR STAKE 🪙 (they lose it if they fail)</label><input id="wg-stake" class="wg-in" type="number" min="0" value="50"></div>
   <div><label class="wg-lb">🎲 ODDS (you pay stake × this if they pass)</label><select id="wg-mult" class="wg-in"><option value="1">×1 even</option><option value="2">×2</option><option value="3">×3</option><option value="5">×5 risky</option></select></div>
   <div><label class="wg-lb">SECONDS PER QUESTION (empty = none)</label><input id="wg-secs" class="wg-in" type="number" min="5" max="300" placeholder="none"></div>
   <div><label class="wg-lb">TITLE</label><input id="wg-title" class="wg-in" maxlength="40" value="Quiz"></div>
  </div>
  <div id="wg-sum" style="margin:10px 0;padding:8px;border-radius:6px;background:#0b0912;font-size:13px"></div>
  <button class="wg-b wg-p" data-act="send">📨 Send quiz</button>`);
  ['wg-stake','wg-mult','wg-pass','wg-n'].forEach(id=>$('#'+id).addEventListener('input',sumSend));
  sumSend();
}
function sumSend(){
  const s=Math.max(0,Math.floor(+$('#wg-stake').value||0)),m=+$('#wg-mult').value,p=s*m;
  $('#wg-sum').innerHTML=`They risk <b style="color:#fca5a5">🪙${s}</b>. If they score ≥ ${+$('#wg-pass').value||0}% they win <b style="color:#86efac">🪙${p}</b> from you, otherwise you win <b style="color:#86efac">🪙${s}</b>. <br>You pay <b>🪙${p}</b> now (held safely, refunded if they decline). You have 🪙${S.gold|0}.`;
}
async function sendQuiz(){
  if(busy)return;
  const to=$('#wg-to').value.trim(),deck=S.decks[+$('#wg-deck').value],n=Math.floor(+$('#wg-n').value||0),pass=Math.floor(+$('#wg-pass').value||0),
    stake=Math.max(0,Math.floor(+$('#wg-stake').value||0)),mult=+$('#wg-mult').value,payout=stake*mult,secsV=$('#wg-secs').value.trim(),secs=secsV?Math.floor(+secsV):null,title=$('#wg-title').value.trim()||'Quiz';
  const types=pickTypes('wg-t');
  if(!to)return say('Type the player name.');
  if(!deck||!types.length)return say('Pick a deck and at least one question type.');
  if(pass<1||pass>100)return say('Pass mark must be 1-100%.');
  if(!stake)return say('Set a stake above 0.');
  if(payout>(S.gold|0))return say("You don't have 🪙"+payout+' to cover that.');
  const qs=shuffle(pool(deck,types)).slice(0,Math.max(1,Math.min(30,n)));
  if(!qs.length)return say('That deck has no usable questions of those types.');
  busy=true;
  const r=await rpc('challenge_create',{p_target:to,p_title:title,p_questions:qs,p_stake:stake,p_payout:payout,p_pass:pass,p_secs:secs});
  busy=false;
  if(r==null)return;
  if(typeof r==='string'&&r.indexOf('ok')===0){setGold(-payout);say('📨 Quiz sent to '+to+'!');go('inbox')}
  else say(errMsg(r));
}
async function closeCh(id){
  const r=await rpc('challenge_close',{p_id:id});
  if(r==='ok'){collect();say('Done. Any gold you put in is coming back.')}else if(r)say(errMsg(r));
  inbox();
}

// ---------- PLAY A RECEIVED QUIZ ----------
async function play(id,stake){
  if(busy)return;
  if(stake>0&&(S.gold|0)<stake)return say('You need 🪙'+stake+' to accept this.');
  busy=true;const r=await rpc('challenge_play',{p_id:id});busy=false;
  if(!r)return;
  if(!r.ok){say(errMsg(r.err));return inbox()}
  if(r.fresh&&r.stake>0)setGold(-r.stake);
  Q={id:r.id,title:r.title,qs:r.questions,i:0,ans:[],secs:r.secs,pass:r.pass,stake:r.stake,payout:r.payout};
  showQ();
}
function showQ(){
  clearInterval(qTimer);
  const q=Q.qs[Q.i];let inp;
  if(q.t==='mc')inp=q.o.map((o,i)=>`<button class="wg-opt" data-act="qa" data-v="${i}">${'ABCDEF'[i]}. ${esc(o)}</button>`).join('');
  else if(q.t==='tf')inp='<button class="wg-opt" data-act="qa" data-v="true">✅ True</button><button class="wg-opt" data-act="qa" data-v="false">❌ False</button>';
  else inp='<input id="wg-fb" class="wg-in" placeholder="Type your answer…" autocomplete="off"><button class="wg-b wg-g" style="margin-top:8px" data-act="qfb">Submit</button>';
  view(`<div style="display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa"><span>${esc(Q.title)} · question ${Q.i+1}/${Q.qs.length}</span><span>🪙${Q.stake} at risk · pass ${Q.pass}%</span></div>
   ${Q.secs?'<div class="wg-bar" style="margin:6px 0"><i id="wg-tb" style="width:100%;background:#fbbf24;transition:width .15s linear"></i></div>':''}
   <div style="font:700 17px sans-serif;margin:10px 0;color:#fff">${esc(q.q)}</div>${inp}
   <div style="margin-top:8px"><button class="wg-b wg-z" data-act="qskip">Skip</button></div>`);
  if(q.t==='fb'){const f=$('#wg-fb');if(f)f.focus()}
  if(Q.secs){
    Q.end=Date.now()+Q.secs*1000;
    qTimer=setInterval(()=>{const l=Q.end-Date.now(),b=$('#wg-tb');if(b)b.style.width=Math.max(0,l/(Q.secs*10))+'%';if(l<=0){clearInterval(qTimer);nextQ(null)}},150);
  }
}
function nextQ(v){
  if(!Q)return;
  clearInterval(qTimer);
  Q.ans.push(v===undefined?null:v);
  if(++Q.i>=Q.qs.length)finishQ();else showQ();
}
function answerFb(){const f=$('#wg-fb');if(!f)return;nextQ(f.value.trim()||null)}
async function finishQ(){
  const q=Q;view('Grading…');
  const r=await rpc('challenge_submit',{p_id:q.id,p_answers:q.ans});
  Q=null;
  if(!r){view('<button class="wg-b wg-z" data-act="refresh">Back</button>');return}
  if(!r.ok){say(errMsg(r.err));return inbox()}
  collect();
  const rev=(r.review||[]).map(x=>`<div style="font-size:12px;margin:4px 0;color:${x.ok?'#86efac':'#fca5a5'}">${x.ok?'✔':'✘'} ${esc(x.q)} <span style="color:#a1a1aa">→ ${esc(x.ans)}</span></div>`).join('');
  view(`<div style="text-align:center;padding:8px"><div style="font:900 22px Cinzel,serif;color:${r.passed?'#86efac':'#fca5a5'}">${r.passed?'🏆 PASSED':'💀 FAILED'}</div>
   <div style="margin:6px 0">You scored <b>${r.correct}/${r.total}</b> (${r.pct}%) · needed ${r.pass}%</div>
   <div style="font-size:16px">${r.passed?`You won <b style="color:#86efac">🪙${r.gain}</b> and got your stake back.`:`You lost <b style="color:#fca5a5">🪙${-r.gain}</b>.`}</div></div>
   <div class="wg-card">${rev}</div><button class="wg-b wg-z" data-act="back">Back to inbox</button>`);
}

// ---------- LIVE DUELS ----------
async function duelHome(){
  view('Loading…');
  const r=await rpc('duel_lobby');if(!r||tab!=='duel')return;
  collect();
  if(r.mine){startDuel(r.mine);return}
  D=null;
  const open=(r.open||[]).map(d=>`<div class="wg-card"><b>${esc(d.who)}</b> · ${esc(d.title)} ${d.invited?'<span class="wg-s" style="color:#fcd34d">invited you</span>':''}
    <div style="font-size:12px;color:#a1a1aa">${d.n} questions · ${d.secs}s each · winner takes 🪙${d.stake*2}</div>${gearLine(d.gear,d.bonus)}
    <button class="wg-b wg-g" style="margin-top:5px" data-act="djoin" data-id="${d.id}" data-stake="${d.stake}">⚔️ Fight! (🪙${d.stake})</button></div>`).join('')||'<div style="color:#71717a;font-size:13px">No open duels right now. Host one!</div>';
  view(`<div style="display:flex;justify-content:space-between"><b style="color:#fcd34d">Open duels</b><button class="wg-b wg-z" data-act="refresh">↻ Refresh</button></div>${open}
   <b style="color:#fcd34d;display:block;margin-top:14px">Host a duel</b>
   <div style="font-size:12px;color:#a1a1aa">Both players answer the same questions. Every right answer casts one of 30 moves at the other player (the faster right answer gets +5). 100 HP each, winner takes the whole pot. <b style="color:#c4b5fd">🚫 Items (orbs, favours, shields, keys) are banned. Your own gear counts:</b> blade = extra damage, armour = less damage taken, pet = heals you every round. You are wearing: ${esc([gn('WPNS',gearNow().wpn),gn('SKINS',gearNow().skin),gn('PETS',gearNow().pet)].filter(Boolean).join(', ')||'nothing')}.</div>
   <label class="wg-lb">DECK</label><select id="dd-deck" class="wg-in">${deckOpts()}</select>
   <label class="wg-lb">QUESTION TYPES</label><div>${typeBoxes('dd-t')}</div>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label class="wg-lb">ROUNDS (3-30)</label><input id="dd-n" class="wg-in" type="number" min="3" max="30" value="12"></div>
    <div><label class="wg-lb">SECONDS PER QUESTION</label><input id="dd-secs" class="wg-in" type="number" min="5" max="60" value="15"></div>
    <div><label class="wg-lb">STAKE EACH 🪙</label><input id="dd-stake" class="wg-in" type="number" min="0" value="50"></div>
    <div><label class="wg-lb">INVITE (optional name)</label><input id="dd-inv" class="wg-in" maxlength="16" placeholder="anyone can join"></div>
   </div>
   <button class="wg-b wg-p" style="margin-top:10px" data-act="dcreate">🥊 Host duel</button>`);
}
async function createDuel(){
  if(busy)return;
  const deck=S.decks[+$('#dd-deck').value],types=pickTypes('dd-t'),n=Math.floor(+$('#dd-n').value||0),secs=Math.floor(+$('#dd-secs').value||0),
    stake=Math.max(0,Math.floor(+$('#dd-stake').value||0)),inv=$('#dd-inv').value.trim();
  if(!deck||!types.length)return say('Pick a deck and at least one question type.');
  if(secs<5||secs>60)return say('Seconds per question: 5-60.');
  if(stake>(S.gold|0))return say("You don't have 🪙"+stake+'.');
  const qs=shuffle(pool(deck,types)).slice(0,Math.max(3,Math.min(30,n)));
  if(qs.length<3)return say('Need at least 3 usable questions in that deck.');
  busy=true;await syncGear();
  const r=await rpc('duel_create',{p_title:deck.name.slice(0,40),p_questions:qs,p_stake:stake,p_secs:secs,p_invite:inv});
  busy=false;
  if(r==null)return;
  if(typeof r==='string'&&r.indexOf('ok:')===0){setGold(-stake);startDuel(r.slice(3))}else say(errMsg(r));
}
async function joinDuel(id,stake){
  if(busy)return;
  if(stake>(S.gold|0))return say('You need 🪙'+stake+' to join.');
  busy=true;await syncGear();const r=await rpc('duel_join',{p_id:id});busy=false;
  if(r==='ok'){setGold(-stake);startDuel(id)}else if(r){say(errMsg(r));duelHome()}
}
function startDuel(id){
  if(!D||D.id!==id)D={id,seen:0,rnd:-1,feed:[],hp:[100,100],built:false,paid:false,answered:false,deadline:0,me:0,over:false};
  D.built=false;tab='duel';mark();
  clearInterval(dPoll);clearInterval(dTick);
  dPoll=setInterval(pollDuel,1100);dTick=setInterval(tickDuel,200);pollDuel();
}
let polling=false;
async function pollDuel(){
  if(!D||polling)return;
  polling=true;
  try{
    const {data:st,error}=await sb.rpc('duel_state',{p_id:D.id});
    if(error||!st||!D)return;
    if(!st.ok){say(errMsg(st.err));D=null;clearInterval(dPoll);clearInterval(dTick);duelHome();return}
    renderDuel(st);
  }catch(e){}finally{polling=false}
}
function tickDuel(){
  const t=$('#dtm');if(!t||!D||D.over)return;
  t.textContent='⏱ '+Math.max(0,(D.deadline-performance.now())/1000).toFixed(1)+'s';
}
// ---------- own gear (pet / armour / blade) ----------
const gn=(T,k)=>{try{return (k&&window.eval(T)[k]||{}).n||''}catch(e){return ''}};
const gearNow=()=>{const e=(typeof S!=='undefined'&&S.shop&&S.shop.eq)||{};return e};
async function syncGear(){const e=gearNow();await rpc('duel_set_gear',{p_pet:e.pet||null,p_skin:e.skin||null,p_blade:e.wpn||null},true)}
function gearLine(g,b){
  if(!g||!b)return '';const p=[];
  if(b[0])p.push((gn('WPNS',g.blade)||'Blade')+' +'+b[0]+' dmg');
  if(b[1])p.push((gn('SKINS',g.skin)||'Armour')+' -'+b[1]+' taken');
  if(b[2])p.push((gn('PETS',g.pet)||'Pet')+' +'+b[2]+' HP/round');
  return p.length?'<div style="font-size:11px;color:#c4b5fd">'+p.map(esc).join(' · ')+'</div>':'<div style="font-size:11px;color:#71717a">no gear equipped</div>';
}
const mv=x=>MOVES[x.mv-1]||['???',0];
function logLine(e,me,opN){
  const a=e['p'+me],b=e['p'+(3-me)];
  return`<div>R${e.r+1} · answer: <b>${esc(e.ans)}</b> — ${a.ok?`🗡️ you cast <b>${mv(a)[0]}</b> <span style="color:#86efac">(-${a.dmg})</span>`:'❌ you missed'} · ${b.ok?`💥 ${esc(opN)} cast <b>${mv(b)[0]}</b> <span style="color:#fca5a5">(-${b.dmg} to you)</span>`:'🛡️ they missed'}</div>`;
}
function setHp(i,v,old){
  const b=$('#dhb'+i),t=$('#dht'+i);if(!b)return;
  b.style.width=Math.max(0,v)+'%';t.textContent=v+'/100';
  if(v<old){const p=b.parentNode.parentNode;p.classList.remove('wg-hit');void p.offsetWidth;p.classList.add('wg-hit')}
}
function renderDuel(st){
  const me=st.me,opp=3-me,myN=st['p'+me],opN=st['p'+opp]||'…';
  D.me=me;
  if(st.status==='waiting'){
    D.built=false;
    view(`<div style="text-align:center;padding:14px"><div style="font:900 18px Cinzel,serif;color:#fcd34d">Waiting for an opponent…</div>
      <div style="color:#a1a1aa;font-size:13px;margin:6px 0 12px">${esc(st.title)} · ${st.n} rounds · ${st.secs}s each · pot 🪙${st.stake*2}</div>
      <button class="wg-b wg-z" data-act="dcancel">Cancel &amp; refund</button></div>`);
    return;
  }
  if(!D.built){
    view(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><div style="font-weight:700;color:#86efac">${esc(myN)} (you)</div><div class="wg-bar"><i id="dhb1" style="width:100%;background:#22c55e"></i></div><div id="dht1" style="font-size:12px">100/100</div>${gearLine(st['g'+me],st['b'+me])}</div>
      <div><div style="font-weight:700;color:#fca5a5">${esc(opN)}</div><div class="wg-bar"><i id="dhb2" style="width:100%;background:#ef4444"></i></div><div id="dht2" style="font-size:12px">100/100</div>${gearLine(st['g'+opp],st['b'+opp])}</div></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa;margin-top:8px"><span id="dinfo"></span><span id="dtm" style="color:#fcd34d;font-weight:700"></span></div>
      <div id="dq"></div><div id="dst" style="font-size:12px;color:#a1a1aa;min-height:16px;margin-top:6px"></div>
      <div id="df" class="wg-feed" style="margin-top:8px"></div>
      <div style="margin-top:8px" id="dfw"><button class="wg-b wg-r" data-act="dforfeit">🏳️ Forfeit</button></div>`);
    D.built=true;D.rnd=-1;D.hp=[100,100];
    // the feed is kept; it is repainted below
  }
  const mh=st['hp'+me],oh=st['hp'+opp];
  setHp(1,mh,D.hp[0]);setHp(2,oh,D.hp[1]);D.hp=[mh,oh];
  const first=st.logn-st.log.length;
  st.log.forEach((e,k)=>{if(first+k>=D.seen)D.feed.push(logLine(e,me,opN))});
  D.seen=Math.max(D.seen,st.logn);
  $('#df').innerHTML=D.feed.slice(-8).reverse().join('');
  $('#dinfo').textContent='Round '+Math.min(st.rnd+1,st.n)+'/'+st.n+' · pot 🪙'+st.stake*2;
  if(st.status!=='active'){
    D.over=true;clearInterval(dPoll);clearInterval(dTick);
    const R={win:['🏆 VICTORY','#fcd34d','You take 🪙'+st.stake*2+'!'],lose:['💀 DEFEAT','#fca5a5','You lose your 🪙'+st.stake+'.'],draw:['🤝 DRAW','#93c5fd','Both stakes are refunded.'],cancelled:['🚫 Duel cancelled','#a1a1aa','Stakes are refunded.']}[st.result]||['Over','#ccc',''];
    $('#dq').innerHTML=`<div style="text-align:center;padding:12px"><div style="font:900 24px Cinzel,serif;color:${R[1]}">${R[0]}</div><div style="margin:6px 0 12px">${R[2]}</div><button class="wg-b wg-p" data-act="dback">Back to lobby</button></div>`;
    $('#dtm').textContent='';$('#dst').textContent='';$('#dfw').innerHTML='';
    if(!D.paid){D.paid=true;collect()}
    return;
  }
  D.deadline=performance.now()+st.left*1000;
  const meAns=me===1?st.a1:st.a2,opAns=me===1?st.a2:st.a1;
  if(st.rnd!==D.rnd){
    D.rnd=st.rnd;D.answered=!!meAns;
    const q=st.q;let inp;
    if(q.t==='mc')inp=q.o.map((o,i)=>`<button class="wg-opt" data-act="da" data-v="${i}">${'ABCDEF'[i]}. ${esc(o)}</button>`).join('');
    else if(q.t==='tf')inp='<button class="wg-opt" data-act="da" data-v="true">✅ True</button><button class="wg-opt" data-act="da" data-v="false">❌ False</button>';
    else inp='<input id="dfb" class="wg-in" placeholder="Type your answer…" autocomplete="off"><button class="wg-b wg-g" style="margin-top:8px" data-act="dfb">Cast it!</button>';
    $('#dq').innerHTML=`<div style="font:700 17px sans-serif;margin:8px 0;color:#fff">${esc(q.q)}</div>${inp}`;
    if(D.answered)lockDq();else if(q.t==='fb'){const f=$('#dfb');if(f)f.focus()}
  }else if(meAns&&!D.answered){D.answered=true;lockDq()}
  $('#dst').textContent=meAns&&!opAns?'Locked in. Waiting for your opponent…':(opAns&&!meAns?'⚡ Your opponent already answered!':'');
}
function lockDq(){modal.querySelectorAll('#dq button,#dq input').forEach(b=>b.disabled=true)}
async function duelAnswer(v){
  if(!D||D.answered||D.over)return;
  D.answered=true;lockDq();
  await rpc('duel_answer',{p_id:D.id,p_rnd:D.rnd,p_ans:v},true);
  pollDuel();
}
function duelFb(){const f=$('#dfb');if(!f||f.disabled)return;duelAnswer(f.value.trim()||'')}

// ---------- clicks ----------
async function onClick(e){
  const t=e.target.closest('[data-tab],[data-act]');if(!t)return;
  if(t.dataset.tab){go(t.dataset.tab);return}
  const a=t.dataset.act,id=t.dataset.id;
  if(a==='refresh')go(tab);
  else if(a==='send')sendQuiz();
  else if(a==='play')play(id,+t.dataset.stake||0);
  else if(a==='close')closeCh(id);
  else if(a==='qa'){const v=t.dataset.v;nextQ(v==='true'?true:v==='false'?false:+v)}
  else if(a==='qfb')answerFb();
  else if(a==='qskip')nextQ(null);
  else if(a==='back'){Q=null;go('inbox')}
  else if(a==='dcreate')createDuel();
  else if(a==='djoin')joinDuel(id,+t.dataset.stake||0);
  else if(a==='da'){const v=t.dataset.v;duelAnswer(v==='true'?true:v==='false'?false:+v)}
  else if(a==='dfb')duelFb();
  else if(a==='dcancel'){const r=await rpc('duel_cancel',{p_id:D&&D.id});if(r==='ok'){collect();say('Duel cancelled. Your stake is coming back.')}else if(r)say(errMsg(r));D=null;go('duel')}
  else if(a==='dforfeit'){if(confirm('Forfeit? Your opponent takes the whole pot.')){const r=await rpc('duel_forfeit',{p_id:D&&D.id});if(r&&r!=='ok')say(errMsg(r));pollDuel()}}
  else if(a==='dback'){D=null;go('duel')}
}

// the big menu button works even before init has finished (delegated, so it never misses)
document.addEventListener('click',e=>{
  const t=e.target&&e.target.closest&&e.target.closest('#wgnav');if(!t)return;
  e.preventDefault();
  if(!modal){say(window.SUFF_SB?'⏳ Wagers are still starting up, try again in a second.':'⚠️ Wagers need the account system: make sure account-v14.js loads (Profile tab), then refresh.');return}
  open();
});
// ---------- boot: wait for account-v14.js to create the Supabase client ----------
const wait=setInterval(()=>{
  if(window.SUFF_SB&&(document.querySelector('#wgnav')||document.querySelector('#acctbtn'))&&typeof S!=='undefined'&&typeof save==='function'){
    clearInterval(wait);try{init()}catch(e){console.error('wager init',e)}
  }
},500);
})();
