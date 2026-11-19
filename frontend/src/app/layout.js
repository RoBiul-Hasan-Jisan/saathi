import { Inter, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-bn", display: "swap" });

export const metadata = {
  title: "Saathi by NirapodRx",
  description: "Verified Bangla medicine cards for rural pharmacies and families.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${bengali.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
