import Animation from '../entity/animation';
import Chat from './chat';
import Overlay from './overlay';
import log from '../lib/log';
import Modules from '../utils/modules';
import Packets from '../network/packets';
import Detect from '../utils/detect';

/**
 * Handles game mouse and keyboard input
 * @class
 */
export default class Input {
  /**
   * Default constructor
   * @param {Game} game instance of the game
   */
  constructor(game) {
    /**
    * An instance of the game
    * @type {Game}
    */
    this.game = game;

    /**
    * An instance of the game app
    * @type {App}
    */
    this.app = game.app;

    /**
    * An instance of the game renderer
    * @type {Renderer}
    */
    this.renderer = game.renderer;

    /**
    * Whether or not the selected cell is visible
    * @type {Boolean}
    */
    this.selectedCellVisible = false;

    /**
    * The previous mouse click envent
    * @type {MouseEvent}
    */
    this.previousClick = {};

    /**
    * Whether or not the cursor is visible
    * @type {Boolean}
    */
    this.cursorVisible = true;

    /**
    * Whether or not the target is visible
    * @type {Boolean}
    */
    this.targetVisible = true;

    /**
    * The select x position
    * @type {Number}
    */
    this.selectedX = -1;

    /**
    * The select y position
    * @type {Number}
    */
    this.selectedY = -1;

    /**
    * The cursor
    * @type {Cursor}
    */
    this.cursor = null;

    /**
    * A new instance of the cursor (for changing cursors)
    * @type {Cursor}
    */
    this.newCursor = null;

    /**
    * Data on the targeted entity
    * @type {Entity}
    */
    this.targetData = null;

    /**
    * The color of the target
    * @type {String}
    */
    this.targetColour = null;

    /**
    * The new target color
    * @type {String}
    */
    this.newTargetColour = null;

    /**
    * A moving target's color
    * @type {String}
    */
    this.mobileTargetColour = 'rgba(51, 255, 0)';

    /**
    * The previous key pressed
    * @type {KeyboardEvent}
    */
    this.previousKey = {};

    /**
    * All loaded cursors
    * @type {Object<Cursor>}
    */
    this.cursors = {};

    /**
    * The entity being hovered over
    * @type {Entity}
    */
    this.hovering = null;

    /**
    * Information about the mouse position
    * @type {{x: Number, y:Number}}
    */
    this.mouse = {
      x: 0,
      y: 0,
    };

    this.load();
  }

  /**
   * Load spinner sprite, chat handler and overlay
   */
  load() {
    /**
     * This is the animation for the target
     * cell spinner sprite (only on desktop)
     */
    this.targetAnimation = new Animation('move', 4, 0, 16, 16);
    this.targetAnimation.setSpeed(50);
    this.chatHandler = new Chat(this.game);
    this.overlay = new Overlay(this);
  }

  /**
   * Load cursors
   */
  loadCursors() {
    log.debug('Input - loadCursors()');

    this.cursors.hand = this.game.getSprite('hand');
    this.cursors.sword = this.game.getSprite('sword');
    this.cursors.loot = this.game.getSprite('loot');
    this.cursors.target = this.game.getSprite('target');
    this.cursors.arrow = this.game.getSprite('arrow');
    this.cursors.talk = this.game.getSprite('talk');
    this.cursors.spell = this.game.getSprite('spell');
    this.cursors.bow = this.game.getSprite('bow');

    this.newCursor = this.cursors.hand;
    this.newTargetColour = 'rgba(255, 255, 255, 0.5)';
  }

  /**
   * Handle input
   * @param  {Modules} inputType the Modules.InputType to handle
   * @param  {Object} data      data related to the input (keycode, coordinates, etc)
   */
  handle(inputType, data) {
    switch (inputType) {
      default:
        break;

      // WASD and arrow key press movement
      case Modules.InputType.Key:
        if (this.chatHandler.isActive()) {
          this.chatHandler.key(data);
          return;
        }

        switch (data) {
          default:
            break;
          case Modules.Keys.Up:
          case Modules.Keys.W:
            this.getPlayer().moveUp = true;
            break;
          case Modules.Keys.A:
          case Modules.Keys.Left:
            this.getPlayer().moveLeft = true;
            break;
          case Modules.Keys.S:
          case Modules.Keys.Down:
            this.getPlayer().moveDown = true;
            break;
          case Modules.Keys.D:
          case Modules.Keys.Right:
            this.getPlayer().moveRight = true;
            break;
          case Modules.Keys.Enter:
            this.chatHandler.toggle();
            break;
        }
        break;

      // mouse click movement and interactions
      case Modules.InputType.LeftClick:
        this.getPlayer().disableAction = false;
        this.setCoords(data);
        this.click(this.getCoords());
        break;
    }
  }

  /**
   * Handle keyUp events
   * @param  {Modules} key the Modules.Keys that was triggered
   */
  keyUp(key) {
    const player = this.getPlayer();

    // WASD and arrow key press movement
    switch (key) {
      default:
        break;
      case Modules.Keys.W:
      case Modules.Keys.Up:
        player.moveUp = false;
        break;
      case Modules.Keys.A:
      case Modules.Keys.Left:
        player.moveLeft = false;
        break;
      case Modules.Keys.S:
      case Modules.Keys.Down:
        player.moveDown = false;
        break;
      case Modules.Keys.D:
      case Modules.Keys.Right:
        player.moveRight = false;
        break;
    }

    player.disableAction = false;
  }

  /**
   * Handle key presses to move the player in a direction
   * @param  {Object} position The x,y coordinates of the click position
   */
  keyMove(position) {
    const player = this.getPlayer();

    if (!player.hasPath()) {
      this.click(position);
    }
  }

  /**
   * Handle clicking events
   * @param  {Object} position the x,y coordinates of the click position
   */
  click(position) {
    const player = this.getPlayer();

    if (player.stunned) {
      return;
    }

    this.setPassiveTarget();

    /**
     * It can be really annoying having the chat open
     * on mobile, and it is far harder to control.
     */
    if (
      this.renderer.mobile
      && this.chatHandler.input.is(':visible')
      && this.chatHandler.input.val() === ''
    ) this.chatHandler.hideInput();

    if (this.game.zoning && this.game.zoning.direction) {
      return;
    }

    const entity = this.game.getEntityAt(
      position.x,
      position.y,
      position.x === player.gridX && position.y === player.gridY,
    );

    if (entity && !player.disableAction) {
      this.setAttackTarget();

      if (this.isTargetable(entity)) {
        player.setTarget(entity);
      }

      if (
        player.getDistance(entity) < 7
        && player.isRanged()
        && this.isAttackable(entity)
      ) {
        this.game.socket.send(Packets.Target, [
          Packets.TargetOpcode.Attack,
          entity.id,
        ]);
        player.lookAt(entity);
        return;
      }

      if (entity.gridX === player.gridX && entity.gridY === player.gridY) {
        this.game.socket.send(Packets.Target, [
          Packets.TargetOpcode.Attack,
          entity.id,
        ]);
      }

      // @TODO this was commented out, not sure why??
      if (entity.type === 'player') {
        this.getActions().showPlayerActions(entity, this.mouse.x, this.mouse.y);
        return;
      }

      if (this.isTargetable(entity)) {
        player.follow(entity);
        return;
      }

      player.disableAction = true;
    } else {
      player.removeTarget();
    }

    this.getActions().hidePlayerActions();

    player.go(position.x, position.y);

    if (this.game.interface) {
      this.game.interface.hideAll();
    }

    if (!this.game.audio.song && Detect.isSafari()) {
      this.game.audio.update();
    }
  }

  /**
   * Change the cursor if visible and newCursor doesn't equal cursor
   */
  updateCursor() {
    if (!this.cursorVisible) {
      return;
    }

    // change to this new cursor
    if (this.newCursor !== this.cursor) {
      this.cursor = this.newCursor;
    }

    if (this.newTargetColour !== this.targetColour) {
      this.targetColour = this.newTargetColour;
    }
  }

  /**
   * Move the cursor or display a different cursor depending on what the
   * player is hovering over
   */
  moveCursor() {
    if (!this.renderer || this.renderer.mobile || !this.renderer.camera) {
      return;
    }

    const position = this.getCoords();
    const player = this.getPlayer();
    const entity = this.game.getEntityAt(
      position.x,
      position.y,
      player.gridX === position.x && player.gridY === position.y,
    );

    this.overlay.update(entity);

    if (!entity || entity.id === player.id) {
      this.setCursor(this.cursors.hand);
      this.hovering = null;
    } else {
      switch (entity.type) {
        default:
          break;
        case 'item':
        case 'chest':
          this.setCursor(this.cursors.loot);
          this.hovering = Modules.Hovering.Item;
          break;

        case 'mob':
          this.setCursor(this.getAttackCursor());
          this.hovering = Modules.Hovering.Mob;
          break;

        case 'player':
          this.setCursor(
            this.game.pvp && entity.pvp
              ? this.getAttackCursor()
              : this.cursors.hand,
          );
          this.hovering = Modules.Hovering.Player;
          break;

        case 'npc':
          this.setCursor(this.cursors.talk);
          this.hovering = Modules.Hovering.NPC;
          break;
      }
    }
  }

  /**
   * Set the selectedX and selectedY positions
   * @param {Number} x X coordinate
   * @param {Number} y Y coordinate
   */
  setPosition(x, y) {
    this.selectedX = x;
    this.selectedY = y;
  }

  /**
   * Sets the coordinates of the mouse relative to the offset of the canvas
   * @param {MouseEvent} event the mouse move or mouse click event
   */
  setCoords(event) {
    const offset = this.app.canvas.offset();

    // check background
    const {
      width,
      height,
    } = this.renderer.backgroundCanvas;

    this.mouse.x = Math.round(
      (event.pageX - offset.left) / this.app.getZoom(),
    );

    this.mouse.y = Math.round(
      (event.pageY - offset.top) / this.app.getZoom(),
    );

    if (this.mouse.x >= width) {
      this.mouse.x = width - 1;
    } else if (this.mouse.x <= 0) {
      this.mouse.x = 0;
    }

    if (this.mouse.y >= height) {
      this.mouse.y = height - 1;
    } else if (this.mouse.y <= 0) {
      this.mouse.y = 0;
    }
  }

  /**
   * Set a new cursor
   * @param {Cusror} cursor the cursor to use
   */
  setCursor(cursor) {
    if (cursor) {
      this.newCursor = cursor;
    } else {
      log.error(`Cursor: ${cursor} could not be found.`);
    }
  }

  /**
   * Set an attack target
   */
  setAttackTarget() {
    this.targetAnimation.setRow(1);
    this.mobileTargetColour = 'rgb(255, 51, 0)';
  }

  /**
   * Set a passive target
   */
  setPassiveTarget() {
    this.targetAnimation.setRow(0);
    this.mobileTargetColour = 'rgb(51, 255, 0)';
  }

  /**
   * Get an attack cursor (bow or sword) depending on if the player is ranged or not
   * @return {Cursor} the cursor to use for attacking
   */
  getAttackCursor() {
    return this.cursors[this.getPlayer().isRanged() ? 'bow' : 'sword'];
  }

  /**
   * Get the coordinates from the mouse relative to the canvas grid
   * @return {{x: Number, y:Number}} returns the grid x,y coordinates
   */
  getCoords() {
    if (!this.renderer || !this.renderer.camera) {
      return {};
    }

    const tileScale = this.renderer.tileSize * this.renderer.getDrawingScale();
    const offsetX = this.mouse.x % tileScale;
    const offsetY = this.mouse.y % tileScale;
    const x = (this.mouse.x - offsetX) / tileScale + this.game.getCamera().gridX;
    const y = (this.mouse.y - offsetY) / tileScale + this.game.getCamera().gridY;

    return {
      x,
      y,
    };
  }

  /**
   * Get data about the current target
   * @return {{
   *  sprite: Sprite,
   *  x: Number,
   *  y: Number,
   *  width: Number,
   *  height: Number,
   *  dy: Number,
   *  dw: Number,
   *  dh: Number,
   *  }} target data
   */
  getTargetData() {
    const frame = this.targetAnimation.currentFrame;
    const scale = this.renderer.getDrawingScale();
    const sprite = this.game.getSprite('target');

    if (!sprite.loaded) {
      sprite.load();
    }

    this.targetData = {
      sprite,
      x: frame.x * scale,
      y: frame.y * scale,
      width: sprite.width * scale,
      height: sprite.height * scale,
      dx: this.selectedX * 16 * scale,
      dy: this.selectedY * 16 * scale,
      dw: sprite.width * scale,
      dh: sprite.height * scale,
    };

    return this.targetData;
  }

  /**
   * Returns whether or not this entity can be targeted
   * @param  {Entity}  entity the entity to check if it can be targeted or not
   * @return {Boolean} returns true player can target this entity
   */
  isTargetable(entity) {
    return (
      this.isAttackable(entity)
      || entity.type === 'npc'
      || entity.type === 'chest'
    );
  }

  /**
   * Returns whether or not the player can attack this entity
   * @param  {Entity}  entity the entity they want to attack
   * @return {Boolean} returns true if they can attack this entity
   */
  isAttackable(entity) {
    return (
      entity.type === 'mob'
      || (entity.type === 'player' && entity.pvp && this.game.pvp)
    );
  }

  /**
   * Returns an instance of the player
   * @return {Entity} the player's entity
   */
  getPlayer() {
    return this.game.player;
  }

  /**
   * Returns the interface actions
   * @return {Actions} game interface actions
   */
  getActions() {
    return this.game.interface.actions;
  }
}
