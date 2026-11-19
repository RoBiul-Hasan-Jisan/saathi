import "./globals.css";
import SwRegister from "@/components/SwRegister";

export const metadata = {
  title: "Saathi — verified Bangla medicine cards",
  description: "NirapodRx Saathi: medicine safety, explained in Bangla.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport = { themeColor: "#0f5c4d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
