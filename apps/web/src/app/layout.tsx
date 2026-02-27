import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Orqestra",
  description: "Orqestra Control Plane",
};

const themeScript = `
(function() {
  var s = localStorage.getItem('orqestra_theme');
  var dark = false;
  if (s === 'light' || s === 'dark') {
    dark = s === 'dark';
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    dark = true;
  }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <Navbar />
          <div className="flex min-h-[calc(100vh-3.5rem)]">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
