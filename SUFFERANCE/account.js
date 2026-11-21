/* SUFFERANCE accounts + referrals + player name + stats (Supabase, Google sign-in only) */
(function(){
const SUPABASE_URL='https://qtkgagopbvmvpdgmvghz.supabase.co';
const SUPABASE_KEY='sb_publishable_yuGBDQKsZlJ0IR37wXMOMQ_rR_N8mR-';

// Remember a referral code from the link (?ref=abc12345) until the player is logged in
try{const r=new URLSearchParams(location.search).get('ref');if(r)localStorage.suff_ref=r.trim().toLowerCase()}catch(e){}

const $=s=>document.querySelector(s);
const say=m=>{try{toast(m)}catch(e){alert(m)}};
let sb=null,busy=false,profile={username:null,code:''},editing=false,isAdmin=false;

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

        <div id="acct-admin" style="display:none;border:1px solid #a16207;border-radius:8px;padding:10px;margin-bottom:12px;background:#1c1408">
          <div style="font-weight:bold;color:#facc15;margin-bottom:6px">🛠️ Admin tools</div>
          <button id="adm-gold" class="acct-b" style="background:#a16207;margin:0 6px 6px 0">+100,000 gold</button>
          <button id="adm-unlock" class="acct-b" style="background:#7c3aed;margin:0 6px 6px 0">Unlock all shop items</button>
          <button id="adm-stock" class="acct-b" style="background:#0e7490;margin:0 6px 6px 0">Stock all run items (x99)</button>
        </div>

        <div style="font-weight:bold;color:#34d399;margin-bottom:4px">🎁 Invite friends</div>
        <div style="margin-bottom:6px;font-size:13px">You get <b style="color:#facc15">1,000 gold</b>, they get <b style="color:#facc15">350 gold</b>.</div>
        <input id="acct-link" class="acct-in" readonly style="font-size:12px;margin-bottom:8px">
        <button id="acct-copy" class="acct-b" style="background:#a16207;margin-right:8px">Copy link</button>
        <button id="acct-logout" class="acct-b" style="background:#7f1d1d">Log out</button>
      </div>

      <div style="margin-top:12px;text-align:right"><button id="acct-close" style="color:#a1a1aa;font-size:12px">Close</button></div>
    </div>
  </div>`);
  b.onclick=openModal;
  $('#acct-close').onclick=()=>$('#acct-modal').style.display='none';
  $('#acct-google').onclick=()=>sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  $('#acct-logout').onclick=async()=>{await sb.auth.signOut();profile={username:null,code:''};editing=false;isAdmin=false;render();say('Logged out')};
  $('#acct-copy').onclick=()=>{const i=$('#acct-link');i.select();try{navigator.clipboard.writeText(i.value)}catch(e){document.execCommand('copy')}say('Invite link copied!')};
  $('#acct-rename').onclick=()=>{editing=true;render();$('#acct-nameinput').value=profile.username||'';$('#acct-nameinput').focus()};
  $('#adm-gold').onclick=()=>admin(()=>{S.gold+=100000},'+100,000 gold');
  $('#adm-unlock').onclick=()=>admin(()=>{const h=shopS();for(const k in SKINS)h.own['skin'+k]=1;for(const k in WPNS)h.own['wpn'+k]=1;for(const k in PETS)h.own['pet'+k]=1},'Everything in the shop unlocked');
  $('#adm-stock').onclick=()=>admin(()=>{const h=shopS();for(const k in SHOP_ITEMS)h.inv[k]=99},'All run items stocked');
  $('#acct-namesave').onclick=saveName;
  $('#acct-nameinput').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')saveName()});
  $('#acct-nameinput').addEventListener('keyup',e=>e.stopPropagation());
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
function openModal(){render();$('#acct-modal').style.display='flex'}

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
  $('#acct-stats').innerHTML=statsHTML();
  const ranks=Object.entries(S.best||{}).slice(0,6).map(([k,v])=>k+': '+v).join(' · ');
  $('#acct-ranks').textContent=ranks?'🏆 Best ranks: '+ranks:'';
  $('#acct-link').value=profile.code?location.origin+location.pathname+'?ref='+profile.code:'Loading…';
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
    const {data:amt,error}=await sb.rpc('claim_pending_gold');
    if(!error&&amt>0){
      S.gold+=amt;save();
      const g=$('#gold');if(g)g.textContent='🪙 '+S.gold;
      try{shopGold()}catch(e){}
      say('🪙 +'+amt+' referral gold collected!');
    }
    let {data:p,error:pe}=await sb.from('profiles').select('referral_code,username').maybeSingle();
    if(pe){const r2=await sb.from('profiles').select('referral_code').maybeSingle();p=r2.data}
    if(p){profile.code=p.referral_code;profile.username=p.username||null}
    const {data:r}=await sb.from('user_roles').select('role').maybeSingle();
    isAdmin=!!(r&&r.role==='admin');
    if(isAdmin){   // admins always start with every shop item owned and at least 100,000 gold
      try{const h=shopS();for(const k in SKINS)h.own['skin'+k]=1;for(const k in WPNS)h.own['wpn'+k]=1;for(const k in PETS)h.own['pet'+k]=1;
        for(const k in SHOP_ITEMS)if((h.inv[k]||0)<99)h.inv[k]=99;
        if(S.gold<100000)S.gold=100000;save();
        const g=$('#gold');if(g)g.textContent='🪙 '+S.gold;try{shopGold()}catch(e){}try{shopRender()}catch(e){}}catch(e){console.error(e)}
    }
  }catch(e){console.error(e)}
  busy=false;
  await render();
  if(!profile.username)openModal();   // first login: ask for a name
}

// ---------- start ----------
function start(){
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  buildUI();
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
