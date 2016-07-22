var restify = require("restify");
var crypto = require("crypto");
var exec = require("child_process").exec;
var fs = require("fs");
var pb = require("pushbullet");
pb = new pb("[REDACTED]"); // PushBullet auth token
var loggingOptions = {
  logFilePath: "/home/pi/http/garage.log",
  timestampFormat: "MM-DD HH:mm:ss"
}
var log = require("simple-node-logger").createSimpleFileLogger(loggingOptions);

var key = "[REDACTED]"; // Key used to encrypt timestamps
var live = true; // If this is set to false the GPIO pins will never actually be manipulated

function sendPush(text) {
  function pbResult(error, response) {
    if (error) {
      log.error("Message couldn't be sent to PushBullet: '", text, "'")
    }
  }
  var andi = "[REDACTED]"; // ID for Andi's iPhone
  var cimi = "[REDACTED]";
  pb.note(andi, "Garage - " + text, "", pbResult);
  pb.note(cimi, "Garage - " + text, "", pbResult);
}

function toggleDoor(door) {
  if (live != true) {
    log.info("Door ", door, " not toggled - LIVE mode OFF")
    sendPush("Door " + door + " not toggled - LIVE mode OFF")
    return;
  }
  var pin = (door == 1) ? 0 : 6; // GPIO6, handles left door
  var command = "gpio mode pin out; gpio write pin 1; sleep 1; gpio write pin 0";
  command = command.replace(/gpio/g, "/usr/local/bin/gpio");
  command = command.replace(/pin/g, pin);
  var attempt = exec(command,
  function (error, stdout, stderr) {
    if (error !== null) {
      log.error(error);
      log.error(stderr);
      sendPush(error + " | " + stderrr);
    }
    else {
      log.info("Toggled door " + door);
    }
  });
}

function legitimateRequest(req) {
  var ip = req.connection.remoteAddress;
  var url = req.url;
  var timestamp = req.params[1];
  var signature = req.params[2];
  // First let's make sure the timestamp is properly signed to prevent unauthorized access
  var hashedTimestamp = crypto.createHmac("sha256", key).update(timestamp).digest("hex");
  if (hashedTimestamp != signature) {
    // The hashes don't match up
    log.warn("Hash mismatch from " + ip + " | " + url);
    //sendPush("Hash mismatch from " + ip);
    return false;
  }
  // The request is genuine. Now we want to validate the timestamp to prevent replay attacks
  var currentTimestamp = Math.round(+new Date()/1000); // Gives us the UNIX timestamp in seconds
  var timeWindow = 3; // The amount of time the request has to get to the server before it is invalidated
  if (!(timestamp < (currentTimestamp + timeWindow) && timestamp > (currentTimestamp - timeWindow))) {
    // The timestamp is not within the accepted range
    log.warn("Timestamp mismatch from " + ip + " | " + url);
    //sendPush("Timestamp mismatch from " + ip);
    return false;
  }
  else {
    // Success!
    return true;
  }
}

function handleDoorRequest(req, res, next) {
  var door = req.params[0];
  if (legitimateRequest(req)) {
    toggleDoor(door);
    res.send(200, "OK");
    return next();
  }
  else {
    res.send(401, "Nope");
    return next();
  }
}

function handleCamRequest(req, res, next) {
  if (legitimateRequest(req)) {
    var command = "curl admin:[REDACTED]@[REDACTED]:99/snapshot.cgi > /home/pi/http/snapshot.jpeg";
    var attempt = exec(command,
    function (error, stdout, stderr) {
      if (error !== null) {
        log.error(error);
        log.error(stderr);
        sendPush(error + " | " + stderrr);
        res.send(500, "Fail");
      }
      else {
        res.writeHead(200, {"Content-Type": "image/jpeg"});
        var img  = fs.readFileSync("/home/pi/http/snapshot.jpeg");
        res.end(img, "binary");
      }
      next();
    });
  }
  else {
    res.send(401, "Nope");
    return next();
  }
}

function handleVersionRequest(req, res, next) {
  var version = "1.2";
  res.send(version);
  next();
}

var server = restify.createServer({"name": "GarageServer v1.0"});
server.get(/\/toggle\/([12])\/(\S[0-9]*)\/(\S[0-9A-Fa-f]*)/, handleDoorRequest);
/*
/toggle/DOOR/TIMESTAMP/SIGNATURE

DOOR can only be 1 or 2.
TIMESTAMP can be any number of characters as long as they are all numeric.
SIGNATURE only accepts hexadecimal.

*/
server.get("/", handleVersionRequest);
server.get(/\/cam\/([1])\/(\S[0-9]*)\/(\S[0-9A-Fa-f]*)/, handleCamRequest);

server.listen(6060, function() {
  log.info("Server ready to accept requests");
});
