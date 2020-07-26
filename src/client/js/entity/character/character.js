import _ from 'underscore';
import Entity from '../entity';
import Transition from '../../utils/transition';
import Animation from '../animation';
import Modules from '../../utils/modules';

export default class Character extends Entity {
  constructor(id, kind) {
    super(id, kind);

    this.nextGridX = -1;
    this.nextGridY = -1;
    this.prevGridX = -1;
    this.prevGridY = -1;

    this.orientation = Modules.Orientation.Down;

    this.hitPoints = -1;
    this.maxHitPoints = -1;
    this.mana = -1;
    this.maxMana = -1;

    this.healthBarVisible = false;
    this.healthBarTimeout = false;

    this.dead = false;
    this.following = false;
    this.attacking = false;
    this.interrupted = false;

    this.critical = false;
    this.frozen = false;
    this.stunned = false;
    this.explosion = false;

    this.path = null;
    this.target = null;

    this.attackers = {};

    this.movement = new Transition();

    this.idleSpeed = 450;
    this.attackAnimationSpeed = 50;
    this.walkAnimationSpeed = 100;
    this.movementSpeed = 250;

    this.weapon = false;
    this.shadow = false;

    this.attackRange = 1;

    this.loadGlobals();
  }

  loadGlobals() {
    this.criticalAnimation = new Animation('atk_down', 10, 0, 48, 48);
    this.criticalAnimation.setSpeed(30);

    this.criticalAnimation.setCount(1, () => {
      this.critical = false;

      this.criticalAnimation.reset();
      this.criticalAnimation.count = 1;
    });

    this.terrorAnimation = new Animation('explosion', 8, 0, 64, 64);
    this.terrorAnimation.setSpeed(50);

    this.terrorAnimation.setCount(1, () => {
      this.terror = false;

      this.terrorAnimation.reset();
      this.terrorAnimation.count = 1;
    });

    this.stunAnimation = new Animation('atk_down', 6, 0, 48, 48);
    this.stunAnimation.setSpeed(30);

    this.explosionAnimation = new Animation('explosion', 8, 0, 64, 64);
    this.explosionAnimation.setSpeed(50);

    this.explosionAnimation.setCount(1, () => {
      this.explosion = false;

      this.explosionAnimation.reset();
      this.explosionAnimation.count = 1;
    });
  }

  animate(animation, speed, count, onEndCount) {
    const o = ['atk', 'walk', 'idle'];

    const {
      orientation,
    } = this;

    if (this.currentAnimation && this.currentAnimation.name === 'death') return;

    this.spriteFlipX = false;
    this.spriteFlipY = false;

    const orientationToString = (ots) => {
      const oM = Modules.Orientation;

      switch (ots) {
        case oM.Left:
          return 'left';

        case oM.Right:
          return 'right';

        case oM.Up:
          return 'up';

        case oM.Down:
          return 'down';
        default:
          return null;
      }
    };

    if (o.indexOf(animation) > -1) {
      animation // eslint-disable-line
        += `_${
          orientation === Modules.Orientation.Left
            ? 'right'
            : orientationToString(orientation)}`;
      this.spriteFlipX = this.orientation === Modules.Orientation.Left;
    }

    this.setAnimation(animation, speed, count, onEndCount);
  }

  lookAt(character) {
    if (character.gridX > this.gridX) this.setOrientation(Modules.Orientation.Right);
    else if (character.gridX < this.gridX) this.setOrientation(Modules.Orientation.Left);
    else if (character.gridY > this.gridY) this.setOrientation(Modules.Orientation.Down);
    else if (character.gridY < this.gridY) this.setOrientation(Modules.Orientation.Up);

    this.idle();
  }

  follow(character) {
    this.following = true;

    this.setTarget(character);
    this.move(character.gridX, character.gridY);
  }

  attack(attacker, character) {
    this.attacking = true;

    this.follow(character);
  }

  backOff() {
    this.attacking = false;
    this.following = false;

    this.removeTarget();
  }

  addAttacker(character) {
    if (this.hasAttacker(character)) return;

    this.attackers[character.instance] = character;
  }

  removeAttacker(character) {
    if (this.hasAttacker(character)) delete this.attackers[character.id];
  }

  hasAttacker(character) {
    if (this.attackers.size === 0) return false;

    return character.instance in this.attackers;
  }

  performAction(orientation, action) {
    this.setOrientation(orientation);

    switch (action) {
      case Modules.Actions.Idle:
        this.animate('idle', this.idleSpeed);
        break;

      case Modules.Actions.Attack:
        this.animate('atk', this.attackAnimationSpeed, 1);
        break;

      case Modules.Actions.Walk:
        this.animate('walk', this.walkAnimationSpeed);
        break;
      default:
        break;
    }
  }

  idle(o) {
    const orientation = o || this.orientation;

    this.performAction(orientation, Modules.Actions.Idle);
  }

  go(x, y, forced) {
    if (this.frozen) return;

    if (this.following) {
      this.following = false;
      this.target = null;
    }

    this.move(x, y, forced);
  }

  proceed(x, y) {
    this.newDestination = {
      x,
      y,
    };
  }

  /**
   * We can have the movement remain client sided because
   * the server side will be responsible for determining
   * whether or not the player should have reached the
   * location and ban all hackers. That and the fact
   * the movement speed is constantly updated to avoid
   * hacks previously present in BQ.
   */

  nextStep() {
    let stop = false;
    let path;

    if (this.step % 2 === 0 && this.secondStepCallback) {
      this.secondStepCallback();
    }

    this.prevGridX = this.gridX;
    this.prevGridY = this.gridY;

    if (!this.hasPath()) return;

    if (this.beforeStepCallback) this.beforeStepCallback();

    this.updateGridPosition();

    if (!this.interrupted) {
      if (this.hasNextStep()) {
        this.nextGridX = this.path[this.step + 1][0]; // eslint-disable-line
        this.nextGridY = this.path[this.step + 1][1]; // eslint-disable-line
      }

      if (this.stepCallback) this.stepCallback();

      if (this.changedPath()) {
        const {
          x,
        } = this.newDestination;
        const {
          y,
        } = this.newDestination;

        path = this.requestPathfinding(x, y);

        if (!path) return;

        this.newDestination = null;

        if (path.length < 2) stop = true;
        else this.followPath(path);
      } else if (this.hasNextStep()) {
        this.step += 1;
        this.updateMovement();
      } else stop = true;
    } else {
      stop = true;
      this.interrupted = false;
    }

    if (stop) {
      this.path = null;
      this.idle();

      if (this.stopPathingCallback) this.stopPathingCallback(this.gridX, this.gridY, this.forced);

      if (this.forced) this.forced = false;
    }
  }

  updateMovement() {
    const {
      step,
    } = this;

    if (this.path[step][0] < this.path[step - 1][0]) {
      this.performAction(Modules.Orientation.Left, Modules.Actions.Walk);
    }

    if (this.path[step][0] > this.path[step - 1][0]) {
      this.performAction(Modules.Orientation.Right, Modules.Actions.Walk);
    }

    if (this.path[step][1] < this.path[step - 1][1]) {
      this.performAction(Modules.Orientation.Up, Modules.Actions.Walk);
    }

    if (this.path[step][1] > this.path[step - 1][1]) {
      this.performAction(Modules.Orientation.Down, Modules.Actions.Walk);
    }
  }

  followPath(path) {
    /**
     * Taken from TTA - this is to ensure the player
     * does not click on himself or somehow into another
     * dimension
     */

    if (!path || path.length < 2) return;

    this.path = path;
    this.step = 0;

    if (this.following) path.pop();

    if (this.startPathingCallback) this.startPathingCallback(path);

    this.nextStep();
  }

  move(x, y, forced) {
    this.destination = {
      gridX: x,
      gridY: y,
    };

    this.adjacentTiles = {};

    if (this.hasPath() && !forced) this.proceed(x, y);
    else this.followPath(this.requestPathfinding(x, y));
  }

  stop(force) {
    if (!force) this.interrupted = true;
    else if (this.hasPath()) {
      this.path = null;
      this.newDestination = null;
      this.movement = new Transition();
      this.performAction(this.orientation, Modules.Actions.Idle);
      this.nextGridX = this.gridX;
      this.nextGridY = this.gridY;
    }
  }

  getEffectAnimation() {
    if (this.critical) {
      return this.criticalAnimation;
    }

    if (this.stunned) {
      return this.stunAnimation;
    }

    if (this.terror) {
      return this.terrorAnimation;
    }

    if (this.explosion) {
      return this.explosionAnimation;
    }

    return null;
  }

  getActiveEffect() {
    if (this.critical) {
      return 'criticaleffect';
    }

    if (this.stunned) {
      return 'stuneffect';
    }

    if (this.terror) {
      return 'explosion-terror';
    }

    if (this.explosion) {
      return 'explosion-fireball';
    }

    return null;
  }

  /**
   * TRIGGERED!!!!
   */

  triggerHealthBar() {
    this.healthBarVisible = true;

    if (this.healthBarTimeout) {
      clearTimeout(this.healthBarTimeout);
    }

    this.healthBarTimeout = setTimeout(() => {
      this.healthBarVisible = false;
    }, 7000);
  }

  clearHealthBar() {
    this.healthBarVisible = false;
    clearTimeout(this.healthBarTimeout);
    this.healthBarTimeout = null;
  }

  requestPathfinding(x, y) {
    if (this.requestPathCallback) {
      return this.requestPathCallback(x, y);
    }

    return null;
  }

  updateGridPosition() {
    this.setGridPosition(this.path[this.step][0], this.path[this.step][1]);
  }

  isMoving() {
    return (
      this.currentAnimation.name === 'walk'
      && (this.x % 2 !== 0 || this.y % 2 !== 0)
    );
  }

  forEachAttacker(callback) {
    _.each(this.attackers, (attacker) => {
      callback(attacker);
    });
  }

  isAttacked() {
    return Object.keys(this.attackers).length > 0;
  }

  hasWeapon() {
    return this.weapon;
  }

  hasShadow() {
    return this.shadow;
  }

  hasTarget() {
    return !(this.target === null);
  }

  hasPath() {
    return this.path !== null;
  }

  hasNextStep() {
    return this.path.length - 1 > this.step;
  }

  changedPath() {
    return !!this.newDestination;
  }

  removeTarget() {
    if (!this.target) return;

    this.target = null;
  }

  forget() {
    this.attackers = {};
  }

  moved() {
    this.loadDirty();

    if (this.moveCallback) this.moveCallback();
  }

  setTarget(target) {
    if (target === null) {
      this.removeTarget();
      return;
    }

    if (this.target && this.target.id === target.id) return;

    if (this.hasTarget()) this.removeTarget();

    this.target = target;
  }

  setHitPoints(hitPoints) {
    this.hitPoints = hitPoints;

    if (this.hitPointsCallback) this.hitPointsCallback(this.hitPoints);
  }

  setMaxHitPoints(maxHitPoints) {
    this.maxHitPoints = maxHitPoints;
  }

  setOrientation(orientation) {
    this.orientation = orientation;
  }

  onRequestPath(callback) {
    this.requestPathCallback = callback;
  }

  onStartPathing(callback) {
    this.startPathingCallback = callback;
  }

  onStopPathing(callback) {
    this.stopPathingCallback = callback;
  }

  onBeforeStep(callback) {
    this.beforeStepCallback = callback;
  }

  onStep(callback) {
    this.stepCallback = callback;
  }

  onSecondStep(callback) {
    this.secondStepCallback = callback;
  }

  onMove(callback) {
    this.moveCallback = callback;
  }

  onHitPoints(callback) {
    this.hitPointsCallback = callback;
  }
}
