export interface WebRtcPeerConfiguration {
    mediaConstraints: {
        audio: boolean;
        video: boolean;
    };
    simulcast: boolean;
    onicecandidate: (event: any) => void;
    iceServers: RTCIceServer[] | undefined;
    mediaStream?: MediaStream;
    mode?: 'sendonly' | 'recvonly' | 'sendrecv';
    id?: string;
}
export declare class WebRtcPeer {
    protected configuration: WebRtcPeerConfiguration;
    pc: RTCPeerConnection;
    id: string;
    remoteCandidatesQueue: RTCIceCandidate[];
    localCandidatesQueue: RTCIceCandidate[];
    iceCandidateList: RTCIceCandidate[];
    private candidategatheringdone;
    constructor(configuration: WebRtcPeerConfiguration);
    /**
     * This function creates the RTCPeerConnection object taking into account the
     * properties received in the constructor. It starts the SDP negotiation
     * process: generates the SDP offer and invokes the onsdpoffer callback. This
     * callback is expected to send the SDP offer, in order to obtain an SDP
     * answer from another peer.
     */
    start(): Promise<any>;
    /**
     * This method frees the resources used by WebRtcPeer
     */
    dispose(): void;
    /**
     * Function that creates an offer, sets it as local description and returns the offer param
     * to send to OpenVidu Server (will be the remote description of other peer)
     */
    generateOffer(): Promise<string>;
    /**
     * Function invoked when a SDP answer is received. Final step in SDP negotiation, the peer
     * just needs to set the answer as its remote description
     */
    processAnswer(sdpAnswer: string, needsTimeoutOnProcessAnswer: boolean): Promise<string>;
    /**
     * @hidden
     */
    setRemoteDescription(answer: RTCSessionDescriptionInit, needsTimeoutOnProcessAnswer: boolean, resolve: (value?: string | PromiseLike<string> | undefined) => void, reject: (reason?: any) => void): void;
    /**
     * Callback function invoked when an ICE candidate is received
     */
    addIceCandidate(iceCandidate: RTCIceCandidate): Promise<void>;
    addIceConnectionStateChangeListener(otherId: string): void;
    /**
     * @hidden
     */
    generateUniqueId(): string;
}
export declare class WebRtcPeerRecvonly extends WebRtcPeer {
    constructor(configuration: WebRtcPeerConfiguration);
}
export declare class WebRtcPeerSendonly extends WebRtcPeer {
    constructor(configuration: WebRtcPeerConfiguration);
}
export declare class WebRtcPeerSendrecv extends WebRtcPeer {
    constructor(configuration: WebRtcPeerConfiguration);
}
