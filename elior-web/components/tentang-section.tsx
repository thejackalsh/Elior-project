"use client";

// import { ArrowUpRight } from "lucide-react"; // disabled: dipakai tombol Buka Kamera

// interface TentangSectionProps {
//   onOpenCamera: () => void;
// }

export function TentangSection(/* { onOpenCamera }: TentangSectionProps */) {
  return (
    <div className="min-w-full px-1">
      <div className="liquid-glass rounded-3xl flex flex-col">
        {/* Hero image — flush to card top, bottom cut flat */}
        <img
          src="/hero.png"
          alt="ELIOR hero"
          className="w-full h-80 object-cover shrink-0"
        />

        <div className="flex flex-col gap-6 p-7">
        <h2
          className="text-4xl text-white italic text-center"
          style={{
            fontFamily: "'Times New Roman', Times, serif",
            textShadow: "0 0 12px rgba(255,255,255,0.9), 0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.2)",
          }}
        >
          Tentang ELIOR
        </h2>
        <p className="text-white text-sm font-light leading-relaxed">
          <span className="text-base font-semibold" style={{ fontFamily: "'Times New Roman', Times, serif" }}>ELIOR</span> adalah aplikasi teknologi asistif berbasis kecerdasan buatan yang dirancang untuk membantu penyandang tunanetra memahami lingkungan sekitar melalui Bahasa Indonesia. Arahkan kamera, tekan tombol — <span className="text-base font-semibold" style={{ fontFamily: "'Times New Roman', Times, serif" }}>ELIOR</span> mendeskripsikan apa yang ada di depan Anda secara otomatis.
        </p>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h3
              className="text-base font-semibold text-white"
              style={{ textShadow: "0 0 10px rgba(255,255,255,0.85), 0 0 28px rgba(255,255,255,0.4)" }}
            >
              Latar Belakang
            </h3>
            <p className="text-white text-sm font-light leading-relaxed">
              Menurut data World Health Organization (WHO), lebih dari 2,2 miliar orang di seluruh dunia mengalami gangguan penglihatan atau kebutaan. Di Indonesia, aksesibilitas teknologi bagi penyandang tunanetra masih sangat terbatas. Sebagian besar solusi yang tersedia menggunakan bahasa Inggris dan tidak mempertimbangkan kebutuhan lokal seperti pembacaan teks berbahasa Indonesia maupun pengenalan mata uang Rupiah.
            </p>
            <p className="text-white text-sm font-light leading-relaxed">
              Penelitian terdahulu menunjukkan bahwa sistem bantu tunanetra yang ada umumnya bersifat single-feature — hanya mendeteksi objek, atau hanya membaca teks, tetapi tidak keduanya dalam satu platform. Output yang dihasilkan pun sering berupa label kelas pendek seperti &quot;chair&quot; atau &quot;bottle&quot; yang tidak memberikan pemahaman kontekstual yang memadai. ELIOR hadir untuk mengisi kesenjangan tersebut dengan mengintegrasikan tiga fitur sekaligus dalam satu aplikasi Android, dengan seluruh output berupa kalimat deskriptif lengkap dalam Bahasa Indonesia yang disampaikan melalui audio.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3
              className="text-base font-semibold text-white"
              style={{ textShadow: "0 0 10px rgba(255,255,255,0.85), 0 0 28px rgba(255,255,255,0.4)" }}
            >
              Deskripsi Objek dan Pemandangan
            </h3>
            <p className="text-white text-sm font-light leading-relaxed">
              Fitur ini menggunakan pipeline dua tahap. YOLOv11 berjalan terlebih dahulu untuk mendeteksi dan melokalisasi objek dalam frame kamera, menghasilkan label string untuk setiap objek yang teridentifikasi. Label tersebut kemudian dirangkai menjadi prompt teks yang masuk ke BLIP-2 bersama representasi visual dari gambar. BLIP-2 dengan backbone OPT-2.7B lalu menghasilkan kalimat deskripsi yang natural dan kontekstual — bukan sekadar menyebutkan nama objek, melainkan menjelaskan situasi secara utuh.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3
              className="text-base font-semibold text-white"
              style={{ textShadow: "0 0 10px rgba(255,255,255,0.85), 0 0 28px rgba(255,255,255,0.4)" }}
            >
              Pembacaan Teks (OCR)
            </h3>
            <p className="text-white text-sm font-light leading-relaxed">
              Fitur OCR memungkinkan pengguna membaca teks yang tertera pada kemasan produk, papan petunjuk, struk belanja, atau dokumen cetak secara langsung melalui kamera. ELIOR menggunakan Google ML Kit sebagai mesin OCR yang berjalan sepenuhnya di perangkat (on-device), sehingga fitur ini dapat digunakan tanpa koneksi internet. Ini menjadikan OCR sebagai satu-satunya fitur ELIOR yang sepenuhnya bersifat offline.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3
              className="text-base font-semibold text-white"
              style={{ textShadow: "0 0 10px rgba(255,255,255,0.85), 0 0 28px rgba(255,255,255,0.4)" }}
            >
              Deteksi Uang Rupiah
            </h3>
            <p className="text-white text-sm font-light leading-relaxed">
              Fitur ini mengenali 9 kelas mata uang Rupiah: 7 pecahan uang kertas Tahun Emisi 2022 terbitan Bank Indonesia (Rp1.000, Rp2.000, Rp5.000, Rp10.000, Rp20.000, Rp50.000, dan Rp100.000), ditambah 2 koin Tahun Emisi 2022 yaitu Rp500 dan Rp1.000. Model YOLOv11 di-fine-tune khusus pada dataset Rupiah dari Kaggle/Roboflow untuk mengenali seluruh nominal tersebut secara akurat dalam kondisi pencahayaan dan sudut pengambilan gambar yang bervariasi.
            </p>
          </div>
        </div>

        {/* Kamera disabled — tombol ini aktif kembali saat fitur kamera web dinyalakan */}
        {/* <button
          onClick={onOpenCamera}
          className="liquid-glass-strong rounded-3xl self-start flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium mt-1"
        >
          Buka Kamera
          <ArrowUpRight className="w-4 h-4" />
        </button> */}
        </div>{/* end content padding */}
      </div>
    </div>
  );
}
