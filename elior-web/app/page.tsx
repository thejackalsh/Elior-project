import { FeatureTabs } from "@/components/feature-tabs";

const APK_URL = "https://appdistribution.firebase.dev/i/8a4de61b5497d3ff";

const STEPS = [
  {
    title: "Buka halaman unduh",
    desc: "Kunjungi elior.my.id dan ketuk tombol Unduh Aplikasi Android (Beta).",
    img: "/tut-1.jpeg",
  },
  {
    title: "Daftar dengan email",
    desc: "Masukkan alamat email Anda di halaman Firebase App Distribution, lalu ketuk Daftar.",
    img: "/tut-2.jpeg",
  },
  {
    title: "Terima undangan",
    desc: "Buka email masuk, lalu ketuk Get started untuk menerima undangan pengujian.",
    img: "/tut-3.jpeg",
  },
  {
    title: "Unduh APK",
    desc: "Di halaman Firebase App Distribution, ketuk tombol Download pada versi terbaru.",
    img: "/tut-4.jpeg",
  },
  {
    title: "Buka Perizinan khusus",
    desc: "Buka Pengaturan → Perizinan khusus, lalu ketuk Instal aplikasi tidak dikenal.",
    img: "/tut-6a.jpeg",
  },
  {
    title: "Izinkan Chrome",
    desc: "Pilih Chrome dari daftar, lalu aktifkan toggle Izinkan dari sumber ini.",
    img: "/tut-6c.jpeg",
  },
  {
    title: "Buka file APK",
    desc: "Kembali ke folder Download, lalu ketuk file app.apk yang sudah diunduh.",
    img: "/tut-5.jpeg",
  },
  {
    title: "Pilih Installer paket",
    desc: "Pada dialog Buka dengan, pilih Installer paket untuk memulai instalasi.",
    img: "/tut-6.jpeg",
  },
  {
    title: "Konfirmasi instalasi",
    desc: "Ketuk Instal pada dialog konfirmasi yang muncul.",
    img: "/tut-7.jpeg",
  },
  {
    title: "Abaikan peringatan Play Protect",
    desc: "Jika muncul peringatan Google Play Protect, ketuk Tetap instal lalu Oke.",
    img: "/tut-8.jpeg",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen text-white overflow-hidden">
      {/* Latar */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#111111]" />

      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-white/5 bg-[#111111]/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/elior-logo.png" alt="Elior" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" draggable={false} />
            <span className="text-xl sm:text-2xl text-white tracking-wide font-telma">Elior</span>
          </div>
          <a href={APK_URL} className="btn-gold rounded-full px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold">
            Unduh Beta
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-5 pt-14 sm:pt-20 pb-16 sm:pb-24 flex flex-col items-center text-center gap-5 sm:gap-6">
        <span className="glass-gold rounded-full px-3.5 py-1.5 text-[0.65rem] sm:text-xs tracking-wider text-gold uppercase">
          Teknologi Asistif Berbasis AI
        </span>
        <h1 className="font-baskerville text-[2.5rem] leading-[1.08] sm:text-6xl sm:leading-[1.05] tracking-tight text-white text-balance">
          Lihat Dunia
          <br />
          Lewat Suara.
        </h1>
        <p className="text-white/70 text-base sm:text-lg max-w-xl sm:max-w-2xl leading-relaxed text-pretty">
          Elior membantu penyandang tunanetra mengenali uang, membaca teks, dan memahami
          lingkungan sekitar — semua dibacakan dengan suara dalam Bahasa Indonesia.
        </p>
        <div className="flex flex-col items-center gap-3 mt-1 sm:mt-2 w-full sm:w-auto">
          <a
            href={APK_URL}
            className="btn-gold rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold w-full sm:w-auto text-center"
          >
            Unduh Aplikasi Android (Beta)
          </a>
          <span className="text-white/45 text-xs">Hanya tersedia untuk Android</span>
        </div>
      </section>

      {/* Fitur */}
      <section className="max-w-6xl mx-auto px-5 py-14 sm:py-20">
        <div className="mb-8 sm:mb-10 flex flex-col gap-2 max-w-2xl">
          <span className="text-[0.7rem] tracking-[0.25em] text-gold uppercase">Fitur</span>
          <h2 className="font-baskerville text-2xl sm:text-3xl lg:text-4xl text-white text-balance">
            Satu aplikasi untuk setiap kebutuhan
          </h2>
          <p className="text-white/60 text-sm sm:text-base">
            Pilih fitur untuk melihat detailnya.
          </p>
        </div>
        <FeatureTabs />
      </section>

      {/* Cara Penggunaan */}
      <section className="max-w-5xl mx-auto px-5 py-14 sm:py-20">
        <div className="mb-8 sm:mb-10 flex flex-col gap-2 max-w-2xl">
          <span className="text-[0.7rem] tracking-[0.25em] text-gold uppercase">Panduan</span>
          <h2 className="font-baskerville text-2xl sm:text-3xl lg:text-4xl text-white">Cara penggunaan Elior</h2>
          <p className="text-white/60 text-sm sm:text-base">Delapan langkah mudah untuk mulai menggunakan Elior.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="glass-gold rounded-2xl overflow-hidden flex flex-col">
              <div className="h-64 bg-black flex items-center justify-center overflow-hidden">
                <img src={s.img} alt={s.title} className="h-full object-contain" />
              </div>
              <div className="p-2 sm:p-3 flex flex-col gap-1 flex-1">
                <span className="text-gold text-xl sm:text-2xl font-bold font-baskerville">{i + 1}</span>
                <h3 className="text-sm sm:text-base font-semibold text-white">{s.title}</h3>
                <p className="text-white/65 text-xs leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Download CTA */}
      <section id="unduh" className="max-w-4xl mx-auto px-5 py-16 sm:py-20 scroll-mt-20">
        <div className="glass-gold rounded-[1.75rem] sm:rounded-[2rem] p-8 sm:p-12 lg:p-14 flex flex-col items-center text-center gap-5">
          <h2 className="font-baskerville text-2xl sm:text-3xl lg:text-4xl text-white">Coba Elior sekarang</h2>
          <p className="text-white/70 text-sm sm:text-base max-w-lg">
            Bergabunglah dalam pengujian beta. Bantu kami menyempurnakan Elior untuk lebih banyak
            pengguna.
          </p>
          <a
            href={APK_URL}
            className="btn-gold rounded-full px-8 py-3.5 text-sm sm:text-base font-semibold w-full sm:w-auto text-center"
          >
            Unduh Aplikasi Android (Beta)
          </a>
          <span className="text-white/45 text-xs">Hanya tersedia untuk Android</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#111111]/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-5">
          <div className="flex items-center gap-1.5">
            <img src="/elior-logo.png" alt="Elior" className="w-16 h-16 object-contain" draggable={false} />
            <span className="text-xl text-white font-telma">Elior</span>
          </div>
          <p className="text-white/40 text-xs text-center order-last sm:order-none">
            Teknologi asistif untuk tunanetra · Hanya Android
          </p>
          <p className="text-white/40 text-xs">© 2026 Elior</p>
        </div>
      </footer>
    </main>
  );
}
