# Architecture visual

![Arthur's Trials architecture](assets/arthurs-trials-architecture.svg)

The diagram deliberately separates evidence from intent:

- The teal lane is working locally: Unreal client/server, GameLift Servers
  Anywhere lifecycle, player-session admission, health behavior, and
  authoritative local result processing.
- The purple lane is the default-off managed AWS design. Its Terraform,
  container, queue, worker, database, observability, and placement components
  are versioned and validated, but are not described as deployed until a
  separately approved, time-boxed test creates them.

This distinction is central to the portfolio claim. It demonstrates how the
platform fits together while preserving an honest boundary between local proof
and planned managed operation.
