import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { Player } from './Player';
import { Quest } from './Quest';

export interface IQuestGoalDef {
	name: string;
	type: string;
	config: IQuestGoalConfig;
	peers: string;
}

export interface ISerializedQuestGoal {
	state: Record<string, unknown>;
	progress: {
		percent: number;
		display: string;
	};
	config: IQuestGoalConfig;
}

export interface IQuestGoalProgress {
	display: string;
	percent: number;
}

export interface IQuestGoalConfig {
	[key: string]: any;
	hidden?: boolean;
	addToQuestLogOnCompletion?: string;
}

export interface IQuestGoalState {
	[key: string]: any;
}

/**
 * Representation of a goal of a quest.
 * The {@link http://ranviermud.com/extending/areas/quests/|Quest guide} has instructions on to
 * create new quest goals for quests
 * @extends EventEmitter
 */
export class QuestGoal<
	TConfig extends IQuestGoalConfig = Record<string, unknown>,
	TState extends IQuestGoalState = Record<string, unknown>
> extends EventEmitter {
	name: string;
	config: TConfig;
	quest: Quest;
	state: TState;
	player: Player;
	peers: string[];
	/**
	 * @param {Quest} quest Quest this goal is for
	 * @param {object} config
	 * @param {Player} player
	 */
	constructor(quest: Quest, config: TConfig, player: Player, name: string) {
		super();
		this.name = name;
		this.config = Object.assign(
			{
				// no defaults currently
			},
			config
		);
		this.quest = quest;
		this.state = {} as TState;
		this.player = player;
		this.peers = [];
	}

	setPeers(peers: string | void) {
		if (peers && peers.length) {
			this.peers = peers.split(',').map(peer => peer.trim());
			Logger.warn('Passed valid peers for quest goal', this.name, this.peers);
		} else {
			Logger.warn('Not passed valid peers for quest goal', this.name);
		}
	}

	getProgress(): IQuestGoalProgress {
		return {
			percent: 0,
			display:
				'[WARNING] Quest does not have progress display configured. Please tell an admin',
		};
	}

	/**
	 * Put any cleanup activities after the quest is finished here
	 */
	complete(): void {
		Logger.warn(`[QuestGoal] Completed goal ${this.name} for player ${this.player.name}`);
		this.quest.findPeers(this).forEach((peer) => {
			if (peer) {
				peer.state.completedAsPeer = true;
				peer.complete();
				Logger.warn('[QuestGoal] Completing peer goal: ', peer.name);
			}
		});
	}

	serialize(): ISerializedQuestGoal {
		return {
			state: this.state as Record<string, unknown>,
			progress: this.getProgress(),
			config: this.config,
		};
	}

	hydrate(state: TState) {
		this.state = state;
	}
}
