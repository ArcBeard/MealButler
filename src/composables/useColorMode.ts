import { ref, watch } from 'vue'

export type ColorMode = 'light' | 'dark' | 'system'

const mode = ref<ColorMode>(
  (localStorage.getItem('color-mode') as ColorMode) || 'system'
)

function applyMode(value: ColorMode) {
  const isDark =
    value === 'dark' ||
    (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', isDark)
}

// React to system preference changes when mode is 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (mode.value === 'system') {
    applyMode('system')
  }
})

watch(mode, (value) => {
  if (value === 'system') {
    localStorage.removeItem('color-mode')
  } else {
    localStorage.setItem('color-mode', value)
  }
  applyMode(value)
}, { immediate: true })

export function useColorMode() {
  return { mode }
}
