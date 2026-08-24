package handler

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Feedback struct{ db *pgxpool.Pool }

func NewFeedback(db *pgxpool.Pool) *Feedback { return &Feedback{db} }

// Skala 5-titik Likert: 1–5. nil = tidak dijawab.
func validScale(v *int) bool {
	return v == nil || (*v >= 1 && *v <= 5)
}

// POST /feedback — survei TAM dari user.
func (f *Feedback) Submit(c *gin.Context) {
	var body struct {
		Navigasi  *int    `json:"navigasi"`
		Kemudahan *int    `json:"kemudahan"`
		Kualitas  *int    `json:"kualitas"`
		Akurasi   *int    `json:"akurasi"`
		Manfaat   *int    `json:"manfaat"`
		NiatPakai *int    `json:"niat_pakai"`
		Komentar  *string `json:"komentar"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}
	if !validScale(body.Navigasi) || !validScale(body.Kemudahan) ||
		!validScale(body.Kualitas) || !validScale(body.Akurasi) ||
		!validScale(body.Manfaat) || !validScale(body.NiatPakai) {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Nilai skala harus 1 sampai 5"})
		return
	}

	_, err := f.db.Exec(context.Background(),
		`INSERT INTO feedback
		   (id, user_id, navigasi, kemudahan, kualitas, akurasi, manfaat, niat_pakai, komentar)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		uuid.New(), c.GetString("user_id"),
		body.Navigasi, body.Kemudahan, body.Kualitas, body.Akurasi,
		body.Manfaat, body.NiatPakai, body.Komentar,
	)
	if err != nil {
		log.Printf("feedback insert error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal mengirim masukan"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Terima kasih atas masukanmu"})
}

// POST /reports — laporan hasil scan yang salah, dari drawer hasil.
func (f *Feedback) Report(c *gin.Context) {
	var body struct {
		Category   string   `json:"category" binding:"required"`
		Text       string   `json:"text" binding:"required"`
		Confidence *float64 `json:"confidence"`
		ImageURL   *string  `json:"image_url"`
		Reason     *string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}
	if !allowedCategories[body.Category] {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Category tidak valid"})
		return
	}

	_, err := f.db.Exec(context.Background(),
		`INSERT INTO reports (id, user_id, category, text, confidence, image_url, reason)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uuid.New(), c.GetString("user_id"),
		body.Category, body.Text, body.Confidence, body.ImageURL, body.Reason,
	)
	if err != nil {
		log.Printf("report insert error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal mengirim laporan"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Laporan terkirim. Terima kasih"})
}
