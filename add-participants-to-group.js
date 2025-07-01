const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

/**
 * WhatsApp Group Manager - Add Participants
 * 
 * This script adds participants to a specific WhatsApp group. If direct adding is not 
 * allowed (restricted group settings), it automatically sends them a group invite link.
 * 
 * @description Automated tool to add members to WhatsApp groups with invite fallback
 * @author Om
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
 * 4. A JSON file containing participant phone numbers to add
 * 
 * @setup
 * 1. Install dependencies: `npm install whatsapp-web.js qrcode-terminal`
 * 2. Configure GROUP_ID with your group's ID (see configuration section)
 * 3. Set PARTICIPANTS_TO_ADD_FILE to point to your JSON file with phone numbers
 * 4. Ensure your JSON file contains an array of phone numbers with + prefix
 *    Example: ["+1234567890", "+0987654321"]
 * 
 * @usage
 * 1. Run the script: `node add-participants-to-group.js`
 * 2. Scan the QR code with WhatsApp Web
 * 3. Wait for authentication and group processing
 * 4. The script will automatically:
 *    - Find the target group by ID
 *    - Check your admin status
 *    - Try to add participants directly
 *    - Send invite links if direct adding fails
 *    - Generate a results file with timestamps
 * 
 * @configuration
 * - GROUP_ID: The WhatsApp group ID (find using export-all-groups-info.js)
 * - PARTICIPANTS_TO_ADD_FILE: Path to JSON file with phone numbers to add
 * - INVITE_MESSAGE: Customize the message sent with group invite links
 * 
 * @output
 * - Console logs with real-time progress and statistics
 * - JSON results file: `add_results_YYYY-MM-DDTHH-MM-SS.json`
 * - Summary report with success/failure counts and invite statistics
 * 
 * @safety
 * - Script includes admin verification before proceeding
 * - Optimized delays between operations to avoid rate limiting
 * - Separate tracking for direct adds vs invite sends
 * - Graceful error handling for failed operations
 * - Automatically skips participants who are already in the group
 * 
 * @notes
 * - Only participants not currently in the group will be processed
 * - Requires admin privileges in the target group
 * - Phone numbers must include country code with + prefix
 * - Results are automatically saved with timestamps
 * - Script can be interrupted safely with Ctrl+C
 * 
 * @example
 * ```bash
 * # Basic usage
 * node add-participants-to-group.js
 * 
 * # Run in background (for large participant lists)
 * nohup node add-participants-to-group.js > add.log 2>&1 &
 * ```
 * 
 * @see export-all-groups-info.js - To find your group ID
 * @see remove-inactive-from-group.js - For removing participants
 */

// Configuration
const GROUP_ID = "120363401616166216";
const PARTICIPANTS_TO_ADD_FILE = 'participants_to_add.json';

// Timing Configuration (milliseconds)
const DELAYS = {
    VERIFICATION: 1000,     // Wait after add before checking if it worked
    PRE_INVITE: 500,        // Wait before sending invite message  
    BETWEEN_ADDS: 2000,     // Main rate limiting - wait between each add/invite
    AFTER_FAILURE: 1000     // Wait after failed attempts
};

// Load participants to add
const TARGET_GROUP_ID = `${GROUP_ID}@g.us`;
let participants_to_add = [];
try {
    participants_to_add = JSON.parse(fs.readFileSync(PARTICIPANTS_TO_ADD_FILE, 'utf8'));
    console.log(`📱 Loaded ${participants_to_add.length} participants to add`);
} catch (error) {
    console.error(`❌ Error loading ${PARTICIPANTS_TO_ADD_FILE}:`, error.message);
    process.exit(1);
}

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-group-adder"
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

// Message sent with group invite links
const INVITE_MESSAGE = `Hi! 👋

The owner of the original group feels that people who are not contributing also deserve the updates. However, it seems unfair to those of us who are volunteering, so I have created another group where you will be with people who are actually helping.

Note: Only people who haven't contributed even once in a month have been removed from the original group.

You've been invited to join the slots update group. Please click the link below to join:

https://chat.whatsapp.com/F62pSwcfaqU6w816V6FvZM

Looking forward to having you in our community! ✨
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

// When client is ready, start adding participants
client.on('ready', async () => {
    console.log('✅ WhatsApp Web client is ready!');
    console.log('🔍 Looking for target group...\n');
    
    await addParticipantsToGroup();
});

// Function to add participants to group
async function addParticipantsToGroup() {
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
            console.error('❌ You must be an admin of this group to add participants!');
            return;
        }
        
        console.log('✅ You are an admin of this group');
        
        // Get current group participants (phone numbers only)
        const currentParticipants = targetGroup.participants.map(p => `+${p.id.user}`);
        
        // Find which participants are not yet in the group
        const participantsToAdd = participants_to_add.filter(phoneNumber => 
            !currentParticipants.includes(phoneNumber)
        );
        
        const alreadyInGroup = participants_to_add.filter(phoneNumber => 
            currentParticipants.includes(phoneNumber)
        );
        
        console.log(`\n📊 ANALYSIS:`);
        console.log(`   📱 Total participants to add: ${participants_to_add.length}`);
        console.log(`   ➕ Need to be added: ${participantsToAdd.length}`);
        console.log(`   ✅ Already in group: ${alreadyInGroup.length}`);
        
        if (participantsToAdd.length === 0) {
            console.log('\n🎉 All participants are already in the group! Nothing to add.');
            return;
        }
        
        // Show participants that will be added
        console.log(`\n🎯 PARTICIPANTS TO BE ADDED (${participantsToAdd.length}):`);
        participantsToAdd.slice(0, 10).forEach((number, index) => {
            console.log(`   ${index + 1}. ${number}`);
        });
        if (participantsToAdd.length > 10) {
            console.log(`   ... and ${participantsToAdd.length - 10} more`);
        }
        
        console.log('\n🚀 Starting add process...\n');
        
        // Get group invite link (we'll need this for fallback)
        let groupInviteCode = null;
        try {
            groupInviteCode = await targetGroup.getInviteCode();
            console.log('🔗 Group invite link obtained for fallback\n');
        } catch (error) {
            console.log('⚠️  Could not get group invite link - direct add only mode\n');
        }
        
        // Add participants one by one
        let successCount = 0;
        let inviteCount = 0;
        let failCount = 0;
        let skipCount = 0;
        const results = [];
        
        for (let i = 0; i < participantsToAdd.length; i++) {
            const phoneNumber = participantsToAdd[i];
            const progress = `[${i + 1}/${participantsToAdd.length}]`;
            
            try {
                console.log(`${progress} ➕ Adding ${phoneNumber}...`);
                
                // Format phone number for WhatsApp (remove + and add @c.us)
                const participantId = phoneNumber.replace('+', '') + '@c.us';
                console.log(`${progress} 🔍 Using participant ID: ${participantId}`);
                
                // Check if participant is already in the group (double-check)
                const updatedGroup = await client.getChatById(targetGroup.id._serialized);
                const alreadyInGroup = updatedGroup.participants.some(p => p.id._serialized === participantId);
                if (alreadyInGroup) {
                    console.log(`${progress} ✅ SKIPPED: ${phoneNumber} is already in the group`);
                    results.push({ number: phoneNumber, status: 'already_in_group', method: 'skipped' });
                    skipCount++;
                    continue;
                }
                
                // Try to add participant directly
                try {
                    console.log(`${progress} ➕ Attempting direct add...`);
                    await targetGroup.addParticipants([participantId]);
                    
                    // Verify addition by checking current participants
                    await new Promise(resolve => setTimeout(resolve, DELAYS.VERIFICATION));
                    const verifyGroup = await client.getChatById(targetGroup.id._serialized);
                    const nowInGroup = verifyGroup.participants.some(p => p.id._serialized === participantId);
                    
                    if (nowInGroup) {
                        console.log(`${progress} ✅ SUCCESS: Added ${phoneNumber} directly`);
                        results.push({ number: phoneNumber, status: 'added', method: 'direct' });
                        successCount++;
                    } else {
                        throw new Error('Participant not found in group after add attempt');
                    }
                    
                } catch (addError) {
                    // Direct add failed, try sending invite link
                    console.log(`${progress} ⚠️  Direct add failed: ${addError.message}`);
                    
                    if (groupInviteCode) {
                        console.log(`${progress} 📨 Sending invite link to ${phoneNumber}...`);
                        
                        await new Promise(resolve => setTimeout(resolve, DELAYS.PRE_INVITE));
                        
                        const inviteLink = `https://chat.whatsapp.com/${groupInviteCode}`;
                        const inviteMessage = INVITE_MESSAGE.replace('[GROUP_INVITE_LINK]', inviteLink);
                        
                        await client.sendMessage(participantId, inviteMessage);
                        console.log(`${progress} ✅ Invite sent to ${phoneNumber}`);
                        results.push({ number: phoneNumber, status: 'invited', method: 'invite_link', inviteLink: inviteLink });
                        inviteCount++;
                    } else {
                        console.log(`${progress} ❌ FAILED: Cannot add ${phoneNumber} and no invite link available`);
                        results.push({ number: phoneNumber, status: 'failed', method: 'none', error: addError.message });
                        failCount++;
                    }
                }
                
                // Add delay between operations to avoid rate limiting
                if (i < participantsToAdd.length - 1) {
                    console.log(`${progress} ⏳ Waiting ${DELAYS.BETWEEN_ADDS/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, DELAYS.BETWEEN_ADDS));
                }
                
            } catch (error) {
                console.log(`${progress} ❌ FAILED: ${phoneNumber} - ${error.message}`);
                failCount++;
                results.push({ number: phoneNumber, status: 'failed', method: 'error', error: error.message });
                
                // Still wait even on failure
                if (i < participantsToAdd.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, DELAYS.AFTER_FAILURE));
                }
            }
        }
        
        // Summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 ADD COMPLETE - SUMMARY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`👥 Group: ${targetGroup.name}`);
        console.log(`📱 Participants to process: ${participantsToAdd.length}`);
        console.log(`✅ Successfully added directly: ${successCount}`);
        console.log(`📨 Invite links sent: ${inviteCount}`);
        console.log(`⏭️  Already in group: ${skipCount}`);
        console.log(`❌ Failed completely: ${failCount}`);
        console.log(`📊 Success Rate: ${participantsToAdd.length > 0 ? (((successCount + inviteCount) / participantsToAdd.length) * 100).toFixed(1) : 0}%`);
        console.log(`➕ Direct Add Rate: ${participantsToAdd.length > 0 ? ((successCount / participantsToAdd.length) * 100).toFixed(1) : 0}%`);
        
        // Save results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const resultsFile = `add_results_${timestamp}.json`;
        fs.writeFileSync(resultsFile, JSON.stringify({
            groupName: targetGroup.name,
            timestamp: new Date().toISOString(),
            totalToProcess: participantsToAdd.length,
            successCount: successCount,
            inviteCount: inviteCount,
            skipCount: skipCount,
            failCount: failCount,
            results: results,
            alreadyInGroup: alreadyInGroup
        }, null, 2));
        
        console.log(`\n📁 Results saved to: ${resultsFile}`);
        
        if (failCount > 0) {
            const failedNumbers = results.filter(r => r.status === 'failed').map(r => r.number);
            console.log(`\n❌ FAILED TO ADD OR INVITE (${failCount}):`);
            failedNumbers.forEach((num, index) => {
                console.log(`   ${index + 1}. ${num}`);
            });
        }
        
        console.log('\n🎉 Participant addition complete!');
        console.log('💡 You can now close this app with Ctrl+C');
        
    } catch (error) {
        console.error('❌ Error in addition process:', error);
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
console.log('🚀 Starting WhatsApp Group Participant Adder...');
console.log('📦 Initializing browser...');
console.log(`🎯 Target Group: "${TARGET_GROUP_ID}"`);
console.log(`📱 Participants to add: ${participants_to_add.length}`);
console.log('➕ Will try direct add first, then invite link fallback');

client.initialize().catch(error => {
    console.error('❌ Failed to initialize client:', error.message);
    console.log('\n💡 Common fixes:');
    console.log('   • Install Chrome: brew install google-chrome');
    console.log('   • Or install Chromium: brew install chromium');
    console.log('   • Check if you have enough memory available');
    console.log('   • Try running: npm install puppeteer');
    process.exit(1);
}); 