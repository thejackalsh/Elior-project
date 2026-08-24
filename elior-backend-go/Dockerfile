# Go 1.22 — samakan dengan versi di server produksi, jangan naikkan tanpa uji.
FROM golang:1.22-alpine AS build

WORKDIR /src

# Layer terpisah supaya `go mod download` ter-cache selama dependensi tidak berubah.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO_ENABLED=0: pgx murni Go, hasilnya binary statis yang jalan di image kosong.
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/elior-backend .

FROM alpine:3.20

# ca-certificates dibutuhkan kalau DATABASE_SSL=true, tzdata untuk query Asia/Jakarta.
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=build /out/elior-backend .
COPY migrations ./migrations

EXPOSE 8080
CMD ["./elior-backend"]
