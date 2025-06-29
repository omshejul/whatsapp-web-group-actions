const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

/**
 * WhatsApp Group Manager - Remove Inactive Participants
 * 
 * This script removes inactive participants from a specific WhatsApp group and sends them
 * a notification message explaining why they were removed.
 * 
 * @description Automated tool to clean up WhatsApp groups by removing inactive members
 * @author Your Name
 * @version 1.0.0
 * 
 * @requires whatsapp-web.js - WhatsApp Web API client
 * @requires qrcode-terminal - For displaying QR codes in terminal
 * @requires fs - File system operations (built-in Node.js module)
 * 
 * @prerequisites
 * 1. Node.js installed on your system
 * 2. Chrome or Chromium browser installed
 * 3. WhatsApp Web access with admin privileges in the target group
 * 4. A JSON file containing inactive participant phone numbers
 * 
 * @setup
 * 1. Install dependencies: `npm install whatsapp-web.js qrcode-terminal`
 * 2. Configure TARGET_GROUP_ID with your group's ID (see configuration section)
 * 3. Set INACTIVE_PARTICIPANTS_FILE to point to your JSON file with phone numbers
 * 4. Ensure your JSON file contains an array of phone numbers with + prefix
 *    Example: ["+1234567890", "+0987654321"]
 * 
 * @usage
 * 1. Run the script: `node remove-inactive-from-group.js`
 * 2. Scan the QR code with WhatsApp Web
 * 3. Wait for authentication and group processing
 * 4. The script will automatically:
 *    - Find the target group by ID
 *    - Check your admin status
 *    - Remove inactive participants one by one
 *    - Send notification messages to removed users
 *    - Generate a results file with timestamps
 * 
 * @configuration
 * - TARGET_GROUP_ID: The WhatsApp group ID (find using export-all-groups-info.js)
 * - INACTIVE_PARTICIPANTS_FILE: Path to JSON file with phone numbers to remove
 * - REMOVAL_MESSAGE: Customize the notification message sent to removed users
 * 
 * @output
 * - Console logs with real-time progress and statistics
 * - JSON results file: `removal_results_YYYY-MM-DDTHH-MM-SS.json`
 * - Summary report with success/failure counts and notification status
 * 
 * @safety
 * - Script includes admin verification before proceeding
 * - Optimized delays between removals to avoid rate limiting
 * - Separate tracking for removals vs notification delivery
 * - Graceful error handling for failed operations
 * - Automatically skips participants who are already not in the group
 * 
 * @notes
 * - Only participants currently in the group will be processed
 * - Requires admin privileges in the target group
 * - Phone numbers must include country code with + prefix
 * - Results are automatically saved with timestamps
 * - Script can be interrupted safely with Ctrl+C
 * 
 * @example
 * ```bash
 * # Basic usage
 * node remove-inactive-from-group.js
 * 
 * # Run in background (for large participant lists)
 * nohup node remove-inactive-from-group.js > removal.log 2>&1 &
 * ```
 * 
 * @see export-all-groups-info.js - To find your group ID
 * @see send-messages.js - For sending messages without removal
 */

// Configuration
const GROUP_ID = "120363415434456792"; // Refused IN Fall 25 intake (Post Jan, 25) - SLOT UPDATES ONLY
const INACTIVE_PARTICIPANTS_FILE = 'inactive_participants.json';

// Timing Configuration (milliseconds)
const DELAYS = {
    VERIFICATION: 1000,     // Wait after removal before checking if it worked
    PRE_NOTIFICATION: 500,  // Wait before sending notification message  
    BETWEEN_REMOVALS: 2000, // Main rate limiting - wait between each removal
    AFTER_FAILURE: 1000     // Wait after failed attempts
};

// Load inactive participants to remove
const TARGET_GROUP_ID = `${GROUP_ID}@g.us`;
let inactive_participants = [];
try {
    inactive_participants = JSON.parse(fs.readFileSync(INACTIVE_PARTICIPANTS_FILE, 'utf8'));
    console.log(`📱 Loaded ${inactive_participants.length} inactive participants to remove`);
} catch (error) {
    console.error(`❌ Error loading ${INACTIVE_PARTICIPANTS_FILE}:`, error.message);
    process.exit(1);
}

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

// Formal notification message for removed participants
const REMOVAL_MESSAGE = `Hey! 👋

We noticed you haven't been active in the group for a while, so you've been removed to keep things fresh and relevant for everyone.

If this was a mistake, message +918686804860 and explain your situation.

Thanks for understanding!
`;



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
                console.log(`   ${index + 1}. ${group.name} (ID: ${group.id._serialized})`);
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
        const participantsToRemove = inactive_participants.filter(phoneNumber => 
            currentParticipants.includes(phoneNumber)
        );
        
        const notInGroup = inactive_participants.filter(phoneNumber => 
            !currentParticipants.includes(phoneNumber)
        );
        
        console.log(`\n📊 ANALYSIS:`);
        console.log(`   📱 Total inactive participants: ${inactive_participants.length}`);
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
                console.log(`${progress} 🔍 Using participant ID: ${participantId}`);
                
                // Check if participant is still in the group before attempting removal
                const currentParticipant = targetGroup.participants.find(p => p.id._serialized === participantId);
                if (!currentParticipant) {
                    console.log(`${progress} ✅ SKIPPED: ${phoneNumber} is already not in the group (no notification sent)`);
                    results.push({ number: phoneNumber, status: 'already_removed', notificationSent: false });
                    continue;
                }
                
                // Remove participant from group
                const removalResult = await targetGroup.removeParticipants([participantId]);
                
                // Verify removal by checking current participants
                await new Promise(resolve => setTimeout(resolve, DELAYS.VERIFICATION));
                const updatedGroup = await client.getChatById(targetGroup.id._serialized);
                const stillInGroup = updatedGroup.participants.some(p => p.id._serialized === participantId);
                
                if (stillInGroup) {
                    throw new Error(`Participant still in group after removal attempt`);
                }
                
                console.log(`${progress} ✅ SUCCESS: Verified removal of ${phoneNumber}`);
                
                // Small delay before sending notification
                await new Promise(resolve => setTimeout(resolve, DELAYS.PRE_NOTIFICATION));
                
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
                    console.log(`${progress} ⏳ Waiting ${DELAYS.BETWEEN_REMOVALS/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_REMOVALS));
                }
                
            } catch (error) {
                console.log(`${progress} ❌ FAILED: ${phoneNumber} - ${error.message}`);
                failCount++;
                results.push({ number: phoneNumber, status: 'failed', error: error.message });
                
                // Still wait even on failure
                if (i < participantsToRemove.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, DELAYS.AFTER_FAILURE));
                }
            }
        }
        
        // Calculate notification statistics
        const removedWithNotification = results.filter(r => r.status === 'removed' && r.notificationSent === true).length;
        const removedWithoutNotification = results.filter(r => r.status === 'removed' && r.notificationSent === false).length;
        const alreadyRemovedCount = results.filter(r => r.status === 'already_removed').length;
        
        // Summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 REMOVAL COMPLETE - SUMMARY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`👥 Group: ${targetGroup.name}`);
        console.log(`📱 Participants to process: ${participantsToRemove.length}`);
        console.log(`✅ Successfully removed: ${successCount}`);
        console.log(`⏭️  Already not in group: ${alreadyRemovedCount}`);
        console.log(`❌ Failed to remove: ${failCount}`);
        console.log(`📨 Notifications sent: ${removedWithNotification}`);
        console.log(`⚠️  Removed but notification failed: ${removedWithoutNotification}`);
        console.log(`📊 Removal Success Rate: ${participantsToRemove.length > 0 ? ((successCount / participantsToRemove.length) * 100).toFixed(1) : 0}%`);
        console.log(`📧 Notification Success Rate: ${successCount > 0 ? ((removedWithNotification / successCount) * 100).toFixed(1) : 0}%`);
        
        // Save results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const resultsFile = `removal_results_${timestamp}.json`;
        fs.writeFileSync(resultsFile, JSON.stringify({
            groupName: targetGroup.name,
            timestamp: new Date().toISOString(),
            totalToProcess: participantsToRemove.length,
            successCount: successCount,
            failCount: failCount,
            alreadyRemovedCount: alreadyRemovedCount,
            notificationsSent: removedWithNotification,
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
console.log(`📱 Participants to remove: ${inactive_participants.length}`);
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