var package = require("./package.json");
var restify = require("restify");
var fs = require("fs");
var garage = require("./garage");
var proxy = require("./express-mjpeg-proxy").Proxy;
global.config = package.config; // Config is accessible from any module now

// Any console logs with have a timestamp prefix now
require("log-prefix")(function() {
	var d = new Date();
	return require("util").format("[%d/%d/%d %d:%d:%d] %%s",
		d.getMonth() + 1, // 0 is January
		d.getDate(),
		d.getFullYear(),
		d.getHours(),
		d.getMinutes(),
		d.getSeconds()
	);
});

console.log("Establishing exit event handlers...");
process.on("uncaughtException", function(err) {
	garage.unexportPins();
	console.log("UNCAUGHT EXCEPTION!");
	console.log(err.message);
	console.log(err.stack);
	process.exit(1);
});
process.on("SIGINT", function() {
	garage.unexportPins();
	console.log("Exiting.");
	process.exit(0);
});

console.log("Creating server...");
try {
	var server = restify.createServer({
		"name": "Doorman v" + package.version,
		"key": fs.readFileSync(global.config.SSL.key),
		"certificate": fs.readFileSync(global.config.SSL.cert)
	});
} catch (err) {
	throw new Error("Couldn't create server: " + err.message);
}

console.log("Exporting pins...");
garage.unexportPins();
var result = garage.exportPins();
if (result !== true) {
	throw new Error("Couldn't export pins: " + result);
}

console.log("Establishing paths...");
server.use(garage.authenticate);
server.get("/", function(req, res, next) {
	res.setHeader("content-type", "application/json");
	res.send(garage.metrics);
	next();
});
server.get(garage.paths(), garage.toggle);
var url = global.config["livestream-url"];
server.get("/cam", new proxy(url).requestHandler);

console.log("Launching server...");
server.listen(global.config.port, function() {
	console.log("Server up");
});
