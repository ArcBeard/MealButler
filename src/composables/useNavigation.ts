import { ref } from 'vue'

const navOpen = ref(false)

export function useNavigation() {
  function toggleNav() {
    navOpen.value = !navOpen.value
  }

  return { navOpen, toggleNav }
}
