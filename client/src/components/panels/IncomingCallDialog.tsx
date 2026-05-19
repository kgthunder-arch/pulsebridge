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
    <div className="incoming-call-banner">
      <div>
        <strong>{fromUsername}</strong>
        <span>{callType === "video" ? "Video" : "Voice"} call incoming</span>
      </div>
      <div className="button-row">
        <button 
          className="ghost-button compact" 
          type="button" 
          onClick={onDecline}
          title="Decline call"
        >
          <X size={16} />
          Decline
        </button>
        <button 
          className="primary-button compact" 
          type="button" 
          onClick={onAccept}
          title="Accept call"
        >
          {callType === "video" ? (
            <Video size={16} />
          ) : (
            <Phone size={16} />
          )}
          Accept
        </button>
      </div>
    </div>
  );
};
