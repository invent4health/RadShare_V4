const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execPromise = util.promisify(exec);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const SYSTEM_HOSTNAME = os.hostname();
const TRIAL_FILE_PATH = path.resolve(__dirname, '.trial.json');
const TRIAL_PERIOD_DAYS = 15;
const MS_IN_A_DAY = 1000 * 60 * 60 * 24;

const LICENSE_API_URL = 'https://your-api.com/validate-key'; // Replace with your actual API

// Validate license key via API
async function validateLicenseKey(key) {
  try {
    const response = await axios.post(LICENSE_API_URL, {
      key,
      hostname: SYSTEM_HOSTNAME,
    });

    return response.data.valid === true;
  } catch (error) {
    console.error('❌ Error validating license:', error.message);
    return false;
  }
}

// Prompt user
function promptUserChoice() {
  return new Promise(resolve => {
    rl.question(
      'Choose an option:\n1. Start 15-day trial\n2. Enter license key\nEnter 1 or 2: ',
      answer => {
        if (answer === '1') {
          resolve('trial');
        } else if (answer === '2') {
          rl.question('Enter your license key: ', key => {
            resolve(key.trim());
          });
        } else {
          console.log('❌ Invalid choice.');
          resolve(promptUserChoice());
        }
      }
    );
  });
}
function formatTimeRemaining(ms) {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

  return parts.join(' ') || 'less than a minute';
}

// Start or check trial timer
function checkOrStartTrial() {
  let trialData = null;

  if (fs.existsSync(TRIAL_FILE_PATH)) {
    trialData = JSON.parse(fs.readFileSync(TRIAL_FILE_PATH, 'utf8'));
  }

  const now = new Date();

  if (!trialData || trialData.hostname !== SYSTEM_HOSTNAME) {
    const startDate = new Date();
    trialData = { hostname: SYSTEM_HOSTNAME, startDate };
    fs.writeFileSync(TRIAL_FILE_PATH, JSON.stringify(trialData, null, 2));
    return { valid: true, formatted: formatTimeRemaining(TRIAL_PERIOD_DAYS * MS_IN_A_DAY) };
  } else {
    const startDate = new Date(trialData.startDate);
    const timeDiffMs = TRIAL_PERIOD_DAYS * MS_IN_A_DAY - (now - startDate);
    const valid = timeDiffMs > 0;

    return {
      valid,
      formatted: valid ? formatTimeRemaining(timeDiffMs) : '0 days',
    };
  }
}

// App starter
async function startApp() {
  await execPromise('yarn run _start-app');
}

// Main logic
async function checkLicenseAndStart() {
  const userChoice = await promptUserChoice();

  if (userChoice === 'trial') {
    const trial = checkOrStartTrial();
    if (trial.valid) {
      console.log(`✅ Trial active. Time remaining: ${trial.formatted}`);
      rl.close();
      await startApp();
    } else {
      console.log('❌ Trial expired. Please enter a license key.');
      const licenseKey = await new Promise(resolve => {
        rl.question('Enter your license key: ', key => resolve(key.trim()));
      });

      const valid = await validateLicenseKey(licenseKey);
      if (valid) {
        console.log(`✅ License validated for ${SYSTEM_HOSTNAME}`);
        rl.close();
        await startApp();
      } else {
        console.log('❌ Invalid license key.');
        rl.close();
        process.exit(1);
      }
    }
  } else {
    const valid = await validateLicenseKey(userChoice);
    if (valid) {
      console.log(`✅ License validated for ${SYSTEM_HOSTNAME}`);
      rl.close();
      await startApp();
    } else {
      console.log('❌ Invalid license key.');
      rl.close();
      process.exit(1);
    }
  }
}

checkLicenseAndStart().catch(err => {
  console.error('❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
