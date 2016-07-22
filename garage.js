var fs = require("fs");
var util = require("util");
var gpioPath = "/sys/class/gpio";

function gpio(pin, param, value) {
	try {
		var path = util.format("%s/gpio%s/%s", gpioPath, pin, param);
		fs.writeFileSync(path, value);
		return true;
	}
	catch (err) {
		return err.message;
	}
}

module.exports = {

	metrics: {
		lastOpenedDoor: "No",
		lastOpenedBy: "Nobody",
		lastOpenedAt: 0,
		deniedAttempts: 0
	},

	exportPins: function() {
		for (var name in global.config.pins) {
			var pin = global.config.pins[name];
			try {
				fs.writeFileSync(gpioPath + "/export", pin);
				var result = false;
				var tries = 5000;
				// https://github.com/fivdi/onoff/blob/master/onoff.js#L90
				while (result !== true) {
					result = gpio(pin, "direction", "out");
					tries -= 1;
					if (tries === 0) {
						throw new Error(result);
					}
				}
			}
			catch (err) {
				return err.message;
			}
		}
		return true;
	},

	unexportPins: function() {
		for (var name in global.config.pins) {
			var pin = global.config.pins[name];
			try {
				fs.writeFileSync(gpioPath + "/unexport", pin);
			}
			catch (err) {
				// Do nothing
			}
		}
	},

	paths: function() {
		/*
			Example regex: '/toggle/(left|right)'
		*/
		var pins = Object.keys(global.config.pins).join("|");
		var paths = new RegExp("\/toggle/\(" + pins + ")");
		return paths;
	},

	authenticate: function(req, res, next) {
		var ip = req.headers['x-forwarded-for'] ||
     req.connection.remoteAddress ||
     req.socket.remoteAddress ||
     req.connection.socket.remoteAddress; // http://stackoverflow.com/a/19524949
		var user = global.config.users[req.headers.user];
		if(user !== undefined && req.headers.key == user.key) {
			console.log("Granted request to", req.path(), "from", req.headers.user, "(", ip, ")");
			next();
		}
		else {
			module.exports.metrics.deniedAttempts++;
			console.log("Denied request to", req.path(), "from", ip);
			res.send(401, "Forbidden");
		}
	},

	toggle: function(req, res, next) {
		module.exports.metrics.lastOpenedDoor = req.params[0];
		module.exports.metrics.lastOpenedBy = req.headers.user;
		module.exports.metrics.lastOpenedAt = Math.floor(new Date() / 1000);
		var pin = global.config.pins[req.params[0]];
		console.log("Toggling", req.params[0], "door");
		gpio(pin, "value", "1");
		setTimeout(gpio, 1000, pin, "value", "0");
		res.send(200, "Done");
		return next();
	}
};
