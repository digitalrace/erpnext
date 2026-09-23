<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home" />
        </ion-buttons>
        <ion-title>Daily Work Report</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="flex flex-col gap-4 mt-4">
        <div>
          <label class="text-sm text-gray-500">Date *</label>
          <input type="date" v-model="form.date"
            class="w-full border rounded-lg p-2 mt-1 text-base" />
        </div>
        <div>
          <label class="text-sm text-gray-500">Work Done *</label>
          <textarea v-model="form.work_done" rows="4"
            class="w-full border rounded-lg p-2 mt-1 text-base" />
        </div>
        <div>
          <label class="text-sm text-gray-500">Attachment</label>
          <input type="file" @change="handleFile"
            class="w-full border rounded-lg p-2 mt-1 text-base" />
        </div>
        <button @click="submitReport"
          :disabled="loading"
          class="w-full bg-blue-600 text-white rounded-lg p-3 text-base font-medium mt-2">
          {{ loading ? 'Submitting...' : 'Submit Report' }}
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { employeeResource } from "@/data/employee"

const router = useRouter()
const loading = ref(false)
const attachedFile = ref(null)
const employeeId = ref(null)

const form = ref({
  date: new Date().toISOString().split("T")[0],
  work_done: "",
})

onMounted(async () => {
  if (!employeeResource.data) {
    await employeeResource.fetch()
  }
  employeeId.value = employeeResource.data?.name
})

function handleFile(e) {
  attachedFile.value = e.target.files[0]
}

function getCsrfToken() {
  return window.csrf_token || ""
}

async function submitReport() {
  if (!form.value.work_done) {
    alert("Work Done is required!")
    return
  }
  loading.value = true
  try {
    const res = await fetch("/api/resource/Daily Work Report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify({
        employee: employeeId.value,
        date: form.value.date,
        work_done: form.value.work_done,
      }),
    })
    const data = await res.json()
    if (data.data?.name && attachedFile.value) {
      const fd = new FormData()
      fd.append("file", attachedFile.value)
      fd.append("doctype", "Daily Work Report")
      fd.append("docname", data.data.name)
      fd.append("is_private", 0)
      await fetch("/api/method/upload_file", {
        method: "POST",
        headers: { "X-Frappe-CSRF-Token": getCsrfToken() },
        body: fd,
      })
    }
    alert("Report submitted successfully!")
    router.push("/home")
  } catch (e) {
    alert("Error: " + e.message)
  } finally {
    loading.value = false
  }
}
</script>
