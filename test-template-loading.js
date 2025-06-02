const { TemplateGenerator } = require('./dist/templates/TempalteGenerator');
const path = require('path');

// Test the template loading as if it were used as a library
const generator = new TemplateGenerator();

try {
    // Test creating a simple character
    generator.createSimpleCharacter('test-char', 'Test Character')
        .then(result => {
            console.log('✅ Template loading successful!');
            console.log('Generated code length:', result.length);
            console.log('First 200 characters:');
            console.log(result.substring(0, 200) + '...');
        })
        .catch(error => {
            console.error('❌ Template loading failed:', error.message);
        });
} catch (error) {
    console.error('❌ Error creating template generator:', error.message);
}
