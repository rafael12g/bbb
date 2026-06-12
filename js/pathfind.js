/* ============================================================
   BLACKWOOD — Grid pathfinding (BFS) for the monster AI
   ============================================================ */
const Pathfind = (() => {
  // returns array of {x,y} path from start to goal (excluding start), or null
  function bfs(grid, sx, sy, gx, gy, isBlocked, maxNodes = 5000) {
    const H = grid.length, W = grid[0].length;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
    const key = (x, y) => y * W + x;
    const visited = new Uint8Array(W * H);
    const prev = new Int32Array(W * H).fill(-1);
    const startK = key(sx, sy);
    const queue = [startK];
    visited[startK] = 1;
    let head = 0, count = 0;
    const goalK = key(gx, gy);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    while (head < queue.length && count < maxNodes) {
      const cur = queue[head++]; count++;
      if (cur === goalK) break;
      const cx = cur % W, cy = (cur - cx) / W;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = key(nx, ny);
        if (visited[nk]) continue;
        if (isBlocked(nx, ny) && nk !== goalK) continue;
        visited[nk] = 1; prev[nk] = cur;
        queue.push(nk);
      }
    }
    if (!visited[goalK]) return null;
    const path = [];
    let c = goalK;
    while (c !== startK && c !== -1) {
      const cx = c % W, cy = (c - cx) / W;
      path.push({ x: cx, y: cy });
      c = prev[c];
      if (c === -1) return null;
    }
    path.reverse();
    return path;
  }
  return { bfs };
})();
