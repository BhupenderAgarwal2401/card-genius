#!/bin/bash
# Run this script to generate PWA icons from the SVG favicon
# Requires: npm install -g sharp-cli  OR  use an online converter

echo "To generate PWA icons:"
echo "1. Go to https://realfavicongenerator.net/"
echo "2. Upload public/favicon.svg"
echo "3. Download the package"
echo "4. Copy pwa-192x192.png and pwa-512x512.png to the public/ folder"
echo ""
echo "OR use sharp-cli:"
echo "npm install -g sharp-cli"
echo "sharp -i public/favicon.svg -o public/pwa-192x192.png resize 192 192"
echo "sharp -i public/favicon.svg -o public/pwa-512x512.png resize 512 512"
