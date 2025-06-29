const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-group-manager"
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

// Configuration
const TARGET_GROUP_ID = "120363415434456792";

// Formal notification message for removed participants
const REMOVAL_MESSAGE = `Hey! 👋

We noticed you haven't been active in the group for a while, so you've been removed to keep things fresh and relevant for everyone.

If this was a mistake, message +918686804860 and explain your situation.

Thanks for understanding!

- Group Admin Team ✨`;

// Load inactive participants to remove
let inactiveParticipants = [];
try {
    inactiveParticipants = JSON.parse(fs.readFileSync('inactive_participants.json', 'utf8'));
    console.log(`📱 Loaded ${inactiveParticipants.length} inactive participants to remove`);
} catch (error) {
    console.error('❌ Error loading inactive_participants.json:', error.message);
    process.exit(1);
}

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

// When client is ready, start removing participants
client.on('ready', async () => {
    console.log('✅ WhatsApp Web client is ready!');
    console.log('🔍 Looking for target group...\n');
    
    await removeInactiveParticipants();
});

// Function to find and remove inactive participants from group
async function removeInactiveParticipants() {
    try {
        // Get all chats and find the target group
        console.log('📋 Loading all chats...');
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        
        console.log(`📱 Found ${groups.length} groups total`);
        
        // Find the specific group
        const targetGroup = groups.find(group => group.id._serialized === TARGET_GROUP_ID);
        
        if (!targetGroup) {
            console.error(`❌ Group "${TARGET_GROUP_ID}" not found!`);
            console.log('\n📋 Available groups:');
            groups.forEach((group, index) => {
                console.log(`   ${index + 1}. ${group.name}`);
            });
            return;
        }
        
        console.log(`✅ Found target group: "${targetGroup.name}"`);
        console.log(`👥 Group has ${targetGroup.participants.length} participants`);
        
        // Check if user is admin of the group
        const myId = client.info.wid._serialized;
        const myParticipant = targetGroup.participants.find(p => p.id._serialized === myId);
        
        if (!myParticipant || !myParticipant.isAdmin) {
            console.error('❌ You must be an admin of this group to remove participants!');
            return;
        }
        
        console.log('✅ You are an admin of this group');
        
        // Get current group participants (phone numbers only)
        const currentParticipants = targetGroup.participants.map(p => `+${p.id.user}`);
        
        // Find which inactive participants are actually in the group
        const participantsToRemove = inactiveParticipants.filter(phoneNumber => 
            currentParticipants.includes(phoneNumber)
        );
        
        const notInGroup = inactiveParticipants.filter(phoneNumber => 
            !currentParticipants.includes(phoneNumber)
        );
        
        console.log(`\n📊 ANALYSIS:`);
        console.log(`   📱 Total inactive participants: ${inactiveParticipants.length}`);
        console.log(`   ✅ Actually in group: ${participantsToRemove.length}`);
        console.log(`   ❌ Not in group: ${notInGroup.length}`);
        
        if (participantsToRemove.length === 0) {
            console.log('\n🎉 No inactive participants found in the group! Nothing to remove.');
            return;
        }
        
        // Show participants that will be removed
        console.log(`\n🚨 PARTICIPANTS TO BE REMOVED (${participantsToRemove.length}):`);
        participantsToRemove.slice(0, 10).forEach((number, index) => {
            console.log(`   ${index + 1}. ${number}`);
        });
        if (participantsToRemove.length > 10) {
            console.log(`   ... and ${participantsToRemove.length - 10} more`);
        }
        
        console.log('\n⚠️  WARNING: This will remove participants from the group!');
        console.log('🔄 Starting removal process...\n');
        
        // Remove participants one by one
        let successCount = 0;
        let failCount = 0;
        const results = [];
        
        for (let i = 0; i < participantsToRemove.length; i++) {
            const phoneNumber = participantsToRemove[i];
            const progress = `[${i + 1}/${participantsToRemove.length}]`;
            
            try {
                console.log(`${progress} 🚮 Removing ${phoneNumber}...`);
                
                // Format phone number for WhatsApp (remove + and add @c.us)
                const participantId = phoneNumber.replace('+', '') + '@c.us';
                
                // Remove participant from group
                await targetGroup.removeParticipants([participantId]);
                
                console.log(`${progress} ✅ SUCCESS: Removed ${phoneNumber}`);
                
                // Small delay before sending notification
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Send notification message to removed participant
                try {
                    console.log(`${progress} 📨 Sending notification to ${phoneNumber}...`);
                    await client.sendMessage(participantId, REMOVAL_MESSAGE);
                    console.log(`${progress} ✅ Notification sent to ${phoneNumber}`);
                    results.push({ number: phoneNumber, status: 'removed', notificationSent: true });
                } catch (msgError) {
                    console.log(`${progress} ⚠️  Removed but notification failed: ${phoneNumber}`);
                    results.push({ number: phoneNumber, status: 'removed', notificationSent: false, msgError: msgError.message });
                }
                
                successCount++;
                
                // Add delay between removals to avoid rate limiting
                if (i < participantsToRemove.length - 1) {
                    console.log(`${progress} ⏳ Waiting 5 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                console.log(`${progress} ❌ FAILED: ${phoneNumber} - ${error.message}`);
                failCount++;
                results.push({ number: phoneNumber, status: 'failed', error: error.message });
                
                // Still wait even on failure
                if (i < participantsToRemove.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        // Calculate notification statistics
        const removedWithNotification = results.filter(r => r.status === 'removed' && r.notificationSent === true).length;
        const removedWithoutNotification = results.filter(r => r.status === 'removed' && r.notificationSent === false).length;
        
        // Summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 REMOVAL COMPLETE - SUMMARY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`👥 Group: ${targetGroup.name}`);
        console.log(`📱 Participants to remove: ${participantsToRemove.length}`);
        console.log(`✅ Successfully removed: ${successCount}`);
        console.log(`❌ Failed to remove: ${failCount}`);
        console.log(`📨 Notifications sent: ${removedWithNotification}`);
        console.log(`⚠️  Removed but notification failed: ${removedWithoutNotification}`);
        console.log(`📊 Removal Success Rate: ${((successCount / participantsToRemove.length) * 100).toFixed(1)}%`);
        console.log(`📧 Notification Success Rate: ${successCount > 0 ? ((removedWithNotification / successCount) * 100).toFixed(1) : 0}%`);
        
        // Save results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const resultsFile = `removal_results_${timestamp}.json`;
        fs.writeFileSync(resultsFile, JSON.stringify({
            groupName: targetGroup.name,
            timestamp: new Date().toISOString(),
            totalToRemove: participantsToRemove.length,
            successCount: successCount,
            failCount: failCount,
            results: results,
            notInGroup: notInGroup
        }, null, 2));
        
        console.log(`\n📁 Results saved to: ${resultsFile}`);
        
        if (failCount > 0) {
            const failedNumbers = results.filter(r => r.status === 'failed').map(r => r.number);
            console.log(`\n❌ FAILED TO REMOVE (${failCount}):`);
            failedNumbers.forEach((num, index) => {
                console.log(`   ${index + 1}. ${num}`);
            });
        }
        
        console.log('\n🎉 Participant removal complete!');
        console.log('💡 You can now close this app with Ctrl+C');
        
    } catch (error) {
        console.error('❌ Error in removal process:', error);
    }
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
console.log('🚀 Starting WhatsApp Group Manager...');
console.log('📦 Initializing browser...');
console.log(`🎯 Target Group: "${TARGET_GROUP_ID}"`);
console.log(`📱 Participants to remove: ${inactiveParticipants.length}`);
console.log('📨 Will send notification messages to removed participants');

client.initialize().catch(error => {
    console.error('❌ Failed to initialize client:', error.message);
    console.log('\n💡 Common fixes:');
    console.log('   • Install Chrome: brew install google-chrome');
    console.log('   • Or install Chromium: brew install chromium');
    console.log('   • Check if you have enough memory available');
    console.log('   • Try running: npm install puppeteer');
    process.exit(1);
}); 