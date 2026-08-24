const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

export type AnalyzeCategory = "ocr" | "rupiah" | "object";

export interface AnalyzeResponse {
  text: string;
  category: AnalyzeCategory;
  confidence?: number;
}

export async function analyzeImage(base64Image: string): Promise<AnalyzeResponse> {
  if (base64Image.length > 5_000_000) {
    throw new Error("Gambar terlalu besar, coba lagi dengan gambar lebih kecil");
  }

  const res = await fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY && { "X-API-Key": API_KEY }),
    },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!res.ok) {
    throw new Error("Analisis gagal, coba lagi");
  }

  return res.json() as Promise<AnalyzeResponse>;
}
