<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2020 Joas Schilling <coding@schilljs.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

namespace OCA\Talk\Listener;

use OCA\Talk\Exceptions\ParticipantNotFoundException;
use OCA\Talk\Manager;
use OCA\Talk\Model\Attendee;
use OCA\Talk\Participant;
use OCA\Talk\Room;
use OCA\Talk\Service\ParticipantService;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Group\Events\UserAddedEvent;
use OCP\Group\Events\UserRemovedEvent;
use OCP\IGroup;
use OCP\IGroupManager;
use OCP\IUser;

class GroupMembershipListener implements IEventListener {

	/** @var IGroupManager */
	private $groupManager;
	/** @var Manager */
	private $manager;
	/** @var ParticipantService */
	private $participantService;

	public function __construct(IGroupManager $groupManager,
								Manager $manager,
								ParticipantService $participantService) {
		$this->groupManager = $groupManager;
		$this->manager = $manager;
		$this->participantService = $participantService;
	}

	public function handle(Event $event): void {
		if ($event instanceof UserAddedEvent) {
			$this->addNewMemberToRooms($event->getGroup(), $event->getUser());
		}
		if ($event instanceof UserRemovedEvent) {
			$this->removeFormerMemberFromRooms($event->getGroup(), $event->getUser());
		}
	}

	protected function addNewMemberToRooms(IGroup $group, IUser $user): void {
		$rooms = $this->manager->getRoomsForActor(Attendee::ACTOR_GROUPS, $group->getGID());

		foreach ($rooms as $room) {
			try {
				$participant = $room->getParticipant($user->getUID());
				if ($participant->getAttendee()->getParticipantType() === Participant::USER_SELF_JOINED) {
					$this->participantService->updateParticipantType($room, $participant, Participant::USER);
				}
			} catch (ParticipantNotFoundException $e) {
				$this->participantService->addUsers($room, [[
					'actorType' => Attendee::ACTOR_USERS,
					'actorId' => $user->getUID(),
				]]);
			}
		}
	}

	protected function removeFormerMemberFromRooms(IGroup $group, IUser $user): void {
		$rooms = $this->manager->getRoomsForActor(Attendee::ACTOR_GROUPS, $group->getGID());
		if (empty($rooms)) {
			return;
		}

		$userGroupIds = $this->groupManager->getUserGroupIds($user);

		$furtherMemberships = [];
		foreach ($userGroupIds as $groupId) {
			$groupRooms = $this->manager->getRoomsForActor(Attendee::ACTOR_GROUPS, $groupId);
			foreach ($groupRooms as $room) {
				$furtherMemberships[$room->getId()] = true;
			}
		}

		$rooms = array_filter($rooms, static function (Room $room) use ($furtherMemberships) {
			// Only delete from rooms where the user is not member via another group
			return !isset($furtherMemberships[$room->getId()]);
		});

		foreach ($rooms as $room) {
			$this->participantService->removeUser($room, $user, Room::PARTICIPANT_REMOVED);
		}
	}
}
