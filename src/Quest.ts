import { EventEmitter } from 'events';
import { EntityReference } from './EntityReference';
import { IGameState } from './GameState';
import { Logger } from './Logger';
import { Player } from './Player';
import { IQuestGoalDef, ISerializedQuestGoal, QuestGoal } from './QuestGoal';
import { IQuestRewardDef } from './QuestReward';

export interface IQuestDef {
	id: string;
	entityReference: EntityReference;
	title: string;
	description: string;
	completionMessage?: string;
	requires?: EntityReference[];
	level: number;
	autoComplete?: boolean;
	repeatable?: boolean;
	rewards: IQuestRewardDef[];
	goals: IQuestGoalDef[];
	started?: number;
	npc?: string;
}

export interface ISerializedQuestDef {
	state: ISerializedQuestGoal[];
	progress: {
		percent: number;
		display: string;
	};
	config: {
		desc: string;
		level: number;
		title: string;
	};
}

/**
 * @property {object} config Default config for this quest, see individual quest types for details
 * @property {Player} player
 * @property {object} state  Current completion state
 * @extends EventEmitter
 */
export class Quest extends EventEmitter {
	id: string;
	entityReference: EntityReference;
	config: IQuestDef;
	player: Player;
	goals: QuestGoal[];
	state: Record<string, any> | ISerializedQuestDef[];
	GameState: IGameState;
	started?: string;

	constructor(
		GameState: IGameState,
		id: string,
		config: IQuestDef,
		player: Player
	) {
		super();

		this.id = id;
		this.entityReference = config.entityReference;
		this.config = Object.assign(
			{
				title: 'Missing Quest Title',
				description: 'Missing Quest Description',
				completionMessage: null,
				requires: [],
				level: 1,
				autoComplete: false,
				repeatable: false,
				rewards: [],
				goals: [],
			},
			config
		);

		this.player = player;
		this.goals = [];
		this.state = [];
		this.GameState = GameState;
	}

	get fullDescription() {
		const description = this.config.description;
		const finishedGoals = this.goals.filter((goal) => goal.getProgress().percent >= 100 && goal.config.addToQuestLogOnCompletion);
		const finishedGoalsTextToAddToQuestLog = finishedGoals.map((goal) => {
			return goal.config.addToQuestLogOnCompletion || '';
		}).join('\n\n');

		if (!finishedGoalsTextToAddToQuestLog.length) {
			return description;
		}

		return description + '\n\n' + finishedGoalsTextToAddToQuestLog;
	}

	get visibleGoals() {
		return this.goals.filter((goal) => !goal.config.hidden);
	}

	/**
	 * Proxy all events to all the goals
	 * @param {string} event
	 * @param {...*}   args
	 */
	emit(event: string | symbol, ...args: any[]) {
		const result = super.emit(event, ...args);

		if (event === 'progress') {
			// don't proxy progress event
			return result;
		}

		// TODO: Consider not proxying all events to hidden goals.
		this.goals.forEach((goal) => {
			goal.emit(event, ...args);
		});

		return result;
	}

	addGoal(goal: QuestGoal) {
		this.goals.push(goal);
		goal.on('progress', () => this.onProgressUpdated());
	}

	/**
	 * @fires Quest#turn-in-ready
	 * @fires Quest#progress
	 */
	onProgressUpdated(): void {
		const progress = this.getProgress();
		Logger.verbose(`[Quest][onProgressUpdated][${this.id}] progress: ${progress.percent}%`);
		if (progress.percent >= 100) {
			// Handle scenario where there are hidden goals to reveal:
			if (this.visibleGoals.length < this.goals.length) {
				const nextHiddenGoal = this.goals.find((goal) => {
					return goal.config.hidden;
				});

				if (!nextHiddenGoal) {
					throw new Error(`Quest ${this.id} has no more hidden goals to reveal!`);
				}

				nextHiddenGoal.config.hidden = false;
				nextHiddenGoal.emit('reveal');

				Logger.verbose(`[Quest][onProgressUpdated] Will reveal next hidden goal: ${nextHiddenGoal.config.title || nextHiddenGoal.config.type || 'Unknown'}`);
				
				// Get progress again and add reveal title:
				const progress = this.getProgress();
				progress.title = 'New Goal!';
				this.emit('progress', progress);
				return;
			}

			// Handle actual quest completion scenarios:
			if (this.config.autoComplete) {
				this.complete();
			} else {
				/**
				 * @event Quest#turn-in-ready
				 */
				this.emit('turn-in-ready');
			}
			return;
		}

		/**
		 * @event Quest#progress
		 * @param {object} progress
		 */
		this.emit('progress', progress);
	}

	/**
	 * @return {{ percent: number, display: string, title?: string }}
	 */
	getProgress() {
		let overallPercent = 0;
		let overallDisplay: string[] = [];

		// Do not show hidden goals in overall progress
		this.visibleGoals.forEach((goal) => {
			const goalProgress = goal.getProgress();
			overallPercent += goalProgress.percent;
			overallDisplay.push(goalProgress.display);
		});

		return {
			percent: Math.round(overallPercent / this.visibleGoals.length),
			display: overallDisplay.join('\r\n'),
			title: 'Goal Progress',
		};
	}

	/**
	 * Save the current state of the quest on player save
	 * @return {object}
	 */
	serialize(): ISerializedQuestDef {
		return {
			state: this.goals.map((goal) => goal.serialize()),
			progress: this.getProgress(),
			config: {
				desc: this.config.description,
				level: this.config.level,
				title: this.config.title,
			},
		};
	}

	hydrate() {
		(this.state as ISerializedQuestGoal[]).forEach((goalState, i: number) => {
			this.goals[i].hydrate(goalState.state);
		});
	}

	/**
	 * @fires Quest#complete
	 */
	complete() {
		/**
		 * @event Quest#complete
		 */
		this.emit('complete');
		for (const goal of this.goals) {
			goal.complete();
		}
	}
}
