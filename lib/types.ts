export interface Pond {
  id: string
  name: string
  area_acres?: number
}

export interface CropCycle {
  id: string
  pond_id: string
  species: string
  stocking_date: string
  stocking_density: number
  harvest_window_start?: string
  harvest_window_end?: string
}

export interface PondLog {
  id: string
  cycle_id: string
  observed_at: string
  do_mgl?: number
  ph?: number
  ammonia_mgl?: number
  temp_c?: number
  salinity_ppt?: number
  calcium_mgl?: number
  magnesium_mgl?: number
  potassium_mgl?: number
  mortality_count?: number
  biomass_kg?: number
}
