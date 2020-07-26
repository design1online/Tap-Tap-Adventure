import _ from 'underscore';
import log from '../util/log';
import Messages from '../network/messages';
import Packets from '../network/packets';

export default class Commands {
  constructor(player) {
    this.world = player.world;
    this.player = player;
  }

  parse(rawText) {
    const blocks = rawText.substring(1).split(' ');

    if (blocks.length < 1) {
      return;
    }

    const command = blocks.shift();

    this.handlePlayerCommands(command, blocks);

    if (this.player.rights > 0) {
      this.handleModeratorCommands(command, blocks);
    }

    if (this.player.rights > 1) {
      this.handleAdminCommands(command, blocks);
    }
  }

  handlePlayerCommands(command, blocks) {
    switch (command) {
      default:
        break;
      case 'players':
        this.player.send(
          new Messages.Notification(
            Packets.NotificationOpcode.Text,
            `There are currently ${this.world.getPopulation()} online.`,
          ),
        );

        break;

      case 'tutstage':
        console.log('tutorial stage', this.player.getTutorial());
        console.log(this.player.getTutorial().stage);
        break;

      case 'coords':
        this.player.send(
          new Messages.Notification(
            Packets.NotificationOpcode.Text,
            `x: ${this.player.x} y: ${this.player.y}`,
          ),
        );

        break;

      case 'progress':
        const tutorialQuest = this.player.getTutorial(); // eslint-disable-line

        this.player.send(
          new Messages.Quest(Packets.QuestOpcode.Progress, {
            id: tutorialQuest.id,
            stage: tutorialQuest.stage,
          }),
        );

        break;

      case 'global':
        this.world.pushBroadcast(
          new Messages.Chat({
            name: this.player.username,
            text: blocks.join(' '),
            isGlobal: true,
            withBubble: false,
            colour: 'rgba(191, 191, 63, 1.0)',
          }),
        );

        break;
    }
  }

  handleModeratorCommands(command, blocks) {
    switch (command) {
      default:
        break;
      case 'mute':
      case 'ban':
        let duration = blocks.shift(); // eslint-disable-line
        const targetName = blocks.join(' '); // eslint-disable-line
        const user = this.world.getPlayerByName(targetName); // eslint-disable-line

        if (!user) return;

        if (!duration) {
          duration = 24;
        }

        const timeFrame = new Date().getTime() + duration * 60 * 60; // eslint-disable-line

        if (command === 'mute') user.mute = timeFrame;
        else if (command === 'ban') {
          user.ban = timeFrame;
          user.save();

          user.sendUTF8('ban');
          user.connection.close('banned');
        }

        user.save();

        break;

      case 'unmute':
        const uTargetName = blocks.join(' '); // eslint-disable-line
        const uUser = this.world.getPlayerByName(uTargetName); // eslint-disable-line

        if (!uTargetName) return;

        uUser.mute = new Date().getTime() - 3600;

        uUser.save();

        break;
    }
  }

  handleAdminCommands(command, blocks) {
    switch (command) {
      default:
        break;
      case 'spawn':
        const spawnId = parseInt(blocks.shift()); // eslint-disable-line
        const count = parseInt(blocks.shift()); // eslint-disable-line
        const ability = parseInt(blocks.shift(), 10); // eslint-disable-line
        const abilityLevel = parseInt(blocks.shift()); // eslint-disable-line

        if (!spawnId || !count) return;

        this.player.inventory.add({
          id: spawnId,
          count,
          ability: ability || -1,
          abilityLevel: abilityLevel || -1,
        });

        return;

      case 'maxhealth':
        this.player.notify(
          `Max health is ${this.player.hitPoints.getMaxHitPoints()}`,
        );

        break;

      case 'ipban':
        return;

      case 'drop':
        const id = parseInt(blocks.shift(), 10); // eslint-disable-line
        let dCount = parseInt(blocks.shift()); // eslint-disable-line

        if (!id) return;

        if (!dCount) dCount = 1;

        this.world.dropItem(id, dCount, this.player.x, this.player.y);

        return;

      case 'ghost':
        this.player.equip('ghost', 1, -1, -1);

        return;

      case 'notify':
        this.player.notify('Hello!!!');

        break;

      case 'teleport':
        const x = parseInt(blocks.shift()); // eslint-disable-line
        const y = parseInt(blocks.shift()); // eslint-disable-line

        if (x && y) this.player.teleport(x, y);

        break;

      case 'teletome':
        const username = blocks.join(' '); // eslint-disable-line
        const player = this.world.getPlayerByName(username); // eslint-disable-line

        if (player) {
          player.teleport(this.player.x, this.player.y);
        }

        break;

      case 'nohit':
        this.player.invincible = !this.player.invincible;
        break;

      case 'mob':
        const npcId = parseInt(blocks.shift()); // eslint-disable-line

        this.world.spawnMob(npcId, this.player.x, this.player.y);

        break;

      case 'pointer':
        const posX = parseInt(blocks.shift()); // eslint-disable-line
        const posY = parseInt(blocks.shift()); // eslint-disable-line

        if (!posX || !posY) return;

        this.player.send(
          new Messages.Pointer(Packets.PointerOpcode.Location, {
            id: this.player.instance,
            x: posX,
            y: posY,
          }),
        );

        break;

      case 'teleall':
        _.each(this.world.players, (character) => {
          character.teleport(this.character.x, this.character.y);
        });

        break;

      case 'attackaoe':
        let radius = parseInt(blocks.shift()); // eslint-disable-line

        if (!radius) radius = 1;

        this.player.combat.dealAoE(radius);

        break;

      case 'addexp':
        const exp = parseInt(blocks.shift()); // eslint-disable-line

        if (!exp) return;

        this.player.addExperience(exp);

        break;
    }
  }
}
