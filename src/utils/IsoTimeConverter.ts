/**
 * Converts between ISO 8601 datetime format and the application's custom time format
 * 
 * ISO Format: "2025-08-07T21:33:00" or "2025-08-07T21:33"
 * App Format: "D.M.YYYY H:mm" or "D.M. H:mm" (for Time.fromString())
 */
export class IsoTimeConverter {
    constructor(private startYear: number = 2020) {} // Default start year

    /**
     * Converts ISO 8601 datetime string to app time format
     * @param isoString ISO datetime string (e.g., "2025-08-07T21:33:00")
     * @returns App format string (e.g., "7.8.2025 21:33")
     */
    fromIsoToAppFormat(isoString: string): string {
        if (!isoString) return '';

        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid ISO datetime string');
            }

            const day = date.getDate();
            const month = date.getMonth() + 1; // getMonth() returns 0-11
            const year = date.getFullYear();
            const hour = date.getHours();
            const minute = date.getMinutes();

            const formattedMinute = minute.toString().padStart(2, '0');
            
            // Include year in the format for compatibility with Time.fromString()
            return `${day}.${month}.${year} ${hour}:${formattedMinute}`;
        } catch (error) {
            console.error('Error converting ISO to app format:', error);
            throw new Error(`Failed to convert ISO datetime "${isoString}" to app format: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Converts app time format to ISO 8601 datetime string
     * @param appFormat App format string (e.g., "7.8.2025 21:33" or "7.8. 21:33")
     * @returns ISO datetime string (e.g., "2025-08-07T21:33:00")
     */
    fromAppFormatToIso(appFormat: string): string {
        if (!appFormat) return '';

        try {
            const [datePart, timePart] = appFormat.split(' ');
            if (!datePart || !timePart) {
                throw new Error('Invalid app format - expected "D.M.[YYYY] H:mm"');
            }

            const dateParts = datePart.split('.');
            const [hour, minute] = timePart.split(':').map(Number);

            let day: number, month: number, year: number;

            if (dateParts.length >= 3 && dateParts[2] && dateParts[2].trim() !== '') {
                // Format: "7.8.2025 21:33"
                [day, month, year] = dateParts.map(Number);
            } else {
                // Format: "7.8. 21:33" - use start year
                [day, month] = dateParts.map(Number);
                year = this.startYear;
            }

            if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute)) {
                throw new Error('Invalid date/time components');
            }

            // Create date object and format as ISO string
            const date = new Date(year, month - 1, day, hour, minute, 0);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date constructed from components');
            }

            // Format as ISO string without timezone (local datetime)
            const isoString = date.getFullYear().toString().padStart(4, '0') + '-' +
                            (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
                            date.getDate().toString().padStart(2, '0') + 'T' +
                            date.getHours().toString().padStart(2, '0') + ':' +
                            date.getMinutes().toString().padStart(2, '0') + ':' +
                            date.getSeconds().toString().padStart(2, '0');

            return isoString;
        } catch (error) {
            console.error('Error converting app format to ISO:', error);
            throw new Error(`Failed to convert app format "${appFormat}" to ISO: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Converts a time range object with ISO strings to app format
     * @param timeRange Object with start and end ISO strings
     * @returns Object with start and end in app format
     */
    convertTimeRangeFromIso(timeRange: { start?: string; end?: string }): { start?: string; end?: string } {
        const result: { start?: string; end?: string } = {};
        
        if (timeRange.start) {
            result.start = this.fromIsoToAppFormat(timeRange.start);
        }
        
        if (timeRange.end) {
            result.end = this.fromIsoToAppFormat(timeRange.end);
        }
        
        return result;
    }

    /**
     * Converts a time range object with app format strings to ISO
     * @param timeRange Object with start and end in app format
     * @returns Object with start and end in ISO format
     */
    convertTimeRangeToIso(timeRange: { start?: string; end?: string }): { start?: string; end?: string } {
        const result: { start?: string; end?: string } = {};
        
        if (timeRange.start) {
            result.start = this.fromAppFormatToIso(timeRange.start);
        }
        
        if (timeRange.end) {
            result.end = this.fromAppFormatToIso(timeRange.end);
        }
        
        return result;
    }

    /**
     * Validates if a string is in valid ISO 8601 format
     * @param isoString String to validate
     * @returns True if valid ISO format
     */
    isValidIso(isoString: string): boolean {
        if (!isoString) return false;
        
        try {
            const date = new Date(isoString);
            return !isNaN(date.getTime()) && 
                   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/.test(isoString);
        } catch {
            return false;
        }
    }

    /**
     * Validates if a string is in valid app format
     * @param appFormat String to validate
     * @returns True if valid app format
     */
    isValidAppFormat(appFormat: string): boolean {
        if (!appFormat) return false;
        
        // Matches "D.M. H:mm" or "DD.MM. HH:mm" or "D.M.YYYY H:mm" etc.
        const regex = /^\d{1,2}\.\d{1,2}\.(\d{4})?\s+\d{1,2}:\d{2}$/;
        return regex.test(appFormat);
    }
}

// Export singleton instance
export const isoTimeConverter = new IsoTimeConverter();