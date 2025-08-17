export class ChapterTemplateVariables {
    public readonly chapterIdCapitalized: string;

    constructor(
        public readonly chapterId: string,
        public readonly title: string = '',
        public readonly description: string = '',
        public readonly location: string = 'village',
        public readonly timeStart: string = '2.1. 8:00',
        public readonly timeEnd: string = '5.1. 8:00',
    ) {
        this.chapterIdCapitalized = chapterId.charAt(0).toUpperCase() + chapterId.slice(1);
    }

    public static get propertyNames() {
        return {
            title: 'title' as const,
            description: 'description' as const,
            location: 'location' as const,
            timeRange: 'timeRange' as const,
            chapterId: 'chapterId' as const,
            children: 'children' as const,
        };
    }

    public get propertyNames() {
        return ChapterTemplateVariables.propertyNames;
    }

    public get mainChapterFunction(): string {
        return `${this.chapterId}Chapter`;
    }

    public get chapterTitle(): string {
        return this.title || `${this.chapterIdCapitalized} Chapter`;
    }

    public get chapterDescription(): string {
        return this.description || `A ${this.chapterIdCapitalized} chapter is happening`;
    }

    public get chapterDataTypeName(): string {
        return `T${this.chapterIdCapitalized}ChapterData`;
    }

    public get quotedChapterId(): string {
        return `'${this.chapterId}'`;
    }

    public get quotedLocation(): string {
        return `'${this.location}'`;
    }

    public get quotedTimeStart(): string {
        return `'${this.timeStart}'`;
    }

    public get quotedTimeEnd(): string {
        return `'${this.timeEnd}'`;
    }

    public generateChapterCode(template: string, initObjectContent: string = '', chapterDataTypeContent: string = ''): string {
        const defaultInitContent = initObjectContent || `mojePromena: {
            time: 0,
            asd: 'asd',
        },`;

        const defaultTypeContent = chapterDataTypeContent || `mojePromena: {
        time: number;
        asd: string;
    };`;

        return template
            .replace(/{mainChapterFunction}/g, this.mainChapterFunction)
            .replace(/{quotedChapterId}/g, this.quotedChapterId)
            .replace(/{chapterTitle}/g, this.chapterTitle)
            .replace(/{chapterDescription}/g, this.chapterDescription)
            .replace(/{quotedLocation}/g, this.quotedLocation)
            .replace(/{quotedTimeStart}/g, this.quotedTimeStart)
            .replace(/{quotedTimeEnd}/g, this.quotedTimeEnd)
            .replace(/{chapterDataTypeName}/g, this.chapterDataTypeName)
            .replace(/{initObjectContent}/g, defaultInitContent)
            .replace(/{chapterDataTypeContent}/g, defaultTypeContent);
    }
}