<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FormField from '@/components/ui/FormField.vue'
import GrantDetailsFields from '@/components/access/GrantDetailsFields.vue'
import { useGrantForm } from '@/composables/useGrantForm'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useGroupsStore } from '@/stores/groups'
import { useUsersStore } from '@/stores/users'
import { isMembershipOpen } from '@/domain/grants'
import { MAX_BULK_EMAILS, parseEmailList } from '@/domain/email-list'
import { normalizeEmail, validateEmail } from '@/domain/validation'
import { appConfig } from '@/config'
import type { AddGroupMembersResult, Group } from '@/types/access-control'

/** Adds many people to a group at once, from pasted emails or a .txt/.csv file. */
const open = defineModel<boolean>('open', { required: true })
const { group } = defineProps<{ group: Group }>()

const groupsStore = useGroupsStore()
const usersStore = useUsersStore()

const textId = useId()
const text = ref('')
const fileName = ref<string | null>(null)
const createMissing = ref(false)
const listError = ref<string | null>(null)
const result = ref<AddGroupMembersResult | null>(null)

// The approver is checked against each person on the server, so no grantee here.
const form = useGrantForm('', appConfig.actorEmail)

watch(open, (isOpen) => {
  if (!isOpen) return
  text.value = ''
  fileName.value = null
  createMissing.value = false
  listError.value = null
  result.value = null
  form.reset()
})

const emails = computed(() => parseEmailList(text.value))

/** What will happen to each email, before saving. */
const preview = computed(() => {
  const byEmail = new Map(usersStore.users.map((u) => [u.email, u]))
  const inGroup = new Set(
    groupsStore
      .membersOf(group.groupId)
      .filter((m) => isMembershipOpen(m))
      .map((m) => m.userId),
  )
  const approver = normalizeEmail(form.values.grantedBy)
  const counts = {
    ready: 0,
    missing: [] as string[],
    invalid: [] as string[],
    already: 0,
    approver: false,
  }
  for (const email of emails.value) {
    const user = byEmail.get(email)
    if (validateEmail(email)) counts.invalid.push(email)
    else if (email === approver) counts.approver = true
    else if (!user) counts.missing.push(email)
    else if (inGroup.has(user.userId)) counts.already++
    else counts.ready++
  }
  return counts
})

const toAdd = computed(
  () => preview.value.ready + (createMissing.value ? preview.value.missing.length : 0),
)

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow choosing the same file again
  if (!file) return
  const content = await file.text()
  text.value = text.value.trim() ? `${text.value.trim()}\n${content}` : content
  fileName.value = file.name
}

const { run: save, pending } = useAsyncAction(() => {
  const timing = form.toTiming()
  return groupsStore.addMembers(group.groupId, {
    emails: emails.value,
    addedAt: timing.grantedAt,
    expiresAt: timing.expiresAt,
    approvedBy: timing.grantedBy,
    reason: timing.reason,
    createMissingUsers: createMissing.value,
  })
})

async function submit(): Promise<void> {
  listError.value = !emails.value.length
    ? 'Paste emails or upload a file.'
    : emails.value.length > MAX_BULK_EMAILS
      ? `Add at most ${MAX_BULK_EMAILS} people at a time.`
      : null
  const valid = form.validate()
  if (listError.value || !valid) return
  const saved = await save()
  if (saved) result.value = saved
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Add many people"
    :description="`Add a list of people to ${group.groupName}. They all get the same dates, approver and reason.`"
    size="lg"
  >
    <!-- Step 2: what happened -->
    <div v-if="result" class="bulk">
      <p class="bulk__summary">
        <strong>{{ result.added.length }}</strong> added
        <template v-if="result.createdUsers.length">
          (including <strong>{{ result.createdUsers.length }}</strong> new to the app)
        </template>
        <template v-if="result.skipped.length">
          · <strong>{{ result.skipped.length }}</strong> skipped
        </template>
      </p>
      <p v-if="result.createdUsers.length" class="text-muted">
        New people's names were guessed from their email. Check them on the Users page.
      </p>
      <div v-if="result.skipped.length" class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Skipped</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in result.skipped" :key="s.email">
              <td>{{ s.email }}</td>
              <td>{{ s.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Step 1: the list -->
    <form v-else id="bulk-add-form" class="bulk" novalidate @submit.prevent="submit">
      <FormField
        :id="textId"
        v-slot="{ describedBy }"
        label="Emails"
        hint="Separate with commas, spaces or new lines. A CSV file can have other columns too; only emails are used."
        :error="listError"
        required
      >
        <textarea
          :id="textId"
          v-model="text"
          class="control bulk__text"
          rows="6"
          placeholder="jane.doe@rollerdigital.com, john.roe@rollerdigital.com"
          :aria-describedby="describedBy"
        />
      </FormField>

      <div class="bulk__file">
        <label class="bulk__file-button">
          <input type="file" accept=".txt,.csv,text/plain,text/csv" @change="onFile" />
          Upload .txt or .csv
        </label>
        <span v-if="fileName" class="text-muted">Added emails from {{ fileName }}</span>
      </div>

      <div v-if="emails.length" class="bulk__preview">
        <p>
          <strong>{{ emails.length }}</strong> email(s) found:
          <strong>{{ preview.ready }}</strong> ready to add
          <template v-if="preview.already"> · {{ preview.already }} already in the group</template>
          <template v-if="preview.invalid.length">
            · {{ preview.invalid.length }} not a Roller email
          </template>
          <template v-if="preview.approver"> · the approver (can't approve themselves)</template>
        </p>
        <template v-if="preview.missing.length">
          <p>
            <strong>{{ preview.missing.length }}</strong> not in the app yet:
            <span class="text-muted">{{ preview.missing.slice(0, 5).join(', ') }}</span>
            <span v-if="preview.missing.length > 5" class="text-muted">
              and {{ preview.missing.length - 5 }} more
            </span>
          </p>
          <label class="bulk__check">
            <input v-model="createMissing" type="checkbox" />
            Add them as new people too (name guessed from the email)
          </label>
        </template>
      </div>

      <GrantDetailsFields
        v-model:start-date="form.values.startDate"
        v-model:expiry-date="form.values.expiryDate"
        v-model:granted-by="form.values.grantedBy"
        v-model:reason="form.values.reason"
        :errors="form.errors.value"
      />
    </form>

    <template #footer>
      <BaseButton v-if="result" @click="open = false">Done</BaseButton>
      <template v-else>
        <BaseButton variant="secondary" @click="open = false">Cancel</BaseButton>
        <BaseButton type="submit" form="bulk-add-form" :loading="pending">
          {{ toAdd ? `Add ${toAdd} people` : 'Add people' }}
        </BaseButton>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.bulk {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bulk__text {
  font-family: inherit;
  resize: vertical;
}

.bulk__file {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.bulk__file-button {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-full);
  color: var(--color-accent);
  font-weight: 700;
  cursor: pointer;
}

.bulk__file-button:hover {
  background: var(--color-accent-subtle);
}

.bulk__file-button:focus-within {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.bulk__file-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.bulk__preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-accent-subtle);
}

.bulk__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  cursor: pointer;
}

.bulk__check input {
  accent-color: var(--color-accent);
}

.bulk__summary {
  font-size: var(--text-md);
}
</style>
