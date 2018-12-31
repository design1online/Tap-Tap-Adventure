var Character = require("../character"),
  Mobs = require("../../../../util/mobs"),
  _ = require("underscore"),
  Utils = require("../../../../util/utils"),
  Items = require("../../../../util/items");

module.exports = Mob = Character.extend({
  init(id, instance, x, y) {
    var self = this;

    self._super(id, "mob", instance, x, y);

    if (!Mobs.exists(id)) return;

    self.data = Mobs.Ids[self.id];
    self.hitPoints = self.data.hitPoints;
    self.maxHitPoints = self.data.hitPoints;
    self.drops = self.data.drops;

    self.respawnDelay = self.data.spawnDelay;

    self.level = self.data.level;

    self.armourLevel = self.data.armour;
    self.weaponLevel = self.data.weapon;
    self.attackRange = self.data.attackRange;
    self.aggroRange = self.data.aggroRange;
    self.aggressive = self.data.aggressive;

    self.spawnLocation = [x, y];

    self.dead = false;
    self.boss = false;
    self.static = false;

    self.projectileName = self.getProjectileName();
  },

  refresh() {
    var self = this;

    self.hitPoints = self.data.hitPoints;
    self.maxHitPoints = self.data.hitPoints;

    if (self.refreshCallback) self.refreshCallback();
  },

  getDrop() {
    var self = this;

    if (!self.drops) return null;

    var min = 0,
      percent = 0,
      random = Utils.randomInt(0, 1000);

    for (var drop in self.drops)
      if (self.drops.hasOwnProperty(drop)) {
        var chance = self.drops[drop];

        min = percent;
        percent += chance;

        if (random >= min && random < percent) {
          var count = 1;

          if (drop === "gold")
            count = Utils.randomInt(
              1,
              self.level *
                Math.floor(Math.pow(2, self.level / 7) / (self.level / 4))
            );

          return {
            id: Items.stringToId(drop),
            count: count
          };
        }
      }

    return null;
  },

  getProjectileName() {
    return this.data.projectileName
      ? this.data.projectileName
      : "projectile-pinearrow";
  },

  canAggro(player) {
    var self = this;

    if (
      self.hasTarget() ||
      !self.aggressive ||
      Math.floor(self.level * 1.5) < player.level
    )
      return false;

    return self.isNear(player, self.aggroRange);
  },

  destroy() {
    var self = this;

    self.dead = true;
    self.clearTarget();
    self.resetPosition();
    self.respawn();

    if (self.area) self.area.removeEntity(self);
  },

  return() {
    var self = this;

    self.clearTarget();
    self.resetPosition();
    self.move(self.x, self.y);
  },

  isRanged() {
    return this.attackRange > 1;
  },

  distanceToSpawn() {
    return this.getCoordDistance(this.spawnLocation[0], this.spawnLocation[1]);
  },

  isAtSpawn() {
    return this.x === this.spawnLocation[0] && this.y === this.spawnLocation[1];
  },

  isOutsideSpawn() {
    return this.distanceToSpawn() > this.spawnDistance;
  },

  addToChestArea(chestAreas) {
    var self = this,
      area = _.find(chestAreas, function(area) {
        return area.contains(self.x, self.y);
      });

    if (area) area.addEntity(self);
  },

  respawn() {
    var self = this;

    /**
     * Some entities are static (only spawned once during an event)
     * Meanwhile, other entities act as an illusion to another entity,
     * so the resawning script is handled elsewhere.
     */

    if (!self.static || self.respawnDelay === -1) return;

    setTimeout(function() {
      if (self.respawnCallback) self.respawnCallback();
    }, self.respawnDelay);
  },

  getState() {
    var self = this,
      base = self._super();

    base.hitPoints = self.hitPoints;
    base.maxHitPoints = self.maxHitPoints;
    base.attackRange = self.attackRange;
    base.level = self.level;

    return base;
  },

  resetPosition() {
    var self = this;

    self.setPosition(self.spawnLocation[0], self.spawnLocation[1]);
  },

  onRespawn(callback) {
    this.respawnCallback = callback;
  },

  onMove(callback) {
    this.moveCallback = callback;
  },

  onReturn(callback) {
    this.returnCallback = callback;
  },

  onRefresh(callback) {
    this.refreshCallback = callback;
  },

  onDeath(callback) {
    this.deathCallback = callback;
  },

  move(x, y) {
    var self = this;

    self.setPosition(x, y);

    if (self.moveCallback) self.moveCallback(self);
  }
});