package handler

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct{ db *pgxpool.Pool }

func NewUser(db *pgxpool.Pool) *User { return &User{db} }

var allowedVisionStatus = map[string]bool{
	"buta_total": true,
	"low_vision": true,
	"tidak_ada":  true,
}

func (u *User) GetProfile(c *gin.Context) {
	ctx := context.Background()
	var id, name, email string
	var visionStatus *string
	err := u.db.QueryRow(ctx, "SELECT id, name, email, vision_status FROM users WHERE id=$1", c.GetString("user_id")).
		Scan(&id, &name, &email, &visionStatus)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user_id": id, "name": name, "email": email, "vision_status": visionStatus})
}

// Ping — update last_active + open_count (dipanggil saat app launch)
func (u *User) Ping(c *gin.Context) {
	_, err := u.db.Exec(context.Background(),
		`UPDATE users SET last_active = NOW(), open_count = open_count + 1 WHERE id = $1`,
		c.GetString("user_id"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal update"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// UpdateProfile melakukan partial update: name dan/atau vision_status.
func (u *User) UpdateProfile(c *gin.Context) {
	var body struct {
		Name         *string `json:"name"`
		VisionStatus *string `json:"vision_status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}
	if body.Name == nil && body.VisionStatus == nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Tidak ada perubahan"})
		return
	}
	if body.Name != nil && len(*body.Name) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Nama terlalu pendek"})
		return
	}
	if body.VisionStatus != nil && !allowedVisionStatus[*body.VisionStatus] {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Status penglihatan tidak valid"})
		return
	}

	ctx := context.Background()
	var id, name, email string
	var visionStatus *string
	err := u.db.QueryRow(ctx,
		`UPDATE users
		 SET name = COALESCE($1, name),
		     vision_status = COALESCE($2, vision_status)
		 WHERE id=$3
		 RETURNING id, name, email, vision_status`,
		body.Name, body.VisionStatus, c.GetString("user_id"),
	).Scan(&id, &name, &email, &visionStatus)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user_id": id, "name": name, "email": email, "vision_status": visionStatus})
}
