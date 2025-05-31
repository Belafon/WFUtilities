export class CharacterTemplateVariables {
    public readonly characterIdCapitalized: string;

    constructor(
        public readonly characterId: string,
        public readonly characterName: string = '',
        public readonly startEventId: string = 'kingdom',
        public readonly startPassageId: string = 'intro',
        public readonly startLocation: string = 'village',
        public readonly health: number = 100,
        public readonly hunger: number = 100,
        public readonly stamina: number = 100,
        public readonly inventoryItems: string = "{ id: 'berries', amount: 10 }",
    ) {
        this.characterIdCapitalized = characterId.charAt(0).toUpperCase() + characterId.slice(1);
    }

    // Main character export name (capitalized character ID)
    public get mainCharacterFunction(): string {
        return this.characterIdCapitalized;
    }

    // Character name (defaults to capitalized character ID)
    public get displayName(): string {
        return this.characterName || this.characterIdCapitalized;
    }

    // Quoted character ID for type parameter and id field
    public get quotedCharacterId(): string {
        return `'${this.characterId}'`;
    }

    // Quoted character name for the name field
    public get quotedCharacterName(): string {
        return `'${this.displayName}'`;
    }

    // Full start passage ID reference
    public get fullStartPassageId(): string {
        return `${this.startEventId}-${this.characterId}-${this.startPassageId}`;
    }

    // Quoted start passage ID
    public get quotedStartPassageId(): string {
        return `'${this.fullStartPassageId}'`;
    }

    // Quoted location
    public get quotedLocation(): string {
        return `'${this.startLocation}'`;
    }

    // Character data type name
    public get characterDataTypeName(): string {
        return `T${this.characterIdCapitalized}CharacterData`;
    }

    // Generate the final code by replacing template variables
    public generateCharacterCode(template: string, initObjectContent?: string, characterDataTypeContent?: string): string {
        const defaultInitContent = initObjectContent || `health: ${this.health},
        hunger: ${this.hunger},
        stamina: ${this.stamina},
        inventory: [${this.inventoryItems}],
        location: ${this.quotedLocation},`;

        const defaultTypeContent = characterDataTypeContent || `knowsMagic: boolean;`;

        return template
            .replace(/{mainCharacterFunction}/g, this.mainCharacterFunction)
            .replace(/{quotedCharacterId}/g, this.quotedCharacterId)
            .replace(/{quotedCharacterName}/g, this.quotedCharacterName)
            .replace(/{quotedStartPassageId}/g, this.quotedStartPassageId)
            .replace(/{characterDataTypeName}/g, this.characterDataTypeName)
            .replace(/{initObjectContent}/g, defaultInitContent)
            .replace(/{characterDataTypeContent}/g, defaultTypeContent);
    }
}