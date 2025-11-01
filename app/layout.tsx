export const metadata = { title: "MadeProof Demo" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{fontFamily:"system-ui",margin:0,padding:0}}>
        {children}
      </body>
    </html>
  );
}
