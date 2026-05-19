import { useEffect, useRef } from "react";
import { Phone, PhoneOff } from "lucide-react";

import type { CallType } from "../../lib/types";

type CallOverlayProps = {
  callType: CallType | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  status: string;
  targetLabel: string;
  onEnd: () => void;
};

export const CallOverlay = ({
  callType,
  localStream,
  remoteStream,
  status,
  targetLabel,
  onEnd
}: CallOverlayProps) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
      void localAudioRef.current.play().catch(() => undefined);
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(() => undefined);
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => undefined);
    }
  }, [remoteStream]);

  if (!callType) {
    return null;
  }

  const isVideoCall = callType === "video";

  return (
    <div className={`call-overlay ${isVideoCall ? "video-mode" : "audio-mode"}`}>
      {isVideoCall ? (
        <div className="video-call-container">
          <div className="video-remote-wrapper">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              muted={false}
              className="video-remote"
            />
          </div>
          <div className="video-local-wrapper">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted
              className="video-local"
            />
          </div>
          <div className="call-overlay-controls">
            <div className="call-info">
              <h2>{targetLabel}</h2>
              <span className="call-status">{status}</span>
            </div>
            <button 
              className="danger-button large"
              type="button" 
              onClick={onEnd}
              title="End video call"
            >
              <PhoneOff size={24} />
              End call
            </button>
          </div>
        </div>
      ) : (
        <div className="audio-call-container">
          <div className="audio-call-card">
            <div className="audio-icon">
              <Phone size={64} />
            </div>
            <div className="audio-info">
              <h2>{targetLabel}</h2>
              <p className="call-status">{status}</p>
              <span className="audio-hint">Voice connection active</span>
            </div>
            <button 
              className="danger-button large"
              type="button" 
              onClick={onEnd}
              title="End voice call"
            >
              <PhoneOff size={24} />
              End call
            </button>
          </div>
        </div>
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <audio ref={localAudioRef} autoPlay playsInline muted />
    </div>
  );
};
