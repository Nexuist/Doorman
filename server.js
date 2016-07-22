// Dependencies
var restify = require("restify")
var fs = require("fs")
var mjpegProxy = require("mjpeg-proxy").MjpegProxy
var exec = require("child_process").exec
var mailgun = require("mailgun")
var node_logger = require("simple-node-logger")

// Constants
var MAILGUN_API_KEY = "[REDACTED]"
var LOG_FILE_PATH = "garage.log"
var SERVER_VERSION = "2.0"
var SERVER_SSL_KEY = fs.readFileSync("pi.key")
var SERVER_SSL_CERT = fs.readFileSync("pi.crt")
var CAM_URI = "http://admin:[REDACTED]@[REDACTED]:99/videostream.cgi"
var KEYS = {
  "[REDACTED]": {
    name: "Mom",
    email: "[REDACTED]@mms.att.net"
  },
  "[REDACTED]": {
    name: "Dad",
    email: "[REDACTED]@mms.att.net"
  },
  "[REDACTED]": {
    name: "Andi",
    email: "[REDACTED]@mms.att.net"
  }
}
var GARAGE_EMAIL = "[REDACTED]"
var ANDI_EMAIL = KEYS["[REDACTED]"]["email"]
var EMAILS = []
for (key in KEYS) {
  EMAILS.push(key["email"])
}

// Logging
var mail = new mailgun.Mailgun(MAILGUN_API_KEY)
var logger = new node_logger.createSimpleFileLogger({
  logFilePath: LOG_FILE_PATH,
  timestampFormat: "MM-DD HH:mm:ss"
})

function mailAndi(subject, text) {
  mail.sendText(GARAGE_EMAIL, ANDI_EMAIL, subject, text, function (err) {
    if (err) {
      logger.error("Error sending mail: " + err)
    }
  })
}

function mailAll(subject, text) {
  mail.sendText(GARAGE_EMAIL, EMAILS, subject, text, function (err) {
    if (err) {
      logger.error("Error sending mail: " + err)
    }
  })
}


logger.warn = function() {
  var args = Array.prototype.slice.call(arguments)
  logger.log("warn", args)
  mailAndi("Warning", args.join(" "))
}

logger.error = function() {
  var args = Array.prototype.slice.call(arguments)
  logger.log("error", args)
  mailAndi("Error", args.join(" "))
}

// Static variables
var lastOpenedBy = "Nobody"
var lastOpenedTimestamp = 0

// Endpoints
function metadata(req, res, next) {
  var metadata = {
    version: SERVER_VERSION,
    lastOpenedBy: lastOpenedBy,
    lastOpenedTimestamp: lastOpenedTimestamp
  }
  res.send(metadata)
  next()
}

function toggle(req, res, next) {
  var pin = (req.params[0] == 1) ? 0 : 6 // GPIO6 handles left door
  var cmd = "gpio mode pin out; gpio write pin 1; sleep 1; gpio write pin 0";
  cmd = cmd.replace(/gpio/g, "/usr/local/bin/gpio");
  cmd = cmd.replace(/pin/g, pin);
  exec(cmd, function(err, stdout, stderr) {
    if (err !== null) {
      logger.error("GPIO Error: ", err)
      logger.error("GPIO STDERR: ", stderr)
      res.send(500, "Failed")
    } else {
      // Success
      lastOpenedBy = KEYS[req.headers["authorization"]]
      lastOpenedTimestamp = Math.round(+new Date() / 1000)
      var text = "Door " + door + " toggled by " + lastOpenedBy
      logger.info(text)
      mailAll("Door Toggled", text)
      res.send(200, "Success")
  }
  next()
  })
}

function authenticate(req, res, next) {
  if (req.headers["authorization"] in KEYS) {
    next()
  }
  else {
    logger.warn("Denied attempt from ", req.connection.remoteAddress)
    res.send(401, "Forbidden")
  }
}

// Server
var server = restify.createServer({
  name: "GarageServer v" + SERVER_VERSION,
  key: SERVER_SSL_KEY,
  certificate: SERVER_SSL_CERT
})


server.use(authenticate) // All endpoints after this require authentication
server.get("/metadata", metadata)
server.get(/\/toggle\/([12])/, toggle)
server.get("/cam", new mjpegProxy(CAM_URI).proxyRequest)

server.listen(6060, function() {
  logger.info("Ready to accept requests")
  mailAndi("Server Up", "Ready to accept requests")
})
