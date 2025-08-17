export class PassageScreenTemplateVariables {
    public readonly chapterIdCapitalized: string;
    public readonly characterIdCapitalized: string;
    public readonly passageIdCapitalized: string;

    constructor(
        public readonly chapterId: string,
        public readonly characterId: string,
        public readonly passageId: string,
    ) {
        this.chapterIdCapitalized = chapterId.charAt(0).toUpperCase() + chapterId.slice(1);
        this.characterIdCapitalized = characterId.charAt(0).toUpperCase() + characterId.slice(1);
        this.passageIdCapitalized = passageId.charAt(0).toUpperCase() + passageId.slice(1);
    }

    public static get propertyNames() {
        return {
            chapterId: 'chapterId' as const,
            characterId: 'characterId' as const,
            passageId: 'passageId' as const,
            titleTranslationKey: 'titleTranslationKey' as const,
            bodyTranslationKey: 'bodyTranslationKey' as const,
            linkTranslationKey: 'linkTranslationKey' as const,
            title: 'title' as const,
            body: 'body' as const,
            links: 'links' as const,
        };
    }

    public get propertyNames() {
        return PassageScreenTemplateVariables.propertyNames;
    }

    public get mainPassageFunction(): string {
        return `${this.passageId}Passage`;
    }

    public get passageIdTypeName(): string {
        return `T${this.chapterIdCapitalized}${this.characterIdCapitalized}PassageId`;
    }

    public get fullPassageReference(): string {
        return `${this.chapterId}-${this.characterId}-${this.passageId}`;
    }

    public get passageIdTypeImportPath(): string {
        return `../${this.chapterId}.passages`;
    }

    public get titleTranslationKey(): string {
        return this.passageId;
    }

    public get bodyTranslationKey(): string {
        return '';
    }

    public get linkTranslationKey(): string {
        return '';
    }

    public get quotedChapterId(): string {
        return `'${this.chapterId}'`;
    }

    public get quotedCharacterId(): string {
        return `'${this.characterId}'`;
    }

    public get quotedPassageId(): string {
        return `'${this.passageId}'`;
    }


    public generatePassageCode(template: string): string {
        return template
            .replace(/{mainPassageFunction}/g, this.mainPassageFunction)
            .replace(/{passageIdTypeName}/g, this.passageIdTypeName)
            .replace(/{passageIdTypeImportPath}/g, this.passageIdTypeImportPath)
            .replace(/{quotedChapterId}/g, this.quotedChapterId)
            .replace(/{quotedCharacterId}/g, this.quotedCharacterId)
            .replace(/{quotedPassageId}/g, this.quotedPassageId)
            .replace(/{titleTranslationKey}/g, this.titleTranslationKey)
            .replace(/{bodyTranslationKey}/g, this.bodyTranslationKey)
            .replace(/{linkTranslationKey}/g, this.linkTranslationKey)
            .replace(/{fullPassageReference}/g, this.fullPassageReference);
    }
}