const WA='923118500841';
// Add real prices below (number, in PKR). null shows "Ask for price".
const P=[
{id:1,n:'Heart Salt Lamp',c:'Salt Lamps',i:'heart-salt-lamp',d:'Heart-shaped Himalayan salt lamp, a warm and thoughtful gift.',p:null},
{id:2,n:'Sphere Salt Lamp',c:'Salt Lamps',i:'sphere-salt-lamp',d:'Round Himalayan salt lamp with a soft glowing centre.',p:null},
{id:3,n:'Cylinder Salt Lamp',c:'Salt Lamps',i:'cylinder-salt-lamp',d:'Compact cylinder salt lamp for desks and bedside tables.',p:null},
{id:4,n:'Rose Bucket Bag',c:'Crochet Bags',i:'rose-bucket-bag',d:'Cream crochet bag with handmade crochet roses.',p:null},
{id:5,n:'Plum Mini Bag',c:'Crochet Bags',i:'plum-mini-bag',d:'Small plum crochet bag with two crochet flowers.',p:null},
{id:6,n:'Patterned Pouch',c:'Crochet Bags',i:'patterned-pouch',d:'Crochet pouch with a cream flower and wrist loop.',p:null},
{id:7,n:'Crochet Rose Pot',c:'Flowers & Decor',i:'crochet-rose-pot',d:'A crochet rose in a handmade pot that never needs watering.',p:null},
{id:8,n:'Keychain Set',c:'Keychains',i:'keychain-set',d:'Football and crochet flower keychains, made by hand.',p:null}];
const $=s=>document.querySelector(s);let cart=JSON.parse(localStorage.getItem('tg')||'{}'),cat='All',revealObserver,themeTimer;
const money=p=>p?'Rs '+p.toLocaleString():'Ask for price';
function readTheme(){try{return localStorage.getItem('tg-theme')}catch(error){console.warn('Could not read the saved theme preference.',error);return null}}
function saveTheme(theme){try{localStorage.setItem('tg-theme',theme)}catch(error){console.warn('Could not save the theme preference.',error)}}
function setTheme(theme,persist=false){const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';
const button=$('#theme-toggle');button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',`Switch to ${dark?'bright':'dark'} mode`);
button.querySelector('.theme-icon').textContent=dark?'☀':'☾';button.querySelector('.theme-label').textContent=dark?'Bright mode':'Dark mode';
$('#brand-logo').src=dark?'logo-header-dark.svg':'logo-header.svg';document.querySelector('meta[name="theme-color"]').content=dark?'#191614':'#2B1D17';
if(persist)saveTheme(dark?'dark':'light')}
function watchReveal(elements){if(!('IntersectionObserver'in window))return;
if(!revealObserver)revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target)}}),{threshold:.12});
elements.forEach((element,index)=>{if(element.classList.contains('reveal'))return;element.style.setProperty('--reveal-delay',`${Math.min(index%4,3)*70}ms`);element.classList.add('reveal');revealObserver.observe(element)})}
function render(){$('#grid').innerHTML=P.filter(x=>cat==='All'||x.c===cat).map(x=>`<article class="card"><img loading="lazy" src="images/${x.i}.jpg" alt="${x.n}, handmade by Thread & Glow GB"><div><h3>${x.n}</h3><p>${x.d}</p><span class="price">${money(x.p)}</span><button class="btn" onclick="add(${x.id})">Add to cart</button></div></article>`).join('');
document.querySelectorAll('.cat').forEach(b=>b.classList.toggle('on',b.dataset.c===cat));watchReveal(document.querySelectorAll('#grid .card'))}
function save(){localStorage.setItem('tg',JSON.stringify(cart));draw()}
function add(id){cart[id]=(cart[id]||0)+1;save();$('#drawer').classList.add('open')}
function chg(id,d){cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];save()}
function draw(){const ids=Object.keys(cart);$('#count').textContent=ids.reduce((a,k)=>a+cart[k],0);
$('#items').innerHTML=ids.length?ids.map(k=>{const x=P.find(p=>p.id==k);return `<div class="line"><img src="images/${x.i}.jpg" alt=""><span>${x.n}<br><small>${money(x.p)}</small></span><span class="q"><button onclick="chg(${k},-1)">-</button> ${cart[k]} <button onclick="chg(${k},1)">+</button></span></div>`}).join(''):'<p>Your cart is empty.</p>';
const allPriced=ids.length>0&&ids.every(k=>P.find(p=>p.id==k).p!==null);const t=ids.reduce((a,k)=>a+(P.find(p=>p.id==k).p||0)*cart[k],0);
$('#total').textContent=allPriced?'Total: Rs '+t.toLocaleString():ids.length?'Final prices and delivery are confirmed on WhatsApp.':''}
function checkout(){const ids=Object.keys(cart);if(!ids.length)return;const l=ids.map(k=>`- ${P.find(p=>p.id==k).n} x ${cart[k]}`).join('\n');
open(`https://wa.me/${WA}?text=`+encodeURIComponent(`Assalamualaikum! I would like to order from Thread & Glow GB:\n${l}\n\nPlease confirm availability, prices, delivery and payment details.\nName:\nCity & address:`),'_blank')}
function sendForm(e){e.preventDefault();const f=e.target;const data=new FormData(f);open(`https://wa.me/${WA}?text=`+encodeURIComponent(`Hello Thread & Glow GB, I am ${data.get('name')}. ${data.get('msg')}`),'_blank')}
document.querySelectorAll('.cat').forEach(b=>b.onclick=()=>{cat=b.dataset.c;render()});
$('#cartbtn').onclick=()=>$('#drawer').classList.add('open');$('#close').onclick=()=>$('#drawer').classList.remove('open');
$('#menu').onclick=()=>{const open=$('#nav').classList.toggle('open');$('#menu').setAttribute('aria-expanded',String(open))};document.querySelectorAll('#nav a').forEach(a=>a.onclick=()=>{$('#nav').classList.remove('open');$('#menu').setAttribute('aria-expanded','false')});
$('#theme-toggle').onclick=()=>{document.documentElement.classList.add('theme-transition');setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true);clearTimeout(themeTimer);themeTimer=setTimeout(()=>document.documentElement.classList.remove('theme-transition'),350)};
$('#yr').textContent=new Date().getFullYear();setTheme(readTheme()==='dark'?'dark':'light');render();draw();
watchReveal(document.querySelectorAll('main > section .wrap,.trust .wrap,.footer-grid > div'));
