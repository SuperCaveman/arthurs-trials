# Local operations dashboard

The local dashboard turns a completed GameLift Anywhere proof into a
recording-friendly, static HTML operations view. It is a local evidence
artifact, not a CloudWatch deployment.

## What it proves

- the dedicated server completed `ProcessReady`;
- GameLift activated a session on the registered local compute;
- the authoritative server published a match-completion event;
- the results worker processed the server-produced event; and
- GameLift initiated the server's clean termination.

The dashboard intentionally labels managed cloud and CloudWatch as not
deployed/planned. It does not make an unearned claim that a local HTML report
is a production monitoring system.

## Generate a report

After completing the optional match-results flow in the
[runbook](RUNBOOK.md), run:

```powershell
node ./scripts/Generate-LocalOperationsDashboard.mjs `
  --server-log ./build/WindowsServer-GameLift/ArthursTrials/Saved/Logs/ArthursTrials.log `
  --outbox ./logs/match-results-outbox-demo `
  --output ./logs/dashboard/local-operations-proof.html
```

Open the generated file in a browser for the recording. It displays only
derived lifecycle labels, timestamps, participant count, and XP award. The
generator never embeds raw server-log content, account numbers, GameLift game
session IDs, player-session IDs, auth tokens, or command lines.

## Production direction

During an explicitly approved managed demo, the same event names and lifecycle
dimensions become structured application logs and CloudWatch dashboard/alarm
inputs. The default-off Terraform template now covers result-queue age, DLQ
depth, ECS worker CPU/memory, and RDS free storage. It deliberately creates no
notification service: alarm actions stay empty until an approved existing
operator destination is provided. GameLift capacity/health, placement
wait/failure, API latency, and structured worker-failure signals remain the
next observability expansion. Those resources remain disabled to preserve the
project's low-cost default.
