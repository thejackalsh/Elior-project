package handler

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Auth struct{ db *pgxpool.Pool }

func NewAuth(db *pgxpool.Pool) *Auth { return &Auth{db} }

type tokenResp struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	UserID      string `json:"user_id"`
	Name        string `json:"name"`
	IsNew       bool   `json:"is_new"`
}

func createToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(90 * 24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func (a *Auth) Register(c *gin.Context) {
	var body struct {
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}

	ctx := context.Background()

	var userCount int
	if err := a.db.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email != $1", os.Getenv("ADMIN_EMAIL")).Scan(&userCount); err == nil && userCount >= 50 {
		c.JSON(http.StatusForbidden, gin.H{"detail": "Pendaftaran ditutup sementara", "code": "registrasi_ditutup"})
		return
	}

	var exists bool
	if err := a.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", body.Email).Scan(&exists); err != nil {
		log.Printf("register check email error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Terjadi kesalahan"})
		return
	}
	if exists {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Email sudah terdaftar"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("bcrypt error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Terjadi kesalahan"})
		return
	}

	id := uuid.New()
	if _, err := a.db.Exec(ctx,
		"INSERT INTO users (id, name, email, password_hash) VALUES ($1,$2,$3,$4)",
		id, body.Name, body.Email, string(hash),
	); err != nil {
		log.Printf("register insert user error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal daftar"})
		return
	}

	if _, err := a.db.Exec(ctx, "INSERT INTO user_meta (user_id) VALUES ($1)", id); err != nil {
		log.Printf("register insert user_meta error: %v", err)
	}

	token, _ := createToken(id.String())
	c.JSON(http.StatusCreated, tokenResp{
		AccessToken: token, TokenType: "bearer", UserID: id.String(), Name: body.Name,
	})
}

func (a *Auth) Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}

	ctx := context.Background()
	var id, name, hashStr string
	var isBanned bool

	var err error
	if strings.Contains(body.Email, "@") {
		err = a.db.QueryRow(ctx,
			`SELECT u.id, u.name, COALESCE(u.password_hash,''), COALESCE(m.is_banned,false)
			 FROM users u LEFT JOIN user_meta m ON m.user_id=u.id
			 WHERE u.email=$1`, body.Email,
		).Scan(&id, &name, &hashStr, &isBanned)
	} else {
		err = a.db.QueryRow(ctx,
			`SELECT u.id, u.name, COALESCE(u.password_hash,''), COALESCE(m.is_banned,false)
			 FROM users u LEFT JOIN user_meta m ON m.user_id=u.id
			 WHERE LOWER(u.name)=LOWER($1)`, body.Email,
		).Scan(&id, &name, &hashStr, &isBanned)
	}

	if err != nil || hashStr == "" || bcrypt.CompareHashAndPassword([]byte(hashStr), []byte(body.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Nama atau password salah"})
		return
	}
	if isBanned {
		c.JSON(http.StatusForbidden, gin.H{"detail": "Akun dinonaktifkan", "code": "akun_dibanned"})
		return
	}

	token, _ := createToken(id)
	c.JSON(http.StatusOK, tokenResp{AccessToken: token, TokenType: "bearer", UserID: id, Name: name})
}

func (a *Auth) Google(c *gin.Context) {
	var body struct {
		AccessToken string `json:"access_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Input tidak valid"})
		return
	}

	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+body.AccessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Token Google tidak valid"})
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var info struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	json.Unmarshal(raw, &info)

	if info.Sub == "" || info.Email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Data Google tidak lengkap"})
		return
	}
	if info.Name == "" {
		info.Name = strings.Split(info.Email, "@")[0]
	}

	ctx := context.Background()
	var id, name string
	var isBanned bool
	isNew := false

	err = a.db.QueryRow(ctx,
		`SELECT u.id, u.name, COALESCE(m.is_banned,false)
		 FROM users u LEFT JOIN user_meta m ON m.user_id=u.id
		 WHERE u.google_id=$1`, info.Sub,
	).Scan(&id, &name, &isBanned)

	if err != nil {
		err = a.db.QueryRow(ctx, "SELECT id, name FROM users WHERE email=$1", info.Email).Scan(&id, &name)
		if err == nil {
			if _, e := a.db.Exec(ctx, "UPDATE users SET google_id=$1 WHERE id=$2", info.Sub, id); e != nil {
				log.Printf("google link google_id error: %v", e)
			}
		} else {
			var userCount int
			if e := a.db.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE email != $1", os.Getenv("ADMIN_EMAIL")).Scan(&userCount); e == nil && userCount >= 50 {
				c.JSON(http.StatusForbidden, gin.H{"detail": "Pendaftaran ditutup sementara", "code": "registrasi_ditutup"})
				return
			}
			isNew = true
			newID := uuid.New()
			id, name = newID.String(), info.Name
			if _, e := a.db.Exec(ctx, "INSERT INTO users (id, name, email, google_id) VALUES ($1,$2,$3,$4)",
				newID, info.Name, info.Email, info.Sub); e != nil {
				log.Printf("google insert user error: %v", e)
				c.JSON(http.StatusInternalServerError, gin.H{"detail": "Gagal daftar"})
				return
			}
			if _, e := a.db.Exec(ctx, "INSERT INTO user_meta (user_id) VALUES ($1)", newID); e != nil {
				log.Printf("google insert user_meta error: %v", e)
			}
		}
		if e := a.db.QueryRow(ctx, "SELECT COALESCE(is_banned,false) FROM user_meta WHERE user_id=$1", id).Scan(&isBanned); e != nil {
			log.Printf("google check banned error: %v", e)
		}
	}

	if isBanned {
		c.JSON(http.StatusForbidden, gin.H{"detail": "Akun dinonaktifkan", "code": "akun_dibanned"})
		return
	}

	token, _ := createToken(id)
	c.JSON(http.StatusOK, tokenResp{AccessToken: token, TokenType: "bearer", UserID: id, Name: name, IsNew: isNew})
}
