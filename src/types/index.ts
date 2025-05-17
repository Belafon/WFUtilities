// Common types for the application based on OpenAPI specification

export interface TimeRange {
  start: string;
  end: string;
}

export interface EventUpdateRequest {
  title: string;
  description: string;
  location: string;
  timeRange: TimeRange;
}

export interface SetTimeRequest {
  timeRange: TimeRange;
}

export interface TLinkCostItem {
  id: string;
  amount: number;
}

export interface TLinkCostObjectUpdateRequest {
  time?: {
    value: number;
    unit: 'min' | 'hour' | 'day';
  };
  items?: TLinkCostItem[];
  tools?: string[];
}

export type TLinkCostUpdateRequest = 
  | { value: number; unit: 'min' | 'hour' | 'day' }
  | TLinkCostObjectUpdateRequest;

export interface TLinkUpdateRequest {
  text?: string;
  passageId?: string;
  autoPriority?: number;
  cost?: TLinkCostUpdateRequest;
}

export interface TPassageScreenBodyItemUpdateRequest {
  condition?: boolean;
  redirect?: string;
  text?: string;
  links?: TLinkUpdateRequest[];
}

export interface PassageUpdateRequest {
  type: 'screen' | 'linear' | 'transition';
  title?: string;
  image?: string;
  body?: TPassageScreenBodyItemUpdateRequest[];
  description?: string;
  nextPassageId?: string;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

// New Map related type definitions
export interface MapTileData {
  tile: string;
  title?: string;
}

export interface MapLocationReference {
  i: number;
  j: number;
  locationId: string;
}

export interface MapMapReference {
  i: number;
  j: number;
  mapId: string;
}

export interface MapData {
  title: string;
  width: number;
  height: number;
  data: MapTileData[][];
  locations: MapLocationReference[];
  maps: MapMapReference[];
}

// This is used for the PUT request body
export interface MapUpdateRequest extends MapData {}