import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "Orca",
  description: "Orca Control Plane",
};

const themeScript = `
(function() {
  var s = localStorage.getItem('orca_theme');
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
  var accent = localStorage.getItem('orca_accent');
  if (accent && accent !== 'cyan') {
    document.documentElement.setAttribute('data-accent', accent);
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
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
