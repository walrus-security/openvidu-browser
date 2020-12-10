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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var Session_1 = require("./Session");
var Stream_1 = require("./Stream");
var StreamManager_1 = require("./StreamManager");
var StreamEvent_1 = require("../OpenViduInternal/Events/StreamEvent");
var StreamPropertyChangedEvent_1 = require("../OpenViduInternal/Events/StreamPropertyChangedEvent");
var VideoElementEvent_1 = require("../OpenViduInternal/Events/VideoElementEvent");
var OpenViduError_1 = require("../OpenViduInternal/Enums/OpenViduError");
var platform = require("platform");
var OpenViduLogger_1 = require("../OpenViduInternal/Logger/OpenViduLogger");
/**
 * @hidden
 */
var logger = OpenViduLogger_1.OpenViduLogger.getInstance();
/**
 * Packs local media streams. Participants can publish it to a session. Initialized with [[OpenVidu.initPublisher]] method
 *
 * ### Available event listeners (and events dispatched)
 *
 * - accessAllowed
 * - accessDenied
 * - accessDialogOpened
 * - accessDialogClosed
 * - streamCreated ([[StreamEvent]])
 * - streamDestroyed ([[StreamEvent]])
 * - streamPropertyChanged ([[StreamPropertyChangedEvent]])
 */
var Publisher = /** @class */ (function (_super) {
    __extends(Publisher, _super);
    /**
     * @hidden
     */
    function Publisher(targEl, properties, openvidu) {
        var _this = _super.call(this, new Stream_1.Stream((!!openvidu.session) ? openvidu.session : new Session_1.Session(openvidu), { publisherProperties: properties, mediaConstraints: {} }), targEl) || this;
        /**
         * Whether the Publisher has been granted access to the requested input devices or not
         */
        _this.accessAllowed = false;
        /**
         * Whether you have called [[Publisher.subscribeToRemote]] with value `true` or `false` (*false* by default)
         */
        _this.isSubscribedToRemote = false;
        _this.accessDenied = false;
        _this.properties = properties;
        _this.openvidu = openvidu;
        _this.stream.ee.on('local-stream-destroyed', function (reason) {
            _this.stream.isLocalStreamPublished = false;
            var streamEvent = new StreamEvent_1.StreamEvent(true, _this, 'streamDestroyed', _this.stream, reason);
            _this.emitEvent('streamDestroyed', [streamEvent]);
            streamEvent.callDefaultBehavior();
        });
        return _this;
    }
    /**
     * Publish or unpublish the audio stream (if available). Calling this method twice in a row passing same value will have no effect
     *
     * #### Events dispatched
     *
     * > _Only if `Session.publish(Publisher)` has been called for this Publisher_
     *
     * The [[Session]] object of the local participant will dispatch a `streamPropertyChanged` event with `changedProperty` set to `"audioActive"` and `reason` set to `"publishAudio"`
     * The [[Publisher]] object of the local participant will also dispatch the exact same event
     *
     * The [[Session]] object of every other participant connected to the session will dispatch a `streamPropertyChanged` event with `changedProperty` set to `"audioActive"` and `reason` set to `"publishAudio"`
     * The respective [[Subscriber]] object of every other participant receiving this Publisher's stream will also dispatch the exact same event
     *
     * See [[StreamPropertyChangedEvent]] to learn more.
     *
     * @param value `true` to publish the audio stream, `false` to unpublish it
     */
    Publisher.prototype.publishAudio = function (value) {
        var _this = this;
        if (this.stream.audioActive !== value) {
            var affectedMediaStream = this.stream.displayMyRemote() ? this.stream.localMediaStreamWhenSubscribedToRemote : this.stream.getMediaStream();
            affectedMediaStream.getAudioTracks().forEach(function (track) {
                track.enabled = value;
            });
            if (!!this.session && !!this.stream.streamId) {
                this.session.openvidu.sendRequest('streamPropertyChanged', {
                    streamId: this.stream.streamId,
                    property: 'audioActive',
                    newValue: value,
                    reason: 'publishAudio'
                }, function (error, response) {
                    if (error) {
                        logger.error("Error sending 'streamPropertyChanged' event", error);
                    }
                    else {
                        _this.session.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.session, _this.stream, 'audioActive', value, !value, 'publishAudio')]);
                        _this.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this, _this.stream, 'audioActive', value, !value, 'publishAudio')]);
                    }
                });
            }
            this.stream.audioActive = value;
            logger.info("'Publisher' has " + (value ? 'published' : 'unpublished') + ' its audio stream');
        }
    };
    /**
     * Publish or unpublish the video stream (if available). Calling this method twice in a row passing same value will have no effect
     *
     * #### Events dispatched
     *
     * > _Only if `Session.publish(Publisher)` has been called for this Publisher_
     *
     * The [[Session]] object of the local participant will dispatch a `streamPropertyChanged` event with `changedProperty` set to `"videoActive"` and `reason` set to `"publishVideo"`
     * The [[Publisher]] object of the local participant will also dispatch the exact same event
     *
     * The [[Session]] object of every other participant connected to the session will dispatch a `streamPropertyChanged` event with `changedProperty` set to `"videoActive"` and `reason` set to `"publishVideo"`
     * The respective [[Subscriber]] object of every other participant receiving this Publisher's stream will also dispatch the exact same event
     *
     * See [[StreamPropertyChangedEvent]] to learn more.
     *
     * @param value `true` to publish the video stream, `false` to unpublish it
     */
    Publisher.prototype.publishVideo = function (value) {
        var _this = this;
        if (this.stream.videoActive !== value) {
            var affectedMediaStream = this.stream.displayMyRemote() ? this.stream.localMediaStreamWhenSubscribedToRemote : this.stream.getMediaStream();
            affectedMediaStream.getVideoTracks().forEach(function (track) {
                track.enabled = value;
            });
            if (!!this.session && !!this.stream.streamId) {
                this.session.openvidu.sendRequest('streamPropertyChanged', {
                    streamId: this.stream.streamId,
                    property: 'videoActive',
                    newValue: value,
                    reason: 'publishVideo'
                }, function (error, response) {
                    if (error) {
                        logger.error("Error sending 'streamPropertyChanged' event", error);
                    }
                    else {
                        _this.session.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.session, _this.stream, 'videoActive', value, !value, 'publishVideo')]);
                        _this.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this, _this.stream, 'videoActive', value, !value, 'publishVideo')]);
                    }
                });
            }
            this.stream.videoActive = value;
            logger.info("'Publisher' has " + (value ? 'published' : 'unpublished') + ' its video stream');
        }
    };
    /**
     * Call this method before [[Session.publish]] if you prefer to subscribe to your Publisher's remote stream instead of using the local stream, as any other user would do.
     */
    Publisher.prototype.subscribeToRemote = function (value) {
        value = (value !== undefined) ? value : true;
        this.isSubscribedToRemote = value;
        this.stream.subscribeToMyRemote(value);
    };
    /**
     * See [[EventDispatcher.on]]
     */
    Publisher.prototype.on = function (type, handler) {
        var _this = this;
        _super.prototype.on.call(this, type, handler);
        if (type === 'streamCreated') {
            if (!!this.stream && this.stream.isLocalStreamPublished) {
                this.emitEvent('streamCreated', [new StreamEvent_1.StreamEvent(false, this, 'streamCreated', this.stream, '')]);
            }
            else {
                this.stream.ee.on('stream-created-by-publisher', function () {
                    _this.emitEvent('streamCreated', [new StreamEvent_1.StreamEvent(false, _this, 'streamCreated', _this.stream, '')]);
                });
            }
        }
        if (type === 'remoteVideoPlaying') {
            if (this.stream.displayMyRemote() && this.videos[0] && this.videos[0].video &&
                this.videos[0].video.currentTime > 0 &&
                this.videos[0].video.paused === false &&
                this.videos[0].video.ended === false &&
                this.videos[0].video.readyState === 4) {
                this.emitEvent('remoteVideoPlaying', [new VideoElementEvent_1.VideoElementEvent(this.videos[0].video, this, 'remoteVideoPlaying')]);
            }
        }
        if (type === 'accessAllowed') {
            if (this.accessAllowed) {
                this.emitEvent('accessAllowed', []);
            }
        }
        if (type === 'accessDenied') {
            if (this.accessDenied) {
                this.emitEvent('accessDenied', []);
            }
        }
        return this;
    };
    /**
     * See [[EventDispatcher.once]]
     */
    Publisher.prototype.once = function (type, handler) {
        var _this = this;
        _super.prototype.once.call(this, type, handler);
        if (type === 'streamCreated') {
            if (!!this.stream && this.stream.isLocalStreamPublished) {
                this.emitEvent('streamCreated', [new StreamEvent_1.StreamEvent(false, this, 'streamCreated', this.stream, '')]);
            }
            else {
                this.stream.ee.once('stream-created-by-publisher', function () {
                    _this.emitEvent('streamCreated', [new StreamEvent_1.StreamEvent(false, _this, 'streamCreated', _this.stream, '')]);
                });
            }
        }
        if (type === 'remoteVideoPlaying') {
            if (this.stream.displayMyRemote() && this.videos[0] && this.videos[0].video &&
                this.videos[0].video.currentTime > 0 &&
                this.videos[0].video.paused === false &&
                this.videos[0].video.ended === false &&
                this.videos[0].video.readyState === 4) {
                this.emitEvent('remoteVideoPlaying', [new VideoElementEvent_1.VideoElementEvent(this.videos[0].video, this, 'remoteVideoPlaying')]);
            }
        }
        if (type === 'accessAllowed') {
            if (this.accessAllowed) {
                this.emitEvent('accessAllowed', []);
            }
        }
        if (type === 'accessDenied') {
            if (this.accessDenied) {
                this.emitEvent('accessDenied', []);
            }
        }
        return this;
    };
    /**
     * Replaces the current video or audio track with a different one. This allows you to replace an ongoing track with a different one
     * without having to renegotiate the whole WebRTC connection (that is, initializing a new Publisher, unpublishing the previous one
     * and publishing the new one).
     *
     * You can get this new MediaStreamTrack by using the native Web API or simply with [[OpenVidu.getUserMedia]] method.
     *
     * **WARNING: this method has been proven to work, but there may be some combinations of published/replaced tracks that may be incompatible between them and break the connection in OpenVidu Server. A complete renegotiation may be the only solution in this case**
     *
     * @param track The [MediaStreamTrack](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack) object to replace the current one. If it is an audio track, the current audio track will be the replaced one. If it
     * is a video track, the current video track will be the replaced one.
     *
     * @returns A Promise (to which you can optionally subscribe to) that is resolved if the track was successfully replaced and rejected with an Error object in other case
     */
    Publisher.prototype.replaceTrack = function (track) {
        var _this = this;
        var replaceMediaStreamTrack = function () {
            var mediaStream = _this.stream.displayMyRemote() ? _this.stream.localMediaStreamWhenSubscribedToRemote : _this.stream.getMediaStream();
            var removedTrack;
            if (track.kind === 'video') {
                removedTrack = mediaStream.getVideoTracks()[0];
            }
            else {
                removedTrack = mediaStream.getAudioTracks()[0];
            }
            mediaStream.removeTrack(removedTrack);
            removedTrack.stop();
            mediaStream.addTrack(track);
        };
        return new Promise(function (resolve, reject) {
            if (_this.stream.isLocalStreamPublished) {
                // Only if the Publisher has been published is necessary to call native Web API RTCRtpSender.replaceTrack
                var senders = _this.stream.getRTCPeerConnection().getSenders();
                var sender = void 0;
                if (track.kind === 'video') {
                    sender = senders.find(function (s) { return !!s.track && s.track.kind === 'video'; });
                    if (!sender) {
                        reject(new Error('There\'s no replaceable track for that kind of MediaStreamTrack in this Publisher object'));
                    }
                }
                else if (track.kind === 'audio') {
                    sender = senders.find(function (s) { return !!s.track && s.track.kind === 'audio'; });
                    if (!sender) {
                        reject(new Error('There\'s no replaceable track for that kind of MediaStreamTrack in this Publisher object'));
                    }
                }
                else {
                    reject(new Error('Unknown track kind ' + track.kind));
                }
                sender.replaceTrack(track).then(function () {
                    replaceMediaStreamTrack();
                    resolve();
                })["catch"](function (error) {
                    reject(error);
                });
            }
            else {
                // Publisher not published. Simply modify local MediaStream tracks
                replaceMediaStreamTrack();
                resolve();
            }
        });
    };
    /* Hidden methods */
    /**
     * @hidden
     */
    Publisher.prototype.initialize = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var constraints = {};
            var constraintsAux = {};
            var timeForDialogEvent = 1250;
            var startTime;
            var errorCallback = function (openViduError) {
                _this.accessDenied = true;
                _this.accessAllowed = false;
                reject(openViduError);
            };
            var successCallback = function (mediaStream) {
                _this.accessAllowed = true;
                _this.accessDenied = false;
                if (typeof MediaStreamTrack !== 'undefined' && _this.properties.audioSource instanceof MediaStreamTrack) {
                    mediaStream.removeTrack(mediaStream.getAudioTracks()[0]);
                    mediaStream.addTrack(_this.properties.audioSource);
                }
                if (typeof MediaStreamTrack !== 'undefined' && _this.properties.videoSource instanceof MediaStreamTrack) {
                    mediaStream.removeTrack(mediaStream.getVideoTracks()[0]);
                    mediaStream.addTrack(_this.properties.videoSource);
                }
                // Apply PublisherProperties.publishAudio and PublisherProperties.publishVideo
                if (!!mediaStream.getAudioTracks()[0]) {
                    var enabled = (_this.stream.audioActive !== undefined && _this.stream.audioActive !== null) ? _this.stream.audioActive : !!_this.stream.outboundStreamOpts.publisherProperties.publishAudio;
                    mediaStream.getAudioTracks()[0].enabled = enabled;
                }
                if (!!mediaStream.getVideoTracks()[0]) {
                    var enabled = (_this.stream.videoActive !== undefined && _this.stream.videoActive !== null) ? _this.stream.videoActive : !!_this.stream.outboundStreamOpts.publisherProperties.publishVideo;
                    mediaStream.getVideoTracks()[0].enabled = enabled;
                }
                _this.initializeVideoReference(mediaStream);
                if (!_this.stream.displayMyRemote()) {
                    // When we are subscribed to our remote we don't still set the MediaStream object in the video elements to
                    // avoid early 'streamPlaying' event
                    _this.stream.updateMediaStreamInVideos();
                }
                delete _this.firstVideoElement;
                if (_this.stream.isSendVideo()) {
                    if (!_this.stream.isSendScreen()) {
                        if (platform['isIonicIos'] || platform.name === 'Safari') {
                            // iOS Ionic or Safari. Limitation: cannot set videoDimensions directly, as the videoReference is not loaded
                            // if not added to DOM. Must add it to DOM and wait for videoWidth and videoHeight properties to be defined
                            _this.videoReference.style.display = 'none';
                            document.body.appendChild(_this.videoReference);
                            var videoDimensionsSet_1 = function () {
                                _this.stream.videoDimensions = {
                                    width: _this.videoReference.videoWidth,
                                    height: _this.videoReference.videoHeight
                                };
                                _this.stream.isLocalStreamReadyToPublish = true;
                                _this.stream.ee.emitEvent('stream-ready-to-publish', []);
                                document.body.removeChild(_this.videoReference);
                            };
                            var interval_1;
                            _this.videoReference.addEventListener('loadedmetadata', function () {
                                if (_this.videoReference.videoWidth === 0) {
                                    interval_1 = setInterval(function () {
                                        if (_this.videoReference.videoWidth !== 0) {
                                            clearInterval(interval_1);
                                            videoDimensionsSet_1();
                                        }
                                    }, 40);
                                }
                                else {
                                    videoDimensionsSet_1();
                                }
                            });
                        }
                        else {
                            // Rest of platforms
                            // With no screen share, video dimension can be set directly from MediaStream (getSettings)
                            // Orientation must be checked for mobile devices (width and height are reversed)
                            var _a = _this.getVideoDimensions(mediaStream), width = _a.width, height = _a.height;
                            if ((platform.os.family === 'iOS' || platform.os.family === 'Android') && (window.innerHeight > window.innerWidth)) {
                                // Mobile portrait mode
                                _this.stream.videoDimensions = {
                                    width: height || 0,
                                    height: width || 0
                                };
                            }
                            else {
                                _this.stream.videoDimensions = {
                                    width: width || 0,
                                    height: height || 0
                                };
                            }
                            _this.stream.isLocalStreamReadyToPublish = true;
                            _this.stream.ee.emitEvent('stream-ready-to-publish', []);
                        }
                    }
                    else {
                        // With screen share, video dimension must be got from a video element (onloadedmetadata event)
                        _this.videoReference.addEventListener('loadedmetadata', function () {
                            _this.stream.videoDimensions = {
                                width: _this.videoReference.videoWidth,
                                height: _this.videoReference.videoHeight
                            };
                            _this.screenShareResizeInterval = setInterval(function () {
                                var firefoxSettings = mediaStream.getVideoTracks()[0].getSettings();
                                var newWidth = (platform.name === 'Chrome' || platform.name === 'Opera') ? _this.videoReference.videoWidth : firefoxSettings.width;
                                var newHeight = (platform.name === 'Chrome' || platform.name === 'Opera') ? _this.videoReference.videoHeight : firefoxSettings.height;
                                if (_this.stream.isLocalStreamPublished &&
                                    (newWidth !== _this.stream.videoDimensions.width ||
                                        newHeight !== _this.stream.videoDimensions.height)) {
                                    var oldValue_1 = { width: _this.stream.videoDimensions.width, height: _this.stream.videoDimensions.height };
                                    _this.stream.videoDimensions = {
                                        width: newWidth || 0,
                                        height: newHeight || 0
                                    };
                                    _this.session.openvidu.sendRequest('streamPropertyChanged', {
                                        streamId: _this.stream.streamId,
                                        property: 'videoDimensions',
                                        newValue: JSON.stringify(_this.stream.videoDimensions),
                                        reason: 'screenResized'
                                    }, function (error, response) {
                                        if (error) {
                                            logger.error("Error sending 'streamPropertyChanged' event", error);
                                        }
                                        else {
                                            _this.session.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.session, _this.stream, 'videoDimensions', _this.stream.videoDimensions, oldValue_1, 'screenResized')]);
                                            _this.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this, _this.stream, 'videoDimensions', _this.stream.videoDimensions, oldValue_1, 'screenResized')]);
                                        }
                                    });
                                }
                            }, 500);
                            _this.stream.isLocalStreamReadyToPublish = true;
                            _this.stream.ee.emitEvent('stream-ready-to-publish', []);
                        });
                    }
                }
                else {
                    _this.stream.isLocalStreamReadyToPublish = true;
                    _this.stream.ee.emitEvent('stream-ready-to-publish', []);
                }
                resolve();
            };
            var getMediaSuccess = function (mediaStream, definedAudioConstraint) {
                _this.clearPermissionDialogTimer(startTime, timeForDialogEvent);
                if (_this.stream.isSendScreen() && _this.stream.isSendAudio()) {
                    // When getting desktop as user media audio constraint must be false. Now we can ask for it if required
                    constraintsAux.audio = definedAudioConstraint;
                    constraintsAux.video = false;
                    startTime = Date.now();
                    _this.setPermissionDialogTimer(timeForDialogEvent);
                    navigator.mediaDevices.getUserMedia(constraintsAux)
                        .then(function (audioOnlyStream) {
                        _this.clearPermissionDialogTimer(startTime, timeForDialogEvent);
                        mediaStream.addTrack(audioOnlyStream.getAudioTracks()[0]);
                        successCallback(mediaStream);
                    })["catch"](function (error) {
                        _this.clearPermissionDialogTimer(startTime, timeForDialogEvent);
                        mediaStream.getAudioTracks().forEach(function (track) {
                            track.stop();
                        });
                        mediaStream.getVideoTracks().forEach(function (track) {
                            track.stop();
                        });
                        errorCallback(_this.openvidu.generateAudioDeviceError(error, constraints));
                        return;
                    });
                }
                else {
                    successCallback(mediaStream);
                }
            };
            var getMediaError = function (error) {
                logger.error(error);
                _this.clearPermissionDialogTimer(startTime, timeForDialogEvent);
                if (error.name === 'Error') {
                    // Safari OverConstrainedError has as name property 'Error' instead of 'OverConstrainedError'
                    error.name = error.constructor.name;
                }
                var errorName, errorMessage;
                switch (error.name.toLowerCase()) {
                    case 'notfounderror':
                        navigator.mediaDevices.getUserMedia({
                            audio: false,
                            video: constraints.video
                        })
                            .then(function (mediaStream) {
                            mediaStream.getVideoTracks().forEach(function (track) {
                                track.stop();
                            });
                            errorName = OpenViduError_1.OpenViduErrorName.INPUT_AUDIO_DEVICE_NOT_FOUND;
                            errorMessage = error.toString();
                            errorCallback(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                        })["catch"](function (e) {
                            errorName = OpenViduError_1.OpenViduErrorName.INPUT_VIDEO_DEVICE_NOT_FOUND;
                            errorMessage = error.toString();
                            errorCallback(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                        });
                        break;
                    case 'notallowederror':
                        errorName = _this.stream.isSendScreen() ? OpenViduError_1.OpenViduErrorName.SCREEN_CAPTURE_DENIED : OpenViduError_1.OpenViduErrorName.DEVICE_ACCESS_DENIED;
                        errorMessage = error.toString();
                        errorCallback(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                        break;
                    case 'overconstrainederror':
                        navigator.mediaDevices.getUserMedia({
                            audio: false,
                            video: constraints.video
                        })
                            .then(function (mediaStream) {
                            mediaStream.getVideoTracks().forEach(function (track) {
                                track.stop();
                            });
                            if (error.constraint.toLowerCase() === 'deviceid') {
                                errorName = OpenViduError_1.OpenViduErrorName.INPUT_AUDIO_DEVICE_NOT_FOUND;
                                errorMessage = "Audio input device with deviceId '" + constraints.audio.deviceId.exact + "' not found";
                            }
                            else {
                                errorName = OpenViduError_1.OpenViduErrorName.PUBLISHER_PROPERTIES_ERROR;
                                errorMessage = "Audio input device doesn't support the value passed for constraint '" + error.constraint + "'";
                            }
                            errorCallback(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                        })["catch"](function (e) {
                            if (error.constraint.toLowerCase() === 'deviceid') {
                                errorName = OpenViduError_1.OpenViduErrorName.INPUT_VIDEO_DEVICE_NOT_FOUND;
                                errorMessage = "Video input device with deviceId '" + constraints.video.deviceId.exact + "' not found";
                            }
                            else {
                                errorName = OpenViduError_1.OpenViduErrorName.PUBLISHER_PROPERTIES_ERROR;
                                errorMessage = "Video input device doesn't support the value passed for constraint '" + error.constraint + "'";
                            }
                            errorCallback(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                        });
                        break;
                    case 'aborterror':
                    case 'notreadableerror':
                        errorName = OpenViduError_1.OpenViduErrorName.DEVICE_ALREADY_IN_USE;
                        errorMessage = error.toString();
                        errorCallback(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                        break;
                    default:
                        errorName = OpenViduError_1.OpenViduErrorName.GENERIC_ERROR;
                        errorMessage = error.toString();
                        errorCallback(new OpenViduError_1.OpenViduError(errorName, errorMessage));
                        break;
                }
            };
            _this.openvidu.generateMediaConstraints(_this.properties)
                .then(function (myConstraints) {
                var _a, _b;
                if (!!myConstraints.videoTrack && !!myConstraints.audioTrack ||
                    !!myConstraints.audioTrack && ((_a = myConstraints.constraints) === null || _a === void 0 ? void 0 : _a.video) === false ||
                    !!myConstraints.videoTrack && ((_b = myConstraints.constraints) === null || _b === void 0 ? void 0 : _b.audio) === false) {
                    // No need to call getUserMedia at all. MediaStreamTracks already provided
                    successCallback(_this.openvidu.addAlreadyProvidedTracks(myConstraints, new MediaStream()));
                    // Return as we do not need to process further
                    return;
                }
                constraints = myConstraints.constraints;
                var outboundStreamOptions = {
                    mediaConstraints: constraints,
                    publisherProperties: _this.properties
                };
                _this.stream.setOutboundStreamOptions(outboundStreamOptions);
                var definedAudioConstraint = ((constraints.audio === undefined) ? true : constraints.audio);
                constraintsAux.audio = _this.stream.isSendScreen() ? false : definedAudioConstraint;
                constraintsAux.video = constraints.video;
                startTime = Date.now();
                _this.setPermissionDialogTimer(timeForDialogEvent);
                if (_this.stream.isSendScreen() && navigator.mediaDevices['getDisplayMedia'] && platform.name !== 'Electron') {
                    navigator.mediaDevices['getDisplayMedia']({ video: true })
                        .then(function (mediaStream) {
                        _this.openvidu.addAlreadyProvidedTracks(myConstraints, mediaStream);
                        getMediaSuccess(mediaStream, definedAudioConstraint);
                    })["catch"](function (error) {
                        getMediaError(error);
                    });
                }
                else {
                    navigator.mediaDevices.getUserMedia(constraintsAux)
                        .then(function (mediaStream) {
                        _this.openvidu.addAlreadyProvidedTracks(myConstraints, mediaStream);
                        getMediaSuccess(mediaStream, definedAudioConstraint);
                    })["catch"](function (error) {
                        getMediaError(error);
                    });
                }
            })["catch"](function (error) {
                errorCallback(error);
            });
        });
    };
    /**
     * @hidden
     */
    Publisher.prototype.getVideoDimensions = function (mediaStream) {
        return mediaStream.getVideoTracks()[0].getSettings();
    };
    /**
     * @hidden
     */
    Publisher.prototype.reestablishStreamPlayingEvent = function () {
        if (this.ee.getListeners('streamPlaying').length > 0) {
            this.addPlayEventToFirstVideo();
        }
    };
    /**
     * @hidden
     */
    Publisher.prototype.initializeVideoReference = function (mediaStream) {
        this.videoReference = document.createElement('video');
        if (platform.name === 'Safari') {
            this.videoReference.setAttribute('playsinline', 'true');
        }
        this.stream.setMediaStream(mediaStream);
        if (!!this.firstVideoElement) {
            this.createVideoElement(this.firstVideoElement.targetElement, this.properties.insertMode);
        }
        this.videoReference.srcObject = mediaStream;
    };
    /* Private methods */
    Publisher.prototype.setPermissionDialogTimer = function (waitTime) {
        var _this = this;
        this.permissionDialogTimeout = setTimeout(function () {
            _this.emitEvent('accessDialogOpened', []);
        }, waitTime);
    };
    Publisher.prototype.clearPermissionDialogTimer = function (startTime, waitTime) {
        clearTimeout(this.permissionDialogTimeout);
        if ((Date.now() - startTime) > waitTime) {
            // Permission dialog was shown and now is closed
            this.emitEvent('accessDialogClosed', []);
        }
    };
    return Publisher;
}(StreamManager_1.StreamManager));
exports.Publisher = Publisher;
//# sourceMappingURL=Publisher.js.map