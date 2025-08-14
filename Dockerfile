FROM node:slim AS ts-compiler
WORKDIR /home/container

COPY . .

RUN yarn install
RUN yarn run build

FROM node:slim AS ts-remover
WORKDIR /home/container

COPY --from=ts-compiler /home/container/package.json ./
COPY --from=ts-compiler /home/container/dist ./

RUN yarn install --production

FROM ghcr.io/puppeteer/puppeteer:latest
WORKDIR /home/container

USER root

RUN apt-get update \
    && apt-get install -y \
        fontconfig \
        fonts-dejavu-core \
        fonts-liberation \
        libgconf-2-4 \
        libxss1 \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

# Copy and set up the initialization script
COPY docker-init.sh /docker-init.sh
RUN chmod +x /docker-init.sh

USER pptruser

# Copy the built application from previous stage
COPY --from=ts-remover /home/container ./

CMD ["/docker-init.sh"]