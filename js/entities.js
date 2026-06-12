/* ============================================================
   BLACKWOOD — Entities: Player and the Monster (AI)
   Coordinates are in tile units (floats). 1 tile = 1 unit.
   ============================================================ */

class Player {
  constructor(x, y, facing) {
    this.x = x + 0.5; this.y = y + 0.5;
    this.facing = facing || 0;
    this.speed = 3.6;
    this.runMul = 1.85;
    this.radius = 0.28;
    this.stamina = 1;
    this.noise = 0;
    this.stepTimer = 0;
    this.hidden = false;
    this.hideRef = null;
    this.moving = false;
    this.safe = 0;            // grace seconds (after leaving a locker)
  }

  update(dt, game) {
    this.safe = Math.max(0, this.safe - dt);
    if (this.hidden) { this.noise = 0; this.moving = false; return; }
    const d = Input.dirKeys();
    let vx = 0, vy = 0;
    if (d.up) vy -= 1; if (d.down) vy += 1;
    if (d.left) vx -= 1; if (d.right) vx += 1;
    const mag = Math.hypot(vx, vy);
    this.moving = mag > 0;

    let running = false;
    if (d.run && this.stamina > 0.02 && this.moving) {
      running = true;
      this.stamina = Math.max(0, this.stamina - dt * 0.25);
    } else {
      this.stamina = Math.min(1, this.stamina + dt * 0.26);
    }
    const spd = this.speed * (running ? this.runMul : 1);

    if (mag > 0) {
      vx /= mag; vy /= mag;
      const nx = this.x + vx * spd * dt;
      const ny = this.y + vy * spd * dt;
      if (game.canWalk(nx, this.y, this.radius)) this.x = nx;
      if (game.canWalk(this.x, ny, this.radius)) this.y = ny;
      this.noise = running ? 1.0 : 0.3;   // walking is much quieter than running
      this.stepTimer -= dt;
      const interval = running ? 0.28 : 0.46;
      if (this.stepTimer <= 0) { Audio.footstep(running); this.stepTimer = interval; }
    } else {
      this.noise = 0;
    }

    const ms = Input.mouse;
    const cam = game.cam;
    const wx = (ms.x - cam.ox) / cam.scale;
    const wy = (ms.y - cam.oy) / cam.scale;
    this.facing = Math.atan2(wy - this.y, wx - this.x);
  }

  tileX(){ return Math.floor(this.x); }
  tileY(){ return Math.floor(this.y); }
}

class Monster {
  constructor(x, y, opts) {
    this.x = x + 0.5; this.y = y + 0.5;
    this.speed = opts.speed || 3.0;
    this.baseSpeed = this.speed;
    this.radius = 0.32;
    this.state = 'patrol';
    this.roam = (opts.roam && opts.roam.length) ? opts.roam.slice() : [[x,y]];
    this.roamIdx = 0;
    this.path = [];
    this.pathTimer = 0;
    this.target = null;
    this.lastSeen = null;
    this.enraged = false;
    this.growlTimer = 0;
    this.investigateTimer = 0;
    this.spawnDelay = opts.delay || 2.0;   // grace period at chapter start
  }

  tileX(){ return Math.floor(this.x); }
  tileY(){ return Math.floor(this.y); }

  enrage(){ this.enraged = true; this.speed = this.baseSpeed * 1.18; this.state='chase'; }

  canSee(game, p, maxRange) {
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRange) return false;
    const steps = Math.ceil(dist / 0.2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const tx = Math.floor(this.x + dx * t);
      const ty = Math.floor(this.y + dy * t);
      if (game.isWall(tx, ty)) return false;
    }
    return true;
  }

  update(dt, game) {
    if (!game.map.monster || !game.map.monster.enabled) return;
    if (this.spawnDelay > 0) { this.spawnDelay -= dt; return; }

    const p = game.player;
    const hasAmulet = game.inv.has('amulet');
    let repelled = false;
    if (hasAmulet) {
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      if (dist < 4.2) repelled = true;
    }

    let sees = false;
    if (!p.hidden) {
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      // light no longer betrays you from across the map: ~7 tiles with the torch,
      // and it can only notice you up close (2.4) in the dark.
      const range = game.flashlightOn ? 7 : 2.4;
      if (dist < range && this.canSee(game, p, range)) sees = true;
    }
    let hears = false;
    if (!p.hidden && p.noise > 0) {
      const hearRad = 2.5 + p.noise * 6 + (this.enraged ? 2 : 0);
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      if (dist < hearRad) hears = true;
    }

    if (repelled) {
      this.state = 'repelled';
    } else if (sees) {
      this.state = 'chase';
      this.lastSeen = { x: p.x, y: p.y };
    } else if (this.state === 'chase') {
      this.state = 'investigate';
      this.target = this.lastSeen ? { x: Math.floor(this.lastSeen.x), y: Math.floor(this.lastSeen.y) } : null;
      this.investigateTimer = 2.5;   // gives up the hunt faster — kill the light & it loses you
    } else if (hears) {
      this.state = 'investigate';
      this.target = { x: p.tileX(), y: p.tileY() };
      this.investigateTimer = 2.2;
    }

    this.pathTimer -= dt;
    this.growlTimer -= dt;

    if (this.state === 'repelled') {
      const ang = Math.atan2(this.y - p.y, this.x - p.x);
      const nx = this.x + Math.cos(ang) * this.speed * 0.6 * dt;
      const ny = this.y + Math.sin(ang) * this.speed * 0.6 * dt;
      if (game.canMonsterWalk(nx, this.y)) this.x = nx;
      if (game.canMonsterWalk(this.x, ny)) this.y = ny;
      if (this.growlTimer <= 0){ Audio.growl(0.6); this.growlTimer = 1.5; }
      return;
    }

    let goal = null;
    if (this.state === 'chase') {
      goal = { x: p.tileX(), y: p.tileY() };
      if (this.growlTimer <= 0){
        const dist = Math.hypot(p.x-this.x,p.y-this.y);
        Audio.growl(Math.min(1, dist/11)); this.growlTimer = 1.2;
      }
    } else if (this.state === 'investigate') {
      this.investigateTimer -= dt;
      goal = this.target;
      if (!goal || this.investigateTimer <= 0) this.state = 'patrol';
    }
    if (this.state === 'patrol') {
      const wp = this.roam[this.roamIdx];
      goal = { x: wp[0], y: wp[1] };
      if (Math.hypot(this.x - (wp[0]+0.5), this.y - (wp[1]+0.5)) < 0.8) {
        this.roamIdx = (this.roamIdx + 1) % this.roam.length;
      }
    }

    if (goal && (this.pathTimer <= 0 || this.path.length === 0)) {
      this.path = Pathfind.bfs(
        game.gridForPath(), this.tileX(), this.tileY(), goal.x, goal.y,
        (x,y)=>game.isWallForMonster(x,y)) || [];
      this.pathTimer = (this.state==='chase') ? 0.35 : 0.7;
    }

    if (this.path.length) {
      const next = this.path[0];
      const tx = next.x + 0.5, ty = next.y + 0.5;
      const ang = Math.atan2(ty - this.y, tx - this.x);
      const sp = this.speed * (this.state==='chase' ? 1 : 0.7);
      const nx = this.x + Math.cos(ang) * sp * dt;
      const ny = this.y + Math.sin(ang) * sp * dt;
      if (game.canMonsterWalk(nx, ny)) { this.x = nx; this.y = ny; }
      else { this.path = []; }
      if (Math.hypot(this.x - tx, this.y - ty) < 0.25) this.path.shift();
    }

    if (!p.hidden && p.safe <= 0) {
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      if (dist < 0.62) game.onCaught();
    }
  }
}
