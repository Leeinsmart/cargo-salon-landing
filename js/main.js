/* ════════════════════════════════════════════
   CARGO SALON ’27 — interaction & WebGL layer
   GSAP (ScrollTrigger / SplitText) + Lenis + Three.js
   ════════════════════════════════════════════ */

import * as THREE from 'three';

const { gsap, ScrollTrigger, SplitText, Lenis } = window;
gsap.registerPlugin(ScrollTrigger, SplitText);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ── smooth scroll ─────────────────────────── */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop(); // released when the loader finishes
}

/* ════════════════════════════════════════════
   THREE.JS — the "liquid alloy" orb
   (paint, metal and motion — never a car)
   ════════════════════════════════════════════ */
let scrollSmooth = 0;

function initThree() {
  const canvas = document.getElementById('webgl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.z = 7;

  /* orb — noise-displaced alloy blob with volt fresnel rim */
  const NOISE = `
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  const orbMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.22 },
    },
    vertexShader: `
      uniform float uTime; uniform float uAmp;
      varying vec3 vN; varying vec3 vV; varying float vD;
      ${NOISE}
      void main(){
        float n1 = snoise(normal * 1.6 + uTime * 0.18);
        float n2 = snoise(normal * 4.2 - uTime * 0.12);
        float d = n1 * uAmp + n2 * uAmp * 0.35;
        vD = d;
        vec3 p = position + normal * d;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float fres = pow(1.0 - max(dot(V, N), 0.0), 2.2);
        vec3 base = vec3(0.045, 0.045, 0.052);
        vec3 volt = vec3(0.843, 1.0, 0.243);
        vec3 ice  = vec3(0.55, 0.75, 1.0);
        float band = smoothstep(-0.15, 0.25, vD);
        vec3 col = base + volt * fres * 0.85 + ice * pow(fres, 3.0) * 0.55 + volt * band * 0.05;
        vec3 L = normalize(vec3(0.6, 0.8, 0.5));
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 26.0);
        col += vec3(1.0) * spec * 0.22;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 48), orbMat);
  const orbGroup = new THREE.Group();
  orbGroup.add(orb);
  scene.add(orbGroup);

  /* rings — thin "spray booth" light hoops around the orb */
  const rings = new THREE.Group();
  const ringSpecs = [
    { r: 2.5, color: 0xd7ff3e, opacity: 0.30, rx: 1.2, ry: 0.4 },
    { r: 3.2, color: 0xf2f0ea, opacity: 0.12, rx: 1.9, ry: -0.3 },
    { r: 4.0, color: 0xd7ff3e, opacity: 0.10, rx: 0.6, ry: 0.9 },
  ];
  for (const s of ringSpecs) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(s.r, 0.006, 8, 160),
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.opacity })
    );
    ring.rotation.set(s.rx, s.ry, 0);
    rings.add(ring);
  }
  orbGroup.add(rings);

  /* dust — slow drifting particles, half volt / half white */
  const makeDust = (count, color, size, opacity) => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3.5 + Math.random() * 5.5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
      pos[i * 3 + 2] = r * Math.cos(ph) * 0.6 - 1.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
      color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
  };
  const dustA = makeDust(420, 0xd7ff3e, 0.03, 0.55);
  const dustB = makeDust(260, 0xf2f0ea, 0.022, 0.4);
  scene.add(dustA, dustB);

  /* scroll choreography — orb travels as the page unfolds */
  const KEYS = [
    { p: 0.00, x: 1.55, y: -0.15, s: 1.00, amp: 0.22 },
    { p: 0.05, x: 1.55, y: -0.15, s: 1.00, amp: 0.22 },
    { p: 0.10, x: -1.75, y: 0.10, s: 0.72, amp: 0.30 },
    { p: 0.13, x: -1.75, y: 0.10, s: 0.68, amp: 0.30 },
    { p: 0.20, x: 0.00, y: -3.40, s: 0.55, amp: 0.45 },
    { p: 0.90, x: 0.00, y: -3.40, s: 0.62, amp: 0.50 },
    { p: 1.00, x: 0.00, y: -0.05, s: 1.26, amp: 0.60 },
  ];
  const lerp = (a, b, t) => a + (b - a) * t;
  const sample = (p) => {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].p < p) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p || 1)));
    const e = t * t * (3 - 2 * t); // smoothstep between keyframes
    return {
      x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e),
      s: lerp(a.s, b.s, e), amp: lerp(a.amp, b.amp, e),
    };
  };

  /* mouse parallax */
  const mouse = { x: 0, y: 0 };
  if (fine) {
    window.addEventListener('mousemove', (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  let time = 0;
  gsap.ticker.add((_, dt) => {
    if (document.hidden) return;
    const d = Math.min(dt, 60) / 1000;
    time += d * (reduced ? 0.15 : 1);

    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const target = max > 0 ? window.scrollY / max : 0;
    scrollSmooth += (target - scrollSmooth) * 0.06;

    const k = sample(scrollSmooth);
    const xf = Math.min(1, window.innerWidth / 1100);
    orbGroup.position.set(k.x * xf, k.y, 0);
    orbGroup.scale.setScalar(k.s);
    orbMat.uniforms.uTime.value = time;
    orbMat.uniforms.uAmp.value = k.amp;

    orb.rotation.y += d * 0.12;
    orb.rotation.x = Math.sin(time * 0.1) * 0.2;
    rings.rotation.z += d * 0.05;
    rings.rotation.x = Math.sin(time * 0.07) * 0.3;
    dustA.rotation.y += d * 0.012;
    dustB.rotation.y -= d * 0.009;

    camera.position.x += (mouse.x * 0.35 - camera.position.x) * 0.04;
    camera.position.y += (-mouse.y * 0.25 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

try { initThree(); } catch (e) {
  console.warn('WebGL unavailable — continuing without the orb.', e);
  const c = document.getElementById('webgl');
  if (c) c.style.display = 'none';
}

/* ════════════════════════════════════════════
   GSAP — loader, reveals, marquees, pins
   ════════════════════════════════════════════ */
document.fonts.ready.then(() => {

  let menuOpen = false;

  /* ── loader + hero intro ── */
  const heroSplits = [];
  document.querySelectorAll('.hero-title .line').forEach((line) => {
    heroSplits.push(new SplitText(line, { type: 'chars' }));
  });
  const heroChars = heroSplits.flatMap((s) => s.chars);

  const intro = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } });
  intro
    .to('.loader-core', { opacity: 0, y: -24, duration: 0.4, ease: 'power2.in' })
    .to('.loader-col', { yPercent: -100, duration: 0.85, ease: 'power4.inOut', stagger: 0.1 }, '-=0.05')
    .set('.loader', { display: 'none' })
    .from(heroChars, { yPercent: 120, duration: 1.1, stagger: 0.032 }, '-=0.55')
    .from('.hero-meta .hm', { y: 16, opacity: 0, duration: 0.7, stagger: 0.08 }, '-=0.7')
    .from('.hero-foot > *', { y: 24, opacity: 0, duration: 0.8, stagger: 0.1 }, '-=0.6')
    .from('.hero-badge', { scale: 0, opacity: 0, duration: 0.8, ease: 'back.out(1.6)' }, '-=0.6')
    .from('.scroll-cue', { opacity: 0, duration: 0.5 }, '-=0.3');

  const num = document.getElementById('loadNum');
  const count = { v: 0 };
  gsap.to(count, {
    v: 100,
    duration: reduced ? 0.2 : 1.6,
    ease: 'power2.inOut',
    onUpdate: () => { num.textContent = String(Math.round(count.v)).padStart(2, '0'); },
    onComplete: () => {
      intro.timeScale(reduced ? 10 : 1).play();
      lenis && lenis.start();
      ScrollTrigger.refresh();
    },
  });

  /* ── nav: glass after hero, hide on scroll down ── */
  const nav = document.querySelector('.nav');
  ScrollTrigger.create({
    start: 60,
    end: 'max',
    onUpdate: (self) => {
      nav.classList.toggle('scrolled', self.scroll() > 60);
      if (menuOpen) return;
      if (self.direction === 1 && self.scroll() > 300) gsap.to(nav, { yPercent: -110, duration: 0.4, ease: 'power3.out' });
      else gsap.to(nav, { yPercent: 0, duration: 0.4, ease: 'power3.out' });
    },
  });

  gsap.to('.scroll-cue', {
    opacity: 0,
    scrollTrigger: { start: 30, end: 240, scrub: true },
  });

  /* ── section headings: masked line reveals ── */
  document.querySelectorAll('.sec-title').forEach((el) => {
    const split = new SplitText(el, { type: 'lines', mask: 'lines' });
    gsap.from(split.lines, {
      yPercent: 115,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
  document.querySelectorAll('.sec-label').forEach((el) => {
    gsap.from(el, {
      opacity: 0, x: -18, duration: 0.7, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  /* ── volt marquee: endless + scroll-reactive speed ── */
  const marqueeTween = gsap.to('.marquee-track', { xPercent: -50, duration: 22, ease: 'none', repeat: -1 });
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const v = 1 + Math.min(Math.abs(self.getVelocity()) / 1200, 3);
      gsap.to(marqueeTween, { timeScale: v, duration: 0.3, overwrite: true });
    },
  });

  /* ── manifesto: word-by-word ignition ── */
  const mSplit = new SplitText('.manifesto-text', { type: 'words', wordsClass: 'word' });
  gsap.to(mSplit.words, {
    opacity: 1,
    stagger: 0.06,
    ease: 'none',
    scrollTrigger: { trigger: '.manifesto-text', start: 'top 78%', end: 'bottom 45%', scrub: 0.4 },
  });
  gsap.from('.manifesto-note', {
    opacity: 0, y: 16, duration: 0.8,
    scrollTrigger: { trigger: '.manifesto-note', start: 'top 88%' },
  });

  /* ── stats counters ── */
  document.querySelectorAll('.stat-num').forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(obj, {
        v: target, duration: 1.6, ease: 'power3.out',
        onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString('en-US') + suffix; },
      }),
    });
  });
  gsap.from('.stat', {
    y: 30, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out',
    scrollTrigger: { trigger: '.stats', start: 'top 85%' },
  });

  /* ── the problem: pain rows + strike-through scrub ── */
  gsap.from('.pain-row', {
    y: 40, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out',
    scrollTrigger: { trigger: '.pain-list', start: 'top 82%' },
  });
  document.querySelectorAll('.pain-row').forEach((row) => {
    gsap.to(row.querySelector('.strike'), {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: row, start: 'top 68%', end: 'top 40%', scrub: 0.4 },
    });
  });
  gsap.from('.problem-closer', {
    opacity: 0, y: 14, duration: 0.7,
    scrollTrigger: { trigger: '.problem-closer', start: 'top 92%' },
  });

  /* ── one-stop: the wire untangles through five stations ── */
  const mmHow = gsap.matchMedia();
  mmHow.add('(min-width: 701px)', () => {
    const path = document.querySelector('.wire-path');
    if (!path) return;
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });

    // sample the path once to find the progress at which it crosses each node
    const samples = [];
    const N = 400;
    for (let i = 0; i <= N; i++) samples.push(path.getPointAtLength((len * i) / N).x);
    const timeAtX = (cx) => {
      const idx = samples.findIndex((x) => x >= cx);
      return idx === -1 ? 1 : idx / N;
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.howit',
        start: 'top top',
        end: '+=1400',
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
      },
    });
    tl.to(path, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0);
    document.querySelectorAll('.wire-node').forEach((node) => {
      const cx = parseFloat(node.querySelector('circle').getAttribute('cx'));
      const t = timeAtX(cx);
      tl.to(node.querySelector('circle'), { fill: '#d7ff3e', stroke: '#d7ff3e', duration: 0.02 }, t);
      tl.to(node.querySelector('text'), { fill: '#0a0a0b', duration: 0.02 }, t);
    });
    tl.from('.step-card', {
      y: 36, opacity: 0, stagger: 0.075, duration: 0.2, ease: 'power2.out',
    }, Math.max(0, timeAtX(560) - 0.08));
  });
  mmHow.add('(max-width: 700px)', () => {
    gsap.from('.step-card', {
      x: -24, opacity: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out',
      scrollTrigger: { trigger: '.steps', start: 'top 85%' },
    });
  });

  /* ── packages: cards + per-card sequence timeline ── */
  gsap.from('.pk-card', {
    y: 50, opacity: 0, stagger: 0.08, duration: 0.85, ease: 'power3.out',
    clearProps: 'transform,opacity',
    scrollTrigger: { trigger: '.pk-grid', start: 'top 82%' },
  });
  document.querySelectorAll('.pk-card').forEach((card) => {
    gsap.from(card.querySelectorAll('.pk-steps li'), {
      x: -16, opacity: 0, stagger: 0.07, duration: 0.5, ease: 'power2.out',
      scrollTrigger: { trigger: card, start: 'top 72%' },
    });
    gsap.from(card.querySelector('.pk-line'), {
      scaleY: 0, duration: 0.8, ease: 'power2.out',
      scrollTrigger: { trigger: card, start: 'top 72%' },
    });
  });

  /* ── zones: pinned horizontal drag-through ── */
  const track = document.querySelector('.zones-track');
  const horizontal = () => -(track.scrollWidth - window.innerWidth);
  gsap.to(track, {
    x: horizontal,
    ease: 'none',
    scrollTrigger: {
      trigger: '.zones',
      start: 'top top',
      end: () => '+=' + (track.scrollWidth - window.innerWidth),
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  gsap.from('.zone-card', {
    opacity: 0, x: 80, stagger: 0.06, duration: 0.8, ease: 'power3.out',
    clearProps: 'transform,opacity', // keep CSS hover lift alive afterwards
    scrollTrigger: { trigger: '.zones', start: 'top 60%' },
  });

  /* ── program rows ── */
  gsap.from('.prog-row', {
    y: 36, opacity: 0, stagger: 0.07, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: '.prog-list', start: 'top 82%' },
  });

  /* ── exhibitor marquees: alternating directions ── */
  document.querySelectorAll('.ex-row').forEach((row) => {
    const dir = parseInt(row.dataset.dir, 10) || 1;
    const t = row.querySelector('.ex-track');
    gsap.fromTo(t,
      { xPercent: dir === 1 ? 0 : -50 },
      { xPercent: dir === 1 ? -50 : 0, duration: 34, ease: 'none', repeat: -1 });
  });
  gsap.from('.ex-row', {
    opacity: 0, y: 24, stagger: 0.12, duration: 0.8,
    scrollTrigger: { trigger: '.exhibitors', start: 'top 75%' },
  });

  /* ── schedule ── */
  gsap.from('.day-row', {
    y: 40, opacity: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out',
    scrollTrigger: { trigger: '.schedule .day-row', start: 'top 82%' },
  });

  /* ── tickets ── */
  gsap.from('.tk-card', {
    y: 50, opacity: 0, stagger: 0.09, duration: 0.85, ease: 'power3.out',
    clearProps: 'transform,opacity',
    scrollTrigger: { trigger: '.tk-grid', start: 'top 82%' },
  });

  /* ── venue + footer ── */
  gsap.from('.venue-title span', {
    yPercent: 40, opacity: 0, stagger: 0.1, duration: 1, ease: 'power4.out',
    scrollTrigger: { trigger: '.venue-title', start: 'top 85%' },
  });
  gsap.from('.v-block', {
    y: 28, opacity: 0, stagger: 0.1, duration: 0.7,
    scrollTrigger: { trigger: '.venue-grid', start: 'top 85%' },
  });
  gsap.fromTo('.foot-title', { scale: 0.92, opacity: 0.4 }, {
    scale: 1, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: 'footer', start: 'top 80%', end: 'top 20%', scrub: 0.5 },
  });

  /* ════════ interactions ════════ */

  /* custom cursor */
  if (fine) {
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    const label = document.querySelector('.cursor-label');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
    window.addEventListener('mousemove', (e) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    }, { passive: true });

    document.querySelectorAll('[data-cursor]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const text = el.dataset.cursor;
        if (text) { label.textContent = text.toUpperCase(); ring.classList.add('has-label'); }
        gsap.to(ring, { scale: text ? 2.4 : 1.7, duration: 0.3 });
        gsap.to(dot, { scale: 0, duration: 0.3 });
      });
      el.addEventListener('mouseleave', () => {
        ring.classList.remove('has-label');
        label.textContent = '';
        gsap.to(ring, { scale: 1, duration: 0.3 });
        gsap.to(dot, { scale: 1, duration: 0.3 });
      });
    });

    /* magnetic buttons */
    document.querySelectorAll('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - r.left - r.width / 2) * 0.3,
          y: (e.clientY - r.top - r.height / 2) * 0.35,
          duration: 0.4, ease: 'power3.out',
        });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* fullscreen menu */
  const burger = document.querySelector('.burger');
  const overlay = document.querySelector('.menu-overlay');
  const menuTl = gsap.timeline({ paused: true })
    .set(overlay, { visibility: 'visible' })
    .to(overlay, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power4.inOut' })
    .from('.menu-links a', { yPercent: 70, opacity: 0, stagger: 0.05, duration: 0.5, ease: 'power3.out' }, '-=0.25')
    .from('.menu-meta span', { opacity: 0, y: 10, stagger: 0.05, duration: 0.3 }, '-=0.3');

  const toggleMenu = (open) => {
    menuOpen = open;
    nav.classList.toggle('menu-open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    overlay.setAttribute('aria-hidden', String(!open));
    if (open) { menuTl.timeScale(1).play(); lenis && lenis.stop(); }
    else { menuTl.timeScale(1.4).reverse(); lenis && lenis.start(); }
  };
  burger.addEventListener('click', () => toggleMenu(!menuOpen));

  /* smooth anchors */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      e.preventDefault();
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      if (menuOpen) toggleMenu(false);
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
      else target.scrollIntoView({ behavior: 'auto' });
    });
  });

  /* toast */
  const toast = document.querySelector('.toast');
  gsap.set(toast, { xPercent: -50, yPercent: 220, opacity: 1 });
  let toastTl = null;
  const showToast = (msg) => {
    toast.textContent = msg;
    if (toastTl) toastTl.kill();
    toastTl = gsap.timeline()
      .to(toast, { yPercent: 0, duration: 0.5, ease: 'back.out(1.6)' })
      .to(toast, { yPercent: 220, duration: 0.45, ease: 'power3.in' }, '+=2.4');
  };

  document.querySelectorAll('.tk-buy').forEach((b) => {
    b.addEventListener('click', () => showToast('Ticketing opens June 1, 2027 — join the list below ✱'));
  });
  document.querySelectorAll('.foot-socials a').forEach((a) => {
    a.addEventListener('click', () => showToast('Channels go live with wave 1 ✱'));
  });

  /* signup */
  const form = document.querySelector('.signup');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    if (!ok) { showToast('That email needs a second look ✱'); return; }
    form.innerHTML = '<p style="font-family:var(--font-mono);font-size:14px;color:var(--volt);letter-spacing:.08em;padding:14px 0;">YOU’RE ON THE LIST — SEE YOU IN TAIPEI ✱</p>';
    showToast('Subscribed. Build season is coming ✱');
  });

});
