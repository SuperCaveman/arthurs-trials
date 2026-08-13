FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

ENV NODE_ENV=production \
    RESULTS_STORE=memory

USER node

CMD ["node", "src/sqs-consumer.mjs"]
