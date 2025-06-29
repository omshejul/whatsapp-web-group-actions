const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-message-sender"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        timeout: 60000
    }
});

// Load target numbers
let targetNumbers = [];
try {
    targetNumbers = JSON.parse(fs.readFileSync('active_not_in_group.json', 'utf8'));
    console.log(`📱 Loaded ${targetNumbers.length} target numbers`);
} catch (error) {
    console.error('❌ Error loading active_not_in_group.json:', error.message);
    process.exit(1);
}

// Message to send
const MESSAGE = "hi, you got the slot?";

// Add loading progress indicators
client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Loading: ${percent}% - ${message}`);
});

client.on('connecting', () => {
    console.log('🔗 Connecting to WhatsApp Web...');
});

// Generate QR code for authentication
client.on('qr', (qr) => {
    console.log('📱 Scan the QR code below with your WhatsApp:');
    qrcode.generate(qr, { small: true });
    console.log('\n⏰ QR code expires in 20 seconds. Scan quickly!');
});

// Handle authentication
client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
    console.log('⏳ Setting up client...');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    console.log('💡 Try restarting the app and scanning a fresh QR code.');
});

// When client is ready, start sending messages
client.on('ready', async () => {
    console.log('✅ WhatsApp Web client is ready!');
    console.log(`📨 Starting to send messages to ${targetNumbers.length} numbers...\n`);
    
    await sendMessagesToAll();
});

// Function to send messages to all target numbers
async function sendMessagesToAll() {
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    console.log(`📤 Message: "${MESSAGE}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    for (let i = 0; i < targetNumbers.length; i++) {
        const phoneNumber = targetNumbers[i];
        const progress = `[${i + 1}/${targetNumbers.length}]`;
        
        try {
            console.log(`${progress} 📞 Sending to ${phoneNumber}...`);
            
            // Format phone number for WhatsApp (remove + and add @c.us)
            const chatId = phoneNumber.replace('+', '') + '@c.us';
            
            // Send message
            await client.sendMessage(chatId, MESSAGE);
            
            console.log(`${progress} ✅ SUCCESS: ${phoneNumber}`);
            successCount++;
            results.push({ number: phoneNumber, status: 'success' });
            
            // Add delay between messages to avoid being blocked
            if (i < targetNumbers.length - 1) {
                console.log(`${progress} ⏳ Waiting 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            console.log(`${progress} ❌ FAILED: ${phoneNumber} - ${error.message}`);
            failCount++;
            results.push({ number: phoneNumber, status: 'failed', error: error.message });
            
            // Still wait even on failure
            if (i < targetNumbers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SENDING COMPLETE - SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📱 Total Numbers: ${targetNumbers.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Success Rate: ${((successCount / targetNumbers.length) * 100).toFixed(1)}%`);
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const resultsFile = `message_results_${timestamp}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify({
        message: MESSAGE,
        timestamp: new Date().toISOString(),
        totalNumbers: targetNumbers.length,
        successCount: successCount,
        failCount: failCount,
        results: results
    }, null, 2));
    
    console.log(`\n📁 Results saved to: ${resultsFile}`);
    
    if (failCount > 0) {
        const failedNumbers = results.filter(r => r.status === 'failed').map(r => r.number);
        console.log(`\n❌ FAILED NUMBERS (${failCount}):`);
        failedNumbers.forEach((num, index) => {
            console.log(`   ${index + 1}. ${num}`);
        });
    }
    
    console.log('\n🎉 Message sending complete!');
    console.log('💡 You can now close this app with Ctrl+C');
}

// Error handling
client.on('disconnected', (reason) => {
    console.log('🔌 Client was disconnected:', reason);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});

// Add connection timeout handling
const connectionTimeout = setTimeout(() => {
    console.log('\n⚠️  Connection is taking longer than expected...');
    console.log('💡 Possible solutions:');
    console.log('   1. Check your internet connection');
    console.log('   2. Make sure Chrome/Chromium is installed');
    console.log('   3. Try restarting the app');
}, 30000);

client.on('ready', () => {
    clearTimeout(connectionTimeout);
});

client.on('auth_failure', () => {
    clearTimeout(connectionTimeout);
});

// Initialize the client
console.log('🚀 Starting WhatsApp Message Sender...');
console.log('📦 Initializing browser...');

client.initialize().catch(error => {
    console.error('❌ Failed to initialize client:', error.message);
    console.log('\n💡 Common fixes:');
    console.log('   • Install Chrome: brew install google-chrome');
    console.log('   • Or install Chromium: brew install chromium');
    console.log('   • Check if you have enough memory available');
    console.log('   • Try running: npm install puppeteer');
    process.exit(1);
}); 