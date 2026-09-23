<template>
	<ListItem>
		<template #left>
			<ShiftIcon class="h-5 w-5 text-gray-500" />
			<div class="flex flex-col items-start gap-1.5">
				<div class="text-base font-normal text-gray-800">
					{{ dayjs(doc.date).format("D MMM, YYYY") }}
				</div>
				<div class="text-xs font-normal text-gray-500">
					{{ doc.in_time }} &rarr; {{ doc.out_time }}
				</div>
			</div>
		</template>
		<template #right>
			<span class="text-gray-700 font-normal rounded text-base">
				{{ doc.duration_hours }} {{ __("hrs") }}
			</span>
		</template>
	</ListItem>
</template>

<script setup>
import { inject } from "vue"

import ListItem from "@/components/ListItem.vue"
import ShiftIcon from "@/components/icons/ShiftIcon.vue"

const dayjs = inject("$dayjs")
const __ = inject("$translate")

defineProps({
	doc: {
		type: Object,
	},
})
</script>
