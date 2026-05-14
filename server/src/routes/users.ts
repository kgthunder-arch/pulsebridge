import { Router } from "express";

import { authMiddleware, type AuthedRequest } from "../middleware/auth.js";
import {
  acceptFriendRequest,
  declineFriendRequest,
  listFriendships,
  listPendingFriendRequests,
  searchUsers,
  sendFriendRequest,
  updateUserPrivacy
} from "../repositories/users.js";
import { sanitizeUser } from "../services/serializers.js";
import { presenceStore } from "../socket/presence.js";

const router = Router();

router.use(authMiddleware);

router.get("/discover", async (request: AuthedRequest, response) => {
  const query = String(request.query.q ?? "").trim();
  const users = await searchUsers(request.auth!.id, query);
  response.json({ users: users.map(sanitizeUser) });
});

router.get("/contacts", async (request: AuthedRequest, response) => {
  const [friends, requests] = await Promise.all([
    listFriendships(request.auth!.id),
    listPendingFriendRequests(request.auth!.id)
  ]);

  response.json({
    friends: friends.map(sanitizeUser),
    incomingRequests: requests.incoming.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      user: sanitizeUser(item.otherUser)
    })),
    outgoingRequests: requests.outgoing.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      user: sanitizeUser(item.otherUser)
    }))
  });
});

router.post("/contacts/requests", async (request: AuthedRequest, response) => {
  try {
    const { targetUserId } = request.body ?? {};

    if (!targetUserId) {
      response.status(400).json({ error: "targetUserId is required." });
      return;
    }

    const result = await sendFriendRequest(request.auth!.id, String(targetUserId));

    if (result.type === "pending" && targetUserId) {
      presenceStore.emitToUser(String(targetUserId), "contact:request", {
        fromUserId: request.auth!.id,
        fromUsername: request.auth!.username
      });
    }

    if (result.type === "accepted" || result.type === "friends") {
      presenceStore.emitToUser(String(targetUserId), "contact:accepted", {
        userId: request.auth!.id
      });
    }

    response.status(201).json({ status: result.type });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to send friend request."
    });
  }
});

router.post("/contacts/requests/:requestId/accept", async (request: AuthedRequest, response) => {
  const accepted = await acceptFriendRequest(request.auth!.id, String(request.params.requestId));

  if (!accepted) {
    response.status(404).json({ error: "Friend request not found." });
    return;
  }

  presenceStore.emitToUser(String(accepted.sender_id), "contact:accepted", {
    userId: request.auth!.id
  });

  response.json({ status: "accepted" });
});

router.post("/contacts/requests/:requestId/decline", async (request: AuthedRequest, response) => {
  const declined = await declineFriendRequest(request.auth!.id, String(request.params.requestId));

  if (!declined) {
    response.status(404).json({ error: "Friend request not found." });
    return;
  }

  response.json({ status: "declined" });
});

router.patch("/privacy", async (request: AuthedRequest, response) => {
  const { allowFriendRequests, readReceiptsEnabled } = request.body ?? {};

  const user = await updateUserPrivacy(request.auth!.id, {
    allowFriendRequests,
    readReceiptsEnabled
  });

  if (!user) {
    response.status(404).json({ error: "User not found." });
    return;
  }

  response.json({ user: sanitizeUser(user) });
});

export default router;
