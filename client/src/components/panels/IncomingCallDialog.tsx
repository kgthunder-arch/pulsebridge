import { Phone, PhoneOff, Video } from "lucide-react";

import type { CallType } from "../../lib/types";

type IncomingCallDialogProps = {
  fromUsername: string;
  callType: CallType;
  onAccept: () => void;
  onDecline: () => void;
};

export const IncomingCallDialog = ({
  fromUsername,
  callType,
  onAccept,
  onDecline
}: IncomingCallDialogProps) => {
  return (
    <div className="incoming-call-banner">
      {/* Pulsing ring behind avatar */}
      <div className="incoming-avatar-wrap">
        <div className="incoming-ring" />
        <div className="incoming-avatar">
          {fromUsername.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="incoming-info">
        <strong className="incoming-name">{fromUsername}</strong>
        <span className="incoming-type">
          {callType === "video" ? "📹 Incoming video call" : "📞 Incoming voice call"}
        </span>
      </div>

      <div className="incoming-actions">
        <button
          className="incoming-btn decline"
          type="button"
          onClick={onDecline}
          title="Decline"
        >
          <PhoneOff size={18} />
          <span>Decline</span>
        </button>
        <button
          className="incoming-btn accept"
          type="button"
          onClick={onAccept}
          title="Accept"
        >
          {callType === "video" ? <Video size={18} /> : <Phone size={18} />}
          <span>Accept</span>
        </button>
      </div>
    </div>
  );
};
