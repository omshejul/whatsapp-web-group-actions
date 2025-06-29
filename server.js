const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Create a new client instance with browser configuration
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-group-actions"
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

// Store groups for selection
let availableGroups = [];

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

// When client is ready
client.on('ready', async () => {
    console.log('✅ WhatsApp Web client is ready!');
    console.log('🔍 Loading your groups...');
    
    try {
        console.log('📞 Fetching chats from WhatsApp...');
        // Get all chats and filter for groups
        const chats = await client.getChats();
        console.log(`📋 Found ${chats.length} total chats`);
        
        availableGroups = chats.filter(chat => chat.isGroup);
        console.log(`🏷️ Filtered to ${availableGroups.length} groups\n`);
        
        if (availableGroups.length === 0) {
            console.log('❌ No groups found! Make sure you are added to some WhatsApp groups.');
            return;
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 YOUR WHATSAPP GROUPS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        availableGroups.forEach((group, index) => {
            const participantCount = group.participants ? group.participants.length : 'Unknown';
            console.log(`${index + 1}. ${group.name} (${participantCount} participants)`);
        });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        showMenu();
        
    } catch (error) {
        console.error('❌ Error loading groups:', error);
        console.log('💡 Try refreshing with [r] or restart the app.');
    }
});

// Function to show menu options
function showMenu() {
    console.log('\n🤖 MENU OPTIONS:');
    console.log('  [1-' + availableGroups.length + '] - Select a group to analyze');
    console.log('  [r] - Refresh group list');
    console.log('  [q] - Quit');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    rl.question('Enter your choice: ', handleMenuInput);
}

// Function to handle menu input
async function handleMenuInput(input) {
    const choice = input.trim().toLowerCase();
    
    if (choice === 'q') {
        console.log('\n🛑 Shutting down...');
        await client.destroy();
        rl.close();
        process.exit(0);
    }
    
    if (choice === 'r') {
        console.log('\n🔄 Refreshing group list...');
        try {
            const chats = await client.getChats();
            availableGroups = chats.filter(chat => chat.isGroup);
            console.log('✅ Groups refreshed!\n');
            listGroups();
        } catch (error) {
            console.error('❌ Error refreshing groups:', error);
        }
        return;
    }
    
    const groupIndex = parseInt(choice) - 1;
    if (groupIndex >= 0 && groupIndex < availableGroups.length) {
        const selectedGroup = availableGroups[groupIndex];
        console.log(`\n🎯 Selected: ${selectedGroup.name}`);
        showGroupMenu(selectedGroup);
    } else {
        console.log('❌ Invalid choice. Please try again.');
        showMenu();
    }
}

// Function to list groups
function listGroups() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 YOUR WHATSAPP GROUPS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    availableGroups.forEach((group, index) => {
        const participantCount = group.participants ? group.participants.length : 'Unknown';
        console.log(`${index + 1}. ${group.name} (${participantCount} participants)`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    showMenu();
}

// Function to show group-specific menu
function showGroupMenu(group) {
    console.log('\n🔧 GROUP ACTIONS:');
    console.log('  [1] - Show all participants');
    console.log('  [2] - Show only admins');
    console.log('  [3] - Show participant count');
    console.log('  [4] - Save participants to file');
    console.log('  [b] - Back to group list');
    console.log('  [q] - Quit');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    rl.question('Enter your choice: ', (input) => handleGroupMenuInput(input, group));
}

// Function to handle group menu input
async function handleGroupMenuInput(input, group) {
    const choice = input.trim().toLowerCase();
    
    if (choice === 'q') {
        console.log('\n🛑 Shutting down...');
        await client.destroy();
        rl.close();
        process.exit(0);
    }
    
    if (choice === 'b') {
        listGroups();
        return;
    }
    
    switch (choice) {
        case '1':
            await getGroupParticipants(group, false);
            break;
        case '2':
            await getGroupParticipants(group, true);
            break;
        case '3':
            showGroupStats(group);
            break;
        case '4':
            await showSaveMenu(group);
            break;
        default:
            console.log('❌ Invalid choice. Please try again.');
    }
    
    showGroupMenu(group);
}

// Function to get and display group participants (console only)
async function getGroupParticipants(chat, showAdminsOnly = false) {
    try {
        if (!chat.isGroup) {
            console.log('❌ This is not a group chat.');
            return;
        }

        console.log(`\n📋 Participants in group "${chat.name}":`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        const participants = chat.participants;
        const admins = participants.filter(p => p.isAdmin);
        const members = participants.filter(p => !p.isAdmin);
        
        if (showAdminsOnly) {
            console.log(`👑 ADMINS (${admins.length}):`);
            admins.forEach((participant, index) => {
                console.log(`  ${index + 1}. +${participant.id.user}`);
            });
        } else {
            console.log(`👑 ADMINS (${admins.length}):`);
            admins.forEach((participant, index) => {
                console.log(`  ${index + 1}. +${participant.id.user}`);
            });
            
            console.log(`\n👥 MEMBERS (${members.length}):`);
            members.forEach((participant, index) => {
                console.log(`  ${index + 1}. +${participant.id.user}`);
            });
            
            console.log(`\n📊 TOTAL: ${participants.length} participants`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
    } catch (error) {
        console.error('❌ Error getting participants:', error);
    }
}

// Function to show group statistics
function showGroupStats(group) {
    const count = group.participants.length;
    const adminsCount = group.participants.filter(p => p.isAdmin).length;
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 GROUP STATISTICS FOR "${group.name}":`);
    console.log(`  👥 Total Participants: ${count}`);
    console.log(`  👑 Admins: ${adminsCount}`);
    console.log(`  👤 Members: ${count - adminsCount}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// Function to show save format menu
function showSaveMenu(group) {
    console.log('\n💾 SAVE FORMAT OPTIONS:');
    console.log('  [1] - Save as JSON file (structured data - recommended)');
    console.log('  [2] - Save as CSV file (spreadsheet format)');
    console.log('  [3] - Save as TXT file (readable format)');
    console.log('  [b] - Back to group menu');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    rl.question('Enter your choice: ', (input) => handleSaveMenuInput(input, group));
}

// Function to handle save menu input
async function handleSaveMenuInput(input, group) {
    const choice = input.trim().toLowerCase();
    
    if (choice === 'b') {
        showGroupMenu(group);
        return;
    }
    
    switch (choice) {
        case '1':
            await saveParticipantsToFile(group, 'json');
            break;
        case '2':
            await saveParticipantsToFile(group, 'csv');
            break;
        case '3':
            await saveParticipantsToFile(group, 'txt');
            break;
        default:
            console.log('❌ Invalid choice. Please try again.');
            showSaveMenu(group);
            return;
    }
    
    showGroupMenu(group);
}

// Function to save participants to file
async function saveParticipantsToFile(group, format = 'txt') {
    try {
        if (!group.isGroup) {
            console.log('❌ This is not a group chat.');
            return;
        }

        const participants = group.participants;
        const admins = participants.filter(p => p.isAdmin);
        const members = participants.filter(p => !p.isAdmin);
        
        // Create filename with sanitized group name and timestamp
        const sanitizedGroupName = group.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${sanitizedGroupName}_participants_${timestamp}.${format}`;
        const filepath = path.join(process.cwd(), filename);
        
        let content = '';
        
        if (format === 'json') {
            // Create JSON content
            const jsonData = {
                groupInfo: {
                    name: group.name,
                    totalParticipants: participants.length,
                    adminCount: admins.length,
                    memberCount: members.length,
                    exportDate: new Date().toISOString(),
                    exportTimestamp: Date.now()
                },
                participants: participants.map((participant, index) => ({
                    index: index + 1,
                    phoneNumber: `+${participant.id.user}`,
                    role: participant.isAdmin ? 'admin' : 'member',
                    isAdmin: participant.isAdmin
                })),
                admins: admins.map((admin, index) => ({
                    index: index + 1,
                    phoneNumber: `+${admin.id.user}`,
                    role: 'admin',
                    isAdmin: true
                })),
                members: members.map((member, index) => ({
                    index: index + 1,
                    phoneNumber: `+${member.id.user}`,
                    role: 'member',
                    isAdmin: false
                })),
                metadata: {
                    generatedBy: 'WhatsApp Group Actions Bot',
                    version: '1.0.0',
                    format: 'json'
                }
            };
            
            content = JSON.stringify(jsonData, null, 2);
        } else if (format === 'csv') {
            // Create CSV content
            content += `Group Name,Phone Number,Role,Index\n`;
            participants.forEach((participant, index) => {
                const role = participant.isAdmin ? 'Admin' : 'Member';
                content += `"${group.name}",+${participant.id.user},${role},${index + 1}\n`;
            });
        } else {
            // Create TXT content
            content += `========================================\n`;
            content += `WhatsApp Group Participants Export\n`;
            content += `========================================\n\n`;
            content += `Group Name: ${group.name}\n`;
            content += `Export Date: ${new Date().toLocaleString()}\n`;
            content += `Total Participants: ${participants.length}\n`;
            content += `Admins: ${admins.length}\n`;
            content += `Members: ${members.length}\n\n`;
            
            content += `========================================\n`;
            content += `ADMINISTRATORS (${admins.length})\n`;
            content += `========================================\n`;
            admins.forEach((participant, index) => {
                content += `${index + 1}. +${participant.id.user}\n`;
            });
            
            content += `\n========================================\n`;
            content += `MEMBERS (${members.length})\n`;
            content += `========================================\n`;
            members.forEach((participant, index) => {
                content += `${index + 1}. +${participant.id.user}\n`;
            });
            
            content += `\n========================================\n`;
            content += `ALL PARTICIPANTS (${participants.length})\n`;
            content += `========================================\n`;
            participants.forEach((participant, index) => {
                const role = participant.isAdmin ? ' (Admin)' : ' (Member)';
                content += `${index + 1}. +${participant.id.user}${role}\n`;
            });
            
            content += `\n----------------------------------------\n`;
            content += `Generated by WhatsApp Group Actions Bot\n`;
            content += `----------------------------------------\n`;
        }
        
        // Write to file
        fs.writeFileSync(filepath, content, 'utf8');
        
        console.log(`\n✅ SUCCESS! Participants saved to ${format.toUpperCase()} file:`);
        console.log(`📁 File: ${filename}`);
        console.log(`📍 Location: ${filepath}`);
        console.log(`📊 Total participants exported: ${participants.length}`);
        console.log(`   👑 Admins: ${admins.length}`);
        console.log(`   👤 Members: ${members.length}`);
        
        if (format === 'json') {
            console.log(`\n💡 JSON Usage Tips:`);
            console.log(`   • Load in JavaScript: const data = require('./${filename}')`);
            console.log(`   • Parse in Python: import json; data = json.load(open('${filename}'))`);
            console.log(`   • Access participants: data.participants`);
            console.log(`   • Filter admins: data.admins`);
        }
        console.log('');
        
    } catch (error) {
        console.error('❌ Error saving participants to file:', error);
        console.log('💡 Make sure you have write permissions in the current directory.\n');
    }
}

// Optional: Log incoming messages (uncomment if needed)
/*
client.on('message', async (message) => {
    try {
        if (message.from.endsWith('@g.us')) {
            const chat = await message.getChat();
            if (chat.isGroup) {
                console.log(`\n📨 Message in group "${chat.name}" from ${message.author || 'Unknown'}: ${message.body}`);
            }
        }
    } catch (error) {
        console.error('❌ Error handling message:', error);
    }
});
*/

// Error handling
client.on('disconnected', (reason) => {
    console.log('🔌 Client was disconnected:', reason);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await client.destroy();
    rl.close();
    process.exit(0);
});

// Add connection timeout handling
const connectionTimeout = setTimeout(() => {
    console.log('\n⚠️  Connection is taking longer than expected...');
    console.log('💡 Possible solutions:');
    console.log('   1. Check your internet connection');
    console.log('   2. Make sure Chrome/Chromium is installed');
    console.log('   3. Try restarting the app');
    console.log('   4. If using Mac, try: brew install chromium');
}, 30000);

client.on('ready', () => {
    clearTimeout(connectionTimeout);
});

client.on('auth_failure', () => {
    clearTimeout(connectionTimeout);
});

// Initialize the client
console.log('🚀 Starting WhatsApp Web Group Actions Bot...');
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
