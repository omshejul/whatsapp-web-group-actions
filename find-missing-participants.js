const fs = require('fs');

// Load the current leaderboard (array of phone numbers without + prefix)
const currentLeaderboard = JSON.parse(fs.readFileSync('temp/current-leaderboard.json', 'utf8'));

// Load the slots update participants file
const slotsUpdate = JSON.parse(fs.readFileSync('temp/slots_update_participants_2025-06-30T04-08-25.json', 'utf8'));

// Extract phone numbers from slots update participants (remove + prefix to match format)
const slotsParticipants = slotsUpdate.participants.map(participant => 
    participant.phoneNumber.replace('+', '')
);

// Find participants who are in slots update but NOT in current leaderboard
const missingFromLeaderboard = slotsParticipants.filter(participant => 
    !currentLeaderboard.includes(participant)
);

// Create result object with summary information
const result = {
    summary: {
        totalInSlotsUpdate: slotsParticipants.length,
        totalInLeaderboard: currentLeaderboard.length,
        missingFromLeaderboard: missingFromLeaderboard.length,
        analysisDate: new Date().toISOString()
    },
    missingParticipants: missingFromLeaderboard,
    missingParticipantDetails: slotsUpdate.participants.filter(participant => 
        missingFromLeaderboard.includes(participant.phoneNumber.replace('+', ''))
    )
};

// Output the results
console.log('=== ANALYSIS SUMMARY ===');
console.log(`Total participants in Slots Update: ${result.summary.totalInSlotsUpdate}`);
console.log(`Total participants in Current Leaderboard: ${result.summary.totalInLeaderboard}`);
console.log(`Participants in Slots Update but NOT in Leaderboard: ${result.summary.missingFromLeaderboard}`);
console.log('\n=== MISSING PARTICIPANTS (Phone Numbers) ===');
result.missingParticipants.forEach((phone, index) => {
    console.log(`${index + 1}. ${phone}`);
});

console.log('\n=== MISSING PARTICIPANTS (Full Details) ===');
result.missingParticipantDetails.forEach((participant, index) => {
    console.log(`${index + 1}. ${participant.phoneNumber} (${participant.role}${participant.isAdmin ? ' - ADMIN' : ''})`);
});

// Save results to file
const outputFile = `missing_participants_analysis_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log(`\n=== RESULTS SAVED ===`);
console.log(`Full analysis saved to: ${outputFile}`); 