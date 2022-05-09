FROM node:16.13-alpine

RUN apk add --no-cache openssl g++ make py3-pip

WORKDIR /usr/src/app
COPY . .

RUN npx yarn install --frozen-lockfile
RUN npx yarn run build

CMD ["npx", "yarn", "start:prod"]
