<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Minus, Plus, Loader2, ChefHat } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
import { conversationSteps } from '@/data/agentConversation'
import LoginPromptDialog from '@/components/LoginPromptDialog.vue'
import type { MealPreferences } from '@/types/agent'

const router = useRouter()
const prefStore = usePreferencesStore()
const authStore = useAuthStore()
const { preferences, isLoading, isSaving, error } = storeToRefs(prefStore)

const STASH_KEY = 'mealapp_stashed_preferences'
const WALKTHROUGH_KEY = 'mealapp_show_walkthrough'

// Local form state
const adults = ref(2)
const kids = ref(0)
const dietary = ref<string[]>([])
const budget = ref('')
const skill = ref('')
const time = ref('')
const cuisine = ref<string[]>([])
const notes = ref('')
const preferredSites = ref<string[]>([])
const showLoginPrompt = ref(false)

const siteOptions = [
  'AllRecipes',
  'Budget Bytes',
  'Serious Eats',
  'Simply Recipes',
  'Cookie and Kate',
  'Minimalist Baker',
  'Half Baked Harvest',
  'Smitten Kitchen',
]

// Options from conversation steps
const dietaryOptions = conversationSteps.dietary!.quickReplies
const budgetOptions = conversationSteps.budget!.quickReplies
const skillOptions = conversationSteps.skill!.quickReplies
const timeOptions = conversationSteps.time!.quickReplies
const cuisineOptions = conversationSteps.cuisine!.quickReplies

function parseHousehold(value: string) {
  const adultMatch = value.match(/(\d+)\s*adult/)
  const kidMatch = value.match(/(\d+)\s*kid/)
  adults.value = adultMatch ? parseInt(adultMatch[1]!) : 2
  kids.value = kidMatch ? parseInt(kidMatch[1]!) : 0
}

function formatHousehold(): string {
  const parts: string[] = []
  parts.push(adults.value === 1 ? '1 adult' : `${adults.value} adults`)
  if (kids.value > 0) {
    parts.push(kids.value === 1 ? '1 kid' : `${kids.value} kids`)
  }
  return parts.join(', ')
}

function populateForm(prefs: MealPreferences) {
  parseHousehold(prefs.household)
  dietary.value = [...prefs.dietary]
  budget.value = prefs.budget
  skill.value = prefs.skill
  time.value = prefs.time
  cuisine.value = [...prefs.cuisine]
  notes.value = prefs.notes
  preferredSites.value = [...(prefs.preferredSites ?? [])]
}

const currentPrefs = computed<MealPreferences>(() => ({
  household: formatHousehold(),
  dietary: dietary.value,
  budget: budget.value,
  skill: skill.value,
  time: time.value,
  cuisine: cuisine.value,
  notes: notes.value,
  preferredSites: preferredSites.value,
}))

const isReturningUser = computed(() => preferences.value !== null)

function toggleDietary(value: string) {
  const idx = dietary.value.indexOf(value)
  if (idx >= 0) {
    dietary.value.splice(idx, 1)
  } else if (value === 'none') {
    dietary.value = ['none']
  } else {
    const noneIdx = dietary.value.indexOf('none')
    if (noneIdx >= 0) dietary.value.splice(noneIdx, 1)
    dietary.value.push(value)
  }
}

function toggleSite(value: string) {
  const idx = preferredSites.value.indexOf(value)
  if (idx >= 0) {
    preferredSites.value.splice(idx, 1)
  } else {
    preferredSites.value.push(value)
  }
}

function toggleCuisine(value: string) {
  const idx = cuisine.value.indexOf(value)
  if (idx >= 0) {
    cuisine.value.splice(idx, 1)
  } else if (value === 'any') {
    cuisine.value = ['any']
  } else {
    const anyIdx = cuisine.value.indexOf('any')
    if (anyIdx >= 0) cuisine.value.splice(anyIdx, 1)
    cuisine.value.push(value)
  }
}

function stashFormState() {
  localStorage.setItem(STASH_KEY, JSON.stringify(currentPrefs.value))
}

function restoreStashedState() {
  const stashed = localStorage.getItem(STASH_KEY)
  if (!stashed) return false
  localStorage.removeItem(STASH_KEY)
  populateForm(JSON.parse(stashed))
  return true
}

async function handleSubmit() {
  // Login-before-save: if auth configured but not authenticated
  if (authStore.isAuthConfigured && !authStore.isAuthenticated) {
    stashFormState()
    showLoginPrompt.value = true
    return
  }

  await saveAndNavigate()
}

async function saveAndNavigate() {
  try {
    await prefStore.savePreferences(currentPrefs.value)
    if (!isReturningUser.value) {
      localStorage.setItem(WALKTHROUGH_KEY, 'true')
    }
    router.push('/calendar')
  } catch {
    // error is set in store
  }
}

function handleLoginSkip() {
  showLoginPrompt.value = false
  saveAndNavigate()
}

// When preferences load, populate form
watch(preferences, (prefs) => {
  if (prefs) populateForm(prefs)
}, { immediate: true })

onMounted(async () => {
  await prefStore.fetchPreferences()

  // After OAuth redirect: restore stashed form state and submit
  if (authStore.isAuthenticated && localStorage.getItem(STASH_KEY)) {
    restoreStashedState()
    await saveAndNavigate()
  }
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6">
    <!-- Jeeves intro -->
    <div class="mb-6 flex items-start gap-3">
      <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <ChefHat class="size-5 text-primary" />
      </div>
      <div>
        <h1 class="text-xl font-bold">
          {{ isReturningUser ? 'Welcome back!' : "I'm Jeeves, your meal planning butler." }}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ isReturningUser
            ? 'Update your preferences and generate a new meal plan.'
            : "Tell me about your household and I'll create a personalized weekly menu."
          }}
        </p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="mt-8 space-y-4">
      <Card v-for="i in 4" :key="i">
        <CardHeader>
          <div class="h-5 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div class="h-10 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>

    <!-- Preferences form -->
    <div v-else class="space-y-4">
      <!-- Household -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Household</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Adults</span>
            <div class="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                class="size-8 rounded-full"
                :disabled="adults <= 1"
                @click="adults--"
              >
                <Minus class="size-4" />
              </Button>
              <span class="w-4 text-center text-sm font-semibold tabular-nums">{{ adults }}</span>
              <Button
                variant="outline"
                size="icon"
                class="size-8 rounded-full"
                :disabled="adults >= 10"
                @click="adults++"
              >
                <Plus class="size-4" />
              </Button>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Kids</span>
            <div class="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                class="size-8 rounded-full"
                :disabled="kids <= 0"
                @click="kids--"
              >
                <Minus class="size-4" />
              </Button>
              <span class="w-4 text-center text-sm font-semibold tabular-nums">{{ kids }}</span>
              <Button
                variant="outline"
                size="icon"
                class="size-8 rounded-full"
                :disabled="kids >= 10"
                @click="kids++"
              >
                <Plus class="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Dietary Restrictions -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Dietary Restrictions</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="option in dietaryOptions"
              :key="option.value"
              :variant="dietary.includes(option.value) ? 'default' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="toggleDietary(option.value)"
            >
              {{ option.label }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Budget -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Weekly Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="option in budgetOptions"
              :key="option.value"
              :variant="budget === option.value ? 'default' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="budget = option.value"
            >
              {{ option.label }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Skill Level -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Cooking Skill</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="option in skillOptions"
              :key="option.value"
              :variant="skill === option.value ? 'default' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="skill = option.value"
            >
              {{ option.label }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Cooking Time -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Cooking Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="option in timeOptions"
              :key="option.value"
              :variant="time === option.value ? 'default' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="time = option.value"
            >
              {{ option.label }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Cuisines -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Cuisines</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="option in cuisineOptions"
              :key="option.value"
              :variant="cuisine.includes(option.value) ? 'default' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="toggleCuisine(option.value)"
            >
              {{ option.label }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Preferred Recipe Sites -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Preferred Recipe Sites</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="site in siteOptions"
              :key="site"
              :variant="preferredSites.includes(site) ? 'default' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="toggleSite(site)"
            >
              {{ site }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Notes -->
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            v-model="notes"
            placeholder="Allergies, favorites, dislikes..."
            class="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows="3"
          />
        </CardContent>
      </Card>

      <!-- Error message -->
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <!-- Submit button -->
      <Button
        class="w-full"
        size="lg"
        :disabled="isSaving"
        @click="handleSubmit"
      >
        <Loader2 v-if="isSaving" class="mr-2 size-4 animate-spin" />
        {{ isReturningUser ? 'Generate New Plan' : 'Generate My Meal Plan' }}
      </Button>
    </div>

    <LoginPromptDialog
      :open="showLoginPrompt"
      @update:open="showLoginPrompt = $event"
      @skip="handleLoginSkip"
    />
  </div>
</template>
