/**
 * @copyright Copyright (c) 2024 Maksim Sukharev <antreesy.web@gmail.com>
 *
 * @author Marco Ambrosini <marcoambrosini@icloud.com>
 * @author Maksim Sukharev <antreesy.web@gmail.com>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { defineStore } from 'pinia'
import Vue from 'vue'

import { showError } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'

import { CONVERSATION } from '../constants.js'
import {
	configureBreakoutRooms,
	deleteBreakoutRooms,
	getBreakoutRooms,
	startBreakoutRooms,
	stopBreakoutRooms,
	broadcastMessageToBreakoutRooms,
	getBreakoutRoomsParticipants,
	requestAssistance,
	resetRequestAssistance,
	reorganizeAttendees,
	switchToBreakoutRoom,
} from '../services/breakoutRoomsService.ts'
import store from '../store/index.js'
import type {
	Conversation,
	Participant,
	BreakoutRoom,
	broadcastChatMessageParams,
	configureBreakoutRoomsParams,
	reorganizeAttendeesParams,
	switchToBreakoutRoomParams
} from '../types'

type Payload<T> = T & { token: string }
type State = {
	rooms: Record<string, Record<string, BreakoutRoom>>
}
export const useBreakoutRoomsStore = defineStore('breakoutRooms', {
	state: (): State => ({
		rooms: {},
	}),

	getters: {
		breakoutRooms: (state) => (token: string): BreakoutRoom[] => {
			return Object.values(Object(state.rooms[token]))
		},

		getParentRoomToken: (state) => (token: string): string | undefined => {
			for (const parentRoomToken in state.rooms) {
				if (state.rooms[parentRoomToken]?.[token] !== undefined) {
					return parentRoomToken
				}
			}
		},
	},

	actions: {
		/**
		 * The breakout rooms API return an array with mixed breakout and parent rooms, we want to update
		 * breakout rooms in this store and all conversations in conversationsStore.
		 *
		 * @param token the parent room token;
		 * @param conversationOrArray a single conversation or an array of conversations.
		 *
		 */
		processConversations(token: string, conversationOrArray: Conversation | Conversation[]) {
			const conversations = Array.isArray(conversationOrArray) ? conversationOrArray : [conversationOrArray]
			conversations.forEach(conversation => {
				if (conversation.objectType === CONVERSATION.OBJECT_TYPE.BREAKOUT_ROOM) {
					this.addBreakoutRoom(token, conversation as BreakoutRoom)
				}
			})
			store.dispatch('patchConversations', { conversations })
		},

		/**
		 * Purges breakout rooms from both stores.
		 *
		 * @param token the parent room token;
		 */
		purgeBreakoutRoomsStore(token: string) {
			for (const roomToken in this.rooms[token]) {
				store.dispatch('deleteConversation', roomToken)
			}
			Vue.delete(this.rooms, token)
		},

		/**
		 * Adds a breakout room to the store.
		 *
		 * @param token the parent room token;
		 * @param breakoutRoom the breakout room.
		 */
		addBreakoutRoom(token: string, breakoutRoom: BreakoutRoom) {
			if (!this.rooms[token]) {
				Vue.set(this.rooms, token, {})
			}
			Vue.set(this.rooms[token], breakoutRoom.token, breakoutRoom)
		},

		/**
		 * Creates breakout rooms for specified conversation.
		 *
		 * @param payload the action payload;
		 * @param payload.token the parent room token;
		 * @param payload.mode the mode of the breakout rooms;
		 * @param payload.amount the amount of the breakout rooms to create;
		 * @param payload.attendeeMap the stringified JSON object with attendee map.
		 */
		async configureBreakoutRooms({ token, mode, amount, attendeeMap }: Payload<configureBreakoutRoomsParams>) {
			try {
				const response = await configureBreakoutRooms(token, mode, amount, attendeeMap)
				this.processConversations(token, response.data.ocs.data)

				// Get the participants of the breakout rooms
				await this.fetchBreakoutRoomsParticipants(token)

				// Open the sidebar and switch to the breakout rooms tab
				emit('spreed:select-active-sidebar-tab', 'breakout-rooms')
				store.dispatch('showSidebar')
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while creating breakout rooms'))
			}
		},

		/**
		 * Reassign participants to another breakout rooms.
		 *
		 * @param payload the action payload;
		 * @param payload.token the parent room token;
		 * @param payload.attendeeMap the stringified JSON object with attendee map.
		 */
		async reorganizeAttendees({ token, attendeeMap }: Payload<reorganizeAttendeesParams>) {
			try {
				const response = await reorganizeAttendees(token, attendeeMap)
				this.processConversations(token, response.data.ocs.data)

				// Get the participants of the breakout rooms
				await this.fetchBreakoutRoomsParticipants(token)

			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while re-ordering the attendees'))
			}
		},

		/**
		 * Deletes configured breakout rooms for a given parent room token.
		 *
		 * @param token the parent room token.
		 */
		async deleteBreakoutRooms(token: string) {
			try {
				const response = await deleteBreakoutRooms(token)
				// Update returned parent conversation
				this.processConversations(token, response.data.ocs.data)
				// Remove breakout rooms from this store
				this.purgeBreakoutRoomsStore(token)
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while deleting breakout rooms'))
			}
		},

		/**
		 * Get configured breakout rooms for a given parent room token.
		 *
		 * @param token the parent room token.
		 */
		async getBreakoutRooms(token: string) {
			try {
				const response = await getBreakoutRooms(token)
				this.processConversations(token, response.data.ocs.data)
			} catch (error) {
				console.error(error)
			}
		},

		/**
		 * Start a breakout rooms session for a given parent room token.
		 *
		 * @param token the parent room token.
		 */
		async startBreakoutRooms(token: string) {
			try {
				const response = await startBreakoutRooms(token)
				this.processConversations(token, response.data.ocs.data)
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while starting breakout rooms'))
			}
		},

		/**
		 * Stop a breakout rooms session for a given parent room token.
		 *
		 * @param token the parent room token.
		 */
		async stopBreakoutRooms(token: string) {
			try {
				const response = await stopBreakoutRooms(token)
				this.processConversations(token, response.data.ocs.data)
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while stopping breakout rooms'))
			}
		},

		/**
		 * Send a message to all breakout rooms for a given parent room token.
		 *
		 * @param payload the action payload;
		 * @param payload.token the parent room token;
		 * @param payload.message the message text.
		 */
		async broadcastMessageToBreakoutRooms({ token, message }: Payload<broadcastChatMessageParams>) {
			try {
				await broadcastMessageToBreakoutRooms(token, message)
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while sending a message to the breakout rooms'))
			}
		},

		/**
		 * Update a participants in breakout rooms for a given token.
		 *
		 * @param token the parent room token.
		 */
		async fetchBreakoutRoomsParticipants(token: string) {
			try {
				const response = await getBreakoutRoomsParticipants(token)
				const splittedParticipants = response.data.ocs.data.reduce((acc: Record<string, Participant[]>, participant) => {
					if (!acc[participant.roomToken]) {
						acc[participant.roomToken] = []
					}
					acc[participant.roomToken].push(participant)
					return acc
				}, {})

				Object.entries(splittedParticipants).forEach(([token, newParticipants]) => {
					store.dispatch('patchParticipants', { token, newParticipants, hasUserStatuses: false })
				})
			} catch (error) {
				console.error(error)
			}
		},

		/**
		 * Notify moderators when raise a hand in a breakout room with given token.
		 *
		 * @param token the breakout room token.
		 */
		async requestAssistance(token: string) {
			try {
				const response = await requestAssistance(token)
				const parentToken = response.data.ocs.data.objectId
				this.processConversations(parentToken, response.data.ocs.data)
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while requesting assistance'))
			}
		},

		/**
		 * Dismiss a notification about raised hand for a breakout room with given token.
		 *
		 * @param token the breakout room token.
		 */
		async dismissRequestAssistance(token: string) {
			try {
				const response = await resetRequestAssistance(token)
				const parentToken = response.data.ocs.data.objectId
				this.processConversations(parentToken, response.data.ocs.data)
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while resetting the request for assistance'))
			}
		},

		/**
		 * Switch between breakout rooms if participant is allowed to choose the room freely
		 *
		 * @param payload the action payload;
		 * @param payload.token the parent room token;
		 * @param payload.target the breakout room token.
		 */
		async switchToBreakoutRoom({ token, target }: Payload<switchToBreakoutRoomParams>) {
			try {
				const response = await switchToBreakoutRoom(token, target)
				this.processConversations(token, response.data.ocs.data)
			} catch (error) {
				console.error(error)
				showError(t('spreed', 'An error occurred while joining breakout room'))
			}
		},
	}
})
