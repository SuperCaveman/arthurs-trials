# Build context: a staged Linux Server directory with an ArthursTrials/ root.
# This is intentionally separate from the source repository so uncooked assets
# and the local Windows build are never copied into a server image.
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN dnf install -y ca-certificates libcurl-minimal shadow-utils && dnf clean all \
    && useradd --create-home --shell /sbin/nologin arthurs

WORKDIR /opt/arthurs-trials
COPY --chown=arthurs:arthurs . /opt/arthurs-trials/

RUN test -x /opt/arthurs-trials/ArthursTrials/Binaries/Linux/ArthursTrialsServer \
    && mkdir -p /opt/arthurs-trials/ArthursTrials/Saved/Logs \
    && chown -R arthurs:arthurs /opt/arthurs-trials

USER arthurs
EXPOSE 7777/udp

ENTRYPOINT ["/opt/arthurs-trials/ArthursTrials/Binaries/Linux/ArthursTrialsServer"]
CMD ["-port=7777", "-log"]
