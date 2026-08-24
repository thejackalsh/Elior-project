package db

import (
	"context"
	"crypto/tls"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect() (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, err
	}
	if os.Getenv("DATABASE_SSL") == "true" {
		cfg.ConnConfig.TLSConfig = &tls.Config{InsecureSkipVerify: true}
	}
	return pgxpool.NewWithConfig(context.Background(), cfg)
}
