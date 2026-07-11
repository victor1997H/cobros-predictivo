# Etapa 1: compilar NestJS
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Etapa 2: ejecutar la aplicación
FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]