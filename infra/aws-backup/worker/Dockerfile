FROM public.ecr.aws/lambda/nodejs:22 AS runtime

RUN dnf upgrade -y \
    && dnf install -y postgresql17 \
    && dnf clean all \
    && pg_dump --version \
    && pg_restore --version

COPY dist/aws-backup-worker/handler.cjs ${LAMBDA_TASK_ROOT}/handler.cjs

CMD ["handler.handler"]
