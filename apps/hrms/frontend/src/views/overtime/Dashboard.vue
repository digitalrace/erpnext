<template>
	<BaseLayout :pageTitle="__('Overtime')">
		<template #body>
			<div class="flex flex-col items-center my-7 p-4">
				<div class="flex flex-col w-full bg-white rounded py-5 px-3.5 gap-5">
					<div class="flex flex-col gap-1.5">
						<span class="text-gray-600 text-sm font-medium leading-5">
							{{ __("Overtime") }}
						</span>
						<span class="text-gray-800 text-xl font-bold leading-6">
							{{ monthlyTotal }} {{ __("hrs") }}
						</span>
					</div>

					<Autocomplete
						:label="__('Month')"
						class="w-full"
						:placeholder="__('Select Month')"
						v-model="selectedMonth"
						:options="monthOptions"
					/>
				</div>

				<div class="flex flex-col items-center mt-5 mb-7 w-full">
					<div
						v-if="filteredLogs.length"
						class="flex flex-col bg-white rounded overflow-auto w-full"
					>
						<div
							class="p-3.5 items-center justify-between border-b"
							v-for="log in filteredLogs"
							:key="log.date + log.in_time"
						>
							<OvertimeItem :doc="log" />
						</div>
					</div>
					<EmptyState :message="__('No overtime records found')" v-else />
				</div>
			</div>
		</template>
	</BaseLayout>
</template>

<script setup>
import { inject, ref, computed } from "vue"
import { Autocomplete, createResource } from "frappe-ui"

import BaseLayout from "@/components/BaseLayout.vue"
import EmptyState from "@/components/EmptyState.vue"
import OvertimeItem from "@/components/OvertimeItem.vue"

const __ = inject("$translate")
const dayjs = inject("$dayjs")

const overtime = createResource({
	url: "get_my_overtime",
	auto: true,
})

// pichle 12 mahino ki list banao (current month included)
const monthOptions = computed(() => {
	const options = []
	for (let i = 0; i < 12; i++) {
		const m = dayjs().subtract(i, "month")
		options.push({
			label: m.format("MMM YYYY"),
			value: m.format("YYYY-MM"),
		})
	}
	return options
})

const selectedMonth = ref(monthOptions.value[0])

const filteredLogs = computed(() => {
	if (!overtime.data?.length || !selectedMonth.value?.value) return []
	return overtime.data.filter((log) =>
		dayjs(log.date).format("YYYY-MM") === selectedMonth.value.value
	)
})

const monthlyTotal = computed(() => {
	const total = filteredLogs.value.reduce((sum, log) => sum + log.duration_hours, 0)
	return Math.round(total * 100) / 100
})
</script>
