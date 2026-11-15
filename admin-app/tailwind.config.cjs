const path = require('path');
const base = require('../tailwind.config.js');

// Sunucudaki tema ile aynı; yalnızca taranan dosyalar farklı.
module.exports = {
  ...base,
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{ts,tsx}'),
    path.join(__dirname, '../src/components/ui/**/*.{ts,tsx}'),
  ],
};
