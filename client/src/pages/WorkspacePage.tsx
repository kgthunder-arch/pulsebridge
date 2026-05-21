import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { Socket } from "socket.io-client";

import { ConversationRail } from "../components/chat/ConversationRail";
import { ConversationStage } from "../components/chat/ConversationStage";
import { CallOverlay } from "../components/panels/CallOverlay";
import { IncomingCallDialog } from "../components/panels/IncomingCallDialog";
import { InsightPanel } from "../components/panels/InsightPanel";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import {
  decryptMessage,
  encryptMessageForConversation,
  fingerprintKey
} from "../lib/crypto";
import { createRealtimeSocket } from "../lib/socket";
import {
  queueDraft,
  readQueuedDrafts,
  readThemePreference,
  saveQueuedDrafts,
  saveThemePreference
} from "../lib/storage";
import type {
  AttachmentPayload,
  AuthUser,
  CallType,
  ContactRequest,
  Conversation,
  ConversationParticipant,
  DecryptedMessage,
  IceConfig,
  IncomingCallState,
  MessageReaction,
  QueuedMessageDraft,
  ServerMessage
} from "../lib/types";
import { DirectCallManager } from "../lib/webrtc";

const conversationTitle = (conversation: Conversation | null, currentUserId: string) => {
  if (!conversation) {
    return "";
  }

  if (conversation.type === "direct") {
    return (
      conversation.participants.find((participant) => participant.userId !== currentUserId)?.username ??
      "Direct chat"
    );
  }

  return conversation.name || conversation.topic || "Untitled";
};

const upsertMessage = (messages: DecryptedMessage[], next: DecryptedMessage) => {
  const existingIndex = messages.findIndex((message) => message.id === next.id);

  if (existingIndex === -1) {
    return [...messages, next].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  }

  return messages.map((message) => (message.id === next.id ? next : message));
};

export const WorkspacePage = () => {
  const { token, user, privateKey, updateCurrentUser, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [rooms, setRooms] = useState<Conversation[]>([]);
  const [discoverableUsers, setDiscoverableUsers] = useState<AuthUser[]>([]);
  const [friends, setFriends] = useState<AuthUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, DecryptedMessage[]>>({});
  const [activeConversationId, setActiveConversationId] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [smartReplies, setSmartReplies] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [themeMode, setThemeMode] = useState<"dark" | "light">(readThemePreference());
  const [keyFingerprint, setKeyFingerprint] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [callStatus, setCallStatus] = useState("Idle");
  const [callTargetLabel, setCallTargetLabel] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [iceConfig, setIceConfig] = useState<IceConfig>({ iceServers: [] });
  const [installPromptReady, setInstallPromptReady] = useState(false);
  const filteredSearch = useDeferredValue(searchTerm);
  const deferredPeopleSearch = useDeferredValue(peopleSearch);
  const socketRef = useRef<Socket | null>(null);
  const callSessionRef = useRef<{ conversationId: string; targetUserId: string } | null>(null);
  const callManagerRef = useRef<DirectCallManager | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const installPromptRef = useRef<any>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  const visibleConversations = useMemo(() => {
    const query = filteredSearch.toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversationTitle(conversation, user!.id).toLowerCase().includes(query)
    );
  }, [conversations, filteredSearch, user]);

  const activeMessages = useMemo(() => {
    if (!activeConversationId) {
      return [];
    }

    return (messagesByConversation[activeConversationId] ?? []).filter(
      (message) => !message.expiresAt || new Date(message.expiresAt).getTime() > Date.now()
    );
  }, [activeConversationId, messagesByConversation]);

  const materializeMessage = async (message: ServerMessage) => {
    const content = await decryptMessage(message, privateKey!, user!.id);
    return { ...message, content, reactions: message.reactions ?? [] } satisfies DecryptedMessage;
  };

  const syncTranslation = async (message: DecryptedMessage) => {
    if (!token || !user || !message.content.text || message.senderId === user.id) {
      return;
    }

    if (user.preferredLanguage === "en") {
      return;
    }

    try {
      const data = await apiRequest<{ translatedText: string }>("/api/ai/translate", {
        method: "POST",
        token,
        body: JSON.stringify({
          text: message.content.text,
          targetLanguage: user.preferredLanguage
        })
      });

      setMessagesByConversation((current) => ({
        ...current,
        [message.conversationId]: (current[message.conversationId] ?? []).map((item) =>
          item.id === message.id ? { ...item, translatedText: data.translatedText } : item
        )
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    if (!token) {
      return;
    }

    const data = await apiRequest<{ messages: ServerMessage[] }>(
      `/api/conversations/${conversationId}/messages`,
      {
        method: "GET",
        token
      }
    );

    const hydrated = await Promise.all(data.messages.map(materializeMessage));
    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: hydrated
    }));

    const lastIncoming = hydrated.filter((message) => message.senderId !== user!.id).at(-1);

    if (lastIncoming) {
      void syncTranslation(lastIncoming);
    }
  };

  const refreshSmartReplies = async (conversationId: string, messages: DecryptedMessage[]) => {
    if (!token || messages.length === 0) {
      return;
    }

    const latest = messages[messages.length - 1];

    if (latest.senderId === user!.id) {
      setSmartReplies((current) => ({ ...current, [conversationId]: [] }));
      return;
    }

    try {
      const data = await apiRequest<{ replies: string[] }>("/api/ai/smart-replies", {
        method: "POST",
        token,
        body: JSON.stringify({
          messages: messages
            .slice(-5)
            .map((message) => `${message.sender?.username ?? "Unknown"}: ${message.content.text}`),
          targetLanguage: user!.preferredLanguage
        })
      });

      setSmartReplies((current) => ({ ...current, [conversationId]: data.replies }));
    } catch (error) {
      console.error(error);
    }
  };

  const markConversationRead = (conversationId: string, messages: DecryptedMessage[]) => {
    if (!user?.readReceiptsEnabled) {
      return;
    }

    const unread = messages.filter(
      (message) =>
        message.senderId !== user!.id &&
        message.recipientKeys.find((recipient) => recipient.userId === user!.id && !recipient.readAt)
    );

    unread.forEach((message) => {
      socketRef.current?.emit("receipt:read", { conversationId, messageId: message.id });
    });
  };

  const sendEncryptedMessage = async (
    conversationId: string,
    text: string,
    attachments: AttachmentPayload[],
    expiresAt: string | null,
    queueOnFailure = true
  ) => {
    if (!token || !user) {
      return;
    }

    const conversation = conversations.find((item) => item.id === conversationId);

    if (!conversation || (!text.trim() && attachments.length === 0)) {
      return;
    }

    const encryptedPayload = await encryptMessageForConversation(
      {
        text: text.trim(),
        attachments
      },
      conversation.participants
    );

    const clientGeneratedId = crypto.randomUUID();

    try {
      const data = await apiRequest<{ message: ServerMessage }>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            ...encryptedPayload,
            clientGeneratedId,
            expiresAt
          })
        }
      );

      socketRef.current?.emit("message:published", {
        conversationId,
        message: data.message
      });

      const hydrated = await materializeMessage(data.message);
      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: upsertMessage(current[conversationId] ?? [], hydrated)
      }));
      await refreshSmartReplies(conversationId, [...(messagesByConversation[conversationId] ?? []), hydrated]);
    } catch (error) {
      if (queueOnFailure) {
        queueDraft({
          id: clientGeneratedId,
          conversationId,
          text,
          attachments,
          expiresAt,
          createdAt: new Date().toISOString()
        });
      }

      throw error;
    }
  };

  const syncQueuedMessages = async () => {
    const drafts = readQueuedDrafts();

    if (drafts.length === 0) {
      return;
    }

    const remaining: QueuedMessageDraft[] = [];

    for (const draft of drafts) {
      try {
        await sendEncryptedMessage(draft.conversationId, draft.text, draft.attachments, draft.expiresAt, false);
      } catch (error) {
        remaining.push(draft);
      }
    }

    saveQueuedDrafts(remaining);
  };

  const bootWorkspace = async () => {
    if (!token || !user) {
      return;
    }

    const [conversationData, userData, configData, contactsData] = await Promise.all([
      apiRequest<{ conversations: Conversation[]; discoverableRooms: Conversation[] }>("/api/conversations", {
        method: "GET",
        token
      }),
      apiRequest<{ users: AuthUser[] }>("/api/users/discover", {
        method: "GET",
        token
      }),
      apiRequest<IceConfig>("/api/config/realtime", {
        method: "GET",
        token
      }),
      apiRequest<{
        friends: AuthUser[];
        incomingRequests: ContactRequest[];
        outgoingRequests: ContactRequest[];
      }>("/api/users/contacts", {
        method: "GET",
        token
      })
    ]);

    setConversations(conversationData.conversations);
    setRooms(conversationData.discoverableRooms);
    setDiscoverableUsers(userData.users);
    setFriends(contactsData.friends);
    setIncomingRequests(contactsData.incomingRequests);
    setOutgoingRequests(contactsData.outgoingRequests);
    setIceConfig(configData);

    startTransition(() => {
      setActiveConversationId((current) => current || conversationData.conversations[0]?.id || "");
    });
  };

  const refreshDiscoverableUsers = async (query = "") => {
    if (!token) {
      return;
    }

    const encodedQuery = encodeURIComponent(query.trim());
    const path = encodedQuery ? `/api/users/discover?q=${encodedQuery}` : "/api/users/discover";
    const userData = await apiRequest<{ users: AuthUser[] }>(path, {
      method: "GET",
      token
    });
    setDiscoverableUsers(userData.users);
  };

  const refreshContacts = async () => {
    if (!token) {
      return;
    }

    const data = await apiRequest<{
      friends: AuthUser[];
      incomingRequests: ContactRequest[];
      outgoingRequests: ContactRequest[];
    }>("/api/users/contacts", {
      method: "GET",
      token
    });

    setFriends(data.friends);
    setIncomingRequests(data.incomingRequests);
    setOutgoingRequests(data.outgoingRequests);
  };

  const notifyIfHidden = (message: DecryptedMessage) => {
    if (
      document.visibilityState === "visible" ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    new Notification(message.sender?.username ?? "New message", {
      body: message.content.text || "Shared an encrypted file"
    });
  };

  useEffect(() => {
    document.documentElement.dataset.mode = themeMode;
    saveThemePreference(themeMode);
  }, [themeMode]);

  useEffect(() => {
    // PWA install prompt
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e;
      setInstallPromptReady(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    void fingerprintKey(user.publicKey).then(setKeyFingerprint);
  }, [user]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void bootWorkspace();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshDiscoverableUsers(deferredPeopleSearch);
  }, [deferredPeopleSearch, token]);

  useEffect(() => {
    if (!activeConversationId || messagesByConversation[activeConversationId]) {
      return;
    }

    void loadConversationMessages(activeConversationId);
  }, [activeConversationId, messagesByConversation]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const nextMessages = messagesByConversation[activeConversationId] ?? [];
    if (nextMessages.length > 0) {
      markConversationRead(activeConversationId, nextMessages);
      void refreshSmartReplies(activeConversationId, nextMessages);
    }
  }, [activeConversationId, messagesByConversation]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = createRealtimeSocket(token);
    socketRef.current = socket;

    socket.on("presence:update", (payload: { userId: string; status: "online" | "offline" }) => {
      setDiscoverableUsers((current) =>
        current.map((item) => (item.id === payload.userId ? { ...item, status: payload.status } : item))
      );
      setConversations((current) =>
        current.map((conversation) => ({
          ...conversation,
          participants: conversation.participants.map((participant) =>
            participant.userId === payload.userId
              ? { ...participant, status: payload.status }
              : participant
          )
        }))
      );
    });

    socket.on(
      "typing:update",
      (payload: { conversationId: string; username: string; isTyping: boolean }) => {
        setTypingUsers((current) => {
          const existing = new Set(current[payload.conversationId] ?? []);
          if (payload.isTyping) {
            existing.add(payload.username);
          } else {
            existing.delete(payload.username);
          }

          return {
            ...current,
            [payload.conversationId]: [...existing]
          };
        });
      }
    );

    socket.on("message:new", async (message: ServerMessage) => {
      const hydrated = await materializeMessage(message);

      setMessagesByConversation((current) => ({
        ...current,
        [message.conversationId]: upsertMessage(current[message.conversationId] ?? [], hydrated)
      }));

      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === message.conversationId
              ? { ...conversation, lastMessageAt: message.createdAt }
              : conversation
          )
          .sort(
            (left, right) =>
              new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
          )
      );

      if (message.conversationId === activeConversationId) {
        markConversationRead(message.conversationId, [
          ...(messagesByConversation[message.conversationId] ?? []),
          hydrated
        ]);
      }

      void syncTranslation(hydrated);
      notifyIfHidden(hydrated);
    });

    socket.on(
      "receipt:update",
      (payload: { conversationId: string; messageId: string; userId: string; readAt: string }) => {
        setMessagesByConversation((current) => ({
          ...current,
          [payload.conversationId]: (current[payload.conversationId] ?? []).map((message) =>
            message.id === payload.messageId
              ? {
                  ...message,
                  recipientKeys: message.recipientKeys.map((recipient) =>
                    recipient.userId === payload.userId
                      ? { ...recipient, readAt: payload.readAt, deliveredAt: recipient.deliveredAt ?? payload.readAt }
                      : recipient
                  )
                }
              : message
          )
        }));
      }
    );

    socket.on("call:incoming", (payload: IncomingCallState) => {
      setIncomingCall(payload);
      setCallType(payload.callType);
      setCallStatus("Incoming call");
      setCallTargetLabel(payload.fromUsername);
    });

    socket.on(
      "call:accepted",
      async (payload: { conversationId: string; fromUserId: string; callType: CallType }) => {
        callSessionRef.current = {
          conversationId: payload.conversationId,
          targetUserId: payload.fromUserId
        };
        setCallType(payload.callType);
        setCallStatus("Connecting");
        await callManagerRef.current?.start(payload.fromUserId, payload.callType);
      }
    );

    socket.on("call:declined", () => {
      callManagerRef.current?.end(false);
      setCallType(null);
      setCallStatus("Call declined");
      setCallTargetLabel("");
    });

    socket.on(
      "call:signal",
      async (payload: {
        conversationId: string;
        fromUserId: string;
        signal: {
          type: "offer" | "answer" | "ice-candidate";
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
          callType: CallType;
        };
      }) => {
        callSessionRef.current = {
          conversationId: payload.conversationId,
          targetUserId: payload.fromUserId
        };
        setCallType(payload.signal.callType);
        setCallStatus("Live");
        await callManagerRef.current?.handleSignal(payload.fromUserId, payload.signal as never);
      }
    );

    socket.on("call:ended", () => {
      callManagerRef.current?.end(false);
      setCallType(null);
      setCallStatus("Call ended");
      setCallTargetLabel("");
    });

    socket.on("contact:request", () => {
      void refreshContacts();
      void refreshDiscoverableUsers(deferredPeopleSearch);
    });

    socket.on("contact:accepted", () => {
      void refreshContacts();
      void refreshDiscoverableUsers(deferredPeopleSearch);
    });

    socket.on(
      "reaction:update",
      (payload: { conversationId: string; messageId: string; reaction: MessageReaction }) => {
        setMessagesByConversation((current) => ({
          ...current,
          [payload.conversationId]: (current[payload.conversationId] ?? []).map((message) =>
            message.id === payload.messageId
              ? {
                  ...message,
                  reactions: [
                    ...(message.reactions ?? []).filter((r) => r.id !== payload.reaction.id),
                    payload.reaction
                  ]
                }
              : message
          )
        }));
      }
    );

    socket.on(
      "reaction:removed",
      (payload: { conversationId: string; messageId: string; userId: string; emoji: string }) => {
        setMessagesByConversation((current) => ({
          ...current,
          [payload.conversationId]: (current[payload.conversationId] ?? []).map((message) =>
            message.id === payload.messageId
              ? {
                  ...message,
                  reactions: (message.reactions ?? []).filter(
                    (r) => !(r.userId === payload.userId && r.emoji === payload.emoji)
                  )
                }
              : message
          )
        }));
      }
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeConversationId, deferredPeopleSearch, token]);

  useEffect(() => {
    callManagerRef.current = new DirectCallManager({
      iceServers: iceConfig.iceServers,
      onLocalStream: setLocalStream,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (stream) {
          setCallStatus("Live");
        }
      },
      onEnded: () => {
        setCallType(null);
        setLocalStream(null);
        setRemoteStream(null);
        setCallTargetLabel("");
      },
      sendSignal: (targetUserId, signal) => {
        const session = callSessionRef.current;
        if (!session) {
          return;
        }

        socketRef.current?.emit("call:signal", {
          conversationId: session.conversationId,
          targetUserId,
          signal
        });
      },
      sendEnd: (targetUserId) => {
        const session = callSessionRef.current;
        if (!session) {
          return;
        }

        socketRef.current?.emit("call:end", {
          conversationId: session.conversationId,
          targetUserId
        });
      }
    });

    return () => {
      callManagerRef.current?.end(false);
    };
  }, [iceConfig]);

  useEffect(() => {
    const handleOnline = () => {
      void syncQueuedMessages();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [conversations, token]);

  const startDirectConversation = async (targetUserId: string) => {
    if (!token) {
      return null;
    }

    const data = await apiRequest<{ conversation: Conversation }>("/api/conversations/direct", {
      method: "POST",
      token,
      body: JSON.stringify({ targetUserId })
    });

    setConversations((current) => {
      const exists = current.some((conversation) => conversation.id === data.conversation.id);
      return exists ? current : [data.conversation, ...current];
    });
    setActiveConversationId(data.conversation.id);
    socketRef.current?.emit("conversation:join", data.conversation.id);
    return data.conversation;
  };

  const startQuickCall = async (targetUserId: string, nextCallType: CallType) => {
    const conversation = await startDirectConversation(targetUserId);

    if (!conversation) {
      return;
    }

    const target = conversation.participants.find((participant) => participant.userId !== user!.id);

    if (!target) {
      return;
    }

    callSessionRef.current = {
      conversationId: conversation.id,
      targetUserId: target.userId
    };
    setCallType(nextCallType);
    setCallStatus("Dialing");
    setCallTargetLabel(target.username);

    socketRef.current?.emit("call:initiate", {
      conversationId: conversation.id,
      targetUserId: target.userId,
      callType: nextCallType
    });
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!token) {
      return;
    }

    await apiRequest<{ status: string }>("/api/users/contacts/requests", {
      method: "POST",
      token,
      body: JSON.stringify({ targetUserId })
    });

    await Promise.all([refreshContacts(), refreshDiscoverableUsers(peopleSearch)]);
  };

  const acceptFriendRequest = async (requestId: string) => {
    if (!token) {
      return;
    }

    await apiRequest<{ status: string }>(`/api/users/contacts/requests/${requestId}/accept`, {
      method: "POST",
      token
    });

    await Promise.all([refreshContacts(), refreshDiscoverableUsers(peopleSearch)]);
  };

  const declineFriendRequest = async (requestId: string) => {
    if (!token) {
      return;
    }

    await apiRequest<{ status: string }>(`/api/users/contacts/requests/${requestId}/decline`, {
      method: "POST",
      token
    });

    await Promise.all([refreshContacts(), refreshDiscoverableUsers(peopleSearch)]);
  };

  const updatePrivacy = async (input: Partial<Pick<AuthUser, "allowFriendRequests" | "readReceiptsEnabled">>) => {
    if (!token) {
      return;
    }

    const data = await apiRequest<{ user: AuthUser }>("/api/users/privacy", {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });

    updateCurrentUser(data.user);
    await Promise.all([refreshContacts(), refreshDiscoverableUsers(peopleSearch)]);
  };

  const createGroupConversation = async () => {
    if (!token || !groupName.trim() || selectedGroupMembers.length < 2) {
      return;
    }

    const data = await apiRequest<{ conversation: Conversation }>("/api/conversations/group", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: groupName.trim(),
        participantIds: selectedGroupMembers
      })
    });

    setConversations((current) => [data.conversation, ...current]);
    setGroupName("");
    setSelectedGroupMembers([]);
    setActiveConversationId(data.conversation.id);
  };

  const joinRoom = async (roomId: string) => {
    if (!token) {
      return;
    }

    const data = await apiRequest<{ conversation: Conversation }>(
      `/api/conversations/rooms/${roomId}/join`,
      {
        method: "POST",
        token
      }
    );

    setConversations((current) => [data.conversation, ...current]);
    setRooms((current) => current.filter((room) => room.id !== roomId));
    setActiveConversationId(data.conversation.id);
  };

  const leaveRoomConversation = async (roomId: string) => {
    if (!token) {
      return;
    }

    const data = await apiRequest<{ room: Conversation }>(`/api/conversations/rooms/${roomId}/leave`, {
      method: "POST",
      token
    });

    const remainingConversations = conversations.filter((conversation) => conversation.id !== roomId);

    setConversations(remainingConversations);
    setRooms((current) =>
      [...current, data.room].sort((left, right) => left.name.localeCompare(right.name))
    );
    setMessagesByConversation((current) => {
      const next = { ...current };
      delete next[roomId];
      return next;
    });
    setTypingUsers((current) => {
      const next = { ...current };
      delete next[roomId];
      return next;
    });
    setSmartReplies((current) => {
      const next = { ...current };
      delete next[roomId];
      return next;
    });
    if (activeConversationId === roomId) {
      setActiveConversationId(remainingConversations[0]?.id ?? "");
    }
  };

  const startCall = async (nextCallType: CallType) => {
    if (!activeConversation || activeConversation.type !== "direct") {
      return;
    }

    const target = activeConversation.participants.find((participant: ConversationParticipant) => participant.userId !== user!.id);

    if (!target) {
      return;
    }

    callSessionRef.current = {
      conversationId: activeConversation.id,
      targetUserId: target.userId
    };
    setCallType(nextCallType);
    setCallStatus("Dialing");
    setCallTargetLabel(target.username);

    socketRef.current?.emit("call:initiate", {
      conversationId: activeConversation.id,
      targetUserId: target.userId,
      callType: nextCallType
    });
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) {
      return;
    }

    callSessionRef.current = {
      conversationId: incomingCall.conversationId,
      targetUserId: incomingCall.fromUserId
    };
    await callManagerRef.current?.prepareAnswer(incomingCall.fromUserId, incomingCall.callType);
    socketRef.current?.emit("call:accept", {
      conversationId: incomingCall.conversationId,
      targetUserId: incomingCall.fromUserId,
      callType: incomingCall.callType
    });
    setCallType(incomingCall.callType);
    setCallTargetLabel(incomingCall.fromUsername);
    setCallStatus("Connecting");
    setIncomingCall(null);
  };

  const declineIncomingCall = () => {
    if (!incomingCall) {
      return;
    }

    socketRef.current?.emit("call:decline", {
      conversationId: incomingCall.conversationId,
      targetUserId: incomingCall.fromUserId
    });
    setIncomingCall(null);
    setCallType(null);
    setCallStatus("Idle");
  };

  if (!user || !privateKey || !token) {
    return null;
  }

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Global real-time communication</span>
          <h1>PulseBridge</h1>
        </div>
        <div className="topbar-actions">
          <span className="status-chip">{navigator.onLine ? "Online sync" : "Offline queueing"}</span>
          {installPromptReady ? (
            <button
              className="install-btn"
              type="button"
              onClick={async () => {
                if (!installPromptRef.current) return;
                await installPromptRef.current.prompt();
                const { outcome } = await installPromptRef.current.userChoice;
                if (outcome === "accepted") {
                  installPromptRef.current = null;
                  setInstallPromptReady(false);
                }
              }}
            >
              ⬇ Install App
            </button>
          ) : null}
          <button className="ghost-button compact" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="settings-strip">
        <div className="settings-sections-grid">

          {/* 🔐 Identity & Security */}
          <article className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-icon">🔐</span>
              <div>
                <span className="eyebrow">Identity</span>
                <h3>Security</h3>
              </div>
            </div>
            <div className="settings-metric">
              <strong>Signed in as</strong>
              <span>{user.username}</span>
            </div>
            <div className="settings-metric">
              <strong>Encryption fingerprint</strong>
              <span className="fingerprint-val">{keyFingerprint || "Generating…"}</span>
            </div>
          </article>

          {/* 🔔 Notifications & Privacy */}
          <article className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-icon">🔔</span>
              <div>
                <span className="eyebrow">Privacy</span>
                <h3>Notifications</h3>
              </div>
            </div>
            <div className="settings-metric">
              <strong>Notifications</strong>
              <span>{notificationsEnabled ? "Enabled" : "Off"}</span>
            </div>
            <div className="settings-metric">
              <strong>Friend requests</strong>
              <span>{user.allowFriendRequests ? "Open" : "Paused"}</span>
            </div>
            <div className="settings-metric">
              <strong>Read receipts</strong>
              <span>{user.readReceiptsEnabled ? "Visible" : "Hidden"}</span>
            </div>
            <div className="button-row">
              <button
                className="ghost-button compact"
                type="button"
                onClick={() => void updatePrivacy({ allowFriendRequests: !user.allowFriendRequests })}
              >
                {user.allowFriendRequests ? "Pause requests" : "Allow requests"}
              </button>
              <button
                className="ghost-button compact"
                type="button"
                onClick={() => void updatePrivacy({ readReceiptsEnabled: !user.readReceiptsEnabled })}
              >
                {user.readReceiptsEnabled ? "Hide receipts" : "Show receipts"}
              </button>
              <button
                className="primary-button compact"
                type="button"
                onClick={async () => {
                  if (typeof Notification === "undefined") return;
                  const permission = await Notification.requestPermission();
                  setNotificationsEnabled(permission === "granted");
                }}
              >
                {notificationsEnabled ? "✓ Notifications on" : "Enable notifications"}
              </button>
            </div>
          </article>

          {/* 🎨 Appearance */}
          <article className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-icon">🎨</span>
              <div>
                <span className="eyebrow">Display</span>
                <h3>Appearance</h3>
              </div>
            </div>
            <div className="settings-metric">
              <strong>Current theme</strong>
              <span>{themeMode === "dark" ? "🌙 Dark mode" : "☀️ Light mode"}</span>
            </div>
            <button
              className="ghost-button compact"
              type="button"
              onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
            >
              Switch to {themeMode === "dark" ? "light ☀️" : "dark 🌙"}
            </button>
          </article>

          {/* 📱 Install App */}
          <article className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-icon">📱</span>
              <div>
                <span className="eyebrow">Progressive Web App</span>
                <h3>Install App</h3>
              </div>
            </div>
            <p className="quiet-copy">Install PulseBridge on your device for a faster, native-like experience — works offline too.</p>
            {installPromptReady ? (
              <button
                className="install-btn"
                type="button"
                onClick={async () => {
                  if (!installPromptRef.current) return;
                  await installPromptRef.current.prompt();
                  const { outcome } = await installPromptRef.current.userChoice;
                  if (outcome === "accepted") {
                    installPromptRef.current = null;
                    setInstallPromptReady(false);
                  }
                }}
              >
                ⬇ Install PulseBridge
              </button>
            ) : (
              <span className="quiet-copy settings-metric">App is already installed or your browser does not support installation.</span>
            )}
          </article>

        </div>
      </section>

      <section className="workspace-grid">
        <ConversationRail
          currentUserId={user.id}
          conversations={visibleConversations}
          rooms={rooms}
          activeConversationId={activeConversationId}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSelectConversation={(conversationId) => {
            setActiveConversationId(conversationId);
            socketRef.current?.emit("conversation:join", conversationId);
          }}
          onJoinRoom={(roomId) => void joinRoom(roomId)}
        />

        <ConversationStage
          conversation={activeConversation}
          currentUserId={user.id}
          messages={activeMessages}
          typingUsers={typingUsers[activeConversationId] ?? []}
          smartReplies={smartReplies[activeConversationId] ?? []}
          localStream={localStream}
          callActive={callType !== null}
          onSend={async ({ text, attachments, expiresAt }) => {
            await sendEncryptedMessage(activeConversationId, text, attachments, expiresAt);
          }}
          onTypingChange={(isTyping) => {
            if (!activeConversationId) {
              return;
            }

            socketRef.current?.emit(isTyping ? "typing:start" : "typing:stop", {
              conversationId: activeConversationId
            });
          }}
          onStartCall={(nextCallType) => void startCall(nextCallType)}
          onLeaveRoom={leaveRoomConversation}
          onReact={(messageId, emoji) => {
            socketRef.current?.emit("reaction:add", {
              conversationId: activeConversationId,
              messageId,
              emoji
            });
          }}
          onRemoveReact={(messageId, emoji) => {
            socketRef.current?.emit("reaction:remove", {
              conversationId: activeConversationId,
              messageId,
              emoji
            });
          }}
        />

        <InsightPanel
          discoverableUsers={discoverableUsers}
          friends={friends}
          incomingRequests={incomingRequests}
          outgoingRequests={outgoingRequests}
          peopleSearch={peopleSearch}
          groupName={groupName}
          selectedGroupMembers={selectedGroupMembers}
          activeConversation={activeConversation}
          onPeopleSearchChange={setPeopleSearch}
          onGroupNameChange={setGroupName}
          onToggleMember={(userId) =>
            setSelectedGroupMembers((current) =>
              current.includes(userId)
                ? current.filter((item) => item !== userId)
                : [...current, userId]
            )
          }
          onCreateGroup={createGroupConversation}
          onStartDirect={async (userId) => {
            await startDirectConversation(userId);
          }}
          onStartQuickCall={startQuickCall}
          onSendFriendRequest={sendFriendRequest}
          onAcceptRequest={acceptFriendRequest}
          onDeclineRequest={declineFriendRequest}
        />
      </section>

      {incomingCall ? (
        <IncomingCallDialog
          fromUsername={incomingCall.fromUsername}
          callType={incomingCall.callType}
          onAccept={() => void acceptIncomingCall()}
          onDecline={declineIncomingCall}
        />
      ) : null}

      <CallOverlay
        callType={callType}
        localStream={localStream}
        remoteStream={remoteStream}
        status={callStatus}
        targetLabel={callTargetLabel}
        onEnd={() => callManagerRef.current?.end()}
      />
    </main>
  );
};
