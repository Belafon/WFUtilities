import express, { Express, NextFunction, Request, Response } from 'express';
import * as vscode from 'vscode';
import * as swaggerUi from 'swagger-ui-express';
import * as YAML from 'yamljs';
import * as path from 'path';
import cors from 'cors';
import { PassageController } from './controllers/PassageController';
import { EventController } from './controllers/EventController';

let server: ReturnType<typeof express.application.listen> | null = null;
const PORT = 3149;

class HelloWorldController {
    public getHello(req: express.Request, res: express.Response): void {
        const name = req.query.name?.toString() || 'World';
        res.json({
            message: `Hello, ${name}!`,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Load and validate Swagger/OpenAPI specification
 */
function loadSwaggerSpec(yamlPath: string): object {
    const swaggerDocument = YAML.load(yamlPath);
    if (!swaggerDocument) {
        throw new Error(`Could not load OpenAPI specification from ${yamlPath}`);
    }
    return swaggerDocument;
}

/**
 * Configure Swagger UI static file serving
 */
function configureSwaggerStatic(app: Express): void {
    const swaggerUiAssetPath = require.resolve('swagger-ui-dist/swagger-ui.css');
    const swaggerUiDist = path.dirname(swaggerUiAssetPath);

    app.use('/swagger-ui-dist', express.static(swaggerUiDist, {
        setHeaders: (res, path) => {
            if (path.endsWith('.css')) {
                res.setHeader('Content-Type', 'text/css');
            } else if (path.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript');
            }
        }
    }));
}


function getSwaggerUIOptions(): swaggerUi.SwaggerUiOptions {
    return {
        customCssUrl: '/swagger-ui-dist/swagger-ui.css',
        customJs: [
            '/swagger-ui-dist/swagger-ui-bundle.js',
            '/swagger-ui-dist/swagger-ui-standalone-preset.js'
        ],
        swaggerOptions: {
            url: '/api-docs/swagger.json'
        },
        explorer: true
    };
}


function configureSwaggerDocs(app: Express, swaggerDocument: object): void {
    app.get('/api-docs/swagger.json', (req, res) => {
        res.json(swaggerDocument);
    });

    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(swaggerDocument, getSwaggerUIOptions()));
}


const setCorsHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    next();
};

export function registerRoutes(app: Express): void {
    const passageController = new PassageController();
    const eventController = new EventController(); 

    // Apply CORS middleware to all routes
    app.use(setCorsHeaders);

    // Event routes
    app.put('/event/:eventId', eventController.updateEvent);
    app.delete('/event/:eventId', eventController.deleteEvent);
    app.post('/event/:eventId/open', eventController.openEvent);
    app.post('/event/:eventId/setTime', eventController.setEventTime);

    // Passage routes
    app.put('/passage/:passageId', passageController.updatePassage);
    app.delete('/passage/:passageId', passageController.deletePassage);
    app.post('/passage/:passageId/open', passageController.openPassage);
}
function startServer(app: Express): ReturnType<typeof express.application.listen> {
    return app.listen(PORT, () => {
        const serverStartedMessage = `Server started on port ${PORT}`;
        const swaggerUIMessage = `Swagger UI available at http://localhost:${PORT}/api-docs`;
        
        vscode.window.showInformationMessage(serverStartedMessage);
        vscode.window.showInformationMessage(swaggerUIMessage);
        console.log(serverStartedMessage);
        console.log(swaggerUIMessage);
    });
}

export const startNodeServerCommand = async () => {
    if (server) {
        vscode.window.showInformationMessage('Server is already running!');
        return;
    }

    const app = express();

    try {
        // Configure basic middleware
        app.use(express.json());

        const yamlPath = path.join(__dirname, 'openapi.yaml');
        const swaggerDocument = loadSwaggerSpec(yamlPath);

        configureSwaggerStatic(app);

        configureSwaggerDocs(app, swaggerDocument);

        registerRoutes(app);

        app.use(cors({
            origin: 'http://localhost:3000',
        }));

        server = startServer(app);

    } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const stopNodeServerCommand = () => {
    if (!server) {
        vscode.window.showInformationMessage('Server is not running!');
        return;
    }

    try {
        server.close(() => {
            server = null;
            vscode.window.showInformationMessage('Server stopped successfully');
        });
    } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage(`Failed to stop server: ${error instanceof Error ? error.message : String(error)}`);
    }
};