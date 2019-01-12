'use strict';

const uuid = require('uuid/v4');
const Attributes = require('./Attributes');
const Character = require('./Character');
const Config = require('./Config');
const Logger = require('./Logger');
const Scriptable = require('./Scriptable');

/**
 * @property {number} id   Area-relative id (vnum)
 * @property {Area}   area Area npc belongs to (not necessarily the area they're currently in)
 * @property {Map} behaviors
 * @extends Character
 * @mixes Scriptable
 */
class Npc extends Scriptable(Character) {
  constructor(area, data) {
    super(data);
    const validate = ['keywords', 'name', 'id'];

    for (const prop of validate) {
      if (!(prop in data)) {
        throw new ReferenceError(`NPC in area [${area.name}] missing required property [${prop}]`);
      }
    }

    this.area = data.area;
    this.script = data.script;
    this.behaviors = new Map(Object.entries(data.behaviors || {}));
    // FIXME: What is this? Why is it here?
    this.damage = data.damage;
    this.defaultEquipment = data.equipment || [];
    this.defaultItems = data.items || [];
    this.description = data.description;
    this.entityReference = data.entityReference; 
    this.id = data.id;
    this.keywords = data.keywords;
    this.quests = data.quests || [];
    this.uuid = data.uuid || uuid();
  }

  /**
   * Move the npc to the given room, emitting events appropriately
   * @param {Room} nextRoom
   * @param {function} onMoved Function to run after the npc is moved to the next room but before enter events are fired
   */
  moveTo(nextRoom, onMoved = _ => _) {
    if (this.room) {
      this.room.emit('npcLeave', this, nextRoom);
      this.room.removeNpc(this);
    }

    this.room = nextRoom;
    nextRoom.addNpc(this);

    onMoved();

    nextRoom.emit('npcEnter', this);
    this.emit('enterRoom', nextRoom);
  }

  /**
   * FIXME: Why does the core have a damage stat for Npc, what the heck is it doing in here?
   */
  serialize() {
    return Object.assign(super.serialize(), { damage: this.damage });
  }

  getDamage() {
    const range = this.damage.split('-');
    return { min: range[0], max: range[1] };
  }

  hydrate(state) {
    super.hydrate(state);
    state.MobManager.addMob(this);

    this.setupBehaviors(state.MobBehaviorManager);

    this.defaultItems.forEach(defaultItemId => {
      if (parseInt(defaultItemId, 10)) {
        defaultItemId = this.area.name + ':' + defaultItemId;
      }

      Logger.verbose(`\tDIST: Adding item [${defaultItemId}] to npc [${this.name}]`);
      const newItem = state.ItemFactory.create(this.area, defaultItemId);
      newItem.hydrate(state);
      state.ItemManager.add(newItem);
      this.addItem(newItem);
    });
  }

  get isNpc() {
    return true;
  }
}

module.exports = Npc;
