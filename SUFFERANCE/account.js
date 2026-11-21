/* SUFFERANCE accounts + referrals (Supabase). Fill in the two values below. */
(function(){
const SUPABASE_URL='https://qtkgagopbvmvpdgmvghz.supabase.co';        // e.g. https://abcdxyz.supabase.co
const SUPABASE_KEY='sb_publishable_yuGBDQKsZlJ0IR37wXMOMQ_rR_N8mR-';    // the "anon public" key, NOT service_role

// Remember a referral code from the link (?ref=abc12345) until the player is logged in
try{const r=new URLSearchParams(location.search).get('ref');if(r)localStorage.suff_ref=r.trim().toLowerCase()}catch(e){}

const $=s=>document.querySelector(s);
const say=m=>{try{toast(m)}catch(e){alert(m)}};
let sb=null,busy=false,myCode='';

// ---------- UI ----------
function buildUI(){
  const gold=$('#gold');if(!gold||$('#acctbtn'))return;
  const b=document.createElement('button');
  b.id='acctbtn';b.type='button';b.textContent='👤 Account';
  b.className='bg-zinc-900 px-3 py-1.5 rounded border border-emerald-900/50 text-emerald-300 hover:bg-emerald-950 transition whitespace-nowrap';
  gold.parentNode.insertBefore(b,gold);
  document.body.insertAdjacentHTML('beforeend',`
  <div id="acct-modal" style="display:none;position:fixed;inset:0;z-index:80;align-items:center;justify-content:center;background:rgba(0,0,0,.65)">
    <div style="background:#14101c;border:2px solid #34d399;border-radius:10px;padding:18px 22px;width:min(92vw,360px);color:#e6dcc0;font:14px sans-serif">
      <div style="font:900 20px Cinzel,serif;color:#34d399;margin-bottom:10px">👤 Account</div>
      <div id="acct-out">
        <input id="acct-email" type="email" placeholder="Email" autocomplete="email" style="width:100%;margin-bottom:8px;padding:8px;border-radius:6px;background:#0b0912;border:1px solid #3f3f46;color:#fff">
        <input id="acct-pass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password" style="width:100%;margin-bottom:8px;padding:8px;border-radius:6px;background:#0b0912;border:1px solid #3f3f46;color:#fff">
        <div id="acct-ref" style="font-size:12px;color:#fcd34d;margin-bottom:8px"></div>
        <button id="acct-login" style="background:#059669;color:#fff;font-weight:bold;padding:8px 16px;border-radius:6px;margin-right:8px">Log in</button>
        <button id="acct-signup" style="background:#1d4ed8;color:#fff;font-weight:bold;padding:8px 16px;border-radius:6px">Sign up</button>
      </div>
      <div id="acct-in" style="display:none">
        <div id="acct-who" style="margin-bottom:10px;color:#a7f3d0"></div>
        <div style="margin-bottom:4px">Invite friends: you get <b style="color:#facc15">1,000 gold</b>, they get <b style="color:#facc15">350 gold</b>.</div>
        <input id="acct-link" readonly style="width:100%;margin-bottom:8px;padding:8px;border-radius:6px;background:#0b0912;border:1px solid #3f3f46;color:#fff;font-size:12px">
        <button id="acct-copy" style="background:#a16207;color:#fff;font-weight:bold;padding:8px 16px;border-radius:6px;margin-right:8px">Copy link</button>
        <button id="acct-logout" style="background:#7f1d1d;color:#fff;font-weight:bold;padding:8px 16px;border-radius:6px">Log out</button>
      </div>
      <div style="margin-top:12px;text-align:right"><button id="acct-close" style="color:#a1a1aa;font-size:12px">Close</button></div>
    </div>
  </div>`);
  b.onclick=()=>{refreshUI();$('#acct-modal').style.display='flex'};
  $('#acct-close').onclick=()=>$('#acct-modal').style.display='none';
  $('#acct-login').onclick=login;
  $('#acct-signup').onclick=signup;
  $('#acct-logout').onclick=async()=>{await sb.auth.signOut();myCode='';refreshUI();say('Logged out')};
  $('#acct-copy').onclick=()=>{const i=$('#acct-link');i.select();try{navigator.clipboard.writeText(i.value)}catch(e){document.execCommand('copy')}say('Invite link copied!')};
}

async function refreshUI(){
  if(!sb)return;
  const {data:{session}}=await sb.auth.getSession();
  $('#acct-out').style.display=session?'none':'block';
  $('#acct-in').style.display=session?'block':'none';
  const ref=localStorage.suff_ref;
  $('#acct-ref').textContent=ref?'🎁 Referral code applied: sign up to get 350 gold!':'';
  if(session){
    $('#acct-who').textContent='Logged in as '+session.user.email;
    $('#acct-link').value=myCode?location.origin+location.pathname+'?ref='+myCode:'Loading…';
    $('#acctbtn').textContent='👤 '+session.user.email.split('@')[0];
  }else $('#acctbtn').textContent='👤 Account';
}

// ---------- auth ----------
async function signup(){
  const email=$('#acct-email').value.trim(),password=$('#acct-pass').value;
  if(!email||password.length<6)return say('Enter an email and a password of 6+ characters');
  const {data,error}=await sb.auth.signUp({email,password});
  if(error)return say(error.message);
  if(!data.session)say('Check your email and click the confirmation link, then log in.');
}
async function login(){
  const email=$('#acct-email').value.trim(),password=$('#acct-pass').value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error)say(error.message);
}

// ---------- after login: redeem referral, collect gold ----------
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
    const {data:p}=await sb.from('profiles').select('referral_code').maybeSingle();
    if(p)myCode=p.referral_code;
  }catch(e){console.error(e)}
  busy=false;refreshUI();
}

// ---------- start ----------
function start(){
  if(SUPABASE_URL.startsWith('PASTE'))return console.warn('account.js: add your Supabase URL and key');
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  buildUI();
  sb.auth.onAuthStateChange((ev,session)=>{
    if(session&&(ev==='SIGNED_IN'||ev==='INITIAL_SESSION'))setTimeout(afterLogin,0);
    else refreshUI();
  });
}
const s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
s.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()};
document.head.appendChild(s);
})();
