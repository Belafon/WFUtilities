export interface ICharacterPassageInfo {
    characterId: string;
    passages: IPassageInfo[];
}

export interface IPassageInfo {
    passageId: string;
    functionName: string;
    filePath: string;
}

export class EventPassagesTemplateVariables {
    public readonly eventIdCapitalized: string;

    constructor(
        public readonly eventId: string,
    ) {
        this.eventIdCapitalized = eventId.charAt(0).toUpperCase() + eventId.slice(1);
    }

    public static get propertyNames() {
        return {
            eventId: 'eventId' as const,
            passages: 'passages' as const,
            characterPassages: 'characterPassages' as const,
        };
    }

    public get propertyNames() {
        return EventPassagesTemplateVariables.propertyNames;
    }

    public get eventPassagesConstName(): string {
        return `${this.eventId}EventPassages`;
    }

    public get eventPassageIdType(): string {
        return `T${this.eventIdCapitalized}PassageId`;
    }

    public get quotedEventId(): string {
        return `'${this.eventId}'`;
    }

    public get passageIdUnion(): string {
        return 'never';
    }

    public generateEventPassagesCode(template: string): string {
        return template
            .replace(/{characterImports}/g, '\n')
            .replace(/{eventPassageIdType}/g, this.eventPassageIdType)
            .replace(/{passageIdUnion}/g, this.passageIdUnion)
            .replace(/{characterPassageIdTypes}/g, '\n')
            .replace(/{eventPassagesConstName}/g, this.eventPassagesConstName)
            .replace(/{quotedEventId}/g, this.quotedEventId)
            .replace(/{passageRecordEntries}/g, '\n');
    }
}