package middleware

import (
	"context"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func AdminOnly(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminEmail := os.Getenv("ADMIN_EMAIL")
		if adminEmail == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"detail": "Admin tidak dikonfigurasi"})
			return
		}
		userID := c.GetString("user_id")
		var email string
		if err := db.QueryRow(context.Background(), "SELECT email FROM users WHERE id=$1", userID).Scan(&email); err != nil || email != adminEmail {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"detail": "Akses ditolak"})
			return
		}
		c.Next()
	}
}
