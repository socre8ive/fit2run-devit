const bcrypt = require('bcryptjs');

// Change these to your desired credentials
const passwords = [
  { username: 'admin', password: 'Fit2Run2024!' },
  { username: 'fit2run', password: 'Dashboard2024!' }
];

console.log('Generating password hashes...\n');

passwords.forEach(async ({ username, password }) => {
  const hash = await bcrypt.hash(password, 10);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}\n`);
});