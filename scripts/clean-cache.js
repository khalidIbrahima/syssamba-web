#!/usr/bin/env node

/**
 * Cache cleanup script to free up memory
 */

const { execSync } = require('child_process');
const { resolve } = require('path');
const fs = require('fs');

console.log('🧹 Cleaning up caches and temporary files...\n');

const projectRoot = resolve(__dirname, '..');

// Clean Next.js cache
const nextCache = resolve(projectRoot, '.next');
if (fs.existsSync(nextCache)) {
  console.log('🗑️  Removing Next.js cache...');
  try {
    fs.rmSync(nextCache, { recursive: true, force: true });
    console.log('✅ Next.js cache cleared');
  } catch (error) {
    console.error('❌ Failed to clear Next.js cache:', error.message);
  }
}

// Clean node_modules cache
const nodeModules = resolve(projectRoot, 'node_modules');
if (fs.existsSync(nodeModules)) {
  console.log('🧽 Cleaning node_modules cache...');
  try {
    // Remove common cache directories
    const cacheDirs = [
      resolve(nodeModules, '.cache'),
      resolve(nodeModules, '.vite'),
      resolve(projectRoot, '.swc')
    ];

    cacheDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`✅ Removed ${dir.split('\\').pop()}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to clear node_modules cache:', error.message);
  }
}

// Clean npm cache
console.log('🧹 Clearing npm cache...');
try {
  execSync('npm cache clean --force', { stdio: 'inherit' });
  console.log('✅ NPM cache cleared');
} catch (error) {
  console.warn('⚠️  NPM cache clean failed (this is usually okay)');
}

// Clear Windows temp files (if on Windows)
if (process.platform === 'win32') {
  console.log('🪟 Clearing Windows temp files...');
  try {
    execSync('del /q /f %temp%\\* 2>nul', { stdio: 'inherit' });
    console.log('✅ Windows temp files cleared');
  } catch (error) {
    console.warn('⚠️  Windows temp cleanup failed (this is usually okay)');
  }
}

console.log('\n🎉 Cache cleanup completed!');
console.log('💡 You can now run your application with increased memory:');
console.log('   npm run dev');
console.log('   npm run build');
