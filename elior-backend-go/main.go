package main

import (
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"elior-backend-go/internal/db"
	"elior-backend-go/internal/handler"
	"elior-backend-go/internal/middleware"
)

type noDirFS struct{ http.FileSystem }

func (n noDirFS) Open(path string) (http.File, error) {
	f, err := n.FileSystem.Open(path)
	if err != nil {
		return nil, err
	}
	s, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	if s.IsDir() {
		f.Close()
		return nil, os.ErrNotExist
	}
	return f, nil
}

// authLimiter membatasi percobaan login/register per IP: maks 10 per 15 menit.
type authLimiter struct {
	mu      sync.Mutex
	clients map[string][]time.Time
}

func newAuthLimiter() *authLimiter {
	al := &authLimiter{clients: make(map[string][]time.Time)}
	go func() {
		for {
			time.Sleep(15 * time.Minute)
			al.mu.Lock()
			clear(al.clients)
			al.mu.Unlock()
		}
	}()
	return al
}

func (al *authLimiter) middleware() gin.HandlerFunc {
	const maxAttempts = 10
	const window = 15 * time.Minute
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()
		al.mu.Lock()
		times := al.clients[ip]
		valid := times[:0]
		for _, t := range times {
			if now.Sub(t) < window {
				valid = append(valid, t)
			}
		}
		if len(valid) >= maxAttempts {
			al.mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"detail": "Terlalu banyak percobaan. Coba lagi 15 menit."})
			return
		}
		al.clients[ip] = append(valid, now)
		al.mu.Unlock()
		c.Next()
	}
}

func main() {
	godotenv.Load()

	if secret := os.Getenv("JWT_SECRET"); len(secret) < 32 {
		log.Fatal("JWT_SECRET harus diset dan minimal 32 karakter")
	}
	if os.Getenv("UPLOAD_DIR") == "" {
		log.Fatal("UPLOAD_DIR harus diset")
	}

	pool, err := db.Connect()
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	// ── Public server (CF Tunnel → 127.0.0.1:8080) ──────────────────────────
	r := gin.Default()
	// Only trust localhost (cloudflared runs on same machine) so c.ClientIP() returns real IP from CF-Connecting-IP
	r.SetTrustedProxies([]string{"127.0.0.1"})
	r.MaxMultipartMemory = 10 << 20
	r.Use(corsMiddleware())

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "ELIOR Auth API"})
	})

	authRL := newAuthLimiter()
	cfgHandler := handler.NewAdmin(pool)
	r.GET("/config", cfgHandler.GetConfig)

	auth := handler.NewAuth(pool)
	r.POST("/auth/register", authRL.middleware(), auth.Register)
	r.POST("/auth/login", authRL.middleware(), auth.Login)
	r.POST("/auth/google", authRL.middleware(), auth.Google)

	protected := r.Group("/")
	protected.Use(middleware.Auth(), middleware.BanCheck(pool))

	user := handler.NewUser(pool)
	protected.GET("/users/me", user.GetProfile)
	protected.PATCH("/users/me", user.UpdateProfile)
	protected.POST("/me/ping", user.Ping)

	hist := handler.NewHistory(pool)
	protected.POST("/history", hist.Save)
	protected.GET("/history", hist.GetAll)
	protected.DELETE("/history", hist.Clear)
	protected.DELETE("/history/:id", hist.DeleteOne)
	protected.POST("/uploads/:category", hist.UploadImage)

	fb := handler.NewFeedback(pool)
	protected.POST("/feedback", fb.Submit)
	protected.POST("/reports", fb.Report)

	uploadDir := os.Getenv("UPLOAD_DIR")
	uploads := r.Group("/uploads", func(c *gin.Context) {
		// Filename UUID -> isi tidak pernah berubah, aman cache abadi.
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	})
	uploads.StaticFS("", noDirFS{http.Dir(uploadDir)})
	r.GET("/downloads/elior-beta.apk", func(c *gin.Context) {
		c.File(uploadDir + "/elior-beta.apk")
	})

	// ── Admin server ────────────────────────────────────────────────────────
	// ADMIN_BIND menentukan alamat bind, mis. "127.0.0.1:8081" untuk lokal atau
	// "<ip-tailscale>:8081" di produksi. Kosongkan untuk mematikan server admin.
	adminR := gin.Default()
	adminR.Use(corsMiddleware())

	adm := handler.NewAdmin(pool)
	adminGroup := adminR.Group("/admin")
	adminGroup.Use(middleware.Auth(), middleware.AdminOnly(pool))
	adminGroup.GET("/users", adm.ListUsers)
	adminGroup.GET("/stats", adm.Stats)
	adminGroup.GET("/feedback", adm.ListFeedback)
	adminGroup.GET("/reports", adm.ListReports)
	adminGroup.PATCH("/users/:id/ban", adm.ToggleBan)
	adminGroup.GET("/users/:id", adm.UserDetail)
	adminGroup.GET("/export/feedback", adm.ExportFeedback)
	adminGroup.GET("/export/users", adm.ExportUsers)
	adminGroup.GET("/settings", adm.GetSettings)
	adminGroup.PATCH("/settings", adm.UpdateSettings)

	if adminBind := os.Getenv("ADMIN_BIND"); adminBind != "" {
		go func() {
			log.Printf("Admin server listening on %s", adminBind)
			// Tidak Fatal: admin panel opsional, server publik harus tetap hidup.
			if err := adminR.Run(adminBind); err != nil {
				log.Printf("admin server error: %v", err)
			}
		}()
	} else {
		log.Println("ADMIN_BIND kosong — server admin tidak dijalankan")
	}

	// ── Start public server ──────────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	// Di dalam container wajib 0.0.0.0, kalau 127.0.0.1 tidak bisa diakses dari host.
	bind := os.Getenv("BIND_ADDR")
	if bind == "" {
		bind = "0.0.0.0"
	}
	log.Printf("Public server listening on %s:%s", bind, port)
	r.Run(bind + ":" + port)
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
