package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BanCheck runs after Auth middleware. Aborts if user is banned.
func BanCheck(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var isBanned bool
		err := db.QueryRow(context.Background(),
			"SELECT COALESCE(is_banned, false) FROM user_meta WHERE user_id=$1",
			c.GetString("user_id"),
		).Scan(&isBanned)
		if err == nil && isBanned {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"detail": "Akun dinonaktifkan",
				"code":   "akun_dibanned",
			})
			return
		}
		c.Next()
	}
}
