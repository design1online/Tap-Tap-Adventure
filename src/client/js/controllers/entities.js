import _ from 'underscore';
import Grids from '../renderer/grids';
import Chest from '../entity/objects/chest';
import Player from '../entity/character/player/player';
import Item from '../entity/objects/item';
import Sprites from './sprites';
import Mob from '../entity/character/mob/mob';
import NPC from '../entity/character/npc/npc';
import Projectile from '../entity/objects/projectile';
import Modules from '../utils/modules';
import Packets from '../network/packets';
import log from '../lib/log';

/**
 * Entities in the game:
 * * {@link Character} - parent class for:
 *   * {@link Mob} - game controlled npc or monster that can move around the map
 *   * {@link Npc} - game controlled entity that always stays in one location
 *   * {@link Player} - a user in the game
 * * {@link Chest} - open to reveal an item
 * * {@link Item} - weapons, health, magic, armor
 * * {@link Projectile} - entities that can be thrown (magic, weapons, arrows, mob attacks)
 * @class
 */
export default class Entities {
  /**
  * Default constructor
  * @param {Game} instance of the game
  */
  constructor(game) {
    log.debug('Entities - constructor()');

    /**
    * The instance of the game
    * @type {Game}
    */
    this.game = game;

    /**
    * An instance of the game renderer
    * @type {Renderer}
    */
    this.renderer = game.renderer;

    /**
    * An array of game grid maps
    * @type {Grids}
    */
    this.grids = null;

    /**
    * An array of sprites
    * @type {Sprites}
    */
    this.sprites = null;

    /**
    * An array of an entity type instances
    * @type {Chest|NPC|Item|Mob|Projectile|Player}
    */
    this.entities = {};

    /**
    * Keeps track of entities that need to be cleaned up
    * @type {Chest|NPC|Item|Mob|Projectile|Player}
    */
    this.decrepit = {};
  }

  /**
  * Load the entities in the game for the current game map
  * @return null
  */
  load() {
    log.debug('Entities - load()', this.game.renderer);
    this.game.app.sendStatus('Lots of monsters ahead...');

    if (!this.sprites) {
      log.debug('Entities - load() - no sprites loaded yet', this.game.renderer);
      this.sprites = new Sprites(this.game.renderer);

      this.sprites.onLoadedSprites(() => {
        log.debug('Entities - load() - sprites done loading, loading cursors');
        // this.game.postLoad();
        this.game.input.loadCursors();

        this.game.postLoad();
        this.game.start();
      });
    }

    this.game.app.sendStatus('Yes, you are also a monster...');

    if (!this.grids) {
      log.debug('Entities - load() - no grids loaded yet');
      this.grids = new Grids(this.game.map);
    }
  }

  /**
  * Update the sprites
  * @return null
  */
  update() {
    log.debug('Entities - update()');

    if (this.sprites) {
      this.sprites.updateSprites();
    }
  }

  /**
  * Create a new entity
  * @param {{id:Number, type:'chest'|'npc'|'item'|'mob'|'projectile'|'player'}}
  * info information about the entity we need to create
  * @return null
  */
  create(info) {
    log.debug('Entities - create()', info);

    let entity;

    if (this.isPlayer(info.id)) {
      return;
    }

    switch (info.type) {
      default:
        break;
      case 'chest':
        /**
         * Here we will parse the different types of chests..
         * We can go Dark Souls style and implement mimics
         * the proper way -ahem- TTA V1.0
         */

        const chest = new Chest(info.id, info.name); // eslint-disable-line
        entity = chest;
        break;

      case 'npc':
        const npc = new NPC(info.id, info.name); // eslint-disable-line
        entity = npc;
        break;

      case 'item':
        const item = new Item( // eslint-disable-line
          info.id,
          info.name,
          info.count,
          info.ability,
          info.abilityLevel,
        );
        entity = item;
        break;

      case 'mob':
        const mob = new Mob(info.id, info.name); // eslint-disable-line

        mob.setHitPoints(info.hitPoints);
        mob.setMaxHitPoints(info.maxHitPoints);

        mob.attackRange = info.attackRange;
        mob.level = info.level;

        entity = mob;

        break;

      case 'projectile':
        const attacker = this.get(info.characterId); // eslint-disable-line
        const target = this.get(info.targetId); // eslint-disable-line

        if (!attacker || !target) {
          return;
        }

        attacker.lookAt(target);

        const projectile = new Projectile( // eslint-disable-line
          info.id,
          info.projectileType,
          attacker,
        );

        projectile.name = info.name;

        projectile.setStart(attacker.x, attacker.y);
        projectile.setTarget(target);

        projectile.setSprite(this.getSprite(projectile.name));
        projectile.setAnimation('travel', projectile.getSpeed());

        projectile.angled = true;
        projectile.type = info.type;

        /**
         * Move this into the external overall function
         */

        projectile.onImpact(() => {
          /**
           * The data in the projectile is only for rendering purposes
           * there is nothing you can change for the actual damage output here.
           */

          if (this.isPlayer(projectile.owner.id) || this.isPlayer(target.id)) {
            this.game.socket.send(Packets.Projectile, [
              Packets.ProjectileOpcode.Impact,
              info.id,
              target.id,
            ]);
          }

          if (info.hitType === Modules.Hits.Explosive) {
            target.explosion = true;
          }

          this.game.info.create(
            Modules.Hits.Damage,
            [info.damage, this.isPlayer(target.id)],
            target.x,
            target.y,
          );

          target.triggerHealthBar();

          this.unregisterPosition(projectile);
          delete this.entities[projectile.getId()];
        });

        this.addEntity(projectile);

        attacker.performAction(attacker.orientation, Modules.Actions.Attack);
        attacker.triggerHealthBar();
        return;

      case 'player':
        const player = new Player(); // eslint-disable-line
        log.debug('Entities - loading player entity data', info);

        player.setId(info.id);
        player.setName(info.name);
        player.setGridPosition(info.x, info.y);

        player.rights = info.rights;
        player.level = info.level;
        player.pvp = info.pvp;
        player.pvpKills = info.pvpKills;
        player.pvpDeaths = info.pvpDeaths;
        player.type = info.type;

        const hitPointsData = info.hitPoints; // eslint-disable-line
        const manaData = info.mana; // eslint-disable-line

        player.setHitPoints(hitPointsData[0]);
        player.setMaxHitPoints(hitPointsData[1]);

        player.setMana(manaData[0]);
        player.setMaxMana(manaData[1]);

        player.setSprite(this.getSprite(info.armour[1]));
        player.idle();

        player.setEquipment(Modules.Equipment.Armour, info.armour);
        player.setEquipment(Modules.Equipment.Weapon, info.weapon);
        player.setEquipment(Modules.Equipment.Pendant, info.pendant);
        player.setEquipment(Modules.Equipment.Ring, info.ring);
        player.setEquipment(Modules.Equipment.Boots, info.boots);

        player.loadHandler(this.game);

        this.addEntity(player);
        return;
    }

    // if we didn't load an entity for any reason quit trying while we're ahead
    if (!entity) {
      return;
    }

    entity.setGridPosition(info.x, info.y);
    entity.setName(info.name);

    entity.setSprite(
      this.getSprite(
        info.type === 'item'
          ? `item-${info.name}`
          : info.name,
      ),
    );

    entity.idle();
    entity.type = info.type;

    this.addEntity(entity);

    if (info.type !== 'item' && entity.handler) {
      entity.handler.setGame(this.game);
      entity.handler.load();
    }
  }

  /**
  * Checks whether or not this entity ID is a player
  * @param {Number} id the id of the entity
  * @return {Boolean}
  */
  isPlayer(id) {
    log.debug('Entities - isPlayer()', id);
    return this.game.player.id === id;
  }

  /**
  * Returns the entity object based off the ID if it exists, otherwise returns null
  * @param {Number} id the id of the entity
  * @return {Chest|NPC|Item|Mob|Projectile|Player|null}
  */
  get(id) {
    log.debug('Entities - get()', id);

    if (id in this.entities) {
      return this.entities[id];
    }

    return null;
  }

  /**
  * Check to see if an entity with this ID exists or not
  * @param {Number} id the id of the entity
  * @return {Boolean} true if it exists, otherwise false
  */
  exists(id) {
    log.debug('Entities - exists()', id);
    return id in this.entities;
  }

  /**
  * Removes players from the game map, will only work for entities of type player
  * @param {{id:Number, type:String}} exception entitys (players) to keep on the game map
  * @return null
  */
  clearPlayers(exception) {
    log.debug('Entities - clearPlayers()', exception);
    _.each(this.entities, (entity) => {
      if (entity.id !== exception.id && entity.type === 'player') {
        this.grids.removeFromRenderingGrid(
          entity,
          entity.gridX,
          entity.gridY,
        );

        this.grids.removeFromPathingGrid(entity.gridX, entity.gridY);

        delete this.entities[entity.id];
      }
    });

    this.grids.resetPathingGrid();
  }

  /**
  * Add a new entity to the map grid
  * @param {Chest|NPC|Item|Mob|Projectile|Player} entity the entity to add to the game
  * @return null
  */
  addEntity(entity) {
    log.debug('Entities - addEntity()', entity);

    if (this.entities[entity.id]) {
      return;
    }

    this.entities[entity.id] = entity;
    this.registerPosition(entity);

    if (
      !(entity instanceof Item && entity.dropped)
      && !this.renderer.isPortableDevice()
    ) {
      entity.fadeIn(this.game.time);
    }
  }

  /**
  * Remove an item from the game
  * @param {{Chest|NPC|Item|Mob|Projectile}} item the item to remove from the map grid
  * @return null
  */
  removeItem(item) {
    log.debug('Entities - removeItem()');

    if (!item) {
      return;
    }

    this.grids.removeFromItemGrid(item, item.gridX, item.gridY);
    this.grids.removeFromRenderingGrid(item, item.gridX, item.gridY);

    delete this.entities[item.id];
  }

  /**
  * Figure out which part of the grid to add an entity to
  * @param {Chest|NPC|Item|Mob|Player} entity an entity in the game
  * @return null
  */
  registerPosition(entity) {
    log.debug('Entities - registerPosition()', entity);

    if (!entity) {
      return;
    }

    if (
      entity.type === 'player'
      || entity.type === 'mob'
      || entity.type === 'npc'
      || entity.type === 'chest'
    ) {
      this.grids.addToEntityGrid(entity, entity.gridX, entity.gridY);

      if (entity.type !== 'player' || entity.nonPathable) {
        this.grids.addToPathingGrid(entity.gridX, entity.gridY);
      }
    }

    if (entity.type === 'item') {
      this.grids.addToItemGrid(entity, entity.gridX, entity.gridY);
    }

    this.grids.addToRenderingGrid(entity, entity.gridX, entity.gridY);
  }

  /**
  * Register this entity on the grid twice
  * @param {Chest|NPC|Item|Mob|Projectile|Player} entity the entity to add to the game map again
  * @return null
  */
  registerDuality(entity) {
    log.debug('Entities - registerDuality()', entity);

    if (!entity) {
      return;
    }

    this.grids.entityGrid[entity.gridY][entity.gridX][entity.id] = entity;

    this.grids.addToRenderingGrid(entity, entity.gridX, entity.gridY);

    if (entity.nextGridX > -1 && entity.nextGridY > -1) {
      this.grids.entityGrid[entity.nextGridY][entity.nextGridX][
        entity.id
      ] = entity;

      if (!(entity instanceof Player)) {
        this.grids.pathingGrid[entity.nextGridY][entity.nextGridX] = 1;
      }
    }
  }

  /**
  * Remove this entity from the game map
  * @param {Chest|NPC|Item|Mob|Projectile|Player} entity the entity to remove from the grid
  * @return null
  */
  unregisterPosition(entity) {
    log.debug('Entities - unregisterPosition()', entity);

    if (!entity) {
      return;
    }

    this.grids.removeEntity(entity);
  }

  /**
  * Return all the sprites with the given name
  * @param {String} name the name of the sprite
  * @return {Chest|NPC|Item|Mob|Projectile|Player}
  */
  getSprite(name) {
    log.debug('Entities - getSprite()', name);
    return this.sprites.sprites[name];
  }

  /**
  * Return all entities
  */
  getAll() {
    log.debug('Entities - getAll()');
    return this.entities;
  }

  /**
  * Apply a callback for every entity in the array
  * @param {Function} callback the function to apply, the entity is passed into it
  * @return null
  */
  forEachEntity(callback) {
    // log.debug('Entities - forEachEntity()', callback);
    _.each(this.entities, (entity) => {
      callback(entity);
    });
  }

  /**
  * Apply a callback for every entity in the radius of an area on the map grid
  * as long as the radius is not out of bounds in the grid
  * @param {Number} x the x coordinate center of the circle radius
  * @param {Number} y the y coordinate center of the circle radius
  * @param {Number} radius the the distance to spread out from the center of the circle point
  * @param {Function} callback the function to apply, the entity is passed into it
  * @return null
  */
  forEachEntityAround(x, y, radius, callback) {
    log.debug('Entities - forEachEntityAround()', x, y, radius, callback);

    for (let i = x - radius, maxI = x + radius; i <= maxI; i += 1) {
      for (let j = y - radius, maxJ = y + radius; j <= maxJ; j += 1) {
        if (!this.map.isOutOfBounds(i, j)) {
          _.each(this.grids.renderingGrid[j][i], (entity) => {
            callback(entity);
          });
        }
      }
    }
  }
}
