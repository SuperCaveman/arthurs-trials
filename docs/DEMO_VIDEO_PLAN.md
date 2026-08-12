# Portfolio demo-video plan

This is the capture plan for the first 60–90 second LinkedIn video. It shows
real evidence without stressing the development workstation with two visible
Unreal clients.

1. **Architecture (3–5 seconds):** show the architecture image and label the
   local GameLift Anywhere proof versus the planned opt-in cloud path.
2. **Control-plane request (8–12 seconds):** show the local Session API request
   and its `match_ready` event. Do not show player-session credentials.
3. **Playable proof (20–30 seconds):** show one Unreal client joining and
   moving in the map at 960×540 and 30 FPS.
4. **Server evidence (10–15 seconds):** picture-in-picture the dedicated
   server/API logs showing `AcceptPlayerSession`, binding, and `Join succeeded`.
5. **Portable-artifact shot (5–8 seconds, optional):** show the local Docker
   image inspection or server startup line proving the packaged Linux server
   runs as a non-root container on UDP `7777`. Do not imply that it is deployed.
6. **Operations close (8–12 seconds):** show GameLift graceful termination and
   the clean shutdown. Add the cost message: local development uses no managed
   game-server capacity.

Two simultaneous visible clients are optional future footage, not a requirement
for the first video. The current workstation has previously been unstable under
heavier concurrent Unreal loads. A single visible client plus real API and
GameLift lifecycle evidence is the safer, stronger first capture.
