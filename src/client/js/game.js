/* global window, document */
import _ from 'underscore';
import $ from 'jquery';
import log from './lib/log';
import Renderer from './renderer/renderer';
import LocalStorage from './utils/storage';
import Map from './map/map';
import Socket from './network/socket';
import Player from './entity/character/player/player';
import Updater from './renderer/updater';
import Entities from './controllers/entities';
import Input from './controllers/input';
import PlayerHandler from './entity/character/player/playerhandler';
import Pathfinder from './utils/pathfinder';
import Zoning from './controllers/zoning';
import Info from './controllers/info';
import Bubble from './controllers/bubble';
import Interface from './controllers/interface';
import Audio from './controllers/audio';
import Pointer from './controllers/pointer';
import Modules from './utils/modules';
import Packets from './network/packets';
import Detect from './utils/detect';
import { requestAnimFrame } from './utils/util';

/**
 * Creates an instance of the game
 * @class
 */
export default class Game {
  /**
   * Keep track of the game logic and the HTML5 canvas
   * @param {App} app an instance of the client application
   */
  constructor(app) {
    log.debug('Game - constructor()', app);

    /**
     * An instance of the client application
     * @type {App}
     */
    this.app = app;

    /**
     * An ID used to identify the player after they've
     * been given a handshake by the Node server
     * @type {Number}
     */
    this.id = -1;

    /**
     * An instance of the web socket used to talk to the node server
     * @type {Socket}
     */
    this.socket = null;

    /**
     * An array of mesages from the web socket
     * @type {Messages}
     */
    this.messages = null;

    /**
     * An instance of the renderer
     * @type {Renderer}
     */
    this.renderer = null;

    /**
     * An instance of the updater
     * @type {Updater}
     */
    this.updater = null;

    /**
     * A reference to the player's LocalStorage
     * @type {Object}
     */
    this.storage = null;

    /**
     * An array of entities in the game
     * @type {Array<Entity>}
     */
    this.entities = null;

    /**
     * Controls all of the game's input
     * @type {Input}
     */
    this.input = null;

    /**
     * An instance of the game's map
     * @type {Map}
     */
    this.map = null;

    /**
     * An instance of the game's player handler
     * @type {PlayerHandler}
     */
    this.playerHandler = null;

    /**
     * Used to find paths of entities
     * @type {Pathfinder}
     */
    this.pathfinder = null;

    /**
     * Used to figure out direction
     * @type {Zoning}
     */
    this.zoning = null;

    /**
     * Used to display additional information
     * on the screen (ie level up and hits and
     * health/exp regeneration)
     * @type {Info}
     */
    this.info = null;

    /**
     * Controls the interface in the game
     * @type {Interface}
     */
    this.interface = null;

    /**
     * Controls the game music and sfx
     * @type {Audio}
     */
    this.audio = null;

    /**
     * An instance of the player
     * @type {Player}
     */
    this.player = null;

    /**
     * Whether or not the game is started
     * @type {Boolean}
     */
    this.started = false;

    /**
     * Whether or not the game is ready
     * @type {Boolean}
     */
    this.ready = false;

    /**
     * Whether or not the map is loaded
     * @type {Boolean}
     */
    this.loaded = false;

    /**
     * Used for rendering fame ticks
     * @type {Date}
     */
    this.time = new Date();

    /**
     * True if there is currently pvp combat
     * @type {Boolean}
     */
    this.pvp = false;

    /**
     * How many players are in the game, defaults to -1
     * @type {Number}
     */
    this.population = -1;

    /**
     * Last time (used for renderer??)
     * @type {Boolean}
     */
    this.lastTime = new Date().getTime();

    /**
     * Returns server/config.json => devClient value
     * @type {Boolean}
     */
    this.development = null;

    /**
     * The pointer shown on the HTML5 canvas
     * @type {Pointer}
     */
    this.pointer = null;

    /**
     * A reference to the chat bubbles controller
     * @type {Bubble}
     */
    this.bubble = null;

    /**
     * A reference to a guild
     * @type {Guild}
     */
    this.guild = null;

    /**
     * A reference to a shop
     * @type {Shops}
     */
    this.bubble = null;

    this.loadRenderer();
    this.loadControllers();
  }

  /**
   * Start the game
   * @return {Boolean} true if the game was successfully started,
   * false if the game is already running
   */
  start() {
    log.debug('Game - start()', this.started);

    if (this.started) {
      return false;
    }

    this.app.fadeMenu();

    this.started = true;
    this.tick();

    return true;
  }

  /**
   * Stop the game, sets started and ready to false
   */
  stop() {
    log.debug('Game - stop()');

    this.started = false;
    this.ready = false;
  }

  /**
   * Calls the renderer to draw to the HTML5 canvas
   * if the game is ready and requests animations if
   * the game is started
   */
  tick() {
    // log.debug('Game - tick()', this.ready, this.updater, this.started);

    if (this.ready) {
      // log.debug('Game - tick() - ready');
      this.time = new Date().getTime();
      this.renderer.render();
      this.updater.update();

      if (this.started) {
        // log.debug('Game - tick() - started', window);
        // console.log('tick', requestAnimFrame(this.tick.bind(this)));
        requestAnimFrame(this.tick.bind(this));
      }
    }
  }

  /**
   * Resets all of the controllers, storage and
   * entities in the game. Stops all audio too.
   * Sets the game to a totally blank state so that
   * it can be initialized like a new game all over again
   * @return {Boolean}
   */
  unload() {
    log.debug('Game - unload()');

    this.socket = null;
    this.messages = null;
    this.renderer = null;
    this.updater = null;
    this.storage = null;
    this.entities = null;
    this.input = null;
    this.map = null;
    this.playerHandler = null;
    this.pathfinder = null;
    this.zoning = null;
    this.info = null;
    this.interface = null;
    this.audio.stop();
    this.audio = null;

    return true;
  }

  /**
   * Load the HTML5 canvas renderer layers for:
   * * background
   * * foreground
   * * text
   * * entities
   * * cursor
   * @return {Boolean}
   */
  loadRenderer() {
    const background = document.getElementById('background');
    const foreground = document.getElementById('foreground');
    const textCanvas = document.getElementById('textCanvas');
    const entities = document.getElementById('entities');
    const cursor = document.getElementById('cursor');

    log.debug('Game - loadRenderer()', background, entities, foreground, textCanvas, cursor);
    this.app.sendStatus('Soul sucking monster...');

    const renderer = new Renderer(background, entities, foreground, textCanvas, cursor, this);

    this.setRenderer(renderer);

    return true;
  }

  /**
   * Load all of the game controllers
   * @return {Boolean}
   */
  loadControllers() {
    log.debug('Game - loadControllers()');

    const hasWorker = this.app.hasWorker();

    this.app.sendStatus(hasWorker ? 'I tried to tell you...' : null);

    if (hasWorker) {
      this.loadMap();
    }

    this.app.sendStatus('Too late now...');
    this.setStorage(new LocalStorage(this.app));
    this.app.sendStatus("You're already doomed...");

    this.setSocket(new Socket(this));
    this.setMessages(this.socket.messages);
    this.setInput(new Input(this));
    this.app.sendStatus("Stop! Before it's too late...");

    const entity = new Entities(this);
    this.setEntityController(entity);

    const info = new Info(this);
    this.setInfo(info);

    const bubble = new Bubble(this);
    this.setBubble(bubble);

    const pointer = new Pointer(this);
    this.setPointer(pointer);

    const audio = new Audio(this);
    this.setAudio(audio);

    const gameInterface = new Interface(this);
    this.setInterface(gameInterface);

    this.implementStorage();

    if (!hasWorker) { // is this for offline mode?
      this.app.sendStatus(null);
      this.loaded = true;
    }

    return true;
  }

  /**
   * Load the game map data
   * @return {Boolean}
   */
  loadMap() {
    log.debug('Game - loadMap()');

    this.map = new Map(this);
    this.map.onReady(() => {
      log.debug('Game - loadMap() - map ready');
      this.mapReadyCallback();
    });
    return true;
  }

  /**
   * Callback for when the map data is done loading
   * @return {Boolean}
   */
  mapReadyCallback() {
    log.debug('Game - mapReadyCallback()');

    this.app.sendStatus('Okay I give up...');
    this.setPathfinder(new Pathfinder(this.map.width, this.map.height));

    this.renderer.setMap(this.map);
    this.renderer.loadCamera();

    this.app.sendStatus("You're beyond help at this point...");
    this.setUpdater(new Updater(this));

    this.entities.load();
    log.debug('Game - mapReadyCallback() - setting entities', this.entities);
    this.renderer.setEntities(this.entities);

    // this.postLoad();

    // clears the status message out now that we've loaded everything
    this.app.sendStatus(null);
    this.ready = true;
    this.loaded = true;
    this.postLoad();
    return true;
  }

  loadedSpritesCallback() {
    log.debug('loaded sprites callback');
  }

  /**
   * Connect to the nodeJS server and setup all the
   * server to client callback messages
   * @return {Boolean}
   */
  connect() {
    log.debug('Game - connect()');

    this.app.cleanErrors();
    setTimeout(() => this.socket.connect(), 1000);

    /**
     * This is for random miscellaneous commands that require
     * a specific action done by the client as opposed to
     * packet-oriented ones.
     */
    this.messages.onCommand(() => {});
    this.messages.onHandshake(data => this.handshakeCallback(data));
    this.messages.onWelcome(data => this.welcomeCallback(data));
    this.messages.onEquipment((opcode, info) => this.equipmentCallback(opcode, info));
    this.messages.onSpawn(data => this.spawnCallback(data));
    this.messages.onEntityList(data => this.entityListCallback(data));
    this.messages.onSync(data => this.syncCallback(data));
    this.messages.onMovement(data => this.movementCallback(data));
    this.messages.onTeleport(data => this.teleportCallback(data));
    this.messages.onDespawn(id => this.despawnCallback(id));
    this.messages.onCombat(data => this.combatCallback(data));
    this.messages.onAnimation((id, info) => this.animationCallback(id, info));
    this.messages.onProjectile((opcode, info) => this.projectileCallback(opcode, info));
    this.messages.onPopulation(population => this.populationCallback(population));
    this.messages.onPoints(data => this.pointsCallback(data));
    this.messages.onNetwork(this.networkCallback);
    this.messages.onChat(info => this.chatCallback(info));
    this.messages.onInventory((opcode, info) => this.inventoryCallback(opcode, info));
    this.messages.onBank((opcode, info) => this.bankCallback(opcode, info));
    this.messages.onAbility(() => {});
    this.messages.onQuest((opcode, info) => this.questCallback(opcode, info));
    this.messages.onNotification((opcode, message) => this.notificationCallback(opcode, message));
    this.messages.onBlink(instance => this.blinkCallback(instance));
    this.messages.onHeal(info => this.healCallback(info));
    this.messages.onExperience(info => this.experienceCallback(info));
    this.messages.onDeath(id => this.deathCallback(id));
    this.messages.onAudio(song => this.audioCallback(song));
    this.messages.onNPC((opcode, info) => this.npcCallback(opcode, info));
    this.messages.onRespawn((id, x, y) => this.respawnCallback(id, x, y));
    this.messages.onEnchant((opcode, info) => this.enchantCallback(opcode, info));
    this.messages.onGuild((opcode, info) => this.guildCallback(opcode, info));
    this.messages.onPointer((opcode, info) => this.pointerCallback(opcode, info));
    this.messages.onPVP((id, pvp) => this.pvpCallback(id, pvp));
    this.messages.onShop((opcode, info) => this.shopCallback(opcode, info));

    return true;
  }

  /**
   * Callback for when the server has acknowledged the client connection
   * then it creates the player object, makes sure the map is loaded,
   * and if the user is registering or logging in it handles player
   * registration or login requests
   * @param  {Messages} data server network message
   * @return {Boolean}
   */
  handshakeCallback(data) {
    log.debug('Game - handshakeCallback()', data);

    this.id = data.shift();
    this.development = data.shift();

    if (!this.player) {
      this.createPlayer();
    }

    if (!this.map) {
      this.loadMap();
    }

    this.app.updateLoader('Logging in...');

    if (this.app.isRegistering()) {
      log.debug('Game - handshakeCallback() - creating an account');

      const registerInfo = this.app.registerFields;
      const username = registerInfo[0].val();
      const password = registerInfo[1].val();
      const email = registerInfo[3].val();

      this.socket.send(Packets.Intro, [
        Packets.IntroOpcode.Register,
        username,
        password,
        email,
      ]);
    } else if (this.app.isGuest()) {
      log.debug('Game - handshakeCallback() - guest logging in');
      this.socket.send(Packets.Intro, [
        Packets.IntroOpcode.Guest,
        'n',
        'n',
        'n',
      ]);
    } else {
      log.debug('Game - handshakeCallback() - player logging in');
      const loginInfo = this.app.loginFields;
      const name = loginInfo[0].val();
      const pass = loginInfo[1].val();

      this.socket.send(Packets.Intro, [
        Packets.IntroOpcode.Login,
        name,
        pass,
        'n',
      ]);

      if (this.hasRemember()) {
        this.storage.data.player.username = name;
        this.storage.data.player.password = pass;
      } else {
        this.storage.data.player.username = '';
        this.storage.data.player.password = '';
      }

      this.storage.save();
    }

    return true;
  }

  /**
   * The callback for when the welcome message for brand new
   * players is done. Loads the player data and sets their
   * starting position then calls this.postLoad()
   * @param  {Object} playerData the data needed to load the player
   * @return {Boolean}
   */
  welcomeCallback(playerData) {
    log.debug('Game - welcomeCallback()', playerData);

    this.player.load(playerData);
    this.input.setPosition(this.player.getX(), this.player.getY());

    // this.start();
    // this.postLoad();

    return true;
  }

  /**
   * Callback for when player equipment is done loading
   * @param  {Number} action the equipment action
   * @param  {Object} info information about the equipment
   * @return {Boolean}
   */
  equipmentCallback(action, info) {
    log.debug('Game - equipmentCallback()', action, info);

    switch (action) {
      case Packets.EquipmentOpcode.Batch:
        for (let i = 0; i < info.length; i += 1) {
          this.player.setEquipment(i, info[i]);
        }
        this.interface.loadProfile();
        break;
      case Packets.EquipmentOpcode.Equip:
        const equipmentType = info.shift(); // eslint-disable-line
        const name = info.shift(); // eslint-disable-line
        const string = info.shift(); // eslint-disable-line
        const count = info.shift(); // eslint-disable-line
        const ability = info.shift(); // eslint-disable-line
        const abilityLevel = info.shift(); // eslint-disable-line

        this.player.setEquipment(equipmentType, [
          name,
          string,
          count,
          ability,
          abilityLevel,
        ]);

        this.interface.profile.update();
        break;
      case Packets.EquipmentOpcode.Unequip:
        const type = info.shift(); // eslint-disable-line
        this.player.unequip(type);
        if (type === 'armour') {
          log.debug('Game - equipmentCallback() unequip armour', this.player.getSpriteName());
          this.player.setSprite(this.getSprite(this.player.getSpriteName()));
        }
        this.interface.profile.update();
        break;
      default:
        break;
    }
  }

  /**
   * Triggered when an entity has finished being spawned
   * @param  {Object} data entity id
   * @return {Boolean}
   */
  spawnCallback(data) {
    log.debug('Game - spawnCallback()', data);
    return this.entities.create(data.shift());
  }

  /**
   * Callback for when the list of entities is done loading
   * and adds the new entities to the screen
   * @param  {Array<Entity>} data array of entities
   * @return {Boolean}
   */
  entityListCallback(data) {
    log.debug('Game - entityListCallback()', data);
    const ids = _.pluck(this.entities.getAll(), 'id');
    const known = _.intersection(ids, data);
    const newIds = _.difference(data, known);

    this.entities.decrepit = _.reject(
      this.entities.getAll(),
      entity => _.include(known, entity.id) || entity.id === this.player.id,
    );

    // this.entities.clean();
    this.entities.load();
    this.socket.send(Packets.Who, newIds);
    return true;
  }

  /**
   * Callback for when server side sync is done.
   * Used to make sure the player's information
   * doesn't differntiate from what the server has
   * for them
   * @param  {Entity<Player>} playerEntity player entity object
   * @return {Boolean} false if this entity is not a player type
   */
  syncCallback(playerEntity) {
    log.debug('Game - syncCallback()', playerEntity);

    const entity = this.entities.get(playerEntity.id);

    if (!entity || entity.type !== 'player') {
      return false;
    }

    if (playerEntity.hitPoints) {
      entity.hitPoints = playerEntity.hitPoints;
      entity.maxHitPoints = playerEntity.maxHitPoints;
    }

    if (playerEntity.mana) {
      entity.mana = playerEntity.mana;
      entity.maxMana = playerEntity.maxMana;
    }

    if (playerEntity.experience) {
      entity.experience = playerEntity.experience;
      entity.level = playerEntity.level;
    }

    if (playerEntity.armour) {
      entity.setSprite(this.getSprite(playerEntity.armour));
    }

    if (playerEntity.weapon) {
      entity.setEquipment(Modules.Equipment.Weapon, playerEntity.weapon);
    }

    this.interface.profile.update();
    return true;
  }

  /**
   * Callback for entity movement
   * @param  {Object<Messages>} data message data
   * @return {Boolean}
   */
  movementCallback(data) {
    log.debug('Game - movementCallback()', data);

    const opcode = data.shift();
    const info = data.shift();

    switch (opcode) {
      default:
        break;
      case Packets.MovementOpcode.Move:
        const id = info.shift(); // eslint-disable-line
        const x = info.shift(); // eslint-disable-line
        const y = info.shift(); // eslint-disable-line
        const forced = info.shift(); // eslint-disable-line
        const teleport = info.shift(); // eslint-disable-line
        const entity = this.entities.get(id); // eslint-disable-line

        if (!entity) {
          return false;
        }

        if (forced) {
          entity.stop(true);
        }

        this.moveCharacter(entity, x, y);
        break;
      case Packets.MovementOpcode.Follow:
        const follower = this.entities.get(info.shift()); // eslint-disable-line
        const followee = this.entities.get(info.shift()); // eslint-disable-line

        if (!followee || !follower) {
          return false;
        }

        follower.follow(followee);
        break;
      case Packets.MovementOpcode.Freeze:
      case Packets.MovementOpcode.Stunned:
        const pEntity = this.entities.get(info.shift()); // eslint-disable-line
        const state = info.shift(); // eslint-disable-line

        if (!pEntity) {
          return false;
        }

        if (state) {
          pEntity.stop(false);
        }

        if (opcode === Packets.MovementOpcode.Stunned) {
          pEntity.stunned = state;
        } else if (opcode === Packets.MovementOpcode.Freeze) {
          pEntity.frozen = state;
        }
        break;
    }

    return true;
  }

  /**
   * Callback for player teleport
   * @param  {Object<Messages>} data information about the teleport
   * @return {Boolean}
   */
  teleportCallback(data) {
    log.debug('Game - teleportCallback()', data);

    const id = data.shift();
    const x = data.shift();
    const y = data.shift();
    const withAnimation = data.shift();
    const isPlayer = id === this.player.id;
    const entity = this.entities.get(id);

    if (!entity) {
      return false;
    }

    entity.stop(true);
    entity.frozen = true;

    /**
     * Teleporting an entity seems to cause a glitch with the
     * hitbox. Make sure you keep an eye out for this.
     * @return {Boolean}
     */
    const doTeleport = () => {
      log.debug('Game - doTeleport()');

      this.entities.unregisterPosition(entity);
      entity.setGridPosition(x, y);

      if (isPlayer) {
        this.entities.clearPlayers(this.player);
        this.player.clearHealthBar();
        this.renderer.camera.centreOn(entity);
        this.renderer.updateAnimatedTiles();
      } else if (entity.type === 'player') {
        delete this.entities.entities[entity.id];
        return false;
      }

      this.socket.send(Packets.Request, [this.player.id]);
      this.entities.registerPosition(entity);

      entity.frozen = false;
      return true;
    };

    if (withAnimation) {
      const originalSprite = entity.sprite;
      entity.teleporting = true;
      entity.setSprite(this.getSprite('death'));

      entity.animate('death', 240, 1, () => {
        doTeleport();
        entity.currentAnimation = null;
        entity.setSprite(originalSprite);
        entity.idle();
        entity.teleporting = false;
      });
    } else {
      doTeleport();
    }

    return true;
  }

  /**
   * Callback for removing a spawned entity
   * @param  {Number} id the id of the entity that needs to be removed
   * @return {Boolean}
   */
  despawnCallback(id) {
    log.debug('Game - despawnCallback()', id);

    const entity = this.entities.get(id);

    if (!entity) {
      return false;
    }

    entity.dead = true;
    entity.stop();

    switch (entity.type) {
      default:
        break;
      case 'item':
        this.entities.removeItem(entity);
        return false;
      case 'chest':
        entity.setSprite(this.getSprite('death'));

        entity.setAnimation('death', 120, 1, () => {
          this.entities.unregisterPosition(entity);
          delete this.entities.entities[entity.id];
        });
        return false;
    }

    if (this.player.hasTarget() && this.player.target.id === entity.id) {
      this.player.removeTarget();
    }

    this.entities.grids.removeFromPathingGrid(entity.gridX, entity.gridY);

    if (entity.id !== this.player.id && this.player.getDistance(entity) < 5) {
      this.audio.play(
        Modules.AudioTypes.SFX,
        `kill${Math.floor(Math.random() * 2 + 1)}`,
      );
    }

    entity.hitPoints = 0;
    entity.setSprite(this.getSprite('death'));

    entity.animate('death', 120, 1, () => {
      this.entities.unregisterPosition(entity);
      delete this.entities.entities[entity.id];
    });

    return true;
  }

  combatCallback(data) {
    log.debug('Game - combatCallback()', data);

    const opcode = data.shift();
    const attacker = this.entities.get(data.shift());
    const target = this.entities.get(data.shift());

    if (!target || !attacker) {
      return;
    }

    switch (opcode) {
      default:
        break;
      case Packets.CombatOpcode.Initiate:
        attacker.setTarget(target);
        target.addAttacker(attacker);

        if (target.id === this.player.id || attacker.id === this.player.id) {
          this.socket.send(Packets.Combat, [
            Packets.CombatOpcode.Initiate,
            attacker.id,
            target.id,
          ]);
        }
        break;
      case Packets.CombatOpcode.Hit:
        const hit = data.shift(); // eslint-disable-line
        const isPlayer = target.id === this.player.id; // eslint-disable-line

        if (!hit.isAoE) {
          attacker.lookAt(target);
          attacker.performAction(
            attacker.orientation,
            Modules.Actions.Attack,
          );
        } else if (hit.hasTerror) {
          target.terror = true;
        }

        switch (hit.type) {
          case Modules.Hits.Critical:
            target.critical = true;
            break;
          default:
            if (attacker.id === this.player.id && hit.damage > 0) {
              this.audio.play(
                Modules.AudioTypes.SFX,
                `hit${Math.floor(Math.random() * 2 + 1)}`,
              );
            }
            break;
        }

        this.info.create(
          hit.type,
          [hit.damage, isPlayer],
          target.x,
          target.y,
        );

        attacker.triggerHealthBar();
        target.triggerHealthBar();

        if (isPlayer && hit.damage > 0) {
          this.audio.play(Modules.AudioTypes.SFX, 'hurt');
        }
        break;
      case Packets.CombatOpcode.Finish:
        if (target) {
          target.removeTarget();
          target.forget();
        }

        if (attacker) {
          attacker.removeTarget();
        }
        break;
    }
  }

  animationCallback(id, info) {
    log.debug('Game - animationCallback()', id, info);

    const entity = this.entities.get(id);
    const animation = info.shift();
    const speed = info.shift();
    const count = info.shift();

    if (!entity) {
      return;
    }

    entity.animate(animation, speed, count);
  }

  projectileCallback(opcode, info) {
    log.debug('Game - projectileCallback()', opcode, info);

    switch (opcode) {
      default:
        break;
      case Packets.ProjectileOpcode.Create:
        this.entities.create(info);
        break;
    }
  }

  populationCallback(population) {
    log.debug('Game - populationCallback()', population);

    this.population = population;
  }

  pointsCallback(data) {
    log.debug('Game - pointsCallback()', data);

    const id = data.shift();
    const hitPoints = data.shift();
    const mana = data.shift();
    const entity = this.entities.get(id);

    if (!entity) {
      return;
    }

    if (hitPoints) {
      entity.setHitPoints(hitPoints);

      if (
        this.player.hasTarget()
        && this.player.target.id === entity.id
        && this.input.overlay.updateCallback
      ) this.input.overlay.updateCallback(entity.id, hitPoints);
    }

    if (mana) {
      entity.setMana(mana);
    }
  }

  networkCallback() {
    log.debug('Game - networkCallback()');

    this.socket.send(Packets.Network, [Packets.NetworkOpcode.Pong]);
  }

  chatCallback(info) {
    log.debug('Game - chatCallback()', info);

    if (!info.duration) {
      info.duration = 5000; // eslint-disable-line
    }

    if (info.withBubble) {
      const entity = this.entities.get(info.id);

      if (entity) {
        this.bubble.create(info.id, info.text, this.time, info.duration);
        this.bubble.setTo(entity);

        this.audio.play(Modules.AudioTypes.SFX, 'npctalk');
      }
    }

    if (info.isGlobal) {
      info.name = `[Global] ${info.name}`; // eslint-disable-line
    }

    this.input.chatHandler.add(info.name, info.text, info.colour);
  }

  inventoryCallback(opcode, info) {
    log.debug('Game - inventoryCallback()', opcode, info);

    switch (opcode) {
      default:
        break;
      case Packets.InventoryOpcode.Batch:
        const inventorySize = info.shift(); // eslint-disable-line
        const data = info.shift(); // eslint-disable-line

        this.interface.loadInventory(inventorySize, data);
        break;
      case Packets.InventoryOpcode.Add:
        if (!this.interface.inventory) {
          return;
        }

        this.interface.inventory.add(info);

        if (!this.interface.bank) {
          return;
        }

        this.interface.bank.addInventory(info);
        break;
      case Packets.InventoryOpcode.Remove:
        if (!this.interface.inventory) {
          return;
        }

        this.interface.inventory.remove(info);

        if (!this.interface.bank) {
          return;
        }

        this.interface.bank.removeInventory(info);
        break;
    }
  }

  bankCallback(opcode, info) {
    log.debug('Game - bankCallback()', opcode, info);

    switch (opcode) {
      default:
        break;
      case Packets.BankOpcode.Batch:
        const bankSize = info.shift(); // eslint-disable-line
        const data = info.shift(); // eslint-disable-line

        this.interface.loadBank(bankSize, data);
        break;

      case Packets.BankOpcode.Add:
        if (!this.interface.bank) {
          return;
        }

        this.interface.bank.add(info);
        break;

      case Packets.BankOpcode.Remove:
        this.interface.bank.remove(info);
        break;
    }
  }

  questCallback(opcode, info) {
    log.debug('Game - questCallback()', opcode, info);

    switch (opcode) {
      default:
        break;
      case Packets.QuestOpcode.Batch:
        // this.interface.getQuestPage().load(info.quests, info.achievements);
        break;

      case Packets.QuestOpcode.Progress:
        // this.interface.getQuestPage().progress(info);
        break;

      case Packets.QuestOpcode.Finish:
        // this.interface.getQuestPage().finish(info);
        break;
    }
  }

  notificationCallback(opcode, message) {
    log.debug('Game - notificationCallback()', opcode, message);

    switch (opcode) {
      default:
        break;
      case Packets.NotificationOpcode.Ok:
        this.interface.displayNotify(message);
        break;

      case Packets.NotificationOpcode.YesNo:
        this.interface.displayConfirm(message);
        break;

      case Packets.NotificationOpcode.Text:
        this.input.chatHandler.add('WORLD', message, 'red');
        break;
    }
  }

  blinkCallback(instance) {
    log.debug('Game - blickCallback()', instance);

    const item = this.entities.get(instance);

    if (!item) {
      return;
    }

    item.blink(150);
  }

  healCallback(info) {
    log.debug('Game - healCallback()', info);

    const entity = this.entities.get(info.id);

    if (!entity) {
      return;
    }

    switch (info.type) {
      default:
        break;
      case 'health':
        this.info.create(
          Modules.Hits.Heal,
          [info.amount],
          entity.x,
          entity.y,
        );

        break;

      case 'mana':
        this.info.create(
          Modules.Hits.Mana,
          [info.amount],
          entity.x,
          entity.y,
        );

        break;
    }

    if (entity.hitPoints + info.amount > entity.maxHitPoints) {
      entity.setHitPoints(entity.maxHitPoints);
    } else {
      entity.setHitPoints(entity.hitPoints + info.amount);
    }

    entity.triggerHealthBar();
  }

  experienceCallback(info) {
    log.debug('Game - experienceCallback()', info);

    const entity = this.entities.get(info.id);

    if (!entity || entity.type !== 'player') {
      return;
    }

    entity.experience = info.experience;

    if (entity.level !== info.level) {
      entity.level = info.level;
      this.info.create(Modules.Hits.LevelUp, null, entity.x, entity.y);
    } else if (entity.id === this.player.id) {
      this.info.create(Modules.Hits.Experience, [info.amount], entity.x, entity.y);
    }

    this.interface.profile.update();
  }

  deathCallback(id) {
    log.debug('Game - deathCallback()', id);

    const entity = this.entities.get(id);

    if (!entity || id !== this.player.id) {
      return;
    }

    this.audio.play(Modules.AudioTypes.SFX, 'death');
    this.player.dead = true;
    this.player.removeTarget();
    this.player.orientation = Modules.Orientation.Down;
    this.app.body.addClass('death');
  }

  audioCallback(song) {
    log.debug('Game - audioCallback()', song);

    this.audio.songName = song;

    if (Detect.isSafari() && !this.audio.song) {
      return;
    }

    this.audio.update();
  }

  npcCallback(opcode, info) {
    log.debug('Game - npcCallback()', opcode, info);

    switch (opcode) {
      default:
        break;
      case Packets.NPCOpcode.Talk:
        let entity = this.entities.get(info.id); // eslint-disable-line
        const messages = info.text; // eslint-disable-line
        const isNPC = !info.nonNPC; // eslint-disable-line

        if (!entity) {
          return;
        }

        if (!messages) {
          entity.talkIndex = 0;
          return;
        }

        let message = isNPC ? entity.talk(messages) : messages; // eslint-disable-line

        if (isNPC) {
          const bubble = this.bubble.create(info.id, message, this.time, 5000);

          this.bubble.setTo(entity);

          if (this.renderer.mobile && this.renderer.autoCentre) {
            this.renderer.camera.centreOn(this.player);
          }

          if (bubble) {
            bubble.setClickable();

            bubble.element.click(() => {
              entity = this.entities.get(bubble.id);

              if (entity) {
                this.input.click({
                  x: entity.gridX,
                  y: entity.gridY,
                });
              }
            });
          }
        } else {
          this.bubble.create(info.id, message, this.time, 5000);
          this.bubble.setTo(entity);
        }

        let sound = 'npc'; // eslint-disable-line

        if (!message && isNPC) {
          sound = 'npc-end';
          this.bubble.destroy(info.id);
        }

        this.audio.play(Modules.AudioTypes.SFX, sound);

        break;

      case Packets.NPCOpcode.Bank:
        this.interface.bank.display();
        break;

      case Packets.NPCOpcode.Enchant:
        this.interface.enchant.display();
        break;

      case Packets.NPCOpcode.Countdown:
        const cEntity = this.entities.get(info.id); // eslint-disable-line
        const countdown = info.countdown; // eslint-disable-line

        if (cEntity) {
          cEntity.setCountdown(countdown);
        }

        break;
    }
  }

  respawnCallback(id, x, y) {
    log.debug('Game - respawnCallback()', id, x, y);

    if (id !== this.player.id) {
      log.error('Player id mismatch.');
      return;
    }

    this.player.setGridPosition(x, y);
    this.entities.addEntity(this.player);
    this.renderer.camera.centreOn(this.player);
    this.player.currentAnimation = null;
    this.player.setSprite(this.getSprite(this.player.getSpriteName()));
    this.player.idle();
    this.player.dead = false;
  }

  enchantCallback(opcode, info) {
    log.debug('Game - enchantCallback()', opcode, info);

    const {
      type,
      index,
    } = info;

    switch (opcode) {
      default:
        break;
      case Packets.EnchantOpcode.Select:
        this.interface.enchant.add(type, index);
        break;
      case Packets.EnchantOpcode.Remove:
        this.interface.enchant.moveBack(type, index);
        break;
    }
  }

  guildCallback(opcode, info) {
    log.debug('Game - guildCallback()', opcode, info);

    switch (opcode) {
      default:
        break;
      case Packets.GuildOpcode.Create:
        break;
      case Packets.GuildOpcode.Join:
        break;
    }

    this.guild = info;
  }

  pointerCallback(opcode, info) {
    log.debug('Game - pointerCallback()', opcode, info);

    switch (opcode) {
      default:
        break;
      case Packets.PointerOpcode.NPC:
        const entity = this.entities.get(info.id); // eslint-disable-line

        if (!entity) {
          return;
        }

        this.pointer.create(entity.id, Modules.Pointers.Entity);
        this.pointer.setToEntity(entity);
        break;

      case Packets.PointerOpcode.Location:
        this.pointer.create(info.id, Modules.Pointers.Position);
        this.pointer.setToPosition(info.id, info.x * 16, info.y * 16);
        break;

      case Packets.PointerOpcode.Relative:
        this.pointer.create(info.id, Modules.Pointers.Relative);
        this.pointer.setRelative(info.id, info.x, info.y);
        break;

      case Packets.PointerOpcode.Remove:
        this.pointer.clean();
        break;
    }
  }

  pvpCallback(id, pvp) {
    log.debug('Game - pvpCallback()', id, pvp);

    if (this.player.id === id) {
      this.pvp = pvp;
    } else {
      const entity = this.entities.get(id);

      if (entity) {
        entity.pvp = pvp;
      }
    }
  }

  shopCallback(opcode, info) {
    log.debug('Game - spawnCallback()', opcode, info);

    switch (opcode) {
      case Packets.ShopOpcode.Open:
        break;
      case Packets.ShopOpcode.Buy:
        break;
      case Packets.ShopOpcode.Sell:
        break;
      case Packets.ShopOpcode.Refresh:
        break;
      default:
        break;
    }

    this.shop = info;
  }

  /**
   * Call this after the player has been welcomed
   * by the server and the client received the connection.
   */
  postLoad() {
    log.debug('Game - postLoad()');

    // @TODO fix this line
    this.renderer.loadStaticSprites();

    this.getCamera().setPlayer(this.player);

    this.renderer.renderedFrame[0] = -1;

    this.entities.addEntity(this.player);
    const defaultSprite = this.getSprite(this.player.getSpriteName());

    this.player.setSprite(defaultSprite);
    this.player.idle();

    this.socket.send(Packets.Ready, [true]);

    this.playerHandler = new PlayerHandler(this, this.player);

    this.renderer.updateAnimatedTiles();

    this.zoning = new Zoning(this);

    this.updater.setSprites(this.entities.sprites);

    this.renderer.verifyCentration();

    if (this.storage.data.new) {
      this.storage.data.new = false;
      this.storage.save();
    }

    if (this.storage.data.welcome !== false) {
      this.app.body.addClass('welcomeMessage');
    }
  }

  implementStorage() {
    log.debug('Game - implementStorage()');

    const loginName = $('#wrapperNameInput');
    const loginPassword = $('#wrapperPasswordInput');

    loginName.prop('readonly', false);
    loginPassword.prop('readonly', false);

    if (!this.hasRemember()) {
      return;
    }

    if (this.getStorageUsername() !== '') {
      loginName.val(this.getStorageUsername());
    }

    if (this.getStoragePassword() !== '') {
      loginPassword.val(this.getStoragePassword());
    }

    $('#rememberMe').addClass('active');
  }

  setPlayerMovement(direction) {
    log.debug('Game - setPlayerMovement()', direction);

    this.player.direction = direction;
  }

  movePlayer(x, y) {
    log.debug('Game - movePlayer()', x, y);

    this.moveCharacter(this.player, x, y);
  }

  moveCharacter(character, x, y) {
    log.debug('Game - moveCharacter()', character, x, y);

    if (!character) {
      return;
    }

    character.go(x, y);
  }

  findPath(character, x, y, ignores) {
    log.debug('Game - findPath()', x, y, ignores);

    const grid = this.entities.grids.pathingGrid;
    let path = [];

    if (this.map.isColliding(x, y) || !this.pathfinder || !character) {
      return path;
    }

    if (ignores) {
      _.each(ignores, (entity) => {
        this.pathfinder.ignoreEntity(entity);
      });
    }

    path = this.pathfinder.find(grid, character, x, y, false);

    if (ignores) {
      this.pathfinder.clearIgnores();
    }

    return path;
  }

  onInput(inputType, data) {
    log.debug('Game - onInput()', inputType, data);

    this.input.handle(inputType, data);
  }

  /**
   * This function is responsible for handling sudden
   * disconnects of a player whilst in the game, not
   * menu-based errors.
   */
  handleDisconnection(noError) {
    log.debug('Game - handleDisconnection()', noError);

    if (!this.started) {
      return;
    }

    this.stop();
    this.renderer.stop();

    this.unload();

    this.app.showMenu();

    if (noError) {
      this.app.sendError(null, 'You have been disconnected from the server');
      this.app.statusMessage = null;
    }

    this.loadRenderer();
    this.loadControllers();

    this.app.toggleLogin(false);
    this.app.updateLoader('');
  }

  respawn() {
    log.debug('Game - respawn()');

    this.audio.play(Modules.AudioTypes.SFX, 'revive');
    this.app.body.removeClass('death');

    this.socket.send(Packets.Respawn, [this.player.id]);
  }

  tradeWith(player) {
    log.debug('Game - tradeWith()', player);

    if (!player || player.id === this.player.id) {
      return;
    }

    this.socket.send(Packets.Trade, [Packets.TradeOpcode.Request, player.id]);
  }

  resize() {
    log.debug('Game - resize()');

    this.renderer.resize();

    if (this.pointer) {
      this.pointer.resize();
    }
  }

  createPlayer() {
    log.debug('Game - createPlayer()');

    this.player = new Player();
  }

  getScaleFactor() {
    return this.app.getScaleFactor();
  }

  getStorage() {
    log.debug('Game - getStorage()');

    return this.storage;
  }

  getCamera() {
    log.debug('Game - getCamera()');

    return this.renderer.camera;
  }

  getSprite(spriteName) {
    log.debug('Game - getSprite()', spriteName);

    return this.entities.getSprite(spriteName);
  }

  getEntityAt(x, y, ignoreSelf) {
    log.debug('Game - getEntityAt()', x, y, ignoreSelf);

    const entities = this.entities.grids.renderingGrid[y][x];

    if (_.size(entities) > 0) {
      return entities[_.keys(entities)[ignoreSelf ? 1 : 0]];
    }

    const items = this.entities.grids.itemGrid[y][x];

    if (_.size(items) > 0) {
      _.each(items, (item) => {
        if (item.stackable) {
          return item;
        }
        return null;
      });

      return items[_.keys(items)[0]];
    }

    return null;
  }

  getStorageUsername() {
    log.debug('Game - getStorageUsername()');

    return this.storage.data.player.username;
  }

  getStoragePassword() {
    log.debug('Game - getStoragePassword()');

    return this.storage.data.player.password;
  }

  hasRemember() {
    log.debug('Game - hasRemember()');

    return this.storage.data.player.rememberMe;
  }

  setRenderer(renderer) {
    log.debug('Game - setRenderer()', renderer);

    if (this.renderer === null) {
      this.renderer = renderer;
    }
  }

  setStorage(storage) {
    log.debug('Game - setStorage()', storage);

    if (!this.storage) {
      this.storage = storage;
    }
  }

  setSocket(socket) {
    log.debug('Game - setSocket()', socket);

    if (!this.socket) {
      this.socket = socket;
    }
  }

  setMessages(messages) {
    log.debug('Game - setMessages()', messages);

    if (!this.messages) {
      this.messages = messages;
    }
  }

  setUpdater(updater) {
    log.debug('Game - setUpdater()', updater);

    if (!this.updater) {
      this.updater = updater;
    }
  }

  setEntityController(entities) {
    log.debug('Game - setEntityController()', entities, this.entities);

    if (!this.entities) {
      this.entities = entities;
    }
  }

  setInput(input) {
    log.debug('Game - setInput()', input);

    if (!this.input) {
      this.input = input;
      this.renderer.setInput(this.input);
    }
  }

  setPathfinder(pathfinder) {
    log.debug('Game - setPathfinder()', pathfinder);

    if (!this.pathfinder) {
      this.pathfinder = pathfinder;
    }
  }

  setInfo(info) {
    log.debug('Game - setInfo()', info);

    if (!this.info) {
      this.info = info;
    }
  }

  setBubble(bubble) {
    log.debug('Game - setBubble()', bubble);

    if (!this.bubble) {
      this.bubble = bubble;
    }
  }

  setPointer(pointer) {
    log.debug('Game - setPointer()', pointer);

    if (!this.pointer) {
      this.pointer = pointer;
    }
  }

  setInterface(intrface) {
    log.debug('Game - setInterface()', intrface);

    if (!this.interface) {
      this.interface = intrface;
    }
  }

  setAudio(audio) {
    log.debug('Game - setAudio()', audio);

    if (!this.audio) {
      this.audio = audio;
    }
  }
}
