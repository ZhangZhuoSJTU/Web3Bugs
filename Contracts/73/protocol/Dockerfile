FROM node:8.5.0

WORKDIR /app/

# Need .git so we can get the git head commit hash
COPY / /app/

RUN yarn
RUN yarn compile
