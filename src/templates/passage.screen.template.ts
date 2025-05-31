
export class PassageScreenTemplateVariables {
    public readonly eventIdCapitalized: string;
    public readonly characterIdCapitalized: string;
    public readonly passageIdCapitalized: string;

    constructor(
        public readonly eventId: string,
        public readonly characterId: string,
        public readonly passageId: string,
    ) {
        this.eventIdCapitalized = eventId.charAt(0).toUpperCase() + eventId.slice(1);
        this.characterIdCapitalized = characterId.charAt(0).toUpperCase() + characterId.slice(1);
        this.passageIdCapitalized = passageId.charAt(0).toUpperCase() + passageId.slice(1);
    }

    // Function name for the main passage export
    public get mainPassageFunction(): string {
        return `${this.passageId}Passage`;
    }

    // TypeScript type name for the passage ID type
    public get passageIdTypeName(): string {
        return `T${this.eventIdCapitalized}${this.characterIdCapitalized}PassageId`;
    }

    // Full passage reference for links (eventId-characterId-passageId)
    public get fullPassageReference(): string {
        return `${this.eventId}-${this.characterId}-${this.passageId}`;
    }

    // Import path for the passage ID type
    public get passageIdTypeImportPath(): string {
        return `../${this.eventId}.passages`;
    }

    // Translation key for title (same as passageId)
    public get titleTranslationKey(): string {
        return this.passageId;
    }

    // Translation key for body text (empty in template, but could be passageId-based)
    public get bodyTranslationKey(): string {
        return '';
    }

    // Translation key for link text (empty in template, but could be customized)
    public get linkTranslationKey(): string {
        return '';
    }

    // Generate the final code by replacing template variables
    public generatePassageCode(template: string): string {
        return template
            .replace(/{mainPassageFunction}/g, this.mainPassageFunction)
            .replace(/{passageIdTypeName}/g, this.passageIdTypeName)
            .replace(/{passageIdTypeImportPath}/g, this.passageIdTypeImportPath)
            .replace(/{quotedEventId}/g, this.quotedEventId)
            .replace(/{quotedCharacterId}/g, this.quotedCharacterId)
            .replace(/{quotedPassageId}/g, this.quotedPassageId)
            .replace(/{titleTranslationKey}/g, this.titleTranslationKey)
            .replace(/{bodyTranslationKey}/g, this.bodyTranslationKey)
            .replace(/{linkTranslationKey}/g, this.linkTranslationKey)
            .replace(/{fullPassageReference}/g, this.fullPassageReference);
    }

    // Event ID for the return object (quoted)
    public get quotedEventId(): string {
        return `'${this.eventId}'`;
    }

    // Character ID for the return object (quoted)
    public get quotedCharacterId(): string {
        return `'${this.characterId}'`;
    }

    // Passage ID for the return object (quoted)
    public get quotedPassageId(): string {
        return `'${this.passageId}'`;
    }
}