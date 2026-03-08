<script setup lang="ts">
import { Menu, Sun, Moon, Monitor } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { storeToRefs } from 'pinia'
import { useColorModeStore } from '@/stores/colorMode'
import { useNavigationStore } from '@/stores/navigation'

const { mode } = storeToRefs(useColorModeStore())
const { toggleNav } = useNavigationStore()
</script>

<template>
  <header class="sticky top-0 z-50 w-full bg-primary text-primary-foreground shadow-md">
    <div class="flex h-14 items-center justify-between px-4">
      <Button variant="ghost" size="icon" class="text-primary-foreground hover:bg-primary-foreground/10" @click="toggleNav">
        <Menu class="h-5 w-5" />
      </Button>

      <span class="text-lg font-semibold">MealApp</span>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="rounded-full text-primary-foreground hover:bg-primary-foreground/10">
            <Avatar class="h-8 w-8 bg-primary-foreground/20">
              <AvatarFallback class="bg-transparent text-primary-foreground">U</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Login</DropdownMenuItem>
          <DropdownMenuItem>Sign Up</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuItem @click="mode = 'light'">
            <Sun class="mr-2 h-4 w-4" />
            Light
          </DropdownMenuItem>
          <DropdownMenuItem @click="mode = 'dark'">
            <Moon class="mr-2 h-4 w-4" />
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem @click="mode = 'system'">
            <Monitor class="mr-2 h-4 w-4" />
            System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>
