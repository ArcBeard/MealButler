<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/stores/auth'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  skip: []
}>()

const authStore = useAuthStore()

function handleGoogle() {
  authStore.signInWithGoogle()
}

function handleEmail() {
  authStore.signInWithHostedUI()
}

function handleSkip() {
  emit('update:open', false)
  emit('skip')
}
</script>

<template>
  <Sheet :open="open" @update:open="(val) => emit('update:open', val)">
    <SheetContent side="bottom" class="rounded-t-xl">
      <SheetHeader>
        <SheetTitle>Sign in to save your preferences</SheetTitle>
        <SheetDescription>
          Your meal preferences will be saved to your account so they persist across sessions and devices.
        </SheetDescription>
      </SheetHeader>
      <div class="flex flex-col gap-3 py-4">
        <Button class="w-full" @click="handleGoogle">
          <LogIn class="mr-2 h-4 w-4" />
          Continue with Google
        </Button>
        <Button variant="outline" class="w-full" @click="handleEmail">
          <LogIn class="mr-2 h-4 w-4" />
          Sign in with Email
        </Button>
      </div>
      <SheetFooter>
        <Button variant="ghost" class="w-full" @click="handleSkip">
          Skip for now
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
