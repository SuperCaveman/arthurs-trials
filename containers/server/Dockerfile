# Build context: a staged Linux Server directory with an ArthursTrials/ root.
# This is intentionally separate from the source repository so uncooked assets
# and the local Windows build are never copied into a server image.
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS base

RUN dnf install -y ca-certificates libcurl-minimal shadow-utils && dnf clean all \
    && useradd --create-home --shell /sbin/nologin arthurs

WORKDIR /opt/arthurs-trials

# Keep Unreal's large .debug and .sym outputs in the archived release artifact,
# not in the runtime image. They remain available for symbolication without
# inflating the managed GameLift container pull/deployment time.
FROM base AS payload
COPY --chown=arthurs:arthurs . /opt/arthurs-trials/

RUN test -x /opt/arthurs-trials/ArthursTrials/Binaries/Linux/ArthursTrialsServer \
    && mkdir -p /opt/arthurs-trials/ArthursTrials/Saved/Logs \
    && chown -R arthurs:arthurs /opt/arthurs-trials

FROM base
WORKDIR /opt/arthurs-trials

COPY --from=payload --chown=arthurs:arthurs /opt/arthurs-trials/ArthursTrials/Binaries/Linux/ArthursTrialsServer /opt/arthurs-trials/ArthursTrials/Binaries/Linux/ArthursTrialsServer
COPY --from=payload --chown=arthurs:arthurs /opt/arthurs-trials/ArthursTrials/Content /opt/arthurs-trials/ArthursTrials/Content
COPY --from=payload --chown=arthurs:arthurs --exclude=*.debug --exclude=*.sym /opt/arthurs-trials/Engine /opt/arthurs-trials/Engine
COPY --from=payload --chown=arthurs:arthurs /opt/arthurs-trials/ArthursTrialsServer.sh /opt/arthurs-trials/ArthursTrialsServer.sh
COPY --from=payload --chown=arthurs:arthurs /opt/arthurs-trials/NOTICES.txt /opt/arthurs-trials/NOTICES.txt

RUN mkdir -p /opt/arthurs-trials/ArthursTrials/Saved/Logs \
    && chown -R arthurs:arthurs /opt/arthurs-trials

USER arthurs
EXPOSE 7777/udp

ENTRYPOINT ["/opt/arthurs-trials/ArthursTrials/Binaries/Linux/ArthursTrialsServer"]
# Managed GameLift supplies the service connection details at runtime. This
# switch enables the Unreal lifecycle code that calls InitSDK/ProcessReady;
# without it, GameLift correctly keeps the fleet in activation checks.
CMD ["-port=7777", "-log", "-GameLiftEnabled", "-GameLiftRequirePlayerSession"]
