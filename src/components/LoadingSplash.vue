<template>
  <div class="splash">
    <span class="seal">大木</span>
    <p class="splash-text">正在展开营造图纸<span class="dots">…</span></p>
  </div>
</template>

<style scoped>
.splash {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  background: var(--bg);
  z-index: 5;
}
.seal {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border: 2px solid var(--cinnabar);
  color: var(--cinnabar);
  font-weight: 700;
  font-size: 1.3rem;
  letter-spacing: 0.1em;
  border-radius: 3px;
  animation: seal-in 0.8s ease-out;
}
@keyframes seal-in {
  from { opacity: 0; transform: scale(1.25) rotate(-6deg); }
  to { opacity: 1; transform: none; }
}
.splash-text { color: var(--faint); font-size: 0.85rem; letter-spacing: 0.35em; }
.dots { animation: dots 1.4s infinite; }
@keyframes dots {
  0% { opacity: 0.2; }
  50% { opacity: 1; }
  100% { opacity: 0.2; }
}
</style>
