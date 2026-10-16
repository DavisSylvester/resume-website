# services/hello-get/Dockerfile
FROM oven/bun:debian AS bun
FROM public.ecr.aws/lambda/provided:al2023

COPY --from=bun /usr/local/bin/bun /opt/bun/bun

WORKDIR /var/task
COPY package.json ./
RUN /opt/bun/bun install

COPY index.mts runtime.mts ./
COPY bootstrap.sh ./bootstrap
# Strip CR: a Windows checkout gives bootstrap CRLF endings, which breaks the shebang
# (Lambda reports Runtime.InvalidEntrypoint).
RUN sed -i 's/\r$//' ./bootstrap && chmod +x ./bootstrap

ENTRYPOINT ["/var/task/bootstrap"]
