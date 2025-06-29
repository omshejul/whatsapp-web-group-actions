const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-debug"
    }),
    puppeteer: { headless: true }
});

client.on('qr', (qr) => {
    console.log('📱 Scan QR to check group participants:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ Client ready! Checking dummy group...');
    
    const groupId = "120363402845424632@g.us";
    try {
        const group = await client.getChatById(groupId);
        console.log(`\n👥 Group: ${group.name}`);
        console.log(`📱 Total participants: ${group.participants.length}`);
        console.log('\n📋 Current participants:');
        
        group.participants.forEach((participant, index) => {
            const phone = `+${participant.id.user}`;
            const role = participant.isAdmin ? '👑 Admin' : '👤 Member';
            console.log(`   ${index + 1}. ${phone} ${role}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
});

client.initialize(); 