(() => {
  'use strict';
  const canvas = document.getElementById('track');
  const ctx = canvas.getContext('2d');
  const ui = {
    position: document.getElementById('position'), speed: document.getElementById('speed'),
    distance: document.getElementById('distance'), progress: document.getElementById('progress'),
    welcome: document.getElementById('welcome'), result: document.getElementById('result'),
    resultTitle: document.getElementById('result-title'), resultCopy: document.getElementById('result-copy'),
    message: document.getElementById('message'), toast: document.getElementById('toast')
  };
  const FINISH = 1500;
  let W = 0, H = 0, dpr = 1, lastTime = 0, toastTimer;
  let state = 'menu', distance = 0, speed = 0, playerX = 0, hitCooldown = 0, shake = 0;
  let roadOffset = 0, nextObstacle = 110, obstacles = [], rivals = [], keys = { left: false, right: false };
  const random = (min, max) => min + Math.random() * (max - min);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  function roadMetrics() {
    const roadW = Math.min(W * .79, 560);
    return { roadW, left: (W - roadW) / 2, laneW: roadW / 3, scale: H / 430, playerY: H * .75 };
  }
  function laneCenter(lane, m) { return m.left + m.laneW * (lane + .5); }

  function reset() {
    distance = 0; speed = 70; playerX = W / 2; hitCooldown = 0; shake = 0;
    roadOffset = 0; nextObstacle = 105; obstacles = [];
    const names = ['BOLT', 'NOVA', 'ACE', 'TURBO'];
    const colors = ['#28d7cc', '#ffbc42', '#a88bff', '#ff5c69'];
    rivals = names.map((name, i) => ({ name, color: colors[i], lane: i % 3, d: 24 + i * 27, speed: 184 + i * 8 + random(-5, 5), changeAt: random(5, 12) }));
    ui.position.textContent = '5/5'; ui.speed.textContent = '70'; ui.distance.textContent = '0'; ui.progress.style.width = '0%';
    addObstacles(320);
  }
  function start() {
    reset(); state = 'playing'; ui.welcome.classList.add('hidden'); ui.result.classList.add('hidden');
    lastTime = performance.now();
  }
  document.getElementById('start').addEventListener('click', start);
  document.getElementById('again').addEventListener('click', start);

  function addObstacles(until) {
    while (nextObstacle < distance + until) {
      const lane = Math.floor(random(0, 3));
      obstacles.push({ d: nextObstacle, lane, type: Math.random() < .72 ? 'cone' : 'barrel', hit: false });
      if (Math.random() < .22) {
        let second = Math.floor(random(0, 3));
        if (second === lane) second = (second + 1 + Math.floor(Math.random() * 2)) % 3;
        obstacles.push({ d: nextObstacle + 3, lane: second, type: 'cone', hit: false });
      }
      nextObstacle += random(95, 145);
    }
  }

  function steer(direction, pressed) {
    keys[direction] = pressed;
    document.getElementById(direction).classList.toggle('active', pressed);
  }
  for (const dir of ['left', 'right']) {
    const button = document.getElementById(dir);
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); steer(dir, true); });
    button.addEventListener('pointerup', () => steer(dir, false));
    button.addEventListener('pointercancel', () => steer(dir, false));
    button.addEventListener('lostpointercapture', () => steer(dir, false));
    button.addEventListener('contextmenu', e => e.preventDefault());
  }
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') steer('left', true);
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') steer('right', true);
    if (e.key === 'Enter' && state === 'menu') start();
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') steer('left', false);
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') steer('right', false);
  });
  window.addEventListener('blur', () => { steer('left', false); steer('right', false); });

  function showToast(text) {
    ui.toast.textContent = text; ui.toast.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1200);
  }
  function shout(text) {
    ui.message.textContent = text; ui.message.classList.remove('show'); void ui.message.offsetWidth; ui.message.classList.add('show');
  }
  function finish() {
    state = 'result';
    const place = 1 + rivals.filter(r => r.d > distance).length;
    ui.resultTitle.textContent = place === 1 ? 'CHIẾN THẮNG!' : `HẠNG ${place}`;
    ui.resultCopy.textContent = place === 1 ? 'Bạn đã vượt qua tất cả đối thủ AI. Tay lái quá đỉnh!' : 'Cuộc đua kết thúc rồi. Thử lại và vượt qua các đối thủ nhé!';
    ui.result.classList.remove('hidden');
  }

  function update(dt) {
    if (state !== 'playing') return;
    const m = roadMetrics();
    speed = Math.min(235, speed + 35 * dt);
    distance += speed / 3.6 * dt;
    roadOffset = (roadOffset + speed / 3.6 * m.scale * dt) % 80;
    if (hitCooldown > 0) hitCooldown -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 25);
    if (keys.left) playerX -= W * .82 * dt;
    if (keys.right) playerX += W * .82 * dt;
    const edge = m.left + 18;
    const rightEdge = m.left + m.roadW - 18;
    playerX = Math.max(edge, Math.min(rightEdge, playerX));
    addObstacles(430);

    for (const r of rivals) {
      r.d += r.speed / 3.6 * dt;
      r.changeAt -= dt;
      if (r.changeAt <= 0) { r.lane = Math.max(0, Math.min(2, r.lane + (Math.random() < .5 ? -1 : 1))); r.changeAt = random(5, 11); }
    }
    // Obstacles and AI cars collide with the player when they reach the same stretch of road.
    if (hitCooldown <= 0) {
      const playerLane = (playerX - m.left) / m.laneW;
      for (const o of obstacles) {
        if (!o.hit && Math.abs(o.d - distance) < 3.5 && Math.abs(playerLane - (o.lane + .5)) < .42) {
          o.hit = true; speed = Math.max(55, speed - 72); hitCooldown = 1.05; shake = 7; showToast('Va chạm! Giữ vững tay lái'); break;
        }
      }
      if (hitCooldown <= 0) {
        for (const r of rivals) {
          const rivalX = laneCenter(r.lane, m);
          if (Math.abs(r.d - distance) < 4 && Math.abs(playerX - rivalX) < m.laneW * .58) {
            speed = Math.max(60, speed - 48); hitCooldown = .8; shake = 5; showToast('Cẩn thận xe đối thủ!'); break;
          }
        }
      }
    }
    obstacles = obstacles.filter(o => !o.hit && o.d > distance - 25);
    ui.speed.textContent = Math.round(speed);
    ui.distance.textContent = Math.min(FINISH, Math.floor(distance)).toLocaleString('vi-VN');
    ui.progress.style.width = `${Math.min(100, distance / FINISH * 100)}%`;
    const place = 1 + rivals.filter(r => r.d > distance).length;
    ui.position.textContent = `${place}/5`;
    if (distance >= FINISH) finish();
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function drawCar(x, y, width, height, color, isPlayer = false, label = '') {
    ctx.save();
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,.32)'; roundedRect(x - width * .42 + 3, y - height * .44 + 5, width * .84, height * .88, width * .22); ctx.fill();
    // wheels
    ctx.fillStyle = '#101419';
    for (const side of [-1, 1]) {
      roundedRect(x + side * width * .41 - width * .09, y - height * .31, width * .18, height * .25, 4); ctx.fill();
      roundedRect(x + side * width * .41 - width * .09, y + height * .10, width * .18, height * .25, 4); ctx.fill();
    }
    // body
    ctx.fillStyle = color; roundedRect(x - width * .38, y - height * .48, width * .76, height * .96, width * .23); ctx.fill();
    // windshield and roof
    ctx.fillStyle = isPlayer ? '#16303a' : 'rgba(13,24,34,.86)';
    roundedRect(x - width * .27, y - height * .25, width * .54, height * .31, width * .12); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; roundedRect(x - width * .25, y + height * .08, width * .5, height * .23, width * .1); ctx.fill();
    // headlights / tail lamps
    ctx.fillStyle = isPlayer ? '#f5ffff' : '#ffebac';
    ctx.fillRect(x - width * .27, y - height * .46, width * .15, height * .045); ctx.fillRect(x + width * .12, y - height * .46, width * .15, height * .045);
    ctx.fillStyle = '#ff4656'; ctx.fillRect(x - width * .27, y + height * .40, width * .15, height * .045); ctx.fillRect(x + width * .12, y + height * .40, width * .15, height * .045);
    if (isPlayer) { ctx.fillStyle = '#d8ff3e'; ctx.fillRect(x - width * .31, y + height * .23, width * .62, 3); }
    if (label) {
      ctx.font = `800 ${Math.max(8, width * .18)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y - height * .58);
    }
    ctx.restore();
  }

  function drawBackground(m) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#102f37'); sky.addColorStop(.46, '#376047'); sky.addColorStop(1, '#1d4736');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // roadside grass bands
    ctx.fillStyle = 'rgba(4,25,24,.23)'; ctx.fillRect(0, 0, m.left, H); ctx.fillRect(m.left + m.roadW, 0, W - m.left - m.roadW, H);
    const spacing = 80;
    for (let y = -spacing + roadOffset % spacing; y < H + spacing; y += spacing) {
      const index = Math.floor((y + roadOffset) / spacing);
      for (const side of [-1, 1]) {
        const x = side < 0 ? m.left * .35 : m.left + m.roadW + (W - m.left - m.roadW) * .65;
        const yy = ((y % (H + spacing)) + (H + spacing)) % (H + spacing);
        if (Math.abs(index % 2) === 0) {
          ctx.fillStyle = 'rgba(7,27,24,.38)'; ctx.beginPath(); ctx.arc(x, yy, 12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#477b4c'; ctx.beginPath(); ctx.arc(x - 4, yy - 3, 8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
  function drawTrack(m) {
    const x = m.left;
    ctx.fillStyle = '#293137'; ctx.fillRect(x, 0, m.roadW, H);
    // edge rumble strips
    const strip = 9;
    for (let y = -80 + roadOffset % 80; y < H + 80; y += 40) {
      const idx = Math.floor((y + roadOffset) / 40);
      ctx.fillStyle = idx % 2 ? '#f4f2dc' : '#ef4e51';
      ctx.fillRect(x, y, strip, 22); ctx.fillRect(x + m.roadW - strip, y, strip, 22);
    }
    // lane markings
    ctx.fillStyle = 'rgba(241,244,225,.78)';
    for (let lane = 1; lane < 3; lane++) {
      const lx = x + m.laneW * lane - 1.3;
      for (let y = -66 + roadOffset % 66; y < H + 70; y += 66) ctx.fillRect(lx, y, 2.6, 34);
    }
    // subtle road highlight
    const shine = ctx.createLinearGradient(x, 0, x + m.roadW, 0);
    shine.addColorStop(0, 'rgba(255,255,255,.025)'); shine.addColorStop(.5, 'rgba(255,255,255,.08)'); shine.addColorStop(1, 'rgba(255,255,255,.025)');
    ctx.fillStyle = shine; ctx.fillRect(x + strip, 0, m.roadW - strip * 2, H);
  }
  function drawObstacles(m) {
    for (const o of obstacles) {
      const y = m.playerY + (distance - o.d) * m.scale;
      if (y < -50 || y > H + 50) continue;
      const x = laneCenter(o.lane, m), size = Math.max(17, m.laneW * .34);
      ctx.save(); ctx.translate(x, y);
      if (o.type === 'cone') {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(2, size * .31, size * .45, size * .15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff783b'; ctx.beginPath(); ctx.moveTo(0, -size * .42); ctx.lineTo(size * .38, size * .32); ctx.lineTo(-size * .38, size * .32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff0d6'; ctx.beginPath(); ctx.moveTo(-size * .19, size * .05); ctx.lineTo(size * .19, size * .05); ctx.lineTo(size * .26, size * .18); ctx.lineTo(-size * .26, size * .18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e9542f'; ctx.fillRect(-size * .42, size * .29, size * .84, size * .13);
      } else {
        ctx.fillStyle = '#f2ad30'; roundedRect(-size * .35, -size * .35, size * .7, size * .7, 5); ctx.fill();
        ctx.fillStyle = '#fff2d6'; ctx.fillRect(-size * .32, -size * .08, size * .64, size * .14);
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-size * .35, size * .22, size * .7, size * .12);
      }
      ctx.restore();
    }
  }
  function drawFinish(m) {
    const y = m.playerY + (distance - FINISH) * m.scale;
    if (y < -45 || y > H + 45) return;
    const square = 16, left = m.left + 9, width = m.roadW - 18;
    for (let row = 0; row < 2; row++) for (let col = 0; col < Math.ceil(width / square); col++) {
      ctx.fillStyle = (row + col) % 2 ? '#f8faf2' : '#17212a';
      ctx.fillRect(left + col * square, y + row * square, square, square);
    }
    ctx.fillStyle = '#fff'; ctx.font = '900 11px Inter'; ctx.textAlign = 'center'; ctx.fillText('FINISH', W / 2, y - 5);
  }
  function draw() {
    const m = roadMetrics();
    ctx.save();
    if (shake > 0) ctx.translate(random(-shake, shake), random(-shake, shake));
    drawBackground(m); drawTrack(m); drawFinish(m);
    // Render cars by their depth so cars farther up the road are behind nearer ones.
    const cars = rivals.map(r => ({ d: r.d, x: laneCenter(r.lane, m), y: m.playerY + (distance - r.d) * m.scale, color: r.color, label: r.name, player: false }));
    cars.sort((a, b) => a.y - b.y);
    for (const car of cars) {
      if (car.y > -80 && car.y < H + 80) drawCar(car.x, car.y, Math.min(m.laneW * .55, 48), Math.min(m.laneW * .92, 82), car.color, false, car.label);
    }
    drawObstacles(m);
    const blink = hitCooldown > 0 && Math.floor(hitCooldown * 14) % 2 === 0;
    if (!blink) drawCar(playerX, m.playerY, Math.min(m.laneW * .62, 52), Math.min(m.laneW * 1.05, 91), '#e8f1f3', true);
    ctx.restore();
    if (state === 'menu') {
      // little preview cars keep the title screen lively
      const t = performance.now() / 1000;
      ctx.globalAlpha = .45; drawCar(W / 2 + Math.sin(t) * m.laneW * .65, H * .74, 44, 76, '#e8f1f3', true); ctx.globalAlpha = 1;
    }
  }
  function frame(now) {
    const dt = Math.min(.04, (now - lastTime) / 1000 || 0); lastTime = now;
    update(dt); draw(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
