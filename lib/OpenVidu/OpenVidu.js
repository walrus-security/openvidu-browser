"use strict";
/*
 * (C) Copyright 2017-2020 OpenVidu (https://openvidu.io)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
exports.__esModule = true;
var LocalRecorder_1 = require("./LocalRecorder");
var Publisher_1 = require("./Publisher");
var Session_1 = require("./Session");
var StreamPropertyChangedEvent_1 = require("../OpenViduInternal/Events/StreamPropertyChangedEvent");
var OpenViduError_1 = require("../OpenViduInternal/Enums/OpenViduError");
var VideoInsertMode_1 = require("../OpenViduInternal/Enums/VideoInsertMode");
var OpenViduLogger_1 = require("../OpenViduInternal/Logger/OpenViduLogger");
var screenSharingAuto = require("../OpenViduInternal/ScreenSharing/Screen-Capturing-Auto");
var screenSharing = require("../OpenViduInternal/ScreenSharing/Screen-Capturing");
/**
 * @hidden
 */
var EventEmitter = require("wolfy87-eventemitter");
/**
 * @hidden
 */
var RpcBuilder = require("../OpenViduInternal/KurentoUtils/kurento-jsonrpc");
/**
 * @hidden
 */
var platform = require("platform");
platform['isIonicIos'] = (platform.product === 'iPhone' || platform.product === 'iPad') && platform.ua.indexOf('Safari') === -1;
platform['isIonicAndroid'] = platform.os.family === 'Android' && platform.name == "Android Browser";
/**
 * @hidden
 */
var packageJson = require('../../package.json');
/**
 * @hidden
 */
var logger = OpenViduLogger_1.OpenViduLogger.getInstance();
/**
 * Entrypoint of OpenVidu Browser library.
 * Use it to initialize objects of type [[Session]], [[Publisher]] and [[LocalRecorder]]
 */
var OpenVidu = /** @class */ (function () {
    function OpenVidu() {
        var _this = this;
        /**
         * @hidden
         */
        this.publishers = [];
        /**
         * @hidden
         */
        this.secret = '';
        /**
         * @hidden
         */
        this.recorder = false;
        /**
         * @hidden
         */
        this.advancedConfiguration = {};
        /**
         * @hidden
         */
        this.webrtcStatsInterval = 0;
        /**
         * @hidden
         */
        this.ee = new EventEmitter();
        this.libraryVersion = packageJson.version;
        logger.info("'OpenVidu' initialized");
        logger.info("openvidu-browser version: " + this.libraryVersion);
        if (platform.os.family === 'iOS' || platform.os.family === 'Android') {
            // Listen to orientationchange only on mobile devices
            window.addEventListener('orientationchange', function () {
                _this.publishers.forEach(function (publisher) {
                    if (publisher.stream.isLocalStreamPublished && !!publisher.stream && !!publisher.stream.hasVideo && !!publisher.stream.streamManager.videos[0]) {
                        var attempts_1 = 0;
                        var oldWidth_1 = publisher.stream.videoDimensions.width;
                        var oldHeight_1 = publisher.stream.videoDimensions.height;
                        var getNewVideoDimensions_1 = function () {
                            return new Promise(function (resolve, reject) {
                                if (platform['isIonicIos']) {
                                    // iOS Ionic. Limitation: must get new dimensions from an existing video element already inserted into DOM
                                    resolve({
                                        newWidth: publisher.stream.streamManager.videos[0].video.videoWidth,
                                        newHeight: publisher.stream.streamManager.videos[0].video.videoHeight
                                    });
                                }
                                else {
                                    // Rest of platforms
                                    // New resolution got from different places for Chrome and Firefox. Chrome needs a videoWidth and videoHeight of a videoElement.
                                    // Firefox needs getSettings from the videoTrack
                                    var firefoxSettings = publisher.stream.getMediaStream().getVideoTracks()[0].getSettings();
                                    var newWidth = ((platform.name.toLowerCase().indexOf('firefox') !== -1) ? firefoxSettings.width : publisher.videoReference.videoWidth);
                                    var newHeight = ((platform.name.toLowerCase().indexOf('firefox') !== -1) ? firefoxSettings.height : publisher.videoReference.videoHeight);
                                    resolve({ newWidth: newWidth, newHeight: newHeight });
                                }
                            });
                        };
                        var repeatUntilChange_1 = setInterval(function () {
                            getNewVideoDimensions_1().then(function (newDimensions) {
                                sendStreamPropertyChangedEvent_1(oldWidth_1, oldHeight_1, newDimensions.newWidth, newDimensions.newHeight);
                            });
                        }, 75);
                        var sendStreamPropertyChangedEvent_1 = function (oldWidth, oldHeight, newWidth, newHeight) {
                            attempts_1++;
                            if (attempts_1 > 10) {
                                clearTimeout(repeatUntilChange_1);
                            }
                            if (newWidth !== oldWidth || newHeight !== oldHeight) {
                                publisher.stream.videoDimensions = {
                                    width: newWidth || 0,
                                    height: newHeight || 0
                                };
                                _this.sendRequest('streamPropertyChanged', {
                                    streamId: publisher.stream.streamId,
                                    property: 'videoDimensions',
                                    newValue: JSON.stringify(publisher.stream.videoDimensions),
                                    reason: 'deviceRotated'
                                }, function (error, response) {
                                    if (error) {
                                        logger.error("Error sending 'streamPropertyChanged' event", error);
                                    }
                                    else {
                                        _this.session.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.session, publisher.stream, 'videoDimensions', publisher.stream.videoDimensions, { width: oldWidth, height: oldHeight }, 'deviceRotated')]);
                                        publisher.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(publisher, publisher.stream, 'videoDimensions', publisher.stream.videoDimensions, { width: oldWidth, height: oldHeight }, 'deviceRotated')]);
                                    }
                                });
                                clearTimeout(repeatUntilChange_1);
                            }
                        };
                    }
                });
            });
        }
    }
    /**
     * Returns new session
     */
    OpenVidu.prototype.initSession = function () {
        this.session = new Session_1.Session(this);
        return this.session;
    };
    /**
     * Returns a new publisher
     *
     * #### Events dispatched
     *
     * The [[Publisher]] object will dispatch an `accessDialogOpened` event, only if the pop-up shown by the browser to request permissions for the camera is opened. You can use this event to alert the user about granting permissions
     * for your website. An `accessDialogClosed` event will also be dispatched after user clicks on "Allow" or "Block" in the pop-up.
     *
     * The [[Publisher]] object will dispatch an `accessAllowed` or `accessDenied` event once it has been granted access to the requested input devices or not.
     *
     * The [[Publisher]] object will dispatch a `videoElementCreated` event once a HTML video element has been added to DOM (only if you
     * [let OpenVidu take care of the video players](/en/stable/cheatsheet/manage-videos/#let-openvidu-take-care-of-the-video-players)). See [[VideoElementEvent]] to learn more.
     *
     * The [[Publisher]] object will dispatch a `streamPlaying` event once the local streams starts playing. See [[StreamManagerEvent]] to learn more.
     *
     * @param targetElement  HTML DOM element (or its `id` attribute) in which the video element of the Publisher will be inserted (see [[PublisherProperties.insertMode]]). If *null* or *undefined* no default video will be created for this Publisher.
     * You can always call method [[Publisher.addVideoElement]] or [[Publisher.createVideoElement]] to manage the video elements on your own (see [Manage video players](/en/stable/cheatsheet/manage-videos) section)
     * @param completionHandler `error` parameter is null if `initPublisher` succeeds, and is defined if it fails.
     *                          `completionHandler` function is called before the Publisher dispatches an `accessAllowed` or an `accessDenied` event
     */
    OpenVidu.prototype.initPublisher = function (targetElement, param2, param3) {
        var properties;
        if (!!param2 && (typeof param2 !== 'function')) {
            // Matches 'initPublisher(targetElement, properties)' or 'initPublisher(targetElement, properties, completionHandler)'
            properties = param2;
            properties = {
                audioSource: (typeof properties.audioSource !== 'undefined') ? properties.audioSource : undefined,
                frameRate: (typeof MediaStreamTrack !== 'undefined' && properties.videoSource instanceof MediaStreamTrack) ? undefined : ((typeof properties.frameRate !== 'undefined') ? properties.frameRate : undefined),
                insertMode: (typeof properties.insertMode !== 'undefined') ? ((typeof properties.insertMode === 'string') ? VideoInsertMode_1.VideoInsertMode[properties.insertMode] : properties.insertMode) : VideoInsertMode_1.VideoInsertMode.APPEND,
                mirror: (typeof properties.mirror !== 'undefined') ? properties.mirror : true,
                publishAudio: (typeof properties.publishAudio !== 'undefined') ? properties.publishAudio : true,
                publishVideo: (typeof properties.publishVideo !== 'undefined') ? properties.publishVideo : true,
                resolution: (typeof MediaStreamTrack !== 'undefined' && properties.videoSource instanceof MediaStreamTrack) ? undefined : ((typeof properties.resolution !== 'undefined') ? properties.resolution : '640x480'),
                videoSource: (typeof properties.videoSource !== 'undefined') ? properties.videoSource : undefined,
                filter: properties.filter
            };
        }
        else {
            // Matches 'initPublisher(targetElement)' or 'initPublisher(targetElement, completionHandler)'
            properties = {
                insertMode: VideoInsertMode_1.VideoInsertMode.APPEND,
                mirror: true,
                publishAudio: true,
                publishVideo: true,
                resolution: '640x480'
            };
        }
        var publisher = new Publisher_1.Publisher(targetElement, properties, this);
        var completionHandler;
        if (!!param2 && (typeof param2 === 'function')) {
            completionHandler = param2;
        }
        else if (!!param3) {
            completionHandler = param3;
        }
        publisher.initialize()
            .then(function () {
            if (completionHandler !== undefined) {
                completionHandler(undefined);
            }
            publisher.emitEvent('accessAllowed', []);
        })["catch"](function (error) {
            if (completionHandler !== undefined) {
                completionHandler(error);
            }
            publisher.emitEvent('accessDenied', [error]);
        });
        this.publishers.push(publisher);
        return publisher;
    };
    OpenVidu.prototype.initPublisherAsync = function (targetElement, properties) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var publisher;
            var callback = function (error) {
                if (!!error) {
                    reject(error);
                }
                else {
                    resolve(publisher);
                }
            };
            if (!!properties) {
                publisher = _this.initPublisher(targetElement, properties, callback);
            }
            else {
                publisher = _this.initPublisher(targetElement, callback);
            }
        });
    };
    /**
     * Returns a new local recorder for recording streams straight away from the browser
     * @param stream  Stream to record
     */
    OpenVidu.prototype.initLocalRecorder = function (stream) {
        return new LocalRecorder_1.LocalRecorder(stream);
    };
    /**
     * Checks if the browser supports OpenVidu
     * @returns 1 if the browser supports OpenVidu, 0 otherwise
     */
    OpenVidu.prototype.checkSystemRequirements = function () {
        return 1;
        var browser = platform.name;
        var family = platform.os.family;
        var userAgent = !!platform.ua ? platform.ua : navigator.userAgent;
        if (this.isIPhoneOrIPad(userAgent)) {
            if (this.isIOSWithSafari(userAgent)) {
                return 1;
            }
            return 0;
        }
        // Accept: Chrome (desktop and Android), Firefox (desktop and Android), Opera (desktop and Android),
        // Safari (OSX and iOS), Ionic (Android and iOS), Samsung Internet Browser (Android)
        if ((browser === 'Safari') ||
            (browser === 'Chrome') || (browser === 'Chrome Mobile') ||
            (browser === 'Firefox') || (browser === 'Firefox Mobile') ||
            (browser === 'Opera') || (browser === 'Opera Mobile') ||
            (browser === 'Android Browser') || (browser === 'Electron') ||
            (browser === 'Samsung Internet Mobile') || (browser === 'Samsung Internet')) {
            return 1;
        }
        // Reject iPhones and iPads if not Safari ('Safari' also covers Ionic for iOS)
        // Reject others browsers not mentioned above
        return 0;
    };
    /**
     * Checks if the browser supports screen-sharing. Desktop Chrome, Firefox and Opera support screen-sharing
     * @returns 1 if the browser supports screen-sharing, 0 otherwise
     */
    OpenVidu.prototype.checkScreenSharingCapabilities = function () {
        var browser = platform.name;
        var version = (platform === null || platform === void 0 ? void 0 : platform.version) ? parseFloat(platform.version) : -1;
        var family = platform.os.family;
        // Reject mobile devices
        if (family === 'iOS' || family === 'Android') {
            return 0;
        }
        if ((browser !== 'Chrome') && (browser !== 'Firefox') && (browser !== 'Opera') && (browser !== 'Electron') &&
            (browser === 'Safari' && version < 13)) {
            return 0;
        }
        else {
            return 1;
        }
    };
    /**
     * Collects information about the media input devices available on the system. You can pass property `deviceId` of a [[Device]] object as value of `audioSource` or `videoSource` properties in [[initPublisher]] method
     */
    OpenVidu.prototype.getDevices = function () {
        return new Promise(function (resolve, reject) {
            navigator.mediaDevices.enumerateDevices().then(function (deviceInfos) {
                var _a;
                var devices = [];
                // Ionic Android  devices
                if (platform['isIonicAndroid'] && typeof cordova != "undefined" && ((_a = cordova === null || cordova === void 0 ? void 0 : cordova.plugins) === null || _a === void 0 ? void 0 : _a.EnumerateDevicesPlugin)) {
                    cordova.plugins.EnumerateDevicesPlugin.getEnumerateDevices().then(function (pluginDevices) {
                        var pluginAudioDevices = [];
                        var videoDevices = [];
                        var audioDevices = [];
                        pluginAudioDevices = pluginDevices.filter(function (device) { return device.kind === 'audioinput'; });
                        videoDevices = deviceInfos.filter(function (device) { return device.kind === 'videoinput'; });
                        audioDevices = deviceInfos.filter(function (device) { return device.kind === 'audioinput'; });
                        videoDevices.forEach(function (deviceInfo, index) {
                            if (!deviceInfo.label) {
                                var label = "";
                                if (index === 0) {
                                    label = "Front Camera";
                                }
                                else if (index === 1) {
                                    label = "Back Camera";
                                }
                                else {
                                    label = "Unknown Camera";
                                }
                                devices.push({
                                    kind: deviceInfo.kind,
                                    deviceId: deviceInfo.deviceId,
                                    label: label
                                });
                            }
                            else {
                                devices.push({
                                    kind: deviceInfo.kind,
                                    deviceId: deviceInfo.deviceId,
                                    label: deviceInfo.label
                                });
                            }
                        });
                        audioDevices.forEach(function (deviceInfo, index) {
                            if (!deviceInfo.label) {
                                var label = "";
                                switch (index) {
                                    case 0: // Default Microphone
                                        label = 'Default';
                                        break;
                                    case 1: // Microphone + Speakerphone
                                        var defaultMatch = pluginAudioDevices.filter(function (d) { return d.label.includes('Built'); })[0];
                                        label = defaultMatch ? defaultMatch.label : 'Built-in Microphone';
                                        break;
                                    case 2: // Headset Microphone
                                        var wiredMatch = pluginAudioDevices.filter(function (d) { return d.label.includes('Wired'); })[0];
                                        if (wiredMatch) {
                                            label = wiredMatch.label;
                                        }
                                        else {
                                            label = 'Headset earpiece';
                                        }
                                        break;
                                    case 3:
                                        var wirelessMatch = pluginAudioDevices.filter(function (d) { return d.label.includes('Bluetooth'); })[0];
                                        label = wirelessMatch ? wirelessMatch.label : 'Wireless';
                                        break;
                                    default:
                                        label = "Unknown Microphone";
                                        break;
                                }
                                devices.push({
                                    kind: deviceInfo.kind,
                                    deviceId: deviceInfo.deviceId,
                                    label: label
                                });
                            }
                            else {
                                devices.push({
                                    kind: deviceInfo.kind,
                                    deviceId: deviceInfo.deviceId,
                                    label: deviceInfo.label
                                });
                            }
                        });
                        resolve(devices);
                    });
                }
                else {
                    // Rest of platforms
                    deviceInfos.forEach(function (deviceInfo) {
                        if (deviceInfo.kind === 'audioinput' || deviceInfo.kind === 'videoinput') {
                            devices.push({
                                kind: deviceInfo.kind,
                                deviceId: deviceInfo.deviceId,
                                label: deviceInfo.label
                            });
                        }
                    });
                    resolve(devices);
                }
            })["catch"](function (error) {
                logger.error('Error getting devices', error);
                reject(error);
            });
        });
    };
    /**
     * Get a MediaStream object that you can customize before calling [[initPublisher]] (pass _MediaStreamTrack_ property of the _MediaStream_ value resolved by the Promise as `audioSource` or `videoSource` properties in [[initPublisher]])
     *
     * Parameter `options` is the same as in [[initPublisher]] second parameter (of type [[PublisherProperties]]), but only the following properties will be applied: `audioSource`, `videoSource`, `frameRate`, `resolution`
     *
     * To customize the Publisher's video, the API for HTMLCanvasElement is very useful. For example, to get a black-and-white video at 10 fps and HD resolution with no sound:
     * ```
     * var OV = new OpenVidu();
     * var FRAME_RATE = 10;
     *
     * OV.getUserMedia({
     *    audioSource: false,
     *    videoSource: undefined,
     *    resolution: '1280x720',
     *    frameRate: FRAME_RATE
     * })
     * .then(mediaStream => {
     *
     *    var videoTrack = mediaStream.getVideoTracks()[0];
     *    var video = document.createElement('video');
     *    video.srcObject = new MediaStream([videoTrack]);
     *
     *    var canvas = document.createElement('canvas');
     *    var ctx = canvas.getContext('2d');
     *    ctx.filter = 'grayscale(100%)';
     *
     *    video.addEventListener('play', () => {
     *      var loop = () => {
     *        if (!video.paused && !video.ended) {
     *          ctx.drawImage(video, 0, 0, 300, 170);
     *          setTimeout(loop, 1000/ FRAME_RATE); // Drawing at 10 fps
     *        }
     *      };
     *      loop();
     *    });
     *    video.play();
     *
     *    var grayVideoTrack = canvas.captureStream(FRAME_RATE).getVideoTracks()[0];
     *    var publisher = this.OV.initPublisher(
     *      myHtmlTarget,
     *      {
     *        audioSource: false,
     *        videoSource: grayVideoTrack
     *      });
     * });
     * ```
     */
    OpenVidu.prototype.getUserMedia = function (options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var askForAudioStreamOnly = function (previousMediaStream, constraints) {
                var definedAudioConstraint = ((constraints.audio === undefined) ? true : constraints.audio);
                var constraintsAux = { audio: definedAudioConstraint, video: false };
                navigator.mediaDevices.getUserMedia(constraintsAux)
                    .then(function (audioOnlyStream) {
                    previousMediaStream.addTrack(audioOnlyStream.getAudioTracks()[0]);
                    resolve(previousMediaStream);
                })["catch"](function (error) {
                    previousMediaStream.getAudioTracks().forEach(function (track) {
                        track.stop();
                    });
                    previousMediaStream.getVideoTracks().forEach(function (track) {
                        track.stop();
                    });
                    reject(_this.generateAudioDeviceError(error, constraintsAux));
                });
            };
            _this.generateMediaConstraints(options).then(function (myConstraints) {
                var _a, _b;
                if (!!myConstraints.videoTrack && !!myConstraints.audioTrack ||
                    !!myConstraints.audioTrack && ((_a = myConstraints.constraints) === null || _a === void 0 ? void 0 : _a.video) === false ||
                    !!myConstraints.videoTrack && ((_b = myConstraints.constraints) === null || _b === void 0 ? void 0 : _b.audio) === false) {
                    // No need to call getUserMedia at all. Both tracks provided, or only AUDIO track provided or only VIDEO track provided
                    resolve(_this.addAlreadyProvidedTracks(myConstraints, new MediaStream()));
                }
                else {
                    // getUserMedia must be called. AUDIO or VIDEO are requesting a new track
                    // Delete already provided constraints for audio or video
                    if (!!myConstraints.videoTrack) {
                        delete myConstraints.constraints.video;
                    }
                    if (!!myConstraints.audioTrack) {
                        delete myConstraints.constraints.audio;
                    }
                    var mustAskForAudioTrackLater_1 = false;
                    if (typeof options.videoSource === 'string') {
                        // Video is deviceId or screen sharing
                        if (options.videoSource === 'screen' ||
                            options.videoSource === 'window' ||
                            (platform.name === 'Electron' && options.videoSource.startsWith('screen:'))) {
                            // Video is screen sharing
                            mustAskForAudioTrackLater_1 = !myConstraints.audioTrack && (options.audioSource !== null && options.audioSource !== false);
                            if (navigator.mediaDevices['getDisplayMedia'] && platform.name !== 'Electron') {
                                // getDisplayMedia supported
                                navigator.mediaDevices['getDisplayMedia']({ video: true })
                                    .then(function (mediaStream) {
                                    _this.addAlreadyProvidedTracks(myConstraints, mediaStream);
                                    if (mustAskForAudioTrackLater_1) {
                                        askForAudioStreamOnly(mediaStream, myConstraints.constraints);
                                        return;
                                    }
                                    else {
                                        resolve(mediaStream);
                                    }
                                })["catch"](function (error) {
                                    var errorName = OpenViduError_1.OpenViduErrorName.SCREEN_CAPTURE_DENIED;
                                    var errorMessage = error.toString();
                                    reject(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                                });
                                return;
                            }
                            else {
                                // getDisplayMedia NOT supported. Can perform getUserMedia below with already calculated constraints
                            }
                        }
                        else {
                            // Video is deviceId. Can perform getUserMedia below with already calculated constraints
                        }
                    }
                    // Use already calculated constraints
                    var constraintsAux = mustAskForAudioTrackLater_1 ? { video: myConstraints.constraints.video } : myConstraints.constraints;
                    navigator.mediaDevices.getUserMedia(constraintsAux)
                        .then(function (mediaStream) {
                        _this.addAlreadyProvidedTracks(myConstraints, mediaStream);
                        if (mustAskForAudioTrackLater_1) {
                            askForAudioStreamOnly(mediaStream, myConstraints.constraints);
                            return;
                        }
                        else {
                            resolve(mediaStream);
                        }
                    })["catch"](function (error) {
                        var errorName;
                        var errorMessage = error.toString();
                        if (!(options.videoSource === 'screen')) {
                            errorName = OpenViduError_1.OpenViduErrorName.DEVICE_ACCESS_DENIED;
                        }
                        else {
                            errorName = OpenViduError_1.OpenViduErrorName.SCREEN_CAPTURE_DENIED;
                        }
                        reject(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                    });
                }
            })["catch"](function (error) {
                reject(error);
            });
        });
    };
    /* tslint:disable:no-empty */
    /**
     * Disable all logging except error level
     */
    OpenVidu.prototype.enableProdMode = function () {
        logger.enableProdMode();
    };
    /* tslint:enable:no-empty */
    /**
     * Set OpenVidu advanced configuration options. Currently `configuration` is an object with the following optional properties (see [[OpenViduAdvancedConfiguration]] for more details):
     * - `iceServers`: set custom STUN/TURN servers to be used by OpenVidu Browser
     * - `screenShareChromeExtension`: url to a custom screen share extension for Chrome to be used instead of the default one, based on ours [https://github.com/OpenVidu/openvidu-screen-sharing-chrome-extension](https://github.com/OpenVidu/openvidu-screen-sharing-chrome-extension)
     * - `publisherSpeakingEventsOptions`: custom configuration for the [[PublisherSpeakingEvent]] feature and the [StreamManagerEvent.streamAudioVolumeChange](/en/stable/api/openvidu-browser/classes/streammanagerevent.html) feature
     *
     * Call this method to override previous values at any moment.
     */
    OpenVidu.prototype.setAdvancedConfiguration = function (configuration) {
        this.advancedConfiguration = configuration;
    };
    /* Hidden methods */
    /**
     * @hidden
     */
    OpenVidu.prototype.generateMediaConstraints = function (publisherProperties) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var myConstraints = {
                audioTrack: undefined,
                videoTrack: undefined,
                constraints: {
                    audio: undefined,
                    video: undefined
                }
            };
            var audioSource = publisherProperties.audioSource;
            var videoSource = publisherProperties.videoSource;
            // CASE 1: null/false
            if (audioSource === null || audioSource === false) {
                // No audio track
                myConstraints.constraints.audio = false;
            }
            if (videoSource === null || videoSource === false) {
                // No video track
                myConstraints.constraints.video = false;
            }
            if (myConstraints.constraints.audio === false && myConstraints.constraints.video === false) {
                // ERROR! audioSource and videoSource cannot be both false at the same time
                reject(new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.NO_INPUT_SOURCE_SET, "Properties 'audioSource' and 'videoSource' cannot be set to false or null at the same time"));
            }
            // CASE 2: MediaStreamTracks
            if (typeof MediaStreamTrack !== 'undefined' && audioSource instanceof MediaStreamTrack) {
                // Already provided audio track
                myConstraints.audioTrack = audioSource;
            }
            if (typeof MediaStreamTrack !== 'undefined' && videoSource instanceof MediaStreamTrack) {
                // Already provided video track
                myConstraints.videoTrack = videoSource;
            }
            // CASE 3: Default tracks
            if (audioSource === undefined) {
                myConstraints.constraints.audio = true;
            }
            if (videoSource === undefined) {
                myConstraints.constraints.video = {
                    width: {
                        ideal: 640
                    },
                    height: {
                        ideal: 480
                    }
                };
            }
            // CASE 3.5: give values to resolution and frameRate if video not null/false
            if (videoSource !== null && videoSource !== false) {
                if (!!publisherProperties.resolution) {
                    var widthAndHeight = publisherProperties.resolution.toLowerCase().split('x');
                    var idealWidth = Number(widthAndHeight[0]);
                    var idealHeight = Number(widthAndHeight[1]);
                    myConstraints.constraints.video = {
                        width: {
                            ideal: idealWidth
                        },
                        height: {
                            ideal: idealHeight
                        }
                    };
                }
                if (!!publisherProperties.frameRate) {
                    myConstraints.constraints.video.frameRate = { ideal: publisherProperties.frameRate };
                }
            }
            // CASE 4: deviceId or screen sharing
            _this.configureDeviceIdOrScreensharing(myConstraints, publisherProperties, resolve, reject);
            resolve(myConstraints);
        });
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.startWs = function (onConnectSucces) {
        var config = {
            heartbeat: 5000,
            sendCloseMessage: false,
            ws: {
                uri: this.wsUri,
                onconnected: onConnectSucces,
                ondisconnect: this.disconnectCallback.bind(this),
                onreconnecting: this.reconnectingCallback.bind(this),
                onreconnected: this.reconnectedCallback.bind(this)
            },
            rpc: {
                requestTimeout: 10000,
                participantJoined: this.session.onParticipantJoined.bind(this.session),
                participantPublished: this.session.onParticipantPublished.bind(this.session),
                participantUnpublished: this.session.onParticipantUnpublished.bind(this.session),
                participantLeft: this.session.onParticipantLeft.bind(this.session),
                participantEvicted: this.session.onParticipantEvicted.bind(this.session),
                recordingStarted: this.session.onRecordingStarted.bind(this.session),
                recordingStopped: this.session.onRecordingStopped.bind(this.session),
                sendMessage: this.session.onNewMessage.bind(this.session),
                streamPropertyChanged: this.session.onStreamPropertyChanged.bind(this.session),
                filterEventDispatched: this.session.onFilterEventDispatched.bind(this.session),
                iceCandidate: this.session.recvIceCandidate.bind(this.session),
                mediaError: this.session.onMediaError.bind(this.session)
            }
        };
        this.jsonRpcClient = new RpcBuilder.clients.JsonRpcClient(config);
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.closeWs = function () {
        this.jsonRpcClient.close(4102, "Connection closed by client");
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.sendRequest = function (method, params, callback) {
        if (params && params instanceof Function) {
            callback = params;
            params = {};
        }
        logger.debug('Sending request: {method:"' + method + '", params: ' + JSON.stringify(params) + '}');
        this.jsonRpcClient.send(method, params, callback);
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.getWsUri = function () {
        return this.wsUri;
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.getSecret = function () {
        return this.secret;
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.getRecorder = function () {
        return this.recorder;
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.generateAudioDeviceError = function (error, constraints) {
        if (error.name === 'Error') {
            // Safari OverConstrainedError has as name property 'Error' instead of 'OverConstrainedError'
            error.name = error.constructor.name;
        }
        var errorName, errorMessage;
        switch (error.name.toLowerCase()) {
            case 'notfounderror':
                errorName = OpenViduError_1.OpenViduErrorName.INPUT_AUDIO_DEVICE_NOT_FOUND;
                errorMessage = error.toString();
                return new OpenViduError_1.OpenViduError(errorName, errorMessage);
            case 'notallowederror':
                errorName = OpenViduError_1.OpenViduErrorName.DEVICE_ACCESS_DENIED;
                errorMessage = error.toString();
                return new OpenViduError_1.OpenViduError(errorName, errorMessage);
            case 'overconstrainederror':
                if (error.constraint.toLowerCase() === 'deviceid') {
                    errorName = OpenViduError_1.OpenViduErrorName.INPUT_AUDIO_DEVICE_NOT_FOUND;
                    errorMessage = "Audio input device with deviceId '" + constraints.audio.deviceId.exact + "' not found";
                }
                else {
                    errorName = OpenViduError_1.OpenViduErrorName.PUBLISHER_PROPERTIES_ERROR;
                    errorMessage = "Audio input device doesn't support the value passed for constraint '" + error.constraint + "'";
                }
                return new OpenViduError_1.OpenViduError(errorName, errorMessage);
            case 'notreadableerror':
                errorName = OpenViduError_1.OpenViduErrorName.DEVICE_ALREADY_IN_USE;
                errorMessage = error.toString();
                return (new OpenViduError_1.OpenViduError(errorName, errorMessage));
            default:
                return new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.INPUT_AUDIO_DEVICE_GENERIC_ERROR, error.toString());
        }
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.addAlreadyProvidedTracks = function (myConstraints, mediaStream) {
        if (!!myConstraints.videoTrack) {
            mediaStream.addTrack(myConstraints.videoTrack);
        }
        if (!!myConstraints.audioTrack) {
            mediaStream.addTrack(myConstraints.audioTrack);
        }
        return mediaStream;
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.configureDeviceIdOrScreensharing = function (myConstraints, publisherProperties, resolve, reject) {
        var _this = this;
        var audioSource = publisherProperties.audioSource;
        var videoSource = publisherProperties.videoSource;
        if (typeof audioSource === 'string') {
            myConstraints.constraints.audio = { deviceId: { exact: audioSource } };
        }
        if (typeof videoSource === 'string') {
            if (!this.isScreenShare(videoSource)) {
                this.setVideoSource(myConstraints, videoSource);
            }
            else {
                // Screen sharing
                if (!this.checkScreenSharingCapabilities()) {
                    var error = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.SCREEN_SHARING_NOT_SUPPORTED, 'You can only screen share in desktop Chrome, Firefox, Opera, Safari (>=13.0) or Electron. Detected client: ' + platform.name);
                    logger.error(error);
                    reject(error);
                }
                else {
                    if (platform.name === 'Electron') {
                        var prefix = "screen:";
                        var videoSourceString = videoSource;
                        var electronScreenId = videoSourceString.substr(videoSourceString.indexOf(prefix) + prefix.length);
                        myConstraints.constraints.video = {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: electronScreenId
                            }
                        };
                        resolve(myConstraints);
                    }
                    else {
                        if (!!this.advancedConfiguration.screenShareChromeExtension && !(platform.name.indexOf('Firefox') !== -1) && !navigator.mediaDevices['getDisplayMedia']) {
                            // Custom screen sharing extension for Chrome (and Opera) and no support for MediaDevices.getDisplayMedia()
                            screenSharing.getScreenConstraints(function (error, screenConstraints) {
                                if (!!error || !!screenConstraints.mandatory && screenConstraints.mandatory.chromeMediaSource === 'screen') {
                                    if (error === 'permission-denied' || error === 'PermissionDeniedError') {
                                        var error_1 = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.SCREEN_CAPTURE_DENIED, 'You must allow access to one window of your desktop');
                                        logger.error(error_1);
                                        reject(error_1);
                                    }
                                    else {
                                        var extensionId = _this.advancedConfiguration.screenShareChromeExtension.split('/').pop().trim();
                                        screenSharing.getChromeExtensionStatus(extensionId, function (status) {
                                            if (status === 'installed-disabled') {
                                                var error_2 = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.SCREEN_EXTENSION_DISABLED, 'You must enable the screen extension');
                                                logger.error(error_2);
                                                reject(error_2);
                                            }
                                            if (status === 'not-installed') {
                                                var error_3 = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.SCREEN_EXTENSION_NOT_INSTALLED, _this.advancedConfiguration.screenShareChromeExtension);
                                                logger.error(error_3);
                                                reject(error_3);
                                            }
                                        });
                                        return;
                                    }
                                }
                                else {
                                    myConstraints.constraints.video = screenConstraints;
                                    resolve(myConstraints);
                                }
                            });
                            return;
                        }
                        else {
                            if (navigator.mediaDevices['getDisplayMedia']) {
                                // getDisplayMedia support (Chrome >= 72, Firefox >= 66, Safari >= 13)
                                resolve(myConstraints);
                            }
                            else {
                                // Default screen sharing extension for Chrome/Opera, or is Firefox < 66
                                var firefoxString = platform.name.indexOf('Firefox') !== -1 ? publisherProperties.videoSource : undefined;
                                screenSharingAuto.getScreenId(firefoxString, function (error, sourceId, screenConstraints) {
                                    if (!!error) {
                                        if (error === 'not-installed') {
                                            var extensionUrl = !!_this.advancedConfiguration.screenShareChromeExtension ? _this.advancedConfiguration.screenShareChromeExtension :
                                                'https://chrome.google.com/webstore/detail/openvidu-screensharing/lfcgfepafnobdloecchnfaclibenjold';
                                            var err = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.SCREEN_EXTENSION_NOT_INSTALLED, extensionUrl);
                                            logger.error(err);
                                            reject(err);
                                        }
                                        else if (error === 'installed-disabled') {
                                            var err = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.SCREEN_EXTENSION_DISABLED, 'You must enable the screen extension');
                                            logger.error(err);
                                            reject(err);
                                        }
                                        else if (error === 'permission-denied') {
                                            var err = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.SCREEN_CAPTURE_DENIED, 'You must allow access to one window of your desktop');
                                            logger.error(err);
                                            reject(err);
                                        }
                                        else {
                                            var err = new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.GENERIC_ERROR, 'Unknown error when accessing screen share');
                                            logger.error(err);
                                            logger.error(error);
                                            reject(err);
                                        }
                                    }
                                    else {
                                        myConstraints.constraints.video = screenConstraints.video;
                                        resolve(myConstraints);
                                    }
                                });
                                return;
                            }
                        }
                    }
                }
            }
        }
    };
    /**
     * @hidden
     */
    OpenVidu.prototype.setVideoSource = function (myConstraints, videoSource) {
        if (!myConstraints.constraints.video) {
            myConstraints.constraints.video = {};
        }
        myConstraints.constraints.video['deviceId'] = { exact: videoSource };
    };
    /* Private methods */
    OpenVidu.prototype.disconnectCallback = function () {
        logger.warn('Websocket connection lost');
        if (this.isRoomAvailable()) {
            this.session.onLostConnection('networkDisconnect');
        }
        else {
            alert('Connection error. Please reload page.');
        }
    };
    OpenVidu.prototype.reconnectingCallback = function () {
        logger.warn('Websocket connection lost (reconnecting)');
        if (!this.isRoomAvailable()) {
            alert('Connection error. Please reload page.');
        }
        else {
            this.session.emitEvent('reconnecting', []);
        }
    };
    OpenVidu.prototype.reconnectedCallback = function () {
        var _this = this;
        logger.warn('Websocket reconnected');
        if (this.isRoomAvailable()) {
            this.sendRequest('connect', { sessionId: this.session.connection.rpcSessionId }, function (error, response) {
                if (!!error) {
                    logger.error(error);
                    logger.warn('Websocket was able to reconnect to OpenVidu Server, but your Connection was already destroyed due to timeout. You are no longer a participant of the Session and your media streams have been destroyed');
                    _this.session.onLostConnection("networkDisconnect");
                    _this.jsonRpcClient.close(4101, "Reconnection fault");
                }
                else {
                    _this.jsonRpcClient.resetPing();
                    _this.session.onRecoveredConnection();
                }
            });
        }
        else {
            alert('Connection error. Please reload page.');
        }
    };
    OpenVidu.prototype.isRoomAvailable = function () {
        if (this.session !== undefined && this.session instanceof Session_1.Session) {
            return true;
        }
        else {
            logger.warn('Session instance not found');
            return false;
        }
    };
    OpenVidu.prototype.isScreenShare = function (videoSource) {
        return videoSource === 'screen' ||
            videoSource === 'window' ||
            (platform.name === 'Electron' && videoSource.startsWith('screen:'));
    };
    OpenVidu.prototype.isIPhoneOrIPad = function (userAgent) {
        var isTouchable = 'ontouchend' in document;
        var isIPad = /\b(\w*Macintosh\w*)\b/.test(userAgent) && isTouchable;
        var isIPhone = /\b(\w*iPhone\w*)\b/.test(userAgent) && /\b(\w*Mobile\w*)\b/.test(userAgent) && isTouchable;
        return isIPad || isIPhone;
    };
    OpenVidu.prototype.isIOSWithSafari = function (userAgent) {
        return /\b(\w*Apple\w*)\b/.test(navigator.vendor) && /\b(\w*Safari\w*)\b/.test(userAgent)
            && !/\b(\w*CriOS\w*)\b/.test(userAgent) && !/\b(\w*FxiOS\w*)\b/.test(userAgent);
    };
    return OpenVidu;
}());
exports.OpenVidu = OpenVidu;
//# sourceMappingURL=OpenVidu.js.map