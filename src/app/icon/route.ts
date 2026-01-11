import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the logo-icon.svg file
    const iconPath = path.join(process.cwd(), 'public', 'logo-icon.svg');
    const iconContent = fs.readFileSync(iconPath, 'utf-8');
    
    // Return as SVG with proper headers
    return new NextResponse(iconContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving icon:', error);
    return new NextResponse('Not Found', { status: 404 });
  }
}




