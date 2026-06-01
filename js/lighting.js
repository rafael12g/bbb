/* ============================================================
   BLACKWOOD — Lighting & field of view (raycast based)
   Produces a per-tile light grid + persistent "explored" memory.
   ============================================================ */
const Lighting = (() => {
  let W = 0, H = 0;
  let lit = null;       // current frame light 0..1
  let explored = null;  // max remembered (faint) 0..1

  function init(w, h) {
    W = w; H = h;
    lit = new Float32Array(W * H);
    explored = new Float32Array(W * H);
  }
  const idx = (x, y) => y * W + x;
  function resetFrame() { lit.fill(0); }

  function mark(x, y, v) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = idx(x, y);
    if (v > lit[i]) lit[i] = v;
    if (v > explored[i]) explored[i] = Math.min(0.42, v);
  }

  function ray(px, py, angle, maxDist, baseBright, isWall) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const step = 0.18;
    let dist = 0, lastTx = -1, lastTy = -1;
    while (dist < maxDist) {
      const x = px + dx * dist, y = py + dy * dist;
      const tx = Math.floor(x), ty = Math.floor(y);
      const falloff = 1 - (dist / maxDist);
      const v = baseBright * falloff * falloff;
      if (tx !== lastTx || ty !== lastTy) {
        mark(tx, ty, v);
        lastTx = tx; lastTy = ty;
        if (isWall(tx, ty)) return;
      }
      dist += step;
    }
  }

  function compute(px, py, facing, flashlightOn, coneHalf, range, ambient, sanityFactor, isWall) {
    resetFrame();
    const ambRays = 90;
    for (let i = 0; i < ambRays; i++) {
      const a = (i / ambRays) * Math.PI * 2;
      ray(px, py, a, ambient * (0.7 + 0.3 * sanityFactor), 0.45 * sanityFactor, isWall);
    }
    if (flashlightOn) {
      const coneRays = 70;
      for (let i = 0; i <= coneRays; i++) {
        const t = i / coneRays;
        const a = facing - coneHalf + t * coneHalf * 2;
        const edge = Math.abs(t - 0.5) * 2;
        const bright = 1.0 - edge * 0.45;
        ray(px, py, a, range * (0.85 + 0.15 * sanityFactor), bright, isWall);
      }
      const coreRays = 18;
      for (let i = 0; i <= coreRays; i++) {
        const a = facing - coneHalf * 0.3 + (i / coreRays) * coneHalf * 0.6;
        ray(px, py, a, range * 1.05, 1.0, isWall);
      }
    }
  }

  function lightAt(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return lit[idx(x, y)];
  }
  function exploredAt(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return explored[idx(x, y)];
  }
  function resetExplored(){ if(explored) explored.fill(0); }

  return { init, compute, lightAt, exploredAt, resetExplored };
})();
