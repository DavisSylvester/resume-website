const fs = require('fs');
const path = require('path');

// Check if sharp is available, if not use a simpler approach
try {
  const sharp = require('sharp');
  
  const inputPath = path.join(__dirname, 'public/images/davis.jpeg');
  const outputDir = path.join(__dirname, 'public/favicons');
  
  // Create favicon sizes
  const sizes = [16, 32, 64, 128, 192, 256];
  
  Promise.all(
    sizes.map(size =>
      sharp(inputPath)
        .resize(size, size, { fit: 'cover' })
        .toFile(path.join(outputDir, `favicon-${size}x${size}.png`))
        .then(() => console.log(`✓ Created favicon-${size}x${size}.png`))
        .catch(err => console.error(`Error creating ${size}x${size}:`, err))
    )
  ).then(() => {
    console.log('✓ All favicon sizes created successfully!');
    console.log('Use favicon-192x192.png as your main favicon.');
  }).catch(err => console.error('Error:', err));
} catch (e) {
  console.error('sharp not available. Please install it with: npm install sharp');
}
