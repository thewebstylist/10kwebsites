// Perihelion. One continuous scroll-driven voyage, rendered live with three.js.
// Everything in the scene is procedural: no textures, no models, no video.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const V3 = THREE.Vector3;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

/* ------------------------------------------------------------------ */
/* Page behaviour that does not need WebGL                             */
/* ------------------------------------------------------------------ */
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--i', i++);
          wi.textContent = tok; w.appendChild(wi); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
}
$$('[data-split]').forEach(splitWords);

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    $$('[data-count]', e.target).forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.18 });
$$('.reveal, .band--stats').forEach((el) => io.observe(el));
$$('.ships, .timeline, .steps').forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty('--d', i)));

function countUp(el) {
  const end = +el.dataset.count; const t0 = performance.now(); const dur = 1600;
  if (!end || reduceMotion) { el.textContent = end; return; }
  const tick = (now) => {
    const t = clamp((now - t0) / dur); const e = 1 - Math.pow(1 - t, 4);
    el.textContent = Math.round(end * e);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const form = $('#crew-form');
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  let ok = true;
  $$('input', form).forEach((inp) => { const bad = !inp.checkValidity(); inp.classList.toggle('is-bad', bad); if (bad) ok = false; });
  const note = $('#form-note');
  if (!ok) { note.textContent = 'Please add your name and a valid email.'; return; }
  form.classList.add('is-sent');
  note.textContent = 'Request logged. This is a concept site, so nothing was sent.';
  $('button', form).textContent = 'Briefing requested';
});

/* ------------------------------------------------------------------ */
/* World frame: L points at the Sun, P is "up", D is the way out.      */
/* ------------------------------------------------------------------ */
const L = new V3(1, 0.12, 0.38).normalize();
const P = new V3(0, 1, 0).addScaledVector(L, -L.y).normalize();
const D = new V3().crossVectors(P, L).normalize();
const F = (l, p, d) => new V3().addScaledVector(L, l).addScaledVector(P, p).addScaledVector(D, d);
const add = (a, b) => a.clone().add(b);

const EARTH = F(0, 0, 0);
const YARD = F(15, 13.5, -7);
const MOON = F(-6, 14, 175);
const MARS = F(-12, 8, 440);
const JUP = F(-70, 0, 830);
const SAT = F(-50, 30, 1280);
const ORR = F(20, 0, 1760);
const SAT_AXIS = new V3().addScaledVector(P, 1).addScaledVector(L, 0.35).addScaledVector(D, -0.3).normalize();

/* ------------------------------------------------------------------ */
/* GLSL                                                                */
/* ------------------------------------------------------------------ */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
// Simplex noise by Ian McEwan, Ashima Arts (MIT).
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 Dq=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-Dq.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*Dq.wyz-Dq.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*snoise(p); p=p*2.03+17.1; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<3;i++){ s+=a*snoise(p); p=p*2.03+17.1; a*=.5; } return s; }
vec3 hash3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
float worley(vec3 p){ vec3 i=floor(p),f=fract(p); float d=1.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){ vec3 g=vec3(float(x),float(y),float(z)); vec3 r=g+hash3(i+g)-f; d=min(d,dot(r,r)); }
  return sqrt(d); }
mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
`;

const BODY_VERT = /* glsl */`
varying vec3 vP; varying vec2 vUv;
void main(){ vP=position; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
`;
const BODY_HEAD = /* glsl */`
uniform vec3 uSunObj; uniform vec3 uCamObj; uniform float uTime;
varying vec3 vP; varying vec2 vUv;
` + NOISE;

const EARTH_FRAG = BODY_HEAD + /* glsl */`
void main(){
  vec3 p=normalize(vP); vec3 N=p; vec3 V=normalize(uCamObj-vP);
  float ndl=dot(N,uSunObj); float day=smoothstep(-.1,.3,ndl); float diff=max(ndl,0.);
  float h=fbm(p*1.7+3.1)+.3*fbm(p*5.2+1.7);
  float land=smoothstep(.03,.1,h); float lat=abs(p.y);
  float dry=fbm3(p*3.+11.)*.5+.5;
  vec3 forest=vec3(.03,.1,.035), desert=vec3(.34,.25,.13), rock=vec3(.19,.16,.12);
  vec3 landCol=mix(forest,desert,smoothstep(.35,.75,dry+(.35-lat)*.6));
  landCol=mix(landCol,rock,smoothstep(.32,.62,h));
  float ice=smoothstep(.76,.9,lat+.09*fbm3(p*6.));
  vec3 ocean=mix(vec3(.003,.022,.075),vec3(.008,.085,.19),smoothstep(-.28,.03,h));
  vec3 albedo=mix(ocean,landCol,land); albedo=mix(albedo,vec3(.86,.9,.95),ice);
  vec3 cp=p*2.3+vec3(uTime*.004,0.,uTime*.002);
  float c=fbm(cp+.85*vec3(fbm3(cp*1.7),fbm3(cp*1.7+5.),0.));
  float clouds=smoothstep(.12,.62,c)*.92;
  vec3 col=albedo*diff*1.25;
  vec3 H=normalize(uSunObj+V);
  col+=vec3(1.,.9,.72)*pow(max(dot(N,H),0.),70.)*(1.-land)*(1.-clouds)*1.2;
  col=mix(col,vec3(.92,.95,1.)*(diff*1.05),clouds);
  float cityMask=land*(1.-ice)*smoothstep(.05,.5,fbm3(p*9.+2.))*smoothstep(.55,.8,snoise(p*150.)*.5+.5);
  col+=vec3(1.,.6,.24)*cityMask*(1.-day)*1.6*(1.-clouds*.8);
  float fres=pow(1.-max(dot(N,V),0.),3.2);
  col+=vec3(.16,.4,1.)*fres*(.03+day*.8);
  float term=smoothstep(-.18,.04,ndl)*(1.-smoothstep(.04,.34,ndl));
  col+=vec3(1.,.36,.1)*term*(.12+fres*.9);
  gl_FragColor=vec4(col,1.);
}`;

const ATMO_FRAG = /* glsl */`
uniform vec3 uSunObj; uniform vec3 uCamObj; uniform vec3 uColor; uniform vec3 uDusk; uniform float uEdge; uniform float uPow; uniform float uGain;
varying vec3 vP;
void main(){
  vec3 N=normalize(vP); vec3 V=normalize(uCamObj-vP);
  float rim=pow(clamp(-dot(N,V)/uEdge,0.,1.),uPow);
  float s=dot(N,uSunObj); float lit=smoothstep(-.42,.35,s);
  float fwd=pow(max(dot(-V,uSunObj),0.),5.);
  vec3 col=mix(uDusk,uColor,smoothstep(-.25,.25,s));
  gl_FragColor=vec4(col*rim*lit*(1.+1.6*fwd)*uGain,1.);
}`;

const MOON_FRAG = BODY_HEAD + /* glsl */`
float H(vec3 p){
  float h=fbm3(p*2.4)*.3; float w=worley(p*3.2); float w2=worley(p*7.5+4.);
  h-=(1.-smoothstep(.04,.42,w))*.4; h+=exp(-pow((w-.47)/.06,2.))*.12;
  h-=(1.-smoothstep(.04,.4,w2))*.16; h+=exp(-pow((w2-.45)/.07,2.))*.05;
  return h;
}
void main(){
  vec3 p=normalize(vP); vec3 N=p;
  vec3 t1=normalize(cross(N,vec3(.13,1.,.21))); vec3 t2=cross(N,t1); float e=.006;
  float h0=H(p),h1=H(p+t1*e),h2=H(p+t2*e);
  N=normalize(N-.42*((h1-h0)/e*t1+(h2-h0)/e*t2)*.1);
  float mare=smoothstep(.05,.5,fbm3(p*1.3+9.));
  vec3 albedo=mix(vec3(.5,.49,.47),vec3(.17,.17,.18),mare*.8);
  albedo*=.75+.6*h0; albedo+=.05*snoise(p*40.);
  float diff=max(dot(N,uSunObj),0.);
  float shade=smoothstep(-.02,.1,dot(p,uSunObj));
  gl_FragColor=vec4(albedo*diff*shade*1.25,1.);
}`;

const MARS_FRAG = BODY_HEAD + /* glsl */`
float H(vec3 p){ return fbm(p*2.1+7.)+.35*fbm3(p*7.+2.); }
void main(){
  vec3 p=normalize(vP); vec3 N=p; vec3 V=normalize(uCamObj-vP);
  vec3 t1=normalize(cross(N,vec3(.13,1.,.21))); vec3 t2=cross(N,t1); float e=.008;
  float h0=H(p),h1=H(p+t1*e),h2=H(p+t2*e);
  N=normalize(N-.03*((h1-h0)/e*t1+(h2-h0)/e*t2));
  float d2=fbm(p*5.+h0);
  vec3 albedo=mix(vec3(.42,.15,.06),vec3(.74,.36,.17),smoothstep(-.45,.5,d2));
  albedo=mix(albedo,vec3(.2,.085,.055),smoothstep(.05,.55,h0)*.78);
  float canyon=1.-smoothstep(0.,.035,abs(snoise(p*vec3(1.4,3.2,1.4)+3.)));
  albedo*=1.-canyon*.35*smoothstep(.5,.1,abs(p.y));
  float cap=smoothstep(.87,.94,abs(p.y)+.05*d2); albedo=mix(albedo,vec3(.93,.9,.87),cap);
  float ndl=dot(N,uSunObj); float diff=max(ndl,0.)*smoothstep(-.05,.12,dot(p,uSunObj));
  vec3 col=albedo*diff*1.02;
  float fres=pow(1.-max(dot(p,V),0.),3.);
  col+=vec3(.95,.5,.3)*fres*smoothstep(-.1,.4,dot(p,uSunObj))*.3;
  gl_FragColor=vec4(col,1.);
}`;

const JUPITER_FRAG = BODY_HEAD + /* glsl */`
void main(){
  vec3 p0=normalize(vP); vec3 N=p0; vec3 V=normalize(uCamObj-vP); vec3 p=p0; float lat=p.y;
  p.xz=rot(uTime*.012*sin(lat*13.))*p.xz;
  float turb=fbm(vec3(p.x*2.2,p.y*7.5,p.z*2.2)+4.);
  float warp=fbm(p*4.5+turb*1.6+vec3(0.,uTime*.01,0.));
  float y=lat+.04*turb+.022*warp;
  float bands=sin(y*23.)*.5+.5; float bands2=sin(y*8.5+1.3)*.5+.5; float fine=sin(y*71.+warp*3.)*.5+.5;
  vec3 cream=vec3(.74,.6,.42),brown=vec3(.33,.16,.08),rust=vec3(.6,.28,.12),white=vec3(.86,.8,.7);
  vec3 col=mix(brown,cream,smoothstep(.2,.8,bands));
  col=mix(col,rust,smoothstep(.55,.95,bands2)*.55);
  col=mix(col,white,smoothstep(.35,.85,warp)*.2);
  col*=.9+.14*fine;
  col=mix(col,vec3(.3,.34,.42),smoothstep(.68,.97,abs(lat)));
  vec3 sc=normalize(vec3(.3,-.36,.88)); vec3 e1=normalize(cross(vec3(0.,1.,0.),sc)); vec3 e2=cross(sc,e1);
  vec2 q=vec2(dot(p0,e1),dot(p0,e2)); float d=length(q/vec2(.22,.115));
  float spot=smoothstep(1.,.55,d)*step(0.,dot(p0,sc));
  float sw=fbm3(vec3(rot(d*4.-uTime*.05)*q*9.,2.));
  col=mix(col,mix(vec3(.66,.22,.11),vec3(.82,.42,.24),sw*.5+.5),spot*.9);
  col=mix(col,white,smoothstep(1.35,1.,d)*(1.-smoothstep(1.,.8,d))*.35*step(0.,dot(p0,sc)));
  float ndl=dot(N,uSunObj); float diff=pow(max(ndl,0.),.85);
  float limb=pow(max(dot(N,V),0.),.35);
  col*=diff*.86*mix(.45,1.,limb);
  col+=vec3(.9,.7,.5)*pow(1.-max(dot(N,V),0.),4.)*smoothstep(0.,.5,ndl)*.25;
  gl_FragColor=vec4(col,1.);
}`;

const RING_FN = /* glsl */`
float ringD(float x){
  if(x<0.||x>1.) return 0.;
  float d=.62+.38*sin(x*93.)*sin(x*37.+1.);
  d*=.72+.28*sin(x*311.+sin(x*57.)*2.);
  float c=smoothstep(0.,.03,x)*mix(.22,1.,smoothstep(.16,.24,x));
  c*=1.-smoothstep(.555,.57,x)*(1.-smoothstep(.612,.628,x))*.96;
  c*=1.-smoothstep(.862,.868,x)*(1.-smoothstep(.876,.882,x))*.85;
  c*=mix(1.,.72,smoothstep(.63,.66,x));
  c*=1.-smoothstep(.965,1.,x);
  return clamp(d*c,0.,1.);
}`;

const SATURN_FRAG = BODY_HEAD + RING_FN + /* glsl */`
uniform float uRingIn; uniform float uRingOut;
void main(){
  vec3 p=normalize(vP); vec3 N=p; vec3 V=normalize(uCamObj-vP); float lat=p.y;
  float turb=fbm3(vec3(p.x*1.5,p.y*6.,p.z*1.5)+2.);
  float y=lat+.02*turb;
  float b=sin(y*26.)*.5+.5; float b2=sin(y*9.+.7)*.5+.5;
  vec3 col=mix(vec3(.58,.46,.28),vec3(.82,.72,.5),smoothstep(.2,.8,b));
  col=mix(col,vec3(.7,.54,.32),b2*.5);
  col=mix(col,vec3(.5,.55,.56),smoothstep(.72,.98,abs(lat)));
  float ndl=dot(N,uSunObj); float diff=pow(max(ndl,0.),.85);
  // shadow the rings cast on the cloud tops
  float sh=0.; float t=-p.y/uSunObj.y;
  if(t>0.){ vec3 q=p+uSunObj*t; sh=ringD((length(q.xz)-uRingIn)/(uRingOut-uRingIn)); }
  col*=diff*.86*(1.-sh*.82)*mix(.5,1.,pow(max(dot(N,V),0.),.35));
  col+=vec3(.9,.8,.6)*pow(1.-max(dot(N,V),0.),4.)*smoothstep(0.,.5,ndl)*.22;
  gl_FragColor=vec4(col,1.);
}`;

const RING_FRAG = /* glsl */`
uniform vec3 uSunObj; uniform vec3 uCamObj; uniform float uIn; uniform float uOut; uniform float uR;
varying vec3 vP;
` + RING_FN + /* glsl */`
void main(){
  float r=length(vP.xz); float x=(r-uIn)/(uOut-uIn); float d=ringD(x);
  if(d<.004) discard;
  float sameSide=step(0.,uSunObj.y*(uCamObj.y-vP.y));
  vec3 base=mix(vec3(.5,.41,.31),vec3(.95,.87,.72),d);
  vec3 V=normalize(uCamObj-vP);
  float fwd=pow(max(dot(-V,uSunObj),0.),8.);
  float litR=(.5+.9*abs(uSunObj.y))*(1.+.6*pow(max(dot(V,uSunObj),0.),3.));
  float litT=(d*(1.-d)*2.6+.04)*(.5+2.*fwd);
  float lum=mix(litT,litR,sameSide);
  // the planet's shadow across the rings
  float bb=dot(vP,uSunObj); float dl=sqrt(max(dot(vP,vP)-bb*bb,0.));
  float shadow=bb<0.?smoothstep(uR*1.03,uR*.96,dl):0.;
  lum*=1.-shadow*.94;
  gl_FragColor=vec4(base*lum*1.15,mix(d*.55,d,sameSide)*.96);
}`;

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
let app = null;
try { app = boot(); } catch (err) {
  console.error(err);
  document.body.classList.add('no-webgl');
  document.body.classList.remove('is-loading');
}

function boot() {
  const canvas = $('#stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const isSmall = Math.min(innerWidth, innerHeight) < 700;
  let dpr = Math.min(devicePixelRatio || 1, isSmall ? 1.5 : 1.75);
  if (params.has('dpr')) dpr = +params.get('dpr');
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 9000);
  camera.up.copy(P);
  scene.add(camera);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.5);
  sunLight.position.copy(L).multiplyScalar(10);
  scene.add(sunLight);
  const fill = new THREE.DirectionalLight(0x6fa8ff, 0);
  scene.add(fill);

  const time = { value: 0 };

  /* ----- sky: nebula baked once into an equirect, then worn as a dome ----- */
  const sky = (() => {
    const rt = new THREE.WebGLRenderTarget(2048, 1024, { type: THREE.HalfFloatType, depthBuffer: false });
    rt.texture.wrapS = THREE.RepeatWrapping;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: 'varying vec2 vUv;' + NOISE + /* glsl */`
      void main(){
        float phi=vUv.x*6.2831853, th=(1.-vUv.y)*3.14159265;
        vec3 d=vec3(-cos(phi)*sin(th),cos(th),sin(phi)*sin(th));
        vec3 gn=normalize(vec3(.3,.82,-.42));
        float band=exp(-pow(dot(d,gn)/.24,2.));
        float n1=fbm(d*2.1)*.5+.5, n2=fbm(d*5.+3.)*.5+.5, dust=fbm(d*9.+8.)*.5+.5;
        vec3 col=vec3(.004,.006,.014);
        col+=vec3(.012,.022,.055)*n1*n1*1.3;
        col+=band*(vec3(.085,.07,.06)*n2+vec3(.03,.014,.05)*n1)*(.3+.7*smoothstep(.36,.72,dust));
        col+=vec3(.045,.01,.035)*pow(n2,3.)+vec3(0.,.022,.028)*pow(1.-n1,3.);
        vec3 c=floor(d*430.); float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);
        col+=vec3(.75,.82,1.)*smoothstep(.9972,1.,h)*(.12+band*.55);
        gl_FragColor=vec4(col,1.);
      }`,
      depthTest: false, depthWrite: false,
    }));
    const s = new THREE.Scene(); s.add(quad);
    renderer.setRenderTarget(rt); renderer.render(s, new THREE.Camera()); renderer.setRenderTarget(null);
    quad.geometry.dispose(); quad.material.dispose();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7000, 48, 32),
      new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    dome.renderOrder = -20; dome.frustumCulled = false;
    scene.add(dome);
    return dome;
  })();

  /* ----- stars ----- */
  const stars = (() => {
    const n = isSmall ? 6500 : 12000;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n);
    const gn = new V3(0.3, 0.82, -0.42).normalize(); const v = new V3();
    const tints = [[0.7, 0.8, 1], [1, 1, 1], [1, 0.93, 0.8], [1, 0.78, 0.6], [0.8, 0.88, 1]];
    for (let i = 0; i < n; i++) {
      do { v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
      v.normalize();
      if (i % 3 === 0) { v.addScaledVector(gn, -v.dot(gn) * (0.72 + Math.random() * 0.26)).normalize(); }
      v.multiplyScalar(5000); pos.set([v.x, v.y, v.z], i * 3);
      const m = Math.pow(Math.random(), 7); const t = tints[(Math.random() * tints.length) | 0];
      const b = 0.35 + m * 3.2; col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
      size[i] = 1.1 + m * 3.4 + Math.random() * 0.7; ph[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uDpr: { value: dpr } },
      vertexShader: /* glsl */`attribute float aSize; attribute vec3 aColor; attribute float aPhase; uniform float uTime; uniform float uDpr; varying vec3 vC;
        void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
          float tw=.82+.18*sin(uTime*(.5+aPhase*2.2)+aPhase*50.); gl_PointSize=aSize*uDpr*tw; vC=aColor*tw; }`,
      fragmentShader: /* glsl */`varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vC*a*a,1.); }`,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -19;
    scene.add(pts);
    return pts;
  })();

  /* ----- the Sun: a billboard pinned at infinity ----- */
  const sun = (() => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uGain: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: /* glsl */`varying vec2 vUv; uniform float uGain;
        void main(){ vec2 q=(vUv-.5)*2.; float r=length(q);
          float core=smoothstep(.034,.026,r);
          float glow=exp(-r*26.)*5.+exp(-r*7.5)*.55+pow(max(1.-r,0.),4.)*.1;
          float streak=exp(-abs(q.y)*110.)*exp(-abs(q.x)*3.2)*.9+exp(-abs(q.x)*160.)*exp(-abs(q.y)*7.)*.25;
          float a=atan(q.y,q.x); float rays=pow(abs(sin(a*4.+.4)),24.)*exp(-r*5.)*.5;
          vec3 col=vec3(1.,.9,.74)*(core*18.+glow+rays)+vec3(.75,.85,1.)*streak;
          gl_FragColor=vec4(col*uGain*smoothstep(1.,.75,r),1.); }`,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    mesh.scale.setScalar(2600); mesh.renderOrder = -10; mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  })();

  /* ----- worlds ----- */
  const bodies = [];
  const Y = new V3(0, 1, 0); const tq = new THREE.Quaternion();
  function makeBody({ pos, radius, frag, uniforms = {}, spin = 0.01, axis, atmo, tint, seg = 128, far = 0, near = 0 }) {
    const group = new THREE.Group(); group.position.copy(pos);
    if (axis) group.quaternion.setFromUnitVectors(Y, axis);
    const u = { uSunObj: { value: new V3() }, uCamObj: { value: new V3() }, uTime: time, ...uniforms };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, seg, seg / 2),
      new THREE.ShaderMaterial({ uniforms: u, vertexShader: BODY_VERT, fragmentShader: frag }));
    group.add(mesh);
    if (atmo) {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(radius * atmo.scale, 96, 48), new THREE.ShaderMaterial({
        uniforms: { uSunObj: u.uSunObj, uCamObj: u.uCamObj, uColor: { value: new V3(...atmo.color) }, uDusk: { value: new V3(...(atmo.dusk || atmo.color)) },
          uEdge: { value: Math.sqrt(1 - 1 / (atmo.scale * atmo.scale)) }, uPow: { value: atmo.pow || 3 }, uGain: { value: atmo.gain || 1 } },
        vertexShader: BODY_VERT, fragmentShader: ATMO_FRAG,
        side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      mesh.add(shell);
    }
    scene.add(group);
    const b = { group, mesh, u, radius, spin, pos, tint: new THREE.Color(tint), far, near, scale: 1 };
    bodies.push(b); return b;
  }
  const earth = makeBody({ pos: EARTH, radius: 10, frag: EARTH_FRAG, spin: 0.012, axis: new V3(0.25, 1, 0.3).normalize(), tint: 0x5f9dff,
    atmo: { scale: 1.13, color: [0.2, 0.45, 1.0], dusk: [1.0, 0.4, 0.12], pow: 3.4, gain: 0.85 } });
  earth.mesh.rotation.y = 2.2;
  makeBody({ pos: MOON, radius: 3.5, frag: MOON_FRAG, spin: 0.004, tint: 0x9a9a9a, seg: 96, far: 120, near: 45 }).mesh.rotation.y = 1.1;
  makeBody({ pos: MARS, radius: 7, frag: MARS_FRAG, spin: 0.012, axis: new V3(0.3, 1, -0.2).normalize(), tint: 0xff7a45, far: 170, near: 70,
    atmo: { scale: 1.07, color: [0.95, 0.5, 0.28], pow: 2.2, gain: 0.5 } });
  makeBody({ pos: JUP, radius: 42, frag: JUPITER_FRAG, spin: 0.02, axis: new V3(0.05, 1, 0.03).normalize(), tint: 0xe7c59a, seg: 160, far: 400, near: 190,
    atmo: { scale: 1.035, color: [0.95, 0.8, 0.6], pow: 2, gain: 0.3 } }).mesh.rotation.y = 0.4;
  const RING_IN = 37, RING_OUT = 70;
  const saturn = makeBody({ pos: SAT, radius: 30, frag: SATURN_FRAG, spin: 0.02, axis: SAT_AXIS, tint: 0xead7a8, seg: 160, far: 400, near: 170,
    uniforms: { uRingIn: { value: RING_IN / 30 }, uRingOut: { value: RING_OUT / 30 } },
    atmo: { scale: 1.03, color: [0.95, 0.85, 0.62], pow: 2, gain: 0.25 } });
  const ring = (() => {
    const g = new THREE.RingGeometry(RING_IN, RING_OUT, 256, 1); g.rotateX(-Math.PI / 2);
    const u = { uSunObj: { value: new V3() }, uCamObj: { value: new V3() }, uIn: { value: RING_IN }, uOut: { value: RING_OUT }, uR: { value: 30 } };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: BODY_VERT, fragmentShader: RING_FRAG, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    saturn.group.add(m);
    return { u };
  })();

  /* ----- the starship ----- */
  const ship = buildShip(time);
  scene.add(ship.root);
  const yard = buildYard();
  yard.position.copy(YARD);
  yard.quaternion.setFromUnitVectors(new V3(0, 0, -1), D);
  scene.add(yard);

  /* ----- the chart at the end of the road ----- */
  const orrery = buildOrrery();
  orrery.root.position.copy(ORR);
  orrery.root.quaternion.setFromUnitVectors(Y, P);
  scene.add(orrery.root);

  /* ----- speed lines ----- */
  const streaks = (() => {
    const n = 420; const pos = new Float32Array(n * 6), end = new Float32Array(n * 2), seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.pow(Math.random(), 0.7) * 46, z = Math.random();
      for (let k = 0; k < 2; k++) { pos.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 6 + k * 3); end[i * 2 + k] = k; seed[i * 2 + k] = Math.random(); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uAmt: { value: 0 } },
      vertexShader: /* glsl */`attribute float aEnd; attribute float aSeed; uniform float uTime; uniform float uAmt; varying float vA;
        void main(){ vec3 p=position; float z=fract(p.z+uTime*(.25+aSeed*.5)); p.z=z*260.-200.+aEnd*(1.5+uAmt*38.)*(.5+aSeed);
          vA=uAmt*smoothstep(0.,.15,z)*smoothstep(1.,.75,z)*(1.-aEnd*.85)*(.35+aSeed*.65);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: 'varying float vA; void main(){ gl_FragColor=vec4(vec3(.82,.9,1.)*vA*1.3,1.); }',
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    const lines = new THREE.LineSegments(g, m); lines.frustumCulled = false; lines.visible = false;
    scene.add(lines);
    return lines;
  })();

  /* ----- post ----- */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: isSmall ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.72, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------------------------------------------------------------- */
  /* Choreography. Keys are in chapter units: u = chapter + progress.  */
  /* ---------------------------------------------------------------- */
  // ship, cam, look are world points. sx, sy place the subject on screen (-1..1).
  const K = [];
  const key = (u, ship_, cam, look, sx = 0, sy = 0, o = {}) => K.push({ u, ship: ship_, cam, look, sx, sy, psx: o.psx ?? sx * 0.2, psy: o.psy ?? sy + 0.3 });
  const hero0 = F(-12.5, 10.12, 0), hero1 = F(-11.8, 10.75, 0.4);
  key(0.0, YARD, hero0, add(hero0, F(50, 0.6, 0)), 0.34, -0.36, { psx: 0.2, psy: 0.42 });
  key(0.5, YARD, hero1, add(hero1, F(50, 0.6, 0)), 0.34, -0.34, { psx: 0.2, psy: 0.44 });
  key(1.0, YARD, add(YARD, F(8, 4, 12.5)), YARD, 0.4, 0.02);
  key(1.5, YARD, add(YARD, F(12.5, 1.6, 1)), YARD, 0.4, 0);
  key(2.0, YARD, add(YARD, F(5.5, 2.3, -9)), add(YARD, F(0, 0, 0.6)), -0.3, 0);
  let s = add(YARD, F(0, 0, 46));
  key(2.5, s, add(s, F(1, 3.6, 10.5)), s, -0.52, 0.1);
  s = add(MOON, F(5, 2.5, 3));
  key(3.0, s, add(MOON, F(7.2, 2.2, 17)), MOON, 0.64, -0.02);
  s = add(MOON, F(6, 2.5, 12));
  key(3.5, s, add(MOON, F(8.4, 2.8, 26)), MOON, 0.64, -0.04);
  s = add(MARS, F(10, 2, -8));
  key(4.0, s, add(s, F(8, 3, -14)), MARS, -0.54, 0);
  s = add(MARS, F(10, 2, -2));
  key(4.5, s, add(s, F(10, 3.5, -11)), MARS, -0.56, 0.02);
  s = add(JUP, F(62, 10, -10));
  key(5.0, s, add(s, F(13, 3, 1)), JUP, 0.62, 0);
  s = add(JUP, F(62, 10, 22));
  key(5.5, s, add(s, F(13, 3.5, 8)), JUP, 0.62, 0);
  s = add(SAT, F(52, 22, -62));
  key(6.0, s, add(s, F(10, 4, -13)), SAT, -0.42, 0.04);
  s = add(SAT, F(54, 20, -40));
  key(6.5, s, add(s, F(11, 4.5, -11)), SAT, -0.46, 0.06);
  s = add(ORR, F(-170, 70, 330));
  key(7.0, s, add(ORR, F(0, 74, -150)), ORR, 0.46, 0.02, { psx: 0, psy: 0.42 });
  key(8.0, s, add(ORR, F(0, 120, -112)), ORR, 0.46, 0.02, { psx: 0, psy: 0.42 });

  const mk = (keys, f) => makeTrack(keys.map((k) => ({ u: k.u, v: f(k) })));
  const arr = (v) => [v.x, v.y, v.z];
  const T = {
    ship: mk(K, (k) => arr(k.ship)), cam: mk(K, (k) => arr(k.cam)), look: mk(K, (k) => arr(k.look)),
    aim: mk(K, (k) => [k.sx, k.sy, k.psx, k.psy]),
    build: makeTrack([{ u: 0, v: [0] }, { u: 0.62, v: [0] }, { u: 1.42, v: [1] }, { u: 8, v: [1] }]),
    thrust: makeTrack([{ u: 0, v: [0] }, { u: 1.86, v: [0] }, { u: 2.04, v: [1] }, { u: 2.62, v: [1] }, { u: 3, v: [0.22] }, { u: 6.5, v: [0.22] }, { u: 7, v: [0.6] }, { u: 8, v: [0.6] }]),
    sun: makeTrack([{ u: 0, v: [1] }, { u: 6.55, v: [1] }, { u: 6.95, v: [0] }, { u: 8, v: [0] }]),
    range: makeTrack([[0, 420], [1.9, 420], [2.5, 2600], [3, 384400], [3.5, 402000], [4, 7.834e7], [4.5, 7.9e7], [5, 6.2873e8], [5.5, 6.31e8], [6, 1.275e9], [6.5, 1.279e9], [7, 4.3e9], [8, 4.3e9]].map(([u, v]) => ({ u, v: [Math.log(v)] }))),
    vel: makeTrack([[0, 7.66], [1.9, 7.66], [2.5, 14.2], [3, 11.4], [3.6, 12.1], [3.8, 61], [4, 58.3], [4.6, 59], [4.8, 78], [5, 74.2], [5.6, 81], [6, 67.5], [6.5, 66.9], [7, 52], [8, 52]].map(([u, v]) => ({ u, v: [v] }))),
    met: makeTrack([[0, 0], [2, 0], [2.5, 0.02], [3, 3.1], [3.5, 3.6], [4, 39.2], [4.5, 39.9], [5, 214.3], [5.5, 216], [6, 571.6], [6.5, 574], [7, 940], [8, 940]].map(([u, v]) => ({ u, v: [v] }))),
  };
  // The bookend: back above Earth, Sun fully risen, the finished ship on station.
  const f0 = F(-12, 10.9, 0.8), f1 = F(-11.2, 11.9, 2);
  const TF = {
    cam: makeTrack([{ u: 0, v: arr(f0) }, { u: 1, v: arr(f1) }]),
    look: makeTrack([{ u: 0, v: arr(add(f0, F(50, 0.6, 0))) }, { u: 1, v: arr(add(f1, F(50, 0.6, 0))) }]),
    aim: makeTrack([{ u: 0, v: [0.05, -0.2, 0.1, 0.5] }, { u: 1, v: [0.05, -0.34, 0.1, 0.44] }]),
  };

  /* ---------------------------------------------------------------- */
  /* Scroll state                                                      */
  /* ---------------------------------------------------------------- */
  const chapters = $$('.chapter'); const N = chapters.length;
  const curtain = $('#curtain'), finale = $('#crew'), hud = $('#hud'), rail = $('#rail'), topbar = $('#topbar');
  const railBtns = $$('button', rail), cue = $('#scrollcue'), labelsEl = $('#orrery-labels');
  let W = 1, H = 1, geo = [], curtainTop = 0, curtainBottom = 0, finaleTop = 0, finaleH = 1;
  let uT = 0, uS = 0, finaleMode = false, wT = 0, wS = 0, covered = false, lastY = 0;
  const forcedU = params.has('u') ? +params.get('u') : null;

  function measure() {
    W = innerWidth; H = innerHeight;
    geo = chapters.map((c) => { const r = c.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
    let r = curtain.getBoundingClientRect(); curtainTop = r.top + scrollY; curtainBottom = r.bottom + scrollY;
    r = finale.getBoundingClientRect(); finaleTop = r.top + scrollY; finaleH = r.height;
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    stars.material.uniforms.uDpr.value = dpr;
    camera.aspect = W / H;
  }

  function readScroll() {
    const y = scrollY;
    let u = 0;
    for (let i = 0; i < N; i++) { if (y >= geo[i].top) u = i + clamp((y - geo[i].top) / geo[i].h); }
    uT = forcedU ?? u;
    const mid = (curtainTop + curtainBottom - H) / 2;
    const fm = forcedU == null && y > mid;
    if (fm !== finaleMode) { finaleMode = fm; uS = uT; wS = wT; }
    wT = clamp((y + H - finaleTop) / (finaleH + H * 0.2));
    covered = forcedU == null && y >= curtainTop && y + H <= curtainBottom;

    chapters.forEach((c, i) => {
      const t = uT - i; const hold = +(c.dataset.hold || 0.5);
      const on = (i === 0 ? true : t > -0.16) && t < hold;
      c.classList.toggle('is-active', on); c.classList.toggle('is-past', t >= hold);
    });
    const inVoyage = y < curtainTop - H * 0.55;
    hud.classList.toggle('is-off', !inVoyage); rail.classList.toggle('is-off', !inVoyage);
    cue.classList.toggle('is-off', uT > 0.12);
    const idx = Math.min(N - 1, Math.floor(uT + 0.18));
    railBtns.forEach((b, i) => b.classList.toggle('is-on', i === idx));
    topbar.classList.toggle('is-solid', y > curtainTop - 80 && y < finaleTop - H * 0.5);
    topbar.classList.toggle('is-hidden', y > lastY + 4 && y > curtainTop && y < finaleTop - H);
    if (Math.abs(y - lastY) > 4) lastY = y;
    labelsEl.classList.toggle('is-on', uT > 6.82 && inVoyage && !finaleMode);
  }
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => { measure(); readScroll(); });
  if (document.fonts?.ready) document.fonts.ready.then(() => { measure(); readScroll(); });

  railBtns.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.go; scrollTo({ top: geo[i].top + (i ? geo[i].h * 0.06 : 0), behavior: reduceMotion ? 'auto' : 'smooth' });
  }));
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (ev) => {
    const t = $(a.getAttribute('href')); if (!t) return; ev.preventDefault();
    t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }));

  // Destinations drive the chart.
  const destBtns = $$('#dest button');
  const setDest = (id) => { destBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.dest === id)); orrery.focus(id); };
  destBtns.forEach((b) => { ['pointerenter', 'focus', 'click'].forEach((e) => b.addEventListener(e, () => setDest(b.dataset.dest))); });
  setDest('mars');

  /* ---------------------------------------------------------------- */
  /* Frame                                                             */
  /* ---------------------------------------------------------------- */
  const tR = $('#t-range'), tV = $('#t-vel'), tM = $('#t-met');
  const shipPos = new V3(), prevShip = new V3().copy(YARD), camPos = new V3(), look = new V3(), fwd = new V3(), right = new V3(), up = new V3(), tmp = new V3(), shipDir = D.clone();
  const zNeg = new V3(0, 0, -1), zPos = new V3(0, 0, 1);
  let warp = 0, frame = 0, last = performance.now(), ema = 16, slowFor = 0, ready = false;

  function update(dt) {
    time.value += dt;
    const kS = reduceMotion || params.has('snap') ? 1 : 1 - Math.exp(-dt * 4.2);
    uS += (uT - uS) * kS; wS += (wT - wS) * kS;
    if (Math.abs(uT - uS) < 1e-4) uS = uT;
    const u = uS;
    const pf = smooth(1.05, 0.62, camera.aspect); // 0 landscape, 1 portrait

    let aim, build, thrust;
    if (finaleMode) {
      shipPos.copy(YARD); camPos.fromArray(TF.cam(wS)); look.fromArray(TF.look(wS)); aim = TF.aim(wS);
      build = 1; thrust = 0.12; sun.material.uniforms.uGain.value = 1;
    } else {
      shipPos.fromArray(T.ship(u)); camPos.fromArray(T.cam(u)); look.fromArray(T.look(u)); aim = T.aim(u);
      build = T.build(u)[0]; thrust = T.thrust(u)[0]; sun.material.uniforms.uGain.value = T.sun(u)[0];
    }

    // how fast are we really going
    const sp = tmp.copy(shipPos).sub(prevShip).length() / Math.max(dt, 1e-3);
    if (sp > 0.4) shipDir.lerp(tmp.normalize(), 0.12).normalize();
    prevShip.copy(shipPos);
    const wTarget = reduceMotion || finaleMode ? 0 : clamp((sp - 12) / 110);
    warp += (wTarget - warp) * (1 - Math.exp(-dt * 5));

    camera.fov = lerp(45, 62, pf) + warp * 7;
    // on tall screens, step back so the subject still fits the narrow frame
    if (!finaleMode && pf > 0) camPos.lerp(look, -0.4 * pf * smooth(0.6, 1, u));
    camera.position.copy(camPos);
    // place the subject off centre so the words get the empty side of the frame
    const sx = lerp(aim[0], aim[2], pf), sy = lerp(aim[1], aim[3], pf);
    fwd.copy(look).sub(camPos); const dist = fwd.length(); fwd.normalize();
    right.crossVectors(fwd, P).normalize(); up.crossVectors(right, fwd);
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect;
    look.addScaledVector(right, -sx * th * dist).addScaledVector(up, -sy * tv * dist);
    // a little breathing so the frame is never dead still
    const tt = time.value;
    if (!reduceMotion) camera.position.addScaledVector(right, Math.sin(tt * 0.23) * 0.05).addScaledVector(up, Math.cos(tt * 0.19) * 0.04);
    camera.lookAt(look);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();

    sky.position.copy(camera.position); stars.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(L, 4000); sun.quaternion.copy(camera.quaternion);

    for (const b of bodies) {
      b.mesh.rotation.y += b.spin * dt;
      if (b.far) { b.scale = lerp(0.03, 1, smooth(b.far, b.near, camera.position.distanceTo(b.pos))); b.group.scale.setScalar(b.scale); }
      b.group.updateMatrixWorld(true);
      b.mesh.getWorldQuaternion(tq).invert();
      b.u.uSunObj.value.copy(L).applyQuaternion(tq);
      b.u.uCamObj.value.copy(camera.position).sub(b.pos).applyQuaternion(tq).divideScalar(b.scale);
    }
    tq.copy(saturn.group.quaternion).invert();
    ring.u.uSunObj.value.copy(L).applyQuaternion(tq);
    ring.u.uCamObj.value.copy(camera.position).sub(SAT).applyQuaternion(tq).divideScalar(saturn.scale);

    // light bounced off whichever world is closest
    let best = 0, bb = null;
    for (const b of bodies) { const d = tmp.copy(b.pos).sub(shipPos).length(); const w = Math.pow(b.radius / d, 2); if (w > best) { best = w; bb = b; } }
    if (bb) { fill.color.copy(bb.tint); fill.position.copy(bb.pos).sub(shipPos).normalize().multiplyScalar(10); fill.intensity = Math.min(1.1, best * 2.2); }

    ship.root.position.copy(shipPos);
    ship.root.quaternion.setFromUnitVectors(zNeg, shipDir);
    ship.update(build, Math.max(thrust, warp * 0.9), dt, tt);
    yard.update(tt, build);

    streaks.visible = warp > 0.01;
    if (streaks.visible) { streaks.material.uniforms.uAmt.value = warp; streaks.position.copy(camera.position); streaks.quaternion.setFromUnitVectors(zPos, tmp.copy(shipDir).negate()); }
    bloom.strength = 0.5 + warp * 0.25;

    const chart = !finaleMode && u > 6.4;
    orrery.root.visible = chart;
    if (chart) orrery.update(dt, tt, camera, W, H, labelsEl.classList.contains('is-on'));

    if (frame % 4 === 0 && !finaleMode) {
      const km = Math.exp(T.range(u)[0]);
      tR.textContent = km > 2e7 ? (km / 1.495979e8).toFixed(2) + ' AU' : Math.round(km).toLocaleString('en-US') + ' km';
      tV.textContent = (T.vel(u)[0] + warp * 9 + Math.sin(tt * 1.7) * 0.02).toFixed(2) + ' km/s';
      const d = T.met(u)[0] + (u > 2.02 ? tt / 86400 : 0); const dd = Math.floor(d), hh = Math.floor((d - dd) * 24), mm = Math.floor(((d - dd) * 24 - hh) * 60);
      tM.textContent = `T+ ${String(dd).padStart(3, '0')}d ${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m`;
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; frame++;
    if (covered || document.hidden) return;
    update(dt);
    composer.render();
    if (!ready) { ready = true; requestAnimationFrame(() => document.body.classList.remove('is-loading')); }
    // shed resolution if the device is struggling
    ema += ((now - (loop.prev || now)) - ema) * 0.08; loop.prev = now;
    if (ema > 30 && frame > 90) { slowFor++; if (slowFor > 70 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); slowFor = 0; ema = 16; measure(); } } else slowFor = 0;
  }

  measure(); readScroll(); uS = uT; wS = wT;
  if (forcedU == null) requestAnimationFrame(loop);
  else { update(0.016); composer.render(); document.body.classList.remove('is-loading'); }

  return {
    // test hook: jump the voyage to a given point and draw one frame
    still(u, tSec = 0) { uT = uS = u; finaleMode = false; update(tSec + 0.016); warp = 0; prevShip.copy(shipPos); update(0.016); update(0.016); composer.render(); },
  };
}
if (app) window.__perihelion = app;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
// Monotone cubic through keyframes: glides through fast legs, settles into slow ones, never overshoots.
function makeTrack(keys) {
  const n = keys.length, dim = keys[0].v.length, us = keys.map((k) => k.u), vs = keys.map((k) => k.v);
  const m = vs.map((v, i) => v.map((_, c) => {
    if (i === 0 || i === n - 1) return 0;
    const d0 = (vs[i][c] - vs[i - 1][c]) / (us[i] - us[i - 1]), d1 = (vs[i + 1][c] - vs[i][c]) / (us[i + 1] - us[i]);
    return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1);
  }));
  const out = new Array(dim);
  return (u) => {
    if (u <= us[0]) return vs[0]; if (u >= us[n - 1]) return vs[n - 1];
    let i = 0; while (u > us[i + 1]) i++;
    const h = us[i + 1] - us[i], s = (u - us[i]) / h, s2 = s * s, s3 = s2 * s;
    const a = 2 * s3 - 3 * s2 + 1, b = s3 - 2 * s2 + s, c = -2 * s3 + 3 * s2, d = s3 - s2;
    for (let k = 0; k < dim; k++) out[k] = a * vs[i][k] + b * h * m[i][k] + c * vs[i + 1][k] + d * h * m[i + 1][k];
    return out;
  };
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

/* ------------------------------------------------------------------ */
/* Halcyon, built from primitives. Forward is -Z.                      */
/* ------------------------------------------------------------------ */
function buildShip(time) {
  const root = new THREE.Group(); const parts = [];
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    hull: std({ color: 0xaeb2b7, metalness: 0.6, roughness: 0.4 }),
    white: std({ color: 0xc4c1ba, metalness: 0.1, roughness: 0.62 }),
    dark: std({ color: 0x23272d, metalness: 0.75, roughness: 0.48 }),
    gold: std({ color: 0xc8963c, metalness: 1, roughness: 0.32 }),
    truss: std({ color: 0x8b9199, metalness: 0.8, roughness: 0.4 }),
    solar: std({ color: 0xffffff, metalness: 0.45, roughness: 0.42, map: canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#16264f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5c7fc4'; g.lineWidth = 1;
      for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, h); g.stroke(); }
      for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(w, y + .5); g.stroke(); }
    }) }),
    radiator: std({ color: 0x17171a, metalness: 0.4, roughness: 0.6, emissive: 0xff4d14, emissiveIntensity: 0.2, emissiveMap: canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#160502'; g.fillRect(0, 0, w, h);
      for (let y = 3; y < h; y += 8) { g.fillStyle = '#e8763a'; g.fillRect(0, y, w, 1); }
    }) }),
    ring: std({ color: 0xb4b2ad, metalness: 0.3, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 3, emissiveMap: canvasTex(1024, 64, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let x = 4; x < w; x += 9) { if (Math.random() < 0.3) continue; g.fillStyle = Math.random() < 0.8 ? '#ffd9a0' : '#bfe4ff'; g.fillRect(x, 14, 4, 3); if (Math.random() < 0.6) g.fillRect(x, 46, 4, 3); }
    }) }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.5, 1.5) }),
    throat: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  };
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
  const cylZ = (r1, r2, len, seg = 24, open = false) => { const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open); g.rotateX(Math.PI / 2); return g; };
  const lathe = (pts, seg = 40) => { const g = new THREE.LatheGeometry([...pts].reverse().map(([r, y]) => new THREE.Vector2(r, y)), seg); g.rotateX(-Math.PI / 2); return g; }; // +y becomes -z

  function part(objs, home, off, spin, delay) {
    const g = new THREE.Group(); objs.forEach((o) => g.add(o));
    const edge = new THREE.LineBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const meshes = []; g.traverse((o) => { if (o.isMesh && !o.userData.plain) meshes.push(o); });
    meshes.forEach((o) => o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 18), edge)));
    g.position.copy(home); root.add(g);
    const p = { g, home: home.clone(), off, spin, delay, edge, seed: Math.random() * 10 }; parts.push(p); return p;
  }
  const v = (x, y, z) => new V3(x, y, z);

  // keel
  const keel = [mesh(cylZ(0.075, 0.075, 4.7, 12), M.truss)];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; const m = mesh(cylZ(0.018, 0.018, 4.5, 6), M.truss, Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0); m.userData.plain = true; keel.push(m); }
  for (let z = -2.1; z <= 2.2; z += 0.43) { const m = mesh(new THREE.TorusGeometry(0.17, 0.014, 5, 3), M.truss, 0, 0, z); m.rotation.z = 0.5 + Math.PI / 6; m.userData.plain = true; keel.push(m); }
  part(keel, v(0, 0, 0), v(0, 0, 0), 0, 0);

  // command module
  const nose = lathe([[0, 0.92], [0.1, 0.89], [0.24, 0.72], [0.33, 0.42], [0.36, 0.05], [0.36, -0.28], [0.29, -0.34], [0, -0.34]]);
  const band = mesh(cylZ(0.365, 0.365, 0.035, 40, true), M.lamp, 0, 0, -0.22); band.userData.plain = true;
  const collar = mesh(cylZ(0.3, 0.3, 0.12, 24), M.dark, 0, 0, 0.36);
  part([mesh(nose, M.hull), band, collar], v(0, 0, -2.72), v(0, 0.4, -4.6), 0.6, 0.5);

  // habitat ring
  const hab = new THREE.Group();
  hab.add(mesh(new THREE.TorusGeometry(0.98, 0.135, 14, 64), M.ring));
  hab.add(mesh(cylZ(0.21, 0.21, 0.42, 20), M.dark));
  for (let i = 0; i < 4; i++) { const sp = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.92, 8), M.hull); sp.position.set(0, 0.5, 0); const h = new THREE.Group(); h.add(sp); h.rotation.z = (i / 4) * Math.PI * 2 + 0.4; sp.userData.plain = true; hab.add(h); }
  const habPart = part([hab], v(0, 0, -1.72), v(-1.2, 4.2, -1.4), 1.4, 0.36);

  // solar wings
  [-1, 1].forEach((sgn, i) => {
    const boom = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), M.truss, sgn * 0.4, 0, 0); boom.rotation.z = Math.PI / 2; boom.userData.plain = true;
    const pan = mesh(new THREE.BoxGeometry(2.5, 0.025, 0.64), M.solar, sgn * 1.98, 0, 0);
    part([boom, pan], v(0, 0, -0.78), v(sgn * 4.4, -0.8, -0.3), sgn * 0.9, 0.16 + i * 0.07);
  });

  // dish
  const dish = mesh(new THREE.SphereGeometry(0.34, 24, 10, 0, Math.PI * 2, 0, 0.62), M.white); dish.rotation.x = Math.PI; dish.position.y = -0.34 + 0.66;
  const dg = new THREE.Group(); dg.add(dish); dg.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 5), M.truss, 0, 0.16, 0));
  dg.rotation.x = Math.PI; dg.rotation.z = 0.35;
  part([dg], v(0.1, -0.2, -1.05), v(1.4, -3.4, -0.6), -1.2, 0.3);

  // propellant
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2; const cg = new THREE.CapsuleGeometry(0.255, 0.95, 8, 20); cg.rotateX(Math.PI / 2);
    const tank = mesh(cg, i % 2 ? M.white : M.hull); const wrap = mesh(cylZ(0.262, 0.262, 0.16, 20, true), M.gold); wrap.userData.plain = true;
    const dir = v(Math.cos(a), Math.sin(a), 0);
    part([tank, wrap], dir.clone().multiplyScalar(0.47).setZ(0.42), dir.clone().multiplyScalar(3.4).add(v(0, 0, (i % 2 ? 1 : -1) * 0.9)), (i % 2 ? 1 : -1) * 0.8, 0.02 + i * 0.045);
  }

  // radiators
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const pg = new THREE.BoxGeometry(0.03, 1.75, 1.2);
    const pan = mesh(pg, M.radiator, 0, 1.06, 0); const h = new THREE.Group(); h.add(pan); h.rotation.z = a;
    const dir = v(-Math.sin(a), Math.cos(a), 0);
    part([h], v(0, 0, 1.62), dir.multiplyScalar(3.6).add(v(0, 0, 1.4)), 0.7, 0.26 + i * 0.05);
  }

  // drive
  const drive = [mesh(cylZ(0.3, 0.46, 0.5, 28), M.dark), mesh(cylZ(0.47, 0.47, 0.07, 28), M.gold, 0, 0, 0.26)];
  drive[1].userData.plain = true;
  const bell = lathe([[0.05, 0], [0.085, -0.1], [0.135, -0.26], [0.17, -0.42]], 24);
  const plumes = [];
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uThrust: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalMatrix*normal; vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`uniform float uTime; uniform float uThrust; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float a=pow(1.-vUv.y,1.7); float face=pow(abs(dot(normalize(vN),normalize(vV))),1.4);
        float fl=.86+.14*sin(uTime*46.+vUv.y*34.); float dia=.8+.2*sin(vUv.y*46.-uTime*30.);
        vec3 col=mix(vec3(.2,.38,1.),vec3(1.,.97,.95),a*a);
        gl_FragColor=vec4(col*a*mix(face,.35,.3)*fl*dia*uThrust*1.5,1.); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const spots = [[0, 0, 1.25]]; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; spots.push([Math.cos(a) * 0.29, Math.sin(a) * 0.29, 1]); }
  spots.forEach(([x, y, sc]) => {
    const b = mesh(bell, M.dark, x, y, 0.27); b.scale.setScalar(sc); b.material.side = THREE.DoubleSide; drive.push(b);
    const th = mesh(new THREE.CircleGeometry(0.075 * sc, 16), M.throat, x, y, 0.36); th.rotation.y = 0; th.userData.plain = true; drive.push(th);
    const cg = new THREE.ConeGeometry(0.16 * sc, 3.4, 20, 8, true); cg.translate(0, 1.7, 0); cg.rotateX(Math.PI / 2);
    const pl = mesh(cg, plumeMat, x, y, 0.3 + 0.42 * sc); pl.userData.plain = true; plumes.push(pl); drive.push(pl);
  });
  const haloG = new THREE.ConeGeometry(0.62, 8, 24, 6, true); haloG.translate(0, 4, 0); haloG.rotateX(Math.PI / 2);
  const halo = mesh(haloG, plumeMat.clone(), 0, 0, 0.6); halo.userData.plain = true; halo.material.uniforms.uTime = time; drive.push(halo); plumes.push(halo);
  const glow = new THREE.PointLight(0x7fb0ff, 0, 9, 1.6); glow.position.set(0, 0, 1.3); drive.push(glow);
  part(drive, v(0, 0, 2.46), v(0, -0.5, 4.8), -0.5, 0.42);

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const q0 = new THREE.Quaternion(), ax = new V3();
  function update(build, thrust, dt, tt) {
    for (const p of parts) {
      const t = clamp((build - p.delay) / 0.48), e = ease(t), k = 1 - e;
      const bob = k * 0.12;
      p.g.position.copy(p.home).addScaledVector(p.off, k);
      p.g.position.x += Math.sin(tt * 0.5 + p.seed) * bob; p.g.position.y += Math.cos(tt * 0.4 + p.seed * 2) * bob;
      ax.set(Math.sin(p.seed), Math.cos(p.seed * 1.7), 0.4).normalize();
      p.g.quaternion.copy(q0.setFromAxisAngle(ax, p.spin * k * (1 + Math.sin(tt * 0.15 + p.seed) * 0.15)));
      // blueprint edges glow while a module is in flight, flash as it locks, then go quiet
      const lock = Math.exp(-Math.pow((t - 0.97) / 0.06, 2));
      p.edge.opacity = t >= 1 ? Math.max(0, p.edge.opacity - dt * 1.4) : 0.2 + 0.4 * k + lock * 0.9;
      p.edge.visible = p.edge.opacity > 0.004;
    }
    hab.rotation.z += dt * 0.35;
    const th = thrust * (0.95 + Math.sin(tt * 31) * 0.05);
    plumes.forEach((pl, i) => { pl.material.uniforms.uThrust.value = i === plumes.length - 1 ? th * 0.16 : th; pl.scale.z = 0.25 + th * 0.9; pl.visible = th > 0.01; });
    M.throat.color.setRGB(0.5, 0.75, 2.2).multiplyScalar(th * 0.9);
    glow.intensity = th * 9;
    M.radiator.emissiveIntensity = 0.25 + th * 1.6;
    habPart.g.visible = true;
  }
  return { root, update };
}

/* The Meridian Yard: a hexagonal cage of gantries the ship is born inside. */
function buildYard() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.85, roughness: 0.45 });
  const R = 4.3, zs = [-3.6, -0.6, 2.4];
  zs.forEach((z) => { const t = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 4, 6), mat); t.position.z = z; g.add(t); });
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2; const x = Math.cos(a) * R, y = Math.sin(a) * R;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 5), mat); rail.rotation.x = Math.PI / 2; rail.position.set(x, y, -0.6); g.add(rail);
    zs.forEach((z, j) => {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), m); l.position.set(x, y, z); g.add(l);
      lamps.push({ m, ph: i * 0.7 + j * 1.3, red: (i + j) % 3 === 0 });
    });
    // work arms reaching in toward the hull
    if (i % 2 === 0) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), mat); arm.position.set(Math.cos(a) * (R - 0.75), Math.sin(a) * (R - 0.75), 0.9); arm.rotation.z = a + Math.PI / 2; g.add(arm); }
  }
  g.update = (tt) => {
    for (const l of lamps) {
      const b = l.red ? (Math.sin(tt * 2.2 + l.ph) > 0.86 ? 6 : 0.15) : 1.4 + Math.sin(tt * 0.8 + l.ph) * 0.3;
      if (l.red) l.m.color.setRGB(b, b * 0.16, b * 0.08); else l.m.color.setRGB(b, b * 0.82, b * 0.55);
    }
  };
  return g;
}

/* The chart: a schematic solar system that the destinations list drives. */
function buildOrrery() {
  const root = new THREE.Group();
  const defs = [
    { id: 'mercury', r: 9, size: 0.5, color: 0x9a8f86, a: 0.6 },
    { id: 'venus', r: 14, size: 0.8, color: 0xd9b98a, a: 3.9 },
    { id: 'earth', r: 20, size: 0.9, color: 0x62a8ff, a: 5.2, label: 'Earth / Luna', dest: 'luna' },
    { id: 'mars', r: 27, size: 0.72, color: 0xe0643a, a: 0.2, label: 'Mars', dest: 'mars' },
    { id: 'ceres', r: 36, size: 0.42, color: 0xc9c2b6, a: 2.2, label: 'Ceres', dest: 'ceres' },
    { id: 'jupiter', r: 50, size: 2.3, color: 0xdcb48a, a: 4.4, label: 'Jupiter / Europa', dest: 'europa' },
    { id: 'saturn', r: 64, size: 1.9, color: 0xe6d09a, a: 1.25, label: 'Saturn / Titan', dest: 'titan', ring: true },
    { id: 'uranus', r: 78, size: 1.3, color: 0xa4dde2, a: 3.3, label: 'Uranus', dest: 'uranus' },
    { id: 'neptune', r: 92, size: 1.3, color: 0x5f84ee, a: 5.75, label: 'Neptune / Triton', dest: 'triton' },
  ];
  const haloTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const sprite = (color, scale, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })); sp.scale.setScalar(scale); return sp; };

  const sunM = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 1.8) }));
  root.add(sunM, sprite(0xffc27a, 30, 0.75));

  const circle = (r) => { const pts = []; for (let i = 0; i <= 180; i++) { const a = (i / 180) * Math.PI * 2; pts.push(Math.cos(a) * r, 0, Math.sin(a) * r); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g; };
  const bone = new THREE.Color(0xece6da), amber = new THREE.Color(0xffb35c);
  const labelsEl = $('#orrery-labels');
  const planets = defs.map((d) => {
    const line = new THREE.Line(circle(d.r), new THREE.LineBasicMaterial({ color: bone.clone(), transparent: true, opacity: 0.2, depthWrite: false }));
    root.add(line);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(d.size, 20, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(d.color).multiplyScalar(1.5) })));
    g.add(sprite(d.color, d.size * 6, 0.5));
    if (d.ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(d.size * 1.4, d.size * 2.2, 40), new THREE.MeshBasicMaterial({ color: 0xcdbb8c, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })); rg.rotation.x = -Math.PI / 2 + 0.4; g.add(rg); }
    root.add(g);
    let el = null; if (d.label) { el = document.createElement('span'); el.textContent = d.label; labelsEl.appendChild(el); }
    return { ...d, line, g, el, w: 0.05 * Math.pow(20 / d.r, 1.5), k: 0 };
  });
  // the belt
  { const n = 700, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = 33 + Math.random() * 6.5; p.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.8, Math.sin(a) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xb9b2a6, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }))); }

  const RN = 64; const routeG = new THREE.BufferGeometry(); routeG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RN * 3), 3));
  const route = new THREE.Line(routeG, new THREE.LineBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.7), transparent: true, opacity: 0.95, depthWrite: false }));
  route.frustumCulled = false; root.add(route);
  const marker = new THREE.Mesh(new THREE.RingGeometry(1, 1.09, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.7), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
  root.add(marker);

  let target = planets[3]; const earthP = planets[2]; const wp = new V3(), iq = new THREE.Quaternion();
  return {
    root,
    focus(id) { target = planets.find((p) => p.dest === id) || target; },
    update(dt, tt, camera, W, H, labelsOn) {
      root.rotation.y += 0; root.updateMatrixWorld(true);
      for (const p of planets) {
        p.a += p.w * dt; p.g.position.set(Math.cos(p.a) * p.r, 0, Math.sin(p.a) * p.r);
        const on = p === target ? 1 : 0; p.k += (on - p.k) * (1 - Math.exp(-dt * 7));
        p.line.material.opacity = 0.16 + p.k * 0.6; p.line.material.color.copy(bone).lerp(amber, p.k);
        if (p.el && labelsOn) {
          wp.copy(p.g.position).applyMatrix4(root.matrixWorld).project(camera);
          p.el.style.transform = `translate(${((wp.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-wp.y * 0.5 + 0.5) * H - 4).toFixed(1)}px)`;
          p.el.classList.toggle('is-on', p === target);
        }
      }
      // transfer arc from Earth out to the chosen port
      const pos = routeG.attributes.position; let a0 = earthP.a, a1 = target.a;
      while (a1 < a0) a1 += Math.PI * 2; if (a1 - a0 < 0.5) a1 += target === earthP ? 0 : Math.PI * 2;
      for (let i = 0; i < RN; i++) { const t = i / (RN - 1), e = t * t * (3 - 2 * t); const a = lerp(a0, a1, t), r = lerp(earthP.r, target.r, e); pos.setXYZ(i, Math.cos(a) * r, 0, Math.sin(a) * r); }
      pos.needsUpdate = true; route.visible = target !== earthP;
      marker.position.copy(target.g.position);
      root.getWorldQuaternion(iq).invert(); marker.quaternion.copy(iq).multiply(camera.quaternion);
      const pulse = (tt * 0.6) % 1; marker.scale.setScalar(target.size * 2 + 1.2 + pulse * 2.2); marker.material.opacity = 1 - pulse;
    },
  };
}
