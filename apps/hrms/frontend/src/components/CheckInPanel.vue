<template>
	<div class="flex flex-col bg-white rounded w-full py-6 px-4 border-none">
		<h2 class="text-lg font-bold text-gray-900">
			{{ __("Hey, {0} 👋", [employee?.data?.first_name]) }}
		</h2>

		<template v-if="settings.data?.allow_employee_checkin_from_mobile_app">
			<div class="font-medium text-sm text-gray-500 mt-1.5" v-if="lastLog">
				<span>{{ __("Last {0} was at {1}", [__(lastLogType), formatTimestamp(lastLog.time)]) }}</span>
				<span class="whitespace-pre"> &middot; </span>
				<router-link :to="{ name: 'EmployeeCheckinListView' }" v-slot="{ navigate }">
					<span @click="navigate" class="underline">View List</span>
				</router-link>
			</div>
			<Button
				class="mt-4 mb-1 drop-shadow-sm py-5 text-base"
				id="open-checkin-modal"
				@click="handleEmployeeCheckin"
			>
				<template #prefix>
					<FeatherIcon
						:name="nextAction.action === 'IN' ? 'arrow-right-circle' : 'arrow-left-circle'"
						class="w-4"
					/>
				</template>
				{{ nextAction.label }}
			</Button>
		</template>

		<div v-else class="font-medium text-sm text-gray-500 mt-1.5">
			{{ dayjs().format("ddd, D MMMM, YYYY") }}
		</div>
	</div>

	<ion-modal
		v-if="settings.data?.allow_employee_checkin_from_mobile_app"
		ref="modal"
		trigger="open-checkin-modal"
		:initial-breakpoint="1"
		:breakpoints="[0, 1]"
	>
		<div class="h-120 w-full flex flex-col items-center justify-center gap-5 p-4 mb-5">
			<div class="flex flex-col gap-1.5 mt-2 items-center justify-center">
				<div class="font-bold text-xl">
					{{ dayjs(checkinTimestamp).format("hh:mm:ss a") }}
				</div>
				<div class="font-medium text-gray-500 text-sm">
					{{ dayjs().format("D MMM, YYYY") }}
				</div>
			</div>

			<template v-if="settings.data?.allow_geolocation_tracking">
				<span v-if="locationStatus" class="font-medium text-gray-500 text-sm">
					{{ locationStatus }}
				</span>

				<div class="rounded border-4 translate-z-0 block overflow-hidden w-full h-170">
					<iframe
						width="100%"
						height="170"
						frameborder="0"
						scrolling="no"
						marginheight="0"
						marginwidth="0"
						style="border: 0"
						:src="`https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=15&amp;output=embed`"
					>
					</iframe>
				</div>
			</template>

			                        <Button :loading="checkins.insert.loading" variant="solid" class="w-full py-5 text-sm disabled:bg-gray-700" @click="openCamera(nextAction.action)">
                                {{ __("Confirm {0}", [nextAction.label]) }}
                        </Button>
                </div>
        </ion-modal>

        <div v-if="showCamera" class="fixed inset-0 bg-black/80 flex flex-col items-center justify-center" style="z-index: 999999;">
                <video id="selfie-video" autoplay playsinline class="rounded-lg w-4/5 max-h-96"></video>
                <div class="flex gap-3 mt-4">
                        <Button variant="solid" @click="capturePhoto">{{ __("Capture") }}</Button>
                        <Button variant="ghost" @click="stopCamera">{{ __("Cancel") }}</Button>
                </div>
	
        </div></template>

<script setup>
import {
    createListResource,
    toast,
    FeatherIcon,
    FileUploadHandler,
    frappeRequest,
} from "frappe-ui"
import { computed, inject, ref, onMounted, onBeforeUnmount, nextTick } from "vue"
import { IonModal, modalController } from "@ionic/vue"

import { formatTimestamp } from "@/utils/formatters"
import { settings } from "@/data/settings"

const DOCTYPE = "Employee Checkin"

const socket = inject("$socket")
const employee = inject("$employee")
const dayjs = inject("$dayjs")
const __ = inject("$translate")
const checkinTimestamp = ref(null)
const latitude = ref(0)
const longitude = ref(0)
const locationStatus = ref("")
// --- selfie capture ---
const showCamera = ref(false)
const capturedPhoto = ref(null)
const pendingAction = ref(null)
let mediaStream = null


async function openCamera(action) {
        modalController.dismiss()
        if (!window.isSecureContext) {
                toast({
                        title: __("Error"),
                        text: __("Camera requires a secure (HTTPS) connection"),
                        icon: "alert-circle",
                        position: "bottom-center",
                        iconClasses: "text-red-500",
                })
                return
        }
        pendingAction.value = action
        try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "user" },
                        audio: false,
                })
                showCamera.value = true
                await nextTick()
                document.getElementById("selfie-video").srcObject = mediaStream
        } catch (e) {
                toast({
                        title: __("Error"),
                        text: __("Camera access denied"),
                        icon: "alert-circle",
                        position: "bottom-center",
                        iconClasses: "text-red-500",
                })
        }
}

function stopCamera() {
        if (mediaStream) {
                mediaStream.getTracks().forEach((t) => t.stop())
                mediaStream = null
        }
        showCamera.value = false
}

function capturePhoto() {
        const video = document.getElementById("selfie-video")
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext("2d").drawImage(video, 0, 0)
        canvas.toBlob(
                (blob) => {
                        if (blob.size > 2 * 1024 * 1024) {
                                toast({
                                        title: __("Error"),
                                        text: __("Photo too large, please retake"),
                                        icon: "alert-circle",
                                        position: "bottom-center",
                                        iconClasses: "text-red-500",
                                })
                                return
                        }
                        capturedPhoto.value = blob
                        stopCamera()
                        submitLog(pendingAction.value)
                },
                "image/jpeg",
                0.8
        )
}
async function uploadSelfieAndAttach(checkinName) {
    if (!capturedPhoto.value) {
        console.error("No selfie captured")
        return
    }

    try {
        // ==============================
        // 1. Upload selfie
        // ==============================

        const handler = new FileUploadHandler()

        const uploadedFile = await handler.upload(
            new File(
                [capturedPhoto.value],
                `selfie_${Date.now()}.jpg`,
                {
                    type: "image/jpeg",
                }
            ),
            {
                private: true,
            }
        )

        console.log("UPLOAD RESPONSE:", uploadedFile)

        const fileUrl =
            uploadedFile?.file_url ||
            uploadedFile?.message?.file_url

        if (!fileUrl) {
            throw new Error("File URL not received")
        }

        console.log("FILE URL:", fileUrl)
        console.log("CHECKIN:", checkinName)

        // ==============================
        // 2. Set Photo field
        // ==============================

        const updateResponse = await frappeRequest({
            url: `/api/resource/Employee%20Checkin/${encodeURIComponent(checkinName)}`,
            method: "PUT",
            params: {
                custom_photo: fileUrl,
            },
        })

        console.log("CHECKIN UPDATE:", updateResponse)

        // ==============================
        // SUCCESS
        // ==============================

        toast({
            title: __("Selfie Saved"),
            text: __("Photo attached to Employee Checkin."),
            icon: "check",
            position: "bottom-center",
            iconClasses: "text-green-500",
        })

    } catch (error) {
        console.error("SELFIE ERROR:", error)

        toast({
            title: __("Upload Failed"),
            text:
                error?.messages?.[0] ||
                error?.message ||
                String(error),
            icon: "alert-circle",
            position: "bottom-center",
            iconClasses: "text-red-500",
        })
    } finally {
        capturedPhoto.value = null
    }
}
const checkins = createListResource({
	doctype: DOCTYPE,
	fields: ["name", "employee", "employee_name", "log_type", "time", "device_id"],
	filters: {
		employee: employee.data.name,
	},
	orderBy: "time desc",
})
checkins.reload()

const lastLog = computed(() => {
	if (checkins.list.loading || !checkins.data) return {}
	return checkins.data[0]
})

const lastLogType = computed(() => {
	return lastLog?.value?.log_type === "IN" ? "check-in" : "check-out"
})

const nextAction = computed(() => {
	return lastLog?.value?.log_type === "IN"
		? { action: "OUT", label: __("Check Out") }
		: { action: "IN", label: __("Check In") }
})

function handleLocationSuccess(position) {
	latitude.value = position.coords.latitude
	longitude.value = position.coords.longitude

	locationStatus.value = [
		__("Latitude: {0}°", [Number(latitude.value).toFixed(5)]),
		__("Longitude: {0}°", [Number(longitude.value).toFixed(5)]),
	].join(", ")
}

function handleLocationError(error) {
	locationStatus.value = "Unable to retrieve your location"
	if (error) locationStatus.value += `: ERROR(${error.code}): ${error.message}`
}

const fetchLocation = () => {
	if (!navigator.geolocation) {
		locationStatus.value = __("Geolocation is not supported by your current browser")
	} else {
		locationStatus.value = __("Locating...")
		navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError)
	}
}

const handleEmployeeCheckin = () => {
	checkinTimestamp.value = dayjs().format("YYYY-MM-DD HH:mm:ss")

	if (settings.data?.allow_geolocation_tracking) {
		fetchLocation()
	}
}

const submitLog = (logType) => {
	const actionLabel = logType === "IN" ? __("Check-in") : __("Check-out")

	checkins.insert.submit(
		{
			employee: employee.data.name,
			log_type: logType,
			time: checkinTimestamp.value,
			latitude: latitude.value,
			longitude: longitude.value,
		},
		{
			onSuccess(doc) {
			        uploadSelfieAndAttach(doc.name)
				modalController.dismiss()
				toast({
					title: __("Success"),
					text: __("{0} successful!", [actionLabel]),
					icon: "check-circle",
					position: "bottom-center",
					iconClasses: "text-green-500",
				})
			},
			onError(error) {
				let messages = error.messages || []

				for (const message of messages) {
					toast({
						title: __("Error"),
						text: message || __("{0} failed!", [actionLabel]),
						icon: "alert-circle",
						position: "bottom-center",
						iconClasses: "text-red-500",
					})
				}
			},
		}
	)
}

onMounted(() => {
	socket.emit("doctype_subscribe", DOCTYPE)
	socket.on("list_update", (data) => {
		if (data.doctype == DOCTYPE) {
			checkins.reload()
		}
	})
})

onBeforeUnmount(() => {
	socket.emit("doctype_unsubscribe", DOCTYPE)
	socket.off("list_update")
})
</script>
