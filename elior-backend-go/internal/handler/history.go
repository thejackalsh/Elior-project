package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type History struct{ db *pgxpool.Pool }

func NewHistory(db *pgxpool.Pool) *History { return &History{db} }

var allowedCategories = map[string]bool{"ocr": true, "rupiah": true, "object": true}
var allowedExtensions = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}

const maxFileSize = 10 << 20 // 10MB

type historyItem struct {
	ID         string    `json:"id"`
	Category   string    `json:"category"`
	Text       string    `json:"text"`
	OcrText    *string   `json:"ocr_text"`
	Confidence *float64  `json:"confidence"`
	ImageURL   *string   `json:"image_url"`
	CreatedAt  time.Time `json:"created_at"`
}

func (h *History) UploadImage(c *gin.Context) {
	category := c.Param("category")
	if !allowedCategories[category] {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Category tidak valid"})
		return
	}

	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "File image diperlukan"})
		return
	}

	if file.Size > maxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Ukuran file maksimal 10MB"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExtensions[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Format file tidak didukung. Gunakan jpg, png, atau webp"})
		return
	}

	filename := uuid.New().String() + ext
	dst := filepath.Join(os.Getenv("UPLOAD_DIR"), category, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		log.Printf("upload error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal simpan image"})
		return
	}

	imageURL := fmt.Sprintf("/uploads/%s/%s", category, filename)
	c.JSON(http.StatusCreated, gin.H{"image_url": imageURL})
}

func (h *History) Save(c *gin.Context) {
	var body struct {
		Category   string   `json:"category" binding:"required"`
		Text       string   `json:"text" binding:"required"`
		OcrText    *string  `json:"ocr_text"`
		Confidence *float64 `json:"confidence"`
		ImageURL   *string  `json:"image_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}

	if !allowedCategories[body.Category] {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Category tidak valid"})
		return
	}

	if body.Confidence != nil && (*body.Confidence < 0 || *body.Confidence > 1) {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Confidence harus antara 0 dan 1"})
		return
	}

	ctx := context.Background()
	userID := c.GetString("user_id")

	dailyLimit := 10
	var limitStr string
	if err := h.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key='scan_daily_limit'`).Scan(&limitStr); err == nil {
		if v, e := strconv.Atoi(limitStr); e == nil && v >= 0 {
			dailyLimit = v
		}
	}

	// Rate limit hanya berlaku untuk category=object (rupiah/ocr on-device, tidak terbatas).
	// dailyLimit=0 berarti nonaktif.
	if body.Category == "object" && dailyLimit > 0 {
		var scanCount int
		if err := h.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM scan_history WHERE user_id=$1 AND category='object' AND created_at >= NOW() - INTERVAL '24 hours'`,
			userID,
		).Scan(&scanCount); err == nil && scanCount >= dailyLimit {
			var firstScan time.Time
			if e := h.db.QueryRow(ctx,
				`SELECT MIN(created_at) FROM scan_history WHERE user_id=$1 AND category='object' AND created_at >= NOW() - INTERVAL '24 hours'`,
				userID,
			).Scan(&firstScan); e != nil {
				firstScan = time.Now()
			}
			c.JSON(http.StatusTooManyRequests, gin.H{
				"detail":   "Batas scan objek harian tercapai",
				"code":     "scan_limit",
				"reset_at": firstScan.Add(24 * time.Hour).UTC().Format(time.RFC3339),
			})
			return
		}
	}

	id := uuid.New()
	_, err := h.db.Exec(ctx,
		"INSERT INTO scan_history (id, user_id, category, text, ocr_text, confidence, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7)",
		id, userID, body.Category, body.Text, body.OcrText, body.Confidence, body.ImageURL,
	)
	if err != nil {
		log.Printf("save history error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal simpan"})
		return
	}

	if _, err := h.db.Exec(ctx, "INSERT INTO usage_logs (id, user_id, category) VALUES ($1,$2,$3)", uuid.New(), userID, body.Category); err != nil {
		log.Printf("usage_log error: %v", err)
	}

	c.JSON(http.StatusCreated, gin.H{"id": id.String()})
}

func (h *History) GetAll(c *gin.Context) {
	ctx := context.Background()
	rows, err := h.db.Query(ctx,
		`SELECT id, category, text, ocr_text, confidence, image_url, created_at
		 FROM scan_history WHERE user_id=$1
		 ORDER BY created_at DESC LIMIT 50`,
		c.GetString("user_id"),
	)
	if err != nil {
		log.Printf("get history error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil history"})
		return
	}
	defer rows.Close()

	items := []historyItem{}
	for rows.Next() {
		var item historyItem
		if err := rows.Scan(&item.ID, &item.Category, &item.Text, &item.OcrText, &item.Confidence, &item.ImageURL, &item.CreatedAt); err != nil {
			log.Printf("scan error: %v", err)
			continue
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, items)
}

func (h *History) Clear(c *gin.Context) {
	if _, err := h.db.Exec(context.Background(), "DELETE FROM scan_history WHERE user_id=$1", c.GetString("user_id")); err != nil {
		log.Printf("clear history error: %v", err)
	}
	c.JSON(http.StatusOK, gin.H{"message": "History dihapus"})
}

// DeleteOne menghapus satu memori milik user (DELETE /history/:id).
func (h *History) DeleteOne(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "ID tidak valid"})
		return
	}
	tag, err := h.db.Exec(context.Background(),
		"DELETE FROM scan_history WHERE id=$1 AND user_id=$2", id, c.GetString("user_id"))
	if err != nil {
		log.Printf("delete history error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal hapus"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Memori tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Memori dihapus"})
}
