"use strict";

var exec = require("child_process").exec

var self = null

/**
 *  This class's responsibilites:
    * Turn GPIO pins on and off through the command line
    * Thus, toggling the garage doors
 **/
module.exports = class Garage {
  constructor() {
    self = this
    self.leftPin = 0
    self.rightPin = 6
  }

  toggle(door, callback) {
    var pin = (door == 1) ? self.leftPin : self.rightPin
    var cmd = "gpio mode pin out; gpio write pin 1; sleep 1; gpio write pin 0"
    cmd = cmd.replace(/gpio/g, "/usr/local/bin/gpio")
    cmd = cmd.replace(/pin/g, pin)
    exec(cmd, function(err, stdout, stderr) {
      if (err !== null) {
        var msg = "err: " + err + " stderr: " + stderr
        callback(false, msg)
      }
      else {
        callback(true, null)
      }
    })
  }
}
