/*
	HOW THIS WORKS

*/

exports.Proxy = function(opts) {
	if (!opts) throw new Error("No options provided!");
	if (typeof opts === "string" || opts instanceof String) {
		var url = require("url").parse(opts);
		opts = {
			port: url.port || 80,
			host: url.hostname,
			method: "GET",
			path: url.pathname + (url.search ? url.search : "")
		};
	}
	var serverHeaders = null;
	var clients = [];
	var stream = require("http").request(opts);
	stream.end(); // Send the request
	stream.on("response", function(res) {
		serverHeaders = res.headers;
		res.setEncoding("binary");
		res.on("data", function(chunk) {
			for (var i = clients.length; i--;) {
				clients[i].write(chunk, "binary");
			}
		});
	});
	this.requestHandler = function(req, res) {
		res.writeHead(200, {
			"Expires": "Mon, 01 Jul 1980 00:00:00 GMT",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Content-Type": serverHeaders["content-type"]
		});
		clients.push(res);
		res.socket.on("close", function() {
			clients.splice(clients.indexOf(res), 1);
		});
	};
};
