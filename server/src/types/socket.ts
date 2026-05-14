export type CallSignalPayload =
  | { type: "offer"; sdp: RTCSessionDescriptionInit; callType: "audio" | "video" }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; callType: "audio" | "video" }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; callType: "audio" | "video" };

