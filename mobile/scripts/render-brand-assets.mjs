import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (name) => path.join(root, 'assets', 'brand', name);
const output = (name) => path.join(root, 'assets', 'images', name);

await Promise.all([
  sharp(source('icon.svg')).resize(1024, 1024).png().toFile(output('icon.png')),
  sharp(source('mark.svg')).resize(1024, 1024).png().toFile(output('android-icon-foreground.png')),
  sharp(source('mark.svg')).resize(432, 432).png().toFile(output('android-icon-monochrome.png')),
  sharp(source('splash.svg')).resize(512, 512).png().toFile(output('splash-icon.png')),
  sharp(source('icon.svg')).resize(48, 48).png().toFile(output('favicon.png')),
]);

console.log('Brand assets Financial Planner selesai dirender.');
