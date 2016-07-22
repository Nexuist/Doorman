"use strict";

var FileSystem = require("fs");
var Logger = require("simple-node-logger")
var Garage = require("./garage.js")
var Restify = require("restify")
var MJPEGProxy = require("mjpeg-proxy").MjpegProxy
var Mailgun = require("mailgun").Mailgun

var self = null // Used to access Server class from within request methods
/**
 * This class's responsibilites:
    * Handle server startup & shutdown
  * Authenticate requests
    * Interact with mjpegProxy to complete camera stream requests
    * Interact with Garage to complete toggle requests
    * Log authentication and toggle attempts
 **/

module.exports = class Server {
  constructor(config) {
    self = this
    // Garage
    self.garage = new Garage()
    // State variables
    self.owner = config.owner
    self.others = config.others
    self.email = config.serverEmail
    self.deliveryServer = config.mailgunDeliveryServer
    self.address = config.serverAddress
    self.port = config.serverPort
    // Metrics logging
    self.metrics = {
      version: config.serverVersion,
      startTime: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      lastOpenedBy: "Nobody",
      lastOpenedTimestamp: 0,
      errors: 0
    }
    // File logging
    self.log = new Logger.createSimpleFileLogger({
      logFilePath: config.logFile,
      timestampFormat: "MM-DD HH:mm:ss"
    })
    // Mail logging
    self.mailman = new Mailgun(config.mailgunAPIKey)
    // Restify instance
    self.instance = Restify.createServer({
      "name": config.serverName,
      "key": FileSystem.readFileSync(config.SSL.keyFile, "utf8"),
      "certificate": FileSystem.readFileSync(config.SSL.certFile, "utf8")
    })
    // Configure paths and authentication
    self.instance.use(self.authenticateRequest)
    self.instance.get("/", self.handleMetricsRequest)
    self.instance.get(/\/toggle\/([12])/, self.handleToggleRequest)
    self.instance.get("/cam", new MJPEGProxy(config.camURI).proxyRequest) // MJPEGProxy handles streaming
  }

  sendMail(to, msg) {
    self.mailman.sendText(self.email, to, "Garage", msg, self.deliveryServer, {}, function (error) {
      if (error) {
        self.log.error("Attempting to send email: ", error)
      }
    })
  }

  start() {
    // Server startup
    self.instance.listen(self.port, self.address, function() {
      self.metrics.startTime = Date(Date.now())
      var msg = "Server up"
      self.log.info(msg)
      self.sendMail(self.owner.contact, msg)
    })
  }

  userFromKey(key) {
    if (key in self.others) {
      return self.others[key].name
    }
    if (key == self.owner.key) {
      return self.owner.name
    }
    return null
  }

  authenticateRequest(req, res, next) {
    var key = req.headers.authorization
    var user = self.userFromKey(key)
    if (user !== null) {
      self.metrics.successfulAttempts++
      self.log.info("Accepted request to ", req.url, " from ", user, " (", req.connection.remoteAddress, ")")
      next()
    }
    else {
      self.metrics.failedAttempts++
      var msg = "Denied request to " + req.url + " from " + req.connection.remoteAddress
      self.log.warn(msg)
      self.sendMail(self.owner.contact, msg)
      res.send(401, "Forbidden")
    }
  }

  handleToggleRequest(req, res, next) {
    var door = req.params[0]
    var user = self.userFromKey(req.headers.authorization)
    var msg = null
    self.garage.toggle(door, function(success, error) {
      if (success) {
        self.metrics.lastOpenedBy = user
        self.metrics.lastOpenedTimestamp = Math.round(+new Date() / 1000)
        msg = "Door " + door + " toggled by " + user
        self.log.info(msg)
        self.sendMail(self.owner.contact, msg)
        res.send(200, "Success")
      }
      else {
        self.metrics.errors++
        msg = "Attempting to toggle door " + door + ": " + error
        self.log.error(msg)
        self.sendMail(self.owner.contact, msg)
        res.send(500, "Failed")
      }
    })
  }

  handleMetricsRequest(req, res, next) {
    // Serve metrics
    res.setHeader("Content-Type", "application/json")
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "X-Requested-With")
    res.send(self.metrics)
    next()
  }

  stop(reason) {
    // Server shutdown
    self.log.error("Server going down because of ", reason)
  }

}
