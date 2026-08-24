"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";

interface Feature {
  key: string;
  label: string;
  title: string;
  desc: string;
  points: string[];
  sample: string; // contoh teks hasil yang dibacakan app
  shot?: string; // ganti dgn screenshot asli, mis. "/shots/rupiah.png"
}

const FEATURES: Feature[] = [
  {
    key: "rupiah",
    label: "Uang Rupiah",
    title: "Deteksi Uang Rupiah",
    desc: "Arahkan kamera ke uang, Elior menyebutkan nominalnya dengan suara — langsung di perangkat, tanpa menunggu.",
    points: [
      "7 uang kertas + 2 koin (Rp500 & Rp1.000), Tahun Emisi 2022",
      "Ditenagai model deteksi gambar, berjalan di perangkat",
      "Hasil dibacakan otomatis lewat suara",
    ],
    sample: "Uang kertas lima puluh ribu rupiah.",
  },
  {
    key: "baca",
    label: "Baca Teks",
    title: "Pembacaan Teks (OCR)",
    desc: "Baca kemasan produk, papan petunjuk, struk, atau dokumen cetak hanya dengan mengarahkan kamera.",
    points: [
      "Model OCR berjalan di perangkat, sepenuhnya offline",
      "Urutan baca dirapikan otomatis",
      "Cocok untuk teks Bahasa Indonesia",
    ],
    sample: "Susu UHT Full Cream, isi 1 liter.",
  },
  {
    key: "objek",
    label: "Objek",
    title: "Deskripsi Objek & Pemandangan",
    desc: "Elior menjelaskan apa yang ada di depan Anda dalam kalimat utuh Bahasa Indonesia, bukan sekadar nama benda.",
    points: [
      "Memadukan model deteksi objek + model bahasa visual",
      "Deskripsi kontekstual, bukan sekadar label",
    ],
    sample: "Sebuah cangkir putih di atas meja kayu, di sebelahnya ada buku terbuka.",
  },
  {
    key: "qr",
    label: "Pindai QR",
    title: "Pindai Kode QR",
    desc: "Deteksi kode QR secara langsung dan buka tautannya dengan mudah, dipandu suara di setiap langkah.",
    points: [
      "Deteksi langsung dari kamera",
      "Membacakan isi & membuka tautan",
      "Tanpa perlu aplikasi tambahan",
    ],
    sample: "Tautan terdeteksi: elior.my.id",
  },
];

function ResultDrawer({ feature }: { feature: Feature }) {
  return (
    <div className="glass-gold rounded-[1.6rem] p-4 w-full max-w-[320px] mx-auto">
      {/* Area kamera / gambar hasil */}
      <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-gradient-to-br from-white/[0.07] to-white/[0.02]">
        {feature.shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={feature.shot} alt={feature.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,198,88,0.10),transparent_70%)]" />
            <div className="scanlines absolute inset-0 opacity-40" />
            <span className="absolute top-3 left-3 text-[0.65rem] tracking-wider uppercase text-white/40">
              Pratinjau Kamera
            </span>
            {/* bingkai fokus */}
            <div className="absolute inset-8 border border-white/15 rounded-xl" />
          </>
        )}
      </div>

      {/* Drawer hasil — teks ter-generate + suara */}
      <div key={feature.key} className="animate-fade-up mt-3 glass-gold rounded-2xl p-4 flex flex-col gap-3">
        <span className="text-[0.65rem] tracking-wider uppercase text-gold">Hasil Pindai</span>
        <p className="text-white text-sm leading-relaxed">{feature.sample}</p>
        <div className="flex items-center gap-2.5 pt-1">
          <span className="text-gold">
            <Volume2 className="w-4 h-4" />
          </span>
          <div className="flex items-end gap-1 h-4">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className="wave-bar w-1 h-full rounded-full bg-[oklch(0.85_0.12_85)]"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="text-white/40 text-xs ml-auto">Membacakan…</span>
        </div>
      </div>
    </div>
  );
}

export function FeatureTabs() {
  const [active, setActive] = useState(0);
  const f = FEATURES[active];

  return (
    <div className="grid lg:grid-cols-[14rem_1fr] gap-4 sm:gap-6 items-start">
      {/* Rail tab — grid 2 kolom di mobile, vertikal di desktop (tanpa scroll/tumpuk) */}
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
        {FEATURES.map((feat, i) => {
          const on = i === active;
          return (
            <button
              key={feat.key}
              onClick={() => setActive(i)}
              className={`group flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-left whitespace-nowrap transition-all duration-300 lg:w-full ${
                on
                  ? "glass-gold blur-none opacity-100"
                  : "blur-[1.6px] opacity-55 hover:blur-none hover:opacity-100 hover:bg-white/5"
              }`}
            >
              <span className={`text-[0.7rem] sm:text-xs font-mono tabular-nums ${on ? "text-gold" : "text-white/60"}`}>
                0{i + 1}
              </span>
              <span className="text-xs sm:text-sm font-medium text-white">{feat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel: teks (kiri) + mock drawer app (kanan) */}
      <div className="glass-gold rounded-3xl p-6 sm:p-8 lg:p-10 grid md:grid-cols-2 gap-6 lg:gap-10 items-center">
        <div key={f.key} className="animate-fade-up flex flex-col gap-4 sm:gap-5">
          <h3 className="font-baskerville text-xl sm:text-2xl lg:text-3xl text-white">{f.title}</h3>
          <p className="text-white/80 text-sm sm:text-base leading-relaxed">{f.desc}</p>
          <ul className="flex flex-col gap-2.5">
            {f.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-white/75 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[oklch(0.85_0.12_85)] shrink-0 glow-gold" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <ResultDrawer feature={f} />
      </div>
    </div>
  );
}
