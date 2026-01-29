import './globals.css';

export const metadata = {
  title: 'Scene Matcher - Gruppo Rosso',
  description: 'Gestione scene per il Teatro Cast - Gruppo Rosso',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
