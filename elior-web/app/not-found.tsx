import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative min-h-screen text-white overflow-hidden flex flex-col">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#111111]" />

      {/* Header */}
      <header className="w-full border-b border-white/5 bg-[#111111]/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <img src="/elior-logo.png" alt="Elior" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" draggable={false} />
            <span className="text-xl sm:text-2xl text-white tracking-wide font-telma">Elior</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 py-16 gap-6">
        <div className="glass-gold rounded-[1.75rem] flex flex-col items-center gap-5 px-10 py-12 max-w-sm w-full text-center">
          <span className="font-baskerville text-8xl font-bold text-white leading-none">
            404
          </span>
          <div className="w-12 h-px bg-white/20" />
          <p className="text-white/70 text-sm leading-relaxed">
            Halaman yang Anda cari tidak ditemukan atau sudah dipindahkan.
          </p>
          <Link
            href="/"
            className="btn-gold rounded-full px-7 py-3 text-sm font-semibold w-full text-center"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </section>
    </main>
  );
}
