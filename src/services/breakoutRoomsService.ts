/**
 * @copyright Copyright (c) 2022 Marco Ambrosini <marcoambrosini@pm.me>
 *
 * @author Marco Ambrosini <marcoambrosini@pm.me>
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
import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'

import type {
	broadcastChatMessageParams,
	broadcastChatMessageResponse,
	configureBreakoutRoomsParams,
	configureBreakoutRoomsResponse,
	deleteBreakoutRoomsResponse,
	getBreakoutRoomsParticipantsResponse,
	getBreakoutRoomsResponse,
	reorganizeAttendeesParams,
	reorganizeAttendeesResponse,
	requestAssistanceResponse,
	resetRequestAssistanceResponse,
	startBreakoutRoomsResponse,
	stopBreakoutRoomsResponse,
	switchToBreakoutRoomParams,
	switchToBreakoutRoomResponse,
} from '../types'

/**
 * Create breakout rooms for a given conversation
 *
 * @param token The conversation token
 * @param mode Either manual, auto, or free // TODO use enums
 * @see CONVERSATION.BREAKOUT_ROOM_MODE
 *
 * @param amount The amount of breakout rooms to be created
 * @param attendeeMap A JSON-encoded map of attendeeId => room number (0 based)
 * (Only considered when the mode is "manual")
 */
const configureBreakoutRooms = async function(token: string, mode: 0 | 1 | 2 | 3, amount: number, attendeeMap?: string): configureBreakoutRoomsResponse {
	return axios.post(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}', { token }), {
		mode,
		amount,
		attendeeMap,
	} as configureBreakoutRoomsParams)
}

/**
 * Apply new attendee map for breakout rooms in given conversation
 *
 * @param token the breakout room token
 * @param attendeeMap A JSON-encoded map of attendeeId => room number (0 based)
 */
const reorganizeAttendees = async function(token: string, attendeeMap: string): reorganizeAttendeesResponse {
	return axios.post(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}/attendees', { token }), {
		attendeeMap,
	} as reorganizeAttendeesParams)
}

/**
 * Deletes all breakout rooms for a given conversation
 *
 * @param token The conversation token
 */
const deleteBreakoutRooms = async function(token: string): deleteBreakoutRoomsResponse {
	return axios.delete(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}', { token }))
}

/**
 * Fetches the breakout rooms for given conversation
 *
 * @param token The conversation token
 */
const getBreakoutRooms = async function(token: string): getBreakoutRoomsResponse {
	return axios.get(generateOcsUrl('/apps/spreed/api/v4/room/{token}/breakout-rooms', { token }))
}

/**
 * @param token The conversation token
 */
const startBreakoutRooms = async function(token: string): startBreakoutRoomsResponse {
	return axios.post(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}/rooms', { token }))
}

/**
 * @param token The conversation token
 */
const stopBreakoutRooms = async function(token: string): stopBreakoutRoomsResponse {
	return axios.delete(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}/rooms', { token }))
}

/**
 * @param token the conversation token
 * @param message The message to be posted
 */
const broadcastMessageToBreakoutRooms = async function(token: string, message: string): broadcastChatMessageResponse {
	return axios.post(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}/broadcast', { token }), {
		message,
	} as broadcastChatMessageParams)
}

/**
 * @param token the conversation token
 */
const getBreakoutRoomsParticipants = async function(token: string): getBreakoutRoomsParticipantsResponse {
	return axios.get(generateOcsUrl('/apps/spreed/api/v4/room/{token}/breakout-rooms/participants', { token }))
}

/**
 * Requests assistance from a moderator
 *
 * @param token the breakout room token
 */
const requestAssistance = async function(token: string): requestAssistanceResponse {
	return axios.post(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}/request-assistance', { token }))
}

/**
 * Resets the request assistance
 *
 * @param token the breakout room token
 */
const resetRequestAssistance = async function(token: string): resetRequestAssistanceResponse {
	return axios.delete(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}/request-assistance', { token }))
}

/**
 * This endpoint allows participants to switch between breakout rooms when they are allowed to choose the breakout room
 * and not are automatically or manually assigned by the moderator.
 *
 * @param token Conversation token of the parent room hosting the breakout rooms
 * @param target Conversation token of the target breakout room
 */
const switchToBreakoutRoom = async function(token: string, target: string): switchToBreakoutRoomResponse {
	return axios.post(generateOcsUrl('/apps/spreed/api/v1/breakout-rooms/{token}/switch', { token }), {
		target,
	} as switchToBreakoutRoomParams)
}

export {
	configureBreakoutRooms,
	reorganizeAttendees,
	deleteBreakoutRooms,
	getBreakoutRooms,
	startBreakoutRooms,
	stopBreakoutRooms,
	broadcastMessageToBreakoutRooms,
	getBreakoutRoomsParticipants,
	requestAssistance,
	resetRequestAssistance,
	switchToBreakoutRoom,
}
