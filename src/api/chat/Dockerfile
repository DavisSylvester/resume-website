FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0 AS aws-lambda-adapter

# 2) Bun runtime image
FROM oven/bun:debian AS bun_latest

# Copy the Lambda adapter extension into /opt/extensions
COPY --from=aws-lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter

# Lambda Web Adapter expects your web app on port 8080 by default
ENV PORT=8080

WORKDIR /var/task

# Copy app
COPY . /var/task

# Run your Bun app (entrypoint)
CMD ["bun", "src/index.mts"]