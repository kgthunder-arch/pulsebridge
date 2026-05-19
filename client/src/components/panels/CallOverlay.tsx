import { useEffect, useRef } from "react";
import { PhoneOff } from "lucide-react";

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

  return (
    <div className="call-overlay">
      <div className="call-card">
        <div className="call-copy">
          <span className="eyebrow">{callType} call</span>
          <h3>{targetLabel}</h3>
          <p>{status}</p>
        </div>
        {callType === "video" ? (
          <div className="call-media">
            <video ref={remoteVideoRef} autoPlay playsInline muted={false} />
            <video ref={localVideoRef} autoPlay playsInline muted />
          </div>
        ) : (
          <div className="call-audio-shell">
            <div className="call-audio-card">
              <strong>{targetLabel}</strong>
              <span>Voice connection active</span>
            </div>
          </div>
        )}
        <audio ref={remoteAudioRef} autoPlay playsInline />
        <audio ref={localAudioRef} autoPlay playsInline muted />
        <button className="danger-button" type="button" onClick={onEnd}>
          <PhoneOff size={16} />
          End call
        </button>
      </div>
    </div>
  );
};
