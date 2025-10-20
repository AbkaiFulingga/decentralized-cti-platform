// app/layout.js
import './globals.css';
import NavBar from '../components/NavBar';

export const metadata = {
  title: 'Decentralized CTI Platform',
  description: 'Privacy-preserving threat intelligence sharing on blockchain',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#1a0b2e] min-h-screen">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
