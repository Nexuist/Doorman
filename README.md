### Introduction

Doorman is a node.js web server that provides an interface to toggling garage doors in real life. It is intended to run off a Raspberry Pi.

Doorman provides the following features:

* HTTPS support
* Authentication via header parameters
* Configurable options in `package.json` (remain even when the package is upgraded)
* MJPEG proxying from insecure IP cameras
* Only two dependencies
* User system so multiple family members can authenticate
* Metrics such as number of denied attempts and last time opened

A companion iOS app is provided [here](https://github.com/Nexuist/Doorman-Remote). Because the API (see below) is very simple, support for Doorman can easily be extended to many Internet platforms.

### Installation

First, [assemble your hardware]() (Coming soon).

The following steps should be executed on a Raspberry Pi. They have been tested on a fresh version of Debian Jessie Lite.

1. `npm install nexuist/doorman` This will download the Doorman package into your current directory.

2. `npm install forever -g` [Forever]() is another NPM package that will monitor the server and ensure it remains up 24/7. The `-g` flag will install it globally so it can be accessed fron the command line.

3. Edit the configuration in `package.json` (see Configuration below).

4. Now we want to make sure that the server will execute as soon as the Raspberry Pi boots up. [RaspberryPi.org](https://www.raspberrypi.org/documentation/linux/usage/rc-local.md) suggests we put all startup commands in /etc/rc.local. Append this to your /etc/rc.local (make sure it comes before exit 0):
		
		cd $DIRECTORY
		sudo -u pi /usr/local/bin/forever start main.js &

	Replace `$DIRECTORY` with your Doorman directory (i.e. /home/pi/Doorman).
	`sudo -u pi` will ensure that the command is not run as root (running any web server as root is ill advised) and `forever start main.js` will begin running the server under forever's supervision. The ampersand at the end will make the process run in the background so that the Raspberry Pi can continue its boot process.

	>**IMPORTANT:** Do not remove `exit 0` from /etc/rc.local! The Pi may get stuck and never finish booting up.

5. (Optional) forever also supports logging console output to a file. You can enable it by adding more command line arguments:
		sudo -u pi /usr/local/bin/forever -a -l $LOGPATH start main.js &

	Replace `$LOGPATH` with the your log file path (i.e. /home/pi/Doorman.log). `-a` will append output to your log (so it is not overridden between restarts) and `-l` will redirect all console output (STDOUT and STDERR) into $LOGPATH.

6. (Optional) You may also want to log the console output of /etc/rc.local itself. This way, if forever fails to start Doorman, you can know. Add these lines before `cd $DIRECTORY`:
		exec 2> $STARTLOGPATH
		exec 1>&2
		set -x
	Replace `$STARTLOGPATH` with your startup log file path (i.e. /home/pi/Startup.log). It's not a good idea to use the same log for /etc/rc.local and Doorman because you will run into problems if both processes attempt to write into the file at the same time. The `exec` commands will redirect STDERR and STDOUT from /etc/rc.local into `$STARTUPLOGPATH` and `set -x` will make sure every command is printed before it is executed.

7. Restart the Pi. The server should now launch.

### Configuration

The server can be configured in the `config` section of `package.json`. Here is what each key means:

* `port` The port the web server should listen to.
* `pins` A dictionary containing a mapping of pin names to pin numbers. The name will become an API endpoint (see API below) when the server finishes launching.
> **IMPORTANT:** Doorman uses the original BCM GPIO pin mappings. See [this article](http://wiringpi.com/pins/) from wiringPi for more information.
* `livestream-url` This should be a URL to an MJPEG stream (such as an IP camera) accessible to the server. This field is not required, but if it is left empty the server will not expose a /cam endpoint (see API below).
* `users` A dictionary containing users and keys that the server will use to authenticate new requests.
* `SSL` A dictionary containing file paths to an SSL key and certificate used by the server. If left empty, the server will not use SSL. Not recommended!

### API

###### Authentication

Every request made to the server must have two headers:

* `User` Containing a valid name in the `users` dictionary.
* `Key` Containing a valid key corresponding to the user.

If the request does not contain either of these headers, or they are invalid, the server will return a 401 Forbidden response.

###### Endpoints

* `/toggle/<pin name>` When a request is made to this endpoint, the GPIO pin will be set to HIGH and then LOW again.
	* ex. `/toggle/left`


* `/` This path will return a JSON dictionary with the following values:
	* `lastOpenedDoor` The name of the last pin toggled.
	* `lastOpenedBy` The user who toggled it.
	* `lastOpenedAt` A UNIX timestamp corresponding to the time the pin was toggled.
	* `deniedAttempts` The amount of requests that the server did not process because they failed to authenticate properly.

* `/cam` If `livestream-url` has a value in the configuration, this endpoint will proxy an MJPEG stream from that URL. This is useful if you have an insecure IP camera that you don't want to expose to the Internet, but still want to be able to view its stream in a secure manner.

### Logging

Doorman also logs several events using STDOUT. Using forever you can redirect this output into a text file that can be analyzed in the future (see above). The following events are logged:
* Startup
* Uncaught exceptions
* SIGINT
* Request accepted/denied, including the IP address and username of the requester and the path they were trying to access
* GPIO toggles

### Next Steps

* Notifications when the garage is toggled

The previous (non-public) version of Doorman actually had this feature (using https://mailgun.com), but it was removed in this version so I could focus on core functionality. Adding it back wouldn't be that hard, and would give meaning to the `contact` field in the users dictionary.

### License

```
MIT License

Copyright (c) 2016 Andi Andreas

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
