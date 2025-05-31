export class EventTemplateVariables {
    public readonly eventIdCapitalized: string;

    constructor(
        public readonly eventId: string,
        public readonly title: string = '',
        public readonly description: string = '',
        public readonly location: string = 'village',
        public readonly timeStart: string = '2.1. 8:00',
        public readonly timeEnd: string = '5.1. 8:00',
        public readonly childEventName: string = '',
        public readonly childEventImportPath: string = '',
        public readonly childCondition: string = '',
    ) {
        this.eventIdCapitalized = eventId.charAt(0).toUpperCase() + eventId.slice(1);
    }

    public get mainEventFunction(): string {
        return `${this.eventId}Event`;
    }

    public get eventTitle(): string {
        return this.title || `${this.eventIdCapitalized} Event`;
    }

    public get eventDescription(): string {
        return this.description || `A ${this.eventIdCapitalized} event is happening`;
    }

    public get eventDataTypeName(): string {
        return `T${this.eventIdCapitalized}EventData`;
    }

    public get quotedEventId(): string {
        return `'${this.eventId}'`;
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

    public get quotedChildCondition(): string {
        return `'${this.childCondition}'`;
    }

    public get childEventImport(): string {
        return this.childEventName;
    }

    public get childEventPath(): string {
        return this.childEventImportPath;
    }

    public generateEventCode(template: string, initObjectContent: string = '', eventDataTypeContent: string = ''): string {
        const defaultInitContent = initObjectContent || `mojePromena: {
            time: 0,
            asd: 'asd',
        },`;

        const defaultTypeContent = eventDataTypeContent || `mojePromena: {
        time: number;
        asd: string;
    };`;

        return template
            .replace(/{mainEventFunction}/g, this.mainEventFunction)
            .replace(/{quotedEventId}/g, this.quotedEventId)
            .replace(/{eventTitle}/g, this.eventTitle)
            .replace(/{eventDescription}/g, this.eventDescription)
            .replace(/{quotedLocation}/g, this.quotedLocation)
            .replace(/{quotedTimeStart}/g, this.quotedTimeStart)
            .replace(/{quotedTimeEnd}/g, this.quotedTimeEnd)
            .replace(/{childEventImport}/g, this.childEventImport)
            .replace(/{childEventPath}/g, this.childEventPath)
            .replace(/{quotedChildCondition}/g, this.quotedChildCondition)
            .replace(/{eventDataTypeName}/g, this.eventDataTypeName)
            .replace(/{initObjectContent}/g, defaultInitContent)
            .replace(/{eventDataTypeContent}/g, defaultTypeContent);
    }
}