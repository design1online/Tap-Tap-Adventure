import Packets from '../../../network/packets';
import log from '../../../lib/log';

/**
 * This is a player handler, responsible for all the callbacks
 * without having to clutter up the entire game file.
 */
export default class PlayerHandler {
  constructor(game, player) {
    this.game = game;
    this.camera = game.getCamera();
    this.input = game.input;
    this.player = player;
    this.entities = game.entities;
    this.socket = game.socket;
    this.renderer = game.renderer;

    this.load();
  }

  load() {
    this.player.onRequestPath((x, y) => {
      if (this.player.dead) return null;

      const ignores = [this.player];

      if (this.player.hasTarget()) {
        ignores.push(this.player.target);
      }

      this.socket.send(Packets.Movement, [
        Packets.MovementOpcode.Request,
        x,
        y,
        this.player.gridX,
        this.player.gridY,
      ]);

      return this.game.findPath(this.player, x, y, ignores);
    });

    this.player.onStartPathing((path) => {
      const i = path.length - 1;

      this.input.selectedX = path[i][0]; // eslint-disable-line
      this.input.selectedY = path[i][1]; // eslint-disable-line
      this.input.selectedCellVisible = true;

      if (!this.game.getEntityAt(this.input.selectedX, this.input.selectedY)) {
        this.socket.send(Packets.Target, [Packets.TargetOpcode.None]);
      }

      this.socket.send(Packets.Movement, [
        Packets.MovementOpcode.Started,
        this.input.selectedX,
        this.input.selectedY,
        this.player.gridX,
        this.player.gridY,
      ]);
    });

    this.player.onStopPathing((x, y) => {
      this.entities.unregisterPosition(this.player);
      this.entities.registerPosition(this.player);

      this.input.selectedCellVisible = false;

      this.camera.clip();

      const entity = this.game.getEntityAt(x, y, true);

      const hasTarget = this.player.hasTarget();

      const {
        id,
      } = entity;

      this.socket.send(Packets.Movement, [
        Packets.MovementOpcode.Stop,
        x,
        y,
        id,
        hasTarget,
      ]);

      if (hasTarget) {
        this.socket.send(Packets.Target, [
          this.isAttackable()
            ? Packets.TargetOpcode.Attack
            : Packets.TargetOpcode.Talk,
          this.player.target.id,
        ]);

        this.player.lookAt(this.player.target);
      }

      this.input.setPassiveTarget();
    });

    this.player.onBeforeStep(() => {
      this.entities.unregisterPosition(this.player);

      if (!this.isAttackable()) return;

      if (this.player.isRanged()) {
        if (this.player.getDistance(this.player.target) < 7) this.player.stop();
      } else {
        this.input.selectedX = this.player.target.gridX;
        this.input.selectedY = this.player.target.gridY;
      }
    });

    this.player.onStep(() => {
      if (this.player.hasNextStep()) this.entities.registerDuality(this.player);

      if (!this.camera.centered) this.checkBounds();

      this.player.forEachAttacker((attacker) => {
        if (!attacker.stunned) attacker.follow(this.player);
      });

      this.socket.send(Packets.Movement, [
        Packets.MovementOpcode.Step,
        this.player.gridX,
        this.player.gridY,
      ]);
    });

    this.player.onSecondStep(() => {
      this.renderer.updateAnimatedTiles();
    });

    this.player.onMove(() => {
      /**
       * This is a callback representing the absolute exact position of the player.
       */

      if (this.camera.centered) this.camera.centreOn(this.player);

      if (this.player.hasTarget()) {
        this.player.follow(this.player.target);
      }
    });

    this.player.onUpdateArmour((armourName) => {
      log.debug('Player - onUpdateArmour', armourName);
      this.player.setSprite(this.game.getSprite(armourName));
    });
  }

  isAttackable() {
    const {
      target,
    } = this.player;

    if (!target) {
      return false;
    }

    return target.type === 'mob' || (target.type === 'player' && target.pvp);
  }

  checkBounds() {
    const x = this.player.gridX - this.camera.gridX;


    const y = this.player.gridY - this.camera.gridY;

    if (x === 0) this.game.zoning.setLeft();
    else if (y === 0) this.game.zoning.setUp();
    else if (x === this.camera.gridWidth - 1) this.game.zoning.setRight();
    else if (y === this.camera.gridHeight - 1) this.game.zoning.setDown();

    if (this.game.zoning.direction !== null) {
      this.camera.zone(this.game.zoning.getDirection());
      this.game.zoning.reset();
    }
  }
}
