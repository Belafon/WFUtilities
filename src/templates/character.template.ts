export class CharacterTemplateVariables {
    public readonly characterIdCapitalized: string;

    constructor(
        public readonly characterId: string,
        public readonly characterName: string = '',
        public readonly startChapterId: string = 'kingdom',
        public readonly startPassageId: string = 'intro',
        public readonly startLocation: string = 'village',
        public readonly health: number = 100,
        public readonly hunger: number = 100,
        public readonly stamina: number = 100,
        public readonly inventoryItems: string = "{ id: 'berries', amount: 10 }",
    ) {
        this.characterIdCapitalized = characterId.charAt(0).toUpperCase() + characterId.slice(1);
    }


    public static get propertyNames() {
        return {
            characterName: 'characterName' as const,
            startChapterId: 'startChapterId' as const,
            startPassageId: 'startPassageId' as const,
            startLocation: 'startLocation' as const,
            health: 'health' as const,
            hunger: 'hunger' as const,
            stamina: 'stamina' as const,
            inventoryItems: 'inventoryItems' as const,
            inventory: 'inventory' as const,
            location: 'location' as const,
        };
    }

    public get propertyNames() {
        return CharacterTemplateVariables.propertyNames;
    }

    public get mainCharacterFunction(): string {
        return this.characterIdCapitalized;
    }

    public get displayName(): string {
        return this.characterName || this.characterIdCapitalized;
    }

    public get quotedCharacterId(): string {
        return `'${this.characterId}'`;
    }

    public get quotedCharacterName(): string {
        return `'${this.displayName}'`;
    }

    public get fullStartPassageId(): string {
        return `${this.startChapterId}-${this.characterId}-${this.startPassageId}`;
    }

    public get quotedStartPassageId(): string {
        return `'${this.fullStartPassageId}'`;
    }

    public get quotedLocation(): string {
        return `'${this.startLocation}'`;
    }

    public get characterDataTypeName(): string {
        return `T${this.characterIdCapitalized}CharacterData`;
    }

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