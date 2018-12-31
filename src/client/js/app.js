import $ from "jquery";
import Modules from "./utils/modules";
import log from "./lib/log";
import Detect from "./utils/detect";

export default class App {
  constructor() {
    const self = this;

    log.info("Loading the main application...");

    self.config = null;

    self.body = $("body");
    self.wrapper = $("#content");
    self.container = $("#container");
    self.window = $(window);
    self.canvas = $("#canvasLayers");
    self.border = $("#border");

    self.intro = $("#modal");

    self.loginButton = $("#loginButton");
    self.createButton = $("#play");
    self.registerButton = $("#newCharacter");
    self.helpButton = $("#helpButton");
    self.cancelButton = $("#cancelButton");
    self.yes = $("#yes");
    self.no = $("#no");
    self.loading = $(".loader");
    self.loadingMsg = $(".loader.message");
    self.errorMsg = $(".error.message");

    self.respawn = $("#respawn");

    self.rememberMe = $("#rememberMe");
    self.guest = $("#guest");

    self.about = $("#toggle-about");
    self.credits = $("#toggle-credits");
    self.git = $("#toggle-git");

    self.loginFields = [$("#loginNameInput"), $("#loginPasswordInput")];

    self.registerFields = [];

    self.game = null;
    self.guestLogin = false;
    self.zoomFactor = 1;

    self.loggingIn = false;

    self.sendStatus("You should turn back now...");

    self.zoom();
    self.updateOrientation();
    self.load();
  }

  load() {
    const self = this;

    self.loginButton.click(function() {
      self.login();
    });

    self.createButton.click(function() {
      self.login();
    });

    self.registerButton.click(function() {
      self.openScroll("loadCharacter", "createCharacter");
    });

    self.cancelButton.click(function() {
      self.openScroll("createCharacter", "loadCharacter");
    });

    self.wrapper.click(function() {
      if (
        self.wrapper.hasClass("about") ||
        self.wrapper.hasClass("credits") ||
        self.wrapper.hasClass("git")
      ) {
        self.wrapper.removeClass("about credits git");
        self.displayScroll("loadCharacter");
      }
    });

    self.about.click(function() {
      self.displayScroll("about");
    });

    self.credits.click(function() {
      self.displayScroll("credits");
    });

    self.git.click(function() {
      self.displayScroll("git");
    });

    // dismissing the welcome screen
    const welcomeContinue = function() {
      if (!self.game) return;

      // hide the welcome screen so it doesn't appear again
      self.game.storage.data.welcome = false;
      self.game.storage.save();

      self.body.removeClass("welcomeMessage");
    };

    self.yes.click(welcomeContinue);
    self.no.click(welcomeContinue);

    self.rememberMe.click(function() {
      if (!self.game || !self.game.storage) return;

      const active = self.rememberMe.hasClass("active");

      self.rememberMe.toggleClass("active");

      self.game.storage.toggleRemember(!active);
    });

    self.guest.click(function() {
      if (!self.game) return;

      self.guestLogin = true;
      self.login();
    });

    self.respawn.click(function() {
      if (!self.game || !self.game.player || !self.game.player.dead) return;

      self.game.respawn();
    });

    window.scrollTo(0, 1);

    self.window.resize(function() {
      self.zoom();
    });

    $.getJSON("data/config.json", function(json) {
      self.config = json;

      if (self.readyCallback) self.readyCallback();
    });

    $(document).bind("keydown", function(e) {
      if (e.which === Modules.Keys.Enter) return false;
    });

    $(document).keydown(function(e) {
      const key = e.which;

      if (!self.game) return;

      self.body.focus();

      if (key === Modules.Keys.Enter && !self.game.started) {
        self.login();
        return;
      }

      if (self.game.started) self.game.onInput(Modules.InputType.Key, key);
    });

    $(document).keyup(function(e) {
      const key = e.which;

      if (!self.game || !self.game.started) return;

      self.game.input.keyUp(key);
    });

    $(document).mousemove(function(event) {
      if (!self.game || !self.game.input || !self.game.started) return;

      self.game.input.setCoords(event);
      self.game.input.moveCursor();
    });

    self.canvas.click(function(event) {
      if (!self.game || !self.game.started || event.button !== 0) return;

      window.scrollTo(0, 1);

      self.game.input.handle(Modules.InputType.LeftClick, event);
    });

    $('input[type="range"]').on("input", function() {
      self.updateRange($(this));
    });
  }

  login() {
    const self = this;

    if (
      self.loggingIn ||
      !self.game ||
      !self.game.loaded ||
      self.statusMessage ||
      !self.verifyForm()
    )
      return;

    self.toggleLogin(true);
    self.game.connect();
  }

  zoom() {
    const self = this;

    const containerWidth = self.container.width(),
      containerHeight = self.container.height(),
      windowWidth = self.window.width(),
      windowHeight = self.window.height(),
      zoomFactor = windowWidth / containerWidth;

    if (containerHeight + 50 >= windowHeight) {
      zoomFactor = windowHeight / (containerHeight + 50);
    }

    if (self.getScaleFactor() === 3) zoomFactor -= 0.1;

    self.body.css({
      zoom: zoomFactor,
      "-moz-transform": "scale(" + zoomFactor + ")"
    });

    self.border.css("top", 0);

    self.zoomFactor = zoomFactor;
  }

  fadeMenu() {
    const self = this;

    self.updateLoader(null);

    setTimeout(() => {
      self.body.addClass("game");
      self.body.addClass("started");
      self.body.removeClass("intro");
    }, 500);
  }

  showMenu() {
    const self = this;

    self.body.removeClass("game");
    self.body.removeClass("started");
    self.body.addClass("intro");
  }

  showDeath() {}

  openScroll(origin, destination) {
    const self = this;

    console.log("open scroll", origin, destination);

    if (!destination || self.loggingIn) return;

    self.cleanErrors();
    // self.wrapper.removeClass(origin).addClass(destination);
    $("#" + origin).css("display", "none");
    $("#" + destination).css("display", "block");
  }

  displayScroll(content) {
    const self = this,
      state = self.wrapper.attr("class");

    if (self.game.started) {
      self.wrapper.removeClass().addClass(content);

      self.body.removeClass("credits legal about").toggleClass(content);

      if (self.game.player) self.body.toggleClass("death");

      if (content !== "about") self.helpButton.removeClass("active");
    } else if (state !== "animate")
      self.openScroll(state, state === content ? "loadCharacter" : content);
  }

  verifyForm() {
    const self = this,
      activeForm = self.getActiveForm();

    if (activeForm === "null") {
      return;
    }

    switch (activeForm) {
      case "loadCharacter":
        const nameInput = $("#loginNameInput"),
          passwordInput = $("#loginPasswordInput");

        if (self.loginFields.length === 0)
          self.loginFields = [nameInput, passwordInput];

        if (!nameInput.val() && !self.isGuest()) {
          self.sendError(nameInput, "Please enter a username.");
          return false;
        }

        if (!passwordInput.val() && !self.isGuest()) {
          self.sendError(passwordInput, "Please enter a password.");
          return false;
        }

        break;

      case "createCharacter":
        const characterName = $("#registerNameInput"),
          registerPassword = $("#registerPasswordInput"),
          registerPasswordConfirmation = $(
            "#registerPasswordConfirmationInput"
          ),
          email = $("#registerEmailInput");

        if (self.registerFields.length === 0)
          self.registerFields = [
            characterName,
            registerPassword,
            registerPasswordConfirmation,
            email
          ];

        if (!characterName.val()) {
          self.sendError(characterName, "A username is necessary you silly.");
          return false;
        }

        if (!registerPassword.val()) {
          self.sendError(registerPassword, "You must enter a password.");
          return false;
        }

        if (registerPasswordConfirmation.val() !== registerPassword.val()) {
          self.sendError(
            registerPasswordConfirmation,
            "The passwords do not match!"
          );
          return false;
        }

        if (!email.val() || !self.verifyEmail(email.val())) {
          self.sendError(email, "An email is required!");
          return false;
        }

        break;
    }

    return true;
  }

  verifyEmail(email) {
    return /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
      email
    );
  }

  sendStatus(message) {
    const self = this;

    self.cleanErrors();

    self.statusMessage = message;

    if (!message) {
      self.loadingMsg.html("");
      self.loading.hide();
      return;
    }

    self.loading.show();
    self.loadingMsg.html(message);
  }

  sendError(field, error) {
    this.cleanErrors();
    console.log("Error: " + error);

    this.errorMsg.html(error);
    this.errorMsg.show();

    if (!field) return;

    field.addClass("field-error").select();
    field.bind("keypress", function(event) {
      field.removeClass("field-error");

      $(".validation-error").remove();

      $(this).unbind(event);
    });
  }

  cleanErrors() {
    const self = this,
      activeForm = self.getActiveForm(),
      fields =
        activeForm === "loadCharacter" ? self.loginFields : self.registerFields;

    for (let i = 0; i < fields.length; i++)
      fields[i].removeClass("field-error");

    $(".validation-error").remove();
    $(".status").remove();
  }

  getActiveForm() {
    return this.wrapper[0].className;
  }

  isRegistering() {
    return this.getActiveForm() === "createCharacter";
  }

  isGuest() {
    return this.guestLogin;
  }

  resize() {
    const self = this;

    if (self.game) self.game.resize();
  }

  setGame(game) {
    this.game = game;
  }

  hasWorker() {
    return !!window.Worker;
  }

  getScaleFactor() {
    const width = window.innerWidth,
      height = window.innerHeight;

    /**
     * These are raw scales, we can adjust
     * for up-scaled rendering in the actual
     * rendering file.
     */

    return width <= 1000 ? 1 : width <= 1500 || height <= 870 ? 2 : 3;
  }

  revertLoader() {
    this.updateLoader("Connecting to server...");
  }

  updateLoader(message) {
    const self = this;

    if (!message) {
      self.loading.hide();
      self.loadingMsg.html("");
      return;
    }

    self.loading.show();
    self.loadingMsg.html(message);
  }

  toggleLogin(toggle) {
    log.info("Logging in: " + toggle);

    const self = this;

    self.revertLoader();

    self.toggleTyping(toggle);

    self.loggingIn = toggle;

    if (toggle) {
      self.loading.hide();

      self.loginButton.addClass("disabled");
      self.registerButton.addClass("disabled");
    } else {
      self.loading.hide();

      self.loginButton.removeClass("disabled");
      self.registerButton.removeClass("disabled");
    }
  }

  toggleTyping(state) {
    const self = this;

    if (self.loginFields)
      _.each(self.loginFields, function(field) {
        field.prop("readonly", state);
      });

    if (self.registerFields)
      _.each(self.registerFields, function(field) {
        field.prop("readOnly", state);
      });
  }

  updateRange(obj) {
    const self = this,
      val = (obj.val() - obj.attr("min")) / (obj.attr("max") - obj.attr("min"));

    obj.css(
      "background-image",
      "-webkit-gradient(linear, left top, right top, " +
        "color-stop(" +
        val +
        ", #4d4d4d), " +
        "color-stop(" +
        val +
        ", #C5C5C5)" +
        ")"
    );
  }

  updateOrientation() {
    this.orientation = this.getOrientation();
  }

  getOrientation() {
    return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
  }

  getZoom() {
    return this.zoomFactor;
  }

  onReady(callback) {
    this.readyCallback = callback;
  }

  isMobile() {
    return this.getScaleFactor() < 2;
  }

  isTablet() {
    return Detect.isIpad() || (Detect.isAndroid() && this.getScaleFactor() > 1);
  }
}