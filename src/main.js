"use strict";

var Server = require("./server.js")
var config = JSON.parse(require("fs").readFileSync("config.json", "utf8"))
var events = ["uncaughtException", "SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGTRAP", "SIGABRT",
  "SIGBUS", "SIGFPE", "SIGUSR1", "SIGSEGV", "SIGUSR2", "SIGTERM"]

var server = new Server(config)

events.forEach(function (event) {
  process.on(event, function() {
    server.stop(event)
    // Wait a second for reason to get logged
    setTimeout(function() {
      process.exit(1)
    }, 500)
  })
})
server.start()
