# Bun custom runtime on the AWS Lambda provided.al2023 base image.
FROM oven/bun:debian AS bun
FROM public.ecr.aws/lambda/provided:al2023

COPY --from=bun /usr/local/bin/bun /opt/bun/bun

WORKDIR /var/task
COPY package.json bun.lock ./
RUN /opt/bun/bun install --production --frozen-lockfile

COPY index.mts runtime.mts ./
COPY src ./src
COPY bootstrap.sh ./bootstrap
# Strip CR in case the file was checked out with Windows line endings (CRLF breaks the shebang).
RUN sed -i 's/\r$//' ./bootstrap && chmod +x ./bootstrap

ENTRYPOINT ["/var/task/bootstrap"]
