/* SUFFERENCE: wager quizzes + live trivia duels. Needs wager-setup.sql run once in Supabase,
   and account-v14.js (exposes window.SUFF_SB and window.SUFF_claimGold). */
(function(){
// 30 moves. The order MUST match the damage table in wager-setup.sql (_duel_tick). [name, damage]
const MOVES=[['Jab',6],['Quick Slash',8],['Dagger Stab',8],['Shield Bash',9],['Roundhouse',7],['Fireball',14],['Frost Shard',12],['Lightning Bolt',15],['Poison Dart',10],['Mace Smash',11],
 ['Arrow Volley',12],['Knife Throw',9],['Holy Smite',16],['Meteor Strike',22],['Backstab',18],['Whirlwind',13],['Hammer Slam',17],['Vampire Bite',12],['Chain Whip',10],['Boulder Toss',15],
 ['Soul Drain',14],['Thunderclap',13],['Spear Thrust',11],['Cursed Hex',12],['Dragon Breath',20],['Shadow Strike',16],['Radiant Beam',18],['Earthquake',19],['Executioner',24],['Sufference',25]];
const ERR={not_logged_in:'Sign in first (👤 Account).',no_such_player:'No player with that name.',self:"You can't pick yourself.",bad_amount:'Check the gold amounts.',bad_pass:'Pass mark must be 1-100%.',
 bad_time:'Time limit must be 5-300 seconds (or empty).',too_many:'Too many open quizzes (max 10, or 3 for the same player).',bad_questions:'Those questions could not be used.',banned:'This account is banned.',
 not_found:'Not found.',full:'That room is full.',not_enough:'Need at least 2 players to start.',not_host:'Only the host can start.',bad_players:'Room size must be 2-10.',not_yours:'You are not in that one.',already:'Already answered.',closed:'That one is already over.',late:'Too late.',already_in_duel:'You are already in a duel.',own_duel:"That's your own duel.",not_invited:'That duel is for someone else.',wrong_round:'Round already moved on.',bad_code:'No open room with that code.',no_gold:"You don't have enough 🪙 for that room.",already_in_room:'You are already in a party room.'};
Object.assign(ERR,{special_used:'You already used your special move this duel.',too_late:'Answer already locked in.',playing:"You can't watch a game you are playing in.",private:'That room is private. Use its room code in the box above.',not_started:'That room has not started yet. Come back when the game begins.'});
const $=s=>document.querySelector(s);
const say=m=>{try{toast(m)}catch(e){alert(m)}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sb=null,modal=null,tab='inbox',Q=null,D=null,GR=null,W=null,gPoll=0,gTick=0,gPolling=false,qTimer=0,dPoll=0,dTick=0,wPoll=0,wTick=0,wPolling=false,busy=false;

const setGold=d=>{S.gold=Math.max(0,(S.gold|0)+d);save();try{shopGold()}catch(e){}try{shopRender()}catch(e){}};
const collect=()=>{try{window.SUFF_claimGold&&window.SUFF_claimGold()}catch(e){}};
const errMsg=c=>ERR[c]||('Error: '+c);
async function rpc(fn,args,quiet){const {data,error}=await sb.rpc(fn,args||{});if(error){if(!quiet)say('⚠️ '+(/function .* does not exist|schema cache/i.test(error.message)?'Run the latest sufference-setup.sql in Supabase first.':error.message));return null}return data}
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
.wg-room{position:relative;margin:8px 0;padding:10px 8px 12px;border-radius:10px;border:2px solid #3b3350;background:repeating-linear-gradient(90deg,#26202f 0 38px,#211b2a 38px 40px),#211b2a;box-shadow:inset 0 0 40px #000}
.wg-room:before{content:'';position:absolute;left:0;right:0;bottom:0;height:22px;background:repeating-linear-gradient(90deg,#3a3148 0 30px,#332a40 30px 32px);border-radius:0 0 8px 8px}
.wg-torch{position:absolute;top:6px;font-size:18px;animation:wgFl 1.2s infinite alternate}.wg-torch.l{left:8px}.wg-torch.r{right:8px}
@keyframes wgFl{from{opacity:.65;transform:scale(.92)}to{opacity:1;transform:scale(1.08)}}
.wg-knights{position:relative;z-index:1;display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;margin:14px 0 8px}
.wg-kn{text-align:center;font-size:11px;color:#d4d4d8;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wg-kn i{display:block;font-style:normal;font-size:28px;filter:drop-shadow(0 0 4px #a78bfa)}
.wg-kn.me i{filter:drop-shadow(0 0 6px #4ade80)}.wg-kn.me{color:#86efac;font-weight:700}
.wg-kn.done i{opacity:.55}
.wg-arena{display:block;width:100%;max-width:460px;margin:8px auto;border-radius:10px;border:2px solid #3b3350;background:#14101c}
.wg-kc{display:block;width:64px;height:60px;margin:0 auto}.wg-kn.done .wg-kc{opacity:.55}.wg-kn.me .wg-kc{filter:drop-shadow(0 0 5px #4ade80)}
.wg-doors{position:relative;z-index:1;display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:6px;padding-bottom:14px}
.wg-door{width:calc(33% - 10px);min-width:92px;max-width:150px;min-height:120px;padding:26px 6px 6px;border-radius:60px 60px 4px 4px;border:3px solid #7c5a2a;background:linear-gradient(#6b4a22,#4a3016);color:#fff;font:700 13px sans-serif;cursor:pointer;position:relative;display:flex;align-items:flex-end;justify-content:center;text-align:center;box-shadow:0 0 0 3px #2b1f10,inset 0 0 18px #000a}
.wg-door:before{content:'';position:absolute;top:14px;left:50%;width:70%;height:34%;transform:translateX(-50%);border-radius:40px 40px 0 0;border:2px solid #3a2810;background:#00000033}
.wg-door:after{content:'';position:absolute;right:10px;top:58%;width:8px;height:8px;border-radius:50%;background:#fbbf24}
.wg-door:hover{border-color:#fbbf24;filter:brightness(1.2)}
.wg-door b{position:absolute;top:6px;left:50%;transform:translateX(-50%);color:#fcd34d;font-size:14px}
.wg-door span{position:relative;z-index:1;background:#000a;padding:3px 5px;border-radius:5px;word-break:break-word}
.wg-door[disabled]{cursor:default;filter:none}.wg-door[disabled]:hover{border-color:#7c5a2a}
.wg-door.pick{border-color:#4ade80;box-shadow:0 0 12px #4ade80,0 0 0 3px #2b1f10}
.wg-lock{position:relative;z-index:1;text-align:center;padding-bottom:14px}
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
<div style="display:flex;gap:4px;flex-wrap:wrap"><button class="wg-tab" data-tab="inbox">📬 Inbox</button><button class="wg-tab" data-tab="send">📨 Send quiz</button><button class="wg-tab" data-tab="duel">🥊 Duel</button><button class="wg-tab" data-tab="group">👥 Group</button><button class="wg-tab" data-tab="watch">👁 Watch</button></div>
<div id="wg-body" style="border:1px solid #2f2a3d;border-radius:0 8px 8px 8px;padding:10px 12px;background:#1a1526"></div>
</div></div>`;
const view=h=>{const b=$('#wg-body');if(b)b.innerHTML=h};
const body=()=>$('#wg-body');

// shop items (orb, favour, shield, key...) are banned while a wager quiz or a live duel is running
const itemsBanned=()=>!!(Q||(D&&!D.over)||(GR&&!GR.over));
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
  if(modal&&!modal._ko){modal._ko=1;try{new MutationObserver(()=>wireKnights(modal)).observe(modal,{childList:true,subtree:true})}catch(e){}}
  $('#wg-x').addEventListener('click',close);
  ['mousedown','keydown','keyup','keypress'].forEach(ev=>modal.addEventListener(ev,e=>e.stopPropagation()));
  modal.addEventListener('click',onClick);
  modal.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='gfb'){e.preventDefault();groupFb()}if(e.key==='Enter'&&e.target.id==='wg-fb'){e.preventDefault();answerFb()}if(e.key==='Enter'&&e.target.id==='dfb'){e.preventDefault();duelFb()}if(e.key==='Enter'&&e.target.id==='wg-wcode'){e.preventDefault();watchByCode()}});
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
function close(){modal.style.display='none';clearInterval(gPoll);clearInterval(gTick);clearInterval(dPoll);clearInterval(dTick);clearInterval(qTimer);clearInterval(wPoll);clearInterval(wTick);W=null}
const mark=()=>modal.querySelectorAll('.wg-tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));
function go(t){
  tab=t;mark();clearInterval(dPoll);clearInterval(dTick);clearInterval(gPoll);clearInterval(gTick);clearInterval(wPoll);clearInterval(wTick);W=null;
  if(Q){showQ();return}
  if(t==='inbox')inbox();else if(t==='send')sendForm();else if(t==='group')groupHome();else if(t==='watch')watchHome();else duelHome();
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
   <div style="text-align:center;margin-top:4px">${kc(myGear())}</div><div style="font:700 17px sans-serif;margin:10px 0;color:#fff">${esc(q.q)}</div>${inp}
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
// ---------- join codes ----------
const codeBox=()=>`<div style="border:1px dashed #a78bfa;border-radius:8px;padding:8px;margin-bottom:10px"><b style="color:#c4b5fd">🔑 Have a room code?</b>
  <div style="display:flex;gap:6px;margin-top:6px"><input id="wg-code" class="wg-in" maxlength="8" placeholder="e.g. K7QX2M" autocomplete="off" style="text-transform:uppercase;letter-spacing:3px;margin:0"><button class="wg-b wg-g" data-act="codejoin">Join</button></div></div>`;
const codeShow=c=>c?`<div style="margin:10px 0;text-align:center"><div style="font-size:11px;color:#a1a1aa">ROOM CODE · share it so others can join</div>
  <div style="font:900 30px Cinzel,serif;letter-spacing:5px;color:#fff">${esc(c)}</div><button class="wg-b wg-z" data-act="copycode" data-code="${esc(c)}">📋 Copy code</button></div>`:'';
const privBox=id=>`<label class="wg-ck" style="display:block;margin-top:8px"><input type="checkbox" id="${id}"> 🔒 Private: only people with the room code can join</label>`;
async function joinByCode(){
  if(busy)return;
  const el=$('#wg-code'),code=el?el.value.trim().toUpperCase():'';
  if(!code)return say('Type the room code first.');
  busy=true;await syncGear();
  const r=await rpc('room_join_code',{p_code:code,p_gold:S.gold|0});
  busy=false;
  if(typeof r==='string'&&r.indexOf('ok:')===0){
    const p=r.split(':'),kind=p[1],id=p[2],stake=+p[3]||0;
    setGold(-stake);
    if(kind==='duel')startDuel(id);else startGroup(id);
  }else if(r)say(errMsg(r));
}
async function duelHome(){
  view('Loading…');
  const r=await rpc('duel_lobby');if(!r||tab!=='duel')return;
  collect();
  if(r.mine){startDuel(r.mine);return}
  D=null;
  const open=(r.open||[]).map(d=>`<div class="wg-card"><b>${esc(d.who)}</b> · ${esc(d.title)} ${d.invited?'<span class="wg-s" style="color:#fcd34d">invited you</span>':''}
    <div style="font-size:12px;color:#a1a1aa">${d.n} questions · ${d.secs}s each · winner takes 🪙${d.stake*2}</div>${gearLine(d.gear,d.bonus)}
    <button class="wg-b wg-g" style="margin-top:5px" data-act="djoin" data-id="${d.id}" data-stake="${d.stake}">⚔️ Fight! (🪙${d.stake})</button></div>`).join('')||'<div style="color:#71717a;font-size:13px">No open duels right now. Host one!</div>';
  view(`${codeBox()}<div style="display:flex;justify-content:space-between"><b style="color:#fcd34d">Open duels</b><button class="wg-b wg-z" data-act="refresh">↻ Refresh</button></div>${open}
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
   ${privBox('dd-priv')}
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
  const r=await rpc('duel_create',{p_title:deck.name.slice(0,40),p_questions:qs,p_stake:stake,p_secs:secs,p_invite:inv,p_private:!!($('#dd-priv')&&$('#dd-priv').checked)});
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


// ================= KNIGHT ARENA =================
// The game's own knight (same sprite sheets, armour colours, blade art and pet art as the Armory) drawn for EVERY player
// in a duel / party / quiz, using the gear that player has equipped. Everything is wrapped in try/catch: if the game
// files ever change, the knights just stop drawing and nothing else breaks.
const GL=n=>{try{return window.eval(n)}catch(e){}};
const skOff=v=>{try{window.eval('SKOFF='+v)}catch(e){}};
const myGear=()=>{const e=gearNow();return{pet:e.pet||null,skin:e.skin||null,blade:e.wpn||null}};
const AR={set:new Set(),raf:0};
function arReg(cv,fn){cv._fn=fn;AR.set.add(cv);if(!AR.raf)AR.raf=requestAnimationFrame(arLoop)}
function arLoop(now){
  AR.raf=0;
  for(const cv of [...AR.set]){if(!cv.isConnected){AR.set.delete(cv);continue}try{cv._fn(cv,now/1000)}catch(e){}}
  if(AR.set.size)AR.raf=requestAnimationFrame(arLoop);
}
function arSize(cv,w,h){const d=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(w*d);cv.height=Math.round(h*d);cv._g=cv.getContext('2d');cv._d=d;cv._w=w;cv._h=h}
function arClear(cv){const g=cv._g;g.setTransform(cv._d,0,0,cv._d,0,0);g.clearRect(0,0,cv._w,cv._h);return g}
function wdFor(cv,g){if(cv._wd)return cv._wd;try{cv._wd=new Function('ctx','return '+GL('weaponDraw').toString())(g)}catch(e){cv._wd=function(){}}return cv._wd}
// pets: the game's own creature art, auto-fitted so a T-Rex and a crow both fit
let _pm=null;const PFIT={};
function petMk(){if(_pm)return _pm;const fs=['petCreature','horseDraw0','horseDraw','hfTexture','hfTint'].map(GL);if(fs.some(f=>typeof f!=='function'))throw 0;return _pm=new Function('ctx',fs.map(f=>f.toString()).join('\n')+'\nreturn{pc:petCreature,hd:horseDraw}')}
function petScale(k){const M=(GL('MOUNT')||{})[k];return k==='horse'?(GL('HORSE_K')||1):M?M.K:k==='cat'?1.2:1}
function petFit(k){
  if(PFIT[k])return PFIT[k];
  const o=document.createElement('canvas');o.width=900;o.height=700;
  const g=o.getContext('2d',{willReadFrequently:true}),f=petMk()(g),ps=petScale(k);
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const t of [0,.4,.8,1.2]){
    g.clearRect(0,0,900,700);g.save();g.translate(450,520);g.scale(ps,ps);g.lineCap='round';
    if(k==='horse')f.hd(t,1,0,'bh');else f.pc(k,t,.045,true);
    g.restore();
    const d=g.getImageData(0,0,900,700).data;
    for(let y=0;y<700;y++)for(let x=0;x<900;x++)if(d[(y*900+x)*4+3]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  }
  if(x1<x0){x0=y0=-20;x1=y1=20}else{x0-=450;x1-=450;y0-=520;y1-=520}
  const w=x1-x0,h=y1-y0;
  return PFIT[k]={cx:(x0+x1)/2,by:y1,f:Math.min(84/w,64/h,3)};
}
function drawPet(cv,g,key,t){
  const fn=cv._pf||(cv._pf=petMk()(g)),ft=petFit(key),ps=petScale(key),fly=!!{crow:1,dragon:1,phoenix:1,bison:1}[key],bob=fly?Math.sin(t*5)*3:0;
  g.save();g.translate(-82,-(fly?10:0)+bob);
  g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(0,fly?10:0,Math.min(40,ft.f*18*ps)||18,4,0,0,6.3);g.fill();
  g.scale(ft.f,ft.f);g.translate(-ft.cx,-ft.by);g.scale(ps,ps);g.lineCap='round';
  if(key==='horse')fn.hd(t,false,0,'bh');else fn.pc(key,t,.045,false);
  g.restore();
}
// one knight. gear = {pet,skin,blade}. o = {sc,face,pose:'idle'|'attack'|'dead',u:0..1,dx,flash,a,pet}
function drawKnight(cv,g,cx,fy,gear,t,o){
  o=o||{};gear=gear||{};
  const sp=GL('sprites');
  if(!sp||!sp.idle||!sp.idle.loaded){g.font='26px serif';g.textAlign='center';g.fillText('🤺',cx,fy-6);return}
  const SKT=GL('SKINS')||{},WP=GL('WPNS')||{},sk=SKT[gear.skin],bl=gear.blade&&WP[gear.blade]?gear.blade:null;
  const k=(o.sc||2.2)/2.2,face=o.face||1,pose=o.pose||'idle';
  let sh=sp.idle,fi=Math.floor(t*10)%10,swing=-1;
  if(pose==='dead'&&sp.death&&sp.death.loaded){sh=sp.death;fi=Math.min(9,Math.floor((o.u||0)*10))}
  else if(pose==='attack'){if(bl){fi=0;swing=Math.min(1,o.u||0)}else if(sp.attack&&sp.attack.loaded){sh=sp.attack;fi=Math.min(3,Math.floor((o.u||0)*4))}}
  let img=sh.img;
  try{if(sk&&sk.pal)img=GL('palBake')(img,1)}catch(e){}
  const DJ=GL('DJ'),dx=-54.5*2.2,dy=-80*2.2,fcx=dx+60*2.2;
  g.save();g.translate(cx+face*(o.dx||0),fy);g.scale(face*k,k);g.imageSmoothingEnabled=false;
  if(o.a!=null)g.globalAlpha=o.a;
  g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.ellipse(0,2,38,7,0,0,6.3);g.fill();
  if(o.pet!==false&&gear.pet&&pose!=='dead'){try{drawPet(cv,g,gear.pet,t)}catch(e){}}
  try{DJ&&DJ.pv&&DJ.pv(g,gear.skin,2,-81,t,0)}catch(e){}
  skOff(1);
  try{
    let f=(sk&&sk.f&&!sk.pal)?sk.f:'';if(o.flash)f+=' brightness(2.4) saturate(.3)';
    g.filter=f||'none';
    g.drawImage(img,fi*120,0,120,80,dx,dy,264,176);
  }finally{skOff(0);g.filter='none'}
  if(sh===sp.idle){try{DJ&&DJ.tex&&DJ.tex(g,gear.skin,sp.idle.img,fi,dx,dy,264,176,'i')}catch(e){}}
  try{DJ&&DJ.pv&&DJ.pv(g,gear.skin,2,-81,t,1)}catch(e){}
  if(bl&&pose!=='dead'){
    g.save();g.translate(fcx+5,-41);
    g.rotate(swing>=0?-1.0+2.5*Math.sin(swing*Math.PI/2):.55+Math.sin(t*2)*.03);
    try{wdFor(cv,g)(bl,t)}catch(e){}
    g.restore();
  }
  g.restore();
}

// ---- DUEL MOVE EFFECTS: move i plays the same kind of art as gallery move i (type + colour) ----
// ty: crescent | rising | cross | thrust | whirl | beam (the anime arts)
const MFX=[['thrust','220,232,255'],['crescent','220,232,255'],['thrust','200,200,215'],['cross','255,205,45'],['whirl','255,255,255'],
 ['rising','255,125,30'],['thrust','120,205,245'],['cross','210,255,60'],['thrust','130,175,40'],['crescent','200,130,60'],
 ['thrust','255,205,45'],['thrust','220,232,255'],['cross','255,248,200'],['rising','255,115,60'],['cross','150,105,215'],
 ['whirl','40,225,200'],['rising','200,130,60'],['whirl','240,40,60'],['whirl','150,150,170'],['rising','200,130,60'],
 ['beam','150,105,215'],['crescent','65,115,255'],['thrust','255,255,255'],['whirl','130,175,40'],['beam','255,115,25'],
 ['crescent','120,120,165'],['beam','255,205,80'],['rising','200,130,60'],['cross','240,40,60'],['beam','170,70,255']];
const SPFX=['beam','255,205,80'];   // the once-per-duel special move
const _ez=v=>v*v*(3-2*v),_cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
// g = canvas ctx, f = {mv, sp, t0}, x0/x1 = attacker / victim x, u = 0..1 progress
function drawMoveFx(g,f,x0,x1,u,t){
  const T=f.sp?SPFX:(MFX[(f.mv||1)-1]||MFX[0]),ty=T[0],c=T[1],dir=x1>x0?1:-1,y=108,sx=x0+dir*34,fa=1-_cl((u-.62)/.38);
  g.save();g.lineCap='round';g.globalCompositeOperation='lighter';
  const ln=(a,b,c2,d,al,w)=>{g.strokeStyle='rgba('+c+','+.3*al+')';g.lineWidth=w*2.2;g.beginPath();g.moveTo(a,b);g.lineTo(c2,d);g.stroke();
    g.strokeStyle='rgba('+c+','+.8*al+')';g.lineWidth=w;g.beginPath();g.moveTo(a,b);g.lineTo(c2,d);g.stroke();
    g.strokeStyle='rgba(255,255,255,'+al+')';g.lineWidth=Math.max(1.5,w*.3);g.beginPath();g.moveTo(a,b);g.lineTo(c2,d);g.stroke()};
  const sc=f.sp?1.7:1;
  if(u<.3){const a=_cl(u/.15)*(1-_cl((u-.15)/.15));const r=g.createRadialGradient(sx,y,0,sx,y,24*sc+30*a);r.addColorStop(0,'rgba('+c+','+.7*a+')');r.addColorStop(1,'rgba('+c+',0)');g.fillStyle=r;g.beginPath();g.arc(sx,y,24*sc+30*a,0,6.3);g.fill()}
  else if(fa>0){
    const p=_cl((u-.3)/.3),e=_ez(p),mx=sx+(x1-sx)*.5;
    if(ty==='crescent'){const R=(48+e*40)*sc,a0=-1.5,a1=a0+2.9*e;g.strokeStyle='rgba('+c+','+fa*.8+')';g.lineWidth=14*sc*(1-e*.4);g.beginPath();g.arc(sx+dir*30,y,R,dir>0?a0:Math.PI-a0,dir>0?a1:Math.PI-a1,dir<0);g.stroke();
      g.strokeStyle='rgba(255,255,255,'+fa+')';g.lineWidth=3;g.stroke()}
    else if(ty==='rising'){const a1=1.3-2.9*e;g.strokeStyle='rgba('+c+','+fa*.8+')';g.lineWidth=12*sc;g.beginPath();g.arc(sx+dir*20,y+14,58*sc,dir>0?1.3:Math.PI-1.3,dir>0?a1:Math.PI-a1,dir>0);g.stroke();
      g.fillStyle='rgba('+c+','+fa+')';for(let j=0;j<12;j++)g.fillRect(x1+Math.sin(j*5+t*9)*22,y+40-p*70*(1+j%3*.4),3,3)}
    else if(ty==='cross'){const L=34*sc,a=_ez(_cl((u-.3)/.12)),b=_ez(_cl((u-.4)/.12)),X=x1-dir*10;ln(X-L,y-L,X-L+2*L*a,y-L+2*L*a,fa,8*sc);ln(X+L,y-L,X+L-2*L*b,y-L+2*L*b,fa,8*sc)}
    else if(ty==='thrust'){const bx=sx+(x1-sx)*e;ln(sx,y,bx,y,fa,9*sc);for(let j=1;j<5;j++){g.strokeStyle='rgba(255,255,255,'+fa*.7+')';g.lineWidth=2;g.beginPath();g.ellipse(sx+(x1-sx)*j/5*e,y,5+j,13,0,0,7);g.stroke()}}
    else if(ty==='whirl'){const R=(30+e*46)*sc;g.strokeStyle='rgba('+c+','+fa*.8+')';g.lineWidth=6;g.beginPath();g.ellipse(x0,y+16,R,R*.38,0,0,7);g.stroke();
      g.strokeStyle='rgba(255,255,255,'+fa+')';for(let j=0;j<3;j++){const a0=t*14+j*2.09;g.beginPath();g.ellipse(x0,y+16,R*.9,R*.34,0,a0,a0+1.1);g.stroke()}
      const e2=_ez(_cl((u-.42)/.18));ln(x0,y,x0+(x1-x0)*e2,y,fa*.9,7)}
    else{ // beam
      const w=(10+16*Math.sin(p*3.14))*sc,e2=_ez(_cl((u-.32)/.2)),ex=sx+(x1-sx)*e2;ln(sx,y,ex,y,fa,w);
      const r=g.createRadialGradient(sx,y,0,sx,y,30*sc);r.addColorStop(0,'rgba(255,255,255,'+fa+')');r.addColorStop(1,'rgba('+c+',0)');g.fillStyle=r;g.beginPath();g.arc(sx,y,30*sc,0,6.3);g.fill()}
  }
  if(u>=.55){ // impact on the victim
    const ip=_cl((u-.55)/.4),a=1-ip,R=(14+ip*46)*sc;g.strokeStyle='rgba('+c+','+a+')';g.lineWidth=2+4*a;g.beginPath();g.arc(x1,y,R,0,7);g.stroke();
    g.strokeStyle='rgba(255,255,255,'+a+')';g.lineWidth=2;for(let j=0;j<10;j++){const an=j*.628+1;g.beginPath();g.moveTo(x1+Math.cos(an)*(8+ip*14),y+Math.sin(an)*(8+ip*14));g.lineTo(x1+Math.cos(an)*(18+ip*44)*sc,y+Math.sin(an)*(18+ip*44)*sc);g.stroke()}}
  g.restore();
}
// ---- the big duel arena: two knights facing each other, they swing when a round is won, flinch when hit ----
function arenaInit(cv,gl,gr){
  if(!cv)return;arSize(cv,460,190);
  cv._a={g:[gl||{},gr||{}],pose:[null,null],fl:[-9,-9],q:[],tx:[],fx:[],hp:[100,100],dk:[0,0],dead:[0,0],done:[false,false],t:0};
  arReg(cv,arenaDraw);
}
function arenaSync(cv,hl,hr){
  const A=cv&&cv._a;if(!A)return;
  [hl,hr].forEach((v,s)=>{A.hp[s]=v;if(v<=0&&!A.dk[s]){A.dk[s]=1;A.q.push({at:A.t+.8,fn:()=>{A.dead[s]=A.t}})}});
}
// e = one log entry, li = which player (1 or 2) stands on the LEFT
function arenaRound(cv,e,li){
  const A=cv&&cv._a;if(!A||!e)return;
  const L=e['p'+li],R=e['p'+(3-li)],nm=m=>(MOVES[m-1]||['Strike'])[0];
  const go=(s,x,delay)=>{
    if(!x||!x.ok)return;
    const sp=!!x.sp,dur=sp?1.5:1.0;
    A.q.push({at:A.t+delay,fn:()=>{A.pose[s]={t0:A.t,d:.75};A.fx.push({s,mv:x.mv,sp,t0:A.t,dur})}});
    A.q.push({at:A.t+delay+dur*.5,fn:()=>{
      A.fl[1-s]=A.t;
      A.tx.push({x:s?115:345,t0:A.t,s:(sp?'✨ ':'')+(x.dmg>0?'-'+x.dmg+'  '+nm(x.mv):'blocked'),c:x.dmg>0?(sp?'#fcd34d':'#fca5a5'):'#93c5fd'});
    }});
  };
  go(0,L,0);go(1,R,.9);
}
function arenaDraw(cv,t){
  const A=cv._a;if(!A)return;A.t=t;
  for(let i=A.q.length-1;i>=0;i--){if(A.q[i].at<=t){const it=A.q.splice(i,1)[0];try{it.fn()}catch(e){}}}
  const g=arClear(cv),W=cv._w,H=cv._h;
  g.fillStyle='#1a1424';g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(255,255,255,.045)';g.lineWidth=1;
  for(let x=0;x<W;x+=46){g.beginPath();g.moveTo(x,0);g.lineTo(x,152);g.stroke()}
  for(let y=30;y<152;y+=30){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
  g.fillStyle='#2a2238';g.fillRect(0,152,W,H-152);
  g.fillStyle='#3a3148';g.fillRect(0,152,W,3);
  for(const x of [26,W-26]){
    const fl=.75+.25*Math.sin(t*9+x),q=g.createRadialGradient(x,38,0,x,38,52);
    q.addColorStop(0,'rgba(255,160,60,'+.35*fl+')');q.addColorStop(1,'rgba(255,160,60,0)');
    g.fillStyle=q;g.beginPath();g.arc(x,38,52,0,6.3);g.fill();
    g.font='20px serif';g.textAlign='center';g.fillText('🔥',x,46);
  }
  g.font='bold 16px sans-serif';g.textAlign='center';g.fillStyle='rgba(255,255,255,.14)';g.fillText('VS',W/2,96);
  for(let s=0;s<2;s++){
    const cx=s?345:115,face=s?-1:1,o={sc:2.2,face,pet:true};
    let sx=0;
    if(A.dead[s]){o.pose='dead';o.u=Math.min(1,(t-A.dead[s])/1.0)}
    else{
      const p=A.pose[s];
      if(p&&t-p.t0<(p.d||.55)){const u=(t-p.t0)/(p.d||.55);o.pose='attack';o.u=u;o.dx=Math.sin(u*Math.PI)*42}
      if(t-A.fl[s]<.28){o.flash=Math.floor((t-A.fl[s])*30)%2===0;sx=Math.sin(t*90)*5}
    }
    drawKnight(cv,g,cx+sx,172,A.g[s],t,o);
    if(A.done[s]&&!A.dead[s]){g.font='bold 12px sans-serif';g.textAlign='center';g.fillStyle='#fcd34d';g.fillText('🔒 locked in',cx,34)}
  }
  A.fx=A.fx.filter(f=>t-f.t0<f.dur);
  for(const f of A.fx)drawMoveFx(g,f,f.s?345:115,f.s?115:345,(t-f.t0)/f.dur,t);
  A.tx=A.tx.filter(f=>t-f.t0<1.3);
  for(const f of A.tx){const u=(t-f.t0)/1.3;g.globalAlpha=1-u*u;g.font='bold 15px sans-serif';g.textAlign='center';g.fillStyle='#000';g.fillText(f.s,f.x+1,70-u*34+1);g.fillStyle=f.c;g.fillText(f.s,f.x,70-u*34)}
  g.globalAlpha=1;
}

// ---- GROUP ARENA: every player is a knight; a right answer swings and fires that move's art at the demon in the middle ----
function drawMoveFxAt(g,f,x0,y0,x1,y1,u,t){
  const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy)||1;
  g.save();g.translate(x0,y0-108);g.translate(0,108);g.rotate(Math.atan2(dy,dx));g.translate(0,-108);
  drawMoveFx(g,f,0,d,u,t);g.restore();
}
function garInit(cv,pls){
  if(!cv)return;arSize(cv,460,190);
  const n=pls.length;
  cv._ga={n,pl:pls.map(p=>({name:p.name,gear:p.g||{},t0:-9,sp:0})),fx:[],q:[],tx:[],fl:-9,t:0};
  arReg(cv,garDraw);
}
function garPos(A,i){
  const n=A.n,two=n>5,row=two?(i%2):0,per=two?Math.ceil(n/2):n,col=two?Math.floor(i/2):i;
  const x=(two?(row?.5:0):0)+ (col+.5)*(460/per)+(two&&row?-(460/per)*.25:0);
  return {x:Math.max(26,Math.min(434,x)),y:two?(row?176:132):172};
}
function garRound(cv,e,pls){
  const A=cv&&cv._ga;if(!A||!e)return;
  let k=0;
  (e.res||[]).forEach(r=>{
    if(!r.ok)return;
    const i=A.pl.findIndex(p=>p.name===r.n);if(i<0)return;
    const d=k++*.45,dur=r.sp?1.5:1.0;
    A.q.push({at:A.t+d,fn:()=>{A.pl[i].t0=A.t;A.fx.push({i,mv:r.mv,sp:!!r.sp,t0:A.t,dur})}});
    A.q.push({at:A.t+d+dur*.5,fn:()=>{A.fl=A.t;A.tx.push({i,t0:A.t,s:(r.sp?'✨ ':'')+'+'+r.pts,c:r.sp?'#fcd34d':'#86efac'})}});
  });
}
function garDraw(cv,t){
  const A=cv._ga;if(!A)return;A.t=t;
  for(let i=A.q.length-1;i>=0;i--){if(A.q[i].at<=t){const it=A.q.splice(i,1)[0];try{it.fn()}catch(e){}}}
  const g=arClear(cv),W=cv._w,H=cv._h;
  g.fillStyle='#1a1424';g.fillRect(0,0,W,H);
  g.fillStyle='#2a2238';g.fillRect(0,152,W,H-152);g.fillStyle='#3a3148';g.fillRect(0,152,W,3);
  for(const x of [26,W-26]){g.font='20px serif';g.textAlign='center';g.fillText('🔥',x,46)}
  const tx=W/2,ty=70,hit=t-A.fl<.28;
  g.save();g.globalAlpha=.9;g.font=(hit?58:52)+'px serif';g.textAlign='center';g.fillText('👹',tx+(hit?Math.sin(t*90)*4:0),ty+16);g.restore();
  const sc=A.n<=3?1.5:A.n<=5?1.05:A.n<=7?.85:.7;
  const order=A.pl.map((p,i)=>i).sort((a,b)=>garPos(A,a).y-garPos(A,b).y);
  for(const i of order){
    const P=A.pl[i],pos=garPos(A,i),o={sc,face:pos.x<tx?1:-1,pet:A.n<=4};
    if(t-P.t0<.75){const u=(t-P.t0)/.75;o.pose='attack';o.u=u;o.dx=Math.sin(u*Math.PI)*10}
    drawKnight(cv,g,pos.x,pos.y,P.gear,t,o);
  }
  A.fx=A.fx.filter(f=>t-f.t0<f.dur);
  for(const f of A.fx){const pos=garPos(A,f.i);drawMoveFxAt(g,f,pos.x,pos.y-48*sc/1.5,tx,ty+6,(t-f.t0)/f.dur,t)}
  A.tx=A.tx.filter(f=>t-f.t0<1.3);
  for(const f of A.tx){const pos=garPos(A,f.i),u=(t-f.t0)/1.3;g.globalAlpha=1-u*u;g.font='bold 14px sans-serif';g.textAlign='center';g.fillStyle='#000';g.fillText(f.s,pos.x+1,pos.y-70-u*30+1);g.fillStyle=f.c;g.fillText(f.s,pos.x,pos.y-70-u*30)}
  g.globalAlpha=1;
}
// ---- small idle knights (party room, quiz header): <canvas class="wg-kc" data-g='{"skin":"gold",...}'> ----
const kc=gear=>`<canvas class="wg-kc" data-g='${esc(JSON.stringify(gear||{}))}'></canvas>`;
function wireKnights(root){
  if(!root)return;
  root.querySelectorAll('canvas.wg-kc').forEach(cv=>{
    if(cv._k)return;cv._k=1;
    let gear={};try{gear=JSON.parse(cv.dataset.g||'{}')||{}}catch(e){}
    arSize(cv,64,60);
    arReg(cv,(c,t)=>{const g=arClear(c);drawKnight(c,g,32,57,gear,t,{sc:.95,face:1,pet:false})});
  });
}

// ---------- dungeon room: knights stand together, players CLICK a door (no walking, so nobody can copy a path) ----------
function dungeonQ(q,act,knights,fbId,fbAct,fbLabel){
  const kn=(knights||[]).map(k=>`<div class="wg-kn${k.me?' me':''}${k.done?' done':''}" title="${esc(k.name)}">${k.g?kc(k.g):'<i>🤺</i>'}${esc(k.name)}${k.me?' (you)':''}</div>`).join('');
  let doors;
  if(q.t==='mc')doors=q.o.map((o,i)=>`<button class="wg-door" data-act="${act}" data-v="${i}"><b>${'ABCDEF'[i]}</b><span>${esc(o)}</span></button>`).join('');
  else if(q.t==='tf')doors='<button class="wg-door" data-act="'+act+'" data-v="true"><b>✅</b><span>True</span></button><button class="wg-door" data-act="'+act+'" data-v="false"><b>❌</b><span>False</span></button>';
  else doors=`<div class="wg-lock"><div style="font-size:30px">🚪🔒</div><div style="font-size:12px;color:#d4d4d8;margin:4px 0">Speak the password to open the door</div><input id="${fbId}" class="wg-in" placeholder="Type your answer…" autocomplete="off"><button class="wg-b wg-g" style="margin-top:8px" data-act="${fbAct}">${fbLabel}</button></div>`;
  return `<div style="font:700 17px sans-serif;margin:8px 0;color:#fff">${esc(q.q)}</div><div class="wg-room"><span class="wg-torch l">🔥</span><span class="wg-torch r">🔥</span>${kn?`<div class="wg-knights">${kn}</div>`:''}<div class="wg-doors">${doors}</div></div>`;
}
// mark the door I clicked (only on my own screen; nobody else can see which door I chose)
function markDoor(v){try{modal.querySelectorAll('.wg-door').forEach(b=>{if(b.dataset.v===String(v))b.classList.add('pick')})}catch(e){}}
const mv=x=>MOVES[x.mv-1]||['???',0];
function logLine(e,me,opN){
  const a=e['p'+me],b=e['p'+(3-me)];
  return`<div>R${e.r+1} · answer: <b>${esc(e.ans)}</b> — ${a.ok?`${a.sp?'✨ SPECIAL · ':''}🗡️ you cast <b>${mv(a)[0]}</b> <span style="color:#86efac">(-${a.dmg})</span>`:'❌ you missed'} · ${b.ok?`💥 ${esc(opN)} cast <b>${mv(b)[0]}</b> <span style="color:#fca5a5">(-${b.dmg} to you)</span>`:'🛡️ they missed'}</div>`;
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
      ${codeShow(st.code)}<button class="wg-b wg-z" data-act="dcancel">Cancel &amp; refund</button></div>`);
    return;
  }
  if(!D.built){
    view(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><div style="font-weight:700;color:#86efac">${esc(myN)} (you)</div><div class="wg-bar"><i id="dhb1" style="width:100%;background:#22c55e"></i></div><div id="dht1" style="font-size:12px">100/100</div>${gearLine(st['g'+me],st['b'+me])}</div>
      <div><div style="font-weight:700;color:#fca5a5">${esc(opN)}</div><div class="wg-bar"><i id="dhb2" style="width:100%;background:#ef4444"></i></div><div id="dht2" style="font-size:12px">100/100</div>${gearLine(st['g'+opp],st['b'+opp])}</div></div>
      <canvas id="dar" class="wg-arena"></canvas>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa;margin-top:8px"><span id="dinfo"></span><span id="dtm" style="color:#fcd34d;font-weight:700"></span></div>
      <div id="dq"></div><div id="dst" style="font-size:12px;color:#a1a1aa;min-height:16px;margin-top:6px"></div>
      <div id="df" class="wg-feed" style="margin-top:8px"></div>
      <div style="margin-top:8px" id="dfw"><button id="dsp" class="wg-b wg-p" data-act="dspecial">✨ Special Move (1 use)</button> <button class="wg-b wg-r" data-act="dforfeit">🏳️ Forfeit</button></div>`);
    D.built=true;D.rnd=-1;D.hp=[100,100];
    arenaInit($('#dar'),st['g'+me],st['g'+opp]);
    // the feed is kept; it is repainted below
  }
  const mh=st['hp'+me],oh=st['hp'+opp];
  setHp(1,mh,D.hp[0]);setHp(2,oh,D.hp[1]);D.hp=[mh,oh];
  arenaSync($('#dar'),mh,oh);
  const first=st.logn-st.log.length;
  st.log.forEach((e,k)=>{if(first+k>=D.seen){D.feed.push(logLine(e,me,opN));if(first+k===st.logn-1)arenaRound($('#dar'),e,me)}});
  D.seen=Math.max(D.seen,st.logn);
  $('#df').innerHTML=D.feed.slice(-8).reverse().join('');
  $('#dinfo').textContent='Round '+Math.min(st.rnd+1,st.n)+'/'+st.n+' · pot 🪙'+st.stake*2;
  if(st.status!=='active'){
    D.over=true;clearInterval(dPoll);clearInterval(dTick);
    {const c=$('#dar');if(c&&c._a)c._a.done=[false,false]}
    const R={win:['🏆 VICTORY','#fcd34d','You take 🪙'+st.stake*2+'!'],lose:['💀 DEFEAT','#fca5a5','You lose your 🪙'+st.stake+'.'],draw:['🤝 DRAW','#93c5fd','Both stakes are refunded.'],cancelled:['🚫 Duel cancelled','#a1a1aa','Stakes are refunded.']}[st.result]||['Over','#ccc',''];
    $('#dq').innerHTML=`<div style="text-align:center;padding:12px"><div style="font:900 24px Cinzel,serif;color:${R[1]}">${R[0]}</div><div style="margin:6px 0 12px">${R[2]}</div><button class="wg-b wg-p" data-act="dback">Back to lobby</button></div>`;
    $('#dtm').textContent='';$('#dst').textContent='';$('#dfw').innerHTML='';
    if(!D.paid){D.paid=true;collect()}
    return;
  }
  {const b=$('#dsp');if(b){const used=me===1?st.sp1:st.sp2;b.disabled=!!used||!!meAnsEarly(st,me);if(used)b.textContent='✨ Special used'}}
  D.deadline=performance.now()+st.left*1000;
  const meAns=me===1?st.a1:st.a2,opAns=me===1?st.a2:st.a1;
  if(st.rnd!==D.rnd){
    D.rnd=st.rnd;D.answered=!!meAns;
    const q=st.q;
    $('#dq').innerHTML=dungeonQ(q,'da',[],'dfb','dfb','Open the door!');
    if(D.answered)lockDq();else if(q.t==='fb'){const f=$('#dfb');if(f)f.focus()}
  }else if(meAns&&!D.answered){D.answered=true;lockDq()}
  {const k=modal.querySelectorAll('#dq .wg-kn');if(k[0])k[0].classList.toggle('done',!!meAns);if(k[1])k[1].classList.toggle('done',!!opAns)}
  {const c=$('#dar');if(c&&c._a)c._a.done=[!!meAns,!!opAns]}
  $('#dst').textContent=meAns&&!opAns?'Locked in. Waiting for your opponent…':(opAns&&!meAns?'⚡ Your opponent already answered!':'');
}
function meAnsEarly(st,me){return me===1?st.a1:st.a2}
async function duelSpecial(){if(!D||D.over||D.answered)return;const r=await rpc('duel_special',{p_id:D.id,p_rnd:D.rnd});if(r==='ok'){const b=$('#dsp');if(b){b.disabled=true;b.textContent='✨ Special armed! Answer right!'}}else if(r)say(errMsg(r))}
function lockDq(){modal.querySelectorAll('#dq button,#dq input').forEach(b=>b.disabled=true)}
async function duelAnswer(v){
  if(!D||D.answered||D.over)return;
  D.answered=true;lockDq();markDoor(v);
  await rpc('duel_answer',{p_id:D.id,p_rnd:D.rnd,p_ans:v},true);
  pollDuel();
}
function duelFb(){const f=$('#dfb');if(!f||f.disabled)return;duelAnswer(f.value.trim()||'')}

// ---------- GROUP TRIVIA (2-10 players, host picks) ----------
async function groupHome(){
  view('Loading…');
  const r=await rpc('trivia_lobby');if(!r||tab!=='group')return;
  collect();
  if(r.mine){startGroup(r.mine);return}
  GR=null;
  const open=(r.open||[]).map(d=>`<div class="wg-card"><b>${esc(d.who)}</b> · ${esc(d.title)} <span class="wg-s" style="color:#c4b5fd">${d.cnt}/${d.maxp} players</span>
    <div style="font-size:12px;color:#a1a1aa">${d.n} questions · ${d.secs}s each · pot grows 🪙${d.stake} per player</div>
    <div style="font-size:11px;color:#a1a1aa">In the room: ${(d.names||[]).map(esc).join(', ')}</div>
    <button class="wg-b wg-g" style="margin-top:5px" data-act="gjoin" data-id="${d.id}" data-stake="${d.stake}">👥 Join (🪙${d.stake})</button></div>`).join('')||'<div style="color:#71717a;font-size:13px">No open rooms right now. Host one!</div>';
  view(`${codeBox()}<div style="display:flex;justify-content:space-between"><b style="color:#fcd34d">Open group rooms</b><button class="wg-b wg-z" data-act="refresh">↻ Refresh</button></div>${open}
   <b style="color:#fcd34d;display:block;margin-top:14px">Host a group trivia</b>
   <div style="font-size:12px;color:#a1a1aa">You pick the room size (2-10 players) and everyone answers the same questions. A right answer casts one of the 30 moves for points (+ a speed bonus). Top 3 split the pot: 🥇50% 🥈30% 🥉20% (with only 2 players the winner takes it all).
   <b style="color:#c4b5fd">Your own gear counts:</b> blade = more points per right answer, pet = bonus on streaks, armour = softer penalty for wrong answers. 🚫 Items are banned. You are wearing: ${esc([gn('WPNS',gearNow().wpn),gn('SKINS',gearNow().skin),gn('PETS',gearNow().pet)].filter(Boolean).join(', ')||'nothing')}.</div>
   <label class="wg-lb">DECK</label><select id="gg-deck" class="wg-in">${deckOpts()}</select>
   <label class="wg-lb">QUESTION TYPES</label><div>${typeBoxes('gg-t')}</div>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label class="wg-lb">ROUNDS (3-30)</label><input id="gg-n" class="wg-in" type="number" min="3" max="30" value="10"></div>
    <div><label class="wg-lb">SECONDS PER QUESTION</label><input id="gg-secs" class="wg-in" type="number" min="5" max="60" value="15"></div>
    <div><label class="wg-lb">STAKE EACH 🪙</label><input id="gg-stake" class="wg-in" type="number" min="0" value="50"></div>
    <div><label class="wg-lb">HOW MANY PLAYERS (2-10)</label><select id="gg-max" class="wg-in">${[2,3,4,5,6,7,8,9,10].map(k=>`<option ${k==6?'selected':''}>${k}</option>`).join('')}</select></div>
   </div>
   ${privBox('gg-priv')}
   <button class="wg-b wg-p" style="margin-top:10px" data-act="gcreate">👥 Host group trivia</button>`);
}
async function createGroup(){
  if(busy)return;
  const deck=S.decks[+$('#gg-deck').value],types=pickTypes('gg-t'),n=Math.floor(+$('#gg-n').value||0),secs=Math.floor(+$('#gg-secs').value||0),
    stake=Math.max(0,Math.floor(+$('#gg-stake').value||0)),mx=+$('#gg-max').value;
  if(!deck||!types.length)return say('Pick a deck and at least one question type.');
  if(secs<5||secs>60)return say('Seconds per question: 5-60.');
  if(stake>(S.gold|0))return say("You don't have 🪙"+stake+'.');
  const qs=shuffle(pool(deck,types)).slice(0,Math.max(3,Math.min(30,n)));
  if(qs.length<3)return say('Need at least 3 usable questions in that deck.');
  busy=true;await syncGear();
  const r=await rpc('trivia_create',{p_title:deck.name.slice(0,40),p_questions:qs,p_stake:stake,p_secs:secs,p_max:mx,p_private:!!($('#gg-priv')&&$('#gg-priv').checked)});
  busy=false;
  if(r==null)return;
  if(typeof r==='string'&&r.indexOf('ok:')===0){setGold(-stake);startGroup(r.slice(3))}else say(errMsg(r));
}
async function joinGroup(id,stake){
  if(busy)return;
  if(stake>(S.gold|0))return say('You need 🪙'+stake+' to join.');
  busy=true;await syncGear();const r=await rpc('trivia_join',{p_id:id});busy=false;
  if(r==='ok'){setGold(-stake);startGroup(id)}else if(r){say(errMsg(r));groupHome()}
}
function startGroup(id){
  if(!GR||GR.id!==id)GR={id,rnd:-1,phase:'',answered:false,deadline:0,over:false,paid:false};
  GR.phase='';tab='group';mark();
  clearInterval(gPoll);clearInterval(gTick);
  gPoll=setInterval(pollGroup,1100);gTick=setInterval(tickGroup,200);pollGroup();
}
async function pollGroup(){
  if(!GR||gPolling)return;
  gPolling=true;
  try{
    const {data:st,error}=await sb.rpc('trivia_state',{p_id:GR.id});
    if(error||!st||!GR)return;
    if(!st.ok){say(errMsg(st.err));GR=null;clearInterval(gPoll);clearInterval(gTick);groupHome();return}
    renderGroup(st);
  }catch(e){}finally{gPolling=false}
}
function tickGroup(){
  const t=$('#gtm');if(!t||!GR||GR.over)return;
  t.textContent='⏱ '+Math.max(0,(GR.deadline-performance.now())/1000).toFixed(1)+'s';
}
function gScore(pls,showDone){
  return pls.slice().sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="wg-card" style="margin:4px 0;padding:6px 9px${p.me?';border-color:#a78bfa':''}">
    <div style="display:flex;justify-content:space-between"><span>${i+1}. <b>${esc(p.name)}</b>${p.me?' (you)':''}${p.streak>=2?' 🔥'+p.streak:''}</span><span>${showDone?(p.done?'✅ ':'… '):''}<b style="color:#fcd34d">${p.score}</b></span></div>${gearLine(p.g,p.b)}</div>`).join('');
}
function gFeed(log){
  return (log||[]).map(e=>`<div style="margin:3px 0"><span style="color:#a1a1aa">R${e.r+1} · answer: <b style="color:#fff">${esc(e.ans)}</b></span> ${(e.res||[]).map(x=>x.ok?`<span style="color:#86efac">${esc(x.n)}: ${esc((MOVES[x.mv-1]||['?'])[0])} +${x.pts}</span>`:(x.ans?`<span style="color:#fca5a5">${esc(x.n)}: ${x.pts}</span>`:`<span style="color:#71717a">${esc(x.n)}: 💤</span>`)).join(' · ')}</div>`).join('');
}
function renderGroup(st){
  const pls=st.players||[];
  if(st.status==='waiting'){
    GR.phase='wait';
    const enough=pls.length>=2;
    view(`<div style="text-align:center"><div style="font:900 18px Cinzel,serif;color:#fcd34d">Waiting for players… ${pls.length}/${st.maxp}</div>
      <div style="color:#a1a1aa;font-size:13px;margin:4px 0 8px">${esc(st.title)} · ${st.n} rounds · ${st.secs}s each · pot so far 🪙${st.pot}</div></div>
      ${gScore(pls,false)}${codeShow(st.code)}
      <div style="font-size:12px;color:#a1a1aa;margin:6px 0">${enough?'Ready! The host can start now.':'Need at least 2 players to start.'}</div>
      <div style="display:flex;gap:8px">${st.host?`<button class="wg-b wg-g" data-act="gstart" ${enough?'':'disabled style="opacity:.5"'}>▶ Start</button>`:''}<button class="wg-b wg-z" data-act="gleave">${st.host?'Cancel &amp; refund':'Leave &amp; refund'}</button></div>`);
    return;
  }
  if(st.status==='cancelled'){
    GR.over=true;clearInterval(gPoll);clearInterval(gTick);collect();
    view('<div style="text-align:center;padding:14px"><div style="font:900 20px Cinzel,serif;color:#a1a1aa">🚫 Room cancelled</div><div style="margin:6px 0 12px">Stakes are refunded.</div><button class="wg-b wg-p" data-act="gback">Back to lobby</button></div>');
    return;
  }
  if(GR.phase!=='play'){
    view(`<div style="display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa"><span id="ginfo"></span><span id="gtm" style="color:#fcd34d;font-weight:700"></span></div>
      <div id="gsb"></div><canvas id="gar" class="wg-arena"></canvas><div id="gq"></div><div id="gst" style="font-size:12px;color:#a1a1aa;min-height:16px;margin-top:6px"></div><div id="gspw" style="margin-top:6px"><button id="gsp" class="wg-b wg-p" data-act="gspecial">✨ Special Move (1 use)</button></div>
      <div id="gf" class="wg-feed" style="margin-top:8px"></div>`);
    GR.phase='play';GR.rnd=-1;GR.lastR=(st.log&&st.log.length)?Math.max.apply(null,st.log.map(e=>e.r)):-1;garInit($('#gar'),pls);
  }
  $('#gsb').innerHTML=gScore(pls,st.status==='active');
  try{modal.querySelectorAll('#gq .wg-kn').forEach((el,i)=>{if(pls[i])el.classList.toggle('done',!!pls[i].done)})}catch(e){}
  $('#gf').innerHTML=gFeed(st.log);
  {const nw=(st.log||[]).filter(e=>e.r>GR.lastR).sort((a,b)=>a.r-b.r);if(nw.length){garRound($('#gar'),nw[nw.length-1],pls);GR.lastR=nw[nw.length-1].r}}
  {const b=$('#gsp'),m=pls.find(p=>p.me);if(b&&m){b.disabled=!!m.sp||!!m.done;if(m.sp&&!GR.spArmed)b.textContent='✨ Special used'}}
  $('#ginfo').textContent='Round '+Math.min(st.rnd+1,st.n)+'/'+st.n+' · pot 🪙'+st.pot;
  if(st.status!=='active'){
    GR.over=true;clearInterval(gPoll);clearInterval(gTick);
    const medal=['🥇','🥈','🥉'];
    const rows=(st.rank||[]).map((r,i)=>`<div class="wg-card" style="margin:4px 0;padding:6px 9px${r.me?';border-color:#fcd34d':''}"><div style="display:flex;justify-content:space-between"><span>${medal[i]||(i+1)+'.'} <b>${esc(r.name)}</b>${r.me?' (you)':''}</span><span>${r.score} pts${r.pay?' · <b style="color:#86efac">🪙'+r.pay+'</b>':''}</span></div></div>`).join('');
    const mine=(st.rank||[]).find(r=>r.me);
    $('#gq').innerHTML=`<div style="text-align:center;padding:8px"><div style="font:900 22px Cinzel,serif;color:#fcd34d">🏁 Final standings</div>
      <div style="margin:4px 0 8px">${mine&&mine.pay?'You win <b style="color:#86efac">🪙'+mine.pay+'</b>!':'No prize this time.'}</div>${rows}
      <button class="wg-b wg-p" style="margin-top:8px" data-act="gback">Back to lobby</button></div>`;
    $('#gtm').textContent='';$('#gst').textContent='';
    if(!GR.paid){GR.paid=true;collect()}
    return;
  }
  GR.deadline=performance.now()+st.left*1000;
  const me=pls.find(p=>p.me),meAns=!!(me&&me.done);
  if(st.rnd!==GR.rnd){
    GR.rnd=st.rnd;GR.answered=meAns;
    const q=st.q;
    $('#gq').innerHTML=dungeonQ(q,'ga',pls.map(p=>({name:p.name,me:p.me,done:p.done,g:p.g||{}})),'gfb','gfb','Open the door!');
    if(GR.answered)lockGq();else if(q.t==='fb'){const f=$('#gfb');if(f)f.focus()}
  }else if(meAns&&!GR.answered){GR.answered=true;lockGq()}
  const left=pls.filter(p=>!p.done).length;
  $('#gst').textContent=meAns?(left?'Locked in. Waiting for '+left+' more…':''):'';
}
function lockGq(){modal.querySelectorAll('#gq button,#gq input').forEach(b=>b.disabled=true)}
async function groupSpecial(){if(!GR||GR.over||GR.answered)return;const r=await rpc('trivia_special',{p_id:GR.id,p_rnd:GR.rnd});if(r==='ok'){const b=$('#gsp');if(b){b.disabled=true;b.textContent='✨ Special armed! Answer right!'}}else if(r)say(errMsg(r))}
async function groupAnswer(v){
  if(!GR||GR.answered||GR.over)return;
  GR.answered=true;lockGq();markDoor(v);
  await rpc('trivia_answer',{p_id:GR.id,p_rnd:GR.rnd,p_ans:v},true);
  pollGroup();
}
function groupFb(){const f=$('#gfb');if(!f||f.disabled)return;groupAnswer(f.value.trim()||'')}

// ---------- WATCH (spectate other players' duels and group trivia, read-only) ----------
async function watchHome(){
  W=null;view('Loading…');
  const r=await rpc('watch_list');if(!r||tab!=='watch')return;
  const du=(r.duels||[]).map(d=>`<div class="wg-card"><b>${esc(d.p1)}</b> ⚔️ <b>${esc(d.p2)}</b> · ${esc(d.title)}
    <div style="font-size:12px;color:#a1a1aa">Round ${Math.min(d.rnd+1,d.n)}/${d.n} · HP ${d.hp1} vs ${d.hp2} · pot 🪙${d.stake*2}${d.watching?' · 👁 '+d.watching:''}</div>
    <button class="wg-b wg-g" style="margin-top:5px" data-act="wview" data-kind="duel" data-id="${d.id}">👁 Watch</button></div>`).join('')||'<div style="color:#71717a;font-size:13px">No public duels running right now.</div>';
  const pa=(r.parties||[]).map(d=>`<div class="wg-card"><b>${esc(d.title)}</b> <span class="wg-s" style="color:#c4b5fd">${d.cnt} players</span>
    <div style="font-size:12px;color:#a1a1aa">Round ${Math.min(d.rnd+1,d.n)}/${d.n} · pot 🪙${d.pot}${d.watching?' · 👁 '+d.watching:''}</div>
    <div style="font-size:11px;color:#a1a1aa">${(d.names||[]).map(esc).join(', ')}</div>
    <button class="wg-b wg-g" style="margin-top:5px" data-act="wview" data-kind="trivia" data-id="${d.id}">👁 Watch</button></div>`).join('')||'<div style="color:#71717a;font-size:13px">No public group rooms running right now.</div>';
  view(`<div style="border:1px dashed #a78bfa;border-radius:8px;padding:8px;margin-bottom:10px"><b style="color:#c4b5fd">🔑 Watch a private room</b>
    <div style="display:flex;gap:6px;margin-top:6px"><input id="wg-wcode" class="wg-in" maxlength="8" placeholder="room code" autocomplete="off" style="text-transform:uppercase;letter-spacing:3px;margin:0"><button class="wg-b wg-g" data-act="wcode">Watch</button></div></div>
    <div style="display:flex;justify-content:space-between"><b style="color:#fcd34d">Live duels</b><button class="wg-b wg-z" data-act="refresh">↻ Refresh</button></div>${du}
    <b style="color:#fcd34d;display:block;margin-top:14px">Live group trivia</b>${pa}
    <div style="font-size:11px;color:#71717a;margin-top:10px">Spectators can only look. You never see the answer until the round is over, and you don't pay or win anything.</div>`);
}
async function watchByCode(){
  const el=$('#wg-wcode'),code=el?el.value.trim().toUpperCase():'';
  if(!code)return say('Type the room code first.');
  const r=await rpc('room_watch_code',{p_code:code});
  if(typeof r==='string'&&r.indexOf('ok:')===0){const p=r.split(':');startWatch(p[1],p[2],code)}else if(r)say(errMsg(r));
}
function stopWatch(){clearInterval(wPoll);clearInterval(wTick);W=null}
function startWatch(kind,id,code){
  W={kind,id,code:code||null,seen:0,feed:[],rnd:-1,built:false,over:false,deadline:0,hp:[100,100]};
  tab='watch';mark();clearInterval(wPoll);clearInterval(wTick);
  wPoll=setInterval(pollWatch,1100);wTick=setInterval(tickWatch,200);pollWatch();
}
async function pollWatch(){
  if(!W||wPolling)return;
  wPolling=true;
  try{
    const {data:st,error}=await sb.rpc(W.kind==='duel'?'duel_spectate':'trivia_spectate',{p_id:W.id,p_code:W.code});
    if(error||!st||!W)return;
    if(!st.ok){say(errMsg(st.err));stopWatch();watchHome();return}
    if(W.kind==='duel')renderWatchDuel(st);else renderWatchGroup(st);
  }catch(e){}finally{wPolling=false}
}
function tickWatch(){
  const t=$('#wtm');if(!t||!W||W.over)return;
  t.textContent='⏱ '+Math.max(0,(W.deadline-performance.now())/1000).toFixed(1)+'s';
}
const wQuestion=q=>`<div style="font:700 17px sans-serif;margin:8px 0;color:#fff">${esc(q.q)}</div>`+(q.t==='mc'?q.o.map((o,i)=>`<div class="wg-opt" style="opacity:.75;cursor:default">${'ABCDEF'[i]}. ${esc(o)}</div>`).join(''):q.t==='tf'?'<div class="wg-opt" style="opacity:.75;cursor:default">✅ True or ❌ False?</div>':'<div class="wg-opt" style="opacity:.75;cursor:default">✍️ Fill in the blank</div>');
function wDuelLine(e,n1,n2){
  const side=(x,n,o)=>x.ok?`🗡️ <b>${esc(n)}</b> cast <b>${esc((MOVES[x.mv-1]||['???'])[0])}</b> <span style="color:#fca5a5">(-${x.dmg} to ${esc(o)})</span>`:`❌ ${esc(n)} missed`;
  return`<div>R${e.r+1} · answer: <b>${esc(e.ans)}</b> — ${side(e.p1,n1,n2)} · ${side(e.p2,n2,n1)}</div>`;
}
function wHp(i,v,old){
  const b=$('#whb'+i),t=$('#wht'+i);if(!b)return;
  b.style.width=Math.max(0,v)+'%';t.textContent=v+'/100';
  if(v<old){const p=b.parentNode.parentNode;p.classList.remove('wg-hit');void p.offsetWidth;p.classList.add('wg-hit')}
}
function renderWatchDuel(st){
  const n1=st.p1||'…',n2=st.p2||'…';
  if(!W.built){
    view(`<div style="display:flex;justify-content:space-between;font-size:12px;color:#c4b5fd;margin-bottom:6px"><b>👁 Watching: ${esc(st.title)}</b><span id="wwatch"></span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><div style="font-weight:700;color:#86efac">${esc(n1)}</div><div class="wg-bar"><i id="whb1" style="width:100%;background:#22c55e"></i></div><div id="wht1" style="font-size:12px">100/100</div>${gearLine(st.g1,st.b1)}</div>
      <div><div style="font-weight:700;color:#fca5a5">${esc(n2)}</div><div class="wg-bar"><i id="whb2" style="width:100%;background:#ef4444"></i></div><div id="wht2" style="font-size:12px">100/100</div>${gearLine(st.g2,st.b2)}</div></div>
      <canvas id="war" class="wg-arena"></canvas>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa;margin-top:8px"><span id="winfo"></span><span id="wtm" style="color:#fcd34d;font-weight:700"></span></div>
      <div id="wq"></div><div id="wst" style="font-size:12px;color:#a1a1aa;min-height:16px;margin-top:6px"></div>
      <div id="wf" class="wg-feed" style="margin-top:8px"></div>
      <div style="margin-top:8px"><button class="wg-b wg-z" data-act="wback">⬅ Stop watching</button></div>`);
    W.built=true;W.rnd=-1;W.hp=[100,100];
    arenaInit($('#war'),st.g1,st.g2);
  }
  wHp(1,st.hp1,W.hp[0]);wHp(2,st.hp2,W.hp[1]);W.hp=[st.hp1,st.hp2];
  arenaSync($('#war'),st.hp1,st.hp2);
  const first=st.logn-st.log.length;
  st.log.forEach((e,k)=>{if(first+k>=W.seen){W.feed.push(wDuelLine(e,n1,n2));if(first+k===st.logn-1)arenaRound($('#war'),e,1)}});
  W.seen=Math.max(W.seen,st.logn);
  $('#wf').innerHTML=W.feed.slice(-8).reverse().join('');
  $('#winfo').textContent='Round '+Math.min(st.rnd+1,st.n)+'/'+st.n+' · pot 🪙'+st.stake*2;
  $('#wwatch').textContent=st.watching?'👁 '+st.watching+' watching':'';
  if(st.status!=='active'){
    W.over=true;clearInterval(wPoll);clearInterval(wTick);
    const head=st.winner?'🏆 '+esc(st.winner)+' wins 🪙'+st.stake*2+'!':'🤝 Draw — both stakes refunded';
    $('#wq').innerHTML=`<div style="text-align:center;padding:12px"><div style="font:900 22px Cinzel,serif;color:#fcd34d">${head}</div><button class="wg-b wg-p" style="margin-top:10px" data-act="wback">Back to Watch</button></div>`;
    $('#wtm').textContent='';$('#wst').textContent='';
    return;
  }
  W.deadline=performance.now()+st.left*1000;
  if(st.rnd!==W.rnd){W.rnd=st.rnd;$('#wq').innerHTML=wQuestion(st.q)}
  $('#wst').textContent=st.a1&&st.a2?'Both locked in…':st.a1?n1+' locked in.':st.a2?n2+' locked in.':'';
}
function renderWatchGroup(st){
  const pls=st.players||[];
  if(!W.built){
    view(`<div style="display:flex;justify-content:space-between;font-size:12px;color:#c4b5fd;margin-bottom:6px"><b>👁 Watching: ${esc(st.title)}</b><span id="wwatch"></span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa"><span id="winfo"></span><span id="wtm" style="color:#fcd34d;font-weight:700"></span></div>
      <div id="wsb"></div><div id="wq"></div><div id="wst" style="font-size:12px;color:#a1a1aa;min-height:16px;margin-top:6px"></div>
      <div id="wf" class="wg-feed" style="margin-top:8px"></div>
      <div style="margin-top:8px"><button class="wg-b wg-z" data-act="wback">⬅ Stop watching</button></div>`);
    W.built=true;W.rnd=-1;
  }
  $('#wsb').innerHTML=gScore(pls,st.status==='active');
  $('#wf').innerHTML=gFeed(st.log);
  $('#winfo').textContent='Round '+Math.min(st.rnd+1,st.n)+'/'+st.n+' · pot 🪙'+st.pot;
  $('#wwatch').textContent=st.watching?'👁 '+st.watching+' watching':'';
  if(st.status!=='active'){
    W.over=true;clearInterval(wPoll);clearInterval(wTick);
    const medal=['🥇','🥈','🥉'];
    const rows=(st.rank||[]).map((r,i)=>`<div class="wg-card" style="margin:4px 0;padding:6px 9px"><div style="display:flex;justify-content:space-between"><span>${medal[i]||(i+1)+'.'} <b>${esc(r.name)}</b></span><span>${r.score} pts${r.pay?' · <b style="color:#86efac">🪙'+r.pay+'</b>':''}</span></div></div>`).join('');
    $('#wq').innerHTML=`<div style="text-align:center;padding:8px"><div style="font:900 22px Cinzel,serif;color:#fcd34d">🏁 Final standings</div>${rows}<button class="wg-b wg-p" style="margin-top:8px" data-act="wback">Back to Watch</button></div>`;
    $('#wtm').textContent='';$('#wst').textContent='';
    return;
  }
  W.deadline=performance.now()+st.left*1000;
  if(st.rnd!==W.rnd){W.rnd=st.rnd;$('#wq').innerHTML=wQuestion(st.q)}
  const left=pls.filter(p=>!p.done).length;
  $('#wst').textContent=left?left+' of '+pls.length+' still thinking…':'Everyone locked in…';
}

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
  else if(a==='dspecial'){duelSpecial()}
  else if(a==='dforfeit'){if(confirm('Forfeit? Your opponent takes the whole pot.')){const r=await rpc('duel_forfeit',{p_id:D&&D.id});if(r&&r!=='ok')say(errMsg(r));pollDuel()}}
  else if(a==='dback'){D=null;go('duel')}
  else if(a==='gcreate')createGroup();
  else if(a==='gjoin')joinGroup(id,+t.dataset.stake||0);
  else if(a==='ga'){const v=t.dataset.v;groupAnswer(v==='true'?true:v==='false'?false:+v)}
  else if(a==='gfb')groupFb();
  else if(a==='gstart'){const r=await rpc('trivia_start',{p_id:GR&&GR.id});if(r&&r!=='ok')say(errMsg(r));pollGroup()}
  else if(a==='gspecial'){groupSpecial()}
  else if(a==='gleave'){const r=await rpc('trivia_leave',{p_id:GR&&GR.id});if(r==='ok'){collect();say('Left the room. Your stake is coming back.')}else if(r)say(errMsg(r));GR=null;go('group')}
  else if(a==='gback'){GR=null;go('group')}
  else if(a==='codejoin')joinByCode();
  else if(a==='wview')startWatch(t.dataset.kind,id,null);
  else if(a==='wcode')watchByCode();
  else if(a==='wback'){stopWatch();go('watch')}
  else if(a==='copycode'){const c=t.dataset.code||'';try{navigator.clipboard.writeText(c).then(()=>say('Code copied: '+c),()=>say('Room code: '+c))}catch(e){say('Room code: '+c)}}
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
