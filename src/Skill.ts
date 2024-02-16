import { Broadcast } from './Broadcast';
import { Damage } from './Damage';
import { Effect, IEffectDef } from './Effect';
import { PlayerOrNpc } from './GameEntity';
import { IGameState } from './GameState';
import { Logger } from './Logger';
import {
	CooldownError,
	NotEnoughResourcesError,
	PassiveError,
} from './SkillErrors';
import { SkillFlag } from './SkillFlag';
import { SkillType } from './SkillType';

export type ConfigureEffectFn = (effect: Effect, target: PlayerOrNpc) => Effect;

export interface ISkillOptions {
	configureEffect?: ConfigureEffectFn;
	cooldown?: number | ISkillCooldown;
	effect?: string;
	flags?: any[];
	info?: (player: PlayerOrNpc) => void;
	initiatesCombat?: boolean;
	name: string;
	requiresTarget?: boolean;
	resource?: any;
	run: (state: IGameState) => any;
	targetSelf?: boolean;
	type: SkillType;
	options?: any;
}

export interface ISkillCooldown {
	group: string;
	length: number;
}

export interface ISkillResource {
	attribute: string;
	cost: number;
}
/**
 * @property {function (Effect)} configureEffect modify the skill's effect before adding to player
 * @property {null|number}      cooldownLength When a number > 0 apply a cooldown effect to disallow usage
 *                                       until the cooldown has ended
 * @property {string}           effect Id of the passive effect for this skill
 * @property {Array<SkillFlag>} flags
 * @property {function ()}      info Function to run to display extra info about this skill
 * @property {function ()}      run  Function to run when skill is executed/activated
 * @property {GameState}        state
 * @property {SkillType}        type
 */
export class Skill {
	configureEffect: ConfigureEffectFn;
	cooldownGroup: string | null;
	cooldownLength: ISkillCooldown | number | null;
	effect: string | null;
	flags: any[];
	id: string;
	info: Function;
	initiatesCombat: boolean;
	name: string;
	options: Record<string, unknown>;
	requiresTarget: boolean;
	resource: ISkillResource | ISkillResource[];
	run: Function;
	state: IGameState;
	targetSelf: boolean;
	type: SkillType;
	/**
	 * @param {string} id
	 * @param {object} config
	 * @param {GameState} state
	 */
	constructor(id: string, config: ISkillOptions, state: IGameState) {
		const {
			configureEffect = (_: any) => _,
			cooldown = null,
			effect = null,
			flags = [],
			info = (_: any) => {},
			initiatesCombat = false,
			name,
			requiresTarget = true,
			resource = null /* format [{ attribute: 'someattribute', cost: 10}] */,
			run = (_: any) => {},
			targetSelf = false,
			type = SkillType.SKILL,
			options = {},
		} = config;

		this.configureEffect = configureEffect;

		this.cooldownGroup = null;
		if (cooldown && typeof cooldown === 'object') {
			this.cooldownGroup = cooldown.group;
			this.cooldownLength = cooldown.length;
		} else {
			this.cooldownLength = cooldown;
		}

		this.effect = effect;
		this.flags = flags;
		this.id = id;
		this.info = info.bind(this);
		this.initiatesCombat = initiatesCombat;
		this.name = name;
		this.options = options;
		this.requiresTarget = requiresTarget;
		this.resource = resource;
		this.run = run.bind(this);
		this.state = state;
		this.targetSelf = targetSelf;
		this.type = type;
	}

	/**
	 * perform an active skill
	 * @param {string} args
	 * @param {Player} player
	 * @param {Character} target
	 */
	execute(args: string, player: PlayerOrNpc, target: PlayerOrNpc) {
		if (this.flags.includes(SkillFlag.PASSIVE)) {
			throw new PassiveError();
		}

		const cdEffect = this.onCooldown(player);
		if (this.cooldownLength && cdEffect) {
			throw new CooldownError(cdEffect);
		}

		if (this.resource) {
			if (!this.hasEnoughResources(player)) {
				throw new NotEnoughResourcesError();
			}
		}

		if (target !== player && this.initiatesCombat) {
			player.initiateCombat(target);
		}

		// allow skills to not incur the cooldown if they return false in run
		if (this.run(args, player, target) !== false) {
			this.cooldown(player);
			if (this.resource) {
				this.payResourceCosts(player);
			}
		}

		return true;
	}

	/**
	 * @param {Player} player
	 * @return {boolean} If the player has paid the resource cost(s).
	 */
	payResourceCosts(player: PlayerOrNpc) {
		const hasMultipleResourceCosts = Array.isArray(this.resource);
		if (hasMultipleResourceCosts) {
			for (const resourceCost of this.resource as ISkillResource[]) {
				this.payResourceCost(player, resourceCost);
			}
			return true;
		}

		return this.payResourceCost(player, this.resource as ISkillResource);
	}

	// Helper to pay a single resource cost.
	payResourceCost(player: PlayerOrNpc, resource: ISkillResource) {
		// Resource cost is calculated as the player damaging themself so effects
		// could potentially reduce resource costs
		const damage = new Damage(resource.attribute, resource.cost, player, this, {
			hidden: true,
		});

		damage.commit(player);
	}

	activate(player: PlayerOrNpc) {
		if (!this.flags.includes(SkillFlag.PASSIVE)) {
			return;
		}

		if (!this.effect) {
			throw new Error('Passive skill has no attached effect');
		}

		let effect = this.state.EffectFactory.create(this.effect, {
			description: this.info(player),
		});
		effect = this.configureEffect(effect, player);
		effect.skill = this;
		player.addEffect(effect);
		this.run(player);
	}

	/**
	 * @param {Character} character
	 * @return {boolean|Effect} If on cooldown returns the cooldown effect
	 */
	onCooldown(character: PlayerOrNpc) {
		for (const effect of character.effects.entries()) {
			if (
				effect.id === 'cooldown' &&
				effect.state.cooldownId === this.getCooldownId()
			) {
				return effect;
			}
		}

		return false;
	}

	/**
	 * Put this skill on cooldown
	 * @param {number} duration Cooldown duration
	 * @param {Character} character
	 */
	cooldown(character: PlayerOrNpc) {
		if (!this.cooldownLength) {
			return;
		}

		/**
		 * Create cooldown effect.
		 * Setting the type by appending the ID of the skill is needed
		 * so that each skill has its own unique cooldown effect.
		 */
		const effect = this.createCooldownEffect();
		effect.config.type = `cooldown:${this.id}`;
		character.addEffect(this.createCooldownEffect());
	}

	getCooldownId() {
		return this.cooldownGroup
			? 'skillgroup:' + this.cooldownGroup
			: 'skill:' + this.id;
	}

	/**
	 * Create an instance of the cooldown effect for use by cooldown()
	 *
	 * @private
	 * @return {Effect}
	 */
	createCooldownEffect() {
		if (!this.state.EffectFactory.has('cooldown')) {
			this.state.EffectFactory.add(
				'cooldown',
				this.getDefaultCooldownConfig(),
				this.state
			);
		}

		const duration = typeof this.cooldownLength === 'number'
			? this.cooldownLength
			: this.cooldownLength?.length || 0;

		const effect = this.state.EffectFactory.create(
			'cooldown',
			{
				name: `Cooldown (${this.name})`,
				duration: duration * 1000,
			},
			{ cooldownId: this.getCooldownId() }
		);
		effect.skill = this;

		return effect;
	}

	getDefaultCooldownConfig(): IEffectDef {
		return {
			config: {
				name: 'Cooldown',
				description: 'Cannot use ability while on cooldown.',
				unique: false,
				type: 'cooldown',
			},
			state: {
				cooldownId: null,
			},
			listeners: (state: IGameState) => ({
				effectDeactivated: function (this: Effect) {
					if (!this.target) {
						Logger.error('Cooldown effect has no target.');
						return;
					}
					const skillName = typeof this.skill === 'string' ? this.skill : this.skill?.name || 'unnamed skill';
					Broadcast.sayAt(
						this.target as PlayerOrNpc,
						`You may now use <bold>${skillName}</bold> again.`
					);
				},
			}),
		};
	}

	/**
	 * @param {Character} character
	 * @return {boolean}
	 */
	hasEnoughResources(character: PlayerOrNpc) {
		if (Array.isArray(this.resource)) {
			return this.resource.every((resource) =>
				this.hasEnoughResource(character, resource)
			);
		}
		return this.hasEnoughResource(character, this.resource);
	}

	/**
	 * @param {Character} character
	 * @param {{ attribute: string, cost: number}} resource
	 * @return {boolean}
	 */
	hasEnoughResource(character: PlayerOrNpc, resource: ISkillResource) {
		return (
			!resource.cost ||
			(character.hasAttribute(resource.attribute) &&
				character.getAttribute(resource.attribute) >= resource.cost)
		);
	}
}
