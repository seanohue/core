'use strict';

const EventManager = require('./EventManager');

/**
 * Keeps track of all the individual mobs in the game
 */
class MobManager {
  constructor() {
    this.events = new EventManager();
    this.mobs = new Map();
  }

  /**
   * @param {Mob} mob
   */
  addMob(mob) {
    this.events.attach(mob);
    this.mobs.set(mob.uuid, mob);
  }

  addListener(eventName, listener) {
    this.events.add(event, listener);
  }

  /**
   * Completely obliterate a mob from the game, nuclear option
   * @param {Mob} mob
   */
  removeMob(mob) {
    mob.effects.clear();
    const room = mob.room;
    if (room) {
      room.area.removeNpc(mob);
      room.removeNpc(mob, true);
    }
    mob.__pruned = true;
    mob.removeAllListeners();
    this.mobs.delete(mob.uuid);
  }
}

module.exports = MobManager;
