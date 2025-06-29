const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-groups-exporter"
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

// When client is ready, start exporting group info
client.on('ready', async () => {
    console.log('✅ WhatsApp Web client is ready!');
    console.log('📊 Starting automated raw data export...\n');
    
    await exportAllGroupsInfo();
});

// Function to export raw group data as-is
async function exportAllGroupsInfo() {
    try {
        console.log('📋 Loading all chats...');
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        
        console.log(`📱 Found ${chats.length} total chats`);
        console.log(`🏷️ Found ${groups.length} groups to analyze\n`);
        
        if (groups.length === 0) {
            console.log('❌ No groups found!');
            return;
        }
        
        const groupsData = [];
        let processedCount = 0;
        
        console.log('🔍 Extracting detailed information for each group...\n');
        
        for (const group of groups) {
            processedCount++;
            const progress = `[${processedCount}/${groups.length}]`;
            
            try {
                console.log(`${progress} 📊 Analyzing: "${group.name}"`);
                
                // Export raw group data as it comes from WhatsApp
                const rawGroupData = JSON.parse(JSON.stringify(group));
                
                // Try to get additional chat metadata and merge it
                try {
                    const chat = await client.getChatById(group.id._serialized);
                    // Merge additional chat data if available
                    Object.assign(rawGroupData, JSON.parse(JSON.stringify(chat)));
                } catch (metadataError) {
                    rawGroupData._metadataError = metadataError.message;
                }
                
                groupsData.push(rawGroupData);
                console.log(`${progress} ✅ Completed: "${group.name}" (${group.participants ? group.participants.length : 'Unknown'} participants)`);
                
                // Small delay to avoid overwhelming WhatsApp
                if (processedCount < groups.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                         } catch (error) {
                console.log(`${progress} ❌ Error analyzing "${group.name}": ${error.message}`);
                groupsData.push({
                    id: group.id._serialized,
                    name: group.name,
                    _error: error.message
                });
            }
        }
        
        // Prepare final export data - minimal metadata, raw groups data
        const exportData = {
            _metadata: {
                exportDate: new Date().toISOString(),
                exportTimestamp: Date.now(),
                totalGroups: groups.length,
                successfullyAnalyzed: groupsData.filter(g => !g._error).length,
                failedAnalysis: groupsData.filter(g => g._error).length,
                whatsappUserId: client.info.wid._serialized,
                whatsappUserName: client.info.pushname || 'Unknown',
                generatedBy: 'WhatsApp Groups Raw Data Exporter',
                version: '2.0.0'
            },
            groups: groupsData
        };
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `raw_groups_data_${timestamp}.json`;
        
        // Save to file
        fs.writeFileSync(filename, JSON.stringify(exportData, null, 2), 'utf8');
        
        // Display summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 RAW GROUP DATA EXPORT COMPLETE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📁 File: ${filename}`);
        console.log(`📱 Total Groups: ${exportData._metadata.totalGroups}`);
        console.log(`✅ Successfully Analyzed: ${exportData._metadata.successfullyAnalyzed}`);
        console.log(`❌ Failed Analysis: ${exportData._metadata.failedAnalysis}`);
        
        // Calculate basic stats from raw data
        const totalParticipants = groupsData.reduce((sum, group) => {
            return sum + (group.participants ? group.participants.length : 0);
        }, 0);
        
        console.log(`👥 Total Participants: ${totalParticipants}`);
        console.log(`📊 Raw WhatsApp objects exported as-is`);
        
        console.log('\n💡 USAGE:');
        console.log(`   • Load data: const data = require('./${filename}')`);
        console.log('   • Access groups: data.groups');
        console.log('   • View raw structure: console.log(data.groups[0])');
        console.log('   • Filter by participants: data.groups.filter(g => g.participants.length > 50)');
        
        console.log('\n🎉 Export complete! You can now close this app with Ctrl+C');
        
        // Auto-exit after showing summary
        setTimeout(() => {
            console.log('\n👋 Auto-exiting in 10 seconds...');
            setTimeout(async () => {
                await client.destroy();
                process.exit(0);
            }, 10000);
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error in export process:', error);
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
console.log('🚀 Starting WhatsApp Groups Raw Data Exporter...');
console.log('📦 Initializing browser...');
console.log('🤖 Fully automated - exports raw WhatsApp data as-is!');

client.initialize().catch(error => {
    console.error('❌ Failed to initialize client:', error.message);
    console.log('\n💡 Common fixes:');
    console.log('   • Install Chrome: brew install google-chrome');
    console.log('   • Or install Chromium: brew install chromium');
    console.log('   • Check if you have enough memory available');
    console.log('   • Try running: npm install puppeteer');
    process.exit(1);
}); 