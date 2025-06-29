const fs = require('fs');
const path = require('path');

// Function to detect country from phone number
function detectCountry(phoneNumber) {
    const num = phoneNumber.toString();
    
    // Common country code patterns
    if (num.startsWith('91')) return { code: '+91', country: 'India' };
    if (num.startsWith('1') && num.length === 11) return { code: '+1', country: 'USA/Canada' };
    if (num.startsWith('44')) return { code: '+44', country: 'UK' };
    if (num.startsWith('49')) return { code: '+49', country: 'Germany' };
    if (num.startsWith('33')) return { code: '+33', country: 'France' };
    if (num.startsWith('86')) return { code: '+86', country: 'China' };
    if (num.startsWith('81')) return { code: '+81', country: 'Japan' };
    if (num.startsWith('61')) return { code: '+61', country: 'Australia' };
    if (num.startsWith('260')) return { code: '+260', country: 'Zambia' };
    if (num.startsWith('234')) return { code: '+234', country: 'Nigeria' };
    if (num.startsWith('971')) return { code: '+971', country: 'UAE' };
    if (num.startsWith('966')) return { code: '+966', country: 'Saudi Arabia' };
    if (num.startsWith('7')) return { code: '+7', country: 'Russia/Kazakhstan' };
    if (num.startsWith('55')) return { code: '+55', country: 'Brazil' };
    if (num.startsWith('52')) return { code: '+52', country: 'Mexico' };
    if (num.startsWith('39')) return { code: '+39', country: 'Italy' };
    if (num.startsWith('34')) return { code: '+34', country: 'Spain' };
    if (num.startsWith('31')) return { code: '+31', country: 'Netherlands' };
    if (num.startsWith('27')) return { code: '+27', country: 'South Africa' };
    if (num.startsWith('20')) return { code: '+20', country: 'Egypt' };
    
    return { code: 'Unknown', country: 'Unknown' };
}

// Function to format phone number
function formatPhoneNumber(phoneNumber) {
    const num = phoneNumber.toString().trim();
    if (!num.startsWith('+')) {
        return `+${num}`;
    }
    return num;
}

// Read and convert CSV to JSON
function convertCsvToJson() {
    try {
        console.log('📄 Reading active.csv...');
        
        // Read the CSV file
        const csvContent = fs.readFileSync('active.csv', 'utf8');
        const phoneNumbers = csvContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0); // Remove empty lines
        
        console.log(`📊 Found ${phoneNumbers.length} phone numbers`);
        
        // Process each phone number
        const processedNumbers = phoneNumbers.map((phoneNumber, index) => {
            const formatted = formatPhoneNumber(phoneNumber);
            const countryInfo = detectCountry(phoneNumber);
            
            return {
                index: index + 1,
                originalNumber: phoneNumber,
                formattedNumber: formatted,
                countryCode: countryInfo.code,
                country: countryInfo.country,
                length: phoneNumber.length
            };
        });
        
        // Group by country for statistics
        const countryStats = {};
        processedNumbers.forEach(entry => {
            const country = entry.country;
            if (!countryStats[country]) {
                countryStats[country] = {
                    count: 0,
                    countryCode: entry.countryCode,
                    numbers: []
                };
            }
            countryStats[country].count++;
            countryStats[country].numbers.push(entry.formattedNumber);
        });
        
        // Find duplicates
        const numberCounts = {};
        processedNumbers.forEach(entry => {
            const num = entry.originalNumber;
            numberCounts[num] = (numberCounts[num] || 0) + 1;
        });
        
        const duplicates = Object.entries(numberCounts)
            .filter(([num, count]) => count > 1)
            .map(([num, count]) => ({ number: num, occurrences: count }));
        
        // Create final JSON structure
        const jsonData = {
            metadata: {
                sourceFile: 'active.csv',
                totalNumbers: phoneNumbers.length,
                uniqueNumbers: Object.keys(numberCounts).length,
                duplicateNumbers: duplicates.length,
                exportDate: new Date().toISOString(),
                exportTimestamp: Date.now(),
                generatedBy: 'CSV to JSON Converter',
                version: '1.0.0'
            },
            statistics: {
                countryBreakdown: countryStats,
                duplicates: duplicates,
                numberLengths: processedNumbers.reduce((acc, entry) => {
                    const len = entry.length;
                    acc[len] = (acc[len] || 0) + 1;
                    return acc;
                }, {})
            },
            phoneNumbers: processedNumbers,
            rawNumbers: phoneNumbers,
            formattedNumbers: processedNumbers.map(entry => entry.formattedNumber)
        };
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `active_numbers_${timestamp}.json`;
        
        // Write JSON file
        fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2), 'utf8');
        
        console.log(`\n✅ SUCCESS! CSV converted to JSON:`);
        console.log(`📁 File: ${filename}`);
        console.log(`📍 Location: ${path.resolve(filename)}`);
        console.log(`\n📊 STATISTICS:`);
        console.log(`   📱 Total Numbers: ${jsonData.metadata.totalNumbers}`);
        console.log(`   🔢 Unique Numbers: ${jsonData.metadata.uniqueNumbers}`);
        console.log(`   🔄 Duplicates: ${jsonData.metadata.duplicateNumbers}`);
        
        console.log(`\n🌍 COUNTRY BREAKDOWN:`);
        Object.entries(countryStats)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 10) // Top 10 countries
            .forEach(([country, stats]) => {
                console.log(`   ${stats.countryCode} ${country}: ${stats.count} numbers`);
            });
        
        if (duplicates.length > 0) {
            console.log(`\n🔄 DUPLICATE NUMBERS:`);
            duplicates.slice(0, 5).forEach(dup => {
                console.log(`   +${dup.number} appears ${dup.occurrences} times`);
            });
            if (duplicates.length > 5) {
                console.log(`   ... and ${duplicates.length - 5} more duplicates`);
            }
        }
        
        console.log(`\n💡 JSON USAGE:`);
        console.log(`   • Load: const data = require('./${filename}')`);
        console.log(`   • All numbers: data.phoneNumbers`);
        console.log(`   • Country stats: data.statistics.countryBreakdown`);
        console.log(`   • Formatted list: data.formattedNumbers`);
        
        return filename;
        
    } catch (error) {
        console.error('❌ Error converting CSV to JSON:', error.message);
        process.exit(1);
    }
}

// Run the conversion
if (require.main === module) {
    convertCsvToJson();
}

module.exports = { convertCsvToJson }; 