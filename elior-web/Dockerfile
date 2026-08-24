FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Next.js membakar NEXT_PUBLIC_* ke bundle klien saat build, bukan saat runtime —
# jadi nilainya harus masuk sebagai build arg, bukan environment container.
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
ARG NEXT_PUBLIC_API_KEY=
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_API_KEY=$NEXT_PUBLIC_API_KEY

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
