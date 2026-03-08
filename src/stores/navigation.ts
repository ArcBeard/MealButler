import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useNavigationStore = defineStore('navigation', () => {
  const navOpen = ref(false)

  function toggleNav() {
    navOpen.value = !navOpen.value
  }

  return { navOpen, toggleNav }
})
