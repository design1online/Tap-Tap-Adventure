var cls = require("../lib/class"),
  Packets = require("./packets"),
  Messages = {},
  Message = cls.Class.extend({});

module.exports = Messages;

Messages.Handshake = Message.extend({
  init(clientId, devClient) {
    this.clientId = clientId;
    this.devClient = devClient;
  },

  serialize() {
    return [Packets.Handshake, [this.clientId, this.devClient]];
  }
});

Messages.Welcome = Message.extend({
  init(data) {
    this.data = data; //array of info
  },

  serialize() {
    return [Packets.Welcome, this.data];
  }
});

Messages.Spawn = Message.extend({
  init(entity) {
    this.entity = entity;
  },

  serialize() {
    return [Packets.Spawn, this.entity.getState()];
  }
});

Messages.List = Message.extend({
  init(list) {
    this.list = list;
  },

  serialize() {
    return [Packets.List, this.list];
  }
});

Messages.Sync = Message.extend({
  init(data) {
    this.data = data;
  },

  serialize() {
    return [Packets.Sync, this.data];
  }
});

Messages.Equipment = Message.extend({
  init(opcode, equipmentData) {
    this.opcode = opcode;
    this.equipmentData = equipmentData;
  },

  serialize() {
    return [Packets.Equipment, this.opcode, this.equipmentData];
  }
});

Messages.Movement = Message.extend({
  init(opcode, data) {
    this.opcode = opcode;
    this.data = data;
  },

  serialize() {
    return [Packets.Movement, [this.opcode, this.data]];
  }
});

Messages.Teleport = Message.extend({
  init(id, x, y, withAnimation) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.withAnimation = withAnimation;
  },

  serialize() {
    return [Packets.Teleport, [this.id, this.x, this.y, this.withAnimation]];
  }
});

Messages.Despawn = Message.extend({
  init(id) {
    this.id = id;
  },

  serialize() {
    return [Packets.Despawn, this.id];
  }
});

Messages.Animation = Message.extend({
  init(id, data) {
    this.id = id;
    this.data = data;
  },

  serialize() {
    return [Packets.Animation, this.id, this.data];
  }
});

Messages.Combat = Message.extend({
  init(opcode, attackerId, targetId, hitData) {
    this.opcode = opcode;
    this.attackerId = attackerId;
    this.targetId = targetId;
    this.hitData = hitData;
  },

  serialize() {
    return [
      Packets.Combat,
      [this.opcode, this.attackerId, this.targetId, this.hitData]
    ];
  }
});

Messages.Projectile = Message.extend({
  init(opcode, data) {
    this.opcode = opcode;
    this.data = data;
  },

  serialize() {
    return [Packets.Projectile, this.opcode, this.data];
  }
});

Messages.Population = Message.extend({
  init(playerCount) {
    this.playerCount = playerCount;
  },

  serialize() {
    return [Packets.Population, this.playerCount];
  }
});

Messages.Points = Message.extend({
  init(id, hitPoints, mana) {
    this.id = id;
    this.hitPoints = hitPoints;
    this.mana = mana;
  },

  serialize() {
    return [Packets.Points, [this.id, this.hitPoints, this.mana]];
  }
});

Messages.Network = Message.extend({
  init(opcode) {
    this.opcode = opcode;
  },

  serialize() {
    return [Packets.Network, this.opcode];
  }
});

Messages.Chat = Message.extend({
  init(data) {
    this.data = data;
  },

  serialize() {
    return [Packets.Chat, this.data];
  }
});

/**
 * Should we just have a packet that represents containers
 * as a whole or just send it separately for each?
 */

Messages.Inventory = Message.extend({
  init(opcode, data) {
    this.opcode = opcode;
    this.data = data;
  },

  serialize() {
    return [Packets.Inventory, this.opcode, this.data];
  }
});

Messages.Bank = Message.extend({
  init(opcode, data) {
    this.opcode = opcode;
    this.data = data;
  },

  serialize() {
    return [Packets.Bank, this.opcode, this.data];
  }
});

Messages.Ability = Message.extend({
  init(opcode, data) {
    this.opcode = opcode;
    this.data = data;
  },

  serialize() {
    return [Packets.Ability, this.opcode, this.data];
  }
});

Messages.Quest = Message.extend({
  init(opcode, data) {
    this.opcode = opcode;
    this.data = data;
  },

  serialize() {
    return [Packets.Quest, this.opcode, this.data];
  }
});

Messages.Notification = Message.extend({
  init(opcode, message) {
    this.opcode = opcode;
    this.message = message;
  },

  serialize() {
    return [Packets.Notification, this.opcode, this.message];
  }
});

Messages.Blink = Message.extend({
  init(instance) {
    this.instance = instance;
  },

  serialize() {
    return [Packets.Blink, this.instance];
  }
});

Messages.Heal = Message.extend({
  init(info) {
    this.info = info;
  },

  serialize() {
    return [Packets.Heal, this.info];
  }
});

Messages.Experience = Message.extend({
  init(info) {
    this.info = info;
  },

  serialize() {
    return [Packets.Experience, this.info];
  }
});

Messages.Death = Message.extend({
  init(id) {
    this.id = id;
  },

  serialize() {
    return [Packets.Death, this.id];
  }
});

Messages.Audio = Message.extend({
  init(song) {
    this.song = song;
  },

  serialize() {
    return [Packets.Audio, this.song];
  }
});

Messages.NPC = Message.extend({
  init(opcode, info) {
    this.opcode = opcode;
    this.info = info;
  },

  serialize() {
    return [Packets.NPC, this.opcode, this.info];
  }
});

Messages.Respawn = Message.extend({
  init(instance, x, y) {
    this.instance = instance;
    this.x = x;
    this.y = y;
  },

  serialize() {
    return [Packets.Respawn, this.instance, this.x, this.y];
  }
});

Messages.Enchant = Message.extend({
  init(opcode, info) {
    this.opcode = opcode;
    this.info = info;
  },

  serialize() {
    return [Packets.Enchant, this.opcode, this.info];
  }
});

Messages.Guild = Message.extend({
  init(opcode, info) {
    this.opcode = opcode;
    this.info = info;
  },

  serialize() {
    return [Packets.Enchant, this.opcode, this.info];
  }
});

Messages.Pointer = Message.extend({
  init(opcode, info) {
    this.opcode = opcode;
    this.info = info;
  },

  serialize() {
    return [Packets.Pointer, this.opcode, this.info];
  }
});

Messages.PVP = Message.extend({
  init(id, pvp) {
    this.id = id;
    this.pvp = pvp;
  },

  serialize() {
    return [Packets.PVP, this.id, this.pvp];
  }
});

Messages.Shop = Message.extend({
  init(opcode, info) {
    this.opcode = opcode;
    this.info = info;
  },

  serialize() {
    return [Packets.Shop, this.opcode, this.info];
  }
});