import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import e, { Request, Response } from 'express';
import { eventsDir } from '../../Paths';
import { removeEventById } from '../../commands/removeEvent';
import { start } from 'repl';
import { TypeScriptCodeBuilder } from '../../typescriptObjectParser/ObjectParser';

export class EventController {


    /**
     * Updates an event file by parsing the source code, modifying the event object literal,
     * and writing back the updated content. It uses the new TypeScript code parser.
     *
     * @param req - The Express request object.
     * @param res - The Express response object.
     */
    public async updateEvent(req: Request, res: Response): Promise<void> {
        const eventId: string = req.params.eventId;
        const { title, description, location, timeRange } = req.body;

        try {
            // Construct the path to the event directory and event file
            const eventDirPath = path.join(eventsDir(), eventId);
            const eventFilePath = path.join(eventDirPath, `${eventId}.event.ts`);

            // Check if the event file exists
            if (!fs.existsSync(eventFilePath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }

            // Read the current event file content
            let eventContent: string = fs.readFileSync(eventFilePath, 'utf-8');

            // Create a new code builder and parse the event file content.
            const builder = new TypeScriptCodeBuilder(eventContent);

            // Determine the variable name of the event object.
            // For example, if the eventId is "kingdom", the event object variable name is assumed to be "kingdomEvent".
            const eventVariableName = `${eventId}Event`;

            // Find the event object literal in the code and update its properties.
            builder.findObject(eventVariableName, {
                onFound: (objectBuilder) => {
                    // Update the "title" property if provided.
                    if (title) {
                        // Replace the property value with the new title wrapped in single quotes.
                        objectBuilder.setPropertyValue('title', `'${title}'`);
                    }
                    // Update the "description" property if provided.
                    if (description) {
                        objectBuilder.setPropertyValue('description', `'${description}'`);
                    }
                    // Update the "location" property if provided.
                    if (location) {
                        objectBuilder.setPropertyValue('location', `'${location}'`);
                    }
                    // Update the nested "timeRange" property if both start and end are provided.
                    if (timeRange && timeRange.start && timeRange.end) {
                        // Create a new object literal text for timeRange.
                        const newTimeRange = `{
    start: Time.fromString('${timeRange.start}'),
    end: Time.fromString('${timeRange.end}')
}`;
                        objectBuilder.setPropertyValue('timeRange', newTimeRange);
                    }
                },
                onNotFound: () => {
                    console.error(`Event object "${eventVariableName}" not found in the file.`);
                }
            });

            // Retrieve the updated source code from the builder.
            const updatedContent = await builder.toString();

            // Write the updated content back to the event file.
            fs.writeFileSync(eventFilePath, updatedContent);

            res.json({
                success: true,
                message: `Event ${eventId} updated successfully`
            });
        } catch (error) {
            console.error('Error updating event:', error);
            res.status(500).json({
                success: false,
                error: `Failed to update event: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    public async setEventTime(req: Request, res: Response): Promise<void> {
        const eventId = req.params.eventId;
        const { timeRange } = req.body;
    
        try {
            // Construct path to event file
            const eventDirPath = path.join(eventsDir(), eventId);
            const eventFilePath = path.join(eventDirPath, `${eventId}.event.ts`);
    
            // Check if event exists
            if (!fs.existsSync(eventFilePath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }
    
            // Read the current event file content
            let eventContent: string = fs.readFileSync(eventFilePath, 'utf-8');
    
            // Create a new code builder and parse the event file content
            const builder = new TypeScriptCodeBuilder(eventContent);
    
            // Determine the variable name of the event object
            const eventVariableName = `${eventId}Event`;
    
            // Find the event object literal in the code and update its timeRange property
            builder.findObject(eventVariableName, {
                onFound: (objectBuilder) => {
                    if (timeRange && timeRange.start && timeRange.end) {
                        // Create a new object literal text for timeRange
                        const newTimeRange = `{
        start: Time.fromString('${timeRange.start}'),
        end: Time.fromString('${timeRange.end}')
    }`;
                        objectBuilder.setPropertyValue('timeRange', newTimeRange);
                    }
                },
                onNotFound: () => {
                    console.error(`Event object "${eventVariableName}" not found in the file.`);
                }
            });
    
            // Retrieve the updated source code from the builder
            const updatedContent = await builder.toString();
    
            // Write the updated content back to the file
            fs.writeFileSync(eventFilePath, updatedContent);
    
            res.json({
                success: true,
                message: `Event ${eventId} time range updated successfully`
            });
        } catch (error) {
            console.error('Error updating event time:', error);
            res.status(500).json({
                success: false,
                error: `Failed to update event time: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }


    public async openEvent(req: Request, res: Response): Promise<void> {
        const eventId = req.params.eventId;
        console.log('Opening event:', eventId);
    
        try {
            // Construct path to event file
            const eventDirPath = path.join(eventsDir(), eventId);
            const eventFilePath = path.join(eventDirPath, `${eventId}.event.ts`);
    
            // Check if event exists
            if (!fs.existsSync(eventFilePath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }
    
            // Open the file in VS Code
            const fileUri = vscode.Uri.file(eventFilePath);
            await vscode.window.showTextDocument(fileUri);
    
            res.json({
                success: true,
                message: `Opened event file: ${eventId}`
            });
        } catch (error) {
            console.error('Error opening event:', error);
            res.status(500).json({
                success: false,
                error: `Failed to open event: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    public async deleteEvent(req: Request, res: Response): Promise<void> {
        const eventId = req.params.eventId;

        try {
            // Check if event exists
            const eventDirPath = path.join(eventsDir(), eventId);
            if (!fs.existsSync(eventDirPath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }

            await removeEventById(eventId);

            res.json({
                success: true,
                message: `Event ${eventId} deleted successfully`
            });
        } catch (error) {
            console.error('Error deleting event:', error);
            res.status(500).json({
                success: false,
                error: `Failed to delete event: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

}