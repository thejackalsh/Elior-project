package handler

import (
	"context"
	"encoding/csv"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Admin struct{ db *pgxpool.Pool }

func NewAdmin(db *pgxpool.Pool) *Admin { return &Admin{db} }

// GET /admin/users
func (a *Admin) ListUsers(c *gin.Context) {
	adminEmail := os.Getenv("ADMIN_EMAIL")
	rows, err := a.db.Query(context.Background(), `
		SELECT u.id, u.name, u.email, u.vision_status,
		       to_char(u.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
		       COALESCE(m.is_banned, false), m.notes
		FROM users u
		LEFT JOIN user_meta m ON m.user_id = u.id
		WHERE u.email != $1
		ORDER BY u.created_at DESC
	`, adminEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	type UserRow struct {
		ID           string  `json:"id"`
		Name         *string `json:"name"`
		Email        string  `json:"email"`
		VisionStatus *string `json:"vision_status"`
		CreatedAt    string  `json:"created_at"`
		IsBanned     bool    `json:"is_banned"`
		Notes        *string `json:"notes"`
	}

	users := []UserRow{}
	for rows.Next() {
		var u UserRow
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.VisionStatus, &u.CreatedAt, &u.IsBanned, &u.Notes); err != nil {
			continue
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, gin.H{"users": users, "total": len(users)})
}

// GET /admin/stats
func (a *Admin) Stats(c *gin.Context) {
	ctx := context.Background()

	adminEmail := os.Getenv("ADMIN_EMAIL")
	var totalUsers, totalScans, scanToday, bannedUsers, activeLast24h int
	a.db.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email != $1", adminEmail).Scan(&totalUsers)
	a.db.QueryRow(ctx, "SELECT COUNT(*) FROM scan_history").Scan(&totalScans)
	a.db.QueryRow(ctx, "SELECT COUNT(*) FROM scan_history WHERE created_at >= CURRENT_DATE").Scan(&scanToday)
	a.db.QueryRow(ctx, "SELECT COUNT(*) FROM user_meta WHERE is_banned = true").Scan(&bannedUsers)
	a.db.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email != $1 AND last_active >= NOW() - INTERVAL '24 hours'", adminEmail).Scan(&activeLast24h)

	var scanLimitStr string
	scanLimit := 10
	if err := a.db.QueryRow(ctx, `SELECT value FROM app_settings WHERE key='scan_daily_limit'`).Scan(&scanLimitStr); err == nil {
		if v, e := strconv.Atoi(scanLimitStr); e == nil {
			scanLimit = v
		}
	}

	rows, _ := a.db.Query(ctx, `
		SELECT category, COUNT(*) FROM scan_history GROUP BY category ORDER BY COUNT(*) DESC
	`)
	defer rows.Close()

	type CatCount struct {
		Category string `json:"category"`
		Count    int    `json:"count"`
	}
	cats := []CatCount{}
	for rows.Next() {
		var cc CatCount
		rows.Scan(&cc.Category, &cc.Count)
		cats = append(cats, cc)
	}

	c.JSON(http.StatusOK, gin.H{
		"total_users":     totalUsers,
		"banned_users":    bannedUsers,
		"total_scans":     totalScans,
		"scan_today":      scanToday,
		"active_last_24h": activeLast24h,
		"per_category":    cats,
		"user_cap":        50,
		"scan_daily_limit": scanLimit,
	})
}

// GET /admin/feedback
func (a *Admin) ListFeedback(c *gin.Context) {
	rows, err := a.db.Query(context.Background(), `
		SELECT f.id, f.user_id, u.name, u.vision_status,
		       f.navigasi, f.kemudahan, f.kualitas, f.akurasi,
		       f.manfaat, f.niat_pakai, f.komentar,
		       to_char(f.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"')
		FROM feedback f
		LEFT JOIN users u ON u.id = f.user_id
		ORDER BY f.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	type FeedbackRow struct {
		ID           string  `json:"id"`
		UserID       string  `json:"user_id"`
		Name         *string `json:"name"`
		VisionStatus *string `json:"vision_status"`
		Navigasi     *int    `json:"navigasi"`
		Kemudahan    *int    `json:"kemudahan"`
		Kualitas     *int    `json:"kualitas"`
		Akurasi      *int    `json:"akurasi"`
		Manfaat      *int    `json:"manfaat"`
		NiatPakai    *int    `json:"niat_pakai"`
		Komentar     *string `json:"komentar"`
		CreatedAt    string  `json:"created_at"`
	}

	items := []FeedbackRow{}
	for rows.Next() {
		var f FeedbackRow
		if err := rows.Scan(&f.ID, &f.UserID, &f.Name, &f.VisionStatus,
			&f.Navigasi, &f.Kemudahan, &f.Kualitas, &f.Akurasi,
			&f.Manfaat, &f.NiatPakai, &f.Komentar, &f.CreatedAt); err != nil {
			continue
		}
		items = append(items, f)
	}
	c.JSON(http.StatusOK, gin.H{"feedback": items, "total": len(items)})
}

// GET /admin/reports
func (a *Admin) ListReports(c *gin.Context) {
	rows, err := a.db.Query(context.Background(), `
		SELECT r.id, r.user_id, u.name, r.category, r.text, r.confidence, r.reason,
		       to_char(r.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"')
		FROM reports r
		LEFT JOIN users u ON u.id = r.user_id
		ORDER BY r.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	type ReportRow struct {
		ID         string   `json:"id"`
		UserID     string   `json:"user_id"`
		Name       *string  `json:"name"`
		Category   string   `json:"category"`
		Text       string   `json:"text"`
		Confidence *float64 `json:"confidence"`
		Reason     *string  `json:"reason"`
		CreatedAt  string   `json:"created_at"`
	}

	items := []ReportRow{}
	for rows.Next() {
		var r ReportRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.Name, &r.Category, &r.Text,
			&r.Confidence, &r.Reason, &r.CreatedAt); err != nil {
			continue
		}
		items = append(items, r)
	}
	c.JSON(http.StatusOK, gin.H{"reports": items, "total": len(items)})
}

// PATCH /admin/users/:id/ban
func (a *Admin) ToggleBan(c *gin.Context) {
	targetID := c.Param("id")
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "User ID diperlukan"})
		return
	}
	if targetID == c.GetString("user_id") {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Tidak dapat ban akun sendiri"})
		return
	}

	var body struct {
		IsBanned bool    `json:"is_banned"`
		Notes    *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}

	_, err := a.db.Exec(context.Background(),
		`INSERT INTO user_meta (user_id, is_banned, notes, updated_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (user_id) DO UPDATE
		 SET is_banned = $2, notes = COALESCE($3, user_meta.notes), updated_at = NOW()`,
		targetID, body.IsBanned, body.Notes,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal update"})
		return
	}

	msg := "Akun dinonaktifkan"
	if !body.IsBanned {
		msg = "Akun diaktifkan kembali"
	}
	c.JSON(http.StatusOK, gin.H{"message": msg, "is_banned": body.IsBanned})
}

// GET /admin/export/feedback — unduh CSV semua feedback
func (a *Admin) ExportFeedback(c *gin.Context) {
	rows, err := a.db.Query(context.Background(), `
		SELECT f.id, u.name, u.email, u.vision_status,
		       f.navigasi, f.kemudahan, f.kualitas, f.akurasi,
		       f.manfaat, f.niat_pakai, f.komentar,
		       to_char(f.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"')
		FROM feedback f
		LEFT JOIN users u ON u.id = f.user_id
		ORDER BY f.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	filename := "elior-feedback-" + time.Now().Format("20060102") + ".csv"
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"id", "name", "email", "vision_status", "navigasi", "kemudahan", "kualitas", "akurasi", "manfaat", "niat_pakai", "komentar", "created_at"})

	for rows.Next() {
		var (
			id, createdAt          string
			name, email            *string
			visionStatus, komentar *string
			nav, kem, kual, akur   *int
			manfaat, niatPakai     *int
		)
		if err := rows.Scan(&id, &name, &email, &visionStatus,
			&nav, &kem, &kual, &akur, &manfaat, &niatPakai, &komentar, &createdAt); err != nil {
			continue
		}
		_ = w.Write([]string{
			id,
			pstr(name), pstr(email), pstr(visionStatus),
			pint(nav), pint(kem), pint(kual), pint(akur),
			pint(manfaat), pint(niatPakai),
			pstr(komentar), createdAt,
		})
	}
	w.Flush()
}

// GET /admin/export/users — unduh CSV semua user
func (a *Admin) ExportUsers(c *gin.Context) {
	rows, err := a.db.Query(context.Background(), `
		SELECT u.id, u.name, u.email, u.vision_status,
		       to_char(u.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
		       COALESCE(m.is_banned, false), m.notes
		FROM users u
		LEFT JOIN user_meta m ON m.user_id = u.id
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	filename := "elior-users-" + time.Now().Format("20060102") + ".csv"
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"id", "name", "email", "vision_status", "created_at", "is_banned", "notes"})

	for rows.Next() {
		var (
			id, email, createdAt string
			name, visionStatus   *string
			isBanned             bool
			notes                *string
		)
		if err := rows.Scan(&id, &name, &email, &visionStatus, &createdAt, &isBanned, &notes); err != nil {
			continue
		}
		banned := "tidak"
		if isBanned {
			banned = "ya"
		}
		_ = w.Write([]string{
			id, pstr(name), email, pstr(visionStatus), createdAt, banned, pstr(notes),
		})
	}
	w.Flush()
}

// GET /admin/settings
func (a *Admin) GetSettings(c *gin.Context) {
	rows, err := a.db.Query(context.Background(), `SELECT key, value FROM app_settings ORDER BY key`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil settings"})
		return
	}
	defer rows.Close()
	settings := map[string]string{}
	for rows.Next() {
		var k, v string
		rows.Scan(&k, &v)
		settings[k] = v
	}
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

// PATCH /admin/settings
func (a *Admin) UpdateSettings(c *gin.Context) {
	var body struct {
		Key   string `json:"key" binding:"required"`
		Value string `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}
	allowed := map[string]bool{
		"scan_daily_limit": true,
		"mode_uang":        true,
		"mode_baca":        true,
		"mode_objek":       true,
		"mode_qr":          true,
	}
	if !allowed[body.Key] {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Key tidak diizinkan"})
		return
	}
	if body.Key == "scan_daily_limit" {
		v, err := strconv.Atoi(body.Value)
		if err != nil || v < 0 || v > 1000 {
			c.JSON(http.StatusBadRequest, gin.H{"detail": "Nilai harus angka 0-1000"})
			return
		}
	}
	if strings.HasPrefix(body.Key, "mode_") && body.Value != "true" && body.Value != "false" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Nilai harus true atau false"})
		return
	}
	_, err := a.db.Exec(context.Background(),
		`INSERT INTO app_settings (key, value) VALUES ($1, $2)
		 ON CONFLICT (key) DO UPDATE SET value = $2`,
		body.Key, body.Value,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal simpan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "key": body.Key, "value": body.Value})
}

// GET /config (public) — mode flags + scan_daily_limit untuk mobile
func (a *Admin) GetConfig(c *gin.Context) {
	ctx := context.Background()
	modes := map[string]bool{"uang": true, "baca": true, "objek": true, "qr": true}
	rows, err := a.db.Query(ctx,
		`SELECT key, value FROM app_settings WHERE key LIKE 'mode_%' OR key = 'scan_daily_limit'`)
	scanLimit := 10
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var k, v string
			rows.Scan(&k, &v)
			if k == "scan_daily_limit" {
				if n, e := strconv.Atoi(v); e == nil {
					scanLimit = n
				}
				continue
			}
			name := strings.TrimPrefix(k, "mode_")
			if _, ok := modes[name]; ok {
				modes[name] = v != "false" && v != "0"
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"modes": modes, "scan_daily_limit": scanLimit})
}

func pstr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func pint(v *int) string {
	if v == nil {
		return ""
	}
	return strconv.Itoa(*v)
}

// GET /admin/users/:id — profil + riwayat scan user
func (a *Admin) UserDetail(c *gin.Context) {
	userID := c.Param("id")
	ctx := context.Background()

	type Profile struct {
		ID           string  `json:"id"`
		Name         *string `json:"name"`
		Email        string  `json:"email"`
		VisionStatus *string `json:"vision_status"`
		CreatedAt    string  `json:"created_at"`
		IsBanned     bool    `json:"is_banned"`
		Notes        *string `json:"notes"`
	}

	var p Profile
	err := a.db.QueryRow(ctx, `
		SELECT u.id, u.name, u.email, u.vision_status,
		       to_char(u.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
		       COALESCE(m.is_banned, false), m.notes
		FROM users u
		LEFT JOIN user_meta m ON m.user_id = u.id
		WHERE u.id = $1
	`, userID).Scan(&p.ID, &p.Name, &p.Email, &p.VisionStatus, &p.CreatedAt, &p.IsBanned, &p.Notes)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "User tidak ditemukan"})
		return
	}

	rows, err := a.db.Query(ctx, `
		SELECT id, category, text, ocr_text, confidence, image_url,
		       to_char(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"')
		FROM scan_history
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal ambil riwayat"})
		return
	}
	defer rows.Close()

	type ScanRow struct {
		ID         string   `json:"id"`
		Category   string   `json:"category"`
		Text       string   `json:"text"`
		OcrText    *string  `json:"ocr_text"`
		Confidence *float64 `json:"confidence"`
		ImageURL   *string  `json:"image_url"`
		CreatedAt  string   `json:"created_at"`
	}

	history := []ScanRow{}
	for rows.Next() {
		var s ScanRow
		if err := rows.Scan(&s.ID, &s.Category, &s.Text, &s.OcrText, &s.Confidence, &s.ImageURL, &s.CreatedAt); err != nil {
			continue
		}
		history = append(history, s)
	}

	c.JSON(http.StatusOK, gin.H{"user": p, "history": history, "total": len(history)})
}
