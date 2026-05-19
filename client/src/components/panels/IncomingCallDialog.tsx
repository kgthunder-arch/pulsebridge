import { Phone, Video, X } from "lucide-react";

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
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        <button
          className="close-button"
          type="button"
          onClick={onDecline}
          title="Decline"
        >
          <X size={24} />
        </button>
        
        <div className="incoming-call-content">
          <div className="call-avatar">
            {callType === "video" ? (
              <Video size={48} />
            ) : (
              <Phone size={48} />
            )}
          </div>
          
          <div className="call-info">
            <h2>{fromUsername}</h2>
            <p>{callType === "video" ? "Video call" : "Voice call"} incoming</p>
          </div>
        </div>

        <div className="incoming-call-actions">
          <button
            className="danger-button large"
            type="button"
            onClick={onDecline}
            title="Decline call"
          >
            <X size={24} />
            Decline
          </button>
          <button
            className="primary-button large"
            type="button"
            onClick={onAccept}
            title="Accept call"
          >
            {callType === "video" ? (
              <Video size={24} />
            ) : (
              <Phone size={24} />
            )}
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
