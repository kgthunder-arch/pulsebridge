import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, PhoneOff, ScreenShare } from "lucide-react";

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

  const [isMuted,      setIsMuted]      = useState(false);
  const [isCamOff,     setIsCamOff]     = useState(false);
  const [isSharing,    setIsSharing]    = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLive = status === "Live";
  const timer  = useElapsedTimer(isLive);

  /* ── attach streams ── */
  useEffect(() => {
    if (localVideoRef.current)  localVideoRef.current.srcObject  = localStream;
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

  /* ── auto-hide controls after 3 s of no mouse movement ── */
  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    if (callType === "video") resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callType]);

  /* ── mic toggle ── */
  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((p) => !p);
  };

  /* ── camera toggle ── */
  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isCamOff; });
    setIsCamOff((p) => !p);
  };

  /* ── screen share ── */
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

  /* ────────────────────────────── VIDEO CALL ─────────────────────────────── */
  if (callType === "video") {
    return (
      <div
        className="call-overlay video-overlay"
        onMouseMove={resetHideTimer}
        onTouchStart={resetHideTimer}
      >
        {/* Remote full-screen */}
        <video
          ref={remoteVideoRef}
          className="remote-video-full"
          autoPlay
          playsInline
          muted={false}
        />
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Gradient scrim top */}
        <div className="call-scrim-top">
          <div className="call-peer-info">
            <span className="call-peer-name">{targetLabel}</span>
            <span className={`call-status-badge ${isLive ? "live" : ""}`}>
              {isLive ? `🔴 ${timer}` : status}
            </span>
          </div>
        </div>

        {/* Local PiP */}
        <div className="pip-container">
          <video
            ref={localVideoRef}
            className="pip-video"
            autoPlay
            playsInline
            muted
          />
          {isCamOff && (
            <div className="pip-cam-off">
              <CameraOff size={20} />
            </div>
          )}
        </div>

        {/* Controls bar - auto-hides */}
        <div className={`call-controls-bar ${showControls ? "visible" : "hidden"}`}>
          <button
            className={`call-ctrl-btn ${isMuted ? "danger" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            <span>{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            className={`call-ctrl-btn ${isCamOff ? "danger" : ""}`}
            onClick={toggleCam}
            title={isCamOff ? "Turn on camera" : "Turn off camera"}
          >
            {isCamOff ? <CameraOff size={20} /> : <Camera size={20} />}
            <span>{isCamOff ? "Start cam" : "Stop cam"}</span>
          </button>

          <button
            className={`call-ctrl-btn end-call-btn`}
            onClick={onEnd}
            title="End call"
          >
            <PhoneOff size={22} />
            <span>End</span>
          </button>

          <button
            className={`call-ctrl-btn ${isSharing ? "active-share" : ""}`}
            onClick={() => void toggleScreenShare()}
            title={isSharing ? "Stop sharing" : "Share screen"}
          >
            <ScreenShare size={20} />
            <span>{isSharing ? "Stop share" : "Share"}</span>
          </button>
        </div>
      </div>
    );
  }

  /* ────────────────────────────── VOICE CALL ─────────────────────────────── */
  return (
    <div className="call-overlay voice-overlay">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="voice-call-card">
        {/* Animated avatar rings */}
        <div className="voice-avatar-wrap">
          <div className={`voice-ring ring-3 ${isLive ? "pulsing" : ""}`} />
          <div className={`voice-ring ring-2 ${isLive ? "pulsing" : ""}`} />
          <div className={`voice-ring ring-1 ${isLive ? "pulsing" : ""}`} />
          <div className="voice-avatar">
            {targetLabel.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Call info */}
        <div className="voice-call-info">
          <h2 className="voice-peer-name">{targetLabel}</h2>
          <div className={`voice-status ${isLive ? "live" : ""}`}>
            {isLive ? (
              <>
                <span className="live-dot" />
                <span>{timer}</span>
              </>
            ) : (
              <span>{status}</span>
            )}
          </div>
          {isMuted && (
            <span className="muted-badge">
              <MicOff size={12} /> Muted
            </span>
          )}
        </div>

        {/* Voice controls */}
        <div className="voice-controls">
          <button
            className={`voice-ctrl-btn ${isMuted ? "danger" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            <span>{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            className="voice-ctrl-btn end"
            onClick={onEnd}
            title="End call"
          >
            <PhoneOff size={24} />
            <span>End call</span>
          </button>

          <button
            className={`voice-ctrl-btn ${isSharing ? "active-share" : ""}`}
            onClick={() => void toggleScreenShare()}
            title="Share screen"
          >
            <ScreenShare size={22} />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
