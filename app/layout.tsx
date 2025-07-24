import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Knowledge Graph Builder - NeoTextGraph',
  description: 'A simple web app that extracts named entities and their relationships from text and visualizes them as a knowledge graph in Neo4j. It uses NLP to identify people, organizations, and locations, and maps how they are connected.'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
