/* ============================================================
   BLACKWOOD — Save / Load (localStorage)
   ============================================================ */
const Save = (() => {
  const KEY = 'blackwood_save_v1';

  function exists() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  function read() {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  return { exists, write, read, clear };
})();
