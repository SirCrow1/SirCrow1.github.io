/* SUFFERANCE accounts + referrals + player name + stats (Supabase, Google sign-in only) */
(function(){
const SUPABASE_URL='https://qtkgagopbvmvpdgmvghz.supabase.co';
const SUPABASE_KEY='sb_publishable_yuGBDQKsZlJ0IR37wXMOMQ_rR_N8mR-';

// Remember a referral code from the link (?ref=abc12345) until the player is logged in
try{const r=new URLSearchParams(location.search).get('ref');if(r)localStorage.suff_ref=r.trim().toLowerCase()}catch(e){}

const $=s=>document.querySelector(s);
const say=m=>{try{toast(m)}catch(e){alert(m)}};
let sb=null,busy=false,profile={username:null,code:''},editing=false,isAdmin=false,roleName='unknown',diag='';

const GLOGO='<svg width="18" height="18" viewBox="0 0 48 48" style="flex:none"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

// ---------- UI ----------
function buildUI(){
  const gold=$('#gold');if(!gold||$('#acctbtn'))return;
  const b=document.createElement('button');
  b.id='acctbtn';b.type='button';b.textContent='👤 Account';
  b.className='bg-zinc-900 px-3 py-1.5 rounded border border-emerald-900/50 text-emerald-300 hover:bg-emerald-950 transition whitespace-nowrap';
  gold.parentNode.insertBefore(b,gold);
  document.body.insertAdjacentHTML('beforeend',`
  <style>
    #acct-modal button{cursor:pointer}
    #acct-google{width:100%;display:flex!important;align-items:center;justify-content:center;gap:10px;background:#fff!important;color:#111!important;font-weight:bold;padding:10px 16px;border-radius:6px;border:1px solid #d4d4d8!important}
    .acct-b{color:#fff!important;font-weight:bold;padding:7px 14px;border-radius:6px}
    .acct-in{width:100%;padding:8px;border-radius:6px;background:#0b0912;border:1px solid #3f3f46;color:#fff}
    .acct-stat{background:#0b0912;border:1px solid #27272a;border-radius:6px;padding:6px 8px}
    .acct-stat b{display:block;color:#facc15;font-size:16px}
  </style>
  <div id="acct-modal" style="display:none;position:fixed;inset:0;z-index:80;align-items:center;justify-content:center;background:rgba(0,0,0,.65);overflow:auto">
    <div style="background:#14101c;border:2px solid #34d399;border-radius:10px;padding:18px 22px;width:min(92vw,400px);max-height:92vh;overflow:auto;color:#e6dcc0;font:14px sans-serif">
      <div style="font:900 20px Cinzel,serif;color:#34d399;margin-bottom:10px">👤 Account</div>

      <div id="acct-out">
        <div id="acct-ref" style="font-size:12px;color:#fcd34d;margin-bottom:8px"></div>
        <button id="acct-google">${GLOGO}<span>Continue with Google</span></button>
      </div>

      <div id="acct-in" style="display:none">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <img id="acct-av" referrerpolicy="no-referrer" style="width:44px;height:44px;border-radius:50%;border:2px solid #34d399;display:none">
          <div style="min-width:0">
            <div id="acct-name" style="font:bold 18px sans-serif;color:#fff;overflow:hidden;text-overflow:ellipsis"></div>
            <div id="acct-mail" style="font-size:12px;color:#a1a1aa;overflow:hidden;text-overflow:ellipsis"></div>
          </div>
        </div>

        <div id="acct-namebox" style="display:none;margin-bottom:12px">
          <div id="acct-nameprompt" style="margin-bottom:4px;color:#fcd34d">Pick your player name (3-16 letters, numbers or _)</div>
          <div style="display:flex;gap:6px">
            <input id="acct-nameinput" class="acct-in" maxlength="16" placeholder="Player name" autocomplete="off">
            <button id="acct-namesave" class="acct-b" style="background:#059669">Save</button>
          </div>
        </div>
        <button id="acct-rename" class="acct-b" style="background:#3f3f46;margin-bottom:12px;display:none">✏️ Change name</button>

        <div style="font-weight:bold;color:#34d399;margin-bottom:6px">📊 Your stats</div>
        <div id="acct-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px"></div>
        <div id="acct-ranks" style="font-size:12px;color:#a1a1aa;margin-bottom:12px"></div>

        <div style="margin-bottom:12px">
          <button id="acct-lb" class="acct-b" style="background:#a16207;margin-bottom:10px">🏆 Leaderboard</button>
          <div style="font-weight:bold;color:#34d399;margin-bottom:4px">🎟️ Gift code</div>
          <div style="display:flex;gap:6px"><input id="acct-code" class="acct-in" placeholder="Enter code" maxlength="24" autocomplete="off"><button id="acct-redeem" class="acct-b" style="background:#059669">Redeem</button></div>
        </div>

        <div id="acct-admin" style="display:none;border:1px solid #a16207;border-radius:8px;padding:10px;margin-bottom:12px;background:#1c1408">
          <div style="font-weight:bold;color:#facc15;margin-bottom:6px">🛠️ Admin tools</div>
          <button id="adm-gold" class="acct-b" style="background:#a16207;margin:0 6px 6px 0">+100,000 gold</button>
          <button id="adm-unlock" class="acct-b" style="background:#7c3aed;margin:0 6px 6px 0">Unlock all shop items</button>
          <button id="adm-stock" class="acct-b" style="background:#0e7490;margin:0 6px 6px 0">Stock all run items (x99)</button>
          <button id="adm-deaths" class="acct-b" style="background:#991b1b;margin:0 6px 6px 0">Unlock all deaths</button>
          <button id="adm-pets" class="acct-b" style="background:#be185d;margin:0 6px 6px 0">Max pet bonds</button>
          <button id="adm-spam" class="acct-b" style="background:#4338ca;margin:0 6px 6px 0">Unlimited abilities: OFF</button>
          <button id="adm-reset" class="acct-b" style="background:#450a0a;margin:0 6px 6px 0">Reset my save</button>
          <button id="adm-panel" class="acct-b" style="background:#ca8a04;display:block;margin:0 0 6px 0">👥 Open admin panel (players, codes)</button>
          <div style="margin-top:6px;font-size:12px;color:#fcd34d">Give gold (leave the name blank to give it to yourself)</div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <input id="adm-target" class="acct-in" placeholder="Player name" maxlength="16" autocomplete="off">
            <input id="adm-amt" class="acct-in" type="number" min="1" value="1000" style="width:90px">
            <button id="adm-give" class="acct-b" style="background:#059669">Give</button>
            <button id="adm-take" class="acct-b" style="background:#b91c1c">Take</button>
          </div>
        </div>

        <div style="font-weight:bold;color:#34d399;margin-bottom:4px">🎁 Invite friends</div>
        <div style="margin-bottom:6px;font-size:13px">You get <b style="color:#facc15">1,000 gold</b>, they get <b style="color:#facc15">350 gold</b>.</div>
        <input id="acct-link" class="acct-in" readonly style="font-size:12px;margin-bottom:8px">
        <button id="acct-copy" class="acct-b" style="background:#a16207;margin-right:8px">Copy link</button>
        <button id="acct-logout" class="acct-b" style="background:#7f1d1d">Log out</button>
      </div>

      <div id="acct-diag" style="margin-top:10px;font-size:10px;color:#52525b"></div>
      <div style="margin-top:6px;text-align:right"><button id="acct-close" style="color:#a1a1aa;font-size:12px">Close</button></div>
    </div>
  </div>`);
  b.onclick=openModal;
  $('#acct-close').onclick=()=>$('#acct-modal').style.display='none';
  $('#acct-google').onclick=()=>sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  $('#acct-logout').onclick=async()=>{stashAndClear();await sb.auth.signOut();profile={username:null,code:''};editing=false;isAdmin=false;roleName='unknown';if(spamT){clearInterval(spamT);spamT=null}render();say('Logged out');setTimeout(()=>location.reload(),300)};
  $('#acct-copy').onclick=()=>{const i=$('#acct-link');i.select();try{navigator.clipboard.writeText(i.value)}catch(e){document.execCommand('copy')}say('Invite link copied!')};
  $('#acct-rename').onclick=()=>{editing=true;render();$('#acct-nameinput').value=profile.username||'';$('#acct-nameinput').focus()};
  $('#adm-gold').onclick=()=>admin(()=>{S.gold+=100000},'+100,000 gold');
  $('#adm-unlock').onclick=()=>admin(()=>{const h=shopS();for(const k in SKINS)h.own['skin'+k]=1;for(const k in WPNS)h.own['wpn'+k]=1;for(const k in PETS)h.own['pet'+k]=1},'Everything in the shop unlocked');
  $('#adm-stock').onclick=()=>admin(()=>{const h=shopS();for(const k in SHOP_ITEMS)h.inv[k]=99},'All run items stocked');
  $('#adm-deaths').onclick=()=>admin(()=>{
    const gn=typeof GN!=='undefined'?GN:[...Array(30).keys()].map(String);
    const gs=typeof GSK!=='undefined'?GSK:['spike','axe','boulder','lava','ghost','fire','dart','gas','ice','fall'];
    S.seen=S.seen||{};for(const k of gn)S.seen[k]=S.seen[k]||1;for(const k of gs)S.seen['s:'+k]=S.seen['s:'+k]||1;
  },'All deaths unlocked in the Death Gallery');
  $('#adm-give').onclick=()=>giveGold(1);
  $('#adm-take').onclick=()=>giveGold(-1);
  for(const id of ['#adm-target','#adm-amt']){$(id).addEventListener('keydown',e=>e.stopPropagation());$(id).addEventListener('keyup',e=>e.stopPropagation())}
  $('#acct-namesave').onclick=saveName;
  $('#acct-nameinput').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')saveName()});
  $('#acct-nameinput').addEventListener('keyup',e=>e.stopPropagation());
}
async function giveGold(sign){
  sign=sign===-1?-1:1;
  if(!isAdmin)return;
  const name=$('#adm-target').value.trim(),amt=Math.floor(Number($('#adm-amt').value));
  const self=!name||(profile.username&&name.toLowerCase()===profile.username.toLowerCase());
  if(!(amt>0&&amt<=(self?1e9:1000000)))return say('Enter an amount from 1 to '+(self?'1,000,000,000':'1,000,000'));
  if(self)return admin(()=>{S.gold=Math.max(0,S.gold+sign*amt)},(sign>0?'+':'-')+amt+' gold for you');
  const {data,error}=await sb.rpc(sign>0?'admin_give_gold':'admin_take_gold',{target_name:name,amount:amt});
  if(error)return say('Failed: '+error.message);
  if(data==='ok')say((sign>0?'🎁 Sent ':'💸 Removed ')+amt+' gold '+(sign>0?'to ':'from ')+name+' (applies next time they open the game logged in)');
  else if(data==='no_such_player')say('No player named "'+name+'"');
  else say('Could not do that: '+data);
}
async function claimGold(){
  try{
    const {data:amt,error}=await sb.rpc('claim_pending_gold');
    if(!error&&amt){
      S.gold=Math.max(0,S.gold+amt);save();
      const g=$('#gold');if(g)g.textContent='🪙 '+S.gold;
      try{shopGold()}catch(e){}
      say(amt>0?'🪙 +'+amt+' gold collected!':'🪙 An admin removed '+(-amt)+' gold');
    }
  }catch(e){console.error(e)}
}
function admin(fn,msg){
  if(!isAdmin)return;
  try{
    fn();save();
    const g=$('#gold');if(g)g.textContent='🪙 '+S.gold;
    try{shopGold()}catch(e){}try{shopRender()}catch(e){}
    say('🛠️ '+msg);render();
  }catch(e){console.error(e);say('Admin action failed')}
}
function openModal(){
  render();$('#acct-modal').style.display='flex';
  if(sb)sb.auth.getSession().then(({data:{session}})=>{
    if(session){claimGold();claimOps()}
    if(session&&(!profile.code||roleName==='unknown'))loadProfile().then(()=>{adminUnlock();render()});
  });
}

async function saveName(){
  const n=$('#acct-nameinput').value.trim();
  if(!/^[A-Za-z0-9_]{3,16}$/.test(n))return say('Name must be 3-16 letters, numbers or _');
  const {data,error}=await sb.rpc('set_username',{new_name:n});
  if(error)return say('Could not save name: '+error.message);
  if(data==='taken')return say('That name is taken, try another');
  if(data!=='ok')return say('Invalid name');
  profile.username=n;editing=false;say('Name saved!');render();
}

function statsHTML(){
  const st=(typeof S!=='undefined'&&S.st)||{},mem=(typeof S!=='undefined'&&S.mem)||{};
  const rows=[
    ['🪙 Gold',S.gold],
    ['⚔️ Runs played',mem.runs||0],
    ['🔥 Best streak',(st.bs||0)+' in a row'],
    ['🧩 Puzzles solved',Object.keys(st.sol||{}).length],
    ['🏁 Best run',(st.bp||0)+' puzzles'],
    ['📅 Best daily streak',(S.dly&&S.dly.b)||0]
  ];
  return rows.map(r=>`<div class="acct-stat">${r[0]}<b>${r[1]}</b></div>`).join('');
}

async function render(){
  if(!sb)return;
  const {data:{session}}=await sb.auth.getSession();
  $('#acct-out').style.display=session?'none':'block';
  $('#acct-in').style.display=session?'block':'none';
  $('#acct-ref').textContent=localStorage.suff_ref?'🎁 Referral code applied: sign in with Google to get 350 gold!':'';
  if(!session){$('#acctbtn').textContent='👤 Account';return}
  const u=session.user,meta=u.user_metadata||{},av=$('#acct-av');
  const pic=meta.avatar_url||meta.picture||'';
  if(pic){av.src=pic;av.style.display='block'}else av.style.display='none';
  $('#acct-name').textContent=profile.username||'New player';
  $('#acct-mail').textContent=u.email||'';
  $('#acctbtn').textContent='👤 '+(profile.username||'Account');
  const needName=!profile.username;
  $('#acct-namebox').style.display=(needName||editing)?'block':'none';
  $('#acct-nameprompt').textContent=needName?'Welcome! Pick your player name (3-16 letters, numbers or _)':'New name (3-16 letters, numbers or _)';
  $('#acct-rename').style.display=(needName||editing)?'none':'inline-block';
  $('#acct-admin').style.display=isAdmin?'block':'none';
  $('#acct-diag').textContent='build v9 · role: '+roleName+' · save: '+String((S&&S.owner)||'none').slice(0,6)+' · acct: '+String(myId||'none').slice(0,6)+(diag?' · '+diag:'');
  $('#acct-stats').innerHTML=statsHTML();
  const ranks=Object.entries(S.best||{}).slice(0,6).map(([k,v])=>k+': '+v).join(' · ');
  $('#acct-ranks').textContent=ranks?'🏆 Best ranks: '+ranks:'';
  $('#acct-link').value=profile.code?location.origin+location.pathname+'?ref='+profile.code:'Loading…';
}

async function loadProfile(){
  try{
    diag='';
    let p=null;
    for(const cols of ['referral_code,username,banned','referral_code,username','referral_code']){
      const r=await sb.from('profiles').select(cols).maybeSingle();
      if(!r.error){p=r.data;break}
      diag='profile: '+r.error.message;
    }
    if(p){profile.code=p.referral_code;profile.username=p.username||null;profile.banned=!!p.banned}
    const {data:r,error:re}=await sb.from('user_roles').select('role').maybeSingle();
    if(re)diag+=' role: '+re.message;
    roleName=r?r.role:'unknown';
    isAdmin=roleName==='admin';
  }catch(e){diag='load failed: '+e.message}
}
function adminUnlock(){
  if(!isAdmin)return;
  if(S.adminSeed)return;   // already seeded once for this save: never overwrite gold again
  if(localStorage.suff_skip_unlock){delete localStorage.suff_skip_unlock;S.adminSeed=1;save();return}   // right after 'Reset my save'
  try{
    const h=shopS();for(const k in SKINS)h.own['skin'+k]=1;for(const k in WPNS)h.own['wpn'+k]=1;for(const k in PETS)h.own['pet'+k]=1;
    for(const k in SHOP_ITEMS)if((h.inv[k]||0)<99)h.inv[k]=99;
    if(S.gold<100000)S.gold=100000;
    S.adminSeed=1;save();
    const g=$('#gold');if(g)g.textContent='\u{1FA99} '+S.gold;try{shopGold()}catch(e){}try{shopRender()}catch(e){}
  }catch(e){console.error(e);diag+=' unlock: '+e.message}
}

// ---------- one save per account (the game keeps its save in the browser) ----------
const MAIN='sufference_save_v14';
function stashAndClear(){   // on logout: park this account's save under its own key, leave a clean slate
  try{
    const o=(S&&S.owner)||localStorage.suff_owner;
    if(o){localStorage['suff_save_'+o]=localStorage[MAIN]||JSON.stringify(S);localStorage.removeItem(MAIN);localStorage.removeItem('suff_owner')}
  }catch(e){}
}
function switchOwner(uid){  // returns true if it swapped saves and is reloading the page
  try{
    // the owner is written INSIDE the save itself (S.owner), so any copy of a save knows whose it is
    const owner=(S&&S.owner)||localStorage.suff_owner||null;
    if(!owner||owner===uid){
      if(S.owner!==uid){S.owner=uid;save()}
      localStorage.suff_owner=uid;
      return false;     // first account on this browser adopts the existing save
    }
    localStorage['suff_save_'+owner]=localStorage[MAIN]||JSON.stringify(S);   // park the other account's save
    const mine=localStorage['suff_save_'+uid];
    if(mine)localStorage[MAIN]=mine;else localStorage.removeItem(MAIN);       // this account's own save, or a fresh start
    localStorage.suff_owner=uid;
    location.reload();
    return true;
  }catch(e){return false}
}

// ---------- after login: redeem referral, collect gold, load profile ----------
async function afterLogin(){
  if(busy)return;busy=true;
  try{
    const ref=localStorage.suff_ref;
    if(ref){
      const {data}=await sb.rpc('redeem_referral',{code:ref});
      if(data!=='not_logged_in')delete localStorage.suff_ref;
      if(data==='ok')say('🎁 Referral accepted! 350 gold on the way');
      else if(data==='invalid_code')say('That referral code is not valid');
      else if(data==='own_code')say("You can't use your own referral code");
    }
    const {data:{session}}=await sb.auth.getSession();myId=session?session.user.id:null;
    if(myId&&switchOwner(myId))return;
    await claimGold();
    await claimOps();
    await loadProfile();
    if(profile.banned){say('This account has been banned.');await sb.auth.signOut();profile={username:null,code:''};isAdmin=false;roleName='unknown';busy=false;render();return}
    adminUnlock();
    syncStats();
  }catch(e){console.error(e)}
  busy=false;
  await render();
  if(!profile.username)openModal();   // first login: ask for a name
}

// ================= v5: leaderboard, gift codes, admin panel, extra admin tools =================
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let myId=null,admTab='players',spamT=null;

async function syncStats(){
  try{
    if(!sb)return;
    const st=S.st||{};
    await sb.rpc('sync_stats',{p_streak:st.bs||0,p_solved:Object.keys(st.sol||{}).length,p_runs:(S.mem&&S.mem.runs)||0});
  }catch(e){}
}

function buildExtra(){
  const BOX='background:#14101c;border:2px solid #facc15;border-radius:10px;padding:18px 22px;width:min(94vw,520px);max-height:90vh;overflow:auto;color:#e6dcc0;font:14px sans-serif';
  const WRAP='display:none;position:fixed;inset:0;z-index:85;align-items:center;justify-content:center;background:rgba(0,0,0,.7)';
  document.body.insertAdjacentHTML('beforeend',`
  <div id="lb-modal" style="${WRAP}"><div style="${BOX}">
    <div style="font:900 20px Cinzel,serif;color:#facc15;margin-bottom:8px">🏆 Leaderboard</div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button class="acct-b lb-tab" data-sort="solved" style="background:#3f3f46">🧩 Solved</button>
      <button class="acct-b lb-tab" data-sort="streak" style="background:#3f3f46">🔥 Streak</button>
      <button class="acct-b lb-tab" data-sort="runs" style="background:#3f3f46">⚔️ Runs</button>
      <button class="acct-b lb-tab" data-sort="players" style="background:#3f3f46">👥 Players</button>
    </div>
    <div id="lb-body"></div>
    <div style="margin-top:10px;text-align:right"><button id="lb-close" style="color:#a1a1aa;font-size:12px">Close</button></div>
  </div></div>

  <div id="adm-modal" style="${WRAP}"><div style="${BOX}">
    <div style="font:900 20px Cinzel,serif;color:#facc15;margin-bottom:8px">🛠️ Admin panel</div>
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="acct-b adm-tab" data-tab="players" style="background:#3f3f46">👥 Players</button>
      <button class="acct-b adm-tab" data-tab="codes" style="background:#3f3f46">🎟️ Gift codes</button>
      <button class="acct-b adm-tab" data-tab="items" style="background:#3f3f46">🎒 Items</button>
    </div>
    <div id="adm-body"></div>
    <div style="margin-top:10px;text-align:right"><button id="adm-close" style="color:#a1a1aa;font-size:12px">Close</button></div>
  </div></div>`);

  for(const id of ['#lb-modal','#adm-modal','#acct-modal']){
    const m=$(id);m.addEventListener('keydown',e=>e.stopPropagation());m.addEventListener('keyup',e=>e.stopPropagation());
  }
  $('#lb-close').onclick=()=>$('#lb-modal').style.display='none';
  $('#adm-close').onclick=()=>$('#adm-modal').style.display='none';
  document.querySelectorAll('.lb-tab').forEach(b=>b.onclick=()=>showLB(b.dataset.sort));
  document.querySelectorAll('.adm-tab').forEach(b=>b.onclick=()=>{admTab=b.dataset.tab;admLoad()});
  $('#acct-lb').onclick=()=>showLB('solved');
  $('#acct-code').addEventListener('keydown',e=>{if(e.key==='Enter')redeemCode()});
  $('#acct-redeem').onclick=redeemCode;
  $('#adm-panel').onclick=openAdmin;
  $('#adm-body').addEventListener('click',admClick);
  $('#adm-body').addEventListener('change',e=>{if(e.target.id==='it-cat')fillItemKeys()});

  $('#adm-pets').onclick=()=>admin(()=>{
    S.pb=S.pb||{};
    for(const k in PETS){const b=S.pb[k]||(S.pb[k]={nm:'',xp:0,fed:0,mood:50,lp:0,food:0});b.xp=Math.max(b.xp||0,1e9);b.mood=100;b.fed=Math.max(b.fed||0,99);b.food=20}
  },'All pet bonds maxed');
  $('#adm-spam').onclick=()=>{
    if(!isAdmin)return;
    if(spamT){clearInterval(spamT);spamT=null}
    else spamT=setInterval(()=>{try{if(G&&G.abUsed&&!G.abBusy)G.abUsed=null}catch(e){}},250);
    $('#adm-spam').textContent='Unlimited abilities: '+(spamT?'ON':'OFF');
  };
  $('#adm-reset').onclick=()=>{
    if(!isAdmin)return;
    if(!confirm('Reset YOUR save? Gold, decks, progress and shop items in this browser will be wiped (a backup copy is kept in the browser). Continue?'))return;
    try{localStorage.sufference_backup=localStorage.sufference_save_v14||'';localStorage.removeItem('sufference_save_v14');localStorage.suff_skip_unlock='1'}catch(e){}
    location.reload();
  };
}

// ---------- gift codes (players) ----------
async function redeemCode(){
  const c=$('#acct-code').value.trim();
  if(!c)return;
  const {data,error}=await sb.rpc('redeem_code',{p_code:c});
  if(error)return say('Could not redeem: '+error.message);
  const msg={invalid:'That code is not valid',expired:'That code has expired',used_up:'That code has been fully used',already_used:'You already used that code',banned:'This account is banned',not_logged_in:'Log in first'};
  if(typeof data==='string'&&data.startsWith('ok:')){
    say('🎟️ Code accepted! +'+data.slice(3)+' gold');$('#acct-code').value='';await claimGold();render();
  }else say(msg[data]||'Could not redeem that code');
}

// ---------- leaderboard ----------
async function showLB(sort){
  sort=sort||'solved';
  $('#lb-modal').style.display='flex';
  $('#lb-body').textContent='Loading…';
  await syncStats();
  if(sort==='players'){
    const {data,error}=await sb.rpc('get_players');
    if(error){$('#lb-body').textContent='Could not load: '+error.message;return}
    $('#lb-body').innerHTML=(data&&data.length)?data.map(r=>
      `<div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #27272a;${r.featured?'background:#2a1f05;':''}${r.uname===profile.username?'outline:1px solid #34d399;':''}"><span>${r.featured?'⭐ ':''}<b style="color:${r.featured?'#facc15':'#fff'}">${esc(r.uname)}</b></span><span style="color:#a1a1aa;font-size:12px">${r.solved} puzzles · best streak ${r.streak}</span></div>`
    ).join(''):'<div style="color:#a1a1aa">No players yet.</div>';
    return;
  }
  const {data,error}=await sb.rpc('get_leaderboard',{sort_by:sort});
  if(error){$('#lb-body').textContent='Could not load: '+error.message;return}
  const unit={solved:'puzzles',streak:'in a row',runs:'runs'}[sort]||'';
  $('#lb-body').innerHTML=(data&&data.length)?data.map((r,i)=>
    `<div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #27272a;${r.uname===profile.username?'background:#052e22;':''}"><span>${['🥇','🥈','🥉'][i]||(i+1)+'.'} ${esc(r.uname)}</span><b style="color:#facc15">${r[sort]||0} ${unit}</b></div>`
  ).join(''):'<div style="color:#a1a1aa">No players on the board yet.</div>';
}

// ---------- admin panel ----------
function openAdmin(){if(!isAdmin)return;$('#adm-modal').style.display='flex';admLoad()}

async function admLoad(){
  if(!isAdmin)return;
  const body=$('#adm-body');body.textContent='Loading…';
  document.querySelectorAll('.adm-tab').forEach(b=>b.style.background=b.dataset.tab===admTab?'#a16207':'#3f3f46');
  if(admTab==='items'){renderItems();return}
  if(admTab==='players'){
    const {data,error}=await sb.rpc('admin_list_players');
    if(error){body.textContent='Error: '+error.message;return}
    body.innerHTML=`<div style="font-size:12px;color:#a1a1aa;margin-bottom:6px">${data.length} players</div>`+data.map(r=>{
      const me=r.uid===myId;
      return `<div style="border:1px solid #27272a;border-radius:8px;padding:8px;margin-bottom:6px;background:#0b0912">
        <div><b style="color:#fff">${esc(r.uname||'(no name yet)')}</b> ${r.urole==='admin'?'<span style="color:#facc15">[admin]</span>':''} ${r.isbanned?'<span style="color:#f87171">[BANNED]</span>':''} ${me?'<span style="color:#34d399">(you)</span>':''}</div>
        <div style="font-size:11px;color:#a1a1aa">${esc(r.mail||'')}</div>
        <div style="font-size:11px;color:#a1a1aa">Invited by: ${esc(r.invited_by_name||'—')} · Invited ${r.invited_n} players · Pending gold: ${r.pend}</div>
        <div style="margin-top:6px">
          <button class="acct-b" data-act="rename" data-uid="${esc(r.uid)}" data-name="${esc(r.uname||'')}" style="background:#3f3f46;margin:0 4px 4px 0">✏️ Rename</button>
          <button class="acct-b" data-act="feat" data-uid="${esc(r.uid)}" data-flag="${r.feat?'0':'1'}" style="background:#ca8a04;margin:0 4px 4px 0">${r.feat?'Unfeature':'⭐ Feature'}</button>
          ${me?'':`<button class="acct-b" data-act="ban" data-uid="${esc(r.uid)}" data-flag="${r.isbanned?'0':'1'}" style="background:${r.isbanned?'#059669':'#7f1d1d'};margin:0 4px 4px 0">${r.isbanned?'Unban':'Ban'}</button>
          <button class="acct-b" data-act="role" data-uid="${esc(r.uid)}" data-role="${r.urole==='admin'?'player':'admin'}" style="background:#7c3aed;margin:0 4px 4px 0">${r.urole==='admin'?'Make player':'Make admin'}</button>`}
        </div></div>`}).join('');
  }else{
    const {data,error}=await sb.rpc('admin_list_codes');
    if(error){body.textContent='Error: '+error.message;return}
    body.innerHTML=`<div style="font-weight:bold;color:#facc15;margin-bottom:6px">Create a gift code</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
        <input id="gc-code" class="acct-in" placeholder="CODE (A-Z, 0-9)" maxlength="24" autocomplete="off">
        <input id="gc-gold" class="acct-in" type="number" min="1" placeholder="Gold" value="500">
        <input id="gc-max" class="acct-in" type="number" min="1" placeholder="Max uses (blank = unlimited)">
        <input id="gc-days" class="acct-in" type="number" min="1" placeholder="Valid days (blank = forever)">
      </div>
      <button id="gc-create" class="acct-b" data-act="gc-create" style="background:#059669;margin-bottom:12px">Create code</button>
      <div style="font-weight:bold;color:#facc15;margin-bottom:6px">Existing codes</div>`+
      ((data&&data.length)?data.map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;border:1px solid #27272a;border-radius:8px;padding:8px;margin-bottom:6px;background:#0b0912">
        <div><b style="color:#fff">${esc(r.code)}</b> · ${r.gold} gold<div style="font-size:11px;color:#a1a1aa">Used ${r.uses}${r.max_uses?' / '+r.max_uses:''} · ${r.expires_at?'expires '+new Date(r.expires_at).toLocaleDateString():'no expiry'}</div></div>
        <button class="acct-b" data-act="gc-del" data-code="${esc(r.code)}" style="background:#7f1d1d">Delete</button></div>`).join(''):'<div style="color:#a1a1aa">No codes yet.</div>');
  }
}

async function admClick(e){
  const b=e.target.closest('button[data-act]');if(!b||!isAdmin)return;
  const act=b.dataset.act;
  try{
    if(act==='rename'){
      const n=prompt('New name for '+(b.dataset.name||'this player')+' (3-16 letters, numbers or _):',b.dataset.name||'');
      if(n===null)return;
      const {data,error}=await sb.rpc('admin_set_username',{target:b.dataset.uid,new_name:n.trim()});
      if(error)return say(error.message);
      say({ok:'Renamed',taken:'That name is taken',invalid:'Invalid name'}[data]||data);
    }else if(act==='ban'){
      const ban=b.dataset.flag==='1';
      if(!confirm((ban?'Ban':'Unban')+' this player?'))return;
      const {data,error}=await sb.rpc('admin_set_banned',{target:b.dataset.uid,flag:ban});
      if(error)return say(error.message);
      say(data==='ok'?(ban?'Player banned':'Player unbanned'):data);
    }else if(act==='role'){
      if(!confirm('Make this player a '+b.dataset.role+'?'))return;
      const {data,error}=await sb.rpc('admin_set_role',{target:b.dataset.uid,new_role:b.dataset.role});
      if(error)return say(error.message);
      say(data==='ok'?'Role updated':data);
    }else if(act==='it-give'||act==='it-take'){
      await itemsDo(act==='it-give'?1:-1);return;
    }else if(act==='feat'){
      const f=b.dataset.flag==='1';
      const {data,error}=await sb.rpc('admin_set_featured',{target:b.dataset.uid,flag:f});
      if(error)return say(error.message);
      say(data==='ok'?(f?'Player featured':'Feature removed'):data);
    }else if(act==='gc-create'){
      const num=id=>{const v=$(id).value.trim();return v===''?null:Math.floor(Number(v))};
      const {data,error}=await sb.rpc('admin_create_code',{p_code:$('#gc-code').value.trim(),p_gold:num('#gc-gold'),p_max_uses:num('#gc-max'),p_days:num('#gc-days')});
      if(error)return say(error.message);
      say({ok:'Code created',exists:'That code already exists',invalid:'Code must be 3-24 letters, numbers, - or _',bad_gold:'Gold must be 1 to 1,000,000'}[data]||data);
    }else if(act==='gc-del'){
      if(!confirm('Delete code '+b.dataset.code+'?'))return;
      const {error}=await sb.rpc('admin_delete_code',{p_code:b.dataset.code});
      if(error)return say(error.message);
      say('Code deleted');
    }
  }catch(err){say('Failed: '+err.message)}
  admLoad();
}

// ================= v9: give / take items, pets, treats, badges, deaths =================
const BADGES=[['dall','🏅 Collector (all deaths seen)'],['drun','🏅 Doomed'],['nd','🏅 Untouchable'],['sp','🏅 Blitz'],['bs','🏅 Inferno'],['pm','🏅 Flawless'],['ng','🏅 Relentless'],['two','🏅 Duality (both endings)'],['lair','🏅 Wanderer'],['bond','🏅 Soulbound'],['item','🏅 Alchemist'],['prun','🏅 Conqueror']];
const CATS=[['item','🛡️ Run items (shield, orb, key…)'],['treat','🍖 Pet treats (food)'],['pet','🐾 Pets & mounts (1 each)'],['skin','🧥 Armor skins'],['blade','🗡️ Blades'],['death','💀 Deaths (gallery)'],['badge','🏅 Badges']];
const MAINDEATHS=()=>typeof GN!=='undefined'?GN:[...Array(30).keys()].map(String);
const SECRETS=()=>typeof GSK!=='undefined'?GSK:['spike','axe','boulder','lava','ghost','fire','dart','gas','ice','fall'];
const deathKeys=()=>MAINDEATHS().concat(SECRETS().map(k=>'s:'+k));
function deathName(k){
  try{
    if(String(k).startsWith('s:')){const sk=k.slice(2);return '🔒 Secret: '+((typeof SDN!=='undefined'&&SDN[sk]&&SDN[sk][0])||sk)}
    return typeof galNName==='function'?galNName(k):'Death #'+(+k+1);
  }catch(e){return String(k)}
}
function optList(c){
  if(c==='item')return Object.entries(SHOP_ITEMS).map(([k,v])=>[k,v.n]);
  if(c==='treat'||c==='pet')return Object.entries(PETS).map(([k,v])=>[k,v.n]);
  if(c==='skin')return Object.entries(SKINS).map(([k,v])=>[k,v.n]);
  if(c==='blade')return Object.entries(WPNS).map(([k,v])=>[k,v.n]);
  if(c==='death')return deathKeys().map(k=>[k,deathName(k)]);
  if(c==='badge')return BADGES;
  return [];
}
function applyBadge(id,d){
  const on=d>0,st=S.st=S.st||{};
  switch(id){
    case 'dall':S.seen=S.seen||{};if(on){for(const k of deathKeys())S.seen[k]=S.seen[k]||1}else S.seen={};break;
    case 'drun':st.adr=on?1:0;st.bdk=on?Math.max(st.bdk||0,deathKeys().length):0;break;
    case 'nd':st.nd=on?1:0;break;
    case 'sp':st.sp=on?1:0;st.bsp=on?Math.min(st.bsp||12,12):0;break;
    case 'bs':st.bs=on?Math.max(st.bs||0,10):0;break;
    case 'pm':st.pm=on?1:0;break;
    case 'ng':st.ng=on?1:0;st.bng=on?Math.max(st.bng||0,10):0;break;
    case 'two':S.badges=S.badges||{good:0,bad:0};S.badges.good=on?Math.max(1,S.badges.good||0):0;S.badges.bad=on?Math.max(1,S.badges.bad||0):0;break;
    case 'lair':st.lairs=st.lairs||{};if(on){for(let i=6;i<=25;i++)st.lairs[i]=1}else st.lairs={};break;
    case 'bond':S.pb=S.pb||{};for(const k in PETS){const b=S.pb[k]||(S.pb[k]={nm:'',xp:0,fed:0,mood:50,lp:0,food:0});b.xp=on?Math.max(b.xp||0,1e9):0}break;
    case 'item':st.items=st.items||{};for(const k of ['orb','fav','shield','phx','key']){if(on)st.items[k]=1;else delete st.items[k]}break;
    case 'prun':st.fr=on?1:0;break;
  }
}
function applyOne(c,k,n,d){
  const h=shopS();
  if(c==='item'){h.inv[k]=Math.max(0,(h.inv[k]||0)+d*n)}
  else if(c==='treat'){S.pb=S.pb||{};const b=S.pb[k]||(S.pb[k]={nm:'',xp:0,fed:0,mood:50,lp:0,food:0});b.food=Math.min(20,Math.max(0,(b.food||0)+d*n))}
  else if(c==='pet'){if(d>0)h.own['pet'+k]=1;else{delete h.own['pet'+k];if(h.eq.pet===k)h.eq.pet='crow'}}
  else if(c==='skin'){if(d>0)h.own['skin'+k]=1;else{delete h.own['skin'+k];if(h.eq.skin===k)delete h.eq.skin}}
  else if(c==='blade'){if(d>0)h.own['wpn'+k]=1;else{delete h.own['wpn'+k];if(h.eq.wpn===k)delete h.eq.wpn}}
  else if(c==='death'){S.seen=S.seen||{};if(d>0)S.seen[k]=S.seen[k]||1;else delete S.seen[k]}
  else if(c==='badge'){applyBadge(k,d)}
}
function applyOp(op){
  const c=op.c,d=op.d>0?1:-1,n=Math.max(1,Math.min(99,Math.floor(Number(op.n)||1)));
  const keys=op.k==='*'?optList(c).map(x=>x[0]):[op.k];
  for(const k of keys)applyOne(c,k,n,d);
}
function opLabel(op){
  const cat=(CATS.find(x=>x[0]===op.c)||[0,op.c])[1];
  const it=op.k==='*'?'ALL':((optList(op.c).find(x=>x[0]===op.k)||[0,op.k])[1]);
  return (op.d>0?'Gave ':'Took ')+((op.c==='item'||op.c==='treat')&&op.k!=='*'?op.n+' x ':'')+it+' ('+cat.replace(/^\S+\s/,'')+')';
}
function refreshGame(){const g=$('#gold');if(g)g.textContent='🪙 '+S.gold;try{shopGold()}catch(e){}try{shopRender()}catch(e){}}

async function claimOps(){   // apply anything an admin queued for this account
  try{
    const {data,error}=await sb.rpc('claim_ops');
    if(error||!Array.isArray(data)||!data.length)return;
    let n=0;for(const op of data){try{applyOp(op);n++}catch(e){console.error(e)}}
    save();refreshGame();
    say('🎁 An admin updated your inventory ('+n+' change'+(n>1?'s':'')+')');
  }catch(e){console.error(e)}
}

function fillItemKeys(){
  const c=$('#it-cat').value;
  $('#it-key').innerHTML='<option value="*">★ ALL</option>'+optList(c).map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('');
  $('#it-amt').style.display=(c==='item'||c==='treat')?'block':'none';
}
function renderItems(){
  $('#adm-body').innerHTML=`<div style="font-weight:bold;color:#facc15;margin-bottom:6px">Give or take items</div>
    <div style="font-size:12px;color:#a1a1aa;margin-bottom:6px">Blank name = you (instant). A player's name = queued, and it applies the next time they open the game logged in.</div>
    <input id="it-target" class="acct-in" placeholder="Player name (blank = you)" maxlength="16" autocomplete="off" style="margin-bottom:6px">
    <select id="it-cat" class="acct-in" style="margin-bottom:6px">${CATS.map(x=>`<option value="${x[0]}">${esc(x[1])}</option>`).join('')}</select>
    <select id="it-key" class="acct-in" style="margin-bottom:6px"></select>
    <input id="it-amt" class="acct-in" type="number" min="1" max="99" value="1" style="margin-bottom:6px" placeholder="Amount">
    <button class="acct-b" data-act="it-give" style="background:#059669;margin-right:6px">Give</button>
    <button class="acct-b" data-act="it-take" style="background:#b91c1c">Take</button>
    <div style="font-size:11px;color:#71717a;margin-top:10px">Pets, skins, blades, deaths and badges are on/off (1 each). Run items and pet treats use the amount (treats max 20 per pet). The Scholar badge (solve every question) isn't included.</div>`;
  fillItemKeys();
}
async function itemsDo(d){
  const name=$('#it-target').value.trim(),c=$('#it-cat').value,k=$('#it-key').value;
  const n=Math.max(1,Math.min(99,Math.floor(Number($('#it-amt').value)||1)));
  const op={c,k,n,d};
  const self=!name||(profile.username&&name.toLowerCase()===profile.username.toLowerCase());
  if(self)return admin(()=>applyOp(op),opLabel(op)+' for you');
  const {data,error}=await sb.rpc('admin_queue_op',{target_name:name,p_op:op});
  if(error)return say('Failed: '+error.message);
  if(data==='ok')say('📨 Queued for '+name+': '+opLabel(op));
  else if(data==='no_such_player')say('No player named "'+name+'"');
  else say('Could not queue that: '+data);
}

// ---------- start ----------
function start(){
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  buildUI();buildExtra();
  setInterval(()=>{if(roleName!=='unknown'||profile.code)syncStats()},90000);
  sb.auth.onAuthStateChange((ev,session)=>{
    if(session&&(ev==='SIGNED_IN'||ev==='INITIAL_SESSION'))setTimeout(afterLogin,0);
    else render();
  });
}
const s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
s.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()};
document.head.appendChild(s);
})();
