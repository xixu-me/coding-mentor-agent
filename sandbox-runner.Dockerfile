FROM python:3.13.12-slim-bookworm

RUN python -m pip install --no-cache-dir \
    pytest==9.0.2 \
    ruff==0.14.9 \
    mypy==1.19.0

USER 65534:65534
WORKDIR /work
