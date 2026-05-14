import type { CallType } from "./types";

type SignalPayload =
  | { type: "offer"; sdp: RTCSessionDescriptionInit; callType: CallType }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; callType: CallType }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; callType: CallType };

type CallManagerOptions = {
  iceServers: RTCIceServer[];
  onLocalStream: (stream: MediaStream | null) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onEnded: () => void;
  sendSignal: (targetUserId: string, signal: SignalPayload) => void;
  sendEnd: (targetUserId: string) => void;
};

export class DirectCallManager {
  private readonly options: CallManagerOptions;
  private peer: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private targetUserId: string | null = null;
  private callType: CallType = "audio";

  constructor(options: CallManagerOptions) {
    this.options = options;
  }

  private async ensureLocalStream(callType: CallType) {
    this.callType = callType;

    if (this.localStream) {
      return this.localStream;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video"
    });
    this.options.onLocalStream(this.localStream);
    return this.localStream;
  }

  private async ensurePeer(targetUserId: string) {
    if (this.peer) {
      return this.peer;
    }

    this.targetUserId = targetUserId;
    const peer = new RTCPeerConnection({ iceServers: this.options.iceServers });
    const localStream = await this.ensureLocalStream(this.callType);
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

    this.remoteStream = new MediaStream();
    this.options.onRemoteStream(this.remoteStream);

    peer.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
      this.options.onRemoteStream(this.remoteStream);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && this.targetUserId) {
        this.options.sendSignal(this.targetUserId, {
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
          callType: this.callType
        });
      }
    };

    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        this.end(false);
      }
    };

    this.peer = peer;
    return peer;
  }

  async start(targetUserId: string, callType: CallType) {
    this.callType = callType;
    const peer = await this.ensurePeer(targetUserId);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.options.sendSignal(targetUserId, {
      type: "offer",
      sdp: offer,
      callType
    });
  }

  async prepareAnswer(targetUserId: string, callType: CallType) {
    this.callType = callType;
    this.targetUserId = targetUserId;
    await this.ensurePeer(targetUserId);
  }

  async handleSignal(fromUserId: string, signal: SignalPayload) {
    this.callType = signal.callType;
    const peer = await this.ensurePeer(fromUserId);

    if (signal.type === "offer") {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.options.sendSignal(fromUserId, {
        type: "answer",
        sdp: answer,
        callType: this.callType
      });
      return;
    }

    if (signal.type === "answer") {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      return;
    }

    if (signal.type === "ice-candidate") {
      await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }

  end(shouldNotify = true) {
    if (shouldNotify && this.targetUserId) {
      this.options.sendEnd(this.targetUserId);
    }

    this.peer?.close();
    this.peer = null;
    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.targetUserId = null;
    this.options.onLocalStream(null);
    this.options.onRemoteStream(null);
    this.options.onEnded();
  }
}

