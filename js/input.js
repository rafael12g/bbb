/* ============================================================
   BLACKWOOD — Input handling (keyboard + mouse)
   ============================================================ */
const Input = (() => {
  const keys = {};
  const pressed = {};   // edge-triggered
  let mouseX = 0, mouseY = 0;
  let mouseDown = false, mouseClicked = false;

  function dirKeys() {
    return {
      up:    keys['KeyW'] || keys['KeyZ'] || keys['ArrowUp'],
      down:  keys['KeyS'] || keys['ArrowDown'],
      left:  keys['KeyA'] || keys['KeyQ'] || keys['ArrowLeft'],
      right: keys['KeyD'] || keys['ArrowRight'],
      run:   keys['ShiftLeft'] || keys['ShiftRight'],
    };
  }

  function onKeyDown(e) {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.code] = false; }

  function onMouseMove(e) {
    const r = document.getElementById('game').getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  }
  function onMouseDown(){ mouseDown = true; mouseClicked = true; }
  function onMouseUp(){ mouseDown = false; }

  function bind() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  }

  function consume(code) {
    if (pressed[code]) { pressed[code] = false; return true; }
    return false;
  }
  function isDown(code){ return !!keys[code]; }
  function endFrame() {
    mouseClicked = false;
    for (const k in pressed) pressed[k] = false;
  }

  return {
    bind, dirKeys, consume, isDown, endFrame,
    get mouse(){ return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked }; },
  };
})();
