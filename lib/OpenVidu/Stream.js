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
var Filter_1 = require("./Filter");
var Subscriber_1 = require("./Subscriber");
var EventDispatcher_1 = require("./EventDispatcher");
var WebRtcPeer_1 = require("../OpenViduInternal/WebRtcPeer/WebRtcPeer");
var WebRtcStats_1 = require("../OpenViduInternal/WebRtcStats/WebRtcStats");
var PublisherSpeakingEvent_1 = require("../OpenViduInternal/Events/PublisherSpeakingEvent");
var StreamManagerEvent_1 = require("../OpenViduInternal/Events/StreamManagerEvent");
var StreamPropertyChangedEvent_1 = require("../OpenViduInternal/Events/StreamPropertyChangedEvent");
var OpenViduError_1 = require("../OpenViduInternal/Enums/OpenViduError");
/**
 * @hidden
 */
var hark = require("hark");
var platform = require("platform");
var OpenViduLogger_1 = require("../OpenViduInternal/Logger/OpenViduLogger");
/**
 * @hidden
 */
var logger = OpenViduLogger_1.OpenViduLogger.getInstance();
/**
 * Represents each one of the media streams available in OpenVidu Server for certain session.
 * Each [[Publisher]] and [[Subscriber]] has an attribute of type Stream, as they give access
 * to one of them (sending and receiving it, respectively)
 */
var Stream = /** @class */ (function (_super) {
    __extends(Stream, _super);
    /**
     * @hidden
     */
    function Stream(session, options) {
        var _this = _super.call(this) || this;
        _this.isSubscribeToRemote = false;
        /**
         * @hidden
         */
        _this.isLocalStreamReadyToPublish = false;
        /**
         * @hidden
         */
        _this.isLocalStreamPublished = false;
        /**
         * @hidden
         */
        _this.publishedOnce = false;
        /**
         * @hidden
         */
        _this.publisherStartSpeakingEventEnabled = false;
        /**
         * @hidden
         */
        _this.publisherStartSpeakingEventEnabledOnce = false;
        /**
         * @hidden
         */
        _this.publisherStopSpeakingEventEnabled = false;
        /**
         * @hidden
         */
        _this.publisherStopSpeakingEventEnabledOnce = false;
        /**
         * @hidden
         */
        _this.volumeChangeEventEnabled = false;
        /**
         * @hidden
         */
        _this.volumeChangeEventEnabledOnce = false;
        _this.session = session;
        if (options.hasOwnProperty('id')) {
            // InboundStreamOptions: stream belongs to a Subscriber
            _this.inboundStreamOpts = options;
            _this.streamId = _this.inboundStreamOpts.id;
            _this.creationTime = _this.inboundStreamOpts.createdAt;
            _this.hasAudio = _this.inboundStreamOpts.hasAudio;
            _this.hasVideo = _this.inboundStreamOpts.hasVideo;
            if (_this.hasAudio) {
                _this.audioActive = _this.inboundStreamOpts.audioActive;
            }
            if (_this.hasVideo) {
                _this.videoActive = _this.inboundStreamOpts.videoActive;
                _this.typeOfVideo = (!_this.inboundStreamOpts.typeOfVideo) ? undefined : _this.inboundStreamOpts.typeOfVideo;
                _this.frameRate = (_this.inboundStreamOpts.frameRate === -1) ? undefined : _this.inboundStreamOpts.frameRate;
                _this.videoDimensions = _this.inboundStreamOpts.videoDimensions;
            }
            if (!!_this.inboundStreamOpts.filter && (Object.keys(_this.inboundStreamOpts.filter).length > 0)) {
                if (!!_this.inboundStreamOpts.filter.lastExecMethod && Object.keys(_this.inboundStreamOpts.filter.lastExecMethod).length === 0) {
                    delete _this.inboundStreamOpts.filter.lastExecMethod;
                }
                _this.filter = _this.inboundStreamOpts.filter;
            }
        }
        else {
            // OutboundStreamOptions: stream belongs to a Publisher
            _this.outboundStreamOpts = options;
            _this.hasAudio = _this.isSendAudio();
            _this.hasVideo = _this.isSendVideo();
            if (_this.hasAudio) {
                _this.audioActive = !!_this.outboundStreamOpts.publisherProperties.publishAudio;
            }
            if (_this.hasVideo) {
                _this.videoActive = !!_this.outboundStreamOpts.publisherProperties.publishVideo;
                _this.frameRate = _this.outboundStreamOpts.publisherProperties.frameRate;
                if (typeof MediaStreamTrack !== 'undefined' && _this.outboundStreamOpts.publisherProperties.videoSource instanceof MediaStreamTrack) {
                    _this.typeOfVideo = 'CUSTOM';
                }
                else {
                    _this.typeOfVideo = _this.isSendScreen() ? 'SCREEN' : 'CAMERA';
                }
            }
            if (!!_this.outboundStreamOpts.publisherProperties.filter) {
                _this.filter = _this.outboundStreamOpts.publisherProperties.filter;
            }
        }
        _this.ee.on('mediastream-updated', function () {
            _this.streamManager.updateMediaStream(_this.mediaStream);
            logger.debug('Video srcObject [' + _this.mediaStream + '] updated in stream [' + _this.streamId + ']');
        });
        return _this;
    }
    /**
     * See [[EventDispatcher.on]]
     */
    Stream.prototype.on = function (type, handler) {
        _super.prototype.onAux.call(this, type, "Event '" + type + "' triggered by stream '" + this.streamId + "'", handler);
        return this;
    };
    /**
     * See [[EventDispatcher.once]]
     */
    Stream.prototype.once = function (type, handler) {
        _super.prototype.onceAux.call(this, type, "Event '" + type + "' triggered once by stream '" + this.streamId + "'", handler);
        return this;
    };
    /**
     * See [[EventDispatcher.off]]
     */
    Stream.prototype.off = function (type, handler) {
        _super.prototype.off.call(this, type, handler);
        return this;
    };
    /**
     * Applies an audio/video filter to the stream.
     *
     * @param type Type of filter applied. See [[Filter.type]]
     * @param options Parameters used to initialize the filter. See [[Filter.options]]
     *
     * @returns A Promise (to which you can optionally subscribe to) that is resolved to the applied filter if success and rejected with an Error object if not
     */
    Stream.prototype.applyFilter = function (type, options) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            logger.info('Applying filter to stream ' + _this.streamId);
            options = !!options ? options : {};
            if (typeof options !== 'string') {
                options = JSON.stringify(options);
            }
            _this.session.openvidu.sendRequest('applyFilter', { streamId: _this.streamId, type: type, options: options }, function (error, response) {
                if (error) {
                    logger.error('Error applying filter for Stream ' + _this.streamId, error);
                    if (error.code === 401) {
                        reject(new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.OPENVIDU_PERMISSION_DENIED, "You don't have permissions to apply a filter"));
                    }
                    else {
                        reject(error);
                    }
                }
                else {
                    logger.info('Filter successfully applied on Stream ' + _this.streamId);
                    var oldValue = _this.filter;
                    _this.filter = new Filter_1.Filter(type, options);
                    _this.filter.stream = _this;
                    _this.session.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.session, _this, 'filter', _this.filter, oldValue, 'applyFilter')]);
                    _this.streamManager.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.streamManager, _this, 'filter', _this.filter, oldValue, 'applyFilter')]);
                    resolve(_this.filter);
                }
            });
        });
    };
    /**
     * Removes an audio/video filter previously applied.
     *
     * @returns A Promise (to which you can optionally subscribe to) that is resolved if the previously applied filter has been successfully removed and rejected with an Error object in other case
     */
    Stream.prototype.removeFilter = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            logger.info('Removing filter of stream ' + _this.streamId);
            _this.session.openvidu.sendRequest('removeFilter', { streamId: _this.streamId }, function (error, response) {
                if (error) {
                    logger.error('Error removing filter for Stream ' + _this.streamId, error);
                    if (error.code === 401) {
                        reject(new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.OPENVIDU_PERMISSION_DENIED, "You don't have permissions to remove a filter"));
                    }
                    else {
                        reject(error);
                    }
                }
                else {
                    logger.info('Filter successfully removed from Stream ' + _this.streamId);
                    var oldValue = _this.filter;
                    delete _this.filter;
                    _this.session.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.session, _this, 'filter', _this.filter, oldValue, 'applyFilter')]);
                    _this.streamManager.emitEvent('streamPropertyChanged', [new StreamPropertyChangedEvent_1.StreamPropertyChangedEvent(_this.streamManager, _this, 'filter', _this.filter, oldValue, 'applyFilter')]);
                    resolve();
                }
            });
        });
    };
    /**
     * Returns the internal RTCPeerConnection object associated to this stream (https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
     *
     * @returns Native RTCPeerConnection Web API object
     */
    Stream.prototype.getRTCPeerConnection = function () {
        return this.webRtcPeer.pc;
    };
    /**
     * Returns the internal MediaStream object associated to this stream (https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
     *
     * @returns Native MediaStream Web API object
     */
    Stream.prototype.getMediaStream = function () {
        return this.mediaStream;
    };
    /* Hidden methods */
    /**
     * @hidden
     */
    Stream.prototype.setMediaStream = function (mediaStream) {
        this.mediaStream = mediaStream;
    };
    /**
     * @hidden
     */
    Stream.prototype.updateMediaStreamInVideos = function () {
        this.ee.emitEvent('mediastream-updated', []);
    };
    /**
     * @hidden
     */
    Stream.prototype.getWebRtcPeer = function () {
        return this.webRtcPeer;
    };
    /**
     * @hidden
     */
    Stream.prototype.subscribeToMyRemote = function (value) {
        this.isSubscribeToRemote = value;
    };
    /**
     * @hidden
     */
    Stream.prototype.setOutboundStreamOptions = function (outboundStreamOpts) {
        this.outboundStreamOpts = outboundStreamOpts;
    };
    /**
     * @hidden
     */
    Stream.prototype.subscribe = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.initWebRtcPeerReceive(false)
                .then(function () {
                resolve();
            })["catch"](function (error) {
                reject(error);
            });
        });
    };
    /**
     * @hidden
     */
    Stream.prototype.publish = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.isLocalStreamReadyToPublish) {
                _this.initWebRtcPeerSend(false)
                    .then(function () {
                    resolve();
                })["catch"](function (error) {
                    reject(error);
                });
            }
            else {
                _this.ee.once('stream-ready-to-publish', function () {
                    _this.publish()
                        .then(function () {
                        resolve();
                    })["catch"](function (error) {
                        reject(error);
                    });
                });
            }
        });
    };
    /**
     * @hidden
     */
    Stream.prototype.disposeWebRtcPeer = function () {
        if (!!this.webRtcPeer) {
            this.webRtcPeer.dispose();
            this.stopWebRtcStats();
        }
        logger.info((!!this.outboundStreamOpts ? 'Outbound ' : 'Inbound ') + "WebRTCPeer from 'Stream' with id [" + this.streamId + '] is now closed');
    };
    /**
     * @hidden
     */
    Stream.prototype.disposeMediaStream = function () {
        if (this.mediaStream) {
            this.mediaStream.getAudioTracks().forEach(function (track) {
                track.stop();
            });
            this.mediaStream.getVideoTracks().forEach(function (track) {
                track.stop();
            });
            delete this.mediaStream;
        }
        // If subscribeToRemote local MediaStream must be stopped
        if (this.localMediaStreamWhenSubscribedToRemote) {
            this.localMediaStreamWhenSubscribedToRemote.getAudioTracks().forEach(function (track) {
                track.stop();
            });
            this.localMediaStreamWhenSubscribedToRemote.getVideoTracks().forEach(function (track) {
                track.stop();
            });
            delete this.localMediaStreamWhenSubscribedToRemote;
        }
        if (!!this.speechEvent) {
            if (!!this.speechEvent.stop) {
                this.speechEvent.stop();
            }
            delete this.speechEvent;
        }
        logger.info((!!this.outboundStreamOpts ? 'Local ' : 'Remote ') + "MediaStream from 'Stream' with id [" + this.streamId + '] is now disposed');
    };
    /**
     * @hidden
     */
    Stream.prototype.displayMyRemote = function () {
        return this.isSubscribeToRemote;
    };
    /**
     * @hidden
     */
    Stream.prototype.isSendAudio = function () {
        return (!!this.outboundStreamOpts &&
            this.outboundStreamOpts.publisherProperties.audioSource !== null &&
            this.outboundStreamOpts.publisherProperties.audioSource !== false);
    };
    /**
     * @hidden
     */
    Stream.prototype.isSendVideo = function () {
        return (!!this.outboundStreamOpts &&
            this.outboundStreamOpts.publisherProperties.videoSource !== null &&
            this.outboundStreamOpts.publisherProperties.videoSource !== false);
    };
    /**
     * @hidden
     */
    Stream.prototype.isSendScreen = function () {
        var screen = this.outboundStreamOpts.publisherProperties.videoSource === 'screen';
        if (platform.name === 'Electron') {
            screen = typeof this.outboundStreamOpts.publisherProperties.videoSource === 'string' &&
                this.outboundStreamOpts.publisherProperties.videoSource.startsWith('screen:');
        }
        return !!this.outboundStreamOpts && screen;
    };
    /**
     * @hidden
     */
    Stream.prototype.enableStartSpeakingEvent = function () {
        var _this = this;
        this.setSpeechEventIfNotExists();
        if (!this.publisherStartSpeakingEventEnabled) {
            this.publisherStartSpeakingEventEnabled = true;
            this.speechEvent.on('speaking', function () {
                _this.session.emitEvent('publisherStartSpeaking', [new PublisherSpeakingEvent_1.PublisherSpeakingEvent(_this.session, 'publisherStartSpeaking', _this.connection, _this.streamId)]);
                _this.publisherStartSpeakingEventEnabledOnce = false; // Disable 'once' version if 'on' version was triggered
            });
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.enableOnceStartSpeakingEvent = function () {
        var _this = this;
        this.setSpeechEventIfNotExists();
        if (!this.publisherStartSpeakingEventEnabledOnce) {
            this.publisherStartSpeakingEventEnabledOnce = true;
            this.speechEvent.once('speaking', function () {
                if (_this.publisherStartSpeakingEventEnabledOnce) {
                    // If the listener has been disabled in the meantime (for example by the 'on' version) do not trigger the event
                    _this.session.emitEvent('publisherStartSpeaking', [new PublisherSpeakingEvent_1.PublisherSpeakingEvent(_this.session, 'publisherStartSpeaking', _this.connection, _this.streamId)]);
                }
                _this.disableStartSpeakingEvent(true);
            });
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.disableStartSpeakingEvent = function (disabledByOnce) {
        if (!!this.speechEvent) {
            this.publisherStartSpeakingEventEnabledOnce = false;
            if (disabledByOnce) {
                if (this.publisherStartSpeakingEventEnabled) {
                    // The 'on' version of this same event is enabled too. Do not remove the hark listener
                    return;
                }
            }
            else {
                this.publisherStartSpeakingEventEnabled = false;
            }
            // Shutting down the hark event
            if (this.volumeChangeEventEnabled ||
                this.volumeChangeEventEnabledOnce ||
                this.publisherStopSpeakingEventEnabled ||
                this.publisherStopSpeakingEventEnabledOnce) {
                // Some other hark event is enabled. Cannot stop the hark process, just remove the specific listener
                this.speechEvent.off('speaking');
            }
            else {
                // No other hark event is enabled. We can get entirely rid of it
                this.speechEvent.stop();
                delete this.speechEvent;
            }
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.enableStopSpeakingEvent = function () {
        var _this = this;
        this.setSpeechEventIfNotExists();
        if (!this.publisherStopSpeakingEventEnabled) {
            this.publisherStopSpeakingEventEnabled = true;
            this.speechEvent.on('stopped_speaking', function () {
                _this.session.emitEvent('publisherStopSpeaking', [new PublisherSpeakingEvent_1.PublisherSpeakingEvent(_this.session, 'publisherStopSpeaking', _this.connection, _this.streamId)]);
                _this.publisherStopSpeakingEventEnabledOnce = false; // Disable 'once' version if 'on' version was triggered
            });
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.enableOnceStopSpeakingEvent = function () {
        var _this = this;
        this.setSpeechEventIfNotExists();
        if (!this.publisherStopSpeakingEventEnabledOnce) {
            this.publisherStopSpeakingEventEnabledOnce = true;
            this.speechEvent.once('stopped_speaking', function () {
                if (_this.publisherStopSpeakingEventEnabledOnce) {
                    // If the listener has been disabled in the meantime (for example by the 'on' version) do not trigger the event
                    _this.session.emitEvent('publisherStopSpeaking', [new PublisherSpeakingEvent_1.PublisherSpeakingEvent(_this.session, 'publisherStopSpeaking', _this.connection, _this.streamId)]);
                }
                _this.disableStopSpeakingEvent(true);
            });
        }
    };
    /**
    * @hidden
    */
    Stream.prototype.disableStopSpeakingEvent = function (disabledByOnce) {
        if (!!this.speechEvent) {
            this.publisherStopSpeakingEventEnabledOnce = false;
            if (disabledByOnce) {
                if (this.publisherStopSpeakingEventEnabled) {
                    // We are cancelling the 'once' listener for this event, but the 'on' version
                    // of this same event is enabled too. Do not remove the hark listener
                    return;
                }
            }
            else {
                this.publisherStopSpeakingEventEnabled = false;
            }
            // Shutting down the hark event
            if (this.volumeChangeEventEnabled ||
                this.volumeChangeEventEnabledOnce ||
                this.publisherStartSpeakingEventEnabled ||
                this.publisherStartSpeakingEventEnabledOnce) {
                // Some other hark event is enabled. Cannot stop the hark process, just remove the specific listener
                this.speechEvent.off('stopped_speaking');
            }
            else {
                // No other hark event is enabled. We can get entirely rid of it
                this.speechEvent.stop();
                delete this.speechEvent;
            }
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.enableVolumeChangeEvent = function (force) {
        var _this = this;
        if (this.setSpeechEventIfNotExists()) {
            if (!this.volumeChangeEventEnabled || force) {
                this.volumeChangeEventEnabled = true;
                this.speechEvent.on('volume_change', function (harkEvent) {
                    var oldValue = _this.speechEvent.oldVolumeValue;
                    var value = { newValue: harkEvent, oldValue: oldValue };
                    _this.speechEvent.oldVolumeValue = harkEvent;
                    _this.streamManager.emitEvent('streamAudioVolumeChange', [new StreamManagerEvent_1.StreamManagerEvent(_this.streamManager, 'streamAudioVolumeChange', value)]);
                });
            }
        }
        else {
            // This way whenever the MediaStream object is available, the event listener will be automatically added
            this.volumeChangeEventEnabled = true;
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.enableOnceVolumeChangeEvent = function (force) {
        var _this = this;
        if (this.setSpeechEventIfNotExists()) {
            if (!this.volumeChangeEventEnabledOnce || force) {
                this.volumeChangeEventEnabledOnce = true;
                this.speechEvent.once('volume_change', function (harkEvent) {
                    var oldValue = _this.speechEvent.oldVolumeValue;
                    var value = { newValue: harkEvent, oldValue: oldValue };
                    _this.speechEvent.oldVolumeValue = harkEvent;
                    _this.disableVolumeChangeEvent(true);
                    _this.streamManager.emitEvent('streamAudioVolumeChange', [new StreamManagerEvent_1.StreamManagerEvent(_this.streamManager, 'streamAudioVolumeChange', value)]);
                });
            }
        }
        else {
            // This way whenever the MediaStream object is available, the event listener will be automatically added
            this.volumeChangeEventEnabledOnce = true;
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.disableVolumeChangeEvent = function (disabledByOnce) {
        if (!!this.speechEvent) {
            this.volumeChangeEventEnabledOnce = false;
            if (disabledByOnce) {
                if (this.volumeChangeEventEnabled) {
                    // We are cancelling the 'once' listener for this event, but the 'on' version
                    // of this same event is enabled too. Do not remove the hark listener
                    return;
                }
            }
            else {
                this.volumeChangeEventEnabled = false;
            }
            // Shutting down the hark event
            if (this.publisherStartSpeakingEventEnabled ||
                this.publisherStartSpeakingEventEnabledOnce ||
                this.publisherStopSpeakingEventEnabled ||
                this.publisherStopSpeakingEventEnabledOnce) {
                // Some other hark event is enabled. Cannot stop the hark process, just remove the specific listener
                this.speechEvent.off('volume_change');
            }
            else {
                // No other hark event is enabled. We can get entirely rid of it
                this.speechEvent.stop();
                delete this.speechEvent;
            }
        }
    };
    /**
     * @hidden
     */
    Stream.prototype.isLocal = function () {
        // inbound options undefined and outbound options defined
        return (!this.inboundStreamOpts && !!this.outboundStreamOpts);
    };
    /**
     * @hidden
     */
    Stream.prototype.getSelectedIceCandidate = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.webRtcStats.getSelectedIceCandidateInfo()
                .then(function (report) { return resolve(report); })["catch"](function (error) { return reject(error); });
        });
    };
    /**
     * @hidden
     */
    Stream.prototype.getRemoteIceCandidateList = function () {
        return this.webRtcPeer.remoteCandidatesQueue;
    };
    /**
     * @hidden
     */
    Stream.prototype.getLocalIceCandidateList = function () {
        return this.webRtcPeer.localCandidatesQueue;
    };
    /**
     * @hidden
     */
    Stream.prototype.streamIceConnectionStateBroken = function () {
        if (!this.getWebRtcPeer() || !this.getRTCPeerConnection()) {
            return false;
        }
        if (this.isLocal && !!this.session.openvidu.advancedConfiguration.forceMediaReconnectionAfterNetworkDrop) {
            logger.warn('OpenVidu Browser advanced configuration option "forceMediaReconnectionAfterNetworkDrop" is enabled. Publisher stream ' + this.streamId + 'will force a reconnection');
            return true;
        }
        var iceConnectionState = this.getRTCPeerConnection().iceConnectionState;
        return iceConnectionState === 'disconnected' || iceConnectionState === 'failed';
    };
    /* Private methods */
    Stream.prototype.setSpeechEventIfNotExists = function () {
        if (!!this.mediaStream) {
            if (!this.speechEvent) {
                var harkOptions = !!this.harkOptions ? this.harkOptions : (this.session.openvidu.advancedConfiguration.publisherSpeakingEventsOptions || {});
                harkOptions.interval = (typeof harkOptions.interval === 'number') ? harkOptions.interval : 100;
                harkOptions.threshold = (typeof harkOptions.threshold === 'number') ? harkOptions.threshold : -50;
                this.speechEvent = hark(this.mediaStream, harkOptions);
            }
            return true;
        }
        return false;
    };
    /**
     * @hidden
     */
    Stream.prototype.initWebRtcPeerSend = function (reconnect) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!reconnect) {
                _this.initHarkEvents(); // Init hark events for the local stream
            }
            var userMediaConstraints = {
                audio: _this.isSendAudio(),
                video: _this.isSendVideo()
            };
            var options = {
                mediaStream: _this.mediaStream,
                mediaConstraints: userMediaConstraints,
                onicecandidate: _this.connection.sendIceCandidate.bind(_this.connection),
                iceServers: _this.getIceServersConf(),
                simulcast: false
            };
            var successCallback = function (sdpOfferParam) {
                logger.debug('Sending SDP offer to publish as '
                    + _this.streamId, sdpOfferParam);
                var method = reconnect ? 'reconnectStream' : 'publishVideo';
                var params;
                if (reconnect) {
                    params = {
                        stream: _this.streamId
                    };
                }
                else {
                    var typeOfVideo = '';
                    if (_this.isSendVideo()) {
                        typeOfVideo = (typeof MediaStreamTrack !== 'undefined' && _this.outboundStreamOpts.publisherProperties.videoSource instanceof MediaStreamTrack) ? 'CUSTOM' : (_this.isSendScreen() ? 'SCREEN' : 'CAMERA');
                    }
                    params = {
                        doLoopback: _this.displayMyRemote() || false,
                        hasAudio: _this.isSendAudio(),
                        hasVideo: _this.isSendVideo(),
                        audioActive: _this.audioActive,
                        videoActive: _this.videoActive,
                        typeOfVideo: typeOfVideo,
                        frameRate: !!_this.frameRate ? _this.frameRate : -1,
                        videoDimensions: JSON.stringify(_this.videoDimensions),
                        filter: _this.outboundStreamOpts.publisherProperties.filter
                    };
                }
                params['sdpOffer'] = sdpOfferParam;
                _this.session.openvidu.sendRequest(method, params, function (error, response) {
                    if (error) {
                        if (error.code === 401) {
                            reject(new OpenViduError_1.OpenViduError(OpenViduError_1.OpenViduErrorName.OPENVIDU_PERMISSION_DENIED, "You don't have permissions to publish"));
                        }
                        else {
                            reject('Error on publishVideo: ' + JSON.stringify(error));
                        }
                    }
                    else {
                        _this.webRtcPeer.processAnswer(response.sdpAnswer, false)
                            .then(function () {
                            _this.streamId = response.id;
                            _this.creationTime = response.createdAt;
                            _this.isLocalStreamPublished = true;
                            _this.publishedOnce = true;
                            if (_this.displayMyRemote()) {
                                _this.localMediaStreamWhenSubscribedToRemote = _this.mediaStream;
                                _this.remotePeerSuccessfullyEstablished();
                            }
                            if (reconnect) {
                                _this.ee.emitEvent('stream-reconnected-by-publisher', []);
                            }
                            else {
                                _this.ee.emitEvent('stream-created-by-publisher', []);
                            }
                            _this.initWebRtcStats();
                            logger.info("'Publisher' (" + _this.streamId + ") successfully " + (reconnect ? "reconnected" : "published") + " to session");
                            resolve();
                        })["catch"](function (error) {
                            reject(error);
                        });
                    }
                });
            };
            if (reconnect) {
                _this.disposeWebRtcPeer();
            }
            if (_this.displayMyRemote()) {
                _this.webRtcPeer = new WebRtcPeer_1.WebRtcPeerSendrecv(options);
            }
            else {
                _this.webRtcPeer = new WebRtcPeer_1.WebRtcPeerSendonly(options);
            }
            _this.webRtcPeer.addIceConnectionStateChangeListener('publisher of ' + _this.connection.connectionId);
            _this.webRtcPeer.generateOffer().then(function (sdpOffer) {
                successCallback(sdpOffer);
            })["catch"](function (error) {
                reject(new Error('(publish) SDP offer error: ' + JSON.stringify(error)));
            });
        });
    };
    /**
     * @hidden
     */
    Stream.prototype.initWebRtcPeerReceive = function (reconnect) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var offerConstraints = {
                audio: _this.inboundStreamOpts.hasAudio,
                video: _this.inboundStreamOpts.hasVideo
            };
            logger.debug("'Session.subscribe(Stream)' called. Constraints of generate SDP offer", offerConstraints);
            var options = {
                onicecandidate: _this.connection.sendIceCandidate.bind(_this.connection),
                mediaConstraints: offerConstraints,
                iceServers: _this.getIceServersConf(),
                simulcast: false
            };
            var successCallback = function (sdpOfferParam) {
                logger.debug('Sending SDP offer to subscribe to '
                    + _this.streamId, sdpOfferParam);
                var method = reconnect ? 'reconnectStream' : 'receiveVideoFrom';
                var params = { sdpOffer: sdpOfferParam };
                params[reconnect ? 'stream' : 'sender'] = _this.streamId;
                _this.session.openvidu.sendRequest(method, params, function (error, response) {
                    if (error) {
                        reject(new Error('Error on recvVideoFrom: ' + JSON.stringify(error)));
                    }
                    else {
                        // Ios Ionic. Limitation: some bug in iosrtc cordova plugin makes it necessary
                        // to add a timeout before calling PeerConnection#setRemoteDescription during
                        // some time (400 ms) from the moment first subscriber stream is received
                        if (_this.session.isFirstIonicIosSubscriber) {
                            _this.session.isFirstIonicIosSubscriber = false;
                            setTimeout(function () {
                                // After 400 ms Ionic iOS subscribers won't need to run
                                // PeerConnection#setRemoteDescription after 250 ms timeout anymore
                                _this.session.countDownForIonicIosSubscribersActive = false;
                            }, 400);
                        }
                        var needsTimeoutOnProcessAnswer = _this.session.countDownForIonicIosSubscribersActive;
                        _this.webRtcPeer.processAnswer(response.sdpAnswer, needsTimeoutOnProcessAnswer).then(function () {
                            logger.info("'Subscriber' (" + _this.streamId + ") successfully " + (reconnect ? "reconnected" : "subscribed"));
                            _this.remotePeerSuccessfullyEstablished();
                            _this.initWebRtcStats();
                            resolve();
                        })["catch"](function (error) {
                            reject(error);
                        });
                    }
                });
            };
            _this.webRtcPeer = new WebRtcPeer_1.WebRtcPeerRecvonly(options);
            _this.webRtcPeer.addIceConnectionStateChangeListener(_this.streamId);
            _this.webRtcPeer.generateOffer()
                .then(function (sdpOffer) {
                successCallback(sdpOffer);
            })["catch"](function (error) {
                reject(new Error('(subscribe) SDP offer error: ' + JSON.stringify(error)));
            });
        });
    };
    /**
     * @hidden
     */
    Stream.prototype.remotePeerSuccessfullyEstablished = function () {
        this.mediaStream = new MediaStream();
        var receiver;
        for (var _i = 0, _a = this.webRtcPeer.pc.getReceivers(); _i < _a.length; _i++) {
            receiver = _a[_i];
            if (!!receiver.track) {
                this.mediaStream.addTrack(receiver.track);
            }
        }
        logger.debug('Peer remote stream', this.mediaStream);
        if (!!this.mediaStream) {
            if (this.streamManager instanceof Subscriber_1.Subscriber) {
                // Apply SubscriberProperties.subscribeToAudio and SubscriberProperties.subscribeToVideo
                if (!!this.mediaStream.getAudioTracks()[0]) {
                    var enabled = !!(this.streamManager.properties.subscribeToAudio);
                    this.mediaStream.getAudioTracks()[0].enabled = enabled;
                }
                if (!!this.mediaStream.getVideoTracks()[0]) {
                    var enabled = !!(this.streamManager.properties.subscribeToVideo);
                    this.mediaStream.getVideoTracks()[0].enabled = enabled;
                }
            }
            this.updateMediaStreamInVideos();
            this.initHarkEvents(); // Init hark events for the remote stream
        }
    };
    Stream.prototype.initHarkEvents = function () {
        if (!!this.mediaStream.getAudioTracks()[0]) {
            // Hark events can only be set if audio track is available
            if (this.streamManager.remote) {
                // publisherStartSpeaking/publisherStopSpeaking is only defined for remote streams
                if (this.session.startSpeakingEventsEnabled) {
                    this.enableStartSpeakingEvent();
                }
                if (this.session.startSpeakingEventsEnabledOnce) {
                    this.enableOnceStartSpeakingEvent();
                }
                if (this.session.stopSpeakingEventsEnabled) {
                    this.enableStopSpeakingEvent();
                }
                if (this.session.stopSpeakingEventsEnabledOnce) {
                    this.enableOnceStopSpeakingEvent();
                }
            }
            // streamAudioVolumeChange event is defined for both Publishers and Subscribers
            if (this.volumeChangeEventEnabled) {
                this.enableVolumeChangeEvent(true);
            }
            if (this.volumeChangeEventEnabledOnce) {
                this.enableOnceVolumeChangeEvent(true);
            }
        }
    };
    Stream.prototype.initWebRtcStats = function () {
        this.webRtcStats = new WebRtcStats_1.WebRtcStats(this);
        this.webRtcStats.initWebRtcStats();
        //TODO: send common webrtc stats from client to openvidu-server
        /*if (this.session.openvidu.webrtcStatsInterval > 0) {
            setInterval(() => {
                this.gatherStatsForPeer().then(jsonStats => {
                    const body = {
                        sessionId: this.session.sessionId,
                        participantPrivateId: this.connection.rpcSessionId,
                        stats: jsonStats
                    }
                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', this.session.openvidu.httpUri + '/elasticsearch/webrtc-stats', true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(JSON.stringify(body));
                })
            }, this.session.openvidu.webrtcStatsInterval * 1000);
        }*/
    };
    Stream.prototype.stopWebRtcStats = function () {
        if (!!this.webRtcStats && this.webRtcStats.isEnabled()) {
            this.webRtcStats.stopWebRtcStats();
        }
    };
    Stream.prototype.getIceServersConf = function () {
        var returnValue;
        if (!!this.session.openvidu.advancedConfiguration.iceServers) {
            returnValue = this.session.openvidu.advancedConfiguration.iceServers === 'freeice' ?
                undefined :
                this.session.openvidu.advancedConfiguration.iceServers;
        }
        else if (this.session.openvidu.iceServers) {
            returnValue = this.session.openvidu.iceServers;
        }
        else {
            returnValue = undefined;
        }
        return returnValue;
    };
    Stream.prototype.gatherStatsForPeer = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.isLocal()) {
                // Publisher stream stats
                _this.getRTCPeerConnection().getSenders().forEach(function (sender) { return sender.getStats()
                    .then(function (response) {
                    response.forEach(function (report) {
                        if (_this.isReportWanted(report)) {
                            var finalReport = {};
                            finalReport['type'] = report.type;
                            finalReport['timestamp'] = report.timestamp;
                            finalReport['id'] = report.id;
                            // Common to Chrome, Firefox and Safari
                            if (report.type === 'outbound-rtp') {
                                finalReport['ssrc'] = report.ssrc;
                                finalReport['firCount'] = report.firCount;
                                finalReport['pliCount'] = report.pliCount;
                                finalReport['nackCount'] = report.nackCount;
                                finalReport['qpSum'] = report.qpSum;
                                // Set media type
                                if (!!report.kind) {
                                    finalReport['mediaType'] = report.kind;
                                }
                                else if (!!report.mediaType) {
                                    finalReport['mediaType'] = report.mediaType;
                                }
                                else {
                                    // Safari does not have 'mediaType' defined for inbound-rtp. Must be inferred from 'id' field
                                    finalReport['mediaType'] = (report.id.indexOf('VideoStream') !== -1) ? 'video' : 'audio';
                                }
                                if (finalReport['mediaType'] === 'video') {
                                    finalReport['framesEncoded'] = report.framesEncoded;
                                }
                                finalReport['packetsSent'] = report.packetsSent;
                                finalReport['bytesSent'] = report.bytesSent;
                            }
                            // Only for Chrome and Safari
                            if (report.type === 'candidate-pair' && report.totalRoundTripTime !== undefined) {
                                // This is the final selected candidate pair
                                finalReport['availableOutgoingBitrate'] = report.availableOutgoingBitrate;
                                finalReport['rtt'] = report.currentRoundTripTime;
                                finalReport['averageRtt'] = report.totalRoundTripTime / report.responsesReceived;
                            }
                            // Only for Firefox >= 66.0
                            if (report.type === 'remote-inbound-rtp' || report.type === 'remote-outbound-rtp') {
                            }
                            logger.log(finalReport);
                        }
                    });
                }); });
            }
            else {
                // Subscriber stream stats
                _this.getRTCPeerConnection().getReceivers().forEach(function (receiver) { return receiver.getStats()
                    .then(function (response) {
                    response.forEach(function (report) {
                        if (_this.isReportWanted(report)) {
                            var finalReport = {};
                            finalReport['type'] = report.type;
                            finalReport['timestamp'] = report.timestamp;
                            finalReport['id'] = report.id;
                            // Common to Chrome, Firefox and Safari
                            if (report.type === 'inbound-rtp') {
                                finalReport['ssrc'] = report.ssrc;
                                finalReport['firCount'] = report.firCount;
                                finalReport['pliCount'] = report.pliCount;
                                finalReport['nackCount'] = report.nackCount;
                                finalReport['qpSum'] = report.qpSum;
                                // Set media type
                                if (!!report.kind) {
                                    finalReport['mediaType'] = report.kind;
                                }
                                else if (!!report.mediaType) {
                                    finalReport['mediaType'] = report.mediaType;
                                }
                                else {
                                    // Safari does not have 'mediaType' defined for inbound-rtp. Must be inferred from 'id' field
                                    finalReport['mediaType'] = (report.id.indexOf('VideoStream') !== -1) ? 'video' : 'audio';
                                }
                                if (finalReport['mediaType'] === 'video') {
                                    finalReport['framesDecoded'] = report.framesDecoded;
                                }
                                finalReport['packetsReceived'] = report.packetsReceived;
                                finalReport['packetsLost'] = report.packetsLost;
                                finalReport['jitter'] = report.jitter;
                                finalReport['bytesReceived'] = report.bytesReceived;
                            }
                            // Only for Chrome and Safari
                            if (report.type === 'candidate-pair' && report.totalRoundTripTime !== undefined) {
                                // This is the final selected candidate pair
                                finalReport['availableIncomingBitrate'] = report.availableIncomingBitrate;
                                finalReport['rtt'] = report.currentRoundTripTime;
                                finalReport['averageRtt'] = report.totalRoundTripTime / report.responsesReceived;
                            }
                            // Only for Firefox >= 66.0
                            if (report.type === 'remote-inbound-rtp' || report.type === 'remote-outbound-rtp') {
                            }
                            logger.log(finalReport);
                        }
                    });
                }); });
            }
        });
    };
    Stream.prototype.isReportWanted = function (report) {
        return report.type === 'inbound-rtp' && !this.isLocal() ||
            report.type === 'outbound-rtp' && this.isLocal() ||
            (report.type === 'candidate-pair' && report.nominated && report.bytesSent > 0);
    };
    return Stream;
}(EventDispatcher_1.EventDispatcher));
exports.Stream = Stream;
//# sourceMappingURL=Stream.js.map