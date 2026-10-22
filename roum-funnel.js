/* 로움 개인회생 비밀상담 멀티스텝 폼 · 동작 스크립트 (v3)
   아임웹: 이 내용을 <script> ... </script>로 감싸 Body 코드에 넣으세요.
   VS Code: index.html 맨 아래에서 <script src="roum-funnel.js">로 불러옵니다. */
(function(){
'use strict';

/* ================= 설정 (여기만 고치면 됩니다) ================= */
var CFG={
 /* DB 적재 주소. 비워 두면 미리보기 모드(실제 전송 없음).
    POST · Content-Type text/plain · 본문은 JSON 문자열 (구글 Apps Script 웹앱, 자체 서버 모두 가능) */
 LEAD_ENDPOINT:'',
 SOURCE:'roum-rehab-v3',
 /* 최대 탕감률(%) — 메인 게이지·카드·상담 약속에 함께 반영 */
 MAX_RATE:95,
 /* "로움에선 ____까지 탕감했습니다" (만원 단위) ※ 실제 최대 탕감액으로 교체 */
 MAX_RELIEF_MAN:12400,
 /* 실제 수임 사례로 바꾸기 전까지 true → 사례에 '예시' 표시 */
 CASES_ARE_EXAMPLES:true,
 /* ※ 화면 구성용 예시 사례. 실제 사례(비식별)로 교체하세요. before/after = 월 납부액(만원) */
 CASES:{
  '직장인':[
   {who:'30대 회사원 K씨',meta:'빚 4,200만원 · 개인회생',before:100,after:20},
   {who:'40대 영업직 P씨',meta:'빚 6,800만원 · 개인회생',before:150,after:32},
   {who:'20대 사회초년생 L씨',meta:'빚 2,600만원 · 개인회생',before:70,after:15}
  ],
  '무직':[
   {who:'50대 실직 후 C씨',meta:'빚 5,500만원 · 개인파산·면책',before:110,after:0},
   {who:'40대 경력단절 J씨',meta:'빚 3,200만원 · 개인파산·면책',before:65,after:0},
   {who:'60대 은퇴 후 S씨',meta:'빚 4,800만원 · 개인파산·면책',before:90,after:0}
  ]
 }
};

/* 무직 4단계 / 직장인 5단계 */
var FLOWS={'무직':['debt','interest','cases','form'],'직장인':['debt','income','interest','cases','form']};

/* 배경: 단계가 진행될수록 어두운 남색 → 밝은 새벽빛 */
var STAGES=[
 {a:'#031536',b:'#0A2853',light:0,   tone:'dark'},
 {a:'#0A2853',b:'#2F456E',light:.06, tone:'dark'},
 {a:'#2F456E',b:'#54668D',light:.16, tone:'dark'},
 {a:'#46597F',b:'#7387AE',light:.3,  tone:'dark'},
 {a:'#C3D0E6',b:'#F1F4FA',light:.55, tone:'light'},
 {a:'#DCE5F4',b:'#FFF6E6',light:1,   tone:'light'}
];

var ALERTS={
 '무직':{head:'걱정하지 마세요, 개인파산·면책 제도가 있습니다',items:[
  ['소득이 없어도 괜찮아요','개인파산·면책은 갚을 능력이 없는 분을 위해 법이 마련한 제도입니다.'],
  ['면책되면 남은 빚은 끝','법원의 면책 결정이 나면 남은 빚을 더 이상 갚지 않아도 됩니다.'],
  ['다시 일하는 데 전혀 문제없어요','회사 취업도, 아르바이트도 그대로 할 수 있어요. 새 출발의 걸림돌이 되지 않습니다.'],
  ['가족·회사에 알리지 않아요','상담 사실은 비밀로 지키고, 원하는 시간에만 연락드립니다.'],
  ['독촉 전화도 멈출 수 있어요','변호사를 선임하면 채권자의 직접 추심 연락을 막을 수 있습니다.']
 ],fine:'법원 판단과 개인 상황에 따라 결과가 달라질 수 있습니다. 세금·벌금 등 일부 채무는 면책되지 않으며, 일부 공무원·전문 자격은 복권 전까지 제한될 수 있습니다.'},
 '직장인':{head:'월급이 있다면, 개인회생으로 줄일 수 있습니다',items:[
  ['원금까지 줄이는 방법','소득이 있으면 개인회생으로 이자는 물론 원금 일부까지 탕감받을 수 있습니다.'],
  ['회사에 알리지 않아요','상담 사실은 비밀로 지키고, 퇴근 후 야간에도 상담할 수 있습니다.']
 ],fine:'탕감 범위는 소득·재산·채무 구성과 법원 판단에 따라 달라집니다.'}
};
var NEXT={income:'다음',interest:'다음',cases:'특혜 알아보기',form:'내 변제금 바로 확인하기',done:'처음으로'};
var ICON_OK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
var ICON_ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* ================================================================ */
function init(){
 var root=document.getElementById('rw-page');
 if(!root||root.__rwReady)return;root.__rwReady=true;
 var $=function(id){return document.getElementById(id)};
 var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 var S={status:'',debt:'',income:'',interest:100,slot:'',step:'',idx:0,sending:false,done:null,timers:[]};
 var nextBtn=$('rw-next'),scenes=[].slice.call(root.querySelectorAll('.rw-scene')),range=$('rw-int'),phone=$('rw-phone');

 function flow(){return FLOWS[S.status||'직장인']}
 function later(fn,ms){S.timers.push(setTimeout(fn,ms))}
 function clearTimers(){S.timers.forEach(clearTimeout);S.timers=[]}
 function restart(el,c){el.classList.remove(c);void el.offsetWidth;el.classList.add(c)}
 function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function man(n){n=Math.round(n);if(n<=0)return '0원';var e=Math.floor(n/10000),r=n%10000;return (e?e+'억':'')+(r?(e?' ':'')+r.toLocaleString('ko-KR')+'만원':'원')}
 function manDec(n){return (Math.round(n*10)/10).toLocaleString('ko-KR')+'만원'}
 function each(sel,fn){[].forEach.call(root.querySelectorAll(sel),fn)}

 /* 최대 탕감률 반영 */
 each('[data-rw-rate]',function(el){el.textContent=CFG.MAX_RATE});

 /* ── 메인 게이지: 0 → 최대 탕감률 ── */
 (function gauge(){
  var arc=$('rw-arc'),dot=$('rw-arc-dot'),num=root.querySelector('.rw-gauge [data-rw-rate]'),to=CFG.MAX_RATE;
  function set(p){arc.setAttribute('stroke-dashoffset',100-p);var a=Math.PI*(1-p/100);dot.setAttribute('cx',(150+130*Math.cos(a)).toFixed(1));dot.setAttribute('cy',(160-130*Math.sin(a)).toFixed(1));num.textContent=Math.round(p)}
  if(reduce){set(to);return}
  set(0);var t0=0;
  setTimeout(function(){requestAnimationFrame(function f(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/1800),e=1-Math.pow(1-k,3);set(to*e);if(k<1)requestAnimationFrame(f)})},350);
 })();

 /* ── 배경 전환 ── */
 var gA=$('rw-g1'),gB=$('rw-g2'),front=gA;
 function stage(i){
  var s=STAGES[Math.max(0,Math.min(STAGES.length-1,i))],back=front===gA?gB:gA;
  back.style.setProperty('--a',s.a);back.style.setProperty('--b',s.b);
  back.classList.add('is-on');front.classList.remove('is-on');front=back;
  $('rw-light').style.setProperty('--light',s.light);
  root.setAttribute('data-tone',s.tone);
 }
 function stageFor(i,n){return Math.round(i*(STAGES.length-2)/Math.max(1,n-1))}

 /* ── 화면 전환 ── */
 function view(v){
  root.setAttribute('data-view',v);
  $('rw-hero').hidden=v!=='hero';$('rw-steps').hidden=v!=='steps';
  if(v==='hero'){gA.classList.remove('is-on');gB.classList.remove('is-on');$('rw-light').style.setProperty('--light',0);root.setAttribute('data-tone','dark')}
 }
 function toTop(){var r=root.getBoundingClientRect();if(r.top<0||r.top>60){try{window.scrollTo({top:window.pageYOffset+r.top,behavior:reduce?'auto':'smooth'})}catch(e){window.scrollTo(0,window.pageYOffset+r.top)}}}

 function renderProg(){
  var n=flow().length;
  $('rw-prog').style.setProperty('--p',S.step==='done'?1:(S.idx+1)/n);
  $('rw-count').innerHTML=S.step==='done'?'<b>완료</b>':'<b>'+(S.idx+1)+'</b> / '+n;
 }
 function ready(){
  if(S.step==='debt'){if(!S.status)return {msg:'무직 / 직장인을 먼저 골라 주세요',el:$('rw-status')};if(!S.debt)return {msg:'빚 규모를 골라 주세요',el:$('rw-debt')}}
  if(S.step==='income'&&!S.income)return {msg:'월 소득을 골라 주세요',el:$('rw-income')};
  return true;
 }
 function syncNext(){
  var label=NEXT[S.step]||'다음';
  if(S.step==='form'&&S.sending)label='접수하고 있어요…';
  nextBtn.innerHTML=esc(label)+(S.step==='done'?'':ICON_ARROW);
  nextBtn.setAttribute('aria-disabled',ready()===true&&!S.sending?'false':'true');
  nextBtn.classList.toggle('is-shine',S.step==='cases'||S.step==='form');
 }
 function show(step,back){
  clearTimers();
  scenes.forEach(function(s){var on=s.getAttribute('data-step')===step;s.hidden=!on;s.classList.remove('is-back');if(on){if(back)s.classList.add('is-back');restart(s,'rw-scene')}});
  S.step=step;
  stage(step==='done'?STAGES.length-1:stageFor(S.idx,flow().length));
  if(step==='interest')calc();
  if(step==='cases')renderCases();
  renderProg();syncNext();toTop();
  var sc=root.querySelector('.rw-scene[data-step="'+step+'"]');if(sc)try{sc.focus({preventScroll:true})}catch(e){}
 }
 function go(i,back){S.idx=i;show(flow()[i],back)}
 function start(toForm){
  view('steps');
  if(S.done){show('done');return}
  go(toForm?flow().indexOf('form'):0);
 }
 function home(){clearTimers();view('hero');toTop()}

 /* ── 상황 / 빚 ── */
 $('rw-status').addEventListener('click',function(e){
  var b=e.target.closest('[data-status]');if(!b)return;
  var v=b.getAttribute('data-status');
  $('rw-status').classList.add('is-set');
  each('#rw-status [data-status]',function(t){t.setAttribute('aria-selected',t===b?'true':'false')});
  $('rw-debt-wrap').hidden=false;
  if(S.status!==v){S.status=v;renderAlerts(v)}
  renderProg();syncNext();
 });
 function renderAlerts(v){
  var a=ALERTS[v],box=$('rw-alerts'),h='<p class="rw-alerts-head">'+ICON_OK+'<span>'+esc(a.head)+'</span></p><ul>';
  a.items.forEach(function(it,i){h+='<li class="rw-push" style="--i:'+i+'"><span class="rw-push-ico">'+ICON_OK+'</span><div><p class="rw-push-top"><span>로움 법률사무소</span><span>'+(i?i+'분 전':'지금')+'</span></p><b>'+esc(it[0])+'</b><p>'+esc(it[1])+'</p></div></li>'});
  box.innerHTML=h+'</ul><p class="rw-fine">'+esc(a.fine)+'</p>';box.hidden=false;
 }
 function bindOpts(id,key,after){
  $(id).addEventListener('click',function(e){
   var b=e.target.closest('.rw-opt');if(!b)return;
   S[key]=b.getAttribute('data-v');
   each('#'+id+' .rw-opt',function(o){o.setAttribute('aria-pressed',o===b?'true':'false')});
   if(after)after();syncNext();
  });
 }
 bindOpts('rw-debt','debt');
 bindOpts('rw-income','income',function(){$('rw-income-tip').hidden=false});

 /* ── 월 이자 ── */
 function calc(){
  var v=+range.value,min=+range.min,max=+range.max;S.interest=v;
  range.style.setProperty('--p',((v-min)/(max-min)*100)+'%');
  $('rw-int-out').innerHTML=v+'<small>만원</small>';
  $('rw-m-now').setAttribute('stroke-dashoffset',(100-v/max*100).toFixed(2));
  $('rw-m-goal').setAttribute('stroke-dashoffset',(100-v/10/max*100).toFixed(2));
  $('rw-year').textContent=man(v*12);
  $('rw-goal').textContent='월 '+manDec(v/10);
  $('rw-save').textContent='1년에 '+man(v*12*.9)+' 절약';
  each('#rw-quick [data-v]',function(c){c.setAttribute('aria-pressed',+c.getAttribute('data-v')===v?'true':'false')});
 }
 range.addEventListener('input',calc);
 $('rw-quick').addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(!b)return;range.value=b.getAttribute('data-v');calc()});

 /* ── 탕감 사례 ── */
 function countUp(el,to){
  if(reduce){el.textContent=man(to);return}
  var t0=0;requestAnimationFrame(function f(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/1500),e=1-Math.pow(1-k,3);el.textContent=man(Math.round(to*e/10)*10);if(k<1)requestAnimationFrame(f)});
 }
 function renderCases(){
  var key=S.status||'직장인',h='';
  CFG.CASES[key].forEach(function(c,i){
   var zero=c.after===0;
   h+='<article class="rw-case" style="--i:'+i+'"><p class="rw-case-h"><b>'+esc(c.who)+'</b><small>'+esc(c.meta)+'</small>'+(CFG.CASES_ARE_EXAMPLES?'<span class="rw-ex">예시</span>':'')+'</p>'+
    '<div class="rw-case-f"><div><span>원래 내던 이자</span><s>월 '+c.before+'만원</s></div>'+ICON_ARROW+'<div><span>'+(zero?'면책 후':'지금 내는 변제금')+'</span><strong>'+(zero?'0원':'월 '+c.after+'만원')+'</strong></div></div>'+
    '<div class="rw-case-bar" aria-hidden="true"><i style="--v:'+Math.max(.015,c.after/c.before)+'"></i></div></article>';
  });
  $('rw-cases').innerHTML=h;$('rw-cases').classList.remove('is-run');
  $('rw-cases-sub').textContent=key==='무직'?'소득이 없던 분들의 개인파산·면책 사례입니다.':'월급을 받던 분들의 개인회생 사례입니다.';
  $('rw-cases-fine').textContent=(CFG.CASES_ARE_EXAMPLES?'사례는 이해를 돕기 위한 예시입니다. ':'개인정보 보호를 위해 일부 정보를 바꿨습니다. ')+'결과는 소득·재산·채무 구성과 법원 판단에 따라 달라지며, 같은 결과를 보장하지 않습니다.';
  countUp($('rw-total'),CFG.MAX_RELIEF_MAN);
  later(function(){$('rw-cases').classList.add('is-run')},120);
 }

 /* ── 상담 신청 ── */
 phone.addEventListener('input',function(){var d=phone.value.replace(/\D/g,'');if(d.indexOf('010')===0&&d.length>8)d=d.slice(3);d=d.slice(0,8);phone.value=d.length>4?d.slice(0,4)+'-'+d.slice(4):d;phone.classList.remove('is-invalid')});
 $('rw-name').addEventListener('input',function(){this.classList.remove('is-invalid')});
 $('rw-slots').addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(!b)return;S.slot=b.getAttribute('data-v');$('rw-slots').classList.remove('is-invalid');each('#rw-slots [data-v]',function(o){o.setAttribute('aria-pressed',o===b?'true':'false')})});
 $('rw-agree').addEventListener('change',function(){$('rw-agree-row').classList.remove('is-invalid')});
 $('rw-form').addEventListener('submit',function(e){e.preventDefault();submit()});
 function bad(el,msg){var r=$('rw-err');r.textContent=msg;r.hidden=false;el.classList.add('is-invalid');restart(el,'is-nudge');try{el.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'})}catch(e){}if(el.tagName==='INPUT')try{el.focus({preventScroll:true})}catch(e){}}
 function uid(){return 'rw-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
 function utm(){var o={};try{var q=new URLSearchParams(location.search);['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','n_keyword','n_ad'].forEach(function(k){var v=q.get(k);if(v)o[k]=v.slice(0,300)})}catch(e){}return o}
 function submit(){
  if(S.sending)return;
  $('rw-err').hidden=true;
  if($('rw-website').value)return;
  var name=$('rw-name').value.trim(),d=phone.value.replace(/\D/g,'');
  if(name.length<2)return bad($('rw-name'),'이름을 2자 이상 입력해 주세요.');
  if(!/^\d{8}$/.test(d))return bad(phone,'010 뒤 8자리 번호를 입력해 주세요.');
  if(!S.slot)return bad($('rw-slots'),'원하는 상담 시간대를 골라 주세요.');
  if(!$('rw-agree').checked)return bad($('rw-agree-row'),'개인정보 수집·이용에 동의해 주세요.');
  var data={event_id:uid(),source:CFG.SOURCE,submitted_at:new Date().toISOString(),name:name,phone:'010'+d,time_slot:S.slot,status:S.status||'',debt:S.debt||'',income:S.status==='직장인'?S.income:'',monthly_interest_man:S.interest,privacy:'Y',page:location.href.split('#')[0].slice(0,500),referrer:document.referrer.slice(0,500),utm:utm()};
  S.sending=true;syncNext();
  if(!CFG.LEAD_ENDPOINT){$('rw-preview-note').hidden=false;later(function(){S.sending=false;finish(data)},700);return}
  var ctrl=window.AbortController?new AbortController():null,timer=setTimeout(function(){if(ctrl)ctrl.abort()},12000);
  fetch(CFG.LEAD_ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),credentials:'omit',signal:ctrl?ctrl.signal:undefined})
   .then(function(r){if(!r.ok)throw new Error('bad');S.sending=false;finish(data);lead(data.event_id)})
   .catch(function(){S.sending=false;syncNext();var r=$('rw-err');r.textContent='접수가 늦어지고 있어요. 잠시 후 다시 눌러 주세요.';r.hidden=false})
   .then(function(){clearTimeout(timer)});
 }
 function lead(id){
  /* 전환 스크립트는 이 신호를 받아 1회 전송: document.addEventListener('rw:lead',fn) */
  try{document.dispatchEvent(new CustomEvent('rw:lead',{detail:{event_id:id}}))}catch(e){}
  try{if(typeof window.fbq==='function')window.fbq('track','Lead',{content_name:'로움 개인회생 비밀상담'},{eventID:id})}catch(e){}
 }
 function finish(d){
  S.done=d;
  $('rw-t-done').textContent=d.name+'님, 비밀상담이 접수되었습니다';
  var rows=[['연락처','010-'+d.phone.slice(3,7)+'-'+d.phone.slice(7)],['원하는 시간대',d.time_slot],['현재 상황',d.status||'-'],['빚 규모',d.debt||'-']];
  if(d.income)rows.push(['월 소득',d.income]);
  rows.push(['현재 월 이자','월 '+d.monthly_interest_man+'만원']);
  $('rw-receipt').innerHTML=rows.map(function(r){return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>'}).join('');
  show('done');
 }

 /* ── 버튼 ── */
 nextBtn.addEventListener('click',function(){
  if(S.step==='done'){home();return}
  if(S.sending)return;
  var r=ready();if(r!==true){restart(nextBtn,'is-shake');restart(r.el,'is-nudge');try{r.el.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'})}catch(e){}nextBtn.innerHTML=esc(r.msg);later(syncNext,1600);return}
  if(S.step==='form'){submit();return}
  go(flow().indexOf(S.step)+1);
 });
 $('rw-back').addEventListener('click',function(){if(S.step==='done'){home();return}var i=flow().indexOf(S.step);if(i>0)go(i-1,true);else home()});
 $('rw-close').addEventListener('click',home);
 $('rw-start').addEventListener('click',function(){start(false)});
 $('rw-skip').addEventListener('click',function(){start(true)});
 $('rw-policy-open').addEventListener('click',function(){$('rw-policy').hidden=false;$('rw-policy-ok').focus()});
 $('rw-policy-ok').addEventListener('click',function(){$('rw-policy').hidden=true;$('rw-agree').checked=true;$('rw-agree-row').classList.remove('is-invalid')});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('rw-policy').hidden)$('rw-policy').hidden=true});

 /* 단계 상단 바: 스크롤되면 배경 깔기 */
 var head=$('rw-steps-head');
 window.addEventListener('scroll',function(){head.classList.toggle('is-stuck',head.getBoundingClientRect().top<=0&&root.getBoundingClientRect().top<-4)},{passive:true});

 calc();
 window.roumFunnel={version:'3.0'};
}
/* 위젯 화면이 늦게 그려져도 찾을 때까지 기다렸다 실행 */
function boot(){var n=0;(function t(){if(document.getElementById('rw-page')){init();return}if(++n<40)setTimeout(t,250)})()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
