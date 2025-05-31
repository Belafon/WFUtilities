export class LocationTemplateVariables {
    public readonly locationIdCapitalized: string;

    constructor(
        public readonly locationId: string,
        public readonly locationName: string = '',
        public readonly description: string = '',
        public readonly localCharacters: string = '[]',
    ) {
        this.locationIdCapitalized = locationId.charAt(0).toUpperCase() + locationId.slice(1);
    }


    public static get propertyNames() {
        return {
            locationName: 'locationName' as const,
            description: 'description' as const,
            localCharacters: 'localCharacters' as const,
            locationId: 'locationId' as const,
        };
    }

    public get propertyNames() {
        return LocationTemplateVariables.propertyNames;
    }

    public get mainLocationFunction(): string {
        return `${this.locationId}Location`;
    }

    public get displayName(): string {
        return this.locationName || this.locationIdCapitalized;
    }

    public get quotedLocationId(): string {
        return `'${this.locationId}'`;
    }

    public get quotedLocationName(): string {
        return `'${this.locationId}'`;
    }

    public get locationDataTypeName(): string {
        return `T${this.locationIdCapitalized}LocationData`;
    }

    public generateLocationCode(template: string, initObjectContent?: string, locationDataTypeContent?: string): string {
        const defaultInitContent = initObjectContent || '';

        const defaultTypeContent = locationDataTypeContent || '';

        return template
            .replace(/{mainLocationFunction}/g, this.mainLocationFunction)
            .replace(/{quotedLocationId}/g, this.quotedLocationId)
            .replace(/{quotedLocationName}/g, this.quotedLocationName)
            .replace(/{description}/g, this.description)
            .replace(/{localCharacters}/g, this.localCharacters)
            .replace(/{locationDataTypeName}/g, this.locationDataTypeName)
            .replace(/{initObjectContent}/g, defaultInitContent)
            .replace(/{locationDataTypeContent}/g, defaultTypeContent);
    }
}