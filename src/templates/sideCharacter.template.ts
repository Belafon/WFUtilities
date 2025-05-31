export class SideCharacterTemplateVariables {
    public readonly sideCharacterIdCapitalized: string;

    constructor(
        public readonly sideCharacterId: string,
        public readonly sideCharacterName: string = '',
        public readonly description: string = '',
        public readonly inventory: string = '[]',
        public readonly location: string = 'village',
        public readonly isDead: boolean = false,
    ) {
        this.sideCharacterIdCapitalized = sideCharacterId.charAt(0).toUpperCase() + sideCharacterId.slice(1);
    }

    public static get propertyNames() {
        return {
            sideCharacterName: 'sideCharacterName' as const,
            description: 'description' as const,
            inventory: 'inventory' as const,
            location: 'location' as const,
            isDead: 'isDead' as const,
            sideCharacterId: 'sideCharacterId' as const,
        };
    }

    public get propertyNames() {
        return SideCharacterTemplateVariables.propertyNames;
    }

    public get mainSideCharacterFunction(): string {
        return this.sideCharacterIdCapitalized;
    }

    public get displayName(): string {
        return this.sideCharacterName || this.sideCharacterIdCapitalized;
    }

    public get quotedSideCharacterId(): string {
        return `'${this.sideCharacterId}'`;
    }

    public get quotedLocation(): string {
        return `'${this.location}'`;
    }

    public get sideCharacterDataTypeName(): string {
        return `T${this.sideCharacterIdCapitalized}SideCharacterData`;
    }

    public generateSideCharacterCode(template: string, initObjectContent?: string, sideCharacterDataTypeContent?: string): string {
        const defaultInitContent = initObjectContent || `inventory: ${this.inventory},
        location: ${this.quotedLocation},
        isDead: ${this.isDead},`;

        const defaultTypeContent = sideCharacterDataTypeContent || `asdasd: {
        time: number;
        asd: string;
    };`;

        return template
            .replace(/{mainSideCharacterFunction}/g, this.mainSideCharacterFunction)
            .replace(/{quotedSideCharacterId}/g, this.quotedSideCharacterId)
            .replace(/{sideCharacterName}/g, this.displayName)
            .replace(/{description}/g, this.description)
            .replace(/{sideCharacterDataTypeName}/g, this.sideCharacterDataTypeName)
            .replace(/{initObjectContent}/g, defaultInitContent)
            .replace(/{sideCharacterDataTypeContent}/g, defaultTypeContent);
    }
}