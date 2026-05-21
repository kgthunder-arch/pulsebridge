import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Lock,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  PhoneOff,
  ScreenShare
} from "lucide-react";

import type { CallType } from "../../lib/types";

type CallOverlayProps = {
  callType: CallType | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  status: string;
  targetLabel: string;
  onEnd: () => void;
};

const useElapsedTimer = (active: boolean) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

export const CallOverlay = ({
  callType,
  localStream,
  remoteStream,
  status,
  targetLabel,
  onEnd
}: CallOverlayProps) => {
  const localVideoRef  = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement  | null>(null);

  const [isMuted,   setIsMuted]   = useState(false);
  const [isCamOff,  setIsCamOff]  = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [expanded,  setExpanded]  = useState(false);

  const isLive = status === "Live";
  const timer  = useElapsedTimer(isLive);

  /* ── attach streams ── */
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
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

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((p) => !p);
  };

  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isCamOff; });
    setIsCamOff((p) => !p);
  };

  const toggleScreenShare = async () => {
    if (!localStream) return;
    if (isSharing) {
      localStream.getVideoTracks().forEach((t) => t.stop());
      setIsSharing(false);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track  = screen.getVideoTracks()[0];
      const old    = localStream.getVideoTracks()[0];
      if (old) localStream.removeTrack(old);
      localStream.addTrack(track);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      setIsSharing(true);
      track.onended = () => {
        if (old) localStream.addTrack(old);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
        setIsSharing(false);
      };
    } catch { /* cancelled */ }
  };

  if (!callType) return null;

  /* ── Shared security badge ── */
  const SecurityBadge = () => (
    <div className="call-security-badge" title="End-to-end encrypted · DTLS-SRTP secured">
      <Lock size={10} />
      <span>E2EE · DTLS-SRTP</span>
    </div>
  );

  /* ────────────────────── VIDEO CALL: compact floating panel ────────────────── */
  if (callType === "video") {
    return (
      <div className={`call-float-panel video-float ${expanded ? "expanded" : ""}`}>
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Remote video */}
        <div className="float-remote-wrap">
          <video
            ref={remoteVideoRef}
            className="float-remote-video"
            autoPlay
            playsInline
            muted={false}
          />

          {/* Local PiP inside the panel */}
          <div className="float-pip">
            <video
              ref={localVideoRef}
              className="float-pip-video"
              autoPlay
              playsInline
              muted
            />
            {isCamOff && (
              <div className="float-pip-off">
                <CameraOff size={14} />
              </div>
            )}
          </div>

          {/* Top info strip */}
          <div className="float-top-strip">
            <div className="float-peer-row">
              <span className="float-peer-name">{targetLabel}</span>
              {isLive ? (
                <span className="float-timer live">🔴 {timer}</span>
              ) : (
                <span className="float-timer">{status}</span>
              )}
            </div>
            <SecurityBadge />
          </div>
        </div>

        {/* Controls row */}
        <div className="float-controls">
          <button
            className={`float-btn ${isMuted ? "active-danger" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <button
            className={`float-btn ${isCamOff ? "active-danger" : ""}`}
            onClick={toggleCam}
            title={isCamOff ? "Camera on" : "Camera off"}
          >
            {isCamOff ? <CameraOff size={15} /> : <Camera size={15} />}
          </button>

          <button
            className={`float-btn ${isSharing ? "active-share" : ""}`}
            onClick={() => void toggleScreenShare()}
            title={isSharing ? "Stop sharing" : "Share screen"}
          >
            <ScreenShare size={15} />
          </button>

          <button
            className="float-btn"
            onClick={() => setExpanded((p) => !p)}
            title={expanded ? "Shrink" : "Expand"}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            className="float-btn end"
            onClick={onEnd}
            title="End call"
          >
            <PhoneOff size={15} />
          </button>
        </div>
      </div>
    );
  }

  /* ────────────────────── VOICE CALL: compact bottom bar ───────────────────── */
  return (
    <div className="call-voice-bar">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Avatar */}
      <div className="voice-bar-avatar">
        <div className={`voice-bar-ring ${isLive ? "pulsing" : ""}`} />
        <span>{targetLabel.charAt(0).toUpperCase()}</span>
      </div>

      {/* Info */}
      <div className="voice-bar-info">
        <span className="voice-bar-name">{targetLabel}</span>
        <div className="voice-bar-meta">
          {isLive ? (
            <>
              <span className="voice-bar-dot" />
              <span className="voice-bar-timer">{timer}</span>
            </>
          ) : (
            <span className="voice-bar-status">{status}</span>
          )}
          {isMuted && <span className="voice-bar-muted"><MicOff size={10} /> Muted</span>}
        </div>
        <SecurityBadge />
      </div>

      {/* Controls */}
      <div className="voice-bar-controls">
        <button
          className={`voice-bar-btn ${isMuted ? "danger" : ""}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <button
          className={`voice-bar-btn ${isSharing ? "share" : ""}`}
          onClick={() => void toggleScreenShare()}
          title={isSharing ? "Stop sharing" : "Share screen"}
        >
          <ScreenShare size={16} />
        </button>

        <button
          className="voice-bar-btn end"
          onClick={onEnd}
          title="End call"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
};
