import { Request, Response } from 'express';
import { mapManager } from '../services/map.manager'; // Adjust path as necessary
import { MapUpdateRequest } from '../../types'; // Adjust path as necessary
import { logger } from '../../utils/logger';

/**
 * @desc    Update or create a map
 * @route   PUT /api/map/:mapId
 * @access  Public
 */
export const updateMapController = async (req: Request<{ mapId: string }>, res: Response): Promise<void> => {
  try {
    const { mapId } = req.params;
    const mapData = req.body as MapUpdateRequest;

    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Map ${mapId} updated successfully (demo mode)`,
      });
      return;
    }
    
    // Basic validation for mapData
    if (!mapData || typeof mapData.title !== 'string' || typeof mapData.width !== 'number' || 
        typeof mapData.height !== 'number' || !Array.isArray(mapData.data) ||
        !Array.isArray(mapData.locations) || !Array.isArray(mapData.maps)
    ) {
        res.status(400).json({ success: false, error: 'Invalid map data provided. Required fields: title, width, height, data, locations, maps.' });
        return;
    }

    await mapManager.updateMap(mapId, mapData);
    
    res.status(200).json({
      success: true,
      message: `Map ${mapId} updated successfully`,
    });
  } catch (error: any) {
    logger.error(`Error in updateMapController for mapId ${req.params.mapId}: ${error.message}`, { error });
    console.error(`Error in updateMapController for mapId ${req.params.mapId}:`, error);
    // Differentiate known errors (e.g., from manager validation) vs. unexpected ones
    if (error.message && (error.message.includes('Map ID cannot be empty') || error.message.includes('Failed to create maps directory'))) {
        res.status(400).json({ success: false, error: error.message });
    } else {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update map',
        });
    }
  }
};

/**
 * @desc    Get a map by ID
 * @route   GET /api/map/:mapId
 * @access  Public
 */
export const getMapController = async (req: Request<{ mapId: string }>, res: Response): Promise<void> => {
  try {
    const { mapId } = req.params;

    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Map retrieval successful (demo mode)`,
        data: {
          title: 'Demo Map',
          width: 10,
          height: 10,
          data: [],
          locations: [],
          maps: []
        }
      });
      return;
    }

    const mapData = await mapManager.getMap(mapId);
    
    if (mapData) {
      res.status(200).json({
        success: true,
        data: mapData,
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Map '${mapId}' not found`,
      });
    }
  } catch (error: any) {
    logger.error(`Error in getMapController for mapId ${req.params.mapId}: ${error.message}`, { error });
    console.error(`Error in getMapController for mapId ${req.params.mapId}:`, error);
    if (error.message && error.message.includes('Failed to read or parse map')) {
        res.status(500).json({ success: false, error: error.message });
    } else {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve map',
        });
    }
  }
};

/**
 * @desc    List all map IDs
 * @route   GET /api/maps
 * @access  Public
 */
export const listMapsController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: 'Map list retrieved successfully (demo mode)',
        data: ['demo_map_1', 'demo_map_2']
      });
      return;
    }
    
    const mapIds = await mapManager.listMaps();
    res.status(200).json({
      success: true,
      data: mapIds, // Returns an array of map IDs
    });
  } catch (error: any) {
    logger.error(`Error in listMapsController: ${error.message}`, { error });
    console.error('Error in listMapsController:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list maps',
    });
  }
};
