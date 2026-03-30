import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AquaPrana — Life force for your ponds',
  description: 'AquaPassbook v0.2 — Daily pond management logbook for aquaculture farmers',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-ap-gray flex flex-col items-center justify-start">
          <div className="mobile-container shadow-card-lg">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
