import type { Metadata } from "next";
import "./globals.css";
import { AppToasts } from "./components/toasts";

export const metadata: Metadata = {
  title: {
    default: "Consolidador",
    template: "%s | Consolidador",
  },
  description:
    "Consolidador de extracciones RM y Percápita desde Portal Archivos Periódicos TrakCare.",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="app-shell">
        {children}
        <AppToasts />
      </body>
    </html>
  );
}
