export interface ICharacterPassageInfo {
    characterId: string;
    passages: IPassageInfo[];
}

export interface IPassageInfo {
    passageId: string;
    functionName: string;
    filePath: string;
}

export class ChapterPassagesTemplateVariables {
    public readonly chapterIdCapitalized: string;

    constructor(
        public readonly chapterId: string,
    ) {
        this.chapterIdCapitalized = chapterId.charAt(0).toUpperCase() + chapterId.slice(1);
    }

    public static get propertyNames() {
        return {
            chapterId: 'chapterId' as const,
            passages: 'passages' as const,
            characterPassages: 'characterPassages' as const,
        };
    }

    public get propertyNames() {
        return ChapterPassagesTemplateVariables.propertyNames;
    }

    public get chapterPassagesConstName(): string {
        return `${this.chapterId}ChapterPassages`;
    }

    public get chapterPassageIdType(): string {
        return `T${this.chapterIdCapitalized}PassageId`;
    }

    public get quotedChapterId(): string {
        return `'${this.chapterId}'`;
    }

    public get passageIdUnion(): string {
        return 'never';
    }

    public generateChapterPassagesCode(template: string): string {
        return template
            .replace(/{characterImports}/g, '\n')
            .replace(/{chapterPassageIdType}/g, this.chapterPassageIdType)
            .replace(/{passageIdUnion}/g, this.passageIdUnion)
            .replace(/{characterPassageIdTypes}/g, '\n')
            .replace(/{chapterPassagesConstName}/g, this.chapterPassagesConstName)
            .replace(/{quotedChapterId}/g, this.quotedChapterId)
            .replace(/{passageRecordEntries}/g, '\n');
    }
}