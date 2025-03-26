FROM node:18-alpine

WORKDIR /app

COPY package.json /.

# Install dependencies
RUN apk add --no-cache python3 make g++

# Instalar node modules con arquitectura especifica
RUN npm install --build-from-source

COPY . .

RUN npx prisma generate

CMD ["npm", "start"]