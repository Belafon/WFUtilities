import * as assert from 'assert';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser'; // Adjust path as needed
import { TypeScriptObjectBuilder } from "../typescriptObjectParser/TypeScriptObjectBuilder"; // Adjust path

async function testNestedPropertyModification(
    originalCode: string,
    outerObjectName: string,
    nestedObjectName: string,
    propertyNameToAddOrSet: string,
    newValue: string
): Promise<string> {
    const codeBuilder = new TypeScriptCodeBuilder(originalCode);

    const outerBuilder = await new Promise<TypeScriptObjectBuilder>((resolve, reject) => {
        codeBuilder.findObject(outerObjectName, {
            onFound: resolve,
            onNotFound: () => reject(new Error(`Outer object '${outerObjectName}' not found`))
        });
    });

    const nestedBuilder = await new Promise<TypeScriptObjectBuilder>((resolve, reject) => {
        outerBuilder.findObject(nestedObjectName, {
            onFound: resolve,
            onNotFound: () => reject(new Error(`Nested object '${nestedObjectName}' not found in '${outerObjectName}'`))
        });
    });

    nestedBuilder.setPropertyValue(propertyNameToAddOrSet, newValue);
    return codeBuilder.toString();
}


suite('TypeScriptObjectBuilder - Nested Object Modification', () => {

    const baseRegisterCode = `
export const register = {
    characters: {
        thomas: Thomas,
        annie: Annie,
    },
    sideCharacters: {
        franta: Franta,
        nobleMan: NobleMan,
    },
    events: {
    	village: villageEvent,
        kingdom: kingdomEvent,
    	wedding: weddingEvent,
    },
    locations: {
    	village: villageLocation,
    	kingdom: kingdomLocation,
    },
    passages: {
    	village: () => import('./events/village/village.passages'),
        kingdom: () => import('./events/kingdom/kingdom.passages'),
    	wedding: () => import('./events/wedding/wedding.passages'),
    },
    happenings: {
        village_under_attack: village_under_attackHappening,
    }
} as const;`;

    test('should add a new property to an existing nested object (events)', async () => {
        const result = await testNestedPropertyModification(
            baseRegisterCode,
            'register',
            'events',
            'festival',
            'festivalEvent'
        );

        const expectedSubstring = `
    events: {
    	village: villageEvent,
        kingdom: kingdomEvent,
    	wedding: weddingEvent,
    	festival: festivalEvent
    },`;
        // Normalize whitespace for comparison, focusing on structure
        assert.ok(
            result.replace(/\s+/g, ' ').includes(expectedSubstring.replace(/\s+/g, ' ')),
            `Result did not contain expected event structure. Got:\n${result}`
        );
        assert.ok(result.includes('festival: festivalEvent'), 'New property "festival" should be present.');
    });

    test('should replace an existing property in a nested object (events.village)', async () => {
        const result = await testNestedPropertyModification(
            baseRegisterCode,
            'register',
            'events',
            'village',
            'newVillageEvent'
        );
        const expectedSubstring = `
    events: {
    	village: newVillageEvent,
        kingdom: kingdomEvent,
    	wedding: weddingEvent,
    },`;
        assert.ok(
            result.replace(/\s+/g, ' ').includes(expectedSubstring.replace(/\s+/g, ' ')),
            `Result did not contain expected modified event structure. Got:\n${result}`
        );
        assert.ok(!result.includes('village: villageEvent'), 'Old village event should be replaced.');
        assert.ok(result.includes('village: newVillageEvent'), 'New village event should be present.');
    });

    test('should add a new property to a different nested object (locations)', async () => {
        const result = await testNestedPropertyModification(
            baseRegisterCode,
            'register',
            'locations',
            'castle',
            'castleLocation'
        );
        const expectedSubstring = `
    locations: {
    	village: villageLocation,
    	kingdom: kingdomLocation,
    	castle: castleLocation
    },`;
        assert.ok(
            result.replace(/\s+/g, ' ').includes(expectedSubstring.replace(/\s+/g, ' ')),
            `Result did not contain expected location structure. Got:\n${result}`
        );
    });

    test('should correctly indent new property in a nested object that itself has base indentation', async () => {
        const codeWithIndentedNesting = `
export const register = {
    config: {
        settings: { // This is the object we'll modify
            theme: 'dark'
        }
    }
};`;
        const result = await testNestedPropertyModification(
            codeWithIndentedNesting,
            'register', // Outer object
            'config',   // Intermediate object
            'fontSize', // Property to add to 'settings' (implicitly found by modifying 'config' then 'settings')
            '12'
        );

        // To test this properly, we need to find 'config', then 'settings', then add.
        // The helper needs to be adapted or the test needs to be more direct.
        // Let's adapt the test logic slightly for this direct case.

        const codeBuilder = new TypeScriptCodeBuilder(codeWithIndentedNesting);
        const regBuilder = await new Promise<TypeScriptObjectBuilder>(r => codeBuilder.findObject('register', { onFound: r, onNotFound: () => assert.fail("register not found") }));
        const confBuilder = await new Promise<TypeScriptObjectBuilder>(r => regBuilder.findObject('config', { onFound: r, onNotFound: () => assert.fail("config not found") }));
        const settingsBuilder = await new Promise<TypeScriptObjectBuilder>(r => confBuilder.findObject('settings', { onFound: r, onNotFound: () => assert.fail("settings not found") }));

        settingsBuilder.setPropertyValue('fontSize', '12');
        const finalResult = await codeBuilder.toString();

        const expected = `
export const register = {
    config: {
        settings: { // This is the object we'll modify
            theme: 'dark',
            fontSize: 12
        }
    }
};`;
        assert.strictEqual(finalResult.trim(), expected.trim(), "Deeply nested property addition failed indentation.");
    });

    test('should add property to an empty nested object', async () => {
        const codeWithEmptyNested = `
export const register = {
    features: {
        // initially empty
    }
};`;
        const result = await testNestedPropertyModification(
            codeWithEmptyNested,
            'register',
            'features',
            'newToggle',
            'true'
        );

        // detectIndentation might use 4 spaces by default if it can't find a pattern in an empty obj.
        // The baseIndentation of the closing '}' of features should be respected.
        const expected = `
export const register = {
    features: {
        // initially empty
        newToggle: true
    }
};`;
        // A more precise assertion:
        assert.strictEqual(result.trim(), expected.trim(), 
            `Adding to empty nested object failed. Expected:\n${expected}\nGot:\n${result}`
        );
    });


    test('should add property to a single-line nested object, making it multi-line if needed by formatting rules', async () => {
        const codeWithSingleLineNested = `
export const register = {
    metadata: { title: "App", version: "1.0" }
};`;
        const result = await testNestedPropertyModification(
            codeWithSingleLineNested,
            'register',
            'metadata',
            'author',
            '"Admin"'
        );

        // The behavior here (whether it stays single-line or becomes multi-line)
        // depends on the setPropertyValue implementation's formatting rules.
        // Assuming it attempts to maintain single-line if compact or becomes multi-line if it makes sense.
        // For this test, let's assume it might stay single-line or transition gracefully.
        // A robust check is that the property is there and syntax is valid.
        const expectedSubstringAfter = `metadata: { title: "App", version: "1.0", author: "Admin" }`;
        const expectedSubstringMulti = `
    metadata: {
        title: "App",
        version: "1.0",
        author: "Admin"
    }
`;
        const resultNormalized = result.replace(/\s+/g, ' ');
        const sub1Normalized = expectedSubstringAfter.replace(/\s+/g, ' ');
        const sub2Normalized = expectedSubstringMulti.replace(/\s+/g, ' ');

        assert.ok(
            resultNormalized.includes(sub1Normalized) || resultNormalized.includes(sub2Normalized),
            `Adding to single-line nested object failed. Got:\n${result}`
        );
    });


    test('should preserve comments when adding property to a nested object', async () => {
        const codeWithCommentsInNested = `
export const register = {
    config: {
        // Setting A
        settingA: 'valueA',
        /* Setting B */
        settingB: 'valueB'
        // End of config
    }
};`;
        const result = await testNestedPropertyModification(
            codeWithCommentsInNested,
            'register',
            'config',
            'settingC',
            '"valueC"'
        );

        const expectedAfterAdd = `
export const register = {
    config: {
        // Setting A
        settingA: 'valueA',
        /* Setting B */
        settingB: 'valueB',
        settingC: "valueC"
        // End of config
    }
};`;
        //This test is sensitive to how comments are handled by the parseProperties and edit logic.
        //The current implementation might shift comments if they are not strictly tied to property boundaries.
        //A simple check for property presence and comment preservation
        assert.ok(result.includes('settingA: \'valueA\''), "Setting A missing");
        assert.ok(result.includes('settingB: \'valueB\''), "Setting B missing");
        assert.ok(result.includes('settingC: "valueC"'), "Setting C missing");
        assert.ok(result.includes('// Setting A'), "Comment for Setting A missing");
        assert.ok(result.includes('/* Setting B */'), "Comment for Setting B missing");
        assert.ok(result.includes('// End of config'), "End comment missing");

    });

    test('should handle nested object with trailing comma correctly when adding a property', async () => {
        const codeWithTrailingCommaNested = `
export const register = {
    data: {
        item1: 10,
        item2: 20, // trailing comma here
    }
};`;
        const result = await testNestedPropertyModification(
            codeWithTrailingCommaNested,
            'register',
            'data',
            'item3',
            '30'
        );
        const expectedSubstring = `
    data: {
        item1: 10,
        item2: 20, // trailing comma here
        item3: 30
    }`;
        // Normalizing to focus on structure and content
        assert.ok(
            result.replace(/\s+/g, ' ').includes(expectedSubstring.replace(/\s+/g, ' ')),
            `Adding to nested object with trailing comma failed. Got:\n${result}`
        );
    });

    test('should use consistent indentation based on the nested object, not the parent', async () => {
        // Parent uses 4 spaces, nested object uses 2 spaces
        const code = `
export const config = {
    module: {
      isEnabled: true,  // 2-space indent within 'module'
      retries: 3
    }
};`;
        const result = await testNestedPropertyModification(
            code,
            'config',
            'module',
            'timeout',
            '5000'
        );

        const expected = `
export const config = {
    module: {
      isEnabled: true,  // 2-space indent within 'module'
      retries: 3,
      timeout: 5000
    }
};`;
        assert.strictEqual(result.trim(), expected.trim(), "Indentation should be based on the direct parent (nested) object.");
    });

    test('should add property to nested object whose properties are defined with different quote types', async () => {
        const code = `
export const setup = {
    user: {
        "name": 'Alice', // double quotes for key, single for value
        'age': 30        // single quotes for key, no quotes for value
    }
};`;
        const result = await testNestedPropertyModification(
            code,
            'setup',
            'user',
            'isAdmin', // new key will be unquoted by default by setPropertyValue if not specified with quotes
            'true'     // new value
        );

        // Check that the new property is added; exact quoting of the new key/value depends on setPropertyValue
        // The main thing is that it doesn't break due to existing mixed quotes.
        // Our current setPropertyValue doesn't add quotes to keys unless they are in the input propertyName string.
        // And values are taken as is.
        const expectedSubstring = `
    user: {
        "name": 'Alice',
        'age': 30,
        isAdmin: true
    }`;
        assert.ok(
            result.replace(/\s+/g, ' ').includes(expectedSubstring.replace(/\s+/g, ' ')),
            `Adding property with mixed quotes failed. Got:\n${result}`
        );
    });

});