define(['jquery', '../renderer/pointers/pointer'], function($, Pointer) {
  return Class.extend({

    init(game) {
      var self = this;

      self.game = game;
      self.pointers = {};
      self.scale = self.getScale();
      self.container = $('#bubbles');
    },

    create(id, type) {
      var self = this;

      if (id in self.pointers) {
        return;
      }

      var element = $('<div id="' + id + '" class="pointer"></div>');

      self.setSize(element);

      self.container.append(element);

      self.pointers[id] = new Pointer(id, element, type);
    },

    resize() {
      var self = this;

      _.each(self.pointers, function(pointer) {

        switch (pointer.type) {
          case Modules.Pointers.Relative:
            var scale = self.getScale(),
              x = pointer.x,
              y = pointer.y,
              offsetX = 0,
              offsetY = 0;

            if (scale === 1) {
              offsetX = pointer.element.width() / 2 + 5;
              offsetY = pointer.element.height() / 2 - 4;
            }

            pointer.element.css('left', (x * scale) - offsetX + 'px');
            pointer.element.css('top', (y * scale) - offsetY + 'px');
            break;
        }
      });
    },

    setSize(element) {
      var self = this;
      var width = 8;
      var height = width + (width * .2);
      var image = 'url("img/common/hud-active.png")';

      self.updateScale();

      element.css({
        'width': (width * self.scale) + 'px',
        'height': (height * self.scale) + 'px',
        'margin': 'inherit',
        'margin-top': '-' + ((height / 2) * self.scale) + 'px',
        'margin-left': '1px',
        'top': (height * self.scale) + 'px',
        'background': image,
        'background-size': '100% 100%',
      });
    },

    clean() {
      var self = this;

      _.each(self.pointers, function(pointer) {
        pointer.destroy();
      });

      self.pointers = {};
    },

    destroy(pointer) {
      var self = this;

      delete self.pointers[pointer.id];
      pointer.destroy();
    },

    set(pointer, posX, posY) {
      var self = this;

      self.updateScale();
      self.updateCamera();

      var tileSize = 16 * self.scale,
        x = ((posX - self.camera.x) * self.scale),
        width = parseInt(pointer.element.css('width') + 24),
        offset = (width / 2) - (tileSize / 2),
        y;

      y = ((posY - self.camera.y) * self.scale) - tileSize;

      pointer.element.css('left', (x - offset) + 'px');
      pointer.element.css('top', y + 'px');
    },

    setToEntity(entity) {
      var self = this,
        pointer = self.get(entity.id);

      if (!pointer)
        return;

      console.log('set to entity', entity);

      self.set(pointer, entity.x, entity.y);
    },

    setToPosition(id, x, y) {
      var self = this,
        pointer = self.get(id);

      if (!pointer) {
        return;
      }

      pointer.setPosition(x, y);

      self.set(pointer, x, y);
    },

    setRelative(id, x, y) {
      var self = this,
        pointer = self.get(id);

      if (!pointer) {
        return;
      }

      var scale = self.getScale(),
        offsetX = 0,
        offsetY = 0;

      /**
       * Must be set in accordance to the lowest scale.
       */

      if (scale === 1) {
        offsetX = pointer.element.width() / 2 + 5;
        offsetY = pointer.element.height() / 2 - 4;
      }

      pointer.setPosition(x, y);

      pointer.element.css('left', (x * scale) - offsetX + 'px');
      pointer.element.css('top', (y * scale) - offsetY + 'px');
    },

    update() {
      var self = this;

      _.each(self.pointers, function(pointer) {

        switch (pointer.type) {
          case Modules.Pointers.Entity:

            var entity = self.game.entities.get(pointer.id);

            if (entity) {
              self.setToEntity(entity);
            } else {
              self.destroy(pointer);
            }
            break;

          case Modules.Pointers.Position:
            if (pointer.x !== -1 && pointer.y !== -1) {
              self.set(pointer, pointer.x, pointer.y);
            }
            break;
        }
      });
    },

    get(id) {
      var self = this;

      if (id in self.pointers) {
        return self.pointers[id];
      }

      return null;
    },

    updateScale() {
      this.scale = this.getDrawingScale();
    },

    updateCamera() {
      this.camera = this.game.renderer.camera;
    },

    getScale() {
      return this.game.getScaleFactor();
    },

    getDrawingScale() {
      return this.game.renderer.getDrawingScale();
    }
  });
});