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
  $('#acct-logout').onclick=async()=>{await cloudSave(true);stashAndClear();await sb.auth.signOut();profile={username:null,code:''};editing=false;isAdmin=false;roleName='unknown';if(spamT){clearInterval(spamT);spamT=null}render();say('Logged out');setTimeout(()=>location.reload(),300)};
  $('#acct-copy').onclick=()=>{const i=$('#acct-link');i.select();try{navigator.clipboard.writeText(i.value)}catch(e){document.execCommand('copy')}say('Invite link copied!')};
  $('#acct-rename').onclick=()=>{editing=true;render();$('#acct-nameinput').value=profile.username||'';$('#acct-nameinput').focus()};
  $('#adm-unlock').onclick=()=>admin(()=>applyTool('shopall',1),'Everything in the shop unlocked');
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
  $('#acct-diag').textContent='build v13 · role: '+roleName+' · save: '+String((S&&S.owner)||'none').slice(0,6)+' · acct: '+String(myId||'none').slice(0,6)+(diag?' · '+diag:'');
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
  // intentionally empty: nothing is given automatically any more. Use the admin buttons.
}

// ---------- one save per account (the game keeps its save in the browser) ----------
const MAIN='sufference_save_v14';
function stashAndClear(){   // on logout: keep a copy of this account's save (the save itself stays in place)
  try{
    const o=(S&&S.owner)||localStorage.suff_owner;
    if(o)localStorage['suff_save_'+o]=localStorage[MAIN]||JSON.stringify(S);
  }catch(e){}
}
function switchOwner(uid){  // returns true if it swapped saves and is reloading the page
  try{
    // the owner is written INSIDE the save itself (S.owner), so any copy of a save knows whose it is
    const owner=(S&&S.owner)||localStorage.suff_owner||null;
    if(!owner||owner===uid){
      const stash=localStorage['suff_save_'+uid];
      const blank=!S.owner&&!S.shop&&!(S.mem&&S.mem.runs)&&!Object.keys(S.seen||{}).length&&!(S.st&&S.st.tot);
      if(blank&&stash&&stash.length>20){   // earlier versions cleared the save on logout: bring this account's progress back
        localStorage[MAIN]=stash;localStorage.removeItem('suff_save_'+uid);localStorage.suff_owner=uid;
        location.reload();return true;
      }
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
    if(myId&&await cloudSync()){busy=false;return}
    await claimGold();
    await claimOps();
    await loadProfile();
    if(profile.banned){say('This account has been banned.');await sb.auth.signOut();profile={username:null,code:''};isAdmin=false;roleName='unknown';busy=false;render();return}
    adminUnlock();
    syncSpam();
    syncStats();
  }catch(e){console.error(e)}
  busy=false;
  await render();
  if(pfTabOn())profileTabOpen();
  if(localStorage.suff_notice){say(localStorage.suff_notice);delete localStorage.suff_notice}
  if(!profile.username)openModal();   // first login: ask for a name
}

// ================= v5: leaderboard, gift codes, admin panel, extra admin tools =================
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let myId=null,admTab='players',spamT=null;

function badgeCount(){
  const st=S.st||{},b=S.badges||{};
  const seenN=Object.keys(S.seen||{}).filter(k=>S.seen[k]).length;
  const lairN=Object.keys(st.lairs||{}).filter(k=>+k>=6&&+k<=25).length;
  const items=['orb','fav','shield','phx','key'].every(k=>st.items&&st.items[k]);
  let bond=false;try{bond=!!(window.PBOND&&window.PBOND.top()>=10)}catch(e){}
  return [seenN>=deathKeys().length,!!st.adr,!!st.nd,!!st.sp,(st.bs||0)>=10,!!st.pm,!!st.ng,!!(b.good&&b.bad),lairN>=20,bond,items,!!st.fr].filter(Boolean).length;
}
function statsBlob(){
  const h=S.shop||{},own=h.own||{},eq=h.eq||{};
  const cnt=p=>Object.keys(own).filter(k=>k.startsWith(p)&&own[k]).length;
  return {gold:S.gold|0,deaths:Object.keys(S.seen||{}).filter(k=>S.seen[k]).length,deathsMax:deathKeys().length,badges:badgeCount(),badgesMax:12,
    pets:cnt('pet'),skins:cnt('skin'),blades:cnt('wpn'),daily:(S.dly&&S.dly.b)||0,eq:{pet:eq.pet||null,skin:eq.skin||null,blade:eq.wpn||null}};
}
async function syncStats(){
  try{
    if(!sb)return;
    const st=S.st||{};
    await sb.rpc('sync_stats',{p_streak:st.bs||0,p_solved:Object.keys(st.sol||{}).length,p_runs:(S.mem&&S.mem.runs)||0});
    await sb.rpc('sync_profile',{p:statsBlob()});
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

  <div id="pf-modal" style="${WRAP};z-index:90"><div style="${BOX}">
    <div id="pf-body"></div>
    <div style="margin-top:10px;text-align:right"><button id="pf-close" style="color:#a1a1aa;font-size:12px">Close</button></div>
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
  $('#pf-close').onclick=()=>$('#pf-modal').style.display='none';
  $('#lb-body').addEventListener('click',e=>{const r=e.target.closest('[data-view]');if(r)viewPlayer(r.dataset.view)});
  $('#adm-close').onclick=()=>$('#adm-modal').style.display='none';
  document.querySelectorAll('.lb-tab').forEach(b=>b.onclick=()=>showLB(b.dataset.sort));
  document.querySelectorAll('.adm-tab').forEach(b=>b.onclick=()=>{admTab=b.dataset.tab;admLoad()});
  $('#acct-lb').onclick=()=>showLB('solved');
  $('#acct-code').addEventListener('keydown',e=>{if(e.key==='Enter')redeemCode()});
  $('#acct-redeem').onclick=redeemCode;
  $('#adm-panel').onclick=openAdmin;
  $('#adm-body').addEventListener('click',admClick);
  $('#adm-body').addEventListener('change',e=>{if(e.target.id==='it-cat')fillItemKeys()});

  $('#adm-pets').onclick=()=>admin(()=>applyTool('bonds',1),'All pet bonds maxed');
  $('#adm-spam').onclick=()=>{if(!isAdmin)return;S.unlimAb=S.unlimAb?0:1;save();syncSpam()};
  $('#adm-reset').onclick=()=>{
    if(!isAdmin)return;
    if(!confirm('Reset YOUR save? Gold, decks, progress and shop items in this browser will be wiped (a backup copy is kept in the browser). Continue?'))return;
    doReset();
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
      `<div data-view="${esc(r.uname)}" style="cursor:pointer;display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #27272a;${r.featured?'background:#2a1f05;':''}${r.uname===profile.username?'outline:1px solid #34d399;':''}"><span>${r.featured?'⭐ ':''}<b style="color:${r.featured?'#facc15':'#fff'}">${esc(r.uname)}</b></span><span style="color:#a1a1aa;font-size:12px">${r.solved} puzzles · best streak ${r.streak}</span></div>`
    ).join(''):'<div style="color:#a1a1aa">No players yet.</div>';
    return;
  }
  const {data,error}=await sb.rpc('get_leaderboard',{sort_by:sort});
  if(error){$('#lb-body').textContent='Could not load: '+error.message;return}
  const unit={solved:'puzzles',streak:'in a row',runs:'runs'}[sort]||'';
  $('#lb-body').innerHTML=(data&&data.length)?data.map((r,i)=>
    `<div data-view="${esc(r.uname)}" style="cursor:pointer;display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #27272a;${r.uname===profile.username?'background:#052e22;':''}"><span>${['🥇','🥈','🥉'][i]||(i+1)+'.'} ${esc(r.uname)}</span><b style="color:#facc15">${r[sort]||0} ${unit}</b></div>`
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
          <button class="acct-b" data-act="view" data-name="${esc(r.uname||'')}" style="background:#0e7490;margin:0 4px 4px 0">👁 View</button>
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
    }else if(act==='view'){
      if(!b.dataset.name)return say('This player has no name yet');
      viewPlayer(b.dataset.name);return;
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
const CATS=[['item','🛡️ Run items (shield, orb, key…)'],['treat','🍖 Pet treats (food)'],['pet','🐾 Pets & mounts (1 each)'],['skin','🧥 Armor skins'],['blade','🗡️ Blades'],['death','💀 Deaths (gallery)'],['badge','🏅 Badges'],['tool','🧰 Tools (unlock shop, max bonds, unlimited abilities, reset save)']];
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
  if(c==='tool')return [['shopall','🛍️ Unlock all shop items'],['bonds','💞 Max pet bonds'],['unlimited','♾️ Unlimited abilities'],['reset','🗑️ Reset save']];
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
  if(c==='tool'){applyTool(op.k,d);return}
  const keys=op.k==='*'?optList(c).map(x=>x[0]):[op.k];
  for(const k of keys)applyOne(c,k,n,d);
}
function opLabel(op){
  if(op.c==='tool'){const t=optList('tool').find(x=>x[0]===op.k);return (op.k==='reset'?'':(op.d>0?'Enabled ':'Disabled '))+(t?t[1]:op.k)}
  const cat=(CATS.find(x=>x[0]===op.c)||[0,op.c])[1];
  const it=op.k==='*'?'ALL':((optList(op.c).find(x=>x[0]===op.k)||[0,op.k])[1]);
  return (op.d>0?'Gave ':'Took ')+((op.c==='item'||op.c==='treat')&&op.k!=='*'?op.n+' x ':'')+it+' ('+cat.replace(/^\S+\s/,'')+')';
}
function refreshGame(){const g=$('#gold');if(g)g.textContent='🪙 '+S.gold;try{shopGold()}catch(e){}try{shopRender()}catch(e){}}

async function viewPlayer(name){
  if(!name)return;
  $('#pf-modal').style.display='flex';
  const body=$('#pf-body');body.textContent='Loading…';
  const {data,error}=await sb.rpc(isAdmin?'admin_get_player':'get_player',{p_name:name});
  if(error){body.textContent='Could not load: '+error.message;return}
  if(!data){body.textContent='Player not found';return}
  const st=data.stats||{},has=v=>v!==undefined&&v!==null;
  const d=v=>v?new Date(v).toLocaleDateString():'—';
  const box=(l,v)=>`<div class="acct-stat">${l}<b>${esc(has(v)?v:'—')}</b></div>`;
  const eq=st.eq||{};
  const eqTxt=[eq.pet&&typeof PETS!=='undefined'&&PETS[eq.pet]?PETS[eq.pet].n:'',eq.skin&&typeof SKINS!=='undefined'&&SKINS[eq.skin]?SKINS[eq.skin].n:'',eq.blade&&typeof WPNS!=='undefined'&&WPNS[eq.blade]?WPNS[eq.blade].n:''].filter(Boolean).join(' · ');
  let html=`<div style="font:bold 20px sans-serif;color:#fff;margin-bottom:2px">${data.featured?'⭐ ':''}${esc(data.name)}</div>
    <div style="font-size:12px;color:#a1a1aa;margin-bottom:10px">Joined ${d(data.joined)} · Last seen ${d(data.last_seen)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">`
    +box('🪙 Gold',has(st.gold)?Number(st.gold).toLocaleString():null)+box('🧩 Puzzles solved',data.solved)
    +box('🔥 Best streak',data.streak)+box('⚔️ Runs',data.runs)
    +box('🏅 Badges',has(st.badges)?st.badges+' / '+(st.badgesMax||12):null)+box('💀 Deaths seen',has(st.deaths)?st.deaths+' / '+(st.deathsMax||40):null)
    +box('🐾 Pets owned',st.pets)+box('🧥 Skins owned',st.skins)+box('🗡️ Blades owned',st.blades)+box('📅 Best daily streak',st.daily)
    +`</div>`+(eqTxt?`<div style="font-size:12px;color:#a1a1aa;margin-top:8px">Equipped: ${esc(eqTxt)}</div>`:'');
  if(isAdmin){
    html+=`<div style="margin-top:10px;border:1px solid #a16207;border-radius:8px;padding:8px;font-size:12px;background:#1c1408"><div style="color:#facc15;font-weight:bold;margin-bottom:4px">🛠️ Admin info</div>
      Email: ${esc(data.email)}<br>Role: ${esc(data.role)}${data.banned?' · <span style="color:#f87171">BANNED</span>':''}<br>
      Pending gold: ${data.pending_gold} · Pending removal: ${data.gold_penalty}<br>Invited by: ${esc(data.invited_by||'—')} · Invited ${data.invited_n} players</div>`;
  }
  html+=`<div style="font-size:11px;color:#71717a;margin-top:8px">Numbers are reported by the player's browser and update when they open the game.</div>`;
  body.innerHTML=html;
}
function syncSpam(){   // 'unlimited abilities' is stored in the save, so it can be given to any player
  if(S.unlimAb&&!spamT)spamT=setInterval(()=>{try{if(G&&G.abUsed&&!G.abBusy)G.abUsed=null}catch(e){}},250);
  if(!S.unlimAb&&spamT){clearInterval(spamT);spamT=null}
  const b=$('#adm-spam');if(b)b.textContent='Unlimited abilities: '+(S.unlimAb?'ON':'OFF');
}
function doReset(){
  cloudPause=true;
  try{const o=(S&&S.owner)||localStorage.suff_owner;if(o)localStorage.removeItem('suff_save_'+o)}catch(e){}
  try{localStorage.sufference_backup=localStorage.sufference_save_v14||'';localStorage.removeItem('sufference_save_v14');localStorage.suff_skip_unlock='1'}catch(e){}
  const go=()=>location.reload();
  try{Promise.race([sb.rpc('clear_game'),new Promise(r=>setTimeout(r,2500))]).then(go,go)}catch(e){go()}
}
function applyTool(k,d){
  const on=d>0;
  if(k==='shopall'){
    const h=shopS();
    for(const x in SKINS){if(on)h.own['skin'+x]=1;else delete h.own['skin'+x]}
    for(const x in WPNS){if(on)h.own['wpn'+x]=1;else delete h.own['wpn'+x]}
    for(const x in PETS){if(on)h.own['pet'+x]=1;else if(x!=='crow')delete h.own['pet'+x]}
    if(!on){delete h.eq.skin;delete h.eq.wpn;if(h.eq.pet&&h.eq.pet!=='crow')h.eq.pet='crow'}
  }else if(k==='bonds'){
    S.pb=S.pb||{};
    for(const x in PETS){const b=S.pb[x]||(S.pb[x]={nm:'',xp:0,fed:0,mood:50,lp:0,food:0});if(on){b.xp=Math.max(b.xp||0,1e9);b.mood=100;b.fed=Math.max(b.fed||0,99);b.food=20}else b.xp=0}
  }else if(k==='unlimited'){S.unlimAb=on?1:0;syncSpam()}
  else if(k==='reset'&&on){doReset()}
}
async function claimOps(){   // apply anything an admin queued for this account
  try{
    const {data,error}=await sb.rpc('claim_ops');
    if(error||!Array.isArray(data)||!data.length)return;
    if(data.some(o=>o.c==='tool'&&o.k==='reset'&&o.d>0)){localStorage.suff_notice='An admin reset your save.';doReset();return}
    let n=0;for(const op of data){try{applyOp(op);n++}catch(e){console.error(e)}}
    save();refreshGame();
    say('🎁 An admin updated your inventory ('+n+' change'+(n>1?'s':'')+')');
  }catch(e){console.error(e)}
}

function fillItemKeys(){
  const c=$('#it-cat').value;
  $('#it-key').innerHTML=(c==='tool'?'':'<option value="*">★ ALL</option>')+optList(c).map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('');
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
  if(c==='tool'&&k==='reset'){
    if(d<0)return say('Reset only works with Give');
    if(!confirm('Reset '+(name?name+"'s":'YOUR')+' save? This wipes gold, decks and progress.'))return;
  }
  const self=!name||(profile.username&&name.toLowerCase()===profile.username.toLowerCase());
  if(self)return admin(()=>applyOp(op),opLabel(op)+' for you');
  const {data,error}=await sb.rpc('admin_queue_op',{target_name:name,p_op:op});
  if(error)return say('Failed: '+error.message);
  if(data==='ok')say('📨 Queued for '+name+': '+opLabel(op));
  else if(data==='no_such_player')say('No player named "'+name+'"');
  else say('Could not queue that: '+data);
}


// ================= v13: cloud save (progress follows the Google account, not the browser) =================
let cloudPause=false,cloudBusy=false,cloudWarned=false;
const CLOUD_MAX=1800000;   // matches the limit in save_game()
function saveIsBlank(){
  try{return !S.shop&&!(S.mem&&S.mem.runs)&&!Object.keys(S.seen||{}).length&&!(S.st&&S.st.tot)&&(!S.decks||S.decks.length<=1)}catch(e){return true}
}
function adoptCloud(obj,at){   // put the cloud copy in place of the local save, then reload
  try{
    localStorage.sufference_local_backup=localStorage[MAIN]||'';   // never throw the local copy away
    obj.owner=myId;obj.cloudAt=at;
    localStorage[MAIN]=JSON.stringify(obj);
    localStorage.suff_owner=myId;
  }catch(e){return false}
  cloudPause=true;location.reload();return true;
}
// returns true if it is reloading the page
async function cloudSync(){
  try{
    if(!sb||!myId||cloudPause)return false;
    const {data,error}=await sb.rpc('load_game');
    if(error){console.error('cloud load',error);return false}
    const remote=data&&data.save?data:null;
    if(!remote){                                   // nothing in the cloud yet: upload what this browser has
      if(!saveIsBlank())await cloudSave(true,true);
      return false;
    }
    const rAt=Date.parse(remote.saved_at),lAt=S.cloudAt?Date.parse(S.cloudAt):0;
    if(saveIsBlank())return adoptCloud(remote.save,remote.saved_at);   // new browser / cleared browser: bring the progress back
    if(lAt&&rAt<=lAt+1)return false;               // this browser is already up to date
    const keep=confirm('Your account has a saved game in the cloud'+(lAt?' that is newer than this browser\'s copy':'')+'.\n\nOK = load the cloud save (this browser\'s copy is kept as a backup)\nCancel = keep THIS browser\'s save and overwrite the cloud');
    if(keep)return adoptCloud(remote.save,remote.saved_at);
    await cloudSave(true,true);
    return false;
  }catch(e){console.error(e);return false}
}
async function cloudSave(quiet,force){
  if(cloudBusy||cloudPause||!sb||!myId)return;
  try{
    if(!S||S.owner!==myId||saveIsBlank())return;   // never upload another account's save or an empty one
    const blob=JSON.stringify(S);
    if(blob.length>CLOUD_MAX){if(!cloudWarned){cloudWarned=true;say('Your save is too large for cloud backup')}return}
    cloudBusy=true;
    const {data,error}=await sb.rpc('save_game',{p_save:S,p_base:S.cloudAt||null,p_force:!!force});
    if(error){console.error('cloud save',error);return}
    if(data&&data.status==='ok'){S.cloudAt=data.at;save()}
    else if(data&&data.status==='conflict'&&!cloudWarned){
      cloudWarned=true;
      say('Another device saved newer progress. Reload the page to choose which save to keep.');
    }
  }catch(e){console.error(e)}
  finally{cloudBusy=false}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')cloudSave(true)});
window.addEventListener('pagehide',()=>cloudSave(true));

// ================= v13: Profile tab (pick a player, see their gold, runs, pet, weapon and armor) =================
let pfPlayers=[],pfSel=null,pfFilter='';
const pfBox=(l,v)=>`<div class="acct-stat">${l}<b>${esc(v==null||v===''?'—':v)}</b></div>`;
function pfTabOn(){const t=$('#t-p');return !!t&&!t.hidden}
function pfItem(label,table,key,owned){
  const it=key&&table&&table[key];
  return `<div style="background:#0b0912;border:1px solid #27272a;border-radius:8px;padding:8px;text-align:left">
    <div style="font-size:11px;color:#a1a1aa">${label}</div>
    <div style="color:#fff;font-weight:bold;font-size:14px;margin-top:2px">${it?esc(it.n):'<span style="color:#71717a">None equipped</span>'}</div>
    ${it&&it.d?`<div style="font-size:11px;color:#a1a1aa;margin-top:2px">${esc(it.d)}</div>`:''}
    ${owned!=null?`<div style="font-size:11px;color:#71717a;margin-top:4px">Owns ${esc(owned)}</div>`:''}</div>`;
}
async function profileTabOpen(){
  const el=$('#t-p');if(!el)return;
  if(!sb||!myId){
    el.innerHTML=`<h3 class="title-font text-lg font-bold text-emerald-400 border-b border-emerald-950 pb-2 text-left">👤 Player Profiles</h3>
      <div style="color:#a1a1aa;font-size:14px;text-align:center;padding:16px 0">Sign in with Google to see other players' profiles.</div>
      <button id="pf-signin" type="button" class="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold py-3 rounded-lg title-font">👤 Sign in</button>`;
    const b=$('#pf-signin');if(b)b.onclick=()=>{const a=$('#acctbtn');if(a)a.click()};
    return;
  }
  el.innerHTML=`<h3 class="title-font text-lg font-bold text-emerald-400 border-b border-emerald-950 pb-2 text-left">👤 Player Profiles</h3>
    <input id="pf-search" type="text" placeholder="Search players…" autocomplete="off" style="width:100%;background:#0b0912;border:1px solid #27272a;border-radius:6px;padding:8px;color:#fff;font-size:14px">
    <div id="pf-list" style="max-height:170px;overflow-y:auto;border:1px solid #27272a;border-radius:8px;background:#0b0912">Loading…</div>
    <div id="pf-card"></div>`;
  $('#pf-search').oninput=e=>{pfFilter=e.target.value.trim().toLowerCase();pfRenderList()};
  $('#pf-list').onclick=e=>{const r=e.target.closest('[data-pf]');if(r)pfSelect(r.dataset.pf)};
  await syncStats();   // so your own numbers are current
  const {data,error}=await sb.rpc('get_players');
  if(error){$('#pf-list').textContent='Could not load: '+error.message;return}
  pfPlayers=data||[];
  if(!pfSel||!pfPlayers.some(r=>r.uname===pfSel))pfSel=profile.username&&pfPlayers.some(r=>r.uname===profile.username)?profile.username:(pfPlayers[0]&&pfPlayers[0].uname)||null;
  pfRenderList();
  if(pfSel)pfSelect(pfSel);else $('#pf-card').innerHTML='<div style="color:#a1a1aa;text-align:center">No players yet.</div>';
}
function pfRenderList(){
  const box=$('#pf-list');if(!box)return;
  const rows=pfPlayers.filter(r=>!pfFilter||String(r.uname).toLowerCase().includes(pfFilter));
  box.innerHTML=rows.length?rows.map(r=>`<div data-pf="${esc(r.uname)}" style="cursor:pointer;display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-bottom:1px solid #27272a;${r.featured?'background:#2a1f05;':''}${r.uname===pfSel?'outline:1px solid #34d399;outline-offset:-1px;':''}">
      <span style="text-align:left">${r.featured?'⭐ ':''}<b style="color:${r.featured?'#facc15':'#fff'}">${esc(r.uname)}</b>${r.uname===profile.username?' <span style="color:#34d399;font-size:11px">(you)</span>':''}</span>
      <span style="color:#a1a1aa;font-size:12px;white-space:nowrap">${r.solved} puzzles</span></div>`).join(''):'<div style="color:#a1a1aa;padding:8px">No match.</div>';
}
async function pfSelect(name){
  pfSel=name;pfRenderList();
  const card=$('#pf-card');if(!card)return;
  card.textContent='Loading…';
  const {data,error}=await sb.rpc(isAdmin?'admin_get_player':'get_player',{p_name:name});
  if(pfSel!==name)return;   // another player was picked meanwhile
  if(error){card.textContent='Could not load: '+error.message;return}
  if(!data){card.textContent='Player not found';return}
  const st=data.stats||{},eq=st.eq||{},has=v=>v!==undefined&&v!==null;
  const d=v=>v?new Date(v).toLocaleDateString():'—';
  const num=v=>has(v)?Number(v).toLocaleString():null;
  const PT_=typeof PETS!=='undefined'?PETS:null,WP_=typeof WPNS!=='undefined'?WPNS:null,SK_=typeof SKINS!=='undefined'?SKINS:null;
  card.innerHTML=`<div style="border:1px solid #27272a;border-radius:10px;padding:12px;background:#0f0c18;text-align:left">
    <div style="font:bold 20px sans-serif;color:#fff">${data.featured?'⭐ ':''}${esc(data.name)}</div>
    <div style="font-size:12px;color:#a1a1aa;margin:2px 0 10px">Joined ${d(data.joined)} · Last seen ${d(data.last_seen)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${pfBox('🪙 Gold',num(st.gold))}${pfBox('⚔️ Runs',num(data.runs))}
      ${pfBox('🧩 Puzzles solved',num(data.solved))}${pfBox('🔥 Best streak',num(data.streak))}
      ${pfBox('🏅 Achievements',has(st.badges)?st.badges+' / '+(st.badgesMax||12):null)}${pfBox('💀 Deaths seen',has(st.deaths)?st.deaths+' / '+(st.deathsMax||40):null)}
    </div>
    <div style="color:#facc15;font-weight:bold;margin:12px 0 6px;font-size:13px">Loadout</div>
    <div style="display:grid;grid-template-columns:1fr;gap:6px">
      ${pfItem('🐾 Favourite pet',PT_,eq.pet,has(st.pets)?st.pets+' pets':null)}
      ${pfItem('🗡️ Favourite weapon',WP_,eq.blade,has(st.blades)?st.blades+' blades':null)}
      ${pfItem('🛡️ Armor',SK_,eq.skin,has(st.skins)?st.skins+' skins':null)}
    </div>
    <div style="font-size:11px;color:#71717a;margin-top:8px">Numbers are reported by the player's browser and update when they open the game.</div></div>`;
}
window.profileTabOpen=profileTabOpen;

// ---------- start ----------
function start(){
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  buildUI();buildExtra();
  setInterval(()=>{if(roleName!=='unknown'||profile.code)syncStats()},90000);
  setInterval(()=>cloudSave(true),60000);
  sb.auth.onAuthStateChange((ev,session)=>{
    if(session&&(ev==='SIGNED_IN'||ev==='INITIAL_SESSION'))setTimeout(afterLogin,0);
    else{render();if(pfTabOn())profileTabOpen()}
  });
}
const s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
s.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()};
document.head.appendChild(s);
})();
