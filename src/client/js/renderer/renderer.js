/* global document */
import _ from 'underscore';
import $ from 'jquery';
import log from '../lib/log';
import Camera from './camera';
import Tile from './tile';
import Character from '../entity/character/character';
import Item from '../entity/objects/item';
import Detect from '../utils/detect';
import { isIntersecting } from '../utils/util';

const getX = (index, width) => {
  if (index === 0) {
    return 0;
  }

  return index % width === 0
    ? width - 1
    : (index % width) - 1;
};

export default class Renderer {
  constructor(backgroundCanvas, entitiesCanvas, foregroundCanvas, textCanvas, cursorCanvas, game) {
    // log.debug('Renderer - constructor()', backgroundCanvas, entitiesCanvas, foregroundCanvas, textCanvas, cursorCanvas, game);

    this.backgroundCanvas = backgroundCanvas;
    this.entitiesCanvas = entitiesCanvas;
    this.foregroundCanvas = foregroundCanvas;
    this.textCanvas = textCanvas;
    this.cursorCanvas = cursorCanvas;

    this.context = entitiesCanvas.getContext('2d');
    this.backContext = backgroundCanvas.getContext('2d');
    this.foreContext = foregroundCanvas.getContext('2d');
    this.textContext = textCanvas.getContext('2d');
    this.cursorContext = cursorCanvas.getContext('2d');

    this.context.imageSmoothingEnabled = false;
    this.backContext.imageSmoothingEnabled = false;
    this.foreContext.imageSmoothingEnabled = false;
    this.textContext.imageSmoothingEnabled = true;
    this.cursorContext.imageSmoothingEnabled = false;

    this.contexts = [this.backContext, this.foreContext, this.context];
    this.canvases = [
      this.backgroundCanvas,
      this.entitiesCanvas,
      this.foregroundCanvas,
      this.textCanvas,
      this.cursorCanvas,
    ];

    this.game = game;
    this.camera = null;
    this.entities = null;
    this.input = null;

    this.checkDevice();

    this.scale = 1;
    this.tileSize = 16;
    this.fontSize = 10;

    this.screenWidth = 0;
    this.screenHeight = 0;

    this.time = new Date();

    this.fps = 0;
    this.frameCount = 0;
    this.renderedFrame = [0, 0];
    this.lastTarget = [0, 0];

    this.animatedTiles = [];

    this.resizeTimeout = null;
    this.autoCentre = false;

    this.drawTarget = false;
    this.selectedCellVisible = false;

    this.stopRendering = false;
    this.animateTiles = true;
    this.debugging = false;
    this.brightness = 100;
    this.drawNames = true;
    this.drawLevels = true;
    this.forceRendering = false;
    this.textCanvas = $('#textCanvas');

    this.load();
  }

  stop() {
    // log.debug('Renderer - stop()');

    this.camera = null;
    this.input = null;
    this.stopRendering = true;

    this.forEachContext((context) => {
      context.fillStyle = '#12100D'; // eslint-disable-line
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    });
  }

  load() {
    // log.debug('Renderer - load()');

    this.scale = this.getScale();
    this.drawingScale = this.getDrawingScale();

    this.forEachContext((context) => {
      context.imageSmoothingEnabled = false; // eslint-disable-line
      context.webkitImageSmoothingEnabled = false; // eslint-disable-line
      context.mozImageSmoothingEnabled = false; // eslint-disable-line
      context.msImageSmoothingEnabled = false; // eslint-disable-line
      context.oImageSmoothingEnabled = false; // eslint-disable-line
    });
  }

  loadSizes() {
    // log.debug('Renderer - loadSizes()');

    if (!this.camera) {
      return;
    }

    this.screenWidth = this.camera.gridWidth * this.tileSize;
    this.screenHeight = this.camera.gridHeight * this.tileSize;

    const width = $('#container').width() - this.camera.gridWidth;
    const height = $('#container').height() - this.camera.gridHeight;

    this.forEachCanvas((canvas) => {
      canvas.width = width; // eslint-disable-line
      canvas.height = height; // eslint-disable-line
    });
  }

  loadCamera() {
    // log.debug('Renderer - loadCamera()');

    const { storage } = this.game;
    this.camera = new Camera(this);

    this.loadSizes();

    if (
      storage.data.new
      && (this.firefox
        || parseFloat(Detect.androidVersion()) < 6.0
        || parseFloat(Detect.iOSVersion() < 9.0)
        || Detect.isIpad())
    ) {
      this.camera.centered = false;

      storage.data.settings.centerCamera = false;
      storage.save();
    }
  }

  resize() {
    // log.debug('Renderer - resize()');

    this.stopRendering = true;

    this.clearAll();
    this.checkDevice();

    if (!this.resizeTimeout) {
      this.resizeTimeout = setTimeout(() => {
        this.scale = this.getScale();
        this.drawingScale = this.getDrawingScale();

        if (this.camera) {
          this.camera.update();
        }

        this.updateAnimatedTiles();

        this.loadSizes();

        if (this.entities) {
          this.entities.update();
        }

        if (this.map) {
          this.map.updateTileset();
        }

        if (this.camera) {
          this.camera.centreOn(this.game.player);
        }

        if (this.game.interface) {
          this.game.interface.resize();
        }

        this.renderedFrame[0] = -1;
        this.stopRendering = false;
        this.resizeTimeout = null;
      }, 500);
    }
  }

  render() {
    // log.debug('Renderer - render()');

    if (this.stopRendering) {
      return;
    }

    this.clearScreen(this.context);
    this.clearText();
    this.saveAll();

    /**
     * Rendering related draws
     */
    this.draw();
    this.drawAnimatedTiles();

    // the annoying square under the cursor
    // this.drawTargetCell();

    this.drawSelectedCell();
    this.drawEntities();
    this.drawInfos();
    this.drawDebugging();
    this.restoreAll();
    this.drawCursor();
  }

  /**
   * Context Drawing
   */

  draw() {
    // log.debug('Renderer - draw()');

    if (this.hasRenderedFrame()) {
      // log.debug('has rendered rate', this.hasRenderedFrame());
      return;
    }

    this.clearDrawing();
    this.updateDrawingView();

    this.forEachVisibleTile((id, index) => {
      const isHighTile = this.map.isHighTile(id);
      const context = isHighTile ? this.foreContext : this.backContext;

      if (!this.map.isAnimatedTile(id) || !this.animateTiles) {
        this.drawTile(
          context,
          id,
          this.tileset,
          this.tileset.width / this.tileSize,
          this.map.width,
          index,
        );
      }
    });

    this.saveFrame();
  }

  drawAnimatedTiles() {
    // log.debug('Renderer - drawAnimatedTiles()');

    this.setCameraView(this.context);

    if (!this.animateTiles) {
      return;
    }

    this.forEachAnimatedTile((tile) => {
      this.drawTile(
        this.context,
        tile.id,
        this.tileset,
        this.tileset.width / this.tileSize,
        this.map.width,
        tile.index,
      );
      tile.loaded = true; // eslint-disable-line
    });
  }

  drawInfos() {
    // log.debug('Renderer - drawInfos()');

    if (this.game.info.getCount() === 0) {
      return;
    }

    this.game.info.forEachInfo((info) => {
      const factor = this.mobile ? 2 : 1;

      this.textContext.save();
      this.textContext.font = '24px sans serif';
      this.setCameraView(this.textContext);
      this.textContext.globalAlpha = info.opacity;
      this.drawText(
        `${info.text}`,
        Math.floor((info.x + 8) * factor),
        Math.floor(info.y * factor),
        true,
        info.fill,
        info.stroke,
      );
      this.textContext.restore();
    });
  }

  drawDebugging() {
    // log.debug('Renderer - drawDebugging()');

    if (!this.debugging) {
      return;
    }

    this.drawFPS();

    if (!this.mobile) {
      this.drawPosition();
      this.drawPathing();
    }
  }

  drawEntities() {
    // log.debug('Renderer - drawEntities()');

    this.forEachVisibleEntity((entity) => {
      if (entity.spriteLoaded) {
        // log.debug('drawEntities', entity);
        this.drawEntity(entity);
      }
    });
  }

  drawEntity(entity) {
    // log.debug('Renderer - drawEntity()', entity);

    const { sprite } = entity;
    const animation = entity.currentAnimation;
    const data = entity.renderingData;

    if (!sprite || !animation || !entity.isVisible()) {
      return;
    }

    const frame = animation.currentFrame;
    const x = frame.x * this.drawingScale;
    const y = frame.y * this.drawingScale;
    const dx = entity.x * this.drawingScale;
    const dy = entity.y * this.drawingScale;
    const flipX = dx + this.tileSize * this.drawingScale;
    const flipY = dy + data.height;

    this.context.save();

    if (data.scale !== this.scale || data.sprite !== sprite) {
      data.scale = this.scale;
      data.sprite = sprite;
      data.width = sprite.width * this.drawingScale;
      data.height = sprite.height * this.drawingScale;
      data.ox = sprite.offsetX * this.drawingScale;
      data.oy = sprite.offsetY * this.drawingScale;

      if (entity.angled) {
        data.angle = (entity.angle * Math.PI) / 180;
      }

      if (entity.hasShadow()) {
        data.shadowWidth = this.shadowSprite.width * this.drawingScale;
        data.shadowHeight = this.shadowSprite.height * this.drawingScale;
        data.shadowOffsetY = entity.shadowOffsetY * this.drawingScale;
      }
    }

    if (entity.fading) {
      this.context.globalAlpha = entity.fadingAlpha;
    }

    if (entity.spriteFlipX) {
      this.context.translate(flipX, dy);
      this.context.scale(-1, 1);
    } else if (entity.spriteFlipY) {
      this.context.translate(dx, flipY);
      this.context.scale(1, -1);
    } else this.context.translate(dx, dy);

    if (entity.angled) {
      this.context.rotate(data.angle);
    }

    if (entity.hasShadow()) {
      this.context.drawImage(
        this.shadowSprite.image,
        0,
        0,
        data.shadowWidth,
        data.shadowHeight,
        0,
        data.shadowOffsetY,
        data.shadowWidth,
        data.shadowHeight,
      );
    }

    this.drawEntityBack(entity);

    this.context.drawImage(
      sprite.image,
      x,
      y,
      data.width,
      data.height,
      data.ox,
      data.oy,
      data.width,
      data.height,
    );

    if (
      entity instanceof Character
      && !entity.dead
      && !entity.teleporting
      && entity.hasWeapon()
    ) {
      const weapon = this.entities.getSprite(entity.weapon.getName());

      if (weapon) {
        if (!weapon.loaded) {
          weapon.load();
        }

        const weaponAnimationData = weapon.animationData[animation.name];

        const index = frame.index < weaponAnimationData.length
          ? frame.index
          : frame.index % weaponAnimationData.length;


        const weaponX = weapon.width * index * this.drawingScale;
        const weaponY = weapon.height * animation.row * this.drawingScale;
        const weaponWidth = weapon.width * this.drawingScale;
        const weaponHeight = weapon.height * this.drawingScale;

        this.context.drawImage(
          weapon.image,
          weaponX,
          weaponY,
          weaponWidth,
          weaponHeight,
          weapon.offsetX * this.drawingScale,
          weapon.offsetY * this.drawingScale,
          weaponWidth,
          weaponHeight,
        );
      }
    }

    if (entity instanceof Item) {
      const {
        sparksAnimation,
      } = this.entities.sprites;
      const sparksFrame = sparksAnimation.currentFrame;

      if (data.scale !== this.scale) {
        data.sparksX = this.sparksSprite.width * sparksFrame.index * this.drawingScale;
        data.sparksY = this.sparksSprite.height * sparksAnimation.row * this.drawingScale;

        data.sparksWidth = this.sparksSprite.width * this.drawingScale;
        data.sparksHeight = this.sparksSprite.height * this.drawingScale;
      }

      this.context.drawImage(
        this.sparksSprite.image,
        data.sparksX,
        data.sparksY,
        data.sparksWidth,
        data.sparksHeight,
        0,
        0,
        data.sparksWidth,
        data.sparksHeight,
      );
    }

    this.drawEntityFore(entity);

    this.context.restore();

    this.drawHealth(entity);
    this.drawName(entity);
  }

  /**
   * Function used to draw special effects prior
   * to rendering the entity.
   */
  drawEntityBack(entity) {
    // const self = this;
    // @TODO
  }

  drawEntityFore(entity) {
    // log.debug('Renderer - drawEntityFore()');

    /**
     * Function used to draw special effects after
     * having rendererd the entity
     */

    if (
      entity.terror
      || entity.stunned
      || entity.critical
      || entity.explosion
    ) {
      const sprite = this.entities.getSprite(entity.getActiveEffect());

      if (!sprite.loaded) {
        sprite.load();
      }

      if (sprite) {
        const animation = entity.getEffectAnimation();
        const { index } = animation.currentFrame;
        const x = sprite.width * index * this.drawingScale;
        const y = sprite.height * animation.row * this.drawingScale;
        const width = sprite.width * this.drawingScale;
        const height = sprite.height * this.drawingScale;
        const offsetX = sprite.offsetX * this.drawingScale;
        const offsetY = sprite.offsetY * this.drawingScale;

        this.context.drawImage(
          sprite.image,
          x,
          y,
          width,
          height,
          offsetX,
          offsetY,
          width,
          height,
        );
      }
    }
  }

  drawHealth(entity) {
    // log.debug('Renderer - entity()');

    if (!entity.hitPoints || entity.hitPoints < 0 || !entity.healthBarVisible) {
      return;
    }

    const barLength = 16;
    const healthX = entity.x * this.drawingScale - barLength / 2 + 8;
    const healthY = (entity.y - 9) * this.drawingScale;

    const healthWidth = Math.round(
      (entity.hitPoints / entity.maxHitPoints)
      * barLength
      * this.drawingScale,
    );

    const healthHeight = 2 * this.drawingScale;

    this.context.save();
    this.context.strokeStyle = '#00000';
    this.context.lineWidth = 1;
    this.context.strokeRect(
      healthX,
      healthY,
      barLength * this.drawingScale,
      healthHeight,
    );
    this.context.fillStyle = '#FD0000';
    this.context.fillRect(healthX, healthY, healthWidth, healthHeight);
    this.context.restore();
  }

  drawName(entity) {
    // log.debug('Renderer - drawName()');

    if (entity.hidden || (!this.drawNames && !this.drawLevels)) {
      return;
    }

    let colour = entity.wanted ? 'red' : 'white';
    const factor = this.mobile ? 2 : 1;

    if (entity.rights > 1) {
      colour = '#ba1414';
    } else if (entity.rights > 0) {
      colour = '#a59a9a';
    }

    if (entity.id === this.game.player.id) {
      colour = '#fcda5c';
    }

    this.textContext.save();
    this.setCameraView(this.textContext);
    this.textContext.font = '14px sans serif';

    if (!entity.hasCounter) {
      if (this.drawNames && entity !== 'player') {
        this.drawText(
          entity.username,
          (entity.x + 8) * factor,
          (entity.y - (this.drawLevels ? 20 : 10)) * factor,
          true,
          colour,
        );
      }

      if (
        this.drawLevels
        && (entity.type === 'mob' || entity.type === 'player')
      ) {
        this.drawText(
          `Level ${entity.level}`,
          (entity.x + 8) * factor,
          (entity.y - 10) * factor,
          true,
          colour,
        );
      }

      if (entity.type === 'item' && entity.count > 1) {
        this.drawText(
          entity.count,
          (entity.x + 8) * factor,
          (entity.y - 10) * factor,
          true,
          colour,
        );
      }
    } else {
      if (this.game.time - entity.countdownTime > 1000) {
        entity.countdownTime = this.game.time; // eslint-disable-line
        entity.counter -= 1; // eslint-disable-line
      }

      if (entity.counter <= 0) {
        entity.hasCounter = false; // eslint-disable-line
      }

      this.drawText(
        entity.counter,
        (entity.x + 8) * factor,
        (entity.y - 10) * factor,
        true,
        colour,
      );
    }

    this.textContext.restore();
  }

  drawCursor() {
    // log.debug('Renderer - drawCursor()');

    if (this.tablet || this.mobile) {
      return;
    }

    const { cursor } = this.input;

    this.clearScreen(this.cursorContext);
    this.cursorContext.save();

    if (cursor && this.scale > 1) {
      if (!cursor.loaded) {
        cursor.load();
      }

      if (cursor.loaded) {
        this.cursorContext.drawImage(
          cursor.image,
          0,
          0,
          14 * this.drawingScale,
          14 * this.drawingScale,
          this.input.mouse.x,
          this.input.mouse.y,
          14 * this.drawingScale,
          14 * this.drawingScale,
        );
      }
    }

    this.cursorContext.restore();
  }

  drawFPS() {
    // log.debug('Renderer - drawFPS()');

    const currentTime = new Date();
    const timeDiff = currentTime - this.time;

    if (timeDiff >= 1000) {
      this.realFPS = this.frameCount;
      this.frameCount = 0;
      this.time = currentTime;
      this.fps = this.realFPS;
    }

    this.frameCount += 1;

    this.drawText(`FPS: ${this.realFPS}`, 10, 11, false, 'white');
  }

  drawPosition() {
    // log.debug('Renderer - drawPosition()');

    const { player } = this.game;

    this.drawText(
      `x: ${player.gridX} y: ${player.gridY}`,
      10,
      31,
      false,
      'white',
    );
  }

  drawPathing() {
    // log.debug('Renderer - drawPathing()');

    const { pathingGrid } = this.entities.grids;

    if (!pathingGrid) {
      return;
    }

    this.camera.forEachVisiblePosition((x, y) => {
      if (x < 0 || y < 0) {
        return;
      }

      if (pathingGrid[y][x] !== 0) {
        this.drawCellHighlight(x, y, 'rgba(50, 50, 255, 0.5)');
      }
    });
  }

  drawSelectedCell() {
    // log.debug('Renderer - drawSelectedCell()');

    if (!this.input.selectedCellVisible) {
      return;
    }

    const posX = this.input.selectedX;
    const posY = this.input.selectedY;

    // only draw the highlight cell if they are not adjacent
    // from character's current position
    if (!this.game.player.isPositionAdjacent(posX, posY)) {
      this.drawCellHighlight(posX, posY, this.input.mobileTargetColour);
    }
  }

  /**
   * Primitive drawing functions
   */

  drawTile(context, tileId, tileset, setWidth, gridWidth, cellId) {
    // log.debug('Renderer - draw()', context, tileId, tileset, setWidth, gridWidth, cellId);

    if (tileId === -1) {
      return;
    }

    this.drawScaledImage(
      context,
      tileset,
      getX(tileId + 1, setWidth / this.drawingScale) * this.tileSize,
      Math.floor(tileId / (setWidth / this.drawingScale)) * this.tileSize,
      this.tileSize,
      this.tileSize,
      getX(cellId + 1, gridWidth) * this.tileSize,
      Math.floor(cellId / gridWidth) * this.tileSize,
    );
  }

  clearTile(context, gridWidth, cellId) {
    // log.debug('Renderer - clearTile()', context, gridWidth, cellId);

    const x = getX(cellId + 1, gridWidth) * this.tileSize * this.drawingScale;
    const y = Math.floor(cellId / gridWidth) * this.tileSize * this.drawingScale;
    const w = this.tileSize * this.scale;

    context.clearRect(x, y, w, w);
  }

  drawText(text, x, y, centered, colour, strokeColour) {
    // log.debug('Renderer - drawText()', text, x, y, centered, colour, strokeColour);

    let strokeSize = 1;
    const context = this.textContext;

    if (this.scale > 2) {
      strokeSize = 3;
    }

    if (text && x && y) {
      context.save();

      if (centered) {
        context.textAlign = 'center';
      }

      context.strokeStyle = strokeColour || '#373737';
      context.lineWidth = strokeSize;
      context.strokeText(text, x * this.scale, y * this.scale);
      context.fillStyle = colour || 'white';
      context.fillText(text, x * this.scale, y * this.scale);

      context.restore();
    }
  }

  drawScaledImage(context, image, x, y, width, height, dx, dy) {
    // log.debug('Renderer - drawScaledImage()', context, image, x, y, width, height, dx, dy);

    if (!context) {
      return;
    }

    context.drawImage(
      image,
      x * this.drawingScale,
      y * this.drawingScale,
      width * this.drawingScale,
      height * this.drawingScale,
      dx * this.drawingScale,
      dy * this.drawingScale,
      width * this.drawingScale,
      height * this.drawingScale,
    );
  }

  updateAnimatedTiles() {
    // log.debug('Renderer - updateAnimatedTiles()');

    if (!this.animateTiles) {
      return;
    }

    const newTiles = [];

    this.forEachVisibleTile((id, index) => {
      /**
       * We don't want to reinitialize animated tiles that already exist
       * and are within the visible camera proportions. This way we can parse
       * it every time the tile moves slightly.
       */

      if (!this.map.isAnimatedTile(id)) {
        return;
      }

      /**
       * Push the pre-existing tiles.
       */

      const tileIndex = this.animatedTiles.indexOf(id);

      if (tileIndex > -1) {
        newTiles.push(this.animatedTiles[tileIndex]);
        return;
      }

      const tile = new Tile(
        id,
        index,
        this.map.getTileAnimationLength(id),
        this.map.getTileAnimationDelay(id),
      );

      const position = this.map.indexToGridPosition(tile.index);

      tile.setPosition(position);
      newTiles.push(tile);
    }, 2);

    this.animatedTiles = newTiles;
  }

  checkDirty(rectOne, source, x, y) {
    // log.debug('Renderer - checkDirty()', rectOne, source, x, y);

    this.entities.forEachEntityAround(x, y, 2, (entityTwo) => {
      if (source && source.id && entityTwo.id === source.id) return;

      if (!entityTwo.isDirty && isIntersecting(rectOne, this.getEntityBounds(entityTwo))) {
        entityTwo.loadDirty();
      }
    });

    if (source && !source.hasOwnProperty('index')) { // eslint-disable-line
      this.forEachAnimatedTile((tile) => {
        if (!tile.isDirty && isIntersecting(rectOne, this.getTileBounds(tile))) {
          tile.dirty = true; // eslint-disable-line
        }
      });
    }

    if (!this.drawTarget && this.input.selectedCellVisible) {
      const targetRect = this.getTargetBounds();

      if (isIntersecting(rectOne, targetRect)) {
        this.drawTarget = true;
        this.targetRect = targetRect;
      }
    }
  }

  drawCellRect(x, y, colour) {
    // log.debug('Renderer - drawCellRect()', x, y, colour);

    const multiplier = this.tileSize * this.drawingScale;

    this.context.save();
    this.context.lineWidth = 2 * this.drawingScale;
    this.context.translate(x + 2, y + 2);
    this.context.strokeStyle = colour;
    this.context.strokeRect(0, 0, multiplier - 4, multiplier - 4);
    this.context.restore();
  }

  drawCellHighlight(x, y, colour) {
    // log.debug('Renderer - drawCellHighlight()', x, y, colour);

    this.drawCellRect(
      x * this.drawingScale * this.tileSize,
      y * this.drawingScale * this.tileSize,
      colour,
    );
  }

  drawTargetCell() {
    // log.debug('Renderer - drawTargetCell()');

    if (
      this.mobile
      || this.tablet
      || !this.input.targetVisible
      || !this.input
      || !this.camera
    ) {
      return;
    }

    const location = this.input.getCoords();

    if (
      !(
        location.x === this.input.selectedX
        && location.y === this.input.selectedY
      )
    ) {
      this.drawCellHighlight(location.x, location.y, this.input.targetColour);
    }
  }

  /**
   * Primordial Rendering functions
   */

  forEachVisibleIndex(callback, offset) {
    // log.debug('Renderer - forEachVisibleIndex()', callback, offset);

    this.camera.forEachVisiblePosition((x, y) => {
      if (!this.map.isOutOfBounds(x, y)) callback(this.map.gridPositionToIndex(x, y) - 1);
    }, offset);
  }

  forEachVisibleTile(callback, offset) {
    // log.debug('Renderer - forEachVisibleTile()', callback, offset);

    if (!this.map || !this.map.mapLoaded) {
      return;
    }

    this.forEachVisibleIndex((index) => {
      if (_.isArray(this.map.data[index])) {
        _.each(this.map.data[index], (id) => {
          callback(id - 1, index);
        });
      } else if (!isNaN(this.map.data[index] - 1)) { // eslint-disable-line
        callback(this.map.data[index] - 1, index);
      }
    }, offset);
  }

  forEachAnimatedTile(callback) {
    // log.debug('Renderer - forEachAnimatedTile()', callback);

    _.each(this.animatedTiles, (tile) => {
      callback(tile);
    });
  }

  forEachVisibleEntity(callback) {
    // log.debug('Renderer - forEachVisibleEntity()', callback);

    if (!this.entities || !this.camera) {
      return;
    }

    const { grids } = this.entities;

    this.camera.forEachVisiblePosition((x, y) => {
      if (!this.map.isOutOfBounds(x, y) && grids.renderingGrid[y][x]) {
        _.each(grids.renderingGrid[y][x], (entity) => {
          callback(entity);
        });
      }
    });
  }

  isVisiblePosition(x, y) {
    // log.debug('Renderer - isVisiblePosition()', x, y);

    return (
      y >= this.camera.gridY
      && y < this.camera.gridY + this.camera.gridHeight
      && x >= this.camera.gridX
      && x < this.camera.gridX + this.camera.gridWidth
    );
  }

  getScale() {
    // log.debug('Renderer - getScale()');

    return this.game.getScaleFactor();
  }

  getDrawingScale() {
    // log.debug('Renderer - getDrawingScale()');

    let scale = this.getScale();

    if (this.mobile) {
      scale = 2;
    }

    return scale;
  }

  getUpscale() {
    // log.debug('Renderer - getUpscale()');

    let scale = this.getScale();

    if (scale > 2) {
      scale = 2;
    }

    return scale;
  }

  clearContext() {
    // log.debug('Renderer - clearContext()');

    this.context.clearRect(
      0,
      0,
      this.screenWidth * this.scale,
      this.screenHeight * this.scale,
    );
  }

  clearText() {
    // log.debug('Renderer - clearText()');

    this.textContext.clearRect(
      0,
      0,
      this.textCanvas.width,
      this.textCanvas.height,
    );
  }

  restore() {
    // log.debug('Renderer - restore()');

    this.forEachContext((context) => {
      context.restore();
    });
  }

  clearAll() {
    // log.debug('Renderer - clearAll()');

    this.forEachContext((context) => {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    });
  }

  clearDrawing() {
    // log.debug('Renderer - clearDrawing()');

    this.forEachDrawingContext((context) => {
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    });
  }

  saveAll() {
    // log.debug('Renderer - saveAll()');

    this.forEachContext((context) => {
      context.save();
    });
  }

  restoreAll() {
    // log.debug('Renderer - restoreAll()');

    this.forEachContext((context) => {
      context.restore();
    });
  }

  focus() {
    // log.debug('Renderer - focus()');

    this.forEachContext((context) => {
      context.focus();
    });
  }

  /**
   * Rendering Functions
   */

  updateView() {
    // log.debug('Renderer - updateView()');

    this.forEachContext((context) => {
      this.setCameraView(context);
    });
  }

  updateDrawingView() {
    // log.debug('Renderer - updateDrawingView()');

    this.forEachDrawingContext((context) => {
      this.setCameraView(context);
    });
  }

  setCameraView(context) {
    // log.debug('Renderer - setCameraView()');

    if (!this.camera || this.stopRendering) {
      return;
    }

    context.translate(
      -this.camera.x * this.drawingScale,
      -this.camera.y * this.drawingScale,
    );
  }

  clearScreen(context) {
    // log.debug('Renderer - clearScreen()', context);

    context.clearRect(
      0,
      0,
      this.context.canvas.width,
      this.context.canvas.height,
    );
  }

  hasRenderedFrame() {
    // log.debug('Renderer - hasRenderedFrame()');

    if (this.forceRendering) {
      return false;
    }

    if (!this.camera || this.stopRendering || !this.input) {
      return true;
    }

    return (
      this.renderedFrame[0] === this.camera.x
      && this.renderedFrame[1] === this.camera.y
    );
  }

  saveFrame() {
    // log.debug('Renderer - saveFrame()');

    if (!this.hasRenderedFrame()) {
      this.renderedFrame[0] = this.camera.x;
      this.renderedFrame[1] = this.camera.y;
    }
  }

  adjustBrightness(level) {
    // log.debug('Renderer - adjustBrightness()', level);

    if (level < 0 || level > 100) {
      return;
    }

    this.textCanvas.css(
      'background',
      `rgba(0, 0, 0, ${0.5 - level / 200})`,
    );
  }

  loadStaticSprites() {
    log.debug('Renderer - loadStaticSprites()');

    this.shadowSprite = this.entities.getSprite('shadow16');

    // if (!this.shadowSprite.loaded) {
    //   this.shadowSprite.load();
    // }

    this.sparksSprite = this.entities.getSprite('sparks');

    // if (!this.sparksSprite.loaded) {
    //   this.sparksSprite.load();
    // }
  }

  /**
   * Miscellaneous functions
   */

  forEachContext(callback) {
    // log.debug('Renderer - forEachContext()', callback);

    _.each(this.contexts, (context) => {
      callback(context);
    });
  }

  forEachDrawingContext(callback) {
    // log.debug('Renderer - forEachDrawingContext()', callback);

    _.each(this.contexts, (context) => {
      if (context.canvas.id !== 'entities') {
        callback(context);
      }
    });
  }

  forEachCanvas(callback) {
    // log.debug('Renderer - forEachCanvas()', callback);

    _.each(this.canvases, (canvas) => {
      callback(canvas);
    });
  }

  checkDevice() {
    // log.debug('Renderer - checkDevice()');

    this.mobile = this.game.app.isMobile();
    this.tablet = this.game.app.isTablet();
    this.firefox = Detect.isFirefox();
  }

  verifyCentration() {
    // log.debug('Renderer - verifyCentration()');

    this.forceRendering = (this.mobile || this.tablet) && this.camera.centered;
  }

  isPortableDevice() {
    // log.debug('Renderer - isPortableDevice()');

    return this.mobile || this.tablet;
  }

  /**
   * Setters
   */

  setTileset(tileset) {
    // log.debug('Renderer - setTileset()', tileset);

    this.tileset = tileset;
  }

  setMap(map) {
    // log.debug('Renderer - setMap()', map);

    this.map = map;
  }

  setEntities(entities) {
    // log.debug('Renderer - entities()', entities);

    this.entities = entities;
  }

  setInput(input) {
    // log.debug('Renderer - setInput()', input);

    this.input = input;
  }

  /**
   * Getters
   */

  getTileBounds(tile) {
    // log.debug('Renderer - getTileBounds()', tile);

    const bounds = {};
    const cellId = tile.index;

    bounds.x = (getX(cellId + 1, this.map.width) * this.tileSize
        - this.camera.x)
      * this.drawingScale;
    bounds.y = (Math.floor(cellId / this.map.width) * this.tileSize - this.camera.y)
      * this.drawingScale;
    bounds.width = this.tileSize * this.drawingScale;
    bounds.height = this.tileSize * this.drawingScale;
    bounds.left = bounds.x;
    bounds.right = bounds.x + bounds.width;
    bounds.top = bounds.y;
    bounds.bottom = bounds.y + bounds.height;

    return bounds;
  }

  getEntityBounds(entity) {
    // log.debug('Renderer - getEntityBounds()', entity);

    const bounds = {};
    const { sprite } = entity;

    // TODO - Ensure that the sprite over there has the correct bounds

    if (!sprite) {
      log.error(`Sprite malformation for: ${entity.name}`);
    } else {
      bounds.x = (entity.x + sprite.offsetX - this.camera.x) * this.drawingScale;
      bounds.y = (entity.y + sprite.offsetY - this.camera.y) * this.drawingScale;
      bounds.width = sprite.width * this.drawingScale;
      bounds.height = sprite.height * this.drawingScale;
      bounds.left = bounds.x;
      bounds.right = bounds.x + bounds.width;
      bounds.top = bounds.y;
      bounds.bottom = bounds.y + bounds.height;
    }

    return bounds;
  }

  getTargetBounds(x, y) {
    // log.debug('Renderer - getTargetBounds()', x, y);

    const bounds = {};
    const tx = x || this.input.selectedX;
    const ty = y || this.input.selectedY;

    bounds.x = (tx * this.tileSize - this.camera.x) * this.drawingScale;
    bounds.y = (ty * this.tileSize - this.camera.y) * this.drawingScale;
    bounds.width = this.tileSize * this.drawingScale;
    bounds.height = this.tileSize * this.drawingScale;
    bounds.left = bounds.x;
    bounds.right = bounds.x + bounds.width;
    bounds.top = bounds.y;
    bounds.bottom = bounds.y + bounds.height;

    return bounds;
  }

  getTileset() {
    // log.debug('Renderer - getTileset()');

    return this.tileset;
  }
}
