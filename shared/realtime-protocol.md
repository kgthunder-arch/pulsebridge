# PulseBridge Realtime Protocol

Socket events:

- `typing:start` / `typing:stop`
- `receipt:read`
- `message:new`
- `presence:update`
- `call:incoming`
- `call:accepted`
- `call:declined`
- `call:signal`
- `call:ended`

REST is used for persistence and offline recovery. Socket events are used for live fan-out, presence, and call signaling.

