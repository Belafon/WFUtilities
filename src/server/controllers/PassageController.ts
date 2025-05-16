import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Request, Response } from 'express';
import { eventsDir } from '../../Paths';
import { PassageType, createPassageWithArgs, PassageArgs } from '../../commands/createPassage';
import { getScreenPassageContent } from '../../commands/passages/createScreenPassage';
import { createLinearPassage } from '../../commands/passages/createLinearPassage';
import { createTransitionPassage } from '../../commands/passages/createTransitionPassage';
import { removePassage, removePassageById } from '../../commands/removePassage';
import { TokenGroup, TypeScriptCodeBuilder, TypeScriptObjectBuilder } from '../../typescriptObjectParser/ObjectParser';

export class PassageController {

    public async updateScreenPassage(req: Request, res: Response): Promise<void> {
        const passageIdFromParams = req.params.passageId; // e.g., "kingdom-thomas-visit"
        
        // Define the expected body structure based on PassageUpdateRequest for 'screen' type
        interface ScreenPassageUpdatePayload {
            title?: string;
            image?: string;
            type: 'screen'; // Type discriminator, should be 'screen' for this handler
            // body?: any[]; // Full body update is complex and deferred
        }
        // Destructure cautiously, as not all fields from PassageUpdateRequest are relevant here
        const { title, image, type: typeFromRequest } = req.body as Partial<ScreenPassageUpdatePayload>;

        if (typeFromRequest && typeFromRequest !== 'screen') {
             res.status(400).json({
                success: false,
                error: `Invalid passage type '${typeFromRequest}' for this endpoint. Expected 'screen'.`
            });
            return;
        }

        const parts = validatePassageId(passageIdFromParams, res);
        if (!parts) {
            // validatePassageId already sent a response
            return;
        }
        const [eventId, characterId, passagePartId] = parts; // e.g., passagePartId = "visit"

        try {
            const characterPassagesFolder = path.join(
                eventsDir(), 
                eventId,
                `${characterId}.passages`
            );

            if (!fs.existsSync(characterPassagesFolder)) {
                res.status(404).json({
                    success: false,
                    error: `Character passages folder not found: ${characterPassagesFolder}`
                });
                return;
            }
            
            // Convention: if passagePartId is "visit", exported const is "visitPassage"
            // and file is "visitPassage.ts"
            const expectedFunctionName = `${passagePartId}Passage`; // e.g., "visitPassage"

            const files = fs.readdirSync(characterPassagesFolder);
            const passageFile = files.find(file => {
                const baseName = path.basename(file, '.ts'); // Get filename without .ts extension
                return baseName.toLowerCase() === expectedFunctionName.toLowerCase();
            });

            if (!passageFile) {
                res.status(404).json({
                    success: false,
                    error: `Passage file not found for function name: ${expectedFunctionName} in ${characterPassagesFolder}`
                });
                return;
            }

            const passageFilePath = path.join(characterPassagesFolder, passageFile);
            const currentFileContent = fs.readFileSync(passageFilePath, 'utf-8');

            const codeBuilder = new TypeScriptCodeBuilder(currentFileContent);

            // Find the main passage object literal.
            // It's the object that has `id: 'passagePartId'`.
            let targetObjectGroup: TokenGroup | null = null;
            const allObjectLiterals = findAllMatchingGroups(codeBuilder.rootGroup, g => g.type === 'ObjectLiteral');

            for (const objGroup of allObjectLiterals) {
                const tempObjBuilder = new TypeScriptObjectBuilder(codeBuilder, objGroup, currentFileContent);
                // Accessing findPropertyByName logic (even if it's not public on the instance)
                const propertyInfo = (tempObjBuilder as any).findPropertyByName('id'); 

                if (propertyInfo && propertyInfo.name === 'id') { // Ensure it's actually the 'id' property
                    const idValueText = currentFileContent.substring(propertyInfo.valueStart, propertyInfo.valueEnd).trim();
                    // The id in the passage object is a string literal, e.g., 'visit'
                    if (idValueText === `'${passagePartId}'` || idValueText === `"${passagePartId}"`) {
                        targetObjectGroup = objGroup;
                        break;
                    }
                }
            }

            if (!targetObjectGroup) {
                res.status(404).json({
                    success: false,
                    error: `Passage object literal with id '${passagePartId}' not found in ${passageFile}`
                });
                return;
            }
            
            const passageObjectBuilder = new TypeScriptObjectBuilder(codeBuilder, targetObjectGroup, currentFileContent);

            let hasMadeUpdates = false;

            if (title !== undefined) {
                // Assuming title is stored as _('some_key') in the passage file
                // The request provides the new key: 'new_key'
                passageObjectBuilder.setPropertyValue('title', `_('${title}')`);
                hasMadeUpdates = true;
            }

            if (image !== undefined) {
                // Image is stored as a string literal, e.g., 'path/to/image.png'
                passageObjectBuilder.setPropertyValue('image', `'${image}'`);
                hasMadeUpdates = true;
            }
            
            // If 'body' or other complex properties were to be updated, logic would go here.
            // For example:
            // if (req.body.body) {
            //    const newBodyAsString = convertJsonBodyToTsString(req.body.body); // This function would be complex
            //    passageObjectBuilder.setPropertyValue('body', newBodyAsString);
            //    hasMadeUpdates = true;
            // }


            if (!hasMadeUpdates) {
                res.json({
                    success: true,
                    message: `Passage ${passageIdFromParams} not modified (no updatable fields provided or values were the same).`
                });
                return;
            }

            const updatedContent = await codeBuilder.toString();
            
            // Only write if content has actually changed (optional optimization)
            if (updatedContent !== currentFileContent) {
                fs.writeFileSync(passageFilePath, updatedContent);
            }

            res.json({
                success: true,
                message: `Passage ${passageIdFromParams} updated successfully.`
            });

        } catch (error) {
            console.error(`Error updating passage ${passageIdFromParams}:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Log the stack trace for server-side debugging
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
            res.status(500).json({
                success: false,
                error: `Failed to update passage: ${errorMessage}`
            });
        }
    }


    public async deletePassage(req: Request, res: Response): Promise<void> {
        const passageId = req.params.passageId;

        const parts = validatePassageId(passageId, res);
        if (!parts) {
            return;
        }
        const [eventId, characterId, passagePartId] = parts;

        try {
            removePassageById(eventId, characterId, passagePartId);

            res.json({
                success: true,
                message: `Passage ${passageId} deleted successfully`
            });
        } catch (error) {
            console.error('Error deleting passage:', error);
            res.status(500).json({
                success: false,
                error: `Failed to delete passage: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    public async openPassage(req: Request, res: Response): Promise<void> {
        const passageId = req.params.passageId;

        const parts = validatePassageId(passageId, res);
        if (!parts) {
            return;
        }
        const [eventId, characterId, passagePartId] = parts;

        try {
            const characterPassagesFolder = path.join(
                eventsDir(),
                eventId,
                `${characterId}.passages`
            );

            if (!fs.existsSync(characterPassagesFolder)) {
                res.status(404).json({
                    success: false,
                    error: `Character passages folder not found: ${characterPassagesFolder}`
                });
                return;
            }

            // Find the passage file
            const files = fs.readdirSync(characterPassagesFolder);
            const passageFile = files.find(file =>
                file.startsWith(passagePartId)
            );

            if (!passageFile) {
                res.status(404).json({
                    success: false,
                    error: `Passage file not found for ID: ${passagePartId}`
                });
                return;
            }

            // Open the file in VS Code
            const fileUri = vscode.Uri.file(path.join(characterPassagesFolder, passageFile));
            await vscode.window.showTextDocument(fileUri);

            res.json({
                success: true,
                message: `Opened passage file: ${passageFile}`
            });
        } catch (error) {
            console.error('Error opening passage:', error);
            res.status(500).json({
                success: false,
                error: `Failed to open passage: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
}

function validatePassageId(passageId: string, res: Response<any, Record<string, any>>) : string[] | null {
    const parts = passageId.split('-');
    if (parts.length !== 3) {
        res.status(400).json({
            success: false,
            error: 'Invalid passage ID format. Expected format: eventId-characterId-passagePartId'
        });
        return null;
    }
    return parts;
}
