FROM node:slim AS ts-compiler
WORKDIR /home/container

COPY . .
RUN yarn install --ignore-scripts
RUN yarn run build

FROM node:slim AS ts-remover

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y xvfb
WORKDIR /home/container

COPY --from=ts-compiler /home/container/package.json ./
COPY --from=ts-compiler /home/container/dist ./

COPY docker-init.sh /docker-init.sh
RUN chmod +x /docker-init.sh

RUN yarn install --production

CMD ["/docker-init.sh"]